// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, setDoc, updateDoc, deleteDoc, query, where, writeBatch, getDocs, increment, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAohuQEs4nWuw1PSqfZpvxN1sF16BX_Qgw",
    authDomain: "library-glc-kob.firebaseapp.com",
    projectId: "library-glc-kob",
    storageBucket: "library-glc-kob.appspot.com",
    messagingSenderId: "806682991838",
    appId: "1:806682991838:web:4f63c2a07c39d89a74a89a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- GLOBAL STATE ---
let books = [], loans = [], classLoans = [], locations = [], students = [], readingLogs = [], settingsData = {};
let currentUserId = null;
let unsubscribeBooks = () => {}, unsubscribeLoans = () => {}, unsubscribeClassLoans = () => {}, unsubscribeLocations = () => {}, unsubscribeStudents = () => {}, unsubscribeSettings = () => {}, unsubscribeReadingLogs = () => {};

// This function runs once the HTML document is fully loaded.
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENTS ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.nav-link');

    // --- AUTHENTICATION ---
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUserId = user.uid;
            document.getElementById('user-email').textContent = user.email;
            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            setupRealtimeListeners(currentUserId);
            navigateTo('home'); // Default page after login
        } else {
            currentUserId = null;
            appContainer.classList.add('hidden');
            authContainer.classList.remove('hidden');
            unsubscribeAll();
            clearAllData();
            renderAll();
        }
    });

    showRegisterBtn.addEventListener('click', (e) => { /* ... */ });
    showLoginBtn.addEventListener('click', (e) => { /* ... */ });
    registerForm.addEventListener('submit', (e) => { /* ... */ });
    loginForm.addEventListener('submit', (e) => { /* ... */ });
    logoutBtn.addEventListener('click', () => { signOut(auth); });

    // --- NAVIGATION ---
    const navigateTo = (pageId) => {
        pages.forEach(page => page.classList.add('hidden'));
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }
        navLinks.forEach(nav => {
            nav.classList.toggle('bg-gray-900', nav.getAttribute('data-page') === pageId);
            nav.classList.toggle('text-white', nav.getAttribute('data-page') === pageId);
            nav.classList.toggle('text-gray-300', nav.getAttribute('data-page') !== pageId);
        });
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            navigateTo(pageId);
        });
    });

    // --- ALL OTHER FUNCTIONS AND EVENT LISTENERS ---
    // (Paste all your other functions: renderAll, renderBooks, setupRealtimeListeners, etc. here)
    // (Paste all your other event listeners: book-form submit, loan-form submit, etc. here)

}); // End of DOMContentLoaded

function unsubscribeAll() {
    // ... (unsubscribe logic)
}

function clearAllData() {
    // ... (clear data logic)
}

// --- FIREBASE REALTIME LISTENERS ---
function setupRealtimeListeners(userId) {
    // ... (Your original setupRealtimeListeners function)
}

// --- ATTACH GLOBAL FUNCTIONS ---
// Functions called by inline onclick="..." must be on the window object.
window.openBookModal = (id = null) => { /* ... */ };
window.closeBookModal = () => { /* ... */ };
// ... (Attach all other global functions here)
