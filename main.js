// Firebase Imports
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Local Module Imports
import { db, auth } from './firebase-config.js';
import { setupAuthEventListeners } from './auth.js';
import { setupUIEventListeners, navigateTo, renderAllUI, showApp, showAuth } from './ui.js';

// --- GLOBAL STATE ---
let state = {
    books: [],
    loans: [],
    classLoans: [],
    locations: [],
    students: [],
    readingLogs: [],
    settings: {},
    currentUserId: null,
    unsubscribers: []
};

// --- REALTIME LISTENERS ---
function setupRealtimeListeners(userId) {
    // Clear previous listeners
    state.unsubscribers.forEach(unsub => unsub());
    state.unsubscribers = [];

    const collections = {
        books: "books",
        loans: "loans",
        classLoans: "classLoans",
        locations: "locations",
        students: "students",
        readingLogs: "readingLogs"
    };

    for (const [key, value] of Object.entries(collections)) {
        const ref = collection(db, "users", userId, value);
        const unsub = onSnapshot(ref, (snapshot) => {
            state[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAllUI(state);
        });
        state.unsubscribers.push(unsub);
    }

    const settingsRef = doc(db, "users", userId, "settings", "generalInfo");
    const unsubSettings = onSnapshot(settingsRef, (doc) => {
        state.settings = doc.exists() ? doc.data() : {};
        renderAllUI(state);
    });
    state.unsubscribers.push(unsubSettings);
}

// --- AUTH STATE CHANGE HANDLER ---
onAuthStateChanged(auth, user => {
    if (user) {
        state.currentUserId = user.uid;
        document.getElementById('user-email').textContent = user.email;
        showApp();
        setupRealtimeListeners(state.currentUserId);
        navigateTo('reading-log'); // Default page
    } else {
        state.currentUserId = null;
        // Unsubscribe from all listeners
        state.unsubscribers.forEach(unsub => unsub());
        state.unsubscribers = [];
        // Clear local data
        Object.assign(state, {
            books: [], loans: [], classLoans: [], locations: [],
            students: [], readingLogs: [], settings: {}
        });
        showAuth();
        renderAllUI(state); // Render empty state
    }
});

// --- INITIALIZATION ---
function initialize() {
    setupAuthEventListeners();
    setupUIEventListeners();
}

// Start the application
initialize();

// Export state to be accessible by other modules
export { state };
