// STEP 1: Paste your Firebase config object here
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

// STEP 4: Get references to all our HTML elements
const doctorSelect = document.getElementById('doctor-select');
const statusButtonsContainer = document.getElementById('status-buttons');
const currentApptInput = document.getElementById('current-appt');
const nextApptInput = document.getElementById('next-appt');
const updateButton = document.getElementById('update-button');
const updateMessage = document.getElementById('update-message');

// A variable to store all doctor data, so we can access it easily
let doctorsData = {};
// A variable to hold the status we've clicked on
let selectedStatus = '';

// --- FUNCTION 1: Fetch Doctors and Populate Dropdown ---
function populateDoctorDropdown() {
    db.collection('doctors').get().then(snapshot => {
        
        // Clear the "Loading..." message
        doctorSelect.innerHTML = '<option value="">-- Select a Doctor --</option>';
        
        snapshot.forEach(doc => {
            const doctor = doc.data();
            const doctorId = doc.id;
            
            // Store the doctor's data locally
            doctorsData[doctorId] = doctor;
            
            // Add the doctor to the dropdown
            const option = document.createElement('option');
            option.value = doctorId;
            option.textContent = doctor.displayName || 'Unnamed Doctor';
            doctorSelect.appendChild(option);
        });
    }).catch(error => {
        console.error("Error fetching doctors: ", error);
        doctorSelect.innerHTML = '<option value="">Error loading doctors</option>';
    });
}

// --- FUNCTION 2: Populate Form When a Doctor is Selected ---
function onDoctorSelectChange() {
    const selectedDoctorId = doctorSelect.value;
    
    // Clear the form if no doctor is selected
    if (!selectedDoctorId) {
        currentApptInput.value = '';
        nextApptInput.value = '';
        selectedStatus = '';
        // Clear 'selected' class from all buttons
        document.querySelectorAll('#status-buttons button').forEach(btn => {
            btn.classList.remove('selected');
        });
        return;
    }
    
    // Get the data we stored earlier
    const doctor = doctorsData[selectedDoctorId];
    
    // Fill in the form fields with this doctor's current data
    currentApptInput.value = doctor.currentAppointment || '';
    nextApptInput.value = doctor.nextAppointment || '';
    
    // Set the selected status
    selectedStatus = doctor.status || '';
    
    // Update the button styles
    document.querySelectorAll('#status-buttons button').forEach(btn => {
        if (btn.dataset.status === selectedStatus) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

// --- FUNCTION 3: Handle Clicks on Status Buttons ---
function onStatusButtonClick(event) {
    // We use event delegation: the listener is on the container
    const clickedButton = event.target.closest('button');
    
    if (!clickedButton) return; // Didn't click a button

    // Get the status from the button's 'data-status' attribute
    selectedStatus = clickedButton.dataset.status;
    
    // Remove 'selected' from all buttons
    document.querySelectorAll('#status-buttons button').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Add 'selected' to the one we just clicked
    clickedButton.classList.add('selected');
}

// --- FUNCTION 4: Handle the Main "Update" Button Click ---
function onUpdateButtonClick() {
    const selectedDoctorId = doctorSelect.value;
    
    // --- Data Validation ---
    if (!selectedDoctorId) {
        showMessage('Please select a doctor first.', 'error');
        return;
    }
    if (!selectedStatus) {
        showMessage('Please select a status.', 'error');
        return;
    }
    
    // --- Get all values from the form ---
    const newCurrentAppt = currentApptInput.value;
    const newNextAppt = nextApptInput.value;
    
    // Create the object of data to send to Firebase
    const updateData = {
        status: selectedStatus,
        currentAppointment: newCurrentAppt,
        nextAppointment: newNextAppt
    };
    
    // --- Send the update to Firestore ---
    updateButton.disabled = true; // Prevent double-clicks
    updateButton.textContent = 'Updating...';
    
    db.collection('doctors').doc(selectedDoctorId).update(updateData)
        .then(() => {
            showMessage('Status updated successfully!', 'success');
        })
        .catch(error => {
            console.error("Error updating document: ", error);
            showMessage('Error updating status. See console for details.', 'error');
        })
        .finally(() => {
            // Re-enable the button
            updateButton.disabled = false;
            updateButton.textContent = 'Update Status';
        });
}

// --- Helper function to show success/error messages ---
function showMessage(message, type) {
    updateMessage.textContent = message;
    updateMessage.style.color = (type === 'error') ? '#c91c1c' : '#006421';
    
    // Clear the message after 3 seconds
    setTimeout(() => {
        updateMessage.textContent = '';
    }, 3000);
}


// --- STEP 5: Add Event Listeners ---

// Run this function once the page is loaded
document.addEventListener('DOMContentLoaded', populateDoctorDropdown);

// Add listeners for our interactive elements
doctorSelect.addEventListener('change', onDoctorSelectChange);
statusButtonsContainer.addEventListener('click', onStatusButtonClick);
updateButton.addEventListener('click', onUpdateButtonClick);