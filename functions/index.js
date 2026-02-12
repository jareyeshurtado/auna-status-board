const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");


admin.initializeApp();
const db = admin.firestore();

// Set global options
setGlobalOptions({ region: "us-central1" });

/**
 * Generates an iCalendar (.ics) feed for a specific doctor.
 * URL: https://us-central1-auna-board.cloudfunctions.net/calendarFeed?uid=DOCTOR_ID
 */
exports.calendarFeed = onRequest(async (req, res) => {
    const doctorUid = req.query.uid;

    if (!doctorUid) {
        res.status(400).send("Missing 'uid' parameter.");
        return;
    }

    try {
        // 1. Fetch future appointments (and recent past ones, e.g., last 7 days)
        const now = new Date();
        const pastDate = new Date();
        pastDate.setDate(now.getDate() - 7); // Include last week for reference

        const snapshot = await db.collection("appointments")
            .where("doctorId", "==", doctorUid)
            .where("start", ">=", pastDate.toISOString())
            .get();

        // 2. Start building the ICS file content
        let icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//AUNA//Doctor Board//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:AUNA Citas",  // Name of the calendar
            "X-WR-TIMEZONE:America/Mexico_City"
        ];

        // 3. Loop through appointments and create Events
        snapshot.forEach(doc => {
            const data = doc.data();
            const created = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
            
            // Format dates for iCal (YYYYMMDDTHHmmSSZ)
            // Firebase stores ISO strings, so we parse and reformat to UTC
            const start = new Date(data.start).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
            const end = new Date(data.end).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

            let description = `Paciente: ${data.patientName}\\nTel: ${data.patientPhone || 'N/A'}`;
            let summary = `Cita: ${data.patientName}`;

            // Handle Cancelled/Completed logic visually in the calendar
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

        // 4. Close Calendar
        icsContent.push("END:VCALENDAR");

        // 5. Send Response
        res.set("Content-Type", "text/calendar; charset=utf-8");
        res.set("Content-Disposition", "attachment; filename=\"citas-auna.ics\"");
        res.send(icsContent.join("\r\n"));

    } catch (error) {
        console.error("Error generating calendar:", error);
        res.status(500).send("Internal Server Error");
    }
});

exports.sendAppointmentNotification = onDocumentCreated("appointments/{apptId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const doctorId = data.doctorId;
    
    if (!doctorId) return;

    try {
        // 1. Get the Doctor's FCM Token from their profile
        const doctorDoc = await db.collection('doctors').doc(doctorId).get();
        
        if (!doctorDoc.exists) {
            console.log(`No doctor found for ID: ${doctorId}`);
            return;
        }

        const doctorData = doctorDoc.data();
        const fcmToken = doctorData.fcmToken;

        if (!fcmToken) {
            console.log(`Doctor ${doctorId} has no notification token registered.`);
            return;
        }

        // 2. Create the Message
        const message = {
            token: fcmToken,
            notification: {
                title: 'New Appointment!',
                body: `${data.patientName} - ${new Date(data.start).toLocaleTimeString('en-US', {timeZone: 'America/Mexico_City', hour: '2-digit', minute:'2-digit'})}`
            },
            // Optional: Data payload for clicking the notification
            data: {
                appointmentId: event.params.apptId
            }
        };

        // 3. Send it!
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);

    } catch (error) {
        console.error('Error sending notification:', error);
    }
});