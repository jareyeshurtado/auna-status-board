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

        // --- HTML Card Template (MODIFIED) ---
        // We are now pointing to the new "auto" fields that
        // our Firebase Function will create for us.
        const cardHtml = `
            <div class="doctor-card status-${statusClass}" data-id="${doctorId}">
                <h2>${doctor.displayName || 'Unnamed Doctor'}</h2>
                <p class="specialty">${doctor.specialty || 'No Specialty'}</p>
                
                <p class="status ${statusClass}">
                    ${doctor.status || 'No Status'}
                </p>
                
                <div class="appointment-info">
                    <strong>Current:</strong> ${doctor.autoCurrentAppointment || '---'}
                </div>
                <div class="appointment-info">
                    <strong>Next:</strong> ${doctor.autoNextAppointment || '---'}
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