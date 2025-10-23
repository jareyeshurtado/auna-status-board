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
// This is the "magic" function. It runs once on page load
// and then *again every time* the data in the 'doctors'
// collection changes.
db.collection('doctors').onSnapshot(snapshot => {
    
    console.log("Received new data snapshot!");

    // Check if the collection is empty
    if (snapshot.empty) {
        boardContainer.innerHTML = `<p class="loading-message">No doctors found in the database.</p>`;
        return;
    }

    // Create an array to hold all our HTML card strings
    const cardArray = [];

    // Loop through each doctor document in the snapshot
    snapshot.forEach(doc => {
        const doctor = doc.data(); // The document data (name, status, etc.)
        const doctorId = doc.id;   // The document's unique ID

        // --- Status Class Logic ---
        // This logic checks the status text and assigns a CSS class
        // to get the correct color (green, yellow, or red).
        let statusClass = 'on-time'; // default
        if (doctor.status) { // Check if status field exists
            const lowerCaseStatus = doctor.status.toLowerCase();
            
            if (lowerCaseStatus.includes('delay') || lowerCaseStatus.includes('late')) {
                statusClass = 'delayed';
            } else if (lowerCaseStatus.includes('away') || lowerCaseStatus.includes('unavailable')) {
                statusClass = 'away';
            }
        }
        // --- End Status Class Logic ---

        // Use a template literal to build the HTML for one doctor card.
        // We add the `statusClass` to both the card and the status pill
        // to apply our CSS styling from style.css.
        const cardHtml = `
            <div class="doctor-card status-${statusClass}" data-id="${doctorId}">
                <h2>${doctor.displayName || 'Unnamed Doctor'}</h2>
                <p class="specialty">${doctor.specialty || 'No Specialty'}</p>
                
                <p class="status ${statusClass}">
                    ${doctor.status || 'No Status'}
                </p>
                
                <div class="appointment-info">
                    <strong>Current:</strong> ${doctor.currentAppointment || '---'}
                </div>
                <div class="appointment-info">
                    <strong>Next:</strong> ${doctor.nextAppointment || '---'}
                </div>
            </div>
        `;
        
        // Add this doctor's card HTML to our array
        cardArray.push(cardHtml);
    });

    // Join all the HTML strings in the array together and set
    // them as the content of our main container. This is done
    // *once* for efficiency, rather than updating the DOM
    // inside the loop.
    boardContainer.innerHTML = cardArray.join('');

}, error => {
    // Handle any errors (like permissions, network down)
    console.error("Error fetching data: ", error);
    boardContainer.innerHTML = `<p class="loading-message">Error loading data. Please check the browser console.</p>`;
});