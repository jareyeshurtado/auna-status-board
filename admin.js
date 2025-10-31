// STEP 1: Firebase Config
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
const auth = firebase.auth();
const db = firebase.firestore();
const MEXICO_TIMEZONE = "America/Mexico_City";

// STEP 3: Get references (Including OLD status elements)
const loginContainer = document.getElementById('login-container');
const loginTitleH2 = document.getElementById('login-title-h2');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');
const adminContent = document.getElementById('admin-content');
const adminTitleH1 = document.getElementById('admin-title-h1');
const signOutButton = document.getElementById('sign-out-button');
const tabStatus = document.getElementById('tab-status');
const tabCalendar = document.getElementById('tab-calendar');
const tabSettings = document.getElementById('tab-settings');
const panelStatus = document.getElementById('panel-status');
const panelCalendar = document.getElementById('panel-calendar');
const panelSettings = document.getElementById('panel-settings');
const settingsTitleH3 = document.getElementById('settings-title-h3');
const changePasswordButton = document.getElementById('change-password-button');
const passwordMessage = document.getElementById('password-message');
const calendarEl = document.getElementById('calendar-container');

// --- ADD BACK References for OLD Status Buttons ---
const statusButtonsContainer = document.getElementById('status-buttons');
const updateButton = document.getElementById('update-button');
const updateMessage = document.getElementById('update-message');
// --- END ADD BACK ---

// STEP 4: Global variables
let currentUser = null;
let currentDoctorDocId = null;
let calendar = null;
let appointmentsListener = null;
let i18n = {}; // Will hold the selected language texts
let allTexts = {}; // Will hold the entire texts.json
let selectedStatus = ''; // Variable for the OLD status buttons

// =================================================================
// --- Load Texts and Settings ---
// =================================================================
async function initializeAdmin() {
    try {
        const response = await fetch('texts.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allTexts = await response.json();
    } catch (error) {
        console.error("Error fetching texts.json:", error);
        allTexts = { EN: { admin: {}, global: {} }, ES: { admin: {}, global: {} } }; // Fallback
    }

    let lang = "EN";
    try {
        const docRef = db.collection("settings").doc("displayConfig");
        const docSnap = await docRef.get();
        if (docSnap.exists) lang = docSnap.data().language || "EN";
    } catch (error) { console.error("Error fetching language setting:", error); }

    i18n = allTexts[lang.toUpperCase()] || allTexts.EN;
    console.log(`Language set to: ${lang}`);

    applyStaticTextsAdmin();
    setupAuthListener(); // Start auth listener AFTER texts are ready
}

/** Applies static text to the admin page. */
function applyStaticTextsAdmin() {
    // --- ADD BACK: Set text for Update Status button ---
    const updateStatusButtonText = document.getElementById('update-button');
    if (updateStatusButtonText) {
        // Assuming you add a key like "updateStatusButton" to texts.json:admin
        updateStatusButtonText.textContent = i18n.admin?.updateStatusButton || "Update Status";
    }
    const statusLabel = panelStatus.querySelector('label'); // Find label in status panel
     if (statusLabel) {
         // Assuming key "setStatusLabel" in texts.json:admin
         statusLabel.textContent = i18n.admin?.setStatusLabel || "Set Status";
     }
     // --- END ADD BACK ---

    // Set other static texts...
    if (loginTitleH2) loginTitleH2.textContent = i18n.admin?.loginTitle || "Login";
    if (loginEmail) loginEmail.placeholder = i18n.admin?.loginEmailPlaceholder || "Email";
    if (loginPassword) loginPassword.placeholder = i18n.admin?.loginPasswordPlaceholder || "Password";
    if (loginButton) loginButton.textContent = i18n.admin?.loginButton || "Login";
    if (signOutButton) signOutButton.textContent = i18n.admin?.signOutButton || "Sign Out";
    if (tabStatus) tabStatus.textContent = i18n.admin?.tabStatus || "Status";
    if (tabCalendar) tabCalendar.textContent = i18n.admin?.tabCalendar || "Calendar";
    if (tabSettings) tabSettings.textContent = i18n.admin?.tabSettings || "Settings";
    if (settingsTitleH3) settingsTitleH3.textContent = i18n.admin?.settingsTitle || "Settings";
    if (changePasswordButton) changePasswordButton.textContent = i18n.admin?.changePasswordButton || "Change Password";
}

// =================================================================
// --- MASTER AUTH FUNCTION ---
// =================================================================
function setupAuthListener() {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            adminContent.style.display = 'block';
            loginContainer.style.display = 'none';
            findDoctorDocumentId(user.uid).then(() => {
                if (currentDoctorDocId) {
                    initializeCalendar(user.uid);
                    loadDoctorProfile(); // <<< ADD BACK: Load initial status for buttons
                } else {
                    alert("Critical Error: Could not link login to doctor profile.");
                    auth.signOut();
                }
            });
        } else {
            // Logout logic (unchanged)
            currentUser = null; currentDoctorDocId = null;
            adminContent.style.display = 'none'; loginContainer.style.display = 'block';
            if (appointmentsListener) appointmentsListener();
            if (calendar) calendar.destroy();
            appointmentsListener = null; calendar = null; selectedStatus = '';
        }
    });
}

// =================================================================
// --- AUTH FUNCTIONS (Unchanged from i18n version) ---
// =================================================================
function onLoginClick() { /* ... Keep existing i18n version ... */
    const email = loginEmail.value; const password = loginPassword.value;
    if (!email || !password) { loginMessage.textContent = i18n.admin?.loginErrorCredentials; return; }
    loginMessage.textContent = i18n.admin?.loginInProgress;
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {}) .catch(error => { loginMessage.textContent = (i18n.admin?.loginErrorFirebase || 'Error:') + ' ' + error.message; });
}
function onSignOutClick() { auth.signOut().catch(error => console.error("Sign Out Error:", error)); }
function onChangePasswordClick() { /* ... Keep existing i18n version ... */
    if (!currentUser) { Swal.fire('Error!', 'Must be logged in.', 'error'); return; }
    const email = currentUser.email; passwordMessage.textContent = i18n.admin?.sendingResetEmail; passwordMessage.style.color = '#555';
    auth.sendPasswordResetEmail(email)
        .then(() => { passwordMessage.textContent = i18n.admin?.resetEmailSuccess; passwordMessage.style.color = '#006421'; setTimeout(() => { passwordMessage.textContent = ''; }, 7000); })
        .catch(error => { passwordMessage.textContent = (i18n.admin?.resetEmailError || 'Error:') + ' ' + error.message; passwordMessage.style.color = '#c91c1c'; });
}

// =================================================================
// --- Helper: Find Doctor's Firestore Document ID (Unchanged) ---
// =================================================================
async function findDoctorDocumentId(uid) { /* ... Keep existing function ... */
    if (!uid) return;
    try {
        const doctorQuery = await db.collection("doctors").where("authUID", "==", uid).limit(1).get();
        if (!doctorQuery.empty) currentDoctorDocId = doctorQuery.docs[0].id;
        else { console.error(`No doc for authUID: ${uid}`); currentDoctorDocId = null; }
    } catch (error) { console.error("Error finding doc:", error); currentDoctorDocId = null; }
}

// =================================================================
// --- TAB SWITCHING FUNCTION (Unchanged) ---
// =================================================================
function handleTabClick(event) { /* ... Keep existing function ... */
    const clickedTab = event.target;
    tabStatus.classList.remove('active'); tabCalendar.classList.remove('active'); tabSettings.classList.remove('active');
    panelStatus.classList.remove('active'); panelCalendar.classList.remove('active'); panelSettings.classList.remove('active');
    if (clickedTab.id === 'tab-status') { tabStatus.classList.add('active'); panelStatus.classList.add('active'); loadDoctorProfile(); /* <<< Load status when switching TO status */ }
    else if (clickedTab.id === 'tab-calendar') { tabCalendar.classList.add('active'); panelCalendar.classList.add('active'); if (calendar) calendar.render(); }
    else if (clickedTab.id === 'tab-settings') { tabSettings.classList.add('active'); panelSettings.classList.add('active'); }
}

// =================================================================
// --- CALENDAR FUNCTIONS (CORRECTED) ---
// =================================================================
function initializeCalendar(uid) {
    if (calendar) return; // Initialize only once

    console.log("Initializing Calendar for user:", uid); // Add log

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek', // <<< Make sure this is set
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay' // Standard views
        },
        editable: false, // Keep false
        selectable: true, // Keep true
        timeZone: MEXICO_TIMEZONE, // Your timezone

        // --- dateClick using SweetAlert2 (Restore this fully) ---
        dateClick: function(clickInfo) {
          console.log("dateClick triggered:", clickInfo.dateStr); // Add log
          const startDate = clickInfo.date;
          const startTimeFormatted = startDate.toLocaleTimeString("en-US", {
              hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE,
            });

          Swal.fire({
            title: (i18n.admin?.bookAppointmentTitle || 'Book Appointment at {time}').replace('{time}', startTimeFormatted),
            width: '600px', // Keep custom width
             html: `
              <div>
                <span class="swal2-label" for="swal-input-name">${i18n.admin?.patientNameLabel || 'Patient Name:'}</span>
                <input id="swal-input-name" class="swal2-input" placeholder="${i18n.admin?.patientNamePlaceholder || 'Enter name'}">
                <span class="swal2-label" for="swal-input-phone">${i18n.admin?.phoneLabel || 'Phone:'}</span>
                <input id="swal-input-phone" class="swal2-input" placeholder="${i18n.admin?.phonePlaceholder || 'Enter phone'}" type="tel">
                <span class="swal2-label">${i18n.admin?.durationLabel || 'Duration:'}</span>
                <div id="swal-duration-buttons">
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="30">30 min</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="45">45 min</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="60">1 hour</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="90">1:30</button>
                </div>
              </div>`,
            confirmButtonText: i18n.admin?.bookButton || 'Book Appointment',
            focusConfirm: false,
            didOpen: () => {
              // Add interactivity to duration buttons
              const buttons = document.querySelectorAll('#swal-duration-buttons .duration-button');
              buttons.forEach(button => {
                button.addEventListener('click', () => {
                  buttons.forEach(btn => btn.style.border = 'none'); // Reset border
                  button.style.border = '2px solid blue'; // Highlight selected
                  document.getElementById('swal-duration-buttons').dataset.selectedDuration = button.dataset.duration;
                });
              });
               const defaultButton = document.querySelector('#swal-duration-buttons .duration-button[data-duration="30"]');
               if(defaultButton) defaultButton.click(); // Select 30 min by default
            },
            preConfirm: () => {
              // Validation logic (keep as before)
              const name = document.getElementById('swal-input-name').value;
              const phone = document.getElementById('swal-input-phone').value;
              const duration = document.getElementById('swal-duration-buttons').dataset.selectedDuration;
              const phoneRegex = /^\d{10}$/;
              if (!name) { Swal.showValidationMessage(i18n.admin?.validationName || 'Enter name'); return false; }
              if (!phone) { Swal.showValidationMessage(i18n.admin?.validationPhone || 'Enter phone'); return false; }
              if (!phoneRegex.test(phone)) { Swal.showValidationMessage(i18n.admin?.validationPhoneDigits || '10 digits only'); return false; }
              if (!duration) { Swal.showValidationMessage(i18n.admin?.validationDuration || 'Select duration'); return false; }
              return { name: name, phone: phone, duration: parseInt(duration, 10) };
            }
          }).then(async (result) => { // Submission logic (keep as before)
            if (result.isConfirmed && result.value) {
              const formData = result.value;
              const newStartTime = startDate;
              const newEndTime = new Date(newStartTime.getTime() + formData.duration * 60000);
              try { // Overlap check (keep as before)
                const overlapQuery = await db.collection("appointments").where("doctorId", "==", uid).where("end", ">", newStartTime.toISOString()).where("start", "<", newEndTime.toISOString()).get();
                let isOverlapping = !overlapQuery.empty;
                 if (!isOverlapping) { /* Fallback check if needed */ }
                if (isOverlapping) { Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.overlapErrorText, 'warning'); return; }
              } catch (error) { /* Error handling, including index check */
                 if (error.code === 'failed-precondition') Swal.fire('Setup Required', 'Index needed.', 'info');
                 else Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.overlapCheckErrorText, 'error');
                 return;
              }
              const newAppointment = { doctorId: uid, patientName: formData.name, patientPhone: formData.phone, start: newStartTime.toISOString(), end: newEndTime.toISOString() };
              db.collection('appointments').add(newAppointment)
                  .then(() => Swal.fire(i18n.admin?.bookingSuccessTitle, i18n.admin?.bookingSuccessText, 'success'))
                  .catch(error => Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.bookingErrorText, 'error'));
            } else { console.log(i18n.admin?.bookingCancelled || "Booking cancelled."); }
          });
        }, // End dateClick

        // --- eventClick for Deleting (Restore this fully) ---
        eventClick: function(clickInfo) {
             console.log("eventClick triggered:", clickInfo.event.id); // Add log
            Swal.fire({
                title: i18n.admin?.deleteConfirmTitle || 'Delete?',
                text: (i18n.admin?.deleteConfirmText || 'Delete {patient}?').replace('{patient}', clickInfo.event.title),
                icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
                confirmButtonText: i18n.admin?.deleteButton || 'Yes, delete!'
            }).then((result) => {
                if (result.isConfirmed) {
                    const eventId = clickInfo.event.id;
                    db.collection('appointments').doc(eventId).delete()
                        .then(() => {
                            console.log("Appointment deleted!");
                            Swal.fire(i18n.admin?.deleteSuccessTitle || 'Deleted!', i18n.admin?.deleteSuccessText || 'Deleted.', 'success');
                        })
                        .catch(error => {
                            console.error("Error deleting appointment: ", error);
                            Swal.fire(i18n.admin?.deleteErrorTitle || 'Error!', i18n.admin?.deleteErrorText || 'Delete failed.', 'error');
                        });
                }
            });
        } // End eventClick
    }); // End new FullCalendar.Calendar

    calendar.render(); // Render the calendar

    // --- Start the real-time listener for appointments (Restore this fully) ---
    if (appointmentsListener) appointmentsListener(); // Detach old listener if exists

    console.log("Setting up Firestore listener for appointments..."); // Add log
    appointmentsListener = db.collection('appointments')
        .where('doctorId', '==', uid)
        .onSnapshot(snapshot => {
             console.log(`Received ${snapshot.docs.length} appointments from listener.`); // Add log
            const events = snapshot.docs.map(doc => {
                const data = doc.data();
                if (data.patientName && data.start && data.end) {
                  return {
                      id: doc.id,
                      title: data.patientName,
                      start: data.start,
                      end: data.end
                  };
                } else {
                  console.warn("Skipping appointment with missing data:", doc.id, data);
                  return null;
                }
            }).filter(event => event !== null); // Filter out nulls

            if (calendar) {
                 console.log("Updating calendar events via setOption."); // Add log
                calendar.setOption('events', events); // Correct method to update events
            } else {
                 console.warn("Calendar object not available to update events.");
            }
        }, error => {
            console.error("Error fetching appointments: ", error);
        });
} // End initializeCalendar


// =================================================================
// --- ADD BACK: Functions for OLD Status Button System ---
// =================================================================

/** Loads the doctor's current status and updates the button UI */
function loadDoctorProfile() {
    if (!currentDoctorDocId) {
        console.warn("loadDoctorProfile called before currentDoctorDocId is set.");
        return; // Need doc ID found by findDoctorDocumentId
    }
     db.collection('doctors').doc(currentDoctorDocId).get()
        .then(doc => {
             if (doc.exists) {
                const doctor = doc.data();
                selectedStatus = doctor.status || ''; // Get current status
                
                // --- NEW: Set the admin title to the doctor's name ---
                if (adminTitleH1) {
                    // Use displayName, or fall back to the text from texts.json
                    adminTitleH1.textContent = doctor.displayName || (i18n.admin?.controlTitle || "Doctor Control");
                }
                // --- END NEW ---

                console.log("Loaded current status:", selectedStatus);
                updateStatusButtonUI(); // Update UI to reflect loaded status
             } else {
                 console.error("Doctor document not found during profile load:", currentDoctorDocId);
                 // Fallback title if doctor doc not found
                 if (adminTitleH1) {
                    adminTitleH1.textContent = i18n.admin?.controlTitle || "Doctor Control";
                 }
             }
        })
        .catch(error => {
            console.error("Error fetching doctor profile: ", error);
            // Fallback title on error
             if (adminTitleH1) {
                adminTitleH1.textContent = i18n.admin?.controlTitle || "Doctor Control";
             }
        });
}

/** Handles clicks on the old status buttons */
function onStatusButtonClick(event) {
    // Use event delegation on the container
    const clickedButton = event.target.closest('button[data-status]'); // Ensure it's a status button
    if (!clickedButton || !statusButtonsContainer.contains(clickedButton)) return; // Check it's inside the container

    selectedStatus = clickedButton.dataset.status;
    console.log("Status button clicked:", selectedStatus);
    updateStatusButtonUI(); // Update visual selection
}

/** Updates the visual style of the old status buttons */
function updateStatusButtonUI() {
    if (!statusButtonsContainer) return; // Check if container exists
    const statusButtons = statusButtonsContainer.querySelectorAll('button[data-status]');
    if (!statusButtons.length) return; // Exit if buttons don't exist

    console.log("Updating status button UI for selectedStatus:", selectedStatus);
    statusButtons.forEach(btn => {
        if (btn.dataset.status === selectedStatus) {
            btn.classList.add('selected'); // Assumes you have a .selected style in admin.html <style>
            btn.style.border = '2px solid black'; // Example: Add border to selected
        } else {
            btn.classList.remove('selected');
            btn.style.border = '1px solid #ccc'; // Example: Reset border
        }
    });
}

/** Handles click on the "Update Status" button */
function onUpdateButtonClick() {
    if (!currentDoctorDocId) {
        Swal.fire('Error!', i18n.admin?.statusUpdateErrorProfile || 'Cannot update status. Doctor profile not loaded.', 'error');
        return;
    }
    if (!selectedStatus) {
         // Assuming key "validationStatus" in texts.json:admin
         Swal.fire('Warning', i18n.admin?.validationStatus || 'Please select a status first.', 'warning');
        return;
    }

    const updateData = { status: selectedStatus };

    // Ensure updateButton exists before using it
    if (updateButton) {
      updateButton.disabled = true;
      // Assuming key "updatingStatusButton" in texts.json:admin
      updateButton.textContent = i18n.admin?.updatingStatusButton || 'Updating...';
    }

    db.collection('doctors').doc(currentDoctorDocId).update(updateData)
        .then(() => {
             // Assuming key "statusUpdateSuccess" in texts.json:admin
             Swal.fire(i18n.admin?.bookingSuccessTitle || 'Success!', i18n.admin?.statusUpdateSuccess || 'Status updated successfully!', 'success');
             // Optionally re-load profile data if needed after update
             // loadDoctorProfile();
         })
        .catch(error => {
            console.error("Error updating status document: ", error);
             // Assuming key "statusUpdateError" in texts.json:admin
             Swal.fire(i18n.admin?.bookingErrorTitle || 'Error!', i18n.admin?.statusUpdateError || 'Could not update status.', 'error');
        })
        .finally(() => {
             if (updateButton) {
                updateButton.disabled = false;
                // Assuming key "updateStatusButton" in texts.json:admin (same as initial)
                updateButton.textContent = i18n.admin?.updateStatusButton || 'Update Status';
             }
        });
}
// --- END ADD BACK ---


// =================================================================
// --- EVENT LISTENERS ---
// =================================================================
loginButton.addEventListener('click', onLoginClick);
signOutButton.addEventListener('click', onSignOutClick);
changePasswordButton.addEventListener('click', onChangePasswordClick);
tabStatus.addEventListener('click', handleTabClick);
tabCalendar.addEventListener('click', handleTabClick);
tabSettings.addEventListener('click', handleTabClick);

// --- ADD BACK Listeners for OLD Status Buttons ---
// Add checks to ensure elements exist before adding listeners
if (statusButtonsContainer) {
    statusButtonsContainer.addEventListener('click', onStatusButtonClick);
} else {
    console.warn("Element with ID 'status-buttons' not found. Status button clicks won't work.");
}

if (updateButton) {
    updateButton.addEventListener('click', onUpdateButtonClick);
} else {
    console.warn("Element with ID 'update-button' not found. Update Status button won't work.");
}
// --- END ADD BACK ---


// =================================================================
// --- Start the application ---
// =================================================================
initializeAdmin(); // Single entry point

