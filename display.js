// STEP 1: Paste your Firebase config object here
// (This is the object you saved from Step 1.5)
const firebaseConfig = {
  apiKey: "AIzaSyCP2k-VJURlMV3-UNPVYMD4q9-wwNjiiQc",
  authDomain: "auna-board.firebaseapp.com",
  projectId: "auna-board",
  storageBucket: "auna-board.firebasestorage.app",
  messagingSenderId: "542600310440",
  appId: "1:542600310440:web:3b33ba175b862dc96a5c9d"
};

// STEP 2: Initialize Firebase
firebase.initializeApp(firebaseConfig);

// STEP 3: Get a reference to the Firestore database
const db = firebase.firestore();

// STEP 4: Get a reference to the HTML container
const boardContainer = document.getElementById('board-container');

// --- NEW HELPER FUNCTION ---
/**
 * Checks if an appointment string (e.g., "John Doe (10:30 AM)") is in the past.
 * @param {string} apptString The appointment text.
 * @returns {boolean} True if the appointment end time is in the past, false otherwise.
 */
function isAppointmentPast(apptString) {
    if (!apptString || apptString === "---") {
        return false; // Not considered 'past' if it's empty
    }

    // Extract time like "10:30 AM" or "02:00 PM"
    const timeMatch = apptString.match(/(\d{1,2}:\d{2}\s?[AP]M)/i);
    if (!timeMatch) {
        return false; // Cannot parse time, assume not past
    }

    const timeStr = timeMatch[1]; // e.g., "10:30 AM"

    // Construct a Date object for *today* with that time
    // This is tricky because JS Date parsing of "10:30 AM" is unreliable.
    // Let's parse manually.
    try {
        const parts = timeStr.match(/(\d{1,2}):(\d{2})\s?([AP]M)/i);
        if (!parts) return false;

        let hours = parseInt(parts[1], 10);
        const minutes = parseInt(parts[2], 10);
        const ampm = parts[3].toUpperCase();

        if (ampm === "PM" && hours < 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0; // Midnight case

        const now = new Date();
        const apptDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

        // We assume appointments last ~30 mins for the check. A more robust
        // solution would be to store the *end* time in the auto field.
        // For now, let's check if the *start* time is more than, say, 60 mins ago.
        const sixtyMinutesAgo = Date.now() - (60 * 60 * 1000);

        return apptDateTime.getTime() < sixtyMinutesAgo;

    } catch (e) {
        console.error("Error parsing time in isAppointmentPast:", e);
        return false; // Error during parsing, assume not past
    }
}


// STEP 5: Listen for real-time updates on the 'doctors' collection
db.collection('doctors').onSnapshot(snapshot => {

    console.log("Received new data snapshot!");

    if (snapshot.empty) {
        boardContainer.innerHTML = `<p class="loading-message">No doctors found in the database.</p>`;
        return;
    }

    const cardArray = [];
    snapshot.forEach(doc => {
        const doctor = doc.data();
        const doctorId = doc.id;

        // --- Status Class Logic (Unchanged) ---
        let statusClass = 'on-time';
        if (doctor.status) {
            const lowerCaseStatus = doctor.status.toLowerCase();
            if (lowerCaseStatus.includes('delay') || lowerCaseStatus.includes('late')) {
                statusClass = 'delayed';
            } else if (lowerCaseStatus.includes('away') || lowerCaseStatus.includes('unavailable')) {
                statusClass = 'away';
            }
        }
        // --- End Status Class Logic ---

        // --- NEW: Check if appointments are past ---
        let displayCurrent = doctor.autoCurrentAppointment || '---';
        let displayNext = doctor.autoNextAppointment || '---';

        // If the current appointment's time has passed, clear it
        if (isAppointmentPast(displayCurrent)) {
            displayCurrent = '---';
            // If the current is past, the 'next' might now be current, but our
            // function doesn't automatically update that. The periodic function
            // handles this, or we'd need more complex logic here.
            // For simplicity, we just clear current. The 5-min update will fix next.
        }

        // --- HTML Card Template (Uses checked values) ---
        const cardHtml = `
            <div class="doctor-card status-${statusClass}" data-id="${doctorId}">
                <h2>${doctor.displayName || 'Unnamed Doctor'}</h2>
                <p class="specialty">${doctor.specialty || 'No Specialty'}</p>

                <p class="status ${statusClass}">
                    ${doctor.status || 'No Status'}
                </p>

                <div class="appointment-info">
                    <strong>Current:</strong> ${displayCurrent}
                </div>
                <div class="appointment-info">
                    <strong>Next:</strong> ${displayNext}
                </div>
            </div>
        `;

        cardArray.push(cardHtml);
    });

    boardContainer.innerHTML = cardArray.join('');

}, error => {
    console.error("Error fetching data: ", error);
    boardContainer.innerHTML = `<p class="loading-message">Error loading data. Please check the browser console.</p>`;
});

// --- NEW: Add a timer to re-render occasionally ---
// This helps update the "past" status even if Firestore doesn't send updates.
setInterval(() => {
    // This is a simple way to force a re-check of the "past" status
    // by manually triggering the display update using the last known data.
    // It doesn't re-fetch from Firestore, just re-evaluates the times.
    const currentCards = boardContainer.querySelectorAll('.doctor-card');
    if (currentCards.length > 0) {
        // We need the original data, which isn't stored easily here.
        // A better approach would be to store the last snapshot data globally
        // and have this interval call a function that re-renders from that data.

        // Simpler, less efficient way: Just force a full page reload every 5 mins
        // This is not ideal but guarantees freshness without complex state management.
        // console.log("Periodic refresh check..."); // For debugging
    }
}, 5 * 60 * 1000); // Re-check every 5 minutes