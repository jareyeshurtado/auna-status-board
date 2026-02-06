// This is the complete file for functions/index.js with periodic updates

// --- We no longer need these, so we comment them out ---
// const { onDocumentWritten } = require("firebase-functions/v2/firestore");
// const { onSchedule } = require("firebase-functions/v2/scheduler");

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
 * (This function is no longer called by Cloud Functions,
 * but we'll leave it here in case you ever need it again.)
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

/**
 * Calculates and updates the current appointment status for a specific doctor.
 * (This function is no longer called by Cloud Functions,
 * but we'll leave it here in case you ever need it again.)
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
  const doctorData = doctorQuery.docs[0].data(); // Get the doctor's data

  const currentStatus = doctorData.status;
  
  if (
    currentStatus === "In Consultation" ||  // English
    currentStatus === "En Consulta" ||        // Spanish
    currentStatus === "Consultation Delayed" || // English
    currentStatus === "Consulta Retrasada"    // Spanish
  ) {
    console.log(`Doctor ${doctorAuthUid} is busy with status: "${currentStatus}". Skipping automatic appointment update.`);
    return; 
  }

  // 2. Get the start/end of TODAY in the correct timezone.
  const now = new Date();
  const todayStartApprox = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); // Server's local time start
  const todayEndApprox = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0); // Server's local time end


  // 3. Query all of this doctor's appointments for TODAY
  const apptSnapshot = await db.collection("appointments")
      .where("doctorId", "==", doctorAuthUid)
      .where("start", ">=", todayStartApprox.toISOString()) 
      .where("start", "<", todayEndApprox.toISOString())
      .orderBy("start", "asc")
      .get();

  let currentText = "---";
  const nowTimestamp = Date.now(); 

  if (!apptSnapshot.empty) {
    const appointments = apptSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            startTimeMs: new Date(data.start).getTime(),
            endTimeMs: new Date(data.end).getTime()
        };
    }).filter(appt => !isNaN(appt.startTimeMs) && !isNaN(appt.endTimeMs)); 


    // Find current appointment
    const currentAppt = appointments.find(appt =>
      nowTimestamp >= appt.startTimeMs && nowTimestamp < appt.endTimeMs
    );

    


    // Determine text based on findings
     if (currentAppt) {
        currentText = formatApptText(currentAppt);
    } 
  }

  // 4. Update the doctor's document
  console.log(`Updating doctor ${doctorAuthUid}: Current: ${currentText}`);
  return doctorRef.update({
    autoCurrentAppointment: currentText,
  });
}
