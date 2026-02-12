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

// --- Status Panel Elements ---
const upcomingList = document.getElementById('upcoming-appointments-list');
const mainActionButton = document.getElementById('main-action-button');
const callAgainButton = document.getElementById('call-again-button');
const upcomingLabel = document.getElementById('upcoming-label'); 
const manualStatusLabel = document.getElementById('manual-status-label'); 

// --- Manual Status Buttons ---
const manualStatusButtonsContainer = document.getElementById('status-buttons');
const manualUpdateButton = document.getElementById('manual-update-button'); 
const updateMessage = document.getElementById('update-message');

// --- Settings Panel elements ---
const settingsTitleH3 = document.getElementById('settings-title-h3');
const multiDoctorContainer = document.getElementById('multi-doctor-container');
const multiDoctorSelect = document.getElementById('multi-doctor-select');
const multiDoctorMessage = document.getElementById('multi-doctor-message');
const selectDoctorLabel = document.getElementById('select-doctor-label');
const scheduleTitle = document.getElementById('schedule-title');
const scheduleContainer = document.getElementById('schedule-container');
const copyScheduleBtn = document.getElementById('copy-schedule-btn');
const vacationTitle = document.getElementById('vacation-title');
const vacationLabel = document.getElementById('vacation-label');
const vacationPicker = document.getElementById('vacation-date-picker');
const addVacationBtn = document.getElementById('add-vacation-btn');
const vacationList = document.getElementById('vacation-list');
const saveSettingsBtn = document.getElementById('save-settings-btn');
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
let selectedAppointment = null; 
let currentDoctorStatus = ''; 
let currentConsultationApptId = null;
let doctorSchedule = {}; // Stores the 7-day structure
let doctorVacations = []; // Stores array of 'YYYY-MM-DD' 

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
	if (selectDoctorLabel) selectDoctorLabel.textContent = i18n.admin?.selectDoctorLabel || "Active Doctor Profile:";
	if (scheduleTitle) scheduleTitle.textContent = i18n.admin?.scheduleTitle || "Work Schedule";
    if (vacationTitle) vacationTitle.textContent = i18n.admin?.vacationTitle || "Vacations";
    if (vacationLabel) vacationLabel.textContent = i18n.admin?.vacationLabel || "Pick date:";
    if (addVacationBtn) addVacationBtn.textContent = i18n.admin?.addVacationButton || "Block";
    if (saveSettingsBtn) saveSettingsBtn.textContent = i18n.admin?.saveSettingsButton || "Save Settings";
    if (copyScheduleBtn) copyScheduleBtn.textContent = i18n.admin?.copyToAll || "Copy Mon to All";
    if (changePasswordButton) changePasswordButton.textContent = i18n.admin?.changePasswordButton || "Change Password";

    if (upcomingLabel) upcomingLabel.textContent = i18n.admin?.nextAppointmentTitle || "Select Next Patient";
    if (manualStatusLabel) manualStatusLabel.textContent = i18n.admin?.setStatusLabel || "Manual Status Override";
    
    // Check if we need to update the button text dynamically based on selection/status
    // This is handled in updateMainActionButtonState, but defaults can be set here
    
    if (manualStatusButtonsContainer) {
        const btnAvailable = manualStatusButtonsContainer.querySelector('button[data-status="Available"]');
        if (btnAvailable) btnAvailable.textContent = i18n.admin?.statusAvailable || "Available";
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
	if (callAgainButton) callAgainButton.textContent = i18n.admin?.callAgainButton || "Call Again";
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
                    loadDoctorProfileAndAppointments(); 
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
            currentConsultationApptId = localStorage.getItem('currentConsultationApptId'); // Try to recover if page reloaded
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
			
			doctorSchedule = data.workingSchedule || getDefaultSchedule();
            doctorVacations = data.vacations || [];
            
            renderScheduleBuilder();
            renderVacationList();
            
			if (data.multipleUsers === true) {
                setupMultiDoctorDropdown(data);
            } else {
                if (multiDoctorContainer) multiDoctorContainer.style.display = 'none';
            }
			
            if (currentDoctorStatus === 'In Consultation') {
                 currentConsultationApptId = localStorage.getItem('currentConsultationApptId');
            } else {
                 // If not in consultation, ensure ID is cleared
                 currentConsultationApptId = null;
                 localStorage.removeItem('currentConsultationApptId');
            }
            
            updateMainActionButtonState(); 
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
            
            // FILTER 1: Is it in the future (or current)?
            // FILTER 2: Is it NOT completed?
            if (endMs > nowMs && data.status !== 'completed') {
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
        mainActionButton.textContent = i18n.admin?.finishButton || "Finish Consultation";
        mainActionButton.style.backgroundColor = "#D32F2F"; // Red
        mainActionButton.disabled = false;
		
		if (callAgainButton) callAgainButton.style.display = 'block';
    } else {
        mainActionButton.textContent = i18n.admin?.startButton || "Start Consultation";
        mainActionButton.style.backgroundColor = "#5C9458"; // Green
		
		if (callAgainButton) callAgainButton.style.display = 'none';
        
        if (selectedAppointment) {
            mainActionButton.disabled = false;
        } else {
            mainActionButton.disabled = true; 
        }
    }
}

async function onCallAgainClick() {
    if (!currentDoctorDocId) return;

    // Disable briefly to prevent spam
    callAgainButton.disabled = true;
    
    try {
        // Update a specific field 'callAgainTrigger' with the current timestamp
        // This change is what display.js will detect!
        await db.collection('doctors').doc(currentDoctorDocId).update({
            callAgainTrigger: Date.now() 
        });
        
        // Optional: Small popup feedback
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: i18n.admin?.callAgainSent || 'Signal Sent' });

    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'Could not send signal.', 'error');
    } finally {
        setTimeout(() => callAgainButton.disabled = false, 2000);
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
            // 1. Update Doctor Status
            await db.collection('doctors').doc(currentDoctorDocId).update(updateData);
            
            // 2. NEW: Update Appointment Status to 'completed'
            // We use the ID stored when we started the consultation
            if (currentConsultationApptId) {
                await db.collection('appointments').doc(currentConsultationApptId).update({
                    status: 'completed'
                });
                // Clear the ID
                localStorage.removeItem('currentConsultationApptId');
                currentConsultationApptId = null;
            }

            currentDoctorStatus = "Available";
            Swal.fire('Finished', 'Consultation finished.', 'success');
            loadUpcomingAppointments(); // This will re-fetch, and the 'completed' logic will filter it out!
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
		
		const patientInitials = getInitials(selectedAppointment.patientName);
        const displayString = `${patientInitials} (${startTime})`;
        
        const updateData = {
            status: "In Consultation",
            displayCurrentAppointment: displayString
        };

        try {
            await db.collection('doctors').doc(currentDoctorDocId).update(updateData);
            
            // NEW: Store the ID of this appointment so we can finish it later
            currentConsultationApptId = selectedAppointment.id;
            localStorage.setItem('currentConsultationApptId', currentConsultationApptId); // Persist through refresh

            currentDoctorStatus = "In Consultation";
            Swal.fire(i18n.admin?.bookingSuccessTitle, i18n.admin?.consultationStartSuccess || 'Started!', 'success');
            
            selectedAppointment = null;
            updateMainActionButtonState();
            loadUpcomingAppointments(); // Refresh list immediately
        } catch (e) {
            console.error(e);
            Swal.fire(i18n.admin?.bookingErrorTitle, i18n.admin?.consultationStartError || 'Error starting.', 'error');
        }
    }
}

// --- Manual Status Handlers (Unchanged) ---
function onManualStatusClick(event) {
    const btn = event.target.closest('button[data-status]');
    if (!btn) return;
    
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
// --- EVENT LISTENERS ---
// =================================================================
loginButton.addEventListener('click', onLoginClick);
signOutButton.addEventListener('click', onSignOutClick);
changePasswordButton.addEventListener('click', onChangePasswordClick);
tabStatus.addEventListener('click', handleTabClick);
tabCalendar.addEventListener('click', handleTabClick);
tabSettings.addEventListener('click', handleTabClick);

if (mainActionButton) mainActionButton.addEventListener('click', onMainActionClick);
if (manualStatusButtonsContainer) manualStatusButtonsContainer.addEventListener('click', onManualStatusClick);
if (manualUpdateButton) manualUpdateButton.addEventListener('click', onManualUpdateClick);
if (callAgainButton) callAgainButton.addEventListener('click', onCallAgainClick);

// =================================================================
// --- AUTH & HELPERS ---
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
        loadDoctorProfileAndAppointments(); 
    }
    else if (clickedTab.id === 'tab-calendar') { tabCalendar.classList.add('active'); panelCalendar.classList.add('active'); if (calendar) calendar.render(); }
    else if (clickedTab.id === 'tab-settings') { tabSettings.classList.add('active'); panelSettings.classList.add('active'); }
}

function initializeCalendar(uid) {
    if (calendar) return;

    // 1. Convert Doctor Schedule to FullCalendar "businessHours" format
    const businessHours = [];
    let minTime = "24:00"; // Start late, find earlier
    let maxTime = "00:00"; // Start early, find later

    // Iterate 0 (Sun) to 6 (Sat)
    for (let i = 0; i < 7; i++) {
        const dayData = doctorSchedule[i];
        if (dayData && dayData.active && dayData.slots) {
            dayData.slots.forEach(slot => {
                businessHours.push({
                    daysOfWeek: [i], // 0=Sun, 1=Mon...
                    startTime: slot.start,
                    endTime: slot.end
                });

                // Calculate bounds for zoom
                if (slot.start < minTime) minTime = slot.start;
                if (slot.end > maxTime) maxTime = slot.end;
            });
        }
    }

    // Default fallback if no schedule exists
    if (businessHours.length === 0) {
        minTime = "08:00";
        maxTime = "20:00";
    }

    // Add padding to hours (e.g. show 1 hour before start and 1 hour after end)
    // Simple string manipulation logic or MomentJS could handle this
    // For simplicity, we just use the raw values or hardcode slight buffers if desired.

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
        timeZone: MEXICO_TIMEZONE,
        
        // --- NEW CONFIGURATION ---
        businessHours: businessHours, // Grays out non-working hours
        selectConstraint: "businessHours", // Prevents clicking gray areas
        slotMinTime: minTime, // Zooms the calendar view
        slotMaxTime: maxTime, // Zooms the calendar view
        firstDay: 1, // Start week on Monday
        // -------------------------

        editable: false, 
        selectable: true, 
        
        // Handle clicking a date (Check Vacations)
        dateClick: function(clickInfo) { 
             const dateStr = clickInfo.dateStr.split('T')[0]; // YYYY-MM-DD
             
             // CHECK VACATION
             if (doctorVacations.includes(dateStr)) {
                 Swal.fire('Vacation', i18n.admin?.vacationBlocked || "Doctor is on vacation.", 'warning');
                 return;
             }
             
             // ... (Keep your existing dateClick logic here) ...
             // Be sure to check your previous code and paste the Swal/Booking logic back here!
             // Just copy the 'const startDate = ...' block from your old file.
             const startDate = clickInfo.date;
             const startTimeFormatted = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: MEXICO_TIMEZONE });
             
             // [PASTE YOUR EXISTING BOOKING MODAL CODE HERE]
             // For brevity in this response, I am assuming you keep the modal code.
             promptBooking(clickInfo, uid); // I moved the modal to a helper function below
        },
        
        eventClick: function(clickInfo) {
             // ... (Keep existing delete logic) ...
             confirmDelete(clickInfo);
        },

        // Render Vacations as Background Events
        events: function(info, successCallback, failureCallback) {
            // 1. Fetch Appointments
            db.collection('appointments')
                .where('doctorId', '==', uid)
                .where('start', '>=', info.start.toISOString())
                .where('end', '<=', info.end.toISOString())
                .get()
                .then(snap => {
                    const events = snap.docs.map(d => ({
                        id: d.id, 
                        title: d.data().patientName, 
                        start: d.data().start, 
                        end: d.data().end
                    }));

                    // 2. Add Vacation Backgrounds
                    doctorVacations.forEach(vDate => {
                        events.push({
                            start: vDate,
                            end: vDate,
                            display: 'background',
                            color: '#ff9f89', // Reddish background
                            allDay: true
                        });
                    });

                    successCallback(events);
                })
                .catch(e => failureCallback(e));
        }
    });
    calendar.render();
}

// Helper to keep code clean: The Booking Prompt
function promptBooking(clickInfo, uid) {
    const startDate = clickInfo.date;
    const startTimeFormatted = startDate.toLocaleTimeString("en-US", { 
        hour: "2-digit", 
        minute: "2-digit", 
        hour12: true, 
        timeZone: MEXICO_TIMEZONE 
    });
     
    Swal.fire({
        title: (i18n.admin?.bookAppointmentTitle || 'Book {time}').replace('{time}', startTimeFormatted),
        width: '600px',
        html: `<div>
            <span class="swal2-label">${i18n.admin?.patientNameLabel}</span>
            <input id="swal-input-name" class="swal2-input">
            <span class="swal2-label">${i18n.admin?.phoneLabel}</span>
            <input id="swal-input-phone" class="swal2-input" type="tel">
            <span class="swal2-label">${i18n.admin?.durationLabel}</span>
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
            buttons.forEach(btn => btn.addEventListener('click', () => { 
                buttons.forEach(b => b.style.border='none'); 
                btn.style.border='2px solid blue'; 
                document.getElementById('swal-duration-buttons').dataset.selectedDuration = btn.dataset.duration; 
            }));
            const defBtn = document.querySelector('#swal-duration-buttons .duration-button[data-duration="30"]'); 
            if(defBtn) defBtn.click();
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
                // Optional: Check for overlapping appointments locally before sending
                // (This is a basic check, the server rules might also block it)
                const q = await db.collection('appointments')
                    .where('doctorId','==',uid)
                    .where('start','<',end.toISOString())
                    .where('end','>',startDate.toISOString())
                    .get();
                
                if(!q.empty) { 
                    Swal.fire('Error', i18n.admin?.overlapErrorText || "Overlap detected", 'warning'); 
                    return; 
                }
            } catch(e) { console.error("Overlap check skipped", e); }

            db.collection('appointments').add({
                doctorId: uid, 
                patientName: res.value.name, 
                patientPhone: res.value.phone,
                start: startDate.toISOString(), 
                end: end.toISOString()
            }).then(() => Swal.fire(i18n.admin?.bookingSuccessTitle, '', 'success'));
        }
    });
}

// Helper: Confirm Delete (Your existing logic)
function confirmDelete(clickInfo) {
    // Note: Don't allow deleting background events (Vacations)
    if (clickInfo.event.display === 'background') return;

    Swal.fire({
         title: i18n.admin?.deleteConfirmTitle, 
         text: (i18n.admin?.deleteConfirmText || '').replace('{patient}', clickInfo.event.title), 
         showCancelButton: true, 
         confirmButtonText: i18n.admin?.deleteButton
    }).then(res => {
         if(res.isConfirmed) db.collection('appointments').doc(clickInfo.event.id).delete()
            .then(() => {
                clickInfo.event.remove(); // Remove visually immediately
                Swal.fire(i18n.admin?.deleteSuccessTitle, '', 'success');
            });
    });
}
function getInitials(name) {
    if (!name) return "";
    return name
        .trim()              // Remove extra spaces around the name
        .split(/\s+/)        // Split by spaces (handles single or multiple spaces)
        .map(word => word[0].toUpperCase()) // Take the first letter of each word
        .join('');           // Join them together
}

/**
 * NEW: Populates the dropdown if multipleUsers is true
 */
function setupMultiDoctorDropdown(data) {
    if (!multiDoctorContainer || !multiDoctorSelect) return;

    // 1. Show Container
    multiDoctorContainer.style.display = 'block';
    
    // 2. Find all fields starting with "doctorDisplayOption"
    // Example: doctorDisplayOption1, doctorDisplayOption2, ...
    const options = [];
    Object.keys(data).forEach(key => {
        if (key.startsWith('doctorDisplayOption')) {
            options.push({
                key: key,
                name: data[key]
            });
        }
    });

    // 3. Sort options naturally (1, 2, 3...) based on the key
    options.sort((a, b) => {
        // Extract number from "doctorDisplayOption10" -> 10
        const numA = parseInt(a.key.replace('doctorDisplayOption', '')) || 0;
        const numB = parseInt(b.key.replace('doctorDisplayOption', '')) || 0;
        return numA - numB;
    });

    // 4. Populate Select
    multiDoctorSelect.innerHTML = '';
    
    // Add default/placeholder if needed, or just the list
    options.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt.name; // We save the NAME directly as the value
        el.textContent = opt.name;
        multiDoctorSelect.appendChild(el);
    });

    // 5. Select the current displayName (if it matches one of the options)
    if (data.displayName) {
        multiDoctorSelect.value = data.displayName;
    }
    
    // 6. Remove old listeners to avoid duplicates (cloning is a quick hack)
    const newSelect = multiDoctorSelect.cloneNode(true);
    multiDoctorSelect.parentNode.replaceChild(newSelect, multiDoctorSelect);
    
    // 7. Add Change Listener (Auto-Save)
    newSelect.addEventListener('change', async (e) => {
        const newName = e.target.value;
        const msgEl = document.getElementById('multi-doctor-message'); // Re-get fresh ref
        
        msgEl.textContent = i18n.admin?.updatingStatusButton || "Updating...";
        msgEl.style.color = "#666";

        try {
            await db.collection('doctors').doc(currentDoctorDocId).update({
                displayName: newName
            });
            msgEl.textContent = (i18n.admin?.doctorChangedSuccess || "Updated to: ") + newName;
            msgEl.style.color = "green";
            
            // Optional: Clear success message after 3 seconds
            setTimeout(() => { msgEl.textContent = ''; }, 3000);
            
        } catch (error) {
            console.error(error);
            msgEl.textContent = i18n.admin?.doctorUpdateError || "Error updating.";
            msgEl.style.color = "red";
        }
    });
}
/** Helper: Default 9-5 Mon-Fri if nothing exists */
function getDefaultSchedule() {
    const s = {};
    for(let i=0; i<7; i++) {
        // 0=Sun, 6=Sat. Default Mon(1)-Fri(5) active
        s[i] = { 
            active: (i > 0 && i < 6), 
            slots: [{start: "09:00", end: "17:00"}] 
        };
    }
    return s;
}
// =================================================================
// --- SCHEDULE & VACATION LOGIC ---
// =================================================================

function renderScheduleBuilder() {
    if (!scheduleContainer) return;
    scheduleContainer.innerHTML = '';
    const days = i18n.admin?.days || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // 0=Sunday (FullCalendar standard) -> 6=Saturday
    for (let i = 0; i < 7; i++) {
        const dayData = doctorSchedule[i] || { active: false, slots: [] };
        
        const row = document.createElement('div');
        row.style.borderBottom = '1px solid #eee';
        row.style.padding = '10px 0';
        
        // Header: Checkbox + Day Name
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.marginBottom = '5px';
        
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = dayData.active;
        check.style.width = 'auto';
        check.style.marginRight = '10px';
        check.onchange = (e) => {
            doctorSchedule[i].active = e.target.checked;
            renderScheduleBuilder(); // Re-render to show/hide slots
        };

        const label = document.createElement('span');
        label.textContent = days[i];
        label.style.fontWeight = 'bold';
        if (!dayData.active) label.style.color = '#aaa';

        header.appendChild(check);
        header.appendChild(label);
        row.appendChild(header);

        // Slots Container
        if (dayData.active) {
            const slotsContainer = document.createElement('div');
            slotsContainer.style.marginLeft = '25px';
            
            dayData.slots.forEach((slot, index) => {
                const slotRow = document.createElement('div');
                slotRow.style.display = 'flex';
                slotRow.style.gap = '10px';
                slotRow.style.marginBottom = '5px';
                
                const startIn = document.createElement('input');
                startIn.type = 'time';
                startIn.value = slot.start;
                startIn.onchange = (e) => doctorSchedule[i].slots[index].start = e.target.value;

                const endIn = document.createElement('input');
                endIn.type = 'time';
                endIn.value = slot.end;
                endIn.onchange = (e) => doctorSchedule[i].slots[index].end = e.target.value;

                // Delete Slot Button
                const delBtn = document.createElement('button');
                delBtn.textContent = 'x';
                delBtn.style.backgroundColor = '#d9534f';
                delBtn.style.color = 'white';
                delBtn.style.border = 'none';
                delBtn.style.borderRadius = '4px';
                delBtn.style.width = '30px';
                delBtn.onclick = () => {
                    doctorSchedule[i].slots.splice(index, 1);
                    renderScheduleBuilder();
                };

                slotRow.appendChild(startIn);
                slotRow.appendChild(document.createTextNode(' - '));
                slotRow.appendChild(endIn);
                slotRow.appendChild(delBtn);
                slotsContainer.appendChild(slotRow);
            });

            // Add Slot Button
            const addBtn = document.createElement('button');
            addBtn.textContent = i18n.admin?.addSlot || "+ Add Hours";
            addBtn.className = "secondary-button";
            addBtn.style.fontSize = "0.8rem";
            addBtn.style.padding = "5px 10px";
            addBtn.style.marginTop = "5px";
            addBtn.onclick = () => {
                doctorSchedule[i].slots.push({ start: "09:00", end: "13:00" });
                renderScheduleBuilder();
            };
            
            slotsContainer.appendChild(addBtn);
            row.appendChild(slotsContainer);
        }

        scheduleContainer.appendChild(row);
    }
}

// "Copy Monday" Utility
if (copyScheduleBtn) {
    copyScheduleBtn.addEventListener('click', () => {
        const mon = doctorSchedule[1]; // Monday
        // Copy to Tue(2) - Fri(5)
        for (let i = 2; i <= 5; i++) {
            // Deep copy the object
            doctorSchedule[i] = JSON.parse(JSON.stringify(mon));
        }
        renderScheduleBuilder();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Copied!', showConfirmButton: false, timer: 1000 });
    });
}

// Vacation Logic
function renderVacationList() {
    if (!vacationList) return;
    vacationList.innerHTML = '';
    
    // Sort dates
    doctorVacations.sort();

    doctorVacations.forEach((dateStr, index) => {
        const tag = document.createElement('div');
        tag.style.backgroundColor = '#e0e0e0';
        tag.style.padding = '5px 10px';
        tag.style.borderRadius = '15px';
        tag.style.fontSize = '0.9rem';
        tag.style.display = 'flex';
        tag.style.alignItems = 'center';
        tag.style.gap = '8px';

        const span = document.createElement('span');
        span.textContent = dateStr;
        
        const x = document.createElement('span');
        x.textContent = '×';
        x.style.cursor = 'pointer';
        x.style.fontWeight = 'bold';
        x.style.color = '#d9534f';
        x.onclick = () => {
            doctorVacations.splice(index, 1);
            renderVacationList();
        };

        tag.appendChild(span);
        tag.appendChild(x);
        vacationList.appendChild(tag);
    });
}

if (addVacationBtn) {
    addVacationBtn.addEventListener('click', () => {
        const val = vacationPicker.value;
        if (!val) return;
        if (!doctorVacations.includes(val)) {
            doctorVacations.push(val);
            renderVacationList();
        }
        vacationPicker.value = '';
    });
}

// Save All Settings
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
        if (!currentDoctorDocId) return;
        saveSettingsBtn.disabled = true;
        saveSettingsBtn.textContent = i18n.admin?.updatingStatusButton || "Saving...";
        
        try {
            await db.collection('doctors').doc(currentDoctorDocId).update({
                workingSchedule: doctorSchedule,
                vacations: doctorVacations
            });
            Swal.fire('Success', i18n.admin?.settingsSaved || "Settings Saved", 'success');
            
            // Reload Calendar to apply changes
            if (calendar) {
                calendar.destroy();
                calendar = null;
                initializeCalendar(currentUser.uid);
            }
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'Could not save settings.', 'error');
        } finally {
            saveSettingsBtn.disabled = false;
            saveSettingsBtn.textContent = i18n.admin?.saveSettingsButton || "Save Settings";
        }
    });
}

// =================================================================
// --- Start ---
// =================================================================
initializeAdmin();
