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
const db = firebase.firestore();

// STEP 3: Get references
const boardContainer = document.getElementById('board-container');
const mainTitleElement = document.getElementById('main-title-h1');

// --- Global variables ---
let useCardView = true; // Default
let i18n = {}; // Will hold the selected language texts
let allTexts = {}; // Will hold the entire texts.json

/**
 * Fetches all text strings from the JSON file.
 */
async function fetchTexts() {
    try {
        const response = await fetch('texts.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allTexts = await response.json();
        console.log("Texts loaded successfully.");
    } catch (error) {
        console.error("Error fetching texts.json:", error);
        // Set fallback texts
        allTexts = {
            EN: {
                global: { mainTitle: "Doctor Appointments", loading: "Loading...", errorLoading: "Error.", noDoctors: "No doctors.", currentLabel: "Current:", nextLabel: "Next:", officeLabel: "Office:", noStatus: "N/A", unnamedDoctor: "Doctor", noSpecialty: "N/A" },
                display: { headerDoctor: "Doctor", headerSpecialty: "Specialty", headerCurrent: "Current", headerStatus: "Status", headerOffice: "Office", headerNext: "Next" }
            },
            ES: {
                global: { mainTitle: "Citas Médicas", loading: "Cargando...", errorLoading: "Error.", noDoctors: "No doctores.", currentLabel: "Actual:", nextLabel: "Siguiente:", officeLabel: "Consultorio:", noStatus: "N/A", unnamedDoctor: "Doctor", noSpecialty: "N/A" },
                display: { headerDoctor: "Doctor", headerSpecialty: "Especialidad", headerCurrent: "Actual", headerStatus: "Estatus", headerOffice: "Consultorio", headerNext: "Siguiente" }
            }
        };
         if (mainTitleElement) mainTitleElement.textContent = "Doctor Appointments";
    }
}

/**
 * Fetches settings, sets language, applies texts, and starts listeners.
 */
async function initializeDisplay() {
    // 1. Fetch all text strings
    await fetchTexts();

    let lang = "EN"; // Default language
    try {
        // 2. Fetch view and language settings
        const docRef = db.collection("settings").doc("displayConfig");
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const settings = docSnap.data();
            useCardView = settings.card_view === true;
            lang = settings.language || "EN";
        } else {
            console.warn("Display config document not found. Using defaults.");
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
    }

    // 3. Set the active language object (i18n)
    // Default to EN if the language code doesn't exist
    i18n = allTexts[lang.toUpperCase()] || allTexts.EN;
    console.log(`View: ${useCardView ? 'Card' : 'Row'}, Language: ${lang}`);

    // 4. Apply static texts
    applyStaticTexts();

    // 5. Start the real-time listener
    listenForDoctorUpdates();
}

/**
 * Applies all static text to the page.
 */
function applyStaticTexts() {
    if (mainTitleElement && i18n.global) {
        mainTitleElement.textContent = i18n.global.mainTitle || "Doctor Appointments";
    }
    document.title = i18n.global?.mainTitle || "Doctor Status Board";
}

/**
 * Applies the correct CSS class to the board container.
 */
function applyLayoutClass() {
    boardContainer.classList.remove('card-layout', 'row-layout');
    boardContainer.classList.add(useCardView ? 'card-layout' : 'row-layout');
}

/**
 * Listens for real-time updates and renders the UI.
 */
function listenForDoctorUpdates() {
    boardContainer.innerHTML = `<p class="loading-message">${i18n.global?.loading || 'Loading...'}</p>`;

    // This log will now be useful after you apply Fix 2!
    console.log("Setting up listener. Are allTexts loaded?", allTexts);

    db.collection('doctors').onSnapshot(snapshot => {
        applyLayoutClass();
        boardContainer.innerHTML = ''; // Clear container

        if (snapshot.empty) {
            boardContainer.innerHTML = `<p class="loading-message">${i18n.global?.noDoctors || 'No doctors found.'}</p>`;
            return;
        }

        // Add Header Row for Row Layout
        if (!useCardView) {
            const headerHtml = `
                 <div class="board-header doctor-row">
                     <div class="doctor-cell cell-name">${i18n.display?.headerDoctor || 'Doctor'}</div>
                     <div class="doctor-cell cell-specialty">${i18n.display?.headerSpecialty || 'Specialty'}</div>
                     <div class="doctor-cell cell-current">${i18n.display?.headerCurrent || 'Current'}</div>
                     <div class="doctor-cell cell-status">${i18n.display?.headerStatus || 'Status'}</div>
                     <div class="doctor-cell cell-office">${i18n.display?.headerOffice || 'Office'}</div>
                     <div class="doctor-cell cell-next">${i18n.display?.headerNext || 'Next'}</div>
                 </div>
             `;
            boardContainer.innerHTML = headerHtml;
        }

        const itemsHtmlArray = [];
        console.log(`--- NEW UPDATE: Found ${snapshot.docs.length} doctors ---`);

        snapshot.forEach(doc => {
            const doctor = doc.data();
            const doctorId = doc.id;
	    
	    // --- NEW: Check for 'hide' flag ---
            // If hide is strictly true, skip this doctor
            if (doctor.hide === true) {
                return; // Skip to next iteration
            }
            // --- END NEW CHECK ---

            // --- START: Corrected Dynamic Logic Block ---
            let statusClass = 'available'; // Default to 'available' (green)
            let displayStatus = doctor.status; // Get the raw, translated status (e.g., "En Consulta")
            
            // This console.log is for debugging
            console.log(`DOCTOR: ${doctor.displayName || 'Unnamed'}. DB Status: "${doctor.status}"`);

            if (doctor.status) {
                // Status exists in the database
                
                // 1. We check the status against ALL known translations from allTexts
                // (This will work after you apply Fix 2)
                if (doctor.status === allTexts.EN.global?.statusInConsultation || 
                    doctor.status === allTexts.ES.global?.statusInConsultation) {
                    statusClass = 'consultation'; // Blue
                } 
                else if (doctor.status === allTexts.EN.global?.statusDelayed || 
                         doctor.status === allTexts.ES.global?.statusDelayed) {
                    statusClass = 'delayed'; // Yellow
                } 
                else if (doctor.status === allTexts.EN.global?.statusNotAvailable || 
                         doctor.status === allTexts.ES.global?.statusNotAvailable) {
                    statusClass = 'unavailable'; // Red
                } 
                else if (doctor.status === allTexts.EN.global?.statusAvailable || 
                         doctor.status === allTexts.ES.global?.statusAvailable) {
                    statusClass = 'available'; // Green
                }
                
                // 2. Fallback logic for OLD statuses (if they still exist in your DB)
                else {
                    console.log(`  WARN: Status "${doctor.status}" did not match new translations. Trying old fallback.`);
                    const lowerCaseStatus = doctor.status.toLowerCase();
                    if (lowerCaseStatus.includes('on time') || lowerCaseStatus.includes('go ahead')) {
                        statusClass = 'available';
                    } else if (lowerCaseStatus.includes('away') || lowerCaseStatus.includes('finished') || lowerCaseStatus.includes('not available')) {
                        statusClass = 'unavailable';
                    } else if (lowerCaseStatus.includes('delay')) { // Catches "15m Delay"
                        statusClass = 'delayed';
                    }
                }

            } else {
                 // If no status is set at all (doctor.status is null or empty)
                 displayStatus = i18n.global?.noStatus || 'No Status';
                 statusClass = 'available'; // Default to green
                 console.log(`  WARN: No status found in DB.`);
            }
            // --- END: Corrected Dynamic Logic Block ---

            // This console.log is for debugging
            console.log(`  FINAL CLASS: "${statusClass}"`);

            let displayCurrent = doctor.displayCurrentAppointment || doctor.autoCurrentAppointment || '---';
            let displayNext = doctor.displayNextAppointment || doctor.autoNextAppointment || '---';

            let itemHtml = '';
            if (useCardView) {
                // --- CARD HTML ---
                itemHtml = `
                    <div class="doctor-card ${statusClass}" data-id="${doctorId}">
                        <h2>${doctor.displayName || i18n.global?.unnamedDoctor}</h2>
                        <p class="specialty">${doctor.specialty || i18n.global?.noSpecialty}</p>
                        <p class="status ${statusClass}">${displayStatus}</p>
                        <div class="appointment-info">
                            <strong>${i18n.global?.officeLabel}</strong> ${doctor.officeNumber || i18n.global?.notApplicable}
                        </div>
                        <div class="appointment-info">
                            <strong>${i18n.global?.currentLabel}</strong> ${displayCurrent}
                        </div>
                        <div class="appointment-info">
                            <strong>${i18n.global?.nextLabel}</strong> ${displayNext}
                        </div>
                    </div>
                `;
            } else {
                // --- ROW HTML ---
                itemHtml = `
                    <div class="doctor-row ${statusClass}" data-id="${doctorId}">
                         <div class="doctor-cell cell-name">${doctor.displayName || i18n.global?.unnamedDoctor}</div>
                         <div class="doctor-cell cell-specialty">${doctor.specialty || i18n.global?.noSpecialty}</div>
                         <div class="doctor-cell cell-current">${displayCurrent}</div>
                         <div class="doctor-cell cell-status">
                             <p class="status ${statusClass}">${displayStatus}</p>
                         </div>
                         <div class="doctor-cell cell-office">${doctor.officeNumber || i18n.global?.notApplicable}</div>
                         <div class="doctor-cell cell-next">${displayNext}</div>
                    </div>
                `;
            }
            itemsHtmlArray.push(itemHtml);
        }); // End forEach

        if (!useCardView) {
            boardContainer.innerHTML += itemsHtmlArray.join('');
        } else {
            boardContainer.innerHTML = itemsHtmlArray.join('');
        }

    }, error => {
        console.error("Error fetching doctor data:", error);
        boardContainer.className = '';
        boardContainer.innerHTML = `<p class="loading-message">${i18n.global?.errorLoading}</p>`;
    });
} // End listenForDoctorUpdates

// --- Start the application ---
initializeDisplay(); // Single entry point
