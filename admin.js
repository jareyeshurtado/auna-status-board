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

// STEP 3: Get references to the new services (Auth and Firestore)
const auth = firebase.auth();
const db = firebase.firestore();

// STEP 4: Get references to ALL our HTML elements

// --- Login elements ---
const loginContainer = document.getElementById('login-container');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');

// --- Admin content elements ---
const adminContent = document.getElementById('admin-content');
const signOutButton = document.getElementById('sign-out-button');
const statusButtonsContainer = document.getElementById('status-buttons');
const currentApptInput = document.getElementById('current-appt');
const nextApptInput = document.getElementById('next-appt');
const updateButton = document.getElementById('update-button');
const updateMessage = document.getElementById('update-message');

// --- NEW PASSWORD ELEMENTS ---
const changePasswordButton = document.getElementById('change-password-button');
const passwordMessage = document.getElementById('password-message');

// STEP 5: Create global variables to store state
let selectedStatus = '';
let currentUser = null;
let currentDoctorDocId = null; // This will store the doctor's *document ID* (e.g., "dr_smith")

// =================================================================
// --- MASTER AUTH FUNCTION (This is the "main" function) ---
// =================================================================
auth.onAuthStateChanged(user => {
    if (user) {
        // --- USER IS LOGGED IN ---
        currentUser = user; // Save the user's data
        
        // Show the admin controls, hide the login form
        adminContent.style.display = 'block';
        loginContainer.style.display = 'none';

        // Find the doctor document that belongs to this user
        loadDoctorProfile(user.uid);
        
    } else {
        // --- USER IS LOGGED OUT ---
        currentUser = null;
        currentDoctorDocId = null;

        // Show the login form, hide the admin controls
        adminContent.style.display = 'none';
        loginContainer.style.display = 'block';

        // Clear the form
        currentApptInput.value = '';
        nextApptInput.value = '';
        selectedStatus = '';
    }
});

// =================================================================
// --- AUTH FUNCTIONS (Login / Logout / Reset) ---
// =================================================================

// --- Handles the Login button click ---
function onLoginClick() {
    const email = loginEmail.value;
    const password = loginPassword.value;

    if (!email || !password) {
        loginMessage.textContent = 'Please enter both email and password.';
        return;
    }

    loginMessage.textContent = 'Logging in...';

    auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Success! The `onAuthStateChanged` function above
            // will automatically handle hiding the login form.
            loginMessage.textContent = '';
            loginEmail.value = '';
            loginPassword.value = '';
        })
        .catch(error => {
            // Handle errors
            console.error("Login Error:", error.message);
            loginMessage.textContent = 'Error: ' + error.message;
        });
}

// --- Handles the Sign Out button click ---
function onSignOutClick() {
    auth.signOut().catch(error => {
        console.error("Sign Out Error:", error);
    });
}

// --- Handles the "Change Password" button click ---
function onChangePasswordClick() {
    if (!currentUser) {
        showMessage('You must be logged in to change your password.', 'error');
        return;
    }

    const email = currentUser.email;
    passwordMessage.textContent = 'Sending reset email...';

    auth.sendPasswordResetEmail(email)
        .then(() => {
            passwordMessage.textContent = 'Success! Check your email inbox for a reset link.';
            passwordMessage.style.color = '#006421'; // Success green
            
            // Clear the message after 7 seconds
            setTimeout(() => {
                passwordMessage.textContent = '';
            }, 7000);
        })
        .catch(error => {
            console.error("Password Reset Error:", error);
            passwordMessage.textContent = 'Error: ' + error.message;
            passwordMessage.style.color = '#c91c1c'; // Error red
        });
}

// =================================================================
// --- DATA AND FORM FUNCTIONS ---
// =================================================================

// --- Finds and loads the doctor's data after they log in ---
function loadDoctorProfile(uid) {
    db.collection('doctors').where('authUID', '==', uid).get()
        .then(snapshot => {
            if (snapshot.empty) {
                console.error("No doctor document found for this user UID:", uid);
                alert("Critical Error: Your user account is not linked to a doctor profile. Please contact the administrator.");
                auth.signOut();
                return;
            }
            
            snapshot.forEach(doc => {
                const doctor = doc.data();
                currentDoctorDocId = doc.id; 
                
                currentApptInput.value = doctor.currentAppointment || '';
                nextApptInput.value = doctor.nextAppointment || '';
                selectedStatus = doctor.status || '';
                
                updateStatusButtonUI();
            });
        })
        .catch(error => {
            console.error("Error fetching doctor profile: ", error);
        });
}

// --- Handles clicks on the status buttons (same as before) ---
function onStatusButtonClick(event) {
    const clickedButton = event.target.closest('button');
    if (!clickedButton) return;

    selectedStatus = clickedButton.dataset.status;
    updateStatusButtonUI();
}

// --- Helper function to update button styles ---
function updateStatusButtonUI() {
    document.querySelectorAll('#status-buttons button').forEach(btn => {
        if (btn.dataset.status === selectedStatus) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

// --- Handles the "Update Status" button click (MODIFIED) ---
function onUpdateButtonClick() {
    if (!currentDoctorDocId) {
        showMessage('Error: No doctor profile loaded. Please refresh.', 'error');
        return;
    }
    if (!selectedStatus) {
        showMessage('Please select a status.', 'error');
        return;
    }
    
    const newCurrentAppt = currentApptInput.value;
    const newNextAppt = nextApptInput.value;
    
    const updateData = {
        status: selectedStatus,
        currentAppointment: newCurrentAppt,
        nextAppointment: newNextAppt
    };
    
    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    
    db.collection('doctors').doc(currentDoctorDocId).update(updateData)
        .then(() => {
            showMessage('Status updated successfully!', 'success');
        })
        .catch(error => {
            console.error("Error updating document: ", error);
            showMessage('Error updating status. See console for details.', 'error');
        })
        .finally(() => {
            updateButton.disabled = false;
            updateButton.textContent = 'Update Status';
        });
}

// --- Helper function to show success/error messages (same as before) ---
function showMessage(message, type) {
    updateMessage.textContent = message;
    updateMessage.style.color = (type === 'error') ? '#c91c1c' : '#006421';
    
    setTimeout(() => {
        updateMessage.textContent = '';
    }, 3000);
}

// =================================================================
// --- STEP 6: Add Event Listeners ---
// =================================================================
loginButton.addEventListener('click', onLoginClick);
signOutButton.addEventListener('click', onSignOutClick);
statusButtonsContainer.addEventListener('click', onStatusButtonClick);
updateButton.addEventListener('click', onUpdateButtonClick);
changePasswordButton.addEventListener('click', onChangePasswordClick);