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

// --- Status Panel Elements (NEW) ---
const upcomingList = document.getElementById('upcoming-appointments-list');
const mainActionButton = document.getElementById('main-action-button');
const upcomingLabel = document.getElementById('upcoming-label'); // Ensure ID exists in HTML if you want translation
const manualStatusLabel = document.getElementById('manual-status-label'); // Ensure ID exists in HTML

// --- Manual Status Buttons ---
const manualStatusButtonsContainer = document.getElementById('status-buttons');
const manualUpdateButton = document.getElementById('manual-update-button'); 
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
let selectedStatus = ''; // For manual override
let selectedAppointment = null; // For the "Start Consultation" flow
let currentDoctorStatus = ''; // Actual DB status

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

    // New labels (if elements exist)
    if (upcomingLabel) upcomingLabel.textContent = i18n.admin?.nextAppointmentTitle || "Select Next Patient";
    if (manualStatusLabel) manualStatusLabel.textContent = i18n.admin?.setStatusLabel || "Manual Status Override";
    
    // Manual Status Button Texts
    if (manualStatusButtonsContainer) {
        const btnAvailable = manualStatusButtonsContainer.querySelector('button[data-status="Available"]');
        if (btnAvailable) btnAvailable.textContent = i18n.admin?.statusAvailable || "Available";
        
        // Note: "In Consultation" is technically handled by main button logic, but if present in manual list:
        const btnInConsultation = manualStatusButtonsContainer.querySelector('button[data-status="In Consultation"]');
        if (btnInConsultation) btnInConsultation.textContent = i18n.admin?.statusInConsultation || "In Consultation";
        
        const btnDelayed = manualStatusButtonsContainer.querySelector('button[data-status="Consultation Delayed"]');
        if (btnDelayed) btnDelayed.textContent = i18n.admin?.statusDelayed || "Delayed";
        const btnNotAvailable = manualStatusButtonsContainer.querySelector('button[data-status="Not Available"]');
        if (btnNotAvailable) btnNotAvailable.textContent = i18n.admin?.statusNotAvailable || "Not Available";
    }
    
    if (manualUpdateButton) {
        manualUpdateButton.textContent = i18n.admin?.updateStatusButton || "Set Manual Status";
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
                    loadDoctorProfileAndAppointments(); // Load new UI logic
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
            appointmentsListener = null; calendar = null; selectedStatus = ''; selectedAppointment = null;
        }
    });
}

// =================================================================
// --- DATA LOADING & UI (Profile + Appointments) ---
// =================================================================

/** Loads doctor profile (status) AND upcoming appointments */
async function loadDoctorProfileAndAppointments() {
    if (!currentDoctorDocId) return;

    // 1. Get Doctor Status
    try {
        const docSnap = await db.collection('doctors').doc(currentDoctorDocId).get();
        if (docSnap.exists) {
            const data = docSnap.data();
            currentDoctorStatus = data.status || 'Available';
            updateMainActionButtonState(); // Update main button based on status
        }
    } catch (error) { console.error("Error fetching doctor:", error); }

    // 2. Get Upcoming Appointments (Next 3)
    loadUpcomingAppointments();
}

async function loadUpcomingAppointments() {
    if (!currentUser) return;
    if (upcomingList) upcomingList.innerHTML = `<div class="appointment-item placeholder">${i18n.global?.loading || 'Loading...'}</div>`;
    selectedAppointment = null;
    updateMainActionButtonState(); 

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); 
    
    try {
        const snapshot = await db.collection("appointments")
            .where("doctorId", "==", currentUser.uid)
            .where("start", ">=", todayStart.toISOString())
            .orderBy("start", "asc")
            .get();

        const upcoming = [];
        const nowMs = Date.now();

        snapshot.forEach(doc => {
            const data = doc.data();
            const endMs = new Date(data.end).getTime();
            // Filter out appointments that have already ended
            if (endMs > nowMs) {
                upcoming.push({ id: doc.id, ...data });
            }
        });

        const nextThree = upcoming.slice(0, 3);
        renderAppointmentList(nextThree);

    } catch (error) {
        console.error("Error loading upcoming:", error);
        if (upcomingList) upcomingList.innerHTML = `<div class="appointment-item placeholder">${i18n.global?.errorLoading || 'Error loading appointments.'}</div>`;
    }
}

function renderAppointmentList(appointments) {
    if (!upcomingList) return;
    upcomingList.innerHTML = '';
    if (appointments.length === 0) {
        upcomingList.innerHTML = `<div class="appointment-item placeholder">${i18n.admin?.noAppointmentsFound || 'No upcoming appointments.'}</div>`;
        return;
    }

    appointments.forEach(appt => {
        const el = document.createElement('div');
        el.className = 'appointment-item';
        
        const startTime = new Date(appt.start).toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE
        });
        
        el.innerHTML = `
            <h4>${appt.patientName}</h4>
            <p>${startTime} - ${appt.patientPhone || ''}</p>
        `;
        
        el.addEventListener('click', () => {
            // Deselect others
            const items = upcomingList.querySelectorAll('.appointment-item');
            items.forEach(i => i.classList.remove('selected'));
            // Select this one
            el.classList.add('selected');
            selectedAppointment = appt;
            updateMainActionButtonState(); // Enable start button
        });

        upcomingList.appendChild(el);
    });
}

function updateMainActionButtonState() {
    if (!mainActionButton) return;

    if (currentDoctorStatus === 'In Consultation') {
        // Button becomes "Finish"
        mainActionButton.textContent = "Finish Consultation"; // Or translation if available
        mainActionButton.style.backgroundColor = "#dc3545"; // Red
        mainActionButton.disabled = false;
    } else {
        // Button is "Start"
        mainActionButton.textContent = i18n.admin?.startButton || "Start Consultation";
        mainActionButton.style.backgroundColor = "#28a745"; // Green
        
        if (selectedAppointment) {
            mainActionButton.disabled = false;
        } else {
            mainActionButton.disabled = true; // Must select appointment first
        }
    }
}

// =================================================================
// --- ACTION HANDLERS ---
// =================================================================

async function onMainActionClick() {
    if (currentDoctorStatus === 'In Consultation') {
        // --- FINISH LOGIC ---
        const updateData = {
            status: "Available",
            displayCurrentAppointment: "---",
        };

        try {
            await db.collection('doctors').doc(currentDoctorDocId).update(updateData);
            currentDoctorStatus = "Available";
            Swal.fire('Finished', 'Consultation finished.', 'success');
            loadDoctorProfileAndAppointments(); // Refresh status and list
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'Could not finish consultation.', 'error');
        }

    } else {
        // --- START LOGIC ---
        if (!selectedAppointment) return;

        const startTime = new Date(selectedAppointment.start).toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE
        });
        const displayString = `${selectedAppointment.patientName} (${startTime})`;
        
        const updateData = {
            status: "In Consultation",
            displayCurrentAppointment: displayString
        };

        try {
            await db.collection('doctors').doc(currentDoctorDocId).update(updateData);
            currentDoctorStatus = "In Consultation";
            Swal.fire(i18n.admin?.bookingSuccessTitle, i18n.admin?.consultationStartSuccess || 'Started!', 'success');
            
            selectedAppointment = null;
            updateMainActionButtonState();
            // Optionally refresh list to visually update selection
            loadUpcomingAppointments();
        } catch (e) {
            console.error(e);
            Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.consultationStartError || 'Error starting.', 'error');
        }
    }
}

// --- Manual Status Handlers ---
function onManualStatusClick(event) {
    const btn = event.target.closest('button[data-status]');
    if (!btn) return;
    
    // Visually select
    const btns = manualStatusButtonsContainer.querySelectorAll('button');
    btns.forEach(b => {
        b.classList.remove('selected');
        b.style.border = '1px solid #ccc';
    });
    btn.classList.add('selected');
    btn.style.border = '2px solid black';
    
    selectedStatus = btn.dataset.status;
}

async function onManualUpdateClick() {
    if (!selectedStatus) {
        Swal.fire('Warning', i18n.admin?.validationStatus, 'warning');
        return;
    }
    
    if (manualUpdateButton) {
        manualUpdateButton.disabled = true;
        manualUpdateButton.textContent = i18n.admin?.updatingStatusButton;
    }

    try {
        await db.collection('doctors').doc(currentDoctorDocId).update({
            status: selectedStatus
        });
        currentDoctorStatus = selectedStatus;
        updateMainActionButtonState(); 
        Swal.fire(i18n.admin?.bookingSuccessTitle, i18n.admin?.statusUpdateSuccess, 'success');
    } catch (e) {
        console.error(e);
        Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.statusUpdateError, 'error');
    } finally {
        if (manualUpdateButton) {
            manualUpdateButton.disabled = false;
            manualUpdateButton.textContent = i18n.admin?.updateStatusButton;
        }
    }
}


// =================================================================
// --- AUTH & HELPERS (Existing) ---
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
function handleTabClick(event) {
    const clickedTab = event.target;
    tabStatus.classList.remove('active'); tabCalendar.classList.remove('active'); tabSettings.classList.remove('active');
    panelStatus.classList.remove('active'); panelCalendar.classList.remove('active'); panelSettings.classList.remove('active');
    if (clickedTab.id === 'tab-status') { 
        tabStatus.classList.add('active'); panelStatus.classList.add('active'); 
        loadDoctorProfileAndAppointments(); // Refresh UI data
    }
    else if (clickedTab.id === 'tab-calendar') { tabCalendar.classList.add('active'); panelCalendar.classList.add('active'); if (calendar) calendar.render(); }
    else if (clickedTab.id === 'tab-settings') { tabSettings.classList.add('active'); panelSettings.classList.add('active'); }
}

// ... (Initialize Calendar Function - Unchanged logic, fully included) ...
function initializeCalendar(uid) {
    if (calendar) return;
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
        editable: false, selectable: true, timeZone: MEXICO_TIMEZONE,
        dateClick: function(clickInfo) { 
             const startDate = clickInfo.date;
             const startTimeFormatted = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE });
             Swal.fire({
                title: (i18n.admin?.bookAppointmentTitle || 'Book {time}').replace('{time}', startTimeFormatted),
                width: '600px',
                html: `<div><span class="swal2-label">${i18n.admin?.patientNameLabel}</span><input id="swal-input-name" class="swal2-input"><span class="swal2-label">${i18n.admin?.phoneLabel}</span><input id="swal-input-phone" class="swal2-input" type="tel"><span class="swal2-label">${i18n.admin?.durationLabel}</span><div id="swal-duration-buttons"><button class="swal2-confirm swal2-styled duration-button" data-duration="30">30 min</button><button class="swal2-confirm swal2-styled duration-button" data-duration="45">45 min</button><button class="swal2-confirm swal2-styled duration-button" data-duration="60">1 hour</button><button class="swal2-confirm swal2-styled duration-button" data-duration="90">1:30</button></div></div>`,
                confirmButtonText: i18n.admin?.bookButton, focusConfirm: false,
                didOpen: () => {
                    const buttons = document.querySelectorAll('#swal-duration-buttons .duration-button');
                    buttons.forEach(btn => btn.addEventListener('click', () => { buttons.forEach(b => b.style.border='none'); btn.style.border='2px solid blue'; document.getElementById('swal-duration-buttons').dataset.selectedDuration = btn.dataset.duration; }));
                    const defBtn = document.querySelector('#swal-duration-buttons .duration-button[data-duration="30"]'); if(defBtn) defBtn.click();
                },
                preConfirm: () => {
                    const name = document.getElementById('swal-input-name').value;
                    const phone = document.getElementById('swal-input-phone').value;
                    const dur = document.getElementById('swal-duration-buttons').dataset.selectedDuration;
                    const phoneRegex = /^\d{10}$/;
                    if(!name) { Swal.showValidationMessage(i18n.admin?.validationName); return false; }
                    if(!phone) { Swal.showValidationMessage(i18n.admin?.validationPhone); return false; }
                    if(!phoneRegex.test(phone)) { Swal.showValidationMessage(i18n.admin?.validationPhoneDigits); return false; }
                    if(!dur) { Swal.showValidationMessage(i18n.admin?.validationDuration); return false; }
                    return {name, phone, duration: parseInt(dur)};
                }
             }).then(async (res) => {
                 if(res.isConfirmed && res.value) {
                     const end = new Date(startDate.getTime() + res.value.duration * 60000);
                     try {
                        const q = await db.collection('appointments').where('doctorId','==',uid).where('start','<',end.toISOString()).where('end','>',startDate.toISOString()).get();
                        if(!q.empty) { Swal.fire('Error', i18n.admin?.overlapErrorText, 'warning'); return; }
                     } catch(e) { /* ignore index error for simplicity in fallback */ }
                     
                     db.collection('appointments').add({
                         doctorId: uid, patientName: res.value.name, patientPhone: res.value.phone,
                         start: startDate.toISOString(), end: end.toISOString()
                     }).then(() => Swal.fire(i18n.admin?.bookingSuccessTitle, '', 'success'));
                 }
             });
        },
        eventClick: function(clickInfo) {
             Swal.fire({
                 title: i18n.admin?.deleteConfirmTitle, text: (i18n.admin?.deleteConfirmText || '').replace('{patient}', clickInfo.event.title), showCancelButton: true, confirmButtonText: i18n.admin?.deleteButton
             }).then(res => {
                 if(res.isConfirmed) db.collection('appointments').doc(clickInfo.event.id).delete().then(() => Swal.fire(i18n.admin?.deleteSuccessTitle, '', 'success'));
             });
        }
    });
    calendar.render();
    if (appointmentsListener) appointmentsListener();
    appointmentsListener = db.collection('appointments').where('doctorId', '==', uid).onSnapshot(snap => {
        const events = snap.docs.map(d => ({id: d.id, title: d.data().patientName, start: d.data().start, end: d.data().end}));
        calendar.setOption('events', events);
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

// New Action Listeners
if (mainActionButton) mainActionButton.addEventListener('click', onMainActionClick);
if (manualStatusButtonsContainer) manualStatusButtonsContainer.addEventListener('click', onManualStatusClick);
if (manualUpdateButton) manualUpdateButton.addEventListener('click', onManualUpdateClick);

// =================================================================
// --- Start ---
// =================================================================
initializeAdmin();
