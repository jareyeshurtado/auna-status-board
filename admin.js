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

// STEP 3: Get references to the services
const auth = firebase.auth();
const db = firebase.firestore();

const MEXICO_TIMEZONE = "America/Mexico_City";

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
const updateButton = document.getElementById('update-button');
const updateMessage = document.getElementById('update-message');
const changePasswordButton = document.getElementById('change-password-button');
const passwordMessage = document.getElementById('password-message');

// --- Status Panel elements ---
const statusButtonsContainer = document.getElementById('status-buttons');

// --- NEW (Phase 3): Tab elements ---
const tabStatus = document.getElementById('tab-status');
const tabCalendar = document.getElementById('tab-calendar');
const panelStatus = document.getElementById('panel-status');
const panelCalendar = document.getElementById('panel-calendar');

// --- NEW (Phase 3): Calendar element ---
const calendarEl = document.getElementById('calendar-container');

// STEP 5: Create global variables to store state
let selectedStatus = '';
let currentUser = null;
let currentDoctorDocId = null;
let calendar = null; // This will hold the FullCalendar object
let appointmentsListener = null; // This will hold our Firebase listener

// =================================================================
// --- MASTER AUTH FUNCTION ---
// =================================================================
auth.onAuthStateChanged(user => {
    if (user) {
        // --- USER IS LOGGED IN ---
        currentUser = user;
        adminContent.style.display = 'block';
        loginContainer.style.display = 'none';

        // Load the two main data components
        loadDoctorProfile(user.uid);
        initializeCalendar(user.uid); // NEW
        
    } else {
        // --- USER IS LOGGED OUT ---
        currentUser = null;
        currentDoctorDocId = null;
        adminContent.style.display = 'none';
        loginContainer.style.display = 'block';

        // --- NEW (Phase 3): Cleanup ---
        // Detach the Firebase listener to prevent memory leaks
        if (appointmentsListener) {
            appointmentsListener(); // This stops the listener
            appointmentsListener = null;
        }
        // Destroy the calendar instance
        if (calendar) {
            calendar.destroy();
            calendar = null;
        }

        // Clear the status form
        selectedStatus = '';
    }
});

// =================================================================
// --- AUTH FUNCTIONS (Login / Logout / Reset) ---
// =================================================================
// (These functions are all unchanged)
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
            loginMessage.textContent = '';
            loginEmail.value = '';
            loginPassword.value = '';
        })
        .catch(error => {
            console.error("Login Error:", error.message);
            loginMessage.textContent = 'Error: ' + error.message;
        });
}

function onSignOutClick() {
    auth.signOut().catch(error => console.error("Sign Out Error:", error));
}

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
            passwordMessage.style.color = '#006421';
            setTimeout(() => { passwordMessage.textContent = ''; }, 7000);
        })
        .catch(error => {
            console.error("Password Reset Error:", error);
            passwordMessage.textContent = 'Error: ' + error.message;
            passwordMessage.style.color = '#c91c1c';
        });
}

// =================================================================
// --- NEW (Phase 3): TAB SWITCHING FUNCTION ---
// =================================================================
function handleTabClick(event) {
    const clickedTab = event.target;

    // Remove 'active' from all tabs and panels
    tabStatus.classList.remove('active');
    tabCalendar.classList.remove('active');
    panelStatus.classList.remove('active');
    panelCalendar.classList.remove('active');

    // Add 'active' to the clicked tab and its corresponding panel
    if (clickedTab.id === 'tab-status') {
        tabStatus.classList.add('active');
        panelStatus.classList.add('active');
    } else if (clickedTab.id === 'tab-calendar') {
        tabCalendar.classList.add('active');
        panelCalendar.classList.add('active');
        // Tell the calendar to re-render, as it was hidden
        if (calendar) {
            calendar.render();
        }
    }
}

// =================================================================
// --- NEW (Phase 3 & 4): CALENDAR FUNCTIONS ---
// =================================================================

function initializeCalendar(uid) {
    // Only initialize the calendar *once*
    if (calendar) {
        return;
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek', // A week view is best for bookings
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        editable: false, // We'll use clicks, not drag-and-drop
        selectable: true, // Allows clicking on time slots
        
        // --- NEW dateClick using SweetAlert2 ---
        dateClick: function(clickInfo) {
          // Get the start time from the click
          const startDate = clickInfo.date;
          // Format start time for display in the modal title
          const startTimeFormatted = startDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: MEXICO_TIMEZONE,
            });

          Swal.fire({
            title: `Book Appointment at ${startTimeFormatted}`,
            html: `
              <div>
                <span class="swal2-label" for="swal-input-name">Patient Name:</span>
                <input id="swal-input-name" class="swal2-input" placeholder="Enter patient name">

                <span class="swal2-label" for="swal-input-phone">Phone Number (10 digits):</span>
                <input id="swal-input-phone" class="swal2-input" placeholder="Enter 10-digit phone number" type="tel">

                <span class="swal2-label">Appointment Duration:</span>
                <div id="swal-duration-buttons">
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="30">30 min</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="45">45 min</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="60">1 hour</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="90">1:30</button>
                </div>
              </div>
            `,
            confirmButtonText: 'Book Appointment',
            focusConfirm: false, // Prevents closing on Enter key initially
            didOpen: () => {
              // Add interactivity to duration buttons
              const buttons = document.querySelectorAll('#swal-duration-buttons .duration-button');
              buttons.forEach(button => {
                button.addEventListener('click', () => {
                  // Deselect others, select this one visually (optional styling)
                  buttons.forEach(btn => btn.style.border = 'none'); // Example reset
                  button.style.border = '2px solid blue'; // Example selection
                  // Store selected duration on a common element (e.g., the container)
                  document.getElementById('swal-duration-buttons').dataset.selectedDuration = button.dataset.duration;
                });
              });
              // Set 30min as default selection
               const defaultButton = document.querySelector('#swal-duration-buttons .duration-button[data-duration="30"]');
               if(defaultButton) {
                   defaultButton.click(); // Simulate click to select and store value
               }
            },
            preConfirm: () => {
              // --- Validation before closing ---
              const name = document.getElementById('swal-input-name').value;
              const phone = document.getElementById('swal-input-phone').value;
              const selectedDurationMinutes = document.getElementById('swal-duration-buttons').dataset.selectedDuration;
              const phoneRegex = /^\d{10}$/; // 10 digits exactly

              if (!name) {
                Swal.showValidationMessage(`Please enter the patient's name`);
                return false; // Prevent closing
              }
              if (!phone) {
                Swal.showValidationMessage(`Please enter the patient's phone number`);
                return false;
              }
              if (!phoneRegex.test(phone)) {
                 Swal.showValidationMessage(`Phone number must be exactly 10 digits`);
                 return false;
              }
              if (!selectedDurationMinutes) {
                 Swal.showValidationMessage(`Please select an appointment duration`);
                 return false;
              }

              // Return the collected data if validation passes
              return {
                name: name,
                phone: phone,
                duration: parseInt(selectedDurationMinutes, 10) // Convert to number
              };
            }
          }).then((result) => {
            // --- Handle Submission ---
            if (result.isConfirmed && result.value) {
              const formData = result.value;

              // Calculate end time based on selected duration
              const endDate = new Date(startDate.getTime() + formData.duration * 60000); // duration in minutes

              // Create the new appointment object
              const newAppointment = {
                  doctorId: uid, // Use the uid passed to initializeCalendar
                  patientName: formData.name,
                  patientPhone: formData.phone,
                  start: startDate.toISOString(), // Use ISO string for consistency
                  end: endDate.toISOString()
              };

              // Add it to Firebase
              db.collection('appointments').add(newAppointment)
                  .then(() => {
                      console.log("Appointment added!");
                      Swal.fire('Success!', 'Appointment booked successfully.', 'success');
                  })
                  .catch(error => {
                      console.error("Error adding appointment: ", error);
                      Swal.fire('Error!', 'Could not create appointment. Please try again.', 'error');
                  });
            } else {
              console.log("Appointment booking cancelled.");
            }
          }); // End Swal.fire().then()
        }, // End dateClick function

        // --- (Phase 4.4) Handle clicking on an *existing* event ---
        eventClick: function(clickInfo) {
            if (confirm(`Delete appointment for '${clickInfo.event.title}'?`)) {
                
                const eventId = clickInfo.event.id; // Get the document ID

                // Delete it from Firebase
                db.collection('appointments').doc(eventId).delete()
                    .then(() => {
                        console.log("Appointment deleted!");
                    })
                    .catch(error => {
                        console.error("Error deleting appointment: ", error);
                        alert("Error: Could not delete appointment.");
                    });
            }
        }
    });

    calendar.render();

    // --- (Phase 3.3) Start the real-time listener ---
    // Detach any *old* listener first
    if (appointmentsListener) {
        appointmentsListener();
    }
    
    // Listen for appointments that match this doctor's UID
    appointmentsListener = db.collection('appointments')
        .where('doctorId', '==', uid)
        .onSnapshot(snapshot => {
            
            // Format the Firebase docs into FullCalendar event objects
            const events = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id, // This is crucial for deleting!
                    title: data.patientName,
                    start: data.start,
                    end: data.end
                };
            });

            // --- (Phase 3.4) Update the calendar's events ---
            if (calendar) {
                calendar.setOption('events', events);
            }
        }, error => {
            console.error("Error fetching appointments: ", error);
        });
}


// =================================================================
// --- STATUS PANEL FUNCTIONS (Mostly unchanged) ---
// =================================================================

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
                selectedStatus = doctor.status || '';
                updateStatusButtonUI();
            });
        })
        .catch(error => console.error("Error fetching doctor profile: ", error));
}

function onStatusButtonClick(event) {
    const clickedButton = event.target.closest('button');
    if (!clickedButton) return;
    selectedStatus = clickedButton.dataset.status;
    updateStatusButtonUI();
}

function updateStatusButtonUI() {
    document.querySelectorAll('#status-buttons button').forEach(btn => {
        if (btn.dataset.status === selectedStatus) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function onUpdateButtonClick() {
    if (!currentDoctorDocId) {
        showMessage('Error: No doctor profile loaded. Please refresh.', 'error');
        return;
    }
    if (!selectedStatus) {
        showMessage('Please select a status.', 'error');
        return;
    }
    
    const updateData = {
        status: selectedStatus
    };
    
    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    
    db.collection('doctors').doc(currentDoctorDocId).update(updateData)
        .then(() => showMessage('Status updated successfully!', 'success'))
        .catch(error => {
            console.error("Error updating document: ", error);
            showMessage('Error updating status. See console for details.', 'error');
        })
        .finally(() => {
            updateButton.disabled = false;
            updateButton.textContent = 'Update Status';
        });
}

function showMessage(message, type) {
    updateMessage.textContent = message;
    updateMessage.style.color = (type === 'error') ? '#c91c1c' : '#006421';
    setTimeout(() => { updateMessage.textContent = ''; }, 3000);
}


// =================================================================
// --- STEP 6: Add Event Listeners ---
// =================================================================
loginButton.addEventListener('click', onLoginClick);
signOutButton.addEventListener('click', onSignOutClick);
statusButtonsContainer.addEventListener('click', onStatusButtonClick);
updateButton.addEventListener('click', onUpdateButtonClick);
changePasswordButton.addEventListener('click', onChangePasswordClick);

// --- NEW (Phase 3): Tab listeners ---
tabStatus.addEventListener('click', handleTabClick);
tabCalendar.addEventListener('click', handleTabClick);