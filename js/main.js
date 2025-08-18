// Firebase Imports
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, writeBatch, getDocs, query, where, addDoc, setDoc, updateDoc, deleteDoc, increment, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Local Module Imports
import { db, auth } from './firebase-config.js';
import { setupAuthEventListeners, reauthenticateAndDeleteAllData, changePassword } from './auth.js';
import { printReport, printCards, exportDataToExcel, parseCSV } from './utils.js';

// --- GLOBAL STATE & DOM ELEMENTS ---
let books = [];
let loans = [];
let classLoans = [];
let locations = [];
let students = [];
let readingLogs = [];
let settingsData = {};
let currentUserId = null;
let currentScannedBooks = [];
let currentStudentGender = '';

let unsubscribeBooks = () => {};
let unsubscribeLoans = () => {};
let unsubscribeClassLoans = () => {};
let unsubscribeLocations = () => {};
let unsubscribeStudents = () => {};
let unsubscribeSettings = () => {};
let unsubscribeReadingLogs = () => {};

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loadingOverlay = document.getElementById('loading-overlay');
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');

// --- UI NAVIGATION & DISPLAY ---
function navigateTo(pageId) {
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

    // Auto-focus or setup for specific pages
    if (pageId === 'class-loans') {
        populateClassLoanForm();
        setTimeout(() => document.getElementById('class-loan-isbn-input').focus(), 100);
    }
    if (pageId === 'loans') {
        clearLoanForm();
    }
     if (pageId === 'student-cards') {
        renderStudentCards();
    }
    if (pageId === 'reading-log') {
        clearReadingLogForm();
        setTimeout(() => document.getElementById('reading-log-student-id').focus(), 100);
    }
}

// --- RENDERING FUNCTIONS (ALL IN ONE PLACE FOR CLARITY) ---
function renderAll() {
    renderBooks();
    renderLoans();
    renderClassLoans();
    renderLocations();
    renderStudents();
    renderStudentCards();
    renderReadingLogs();
    updateDashboard();
}

function renderBooks() {
    const bookList = document.getElementById('book-list');
    const searchBooksInput = document.getElementById('search-books');
    const searchTerm = searchBooksInput.value.toLowerCase();
    const filteredBooks = books.filter(book => book.title.toLowerCase().includes(searchTerm) || (book.author && book.author.toLowerCase().includes(searchTerm)) || (book.isbn && book.isbn.toLowerCase().includes(searchTerm)));
    bookList.innerHTML = '';
    if (filteredBooks.length === 0) { bookList.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-gray-500">រកមិនឃើញសៀវភៅទេ។</td></tr>`; return; }
    const sortedBooks = [...filteredBooks].sort((a,b) => a.title.localeCompare(b.title));
    sortedBooks.forEach((book, index) => {
        const loanedCount = loans.filter(loan => loan.bookId === book.id && loan.status === 'ខ្ចី').length;
        const remaining = (book.quantity || 0) - loanedCount;
        const location = locations.find(loc => loc.id === book.locationId);
        const row = document.createElement('tr');
        row.className = 'border-b';
        row.innerHTML = `
            <td class="p-3">${index + 1}</td>
            <td class="p-3">${book.title} ${loanedCount > 0 ? `<span class="text-xs bg-yellow-200 text-yellow-800 rounded-full px-2 py-1 ml-2 no-print">ខ្ចី ${loanedCount}</span>` : ''}</td>
            <td class="p-3">${book.author || ''}</td>
            <td class="p-3">${book.isbn || ''}</td>
            <td class="p-3">${book.quantity || 0}</td>
            <td class="p-3 font-bold ${remaining > 0 ? 'text-green-600' : 'text-red-600'}">${remaining}</td>
            <td class="p-3">${location ? location.name : 'N/A'}</td>
            <td class="p-3">${book.source || ''}</td>
            <td class="p-3 no-print"><button onclick="window.editBook('${book.id}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button><button onclick="window.deleteBook('${book.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>
        `;
        bookList.appendChild(row);
    });
}

function renderLoans() {
    const loanList = document.getElementById('loan-list');
    const searchLoansInput = document.getElementById('search-loans');
    const loanSummary = document.getElementById('loan-summary');
    const startDate = document.getElementById('loan-filter-start-date').value;
    const endDate = document.getElementById('loan-filter-end-date').value;

    const individualLoans = loans.filter(loan => !loan.classLoanId);

    let dateFilteredLoans = individualLoans;
    if (startDate) {
        dateFilteredLoans = dateFilteredLoans.filter(loan => loan.loanDate >= startDate);
    }
    if (endDate) {
        dateFilteredLoans = dateFilteredLoans.filter(loan => loan.loanDate <= endDate);
    }

    let maleCount = 0;
    let femaleCount = 0;
    dateFilteredLoans.forEach(loan => {
        if (loan.borrowerGender === 'ប្រុស' || loan.borrowerGender === 'M') maleCount++;
        if (loan.borrowerGender === 'ស្រី' || loan.borrowerGender === 'F') femaleCount++;
    });
    loanSummary.textContent = `សរុប: ${dateFilteredLoans.length} នាក់ (ប្រុស: ${maleCount} នាក់, ស្រី: ${femaleCount} នាក់)`;

    const searchTerm = searchLoansInput.value.toLowerCase();
    const filteredLoans = dateFilteredLoans.filter(loan => {
        const book = books.find(b => b.id === loan.bookId);
        return (loan.borrower && loan.borrower.toLowerCase().includes(searchTerm)) || (book && book.title.toLowerCase().includes(searchTerm));
    });

    loanList.innerHTML = '';
    if (filteredLoans.length === 0) { loanList.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-gray-500">រកមិនឃើញកំណត់ត្រាខ្ចីទេ។</td></tr>`; return; }

    const sortedLoans = [...filteredLoans].sort((a,b) => new Date(b.loanDate) - new Date(a.loanDate));
    sortedLoans.forEach((loan, index) => {
        const book = books.find(b => b.id === loan.bookId);
        const row = document.createElement('tr');
        row.className = 'border-b';
        row.innerHTML = `<td class="p-3">${index + 1}</td><td class="p-3">${book ? book.title : 'សៀវភៅត្រូវបានលុប'}</td><td class="p-3">${loan.borrower}</td><td class="p-3">${loan.loanDate}</td><td class="p-3">${loan.returnDate || 'N/A'}</td><td class="p-3"><span class="px-2 py-1 text-xs rounded-full ${loan.status === 'ខ្ចី' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}">${loan.status}</span></td><td class="p-3 no-print">${loan.status === 'ខ្ចី' ? `<button onclick="window.returnBook('${loan.id}')" class="text-green-500 hover:text-green-700 mr-2" title="សម្គាល់ថាសងវិញ"><i class="fas fa-undo"></i></button>` : ''}<button onclick="window.deleteLoan('${loan.id}')" class="text-red-500 hover:text-red-700" title="លុបកំណត់ត្រា"><i class="fas fa-trash"></i></button></td>`;
        loanList.appendChild(row);
    });
}

// ... (Add other render functions: renderClassLoans, renderLocations, etc. here)
// Copy them directly from the original large script block.
// For brevity, I'll omit them here but you MUST include them.

// --- Make functions globally accessible on the window object ---
// This is a simple way to make sure onclick attributes in HTML can find the functions
// after being loaded as a module.

window.navigateTo = navigateTo;
// Add all other functions that are called from HTML (onclick, onsubmit) here
// Example:
// window.openBookModal = openBookModal;
// window.closeBookModal = closeBookModal;
// window.deleteBook = deleteBook;
// ... and so on for every function called in the HTML.


// --- INITIALIZATION ---
function initializeApp() {
    setupAuthEventListeners();
    // Setup all other event listeners for the main app
    // This is the crucial part that was likely missing.
    setupMainAppEventListeners();
}

function setupMainAppEventListeners() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            navigateTo(pageId);
        });
    });

    // Add ALL other event listeners from your original script here
    // Search boxes, forms, modals, buttons, etc.
    // Example:
    document.getElementById('search-books').addEventListener('input', renderBooks);
    document.getElementById('book-form').addEventListener('submit', handleBookFormSubmit);
    document.getElementById('print-report-btn').addEventListener('click', () => printReport({ activePage: document.querySelector('.page:not(.hidden)'), settingsData }));
    // ... continue for all interactive elements
}


// --- AUTH STATE OBSERVER ---
onAuthStateChanged(auth, user => {
    if (user) {
        currentUserId = user.uid;
        document.getElementById('user-email').textContent = user.email;
        appContainer.classList.remove('hidden');
        authContainer.classList.add('hidden');
        setupRealtimeListeners(currentUserId);
        navigateTo('reading-log'); // Default page
    } else {
        currentUserId = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        // Unsubscribe from all listeners
        unsubscribeAll();
        // Clear local data
        books = []; loans = []; classLoans = []; locations = []; students = []; readingLogs = [];
        renderAll();
    }
});

function setupRealtimeListeners(userId) {
    unsubscribeAll(); // Ensure no old listeners are running

    const collectionsToWatch = {
        books: (data) => { books = data; },
        loans: (data) => { loans = data; },
        classLoans: (data) => { classLoans = data; },
        locations: (data) => { locations = data; },
        students: (data) => { students = data; populateClassLoanFilter(); populateStudentClassFilter(); },
        readingLogs: (data) => { readingLogs = data; },
    };

    Object.entries(collectionsToWatch).forEach(([key, callback]) => {
        const ref = collection(db, "users", userId, key);
        const unsub = onSnapshot(ref, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(data);
            renderAll();
        });
        eval(`unsubscribe${key.charAt(0).toUpperCase() + key.slice(1)} = unsub;`);
    });

    const settingsRef = doc(db, "users", userId, "settings", "generalInfo");
    unsubscribeSettings = onSnapshot(settingsRef, (doc) => {
        settingsData = doc.exists() ? doc.data() : {};
        // Update UI related to settings
        document.getElementById('sidebar-school-name').textContent = settingsData.schoolName || '';
        renderStudentCards(); // Re-render cards if settings change
    });
}

function unsubscribeAll() {
    unsubscribeBooks();
    unsubscribeLoans();
    unsubscribeClassLoans();
    unsubscribeLocations();
    unsubscribeStudents();
    unsubscribeSettings();
    unsubscribeReadingLogs();
}

// Start the application
initializeApp();
