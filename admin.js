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
const loginTitleH2 = document.getElementById('login-title-h2'); // This was missing in your file, added for completeness
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
const settingsTitleH3 = document.getElementById('settings-title-h3'); // This was missing, added for completeness
const changePasswordButton = document.getElementById('change-password-button');
const passwordMessage = document.getElementById('password-message');
const calendarEl = document.getElementById('calendar-container');

// --- ADD BACK References for OLD Status Buttons ---
const statusButtonsContainer = document.getElementById('status-buttons');
const updateButton = document.getElementById('update-button');
const updateMessage = document.getElementById('update-message'); // This was missing, added for completeness
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

/**
 * Maps a translated status string back to its non-translated key.
 * e.g., "Disponible" -> "Available"
 */
function mapStatusToKey(status) {
    if (!status) return '';
    
    // We must check the i18n values first
    if (status === i18n.admin?.statusInConsultation) {
        return "In Consultation";
    }
    if (status === i18n.admin?.statusDelayed) {
        return "Consultation Delayed";
    }
    if (status === i18n.admin?.statusAvailable) {
        return "Available";
    }
    if (status === i18n.admin?.statusNotAvailable) {
        return "Not Available";
    }

    // Fallback for old values or if language is somehow English
    const lower = status.toLowerCase();
    if (lower.includes('in consultation')) return "In Consultation";
    if (lower.includes('delayed')) return "Consultation Delayed";
    if (lower.includes('not available')) return "Not Available";
    if (lower.includes('available')) return "Available"; // Must be after 'not available'

    // Fallback for very old values
    if (lower.includes('on time') || lower.includes('go ahead')) return "Available";
    if (lower.includes('away') || lower.includes('finished')) return "Not Available";
    
    return ''; // Default
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

	if (document.getElementById('btn-status-consultation')) {
        document.getElementById('btn-status-consultation').textContent = i18n.admin?.statusInConsultation || 'In Consultation';
    }
    if (document.getElementById('btn-status-delayed')) {
        document.getElementById('btn-status-delayed').textContent = i18n.admin?.statusDelayed || 'Consultation Delayed';
    }
    if (document.getElementById('btn-status-available')) {
        document.getElementById('btn-status-available').textContent = i18n.admin?.statusAvailable || 'Available';
    }
    if (document.getElementById('btn-status-unavailable')) {
        document.getElementById('btn-status-unavailable').textContent = i18n.admin?.statusNotAvailable || 'Not Available';
    }
	
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
                    loadDoctorProfile();
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
        .catch(error => { passwordMessage.textContent = (i18n.admin?.loginErrorError || 'Error:') + ' ' + error.message; passwordMessage.style.color = '#c91c1c'; });
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
    const clickedTab = event.target.closest('button.tab-button'); // More robust selector
    if (!clickedTab) return;

    tabStatus.classList.remove('active'); tabCalendar.classList.remove('active'); tabSettings.classList.remove('active');
    panelStatus.classList.remove('active'); panelCalendar.classList.remove('active'); panelSettings.classList.remove('active');
    
    if (clickedTab.id === 'tab-status') { tabStatus.classList.add('active'); panelStatus.classList.add('active'); loadDoctorProfile(); /* <<< Load status when switching TO status */ }
    else if (clickedTab.id === 'tab-calendar') { tabCalendar.classList.add('active'); panelCalendar.classList.add('active'); if (calendar) calendar.render(); }
    else if (clickedTab.id === 'tab-settings') { tabSettings.classList.add('active'); panelSettings.classList.add('active'); }
}

// =================================================================
// --- CALENDAR FUNCTIONS (CORRECTED WITH TIMEZONE) ---
// =================================================================
function initializeCalendar(uid) {
    if (calendar) return; // Initialize only once

    console.log("Initializing Calendar for user:", uid); 

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek', 
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay' 
        },
        editable: false, 
        selectable: true, 
        
        // --- *** FIX 1: RE-ADD the timeZone setting *** ---
        // This now works because we loaded the plugins in admin.html
        timeZone: MEXICO_TIMEZONE, 

        // --- dateClick using SweetAlert2 ---
        dateClick: function(clickInfo) {
          
          // --- *** FIX 2: Use clickInfo.dateStr *** ---
          // Because the plugin is loaded, this string will now
          // correctly be "....T18:00:00-06:00" (for 6:00 PM CST)
          console.log("dateClick triggered. dateStr:", clickInfo.dateStr); 
          
          // JS 'new Date()' can parse this offset string perfectly.
          const startDate = new Date(clickInfo.dateStr); 

          const startTimeFormatted = startDate.toLocaleTimeString("en-US", {
              hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE,
            });

          Swal.fire({
            title: (i18n.admin?.bookAppointmentTitle || 'Book Appointment at {time}').replace('{time}', startTimeFormatted),
            width: '600px', 
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
          }).then(async (result) => { 
            if (result.isConfirmed && result.value) {
              const formData = result.value;
              
              // --- *** FIX 2 (cont.): Use the dateStr again *** ---
              const newStartTime = new Date(clickInfo.dateStr); 
              const newEndTime = new Date(newStartTime.getTime() + formData.duration * 60000);

              try { 
                // .toISOString() will now correctly convert 6:00 PM CST to 12:00 AM UTC (next day)
                const overlapQuery = await db.collection("appointments").where("doctorId", "==", uid).where("end", ">", newStartTime.toISOString()).where("start", "<", newEndTime.toISOString()).get();
                let isOverlapping = !overlapQuery.empty;
                 if (isOverlapping) { Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.overlapErrorText, 'warning'); return; }
              } catch (error) { 
                 if (error.code === 'failed-precondition') Swal.fire('Setup Required', 'Index needed.', 'info');
                 else Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.overlapCheckErrorText, 'error');
                 return;
              }
              
              // This will now save the correct UTC-converted time
              const newAppointment = { 
                  doctorId: uid, 
                  patientName: formData.name, 
                  patientPhone: formData.phone, 
                  start: newStartTime.toISOString(), 
                  end: newEndTime.toISOString() 
                };

              db.collection('appointments').add(newAppointment)
                  .then(() => Swal.fire(i18n.admin?.bookingSuccessTitle, i18n.admin?.bookingSuccessText, 'success'))
                  .catch(error => Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.bookingErrorText, 'error'));
            } else { console.log(i18n.admin?.bookingCancelled || "Booking cancelled."); }
          });
        }, // End dateClick

        // --- eventClick for Deleting (No change) ---
        eventClick: function(clickInfo) {
             console.log("eventClick triggered:", clickInfo.event.id); 
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
        }, // End eventClick
    }); // End new FullCalendar.Calendar

    calendar.render(); // Render the calendar

    // --- Start the real-time listener for appointments (No change) ---
    if (appointmentsListener) appointmentsListener(); // Detach old listener if exists

    console.log("Setting up Firestore listener for appointments..."); 
    appointmentsListener = db.collection('appointments')
        .where('doctorId', '==', uid)
        .onSnapshot(snapshot => {
             console.log(`Received ${snapshot.docs.length} appointments from listener.`); 
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
                 console.log("Updating calendar events via setOption.");
                 // The calendar (now forced to CST) will correctly
                 // read the UTC string and display it in CST.
                calendar.setOption('events', events); 
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

                // --- CHANGE: Map the loaded status back to its key ---
                selectedStatus = mapStatusToKey(doctor.status);
                // --- END CHANGE ---
                
                // --- Set the admin title to the doctor's name ---
                if (adminTitleH1) {
                    // Use displayName, or fall back to the text from texts.json
                    adminTitleH1.textContent = doctor.displayName || (i18n.admin?.controlTitle || "Doctor Control");
                }
                // --- END ---

                console.log("Loaded current status from DB:", doctor.status, "Mapped to key:", selectedStatus);
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
            btn.classList.add('selected'); 
        } else {
            btn.classList.remove('selected');
        }
    });
}


// =================================================================
// --- MODIFIED & NEW: Status Update Functions (Your Request) ---
// =================================================================

/**
 * Handles click on the "Update Status" button.
 * This is the main function we are modifying.
 */
function onUpdateButtonClick() {
    if (!currentDoctorDocId) {
        Swal.fire('Error!', i18n.admin?.statusUpdateErrorProfile || 'Cannot update status. Doctor profile not loaded.', 'error');
        return;
    }
    if (!selectedStatus) {
         Swal.fire('Warning', i18n.admin?.validationStatus || 'Please select a status first.', 'warning');
        return;
    }

    // --- *** NEW LOGIC *** ---
    // If status is "Available", show the prompt.
    // Otherwise, update status normally.
    if (selectedStatus === "Available") {
        showNextAppointmentPrompt();
    } else {
        // Find the translated text to save
        let translatedStatus = getTranslatedStatus(selectedStatus);
        
        // Update status normally, setting appt fields to null so they are not changed
        updateDoctorStatusInFirestore(translatedStatus, null, null);
    }
    // --- *** END NEW LOGIC *** ---
}

/**
 * --- *** NEW FUNCTION (NOW WITH LOGS) *** ---
 * Fetches next appointments and shows the "Start Consultation" card.
 */
async function showNextAppointmentPrompt() {
    if (!currentUser || !currentDoctorDocId) return;

    // Set UI to loading state
    if (updateButton) {
      updateButton.disabled = true;
      updateButton.textContent = i18n.admin?.loading || 'Loading...';
    }

    try {
        const now = new Date(); // Get "now" as a Date object first
        const nowISO = now.toISOString(); // Get the UTC string for the query

        // --- *** NEW LOGS *** ---
        console.log("--- Troubleshooting showNextAppointmentPrompt ---");
        console.log("Current Local Time:", now.toLocaleString(undefined, { timeZone: MEXICO_TIMEZONE, hour12: false }));
        console.log("Current UTC Time (nowISO):", nowISO);
        console.log(`Query: appointments.where("doctorId", "==", "${currentUser.uid}").where("start", ">=", "${nowISO}")`);
        // --- *** END NEW LOGS *** ---
        
        // Query for the next 2 appointments for this doctor that haven't started yet
        const apptSnapshot = await db.collection("appointments")
            .where("doctorId", "==", currentUser.uid)
            .where("start", ">=", nowISO) // Use the UTC string
            .orderBy("start", "asc")
            .limit(2)
            .get();
        
        // --- *** NEW LOG *** ---
        console.log(`Found ${apptSnapshot.empty ? 0 : apptSnapshot.docs.length} upcoming appointments.`);
        if (!apptSnapshot.empty) {
            console.log("First appointment found:", apptSnapshot.docs[0].data());
        }
        // --- *** END NEW LOG *** ---


        if (apptSnapshot.empty) {
            // --- Case 1: No upcoming appointments ---
            console.log("No upcoming appointments found.");
            // Set status to "Available" and clear appt fields
            const availableStatus = i18n.admin?.statusAvailable || "Available";
            await updateDoctorStatusInFirestore(availableStatus, "---", "---");
            Swal.fire(i18n.admin?.bookingSuccessTitle || 'Success!', i18n.admin?.noAppointmentsFound || 'No appointments found.', 'info');
            return; // Exit function
        }

        // --- Case 2: Appointments found ---
        // (Rest of the function is the same as before)
        const nextAppt = apptSnapshot.docs[0].data();
        const afterNextAppt = apptSnapshot.docs[1] ? apptSnapshot.docs[1].data() : null;

        // Format appointment details for the modal
        const startTime = new Date(nextAppt.start).toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE,
        });

        const modalHtml = `
            <div style="text-align: left; padding: 0 1em;">
                <p style="font-size: 1.2em;">
                    <strong>${i18n.admin?.patientLabel || 'Patient:'}</strong> ${nextAppt.patientName}
                </p>
                <p style="font-size: 1.2em;">
                    <strong>${i18n.admin?.phoneLabel || 'Phone:'}</strong> ${nextAppt.patientPhone}
                </p>
                <p style="font-size: 1.2em;">
                    <strong>${i18n.admin?.timeLabel || 'Time:'}</strong> ${startTime}
                </p>
            </div>
        `;

        // Show the SweetAlert confirmation card
        Swal.fire({
            title: i18n.admin?.nextAppointmentTitle || 'Next Appointment',
            html: modalHtml,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: i18n.admin?.startButton || 'Start Consultation',
            confirmButtonColor: '#28a745', // Green color for "Start"
            cancelButtonText: i18n.admin?.cancelButton || 'Cancel' 
        }).then(async (result) => {
            if (result.isConfirmed) {
                // --- "Start" button was clicked ---
                
                // 1. Format the text for "Current" and "Next"
                const currentText = formatApptString(nextAppt);
                const nextText = afterNextAppt ? formatApptString(afterNextAppt) : "---";
                
                // 2. Get the "In Consultation" status
                const inConsultationStatus = i18n.admin?.statusInConsultation || "In Consultation";

                // 3. Update all three fields in Firestore
                await updateDoctorStatusInFirestore(inConsultationStatus, currentText, nextText);
                
                // 4. Update the local UI to show "In Consultation"
                selectedStatus = "In Consultation";
                updateStatusButtonUI();

                Swal.fire(i18n.admin?.consultationStartSuccess || 'Success!', '', 'success');
            }
            // If cancelled, do nothing. Status remains as it was.
        });

    } catch (error) {
        console.error("Error showing next appointment prompt: ", error);
        Swal.fire(i18n.admin?.bookingErrorTitle || 'Error!', error.message, 'error');
    } finally {
        // Reset button regardless of outcome
        if (updateButton) {
            updateButton.disabled = false;
            updateButton.textContent = i18n.admin?.updateStatusButton || 'Update Status';
        }
    }
}


/**
 * --- *** NEW HELPER FUNCTION *** ---
 * Reusable function to format an appointment object into a display string.
 * (Based on the function from your functions/index.js)
 */
function formatApptString(appointment) {
  if (!appointment || !appointment.start || !appointment.patientName) {
    return "---"; 
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
 * --- *** NEW HELPER FUNCTION *** ---
 * Gets the translated status string based on the (English) key.
 */
function getTranslatedStatus(statusKey) {
    if (statusKey === "In Consultation") {
        return i18n.admin?.statusInConsultation || statusKey;
    } else if (statusKey === "Consultation Delayed") {
        return i18n.admin?.statusDelayed || statusKey;
    } else if (statusKey === "Available") {
        return i18n.admin?.statusAvailable || statusKey;
    } else if (statusKey === "Not Available") {
        return i18n.admin?.statusNotAvailable || statusKey;
    }
    return statusKey; // Fallback
}


/**
 * --- *** REFACTORED HELPER FUNCTION *** ---
 * Central function to update the doctor's document in Firestore.
 * @param {string} status - The translated status string to save.
 * @param {string | null} currentText - Text for autoCurrentAppointment, or null to skip.
 * @param {string | null} nextText - Text for autoNextAppointment, or null to skip.
 */
async function updateDoctorStatusInFirestore(status, currentText, nextText) {
    if (!currentDoctorDocId) {
         console.error("updateDoctorStatusInFirestore: No doctor ID found.");
         return; // Guard clause
    }

    const updateData = { status: status };

    // Only add appointment fields if they are not null
    // This allows us to call this function to *only* update status
    if (currentText !== null) {
        updateData.autoCurrentAppointment = currentText;
    }
    if (nextText !== null) {
        updateData.autoNextAppointment = nextText;
    }

    // Set UI to loading state
    if (updateButton) {
      updateButton.disabled = true;
      updateButton.textContent = i18n.admin?.updatingStatusButton || 'Updating...';
    }

    try {
        await db.collection('doctors').doc(currentDoctorDocId).update(updateData);
        
        // Don't show success alert if it's part of the "Available" flow
        // (That flow shows its own specific alerts)
        if (selectedStatus !== "Available") {
             Swal.fire(i18n.admin?.bookingSuccessTitle || 'Success!', i18n.admin?.statusUpdateSuccess || 'Status updated!', 'success');
        }
        
        // Re-load profile to ensure UI buttons (and selectedStatus var) are in sync
        loadDoctorProfile(); 

    } catch (error) {
        console.error("Error updating status document: ", error);
        Swal.fire(i18n.admin?.bookingErrorTitle || 'Error!', i18n.admin?.statusUpdateError || 'Could not update status.', 'error');
    
    } finally {
        // Reset button
        if (updateButton) {
            updateButton.disabled = false;
            updateButton.textContent = i18n.admin?.updateStatusButton || 'Update Status';
        }
    }
}
// --- END MODIFICATIONS ---


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
    updateButton.addEventListener('click', onUpdateButtonClick); // This now points to our modified function
} else {
    console.warn("Element with ID 'update-button' not found. Update Status button won't work.");
}
// --- END ADD BACK ---


// =================================================================
// --- Start the application ---
// =================================================================
initializeAdmin(); // Single entry point