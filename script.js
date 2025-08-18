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

// --- GLOBAL STATE & DOM ELEMENTS ---
let books = [];
let loans = [];
let classLoans = [];
let locations = [];
let students = [];
let readingLogs = [];
let settingsData = {};
let currentUserId = null;
let unsubscribeBooks = () => {};
let unsubscribeLoans = () => {};
let unsubscribeClassLoans = () => {};
let unsubscribeLocations = () => {};
let unsubscribeStudents = () => {};
let unsubscribeSettings = () => {};
let unsubscribeReadingLogs = () => {};
let currentScannedBooks = [];
let currentStudentGender = '';

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loadingOverlay = document.getElementById('loading-overlay');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const logoutBtn = document.getElementById('logout-btn');
const sidebarSchoolName = document.getElementById('sidebar-school-name');
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
        navigateTo('reading-log'); // Default page
    } else {
        currentUserId = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        unsubscribeAll();
        clearAllData();
        renderAll();
    }
});

showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('login-form-container').classList.add('hidden'); document.getElementById('register-form-container').classList.remove('hidden'); });
showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('register-form-container').classList.add('hidden'); document.getElementById('login-form-container').classList.remove('hidden'); });
registerForm.addEventListener('submit', (e) => { e.preventDefault(); const email = document.getElementById('register-email').value; const password = document.getElementById('register-password').value; const errorP = document.getElementById('register-error'); errorP.textContent = ''; createUserWithEmailAndPassword(auth, email, password).catch(error => { errorP.textContent = 'ការចុះឈ្មោះបានបរាជ័យ: ' + error.message; }); });
loginForm.addEventListener('submit', (e) => { e.preventDefault(); const email = document.getElementById('login-email').value; const password = document.getElementById('login-password').value; const errorP = document.getElementById('login-error'); errorP.textContent = ''; signInWithEmailAndPassword(auth, email, password).catch(error => { errorP.textContent = 'ការចូលប្រើបានបរាជ័យ: ' + error.message; }); });
logoutBtn.addEventListener('click', () => { signOut(auth); });

function unsubscribeAll() {
    unsubscribeBooks();
    unsubscribeLoans();
    unsubscribeClassLoans();
    unsubscribeLocations();
    unsubscribeStudents();
    unsubscribeSettings();
    unsubscribeReadingLogs();
}

function clearAllData() {
    books = []; loans = []; classLoans = []; locations = []; students = []; readingLogs = []; settingsData = {};
}

// --- NAVIGATION ---
const navigateTo = (pageId) => {
    pages.forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    navLinks.forEach(nav => {
        if (nav.getAttribute('data-page') === pageId) {
            nav.classList.add('bg-gray-900', 'text-white');
            nav.classList.remove('text-gray-300');
        } else {
            nav.classList.remove('bg-gray-900', 'text-white');
            nav.classList.add('text-gray-300');
        }
    });

    // Auto-focus logic
    if (pageId === 'reading-log') {
        setTimeout(() => document.getElementById('reading-log-student-id')?.focus(), 100);
    }
};

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = link.getAttribute('data-page');
        navigateTo(pageId);
    });
});

// --- RENDERING FUNCTIONS (Paste your original functions here) ---
const renderAll = () => { /* ... */ };
const renderBooks = () => { /* ... */ };
const renderLoans = () => { /* ... */ };
// ... and so on for all render functions

// --- FIREBASE REALTIME LISTENERS ---
const setupRealtimeListeners = (userId) => {
    // ... (Paste your original setupRealtimeListeners function here)
};

// --- ATTACH FUNCTIONS TO WINDOW OBJECT ---
window.openBookModal = (id = null) => { /* ... */ };
window.closeBookModal = () => { /* ... */ };
// ... (Attach all other necessary functions to the window object)

// --- ADD EVENT LISTENERS FOR FORMS AND BUTTONS ---
document.getElementById('book-form')?.addEventListener('submit', async (e) => { /* ... */ });
document.getElementById('loan-form')?.addEventListener('submit', async (e) => { /* ... */ });
// ... (Add all other event listeners here)
