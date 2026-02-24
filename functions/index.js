const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Set global options to reduce latency
setGlobalOptions({ region: "us-central1" });

// ==================================================================
// 1. CALENDAR FEED (For Google/Outlook/Apple Sync)
// ==================================================================
exports.calendarFeed = onRequest(async (req, res) => {
    const doctorUid = req.query.uid;

    if (!doctorUid) {
        res.status(400).send("Missing 'uid' parameter.");
        return;
    }

    try {
        const now = new Date();
        const pastDate = new Date();
        pastDate.setDate(now.getDate() - 7); 

        const snapshot = await db.collection("appointments")
            .where("doctorId", "==", doctorUid)
            .where("start", ">=", pastDate.toISOString())
            .get();

        let icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//AUNA//Doctor Board//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:AUNA Citas",  
            "X-WR-TIMEZONE:America/Mexico_City"
        ];

        snapshot.forEach(doc => {
            const data = doc.data();
            const created = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
            const start = new Date(data.start).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
            const end = new Date(data.end).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

            let description = `Paciente: ${data.patientName}\\nTel: ${data.patientPhone || 'N/A'}`;
            let summary = `Cita: ${data.patientName}`;
            if (data.status === 'completed') summary = `[Completed] ${summary}`;
            
            icsContent.push("BEGIN:VEVENT");
            icsContent.push(`UID:${doc.id}@auna-board.web.app`);
            icsContent.push(`DTSTAMP:${created}`);
            icsContent.push(`DTSTART:${start}`);
            icsContent.push(`DTEND:${end}`);
            icsContent.push(`SUMMARY:${summary}`);
            icsContent.push(`DESCRIPTION:${description}`);
            icsContent.push("STATUS:CONFIRMED");
            icsContent.push("END:VEVENT");
        });

        icsContent.push("END:VCALENDAR");

        res.set("Content-Type", "text/calendar; charset=utf-8");
        res.set("Content-Disposition", "attachment; filename=\"citas-auna.ics\"");
        res.send(icsContent.join("\r\n"));

    } catch (error) {
        console.error("Error generating calendar:", error);
        res.status(500).send("Internal Server Error");
    }
});

// ==================================================================
// 2. NEW APPOINTMENT NOTIFICATION (Instant Push)
// ==================================================================
exports.sendAppointmentNotification = onDocumentCreated("appointments/{apptId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const doctorId = data.doctorId; // This is the Auth UID (e.g., Q4W...)
    
    if (!doctorId) return;

    try {
        let fcmToken = null;
        let prefs = {};

        // STRATEGY 1: Try to find a document with this exact ID
        let doctorDoc = await db.collection('doctors').doc(doctorId).get();

        if (doctorDoc.exists) {
            fcmToken = doctorDoc.data().fcmToken;
            prefs = doctorDoc.data().notificationSettings || {};
        } else {
            // STRATEGY 2: If not found, search for the doctor who has this 'authUID'
            console.log(`Doctor ID ${doctorId} not found as a filename. Searching via authUID...`);
            const query = await db.collection('doctors').where('authUID', '==', doctorId).limit(1).get();
            
            if (!query.empty) {
                const docData = query.docs[0].data();
                fcmToken = docData.fcmToken;
                prefs = docData.notificationSettings || {};
                console.log(`Found doctor via authUID: ${query.docs[0].id}`);
            }
        }

        // CHECK PREFERENCE: New Appointment
        // Default to TRUE if setting is missing
        if (prefs.newAppt === false) {
            console.log(`Doctor ${doctorId} has disabled New Appointment alerts.`);
            return;
        }

        if (!fcmToken) {
            console.log(`No token found for Doctor ID: ${doctorId}.`);
            return;
        }

        // Create the Message (With Sound)
        const message = {
            token: fcmToken,
            notification: {
                title: 'New Appointment!',
                body: `${data.patientName} - ${new Date(data.start).toLocaleTimeString('en-US', {timeZone: 'America/Mexico_City', hour: '2-digit', minute:'2-digit'})}`
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'default',
                    priority: 'high',
                    defaultSound: true
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        contentAvailable: true
                    }
                }
            },
            data: {
                appointmentId: event.params.apptId
            }
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);

    } catch (error) {
        console.error('Error sending notification:', error);
    }
});

// ==================================================================
// 3. CANCELLATION NOTIFICATION (Bonus Feature)
// ==================================================================
// ==================================================================
// 3. CANCELLATION NOTIFICATION (Updated with Smart Search)
// ==================================================================
exports.sendCancellationNotification = onDocumentDeleted("appointments/{apptId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const data = snapshot.data();
    
    // Don't send alert for past appointments
    if (new Date(data.start).getTime() < Date.now()) return;

    try {
        const doctorId = data.doctorId;
        let docData = null;

        // STRATEGY 1: Direct ID
        let doctorDoc = await db.collection('doctors').doc(doctorId).get();
        if (doctorDoc.exists) {
            docData = doctorDoc.data();
        } else {
            // STRATEGY 2: AuthUID lookup (The Fix)
            const q2 = await db.collection('doctors').where('authUID', '==', doctorId).limit(1).get();
            if(!q2.empty) docData = q2.docs[0].data();
        }

        if (!docData) return;
        
        // CHECK PREFERENCE
        const prefs = docData.notificationSettings || {};
        if (prefs.cancelAppt === false) return; 

        if (docData.fcmToken) {
             const message = {
                token: docData.fcmToken,
                notification: {
                    title: '❌ Appointment Cancelled',
                    body: `${data.patientName} was scheduled for today.`
                },
                android: { priority: 'high', notification: { sound: 'default' } }
            };
            await admin.messaging().send(message);
        }
    } catch(e) { console.error(e); }
});

// ==================================================================
// 4. THE CRON JOB (Reminders) - Runs every 5 minutes
// ==================================================================
exports.sendAppointmentReminders = onSchedule("every 5 minutes", async (event) => {
    const now = new Date();
    // Look ahead 2.5 hours max (covers the 2-hour reminder setting)
    const lookAhead = new Date(now.getTime() + (150 * 60000)); 

    try {
        // 1. Get appointments starting soon that haven't been reminded yet
        const query = await db.collection('appointments')
            .where('start', '>=', now.toISOString())
            .where('start', '<=', lookAhead.toISOString())
            .where('reminderSent', '!=', true) 
            .get();

        if (query.empty) return;

        // 2. Loop through appointments
        const promises = query.docs.map(async (apptDoc) => {
            const appt = apptDoc.data();
            const doctorId = appt.doctorId;

            // 3. Get Doctor Settings
            let docData = null;
            let fcmToken = null;

            // Try direct lookup
            let doctorDoc = await db.collection('doctors').doc(doctorId).get();
            if (doctorDoc.exists) {
                docData = doctorDoc.data();
            } else {
                 // Try AuthUID lookup (Fix for identity crisis)
                 const q2 = await db.collection('doctors').where('authUID', '==', doctorId).limit(1).get();
                 if(!q2.empty) docData = q2.docs[0].data();
            }

            if (!docData) return;
            
            const prefs = docData.notificationSettings || {};
            fcmToken = docData.fcmToken;

            // 4. Check if Reminder is Enabled
            if (!prefs.reminderEnabled || !prefs.reminderMinutes || !fcmToken) return;

            // 5. Calculate Time Difference
            const start = new Date(appt.start).getTime();
            const diffMinutes = (start - now.getTime()) / 60000;
            const targetMinutes = prefs.reminderMinutes;

            // 6. Logic: Send if we are within the "Target Window"
            // Example: Target is 30 mins. 
            // If current diff is between 25 and 35, send it.
            if (diffMinutes <= targetMinutes && diffMinutes > (targetMinutes - 5)) {
                
                // Send Notification
                const message = {
                    token: fcmToken,
                    notification: {
                        title: '⏰ Appointment Reminder',
                        body: `In ${Math.round(diffMinutes)} mins: ${appt.patientName}`
                    },
                    android: { priority: 'high', notification: { sound: 'default' } }
                };
                
                await admin.messaging().send(message);

                // MARK AS SENT so we don't annoy them again 5 mins later
                await db.collection('appointments').doc(apptDoc.id).update({
                    reminderSent: true
                });
                
                console.log(`Reminder sent to doctor ${doctorId} for appt ${apptDoc.id}`);
            }
        });

        await Promise.all(promises);

    } catch (error) {
        console.error("Error in reminder cron:", error);
    }
});