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
const MEXICO_TIMEZONE = "America/Mexico_City"; // Define timezone constant

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
const changePasswordButton = document.getElementById('change-password-button');
const passwordMessage = document.getElementById('password-message');

// --- Status Panel elements ---
const activeAppointmentDisplay = document.getElementById('active-appointment-display');
const displayPatientName = document.getElementById('display-patient-name');
const displayPatientPhone = document.getElementById('display-patient-phone');
const displayApptTime = document.getElementById('display-appt-time');
const displayApptDuration = document.getElementById('display-appt-duration');
const noUpcomingMessage = document.getElementById('no-upcoming-message');
const goAheadButton = document.getElementById('go-ahead-button');
const finishedButton = document.getElementById('finished-button');

// --- Tab elements ---
const tabStatus = document.getElementById('tab-status');
const tabCalendar = document.getElementById('tab-calendar');
const panelStatus = document.getElementById('panel-status');
const panelCalendar = document.getElementById('panel-calendar');

// --- Calendar element ---
const calendarEl = document.getElementById('calendar-container');

// STEP 5: Create global variables to store state
let currentUser = null;
let currentDoctorDocId = null; // Stores the Firestore Doc ID for the doctor's profile
let calendar = null;
let appointmentsListener = null;
let activeAppointment = null; // Stores { id: '...', patientName: '...', ... }

// =================================================================
// --- MASTER AUTH FUNCTION ---
// =================================================================
auth.onAuthStateChanged(user => {
    if (user) {
        // --- USER IS LOGGED IN ---
        currentUser = user;
        adminContent.style.display = 'block';
        loginContainer.style.display = 'none';

        // Find the doctor's Firestore document ID once
        findDoctorDocumentId(user.uid).then(() => {
            // Only load dependent data *after* finding the doc ID
            if (currentDoctorDocId) {
                initializeCalendar(user.uid);
                loadAndDisplayActiveAppointment(); // Load appointment for status tab
            } else {
                 // Handle case where doctor doc wasn't found (error logged in findDoctorDocumentId)
                 alert("Critical Error: Could not link your login to a doctor profile. Please contact admin.");
                 auth.signOut();
            }
        });

    } else {
        // --- USER IS LOGGED OUT ---
        currentUser = null;
        currentDoctorDocId = null;
        activeAppointment = null;
        adminContent.style.display = 'none';
        loginContainer.style.display = 'block';

        // --- Cleanup ---
        if (appointmentsListener) {
            appointmentsListener();
            appointmentsListener = null;
        }
        if (calendar) {
            calendar.destroy();
            calendar = null;
        }
        // Clear status panel display
        if(displayPatientName) displayPatientName.textContent = '---';
        if(displayPatientPhone) displayPatientPhone.textContent = '---';
        if(displayApptTime) displayApptTime.textContent = '---';
        if(displayApptDuration) displayApptDuration.textContent = '---';
        if(activeAppointmentDisplay) activeAppointmentDisplay.style.display = 'none';
        if(noUpcomingMessage) noUpcomingMessage.style.display = 'block';
        if(goAheadButton) goAheadButton.disabled = true;
        if(finishedButton) finishedButton.disabled = true;
    }
});

// =================================================================
// --- AUTH FUNCTIONS (Login / Logout / Reset) ---
// =================================================================
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
        Swal.fire('Error!', 'You must be logged in to change your password.', 'error'); // Using Swal for consistency
        return;
    }
    const email = currentUser.email;
    passwordMessage.textContent = 'Sending reset email...'; // Use the dedicated message area
    passwordMessage.style.color = '#555'; // Neutral color

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
// --- Helper: Find Doctor's Firestore Document ID ---
// =================================================================
async function findDoctorDocumentId(uid) {
    if (!uid) return;
    try {
        const doctorQuery = await db.collection("doctors")
                                    .where("authUID", "==", uid)
                                    .limit(1)
                                    .get();
        if (!doctorQuery.empty) {
            currentDoctorDocId = doctorQuery.docs[0].id; // Store the Firestore document ID
            console.log("Found doctor document ID:", currentDoctorDocId);
        } else {
            console.error(`Could not find doctor document for authUID: ${uid}`);
            currentDoctorDocId = null;
        }
    } catch (error) {
        console.error("Error finding doctor document:", error);
        currentDoctorDocId = null;
    }
}


// =================================================================
// --- TAB SWITCHING FUNCTION ---
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
        loadAndDisplayActiveAppointment(); // <<< Load data when switching TO status tab
    } else if (clickedTab.id === 'tab-calendar') {
        tabCalendar.classList.add('active');
        panelCalendar.classList.add('active');
        if (calendar) {
            calendar.render(); // Re-render calendar if it was hidden
        }
    }
}

// =================================================================
// --- CALENDAR FUNCTIONS ---
// =================================================================
function initializeCalendar(uid) {
    if (calendar) return; // Initialize only once

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        editable: false,
        selectable: true,
        timeZone: MEXICO_TIMEZONE, // Set calendar timezone

        // --- dateClick using SweetAlert2 ---
        dateClick: function(clickInfo) {
          const startDate = clickInfo.date;
          const startTimeFormatted = startDate.toLocaleTimeString("en-US", {
              hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE,
            });

          Swal.fire({
            title: `Book Appointment at ${startTimeFormatted}`,
            width: '600px',
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
            focusConfirm: false,
            didOpen: () => {
              const buttons = document.querySelectorAll('#swal-duration-buttons .duration-button');
              buttons.forEach(button => {
                button.addEventListener('click', () => {
                  buttons.forEach(btn => btn.style.border = 'none');
                  button.style.border = '2px solid blue';
                  document.getElementById('swal-duration-buttons').dataset.selectedDuration = button.dataset.duration;
                });
              });
               const defaultButton = document.querySelector('#swal-duration-buttons .duration-button[data-duration="30"]');
               if(defaultButton) defaultButton.click();
            },
            preConfirm: () => {
              const name = document.getElementById('swal-input-name').value;
              const phone = document.getElementById('swal-input-phone').value;
              const selectedDurationMinutes = document.getElementById('swal-duration-buttons').dataset.selectedDuration;
              const phoneRegex = /^\d{10}$/;

              if (!name) { Swal.showValidationMessage(`Please enter the patient's name`); return false; }
              if (!phone) { Swal.showValidationMessage(`Please enter the patient's phone number`); return false; }
              if (!phoneRegex.test(phone)) { Swal.showValidationMessage(`Phone number must be exactly 10 digits`); return false; }
              if (!selectedDurationMinutes) { Swal.showValidationMessage(`Please select an appointment duration`); return false; }

              return { name: name, phone: phone, duration: parseInt(selectedDurationMinutes, 10) };
            }
          }).then(async (result) => { // Added async for overlap check
            if (result.isConfirmed && result.value) {
              const formData = result.value;
              const newStartTime = startDate;
              const newEndTime = new Date(newStartTime.getTime() + formData.duration * 60000);

              // --- Overlap Check ---
              console.log("Checking for overlapping appointments...");
              try {
                const overlapQuery = await db.collection("appointments")
                  .where("doctorId", "==", uid)
                  .where("start", "<", newEndTime.toISOString()) // Broad filter
                  .orderBy("start", "asc")
                  .get();

                let isOverlapping = false;
                overlapQuery.forEach(doc => {
                    const existingAppt = doc.data();
                    const existingStart = new Date(existingAppt.start).getTime();
                    const existingEnd = new Date(existingAppt.end).getTime();
                    const newStart = newStartTime.getTime();
                    const newEnd = newEndTime.getTime();
                    if (newStart < existingEnd && existingStart < newEnd) {
                        isOverlapping = true;
                    }
                });

                if (isOverlapping) {
                  Swal.fire('Error!', 'This time slot overlaps with an existing appointment.', 'warning');
                  return;
                }
              } catch (error) {
                  console.error("Error checking for overlap:", error);
                  Swal.fire('Error!', 'Could not verify appointment slot availability.', 'error');
                  return;
              }
              // --- END Overlap Check ---

              console.log("No overlap found. Creating appointment...");
              const newAppointment = {
                  doctorId: uid,
                  patientName: formData.name,
                  patientPhone: formData.phone,
                  start: newStartTime.toISOString(),
                  end: newEndTime.toISOString()
              };

              db.collection('appointments').add(newAppointment)
                  .then(() => {
                      console.log("Appointment added!");
                      Swal.fire('Success!', 'Appointment booked successfully.', 'success');
                  })
                  .catch(error => {
                      console.error("Error adding appointment: ", error);
                      Swal.fire('Error!', 'Could not create appointment.', 'error');
                  });
            } else {
              console.log("Appointment booking cancelled.");
            }
          });
        }, // End dateClick

        // --- eventClick for Deleting ---
        eventClick: function(clickInfo) {
            Swal.fire({ // Use SweetAlert for confirmation
                title: 'Delete Appointment?',
                text: `Are you sure you want to delete the appointment for '${clickInfo.event.title}'?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    const eventId = clickInfo.event.id;
                    db.collection('appointments').doc(eventId).delete()
                        .then(() => {
                            console.log("Appointment deleted!");
                            Swal.fire('Deleted!', 'Appointment has been deleted.', 'success');
                        })
                        .catch(error => {
                            console.error("Error deleting appointment: ", error);
                            Swal.fire('Error!', 'Could not delete appointment.', 'error');
                        });
                }
            });
        } // End eventClick
    }); // End new FullCalendar.Calendar

    calendar.render();

    // --- Start the real-time listener for appointments ---
    if (appointmentsListener) appointmentsListener(); // Detach old listener if exists

    appointmentsListener = db.collection('appointments')
        .where('doctorId', '==', uid)
        .onSnapshot(snapshot => {
            const events = snapshot.docs.map(doc => {
                const data = doc.data();
                // Basic check for valid data before creating event object
                if (data.patientName && data.start && data.end) {
                  return {
                      id: doc.id,
                      title: data.patientName,
                      start: data.start,
                      end: data.end
                  };
                } else {
                  console.warn("Skipping appointment with missing data:", doc.id, data);
                  return null; // Skip invalid entries
                }
            }).filter(event => event !== null); // Filter out nulls

            if (calendar) {
                calendar.setOption('events', events); // Correct method to update events
            }
        }, error => {
            console.error("Error fetching appointments: ", error);
        });
} // End initializeCalendar


// =================================================================
// --- Load and Display Active Appointment for Status Tab ---
// =================================================================
async function loadAndDisplayActiveAppointment() {
    if (!currentUser) {
        console.log("loadAndDisplayActiveAppointment: No current user.");
        return;
     }

    console.log("Loading active appointment for doctor:", currentUser.uid);
    activeAppointment = null; // Reset
    noUpcomingMessage.style.display = 'none';
    activeAppointmentDisplay.style.display = 'block';

    // Clear previous values immediately
    displayPatientName.textContent = '---';
    displayPatientPhone.textContent = '---';
    displayApptTime.textContent = '---';
    displayApptDuration.textContent = '---';
    goAheadButton.disabled = true; // Disable buttons until data is loaded
    finishedButton.disabled = true;

    try {
        // --- REVISED: Get today's date range in Mexico City ---
        const now = new Date(); // Current moment
        const todayDateStr = now.toLocaleTimeString("en-CA", { timeZone: MEXICO_TIMEZONE }).split(',')[0]; // Format: YYYY-MM-DD
        const year = parseInt(todayDateStr.substring(0, 4), 10);
        const month = parseInt(todayDateStr.substring(5, 7), 10) - 1; // Month is 0-indexed
        const day = parseInt(todayDateStr.substring(8, 10), 10);
        const todayStartLocal = new Date(year, month, day, 0, 0, 0);
        const todayEndLocal = new Date(year, month, day + 1, 0, 0, 0);
        const todayStartQueryISO = todayStartLocal.toISOString();
        const todayEndQueryISO = todayEndLocal.toISOString();
        // --- END REVISED DATE RANGE ---

        console.log(`Querying appointments between (ISO): ${todayStartQueryISO} and ${todayEndQueryISO}`);

        // Query appointments for today
        const apptSnapshot = await db.collection("appointments")
            .where("doctorId", "==", currentUser.uid)
            .where("start", ">=", todayStartQueryISO)
            .where("start", "<", todayEndQueryISO)
            .orderBy("start", "asc")
            .get();

        console.log(`Query finished. Found ${apptSnapshot.size} appointments for today.`);


        let foundActive = false;
        const nowTimestamp = Date.now();

        // Find the first appointment that hasn't finished
        for (const doc of apptSnapshot.docs) {
            const appt = { id: doc.id, ...doc.data() };
            const startTime = appt.start ? new Date(appt.start).getTime() : NaN;
            const endTime = appt.end ? new Date(appt.end).getTime() : NaN;

            console.log(`Checking appointment: ${appt.patientName}, Start: ${appt.start}, End: ${appt.end}`);
            console.log(`   EndTimeMs: ${endTime}, NowMs: ${nowTimestamp}`);

            // --- USE CONDITION DIRECTLY IN IF ---
            if (!isNaN(endTime) && endTime > nowTimestamp) { // Simplified check
                console.log("   >>> INSIDE IF BLOCK - Condition (endTime > nowTimestamp) was TRUE.");
                activeAppointment = appt;
                foundActive = true;
                break; // Stop after finding the first one
            } else {
                 console.log(`   Condition (endTime > nowTimestamp) evaluated as FALSE.`);
                 console.log("   Appointment has already finished or has invalid end time (Skipping 'if' block).");
            }
             // Basic 'if(true)' test - can remove later
            if (true) { console.log("   DEBUG: Basic 'if(true)' block executed."); }

        } // End of for...of loop

        console.log("Loop finished. foundActive:", foundActive, "activeAppointment:", activeAppointment);

        // Update the display
        if (foundActive && activeAppointment && activeAppointment.start && activeAppointment.end) {
            console.log("Updating display with active appointment details.");
            const startTime = new Date(activeAppointment.start);
            const endTime = new Date(activeAppointment.end);
            const durationMs = endTime.getTime() - startTime.getTime();
            const durationMinutes = Math.round(durationMs / 60000);

            displayPatientName.textContent = activeAppointment.patientName || 'N/A';
            displayPatientPhone.textContent = activeAppointment.patientPhone || 'N/A';
            displayApptTime.textContent = startTime.toLocaleTimeString("en-US", {
                hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE
            });
            displayApptDuration.textContent = `${durationMinutes} minutes`;

            // Reset button state (will be refined in next step based on doctor status)
            goAheadButton.disabled = false;
            finishedButton.disabled = true;

        } else {
            console.log("No current or upcoming appointments found for today. Hiding details, showing message.");
            activeAppointment = null; // Ensure it's nullified
            activeAppointmentDisplay.style.display = 'none';
            noUpcomingMessage.style.display = 'block';
            goAheadButton.disabled = true;
            finishedButton.disabled = true;
        }

    } catch (error) {
        console.error("Error loading active appointment:", error);
        // Display error state
        displayPatientName.textContent = 'Error';
        displayPatientPhone.textContent = 'Error';
        displayApptTime.textContent = 'Error';
        displayApptDuration.textContent = 'Error';
        activeAppointmentDisplay.style.display = 'block'; // Ensure box is visible to show error
        noUpcomingMessage.style.display = 'none';
        goAheadButton.disabled = true;
        finishedButton.disabled = true;
    }
}


// =================================================================
// --- EVENT LISTENERS ---
// =================================================================
loginButton.addEventListener('click', onLoginClick);
signOutButton.addEventListener('click', onSignOutClick);
changePasswordButton.addEventListener('click', onChangePasswordClick);
tabStatus.addEventListener('click', handleTabClick);
tabCalendar.addEventListener('click', handleTabClick);

// --- TODO: Add listeners for goAheadButton and finishedButton in the next step ---
// goAheadButton.addEventListener('click', onGoAheadClick);
// finishedButton.addEventListener('click', onFinishedClick);