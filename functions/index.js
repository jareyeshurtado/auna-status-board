// This is the complete file for functions/index.js with periodic updates

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
// --- NEW: Import scheduler ---
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Set global options
setGlobalOptions({ region: "us-central1" }); // Or your preferred region
const MEXICO_TIMEZONE = "America/Mexico_City";

/**
 * Helper function to format an appointment object into a nice string.
 * e.g., "John Doe (10:30 AM)"
 */
function formatApptText(appointment) {
  if (!appointment || !appointment.start || !appointment.patientName) {
    return "---"; // Handle cases where data might be missing
  }
  const apptTime = new Date(appointment.start).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: MEXICO_TIMEZONE,
  });
  return `${appointment.patientName} (${apptTime})`;
}

// --- NEW REUSABLE FUNCTION ---
/**
 * Calculates and updates the current/next appointment status for a specific doctor.
 * @param {string} doctorAuthUid The authUID of the doctor to update.
 * @return {Promise<void>} A promise that resolves when the update is complete.
 */
async function calculateAndUpdateDoctorStatus(doctorAuthUid) {
  if (!doctorAuthUid) {
    console.error("calculateAndUpdateDoctorStatus called without doctorAuthUid");
    return;
  }
  console.log(`Calculating status for doctor: ${doctorAuthUid}`);

  // 1. Find the doctor's document ref using their authUID
  const doctorQuery = await db.collection("doctors")
                            .where("authUID", "==", doctorAuthUid)
                            .limit(1)
                            .get();

  if (doctorQuery.empty) {
    console.error(`Could not find doctor document for authUID: ${doctorAuthUid}`);
    return;
  }
  const doctorRef = doctorQuery.docs[0].ref;

  // 2. Get the start/end of TODAY in the correct timezone.
  // Using Date objects with UTC offsets can be tricky. A library like Luxon
  // is more robust, but this approximation often works for start/end of day.
  // Be mindful of server timezone vs target timezone. We assume server runs UTC
  // or a timezone where this calculation relative to MEXICO_TIMEZONE is correct.
  const now = new Date();
  // Construct Date objects representing midnight start/end *in Mexico City*
  // This is complex due to JS Date object limitations. Let's try string parsing.
  const todayDateStr = now.toLocaleDateString("en-CA", { timeZone: MEXICO_TIMEZONE }); // YYYY-MM-DD
  const todayStartISO = `${todayDateStr}T00:00:00.000Z`; // Assumes start is UTC midnight before TZ conversion
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowDateStr = tomorrowDate.toLocaleDateString("en-CA", { timeZone: MEXICO_TIMEZONE });
  const todayEndISO = `${tomorrowDateStr}T00:00:00.000Z`; // Assumes end is UTC midnight before TZ conversion


  // A simpler (potentially less DST-accurate) way:
  const todayStartApprox = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); // Server's local time start
  const todayEndApprox = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0); // Server's local time end


  // 3. Query all of this doctor's appointments for TODAY
  // IMPORTANT: Ensure your 'start' field is stored consistently (e.g., ISO string UTC)
  const apptSnapshot = await db.collection("appointments")
      .where("doctorId", "==", doctorAuthUid)
      // Query based on the stored ISO string format
      .where("start", ">=", todayStartApprox.toISOString()) // Use approximation for simplicity
      .where("start", "<", todayEndApprox.toISOString())
      .orderBy("start", "asc")
      .get();

  let currentText = "---";
  let nextText = "---";
  const nowTimestamp = Date.now(); // Current UTC timestamp in milliseconds

  if (!apptSnapshot.empty) {
    // Map data and ensure 'start'/'end' are valid Date objects for comparison
    const appointments = apptSnapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure start/end are valid dates before proceeding
        return {
            ...data,
            startTimeMs: new Date(data.start).getTime(),
            endTimeMs: new Date(data.end).getTime()
        };
    }).filter(appt => !isNaN(appt.startTimeMs) && !isNaN(appt.endTimeMs)); // Filter out invalid dates


    // Find current appointment
    const currentAppt = appointments.find(appt =>
      nowTimestamp >= appt.startTimeMs && nowTimestamp < appt.endTimeMs
    );

    // Find next appointment
    const nextAppt = appointments.find(appt =>
      appt.startTimeMs > nowTimestamp
    );


    // Determine text based on findings
     if (currentAppt) {
        currentText = formatApptText(currentAppt);
        // Find the *next* appointment *after* the current one ends
        const nextAfterCurrent = appointments.find(appt => appt.startTimeMs >= currentAppt.endTimeMs);
        if (nextAfterCurrent) {
            nextText = formatApptText(nextAfterCurrent);
        }
    } else if (nextAppt) {
        // No current appointment, but there is a next one today
        nextText = formatApptText(nextAppt);
    }
  }

  // 4. Update the doctor's document
  console.log(`Updating doctor ${doctorAuthUid}: Current: ${currentText}, Next: ${nextText}`);
  return doctorRef.update({
    autoCurrentAppointment: currentText,
    autoNextAppointment: nextText,
  });
}


// --- MODIFIED EXISTING FUNCTION ---
/**
 * Triggers when an appointment is written. Calls the calculation function
 * for the specific doctor affected.
 */
exports.updateDoctorScheduleOnWrite = onDocumentWritten("appointments/{appointmentId}", (event) => {
  const apptData = event.data.after.data() || event.data.before.data();
  const doctorId = apptData.doctorId;

  // Call the reusable function only for the affected doctor
  return calculateAndUpdateDoctorStatus(doctorId);
});


// --- NEW SCHEDULED FUNCTION ---
/**
 * Runs every 5 minutes to update the status for ALL doctors.
 * Schedule syntax: https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules
 */
exports.updateAllDoctorSchedulesPeriodically = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: MEXICO_TIMEZONE, // Run based on Mexico City time
  },
  async (event) => {
    console.log("Running periodic update for all doctors...");

    // 1. Get all documents from the 'doctors' collection
    const doctorsSnapshot = await db.collection("doctors").get();

    if (doctorsSnapshot.empty) {
      console.log("No doctors found to update.");
      return null;
    }

    // 2. Create a list of promises, one for each doctor update
    const updatePromises = [];
    doctorsSnapshot.forEach(doctorDoc => {
      const doctorData = doctorDoc.data();
      if (doctorData.authUID) {
        // Call the reusable calculation function for each doctor
        updatePromises.push(calculateAndUpdateDoctorStatus(doctorData.authUID));
      } else {
         console.warn(`Doctor document ${doctorDoc.id} is missing authUID.`);
      }
    });

    // 3. Wait for all updates to complete
    await Promise.all(updatePromises);
    console.log(`Periodic update completed for ${updatePromises.length} doctors.`);
    return null;
  }
);