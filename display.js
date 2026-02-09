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

const footerMessageElement = document.getElementById('footer-message');
const clockElement = document.getElementById('clock-display');

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
                global: { mainTitle: "Doctor Appointments", loading: "Loading...", errorLoading: "Error.", noDoctors: "No doctors.", currentLabel: "Current:", officeLabel: "Office:", noStatus: "N/A", unnamedDoctor: "Doctor", noSpecialty: "N/A" },
                display: { headerDoctor: "Doctor", headerSpecialty: "Specialty", headerCurrent: "Current", headerStatus: "Status", headerOffice: "Office" }
            },
            ES: {
                global: { mainTitle: "Citas Médicas", loading: "Cargando...", errorLoading: "Error.", noDoctors: "No doctores.", currentLabel: "Actual:", officeLabel: "Consultorio:", noStatus: "N/A", unnamedDoctor: "Doctor", noSpecialty: "N/A" },
                display: { headerDoctor: "Doctor", headerSpecialty: "Especialidad", headerCurrent: "Actual", headerStatus: "Estatus", headerOffice: "Consultorio" }
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
	startClock(); // NEW: Start the clock

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
	
	if (footerMessageElement && i18n.global) {
        footerMessageElement.textContent = i18n.global.footerMessage || "";
    }
	
    document.title = i18n.global?.mainTitle || "Doctor Status Board";
}

function startClock() {
    // FIX 2: Move the element selection INSIDE the function.
    // This prevents errors if the script runs before the HTML footer is ready.
    const clockElement = document.getElementById('clock-display');

    function update() {
        if (!clockElement) {
            console.warn("Clock element not found!");
            return;
        }
        
        const now = new Date();
        const timeString = now.toLocaleTimeString("en-US", {
            timeZone: "America/Mexico_City",
            hour: "2-digit", 
            minute: "2-digit",
            hour12: true
        });
        
        clockElement.textContent = timeString; 
    }
    
    update(); // Run immediately
    setInterval(update, 1000); // Update every second
}

/**
 * Applies the correct CSS class to the board container.
 */
function applyLayoutClass() {
    boardContainer.classList.remove('card-layout', 'row-layout');
    boardContainer.classList.add(useCardView ? 'card-layout' : 'row-layout');
}
// Global variable to store the previous state of doctors
let previousDoctorStates = {}; 
// Audio object (Replace URL with your own file if desired)
const alertSound = new Audio('beep.mp3'); 

function listenForDoctorUpdates() {
    boardContainer.innerHTML = `<p class="loading-message">${i18n.global?.loading || 'Loading...'}</p>`;

    db.collection('doctors').onSnapshot(snapshot => {
        applyLayoutClass();
        boardContainer.innerHTML = ''; // Clear container

        // [Header Row Logic for Row Layout - Omitted for brevity, keep existing if needed]

        const itemsHtmlArray = [];
        let shouldPlaySound = false; // Flag to check if we need to beep

        snapshot.forEach(doc => {
            const doctor = doc.data();
            const doctorId = doc.id;

            if (doctor.hide === true) return;

            // --- 1. DETERMINE STATUS & TRANSLATION (Your existing logic) ---
            const rawStatus = doctor.status || '';
            const lowerCaseStatus = rawStatus.toLowerCase();
            let statusClass = 'status-available';

            if (lowerCaseStatus === 'available') statusClass = 'status-available';
            else if (lowerCaseStatus === 'in consultation') statusClass = 'status-in-consultation';
            else if (lowerCaseStatus === 'consultation delayed') statusClass = 'status-consultation-delayed';
            else if (lowerCaseStatus === 'not available') statusClass = 'status-not-available';

            let displayStatus = rawStatus || i18n.global?.noStatus;
            if (lowerCaseStatus === 'available') displayStatus = i18n.global?.statusAvailable || "Available";
            else if (lowerCaseStatus === 'in consultation') displayStatus = i18n.global?.statusInConsultation || "In Consultation";
            else if (lowerCaseStatus === 'consultation delayed') displayStatus = i18n.global?.statusDelayed || "Delayed";
            else if (lowerCaseStatus === 'not available') displayStatus = i18n.global?.statusNotAvailable || "Not Available";

            let displayCurrent = doctor.displayCurrentAppointment || '---';

            // --- 2. DETECT CHANGE & TRIGGER FLASH ---
            let flashClass = '';
            
            // Check if we have history for this doctor
            if (previousDoctorStates[doctorId]) {
                const prev = previousDoctorStates[doctorId];
                
                // CRITERIA: Status changed TO "In Consultation" 
                // AND the appointment text changed (to avoid flashing on minor edits)
                if (lowerCaseStatus === 'in consultation' && 
                    (prev.status !== 'in consultation' || prev.current !== displayCurrent)) {
                    
                    flashClass = 'card-flash'; // Add CSS animation class
                    shouldPlaySound = true;    // Queue the sound
                }
            }

            // Update history for next time
            previousDoctorStates[doctorId] = {
                status: lowerCaseStatus,
                current: displayCurrent
            };

            // --- 3. RENDER CARD (Updated to include flashClass) ---
            let itemHtml = '';
            if (useCardView) {
                // Notice the ${flashClass} added to the div class list
                itemHtml = `
                    <div class="doctor-card ${statusClass} ${flashClass}" data-id="${doctorId}">
                        <h2>${doctor.displayName || i18n.global?.unnamedDoctor}</h2>
                        <p class="specialty">${doctor.specialty || i18n.global?.noSpecialty}</p>
                        <p class="status ${statusClass}">${displayStatus}</p>
                        <div class="appointment-info">
                            <strong>${i18n.global?.officeLabel}</strong> ${doctor.officeNumber || i18n.global?.notApplicable}
                        </div>
                        <div class="appointment-info">
                            <strong>${i18n.global?.currentLabel}</strong> ${displayCurrent}
                        </div>
                    </div>
                `;
            } else {
                 // (Keep your existing Row View logic here if you use it)
            }
            itemsHtmlArray.push(itemHtml);
        });

        boardContainer.innerHTML = itemsHtmlArray.join('');

        // --- 4. PLAY SOUND (If needed) ---
        if (shouldPlaySound) {
            // Browsers often block auto-playing audio without user interaction first.
            // We wrap it in a try-catch to avoid errors in the console.
            alertSound.play().catch(e => console.log("Audio play blocked by browser policy:", e));
        }

    }, error => {
        console.error("Error fetching doctor data:", error);
    });
}

// --- Start the application ---
initializeDisplay(); // Single entry point
