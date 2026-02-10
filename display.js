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
// --- AD SYSTEM VARIABLES ---
let adTimer = null;
let currentAdIndex = 0;
let adPlaylist = []; 
const AD_FOLDER_PATH = 'ads/'; // Path to your folder

// --- Global variables ---
let useCardView = true; // Default
let i18n = {}; // Will hold the selected language texts
let allTexts = {}; // Will hold the entire texts.json
// Global variable to store the previous state of doctors
let previousDoctorStates = {}; 
// Audio object (Replace URL with your own file if desired)
const alertSound = new Audio('beep.mp3'); 

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
	
	// 1. Load Ads FIRST
	await loadAdPlaylist();

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

/**
 * Fetches the playlist.json file from your server
 */
async function loadAdPlaylist() {
    try {
        const response = await fetch(`${AD_FOLDER_PATH}playlist.json`);
        if (response.ok) {
            const files = await response.json();
            // Convert filenames to full objects
            adPlaylist = files.map(filename => ({
                type: filename.endsWith('.mp4') ? 'video' : 'image',
                url: `${AD_FOLDER_PATH}${filename}`
            }));
            console.log("Ads loaded:", adPlaylist);
        } else {
            console.warn("Could not load playlist.json");
        }
    } catch (e) {
        console.error("Error loading ads:", e);
    }
}

function startClock() {
    const clockEl = document.getElementById('clock-display');

    function update() {
        if (!clockEl) {
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
        
        clockEl.textContent = timeString; 
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


function listenForDoctorUpdates() {
    boardContainer.innerHTML = `<p class="loading-message">${i18n.global?.loading || 'Loading...'}</p>`;

    db.collection('doctors').onSnapshot(snapshot => {
        applyLayoutClass();
        boardContainer.innerHTML = ''; 

        // --- STEP 1: COLLECT DOCTORS ---
        let doctorsList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.hide !== true) {
                doctorsList.push({ id: doc.id, ...data });
            }
        });

        // --- STEP 2: SORT DOCTORS ---
        doctorsList.sort((a, b) => {
            const numA = parseInt(a.officeNumber) || 9999;
            const numB = parseInt(b.officeNumber) || 9999;
            return numA - numB; 
        });

        // --- STEP 3: RENDER DOCTORS ---
        const itemsHtmlArray = [];
        let shouldPlaySound = false;

        doctorsList.forEach(doctor => {
            const doctorId = doctor.id;
            
            // --- STATUS LOGIC (Same as before) ---
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

            // --- FLASH LOGIC (Same as before) ---
            let flashClass = '';
            const currentCallTrigger = doctor.callAgainTrigger || 0;

            if (previousDoctorStates[doctorId]) {
                const prev = previousDoctorStates[doctorId];
                if (lowerCaseStatus === 'in consultation') {
                    if (prev.status !== 'in consultation' || 
                        prev.current !== displayCurrent || 
                        prev.lastTrigger !== currentCallTrigger) { 
                        flashClass = 'card-flash';
                        shouldPlaySound = true;
                    }
                }
            }
            previousDoctorStates[doctorId] = {
                status: lowerCaseStatus,
                current: displayCurrent,
                lastTrigger: currentCallTrigger 
            };

            // --- RENDER HTML ---
            let itemHtml = '';
            if (useCardView) {
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
            }
            itemsHtmlArray.push(itemHtml);
        });

        // --- STEP 4: APPEND AD CARD (Always added at the end) ---
        if (useCardView) {
            const adCardHtml = `
                <div class="doctor-card ad-card">
                    <img id="ad-img-element" class="ad-content" src="" alt="Ad">
                    <video id="ad-video-element" class="ad-content" muted playsinline></video>
                </div>
            `;
            itemsHtmlArray.push(adCardHtml);
        }

        boardContainer.innerHTML = itemsHtmlArray.join('');

        // --- PLAY SOUND ---
        if (shouldPlaySound) {
            alertSound.play().catch(e => console.log("Audio play blocked:", e));
        }

        // --- START AD ROTATION (If we have ads) ---
        if (adPlaylist.length > 0) {
            startAdRotation();
        }

    }, error => {
        console.error("Error fetching doctor data:", error);
    });
}

/**
 * Handles the 30-second rotation of ads
 */
function startAdRotation() {
    if (adTimer) clearInterval(adTimer); // Clear existing timer

    const imgEl = document.getElementById('ad-img-element');
    const vidEl = document.getElementById('ad-video-element');
    
    if (!imgEl || !vidEl || adPlaylist.length === 0) return;

    function showCurrentAd() {
        const ad = adPlaylist[currentAdIndex];
        
        // Hide both initially
        imgEl.classList.remove('active');
        vidEl.classList.remove('active');
        vidEl.pause();

        if (ad.type === 'video') {
            vidEl.src = ad.url;
            vidEl.classList.add('active');
            vidEl.play().catch(e => console.log("Video autoplay blocked:", e));
        } else {
            imgEl.src = ad.url;
            imgEl.classList.add('active');
        }

        // Advance index
        currentAdIndex = (currentAdIndex + 1) % adPlaylist.length;
    }

    // Show first ad immediately
    showCurrentAd();

    // Rotate every 30 seconds
    adTimer = setInterval(showCurrentAd, 30000); 
}

// --- Start the application ---
initializeDisplay(); // Single entry point
