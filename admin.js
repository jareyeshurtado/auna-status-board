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

// STEP 3: Get references
// --- Login elements ---
const loginContainer = document.getElementById('login-container');
const loginTitleH2 = document.getElementById('login-title-h2');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');

// --- Admin content elements ---
const adminContent = document.getElementById('admin-content');
const adminTitleH1 = document.getElementById('admin-title-h1');
const signOutButton = document.getElementById('sign-out-button');

// --- Tab elements ---
const tabStatus = document.getElementById('tab-status');
const tabCalendar = document.getElementById('tab-calendar');
const tabSettings = document.getElementById('tab-settings');
const panelStatus = document.getElementById('panel-status');
const panelCalendar = document.getElementById('panel-calendar');
const panelSettings = document.getElementById('panel-settings');

// --- Status Panel elements ---
// Note: activeAppointmentDisplay might not be in your current HTML based on recent reverts.
// If you want the "Next Up / In Progress" box, ensure that HTML is in admin.html.
// For now, we'll keep the reference but check existence before use.
const activeAppointmentDisplay = document.getElementById('active-appointment-display');
const displayPatientName = document.getElementById('display-patient-name');
const displayPatientPhone = document.getElementById('display-patient-phone');
const displayApptTime = document.getElementById('display-appt-time');
const displayApptDuration = document.getElementById('display-appt-duration');
const noUpcomingMessage = document.getElementById('no-upcoming-message');

const statusButtonsContainer = document.getElementById('status-buttons');
const updateButton = document.getElementById('update-button');
const updateMessage = document.getElementById('update-message');

// --- Settings Panel elements ---
const settingsTitleH3 = document.getElementById('settings-title-h3');
const changePasswordButton = document.getElementById('change-password-button');
const passwordMessage = document.getElementById('password-message');

// --- Calendar element ---
const calendarEl = document.getElementById('calendar-container');


// STEP 4: Global variables
let currentUser = null;
let currentDoctorDocId = null;
let calendar = null;
let appointmentsListener = null;
let i18n = {};
let allTexts = {};
let selectedStatus = '';
let activeAppointment = null;

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
        allTexts = { EN: { admin: {}, global: {} }, ES: { admin: {}, global: {} } };
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
    setupAuthListener();
}

function applyStaticTextsAdmin() {
    if (adminTitleH1) adminTitleH1.textContent = i18n.admin?.controlTitle || "Admin";
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

    // Status Button Texts
    if (statusButtonsContainer) {
        const btnAvailable = statusButtonsContainer.querySelector('button[data-status="Available"]');
        if (btnAvailable) btnAvailable.textContent = i18n.admin?.statusAvailable || "Available";
        const btnInConsultation = statusButtonsContainer.querySelector('button[data-status="In Consultation"]');
        if (btnInConsultation) btnInConsultation.textContent = i18n.admin?.statusInConsultation || "In Consultation";
        const btnDelayed = statusButtonsContainer.querySelector('button[data-status="Consultation Delayed"]');
        if (btnDelayed) btnDelayed.textContent = i18n.admin?.statusDelayed || "Delayed";
        const btnNotAvailable = statusButtonsContainer.querySelector('button[data-status="Not Available"]');
        if (btnNotAvailable) btnNotAvailable.textContent = i18n.admin?.statusNotAvailable || "Not Available";
    }
    
    if (updateButton) {
        updateButton.textContent = i18n.admin?.updateStatusButton || "Update Status";
    }
    
    const statusLabel = panelStatus.querySelector('label');
    if (statusLabel) {
        statusLabel.textContent = i18n.admin?.setStatusLabel || "Set Status";
    }
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
                    loadDoctorProfile(); // Load status for buttons
                    // loadAndDisplayActiveAppointment(); // Add this back if you want the appointment display box logic
                } else {
                    alert("Critical Error: Could not link login to doctor profile.");
                    auth.signOut();
                }
            });
        } else {
            currentUser = null; currentDoctorDocId = null;
            adminContent.style.display = 'none'; loginContainer.style.display = 'block';
            if (appointmentsListener) appointmentsListener();
            if (calendar) calendar.destroy();
            appointmentsListener = null; calendar = null; selectedStatus = '';
        }
    });
}

// =================================================================
// --- AUTH FUNCTIONS ---
// =================================================================
function onLoginClick() {
    const email = loginEmail.value; const password = loginPassword.value;
    if (!email || !password) { loginMessage.textContent = i18n.admin?.loginErrorCredentials; return; }
    loginMessage.textContent = i18n.admin?.loginInProgress;
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {}) .catch(error => { loginMessage.textContent = (i18n.admin?.loginErrorFirebase || 'Error:') + ' ' + error.message; });
}
function onSignOutClick() { auth.signOut().catch(error => console.error("Sign Out Error:", error)); }
function onChangePasswordClick() {
    if (!currentUser) { Swal.fire('Error!', 'Must be logged in.', 'error'); return; }
    const email = currentUser.email; passwordMessage.textContent = i18n.admin?.sendingResetEmail; passwordMessage.style.color = '#555';
    auth.sendPasswordResetEmail(email)
        .then(() => { passwordMessage.textContent = i18n.admin?.resetEmailSuccess; passwordMessage.style.color = '#006421'; setTimeout(() => { passwordMessage.textContent = ''; }, 7000); })
        .catch(error => { passwordMessage.textContent = (i18n.admin?.resetEmailError || 'Error:') + ' ' + error.message; passwordMessage.style.color = '#c91c1c'; });
}

async function findDoctorDocumentId(uid) {
    if (!uid) return;
    try {
        const doctorQuery = await db.collection("doctors").where("authUID", "==", uid).limit(1).get();
        if (!doctorQuery.empty) currentDoctorDocId = doctorQuery.docs[0].id;
        else { console.error(`No doc for authUID: ${uid}`); currentDoctorDocId = null; }
    } catch (error) { console.error("Error finding doc:", error); currentDoctorDocId = null; }
}

// =================================================================
// --- TAB SWITCHING ---
// =================================================================
function handleTabClick(event) {
    const clickedTab = event.target;
    tabStatus.classList.remove('active'); tabCalendar.classList.remove('active'); tabSettings.classList.remove('active');
    panelStatus.classList.remove('active'); panelCalendar.classList.remove('active'); panelSettings.classList.remove('active');
    
    if (clickedTab.id === 'tab-status') { 
        tabStatus.classList.add('active'); 
        panelStatus.classList.add('active'); 
        loadDoctorProfile(); 
        // loadAndDisplayActiveAppointment(); // Uncomment if you want the appointment display
    }
    else if (clickedTab.id === 'tab-calendar') { 
        tabCalendar.classList.add('active'); 
        panelCalendar.classList.add('active'); 
        if (calendar) calendar.render(); 
    }
    else if (clickedTab.id === 'tab-settings') { 
        tabSettings.classList.add('active'); 
        panelSettings.classList.add('active'); 
    }
}

// =================================================================
// --- CALENDAR FUNCTIONS (RESTORED) ---
// =================================================================
function initializeCalendar(uid) {
    if (calendar) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
        editable: false, selectable: true, timeZone: MEXICO_TIMEZONE,

        // --- Booking Modal ---
        dateClick: function(clickInfo) {
          const startDate = clickInfo.date;
          const startTimeFormatted = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE });

          Swal.fire({
            title: (i18n.admin?.bookAppointmentTitle || 'Book Appointment at {time}').replace('{time}', startTimeFormatted),
            width: '600px',
             html: `
              <div>
                <span class="swal2-label" for="swal-input-name">${i18n.admin?.patientNameLabel || 'Name'}</span>
                <input id="swal-input-name" class="swal2-input" placeholder="${i18n.admin?.patientNamePlaceholder || ''}">
                <span class="swal2-label" for="swal-input-phone">${i18n.admin?.phoneLabel || 'Phone'}</span>
                <input id="swal-input-phone" class="swal2-input" placeholder="${i18n.admin?.phonePlaceholder || ''}" type="tel">
                <span class="swal2-label">${i18n.admin?.durationLabel || 'Duration'}</span>
                <div id="swal-duration-buttons">
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="30">30 min</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="45">45 min</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="60">1 hour</button>
                  <button class="swal2-confirm swal2-styled duration-button" data-duration="90">1:30</button>
                </div>
              </div>`,
            confirmButtonText: i18n.admin?.bookButton,
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
              const duration = document.getElementById('swal-duration-buttons').dataset.selectedDuration;
              const phoneRegex = /^\d{10}$/;
              
              if (!name) { Swal.showValidationMessage(i18n.admin?.validationName); return false; }
              if (!phone) { Swal.showValidationMessage(i18n.admin?.validationPhone); return false; }
              if (!phoneRegex.test(phone)) { Swal.showValidationMessage(i18n.admin?.validationPhoneDigits); return false; }
              if (!duration) { Swal.showValidationMessage(i18n.admin?.validationDuration); return false; }
              return { name: name, phone: phone, duration: parseInt(duration, 10) };
            }
          }).then(async (result) => {
            if (result.isConfirmed && result.value) {
              const formData = result.value;
              const newStartTime = startDate;
              const newEndTime = new Date(newStartTime.getTime() + formData.duration * 60000);
              
              try {
                // Overlap Check
                const overlapQuery = await db.collection("appointments")
                    .where("doctorId", "==", uid)
                    .where("end", ">", newStartTime.toISOString())
                    .where("start", "<", newEndTime.toISOString())
                    .get();
                
                let isOverlapping = !overlapQuery.empty;
                // Double check locally if query was broad
                if (!isOverlapping) {
                     const broadQuery = await db.collection("appointments").where("doctorId", "==", uid).where("start", "<", newEndTime.toISOString()).get();
                     broadQuery.forEach(doc => {
                        const existingStart = new Date(doc.data().start).getTime();
                        const existingEnd = new Date(doc.data().end).getTime();
                        if (newStartTime.getTime() < existingEnd && existingStart < newEndTime.getTime()) isOverlapping = true;
                     });
                }

                if (isOverlapping) {
                  Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.overlapErrorText, 'warning');
                  return;
                }
              } catch (error) {
                 if (error.code === 'failed-precondition') Swal.fire('Setup Required', 'Index needed. Check console.', 'info');
                 else Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.overlapCheckErrorText, 'error');
                 return;
              }

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
            }
          });
        }, 

        // --- Delete Confirmation ---
        eventClick: function(clickInfo) {
            Swal.fire({
                title: i18n.admin?.deleteConfirmTitle,
                text: (i18n.admin?.deleteConfirmText || 'Delete {patient}?').replace('{patient}', clickInfo.event.title),
                icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
                confirmButtonText: i18n.admin?.deleteButton
            }).then((result) => {
                if (result.isConfirmed) {
                    db.collection('appointments').doc(clickInfo.event.id).delete()
                        .then(() => Swal.fire(i18n.admin?.deleteSuccessTitle, i18n.admin?.deleteSuccessText, 'success'))
                        .catch(error => Swal.fire(i18n.admin?.deleteErrorTitle, i18n.admin?.deleteErrorText, 'error'));
                }
            });
        }
    });
    
    calendar.render();

    // --- Listener ---
    if (appointmentsListener) appointmentsListener();
    appointmentsListener = db.collection('appointments')
        .where('doctorId', '==', uid)
        .onSnapshot(snapshot => {
            const events = snapshot.docs.map(doc => {
                const data = doc.data();
                if (data.patientName && data.start && data.end) {
                  return { id: doc.id, title: data.patientName, start: data.start, end: data.end };
                }
                return null;
            }).filter(event => event !== null);
            if (calendar) calendar.setOption('events', events);
        }, error => console.error("Error fetching appointments: ", error));
}


// =================================================================
// --- STATUS BUTTON LOGIC ---
// =================================================================
function loadDoctorProfile() {
    if (!currentDoctorDocId) return;
     db.collection('doctors').doc(currentDoctorDocId).get()
        .then(doc => {
             if (doc.exists) {
                const doctor = doc.data();
                selectedStatus = doctor.status || '';
                updateStatusButtonUI();
             }
        })
        .catch(error => console.error("Error fetching doctor profile: ", error));
}

function onStatusButtonClick(event) {
    const clickedButton = event.target.closest('button[data-status]');
    if (!clickedButton || !statusButtonsContainer.contains(clickedButton)) return;
    selectedStatus = clickedButton.dataset.status;
    updateStatusButtonUI();
}

function updateStatusButtonUI() {
    if (!statusButtonsContainer) return;
    const statusButtons = statusButtonsContainer.querySelectorAll('button[data-status]');
    statusButtons.forEach(btn => {
        if (btn.dataset.status === selectedStatus) {
            btn.classList.add('selected');
            btn.style.border = '2px solid black';
        } else {
            btn.classList.remove('selected');
            btn.style.border = '1px solid #ccc';
        }
    });
}

function onUpdateButtonClick() {
    if (!currentDoctorDocId) {
        Swal.fire('Error!', i18n.admin?.statusUpdateErrorProfile, 'error');
        return;
    }
    if (!selectedStatus) {
         Swal.fire('Warning', i18n.admin?.validationStatus, 'warning');
        return;
    }

    const updateData = { status: selectedStatus };
    if (updateButton) {
      updateButton.disabled = true;
      updateButton.textContent = i18n.admin?.updatingStatusButton;
    }

    db.collection('doctors').doc(currentDoctorDocId).update(updateData)
        .then(() => {
             Swal.fire(i18n.admin?.bookingSuccessTitle, i18n.admin?.statusUpdateSuccess, 'success');
         })
        .catch(error => {
            console.error("Error updating status: ", error);
             Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.statusUpdateError, 'error');
        })
        .finally(() => {
             if (updateButton) {
                updateButton.disabled = false;
                updateButton.textContent = i18n.admin?.updateStatusButton;
             }
        });
}

// =================================================================
// --- EVENT LISTENERS ---
// =================================================================
loginButton.addEventListener('click', onLoginClick);
signOutButton.addEventListener('click', onSignOutClick);
changePasswordButton.addEventListener('click', onChangePasswordClick);
tabStatus.addEventListener('click', handleTabClick);
tabCalendar.addEventListener('click', handleTabClick);
tabSettings.addEventListener('click', handleTabClick);

if (statusButtonsContainer) statusButtonsContainer.addEventListener('click', onStatusButtonClick);
if (updateButton) updateButton.addEventListener('click', onUpdateButtonClick);

// =================================================================
// --- Start ---
// =================================================================
initializeAdmin();