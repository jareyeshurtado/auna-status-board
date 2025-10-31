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
            }
        };
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
    if (mainTitleElement) {
        mainTitleElement.textContent = i18n.global?.mainTitle || "Doctor Appointments";
    }
    // Any other static text elements on index.html would be set here.
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
                     <div class="doctor-cell cell-name">${i18n.display?.headerDoctor}</div>
                     <div class="doctor-cell cell-specialty">${i18n.display?.headerSpecialty}</div>
                     <div class="doctor-cell cell-current">${i18n.display?.headerCurrent}</div>
                     <div class="doctor-cell cell-status">${i18n.display?.headerStatus}</div>
                     <div class="doctor-cell cell-office">${i18n.display?.headerOffice}</div>
                     <div class="doctor-cell cell-next">${i18n.display?.headerNext}</div>
                 </div>
             `;
            boardContainer.innerHTML = headerHtml;
        }

        const itemsHtmlArray = [];
        snapshot.forEach(doc => {
            const doctor = doc.data();
            const doctorId = doc.id;

            let statusClass = 'available'; // Default to 'available' (green)
            let displayStatus = doctor.status || i18n.global?.noStatus;
            
            if (doctor.status) {
                const lowerCaseStatus = doctor.status.toLowerCase();

                // New logic for new statuses
                if (lowerCaseStatus.includes('in consultation')) {
                    statusClass = 'consultation'; // Blue
                } else if (lowerCaseStatus.includes('delayed')) {
                    statusClass = 'delayed'; // Yellow
                }  else if (lowerCaseStatus.includes('not available')) {
                    statusClass = 'unavailable'; // Red
                } else if (lowerCaseStatus.includes('available')) {
                    statusClass = 'available'; // Green
                }
                
                // Fallback logic for old statuses (maps them to new colors)
                else if (lowerCaseStatus.includes('on time') || lowerCaseStatus.includes('go ahead')) {
                    statusClass = 'available'; // Green
                } else if (lowerCaseStatus.includes('away') || lowerCaseStatus.includes('finished')) {
                    statusClass = 'unavailable'; // Red
                }
            }

            let displayCurrent = doctor.displayCurrentAppointment || doctor.autoCurrentAppointment || '---';
            let displayNext = doctor.displayNextAppointment || doctor.autoNextAppointment || '---';

            let itemHtml = '';
            if (useCardView) {
                // --- CARD HTML ---
                itemHtml = `
                    <div class="doctor-card status-${statusClass}" data-id="${doctorId}">
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
                    <div class="doctor-row status-${statusClass}" data-id="${doctorId}">
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
