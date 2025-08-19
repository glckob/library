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
let currentStudentGender = ''; // For gender tracking

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
        
        // Load default page setting and navigate
        loadDefaultPageSetting();
    } else {
        currentUserId = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        // Unsubscribe from all listeners
        unsubscribeBooks();
        unsubscribeLoans();
        unsubscribeClassLoans();
        unsubscribeLocations();
        unsubscribeStudents();
        unsubscribeSettings();
        unsubscribeReadingLogs();
        // Clear local data
        books = []; loans = []; classLoans = []; locations = []; students = []; readingLogs = [];
        renderAll();
    }
});

showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('login-form-container').classList.add('hidden'); document.getElementById('register-form-container').classList.remove('hidden'); });
showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('register-form-container').classList.add('hidden'); document.getElementById('login-form-container').classList.remove('hidden'); });
registerForm.addEventListener('submit', (e) => { e.preventDefault(); const email = document.getElementById('register-email').value; const password = document.getElementById('register-password').value; const errorP = document.getElementById('register-error'); errorP.textContent = ''; createUserWithEmailAndPassword(auth, email, password).catch(error => { errorP.textContent = 'ការចុះឈ្មោះបានបរាជ័យ: ' + error.message; }); });
loginForm.addEventListener('submit', (e) => { e.preventDefault(); const email = document.getElementById('login-email').value; const password = document.getElementById('login-password').value; const errorP = document.getElementById('login-error'); errorP.textContent = ''; signInWithEmailAndPassword(auth, email, password).catch(error => { errorP.textContent = 'ការចូលប្រើបានបរាជ័យ: ' + error.message; }); });
logoutBtn.addEventListener('click', () => { signOut(auth); });

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

    // Auto-focus or setup for specific pages
    if (pageId === 'class-loans') {
        populateClassLoanForm();
        setTimeout(() => document.getElementById('class-loan-isbn-input').focus(), 100);
    }
    if (pageId === 'loans') {
        window.clearLoanForm();
    }
    if (pageId === 'reading-log') {
        window.clearReadingLogForm();
        setTimeout(() => document.getElementById('reading-log-student-id').focus(), 100);
    }
};

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const pageId = link.getAttribute('data-page');
        // Only prevent default and navigate if it's an internal page
        if (pageId) {
            e.preventDefault();
            navigateTo(pageId);
        }
        // If no data-page attribute, let the natural href work (for external links like stcard.html)
    });
});

// --- RENDERING FUNCTIONS ---
const renderAll = () => {
    renderBooks();
    renderLoans();
    renderClassLoans();
    renderLocations();
    renderStudents();
    renderReadingLogs();
    updateDashboard();
};

const renderBooks = () => {
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
};

const renderLoans = () => {
    const loanList = document.getElementById('loan-list');
    const searchLoansInput = document.getElementById('search-loans');
    const loanSummary = document.getElementById('loan-summary');
    const startDate = document.getElementById('loan-filter-start-date').value;
    const endDate = document.getElementById('loan-filter-end-date').value;

    const individualLoans = loans.filter(loan => !loan.classLoanId);
    
    // Date Filtering
    let dateFilteredLoans = individualLoans;
    if (startDate) {
        dateFilteredLoans = dateFilteredLoans.filter(loan => loan.loanDate >= startDate);
    }
    if (endDate) {
        dateFilteredLoans = dateFilteredLoans.filter(loan => loan.loanDate <= endDate);
    }

    // Gender Summary
    let maleCount = 0;
    let femaleCount = 0;
    dateFilteredLoans.forEach(loan => {
        if (loan.borrowerGender === 'ប្រុស' || loan.borrowerGender === 'M') maleCount++;
        if (loan.borrowerGender === 'ស្រី' || loan.borrowerGender === 'F') femaleCount++;
    });
    loanSummary.textContent = `សរុប: ${dateFilteredLoans.length} នាក់ (ប្រុស: ${maleCount} នាក់, ស្រី: ${femaleCount} នាក់)`;

    // Search Term Filtering
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
};

const renderClassLoans = () => {
    const classLoanList = document.getElementById('class-loan-list');
    const selectedClass = document.getElementById('class-loan-filter-select').value;
    
    let filtered = classLoans;
    if (selectedClass) {
        filtered = filtered.filter(loan => loan.className === selectedClass);
    }

    classLoanList.innerHTML = '';
    if (filtered.length === 0) { classLoanList.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-gray-500">មិនទាន់មានប្រវត្តិខ្ចីតាមថ្នាក់ទេ។</td></tr>`; return; }
    
    const sortedClassLoans = [...filtered].sort((a,b) => new Date(b.loanDate) - new Date(a.loanDate));
    sortedClassLoans.forEach((loan, index) => {
        const book = books.find(b => b.id === loan.bookId);
        const row = document.createElement('tr');
        row.className = 'border-b';
        const isFullyReturned = (loan.returnedCount || 0) >= loan.loanedQuantity;
        row.innerHTML = `
            <td class="p-3">${index + 1}</td>
            <td class="p-3">${book ? book.title : 'សៀវភៅត្រូវបានលុប'}</td>
            <td class="p-3">${loan.className}</td>
            <td class="p-3">${loan.loanDate}</td>
            <td class="p-3">
                <span class="font-bold ${isFullyReturned ? 'text-green-600' : 'text-orange-600'}">
                    សងបាន: ${loan.returnedCount || 0} / ${loan.loanedQuantity}
                </span>
            </td>
            <td class="p-3 no-print">
                ${!isFullyReturned ? `<button onclick="window.openClassReturnModal('${loan.id}')" class="text-teal-500 hover:text-teal-700 mr-2" title="សងសៀវភៅ"><i class="fas fa-book-reader"></i></button>` : ''}
                <button onclick="window.openClassLoanEditModal('${loan.id}')" class="text-blue-500 hover:text-blue-700 mr-2" title="កែប្រែ"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteClassLoan('${loan.id}')" class="text-red-500 hover:text-red-700" title="លុបប្រវត្តិនេះ"><i class="fas fa-trash"></i></button>
            </td>
        `;
        classLoanList.appendChild(row);
    });
};

const renderLocations = () => {
    const locationList = document.getElementById('location-list');
    const searchLocationsInput = document.getElementById('search-locations');
    const searchTerm = searchLocationsInput.value.toLowerCase();
    const filteredLocations = locations.filter(loc => loc.name.toLowerCase().includes(searchTerm));
    locationList.innerHTML = '';
    if (filteredLocations.length === 0) { locationList.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">រកមិនឃើញទីតាំងទេ។</td></tr>`; return; }
    const sortedLocations = [...filteredLocations].sort((a,b) => a.name.localeCompare(b.name));
    sortedLocations.forEach((loc, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b';
        row.innerHTML = `<td class="p-3">${index + 1}</td><td class="p-3">${loc.name}</td><td class="p-3">${loc.source || ''}</td><td class="p-3">${loc.year || ''}</td><td class="p-3 no-print"><button onclick="window.editLocation('${loc.id}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button><button onclick="window.deleteLocation('${loc.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>`;
        locationList.appendChild(row);
    });
};

const renderStudents = () => {
    const studentList = document.getElementById('student-list');
    const studentListHeader = document.getElementById('student-list-header');
    const searchStudentsInput = document.getElementById('search-students');
    const classFilter = document.getElementById('student-class-filter'); // Get the filter
    const duplicateListContainer = document.getElementById('duplicate-student-list');
    
    duplicateListContainer.innerHTML = ''; // Clear previous results

    if (students.length > 0) {
        const idKey = Object.keys(students[0]).find(k => k.toLowerCase().includes('អត្តលេខ'));
        const lastNameKey = Object.keys(students[0]).find(k => k.includes('នាមត្រកូល'));
        const firstNameKey = Object.keys(students[0]).find(k => k.includes('នាមខ្លួន'));
        const noKey = 'ល.រ';

        if (idKey) {
            const idMap = new Map();
            students.forEach(student => {
                const studentId = (student[idKey] || '').trim();
                if (studentId) {
                    if (!idMap.has(studentId)) {
                        idMap.set(studentId, []);
                    }
                    idMap.get(studentId).push(student);
                }
            });

            const duplicates = [];
            for (const studentGroup of idMap.values()) {
                if (studentGroup.length > 1) {
                    duplicates.push(...studentGroup);
                }
            }

            if (duplicates.length > 0) {
                let html = '<div class="font-sans"><strong>អត្តលេខស្ទួន៖</strong><ul>';
                duplicates.forEach(student => {
                    const fullName = `${student[lastNameKey] || ''} ${student[firstNameKey] || ''}`.trim();
                    html += `<li class="ml-4">- ល.រ: ${student[noKey] || 'N/A'}, អត្តលេខ: ${student[idKey]}, ឈ្មោះ: ${fullName}</li>`;
                });
                html += '</ul></div>';
                duplicateListContainer.innerHTML = html;
            }
        }
    }

    const searchTerm = searchStudentsInput.value.toLowerCase();
    const selectedClass = classFilter.value; 
    const classKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('ថ្នាក់')) : null;

    let filteredStudents = students;

    // Filter by class first
    if (selectedClass && classKey) {
        filteredStudents = filteredStudents.filter(student => student[classKey] === selectedClass);
    }

    // Then filter by search term
    if (searchTerm) {
        filteredStudents = filteredStudents.filter(student => {
            return Object.values(student).some(value =>
                String(value).toLowerCase().includes(searchTerm)
            );
        });
    }

    studentList.innerHTML = '';
    studentListHeader.innerHTML = '';

    if (filteredStudents.length === 0) {
        studentList.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-gray-500">មិនទាន់មានទិន្នន័យសិស្ស ឬរកមិនឃើញ។</td></tr>`;
        return;
    }

    const headers = ['ល.រ', 'អត្តលេខ', 'នាមត្រកូល', 'នាមខ្លួន', 'ភេទ', 'ថ្ងៃខែឆ្នាំកំណើត', 'ថ្នាក់', 'រូបថត URL', 'សកម្មភាព'];
    
    const sortedStudents = [...filteredStudents].sort((a, b) => {
        const numA = parseInt(a['ល.រ'], 10) || 0;
        const numB = parseInt(b['ល.រ'], 10) || 0;
        return numA - numB;
    });

    // Render headers
    let headerHTML = '';
    headers.forEach(header => {
        const thClass = header === 'សកម្មភាព' ? 'p-3 no-print' : 'p-3';
        headerHTML += `<th class="${thClass}">${header}</th>`;
    });
    studentListHeader.innerHTML = headerHTML;

    // Render rows
    sortedStudents.forEach(student => {
        const row = document.createElement('tr');
        row.className = 'border-b';
        
        let rowHTML = '';
        headers.slice(0, -1).forEach(header => { // All headers except 'Actions'
            rowHTML += `<td class="p-3">${student[header] || ''}</td>`;
        });
        
        // Add actions cell
        rowHTML += `
            <td class="p-3 no-print">
                <button onclick="window.openStudentModal('${student.id}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteStudent('${student.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
            </td>`;

        row.innerHTML = rowHTML;
        studentList.appendChild(row);
    });
};

const renderReadingLogs = () => {
    const readingLogHistory = document.getElementById('reading-log-history');
    const readingLogSummary = document.getElementById('reading-log-summary');
    const startDate = document.getElementById('reading-log-filter-start-date').value;
    const endDate = document.getElementById('reading-log-filter-end-date').value;

    let filtered = readingLogs;
    if (startDate) {
        filtered = filtered.filter(log => log.dateTime.split('T')[0] >= startDate);
    }
    if (endDate) {
        filtered = filtered.filter(log => log.dateTime.split('T')[0] <= endDate);
    }

    // Gender Summary
    let maleCount = 0;
    let femaleCount = 0;
    filtered.forEach(log => {
        if (log.studentGender === 'ប្រុស' || log.studentGender === 'M') maleCount++;
        if (log.studentGender === 'ស្រី' || log.studentGender === 'F') femaleCount++;
    });
    readingLogSummary.textContent = `សរុប: ${filtered.length} នាក់ (ប្រុស: ${maleCount} នាក់, ស្រី: ${femaleCount} នាក់)`;

    readingLogHistory.innerHTML = '';
    if(filtered.length === 0) {
        readingLogHistory.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">មិនទាន់មានប្រវត្តិការចូលអានទេ។</td></tr>`;
        return;
    }

    const sortedLogs = [...filtered].sort((a,b) => new Date(b.dateTime) - new Date(a.dateTime));
    sortedLogs.forEach((log, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b';
        const booksRead = log.books.map(b => b.title).join(', ');
        row.innerHTML = `
            <td class="p-3">${index + 1}</td>
            <td class="p-3">${new Date(log.dateTime).toLocaleString('en-GB')}</td>
            <td class="p-3">${log.studentName}</td>
            <td class="p-3">${booksRead}</td>
            <td class="p-3 no-print">
                <button onclick="window.deleteReadingLog('${log.id}')" class="text-red-500 hover:text-red-700" title="លុប"><i class="fas fa-trash"></i></button>
            </td>
        `;
        readingLogHistory.appendChild(row);
    });
};

const updateDashboard = () => {
    document.getElementById('total-books').textContent = books.length;
    const totalQuantity = books.reduce((sum, book) => sum + (parseInt(book.quantity, 10) || 0), 0);
    document.getElementById('total-quantity').textContent = totalQuantity;
    const activeLoans = loans.filter(l => l.status === 'ខ្ចី').length;
    document.getElementById('total-loans').textContent = activeLoans;
};

const populateClassLoanFilter = () => {
    const classLoanFilterSelect = document.getElementById('class-loan-filter-select');
    classLoanFilterSelect.innerHTML = '<option value="">-- ថ្នាក់ទាំងអស់ --</option>';
    if (students.length > 0) {
        const classKey = Object.keys(students[0]).find(k => k.includes('ថ្នាក់'));
        if (classKey) {
            const uniqueClasses = [...new Set(students.map(s => s[classKey]))].filter(Boolean).sort();
            uniqueClasses.forEach(className => {
                const option = document.createElement('option');
                option.value = className;
                option.textContent = className;
                classLoanFilterSelect.appendChild(option);
            });
        }
    }
};

// START: NEW FUNCTION TO POPULATE STUDENT PAGE CLASS FILTER
const populateStudentClassFilter = () => {
    const classFilter = document.getElementById('student-class-filter');
    // Only populate if there are students and the filter is empty (or has only the 'all' option)
    if (!students.length || (classFilter.options.length > 1 && classFilter.value !== '')) { 
        return;
    }

    const classKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('ថ្នាក់')) : null;
    if (!classKey) return;

    // Get unique classes, filter out any empty values, and sort them naturally (e.g., 1, 2, 10)
    const uniqueClasses = [...new Set(students.map(s => s[classKey]))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, {numeric: true})); 
    
    const currentVal = classFilter.value; // Save current selection
    classFilter.innerHTML = '<option value="">-- ថ្នាក់ទាំងអស់ --</option>'; 

    uniqueClasses.forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        classFilter.appendChild(option);
    });

    // Set default to the smallest class if no class was previously selected
    if (!currentVal && uniqueClasses.length > 0) {
        classFilter.value = uniqueClasses[0];
    } else {
        classFilter.value = currentVal; // Restore previous selection
    }
};
// END: NEW FUNCTION

// --- STUDENT CARD PAGE ---
// MODIFIED FUNCTION: Creates paginated containers for printing
function renderStudentCards() {
    if (!document.getElementById('page-student-cards')) return;

    const container = document.getElementById("student-card-container");
    const loading = document.getElementById("loading-cards");
    const classFilter = document.getElementById("card-class-filter");
    const searchBox = document.getElementById("card-search-box");
    
    // Update the dynamic style for the card background
    let styleElement = document.getElementById('dynamic-card-style');
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'dynamic-card-style';
        document.head.appendChild(styleElement);
    }
    const cardBgUrl = settingsData.cardBgUrl || 'https://i.imgur.com/s46369v.png'; // Default MOEYS logo
    styleElement.innerHTML = `#page-student-cards .card::before { background-image: url('${cardBgUrl}'); }`;


    // Populate class filter only once
    if (classFilter.options.length <= 1 && students.length > 0) {
        const classKey = Object.keys(students[0]).find(k => k.includes('ថ្នាក់'));
        if (classKey) {
            const classSet = new Set(students.map(std => std[classKey]).filter(Boolean));
            const sortedClasses = [...classSet].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
            
            sortedClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls;
                option.textContent = cls;
                classFilter.appendChild(option);
            });
            
            // Set default to the smallest class (first in sorted array)
            if (sortedClasses.length > 0) {
                classFilter.value = sortedClasses[0];
            }
        }
    }
    
    const selectedClass = classFilter.value;
    const keyword = searchBox.value.toLowerCase();
    const classKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('ថ្នាក់')) : null;
    const nameKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('នាមខ្លួន')) : null;
    const lastNameKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('នាមត្រកូល')) : null;
    const idKey = students.length > 0 ? Object.keys(students[0]).find(k => k.toLowerCase().includes('អត្តលេខ')) : null;

    const filteredStudents = students.filter(std => {
        const fullName = `${std[lastNameKey] || ''} ${std[nameKey] || ''}`.toLowerCase();
        const studentId = (std[idKey] || '').toLowerCase();
        const classMatch = !selectedClass || (classKey && std[classKey] === selectedClass);
        const keywordMatch = !keyword || fullName.includes(keyword) || studentId.includes(keyword);
        return classMatch && keywordMatch;
    });

    loading.style.display = "none";
    container.style.display = "flex"; // Keep flex for on-screen view
    container.innerHTML = ""; // Clear previous content

    if (filteredStudents.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 w-full p-4">រកមិនឃើញទិន្នន័យសិស្សទេ។</p>`;
        return;
    }

    const schoolName = settingsData.schoolName || 'ឈ្មោះសាលា';
    const academicYear = settingsData.academicYear || 'YYYY-YYYY';
    const sealUrl = settingsData.sealImageUrl || '';

    const CARDS_PER_PAGE = 9;
    let pageContainer = null;

    filteredStudents.forEach((std, index) => {
        // Create a new page container for the first card and every 9th card after that
        if (index % CARDS_PER_PAGE === 0) {
            pageContainer = document.createElement('div');
            pageContainer.className = 'print-page-container'; // New class for print styling
            container.appendChild(pageContainer);
        }

        const cardDiv = document.createElement("div");
        cardDiv.className = "card";
        const qrId = `qr-${std.id}`;
        const barcodeId = `barcode-${std.id}`;
        
        const dobKey = Object.keys(std).find(k => k.includes('ថ្ងៃខែឆ្នាំកំណើត'));
        const genderKey = Object.keys(std).find(k => k.includes('ភេទ'));
        const photoUrlKey = Object.keys(std).find(k => k.includes('រូបថត URL'));
        
        const fullName = `${std[lastNameKey] || ''} ${std[nameKey] || ''}`.trim();
        const studentClass = classKey ? `${std[classKey]}` : '';
        const studentId = idKey ? std[idKey] : '';
        const dob = dobKey ? std[dobKey] : '';
        const gender = genderKey ? std[genderKey] : '';
        const photoUrl = photoUrlKey && std[photoUrlKey] ? std[photoUrlKey].trim() : null;

        const photoElement = photoUrl 
            ? `<img class="photo" src="${photoUrl}" alt="Photo" onerror="this.onerror=null;this.src='https://placehold.co/108x108/e2e8f0/7d7d7d?text=Error';"/>`
            : `<div class="photo no-photo"></div>`;

        cardDiv.innerHTML = `
          <div>
            <div class="school-name">${schoolName}</div>
            <div class="student-name">${fullName}</div>
            <div class="info-and-qr">
              <div class="info">
                <div><b>អត្តលេខ:</b> ${studentId}</div>
                <div><b>ថ្នាក់:</b> ${studentClass}</div>
                <div><b>ឆ្នាំសិក្សា:</b> ${academicYear}</div>
                <div><b>ភេទ:</b> ${gender}</div>
              </div>
              <div id="${qrId}" class="qr"></div>
            </div>
          </div>
          <div class="barcode-container">
             <svg id="${barcodeId}"></svg>
          </div>
          <div class="photo-wrapper">
            ${photoElement}
          </div>
          ${sealUrl ? `<img class="stamp" src="${sealUrl}" alt="Stamp" />` : ''}
        `;
        
        // Append the card to the current page container
        pageContainer.appendChild(cardDiv);
    });

    // Generate QR codes and barcodes after all cards are rendered with a longer delay
    // to ensure proper rendering before printing
    setTimeout(() => {
        console.log('Generating QR codes and barcodes for', filteredStudents.length, 'students');
        // Add a small delay for each student to prevent browser from freezing
        let processedCount = 0;
        
        function processNextStudent() {
            if (processedCount >= filteredStudents.length) {
                console.log('Finished generating all QR codes and barcodes');
                return;
            }
            
            const std = filteredStudents[processedCount];
            processedCount++;
            
            const qrId = `qr-${std.id}`;
            const barcodeId = `barcode-${std.id}`;
            const studentId = idKey ? std[idKey] : '';

            if (studentId && window.QRCode) {
                const qrElement = document.getElementById(qrId);
                if (qrElement) {
                    qrElement.innerHTML = ''; // Clear any existing content
                    try {
                        new QRCode(qrElement, {
                            text: studentId,
                            width: 70,
                            height: 70,
                            correctLevel: QRCode.CorrectLevel.H
                        });
                    } catch (e) {
                        console.error("QR code generation failed for ID:", studentId, e);
                    }
                }
            }
            
            if (studentId && window.JsBarcode) {
                try {
                    const barcodeElement = document.getElementById(barcodeId);
                    if (barcodeElement) {
                        JsBarcode(`#${barcodeId}`, studentId, {
                            format: "CODE128",
                            height: 30,
                            width: 1.8,
                            displayValue: false,
                            margin: 0
                        });
                    }
                } catch (e) {
                    console.error("Barcode generation failed for ID:", studentId, e);
                    const barcodeElement = document.getElementById(barcodeId);
                    if (barcodeElement) {
                        barcodeElement.style.display = 'none';
                    }
                }
            }
            
            // Process next student with a small delay to prevent browser freezing
            setTimeout(processNextStudent, 10);
        }
        
        // Start processing students
        processNextStudent();
    }, 500);
};

// --- FIREBASE REALTIME LISTENERS ---
const setupRealtimeListeners = (userId) => {
    const booksRef = collection(db, "users", userId, "books");
    unsubscribeBooks = onSnapshot(query(booksRef), (snapshot) => { books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderAll(); });

    const loansRef = collection(db, "users", userId, "loans");
    unsubscribeLoans = onSnapshot(query(loansRef), (snapshot) => { loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderAll(); });
    
    const classLoansRef = collection(db, "users", userId, "classLoans");
    unsubscribeClassLoans = onSnapshot(query(classLoansRef), (snapshot) => { classLoans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderAll(); });
    
    const locationsRef = collection(db, "users", userId, "locations");
    unsubscribeLocations = onSnapshot(query(locationsRef), (snapshot) => { locations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderAll(); });

    const studentsRef = collection(db, "users", userId, "students");
    unsubscribeStudents = onSnapshot(query(studentsRef), (snapshot) => { 
        students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        populateClassLoanFilter();
        populateStudentClassFilter(); // Call the new function
        renderAll(); 
    });
    
    const readingLogsRef = collection(db, "users", userId, "readingLogs");
    unsubscribeReadingLogs = onSnapshot(query(readingLogsRef), (snapshot) => { readingLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderAll(); });
    
    const settingsRef = doc(db, "users", userId, "settings", "generalInfo");
    unsubscribeSettings = onSnapshot(settingsRef, (doc) => {
        const schoolNameInput = document.getElementById('school-name-input');
        const schoolNameDisplay = document.getElementById('school-name-display');
        const saveSchoolNameBtn = document.getElementById('save-school-name-btn');
        const editSchoolNameBtn = document.getElementById('edit-school-name-btn');
        const deleteSchoolNameBtn = document.getElementById('delete-school-name-btn');
        const academicYearInput = document.getElementById('academic-year-input');
        const academicYearDisplay = document.getElementById('academic-year-display');
        const saveAcademicYearBtn = document.getElementById('save-academic-year-btn');
        const editAcademicYearBtn = document.getElementById('edit-academic-year-btn');
        const deleteAcademicYearBtn = document.getElementById('delete-academic-year-btn');
        const sealImageUrlInput = document.getElementById('seal-image-url');
        const sealImagePreview = document.getElementById('seal-image-preview');
        const googleSheetUrlInput = document.getElementById('google-sheet-url');
        const cardBgUrlInput = document.getElementById('card-bg-url');
        const cardBgPreview = document.getElementById('card-bg-preview');
        const printSchoolName = document.getElementById('print-school-name');
        const defaultPageSelect = document.getElementById('default-page-select'); // New element

        if (doc.exists()) {
            settingsData = doc.data(); // Store settings data globally
            const data = doc.data();
            
            // Update School Name UI
            if (data.schoolName) {
                sidebarSchoolName.textContent = data.schoolName;
                if(printSchoolName) printSchoolName.textContent = data.schoolName;
                schoolNameDisplay.textContent = data.schoolName;
                schoolNameInput.value = data.schoolName;
                schoolNameDisplay.classList.remove('hidden');
                schoolNameInput.classList.add('hidden');
                saveSchoolNameBtn.classList.add('hidden');
                editSchoolNameBtn.classList.remove('hidden');
                deleteSchoolNameBtn.classList.remove('hidden');
            } else {
                sidebarSchoolName.textContent = '';
                if(printSchoolName) printSchoolName.textContent = '';
                schoolNameDisplay.classList.add('hidden');
                schoolNameInput.classList.remove('hidden');
                saveSchoolNameBtn.classList.remove('hidden');
                editSchoolNameBtn.classList.add('hidden');
                deleteSchoolNameBtn.classList.add('hidden');
            }

            // Update Academic Year UI
            if (data.academicYear) {
                academicYearDisplay.textContent = data.academicYear;
                academicYearInput.value = data.academicYear;
                academicYearDisplay.classList.remove('hidden');
                academicYearInput.classList.add('hidden');
                saveAcademicYearBtn.classList.add('hidden');
                editAcademicYearBtn.classList.remove('hidden');
                deleteAcademicYearBtn.classList.remove('hidden');
            } else {
                academicYearDisplay.classList.add('hidden');
                academicYearInput.classList.remove('hidden');
                saveAcademicYearBtn.classList.remove('hidden');
                editAcademicYearBtn.classList.add('hidden');
                deleteAcademicYearBtn.classList.add('hidden');
            }

            // Update Seal Image UI
            if (data.sealImageUrl) {
                sealImageUrlInput.value = data.sealImageUrl;
                sealImagePreview.src = data.sealImageUrl;
            } else {
                 sealImageUrlInput.value = '';
                 sealImagePreview.src = 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Preview';
            }

            // Update Card Background UI
            if (data.cardBgUrl) {
                cardBgUrlInput.value = data.cardBgUrl;
                cardBgPreview.src = data.cardBgUrl;
            } else {
                 cardBgUrlInput.value = '';
                 cardBgPreview.src = 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Preview';
            }
            
            // Update Google Sheet URL
            if (googleSheetUrlInput) {
                googleSheetUrlInput.value = data.googleSheetUrl || '';
            }
            
            // NEW: Populate and set the default page dropdown
            populateDefaultPageSelect(data.defaultPage);
            
            // Redirect to the default page after login if one is set
            if (data.defaultPage && (window.location.hash === '' || window.location.hash === '#/login' || !window.location.hash)) {
                setTimeout(() => {
                    navigateTo(data.defaultPage);
                }, 100);
            }


        } else {
            settingsData = {}; // Reset if no data
            sidebarSchoolName.textContent = ''; // Clear sidebar school name
            if(printSchoolName) printSchoolName.textContent = '';
            // Reset all fields to default state
            schoolNameDisplay.classList.add('hidden');
            schoolNameInput.classList.remove('hidden');
            saveSchoolNameBtn.classList.remove('hidden');
            editSchoolNameBtn.classList.add('hidden');
            deleteSchoolNameBtn.classList.add('hidden');
            
            academicYearDisplay.classList.add('hidden');
            academicYearInput.classList.remove('hidden');
            saveAcademicYearBtn.classList.remove('hidden');
            editAcademicYearBtn.classList.add('hidden');
            deleteAcademicYearBtn.classList.add('hidden');

            sealImageUrlInput.value = '';
            sealImagePreview.src = 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Preview';
            cardBgUrlInput.value = '';
            cardBgPreview.src = 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Preview';
            if (googleSheetUrlInput) {
               googleSheetUrlInput.value = '';
            }
            
            // NEW: Populate the default page select with a blank option
            populateDefaultPageSelect(null);
            
            // Set default page to reading log on first login only if no hash is present
            if (window.location.hash === '' || window.location.hash === '#/login' || !window.location.hash) {
                setTimeout(() => {
                    navigateTo('reading-log');
                }, 100);
            }
        }
        renderStudentCards();
    });
    
    // --- SEARCH BOX LISTENERS ---
    document.getElementById('search-books').addEventListener('input', renderBooks);
    document.getElementById('search-loans').addEventListener('input', renderLoans);
    document.getElementById('search-locations').addEventListener('input', renderLocations);
    document.getElementById('search-students').addEventListener('input', renderStudents);
    document.getElementById('student-class-filter').addEventListener('change', renderStudents); // Add listener for new filter
    
    
    // --- EXPORT BUTTON LISTENER ---
    document.getElementById('export-excel-btn').addEventListener('click', exportData);
};

// --- SETTINGS PAGE - NEW FUNCTION FOR DEFAULT PAGE DROPDOWN ---
const defaultPageOptions = [
    { id: 'home', name: 'ទំព័រដើម' },
    { id: 'books', name: 'គ្រប់គ្រងសៀវភៅ' },
    { id: 'loans', name: 'ខ្ចី-សង បុគ្គល' },
    { id: 'class-loans', name: 'ខ្ចី-សង តាមថ្នាក់' },
    { id: 'reading-log', name: 'ចូលអាន' },
    { id: 'locations', name: 'ទីតាំងរក្សាទុក' },
    { id: 'students', name: 'ទិន្នន័យសិស្ស' },
    { id: 'student-cards', name: 'កាតសិស្ស' },
    { id: 'settings', name: 'ការកំណត់' }
];

const populateDefaultPageSelect = (currentDefaultPage) => {
    const defaultPageSelect = document.getElementById('default-page-select');
    if (!defaultPageSelect) return;
    
    defaultPageSelect.innerHTML = '<option value="">-- សូមជ្រើសរើស --</option>';
    
    defaultPageOptions.forEach(page => {
        const option = document.createElement('option');
        option.value = page.id;
        option.textContent = page.name;
        defaultPageSelect.appendChild(option);
    });
    
    if (currentDefaultPage) {
        defaultPageSelect.value = currentDefaultPage;
    }
    
    // Add the listener once
    if (!defaultPageSelect.hasAttribute('data-listener')) {
        defaultPageSelect.addEventListener('change', saveDefaultPage);
        defaultPageSelect.setAttribute('data-listener', 'true');
    }
};

const saveDefaultPage = async () => {
    if (!currentUserId) return;
    const defaultPageSelect = document.getElementById('default-page-select');
    const pageId = defaultPageSelect.value;
    
    const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
    try {
        if (pageId) {
            await setDoc(settingsRef, { defaultPage: pageId }, { merge: true });
            // Update the global settings data
            settingsData.defaultPage = pageId;
        } else {
            await updateDoc(settingsRef, { defaultPage: deleteField() });
            // Remove from global settings data
            delete settingsData.defaultPage;
        }
        alert('បានរក្សាទុកទំព័រលំនាំដើម។ ទំព័រនេះនឹងត្រូវបានប្រើជាទំព័រដើមនៅពេលចូលប្រើប្រាស់លើកក្រោយ។');
    } catch (e) {
        console.error("Error saving default page: ", e);
        alert('ការរក្សាទុកបានបរាជ័យ។');
    }
};

// --- GOOGLE SHEET & STUDENT DATA ---
document.getElementById('save-url-btn').addEventListener('click', async () => {
    if (!currentUserId) return;
    const url = document.getElementById('google-sheet-url').value.trim();
    if (!url) { alert('សូមបញ្ចូល Link ជាមុនសិន'); return; }
    try {
        const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
        await setDoc(settingsRef, { googleSheetUrl: url }, { merge: true });
        alert('រក្សាទុក Link បានជោគជ័យ!');
    } catch (e) { console.error("Error saving URL: ", e); alert('ការរក្សាទុក Link បានបរាជ័យ។'); }
});

document.getElementById('fetch-data-btn').addEventListener('click', async () => {
    const url = document.getElementById('google-sheet-url').value.trim();
    if (!url) { alert('សូមបញ្ចូល Link Google Sheet ជាមុនសិន។'); return; }
    if (!url.includes('/pub?output=csv')) { alert('Link មិនត្រឹមត្រូវ។ សូមប្រាកដថា Link បាន Publish ជា CSV។'); return; }

    loadingOverlay.classList.remove('hidden');
    try {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const response = await fetch(proxyUrl + encodeURIComponent(url));
        if (!response.ok) { throw new Error(`Network response was not ok, status: ${response.status}`); }
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);
        if (parsedData.length === 0) { alert('មិនអាចញែកទិន្នន័យពី CSV បានទេ ឬក៏ Sheet មិនមានទិន្នន័យ។'); return; }
        await syncStudentsToFirestore(parsedData);
        alert(`បានទាញយក និងរក្សាទុកទិន្នន័យសិស្ស ${parsedData.length} នាក់ដោយជោគជ័យ។`);
    } catch (error) { console.error('Failed to fetch or process student data:', error); alert('ការទាញយកទិន្នន័យបានបរាជ័យ។ សូមពិនិត្យមើល Link, ការតភ្ជាប់ Internet, ឬសាកល្បងម្ដងទៀត។');
    } finally { loadingOverlay.classList.add('hidden'); }
});

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, index) => { obj[header] = values[index] ? values[index].trim() : ''; });
        return obj;
    });
    return data;
}

async function syncStudentsToFirestore(studentData) {
    if (!currentUserId) return;
    const studentsRef = collection(db, "users", currentUserId, "students");
    const existingStudentsSnapshot = await getDocs(studentsRef);
    const deleteBatch = writeBatch(db);
    existingStudentsSnapshot.forEach(doc => { deleteBatch.delete(doc.ref); });
    await deleteBatch.commit();
    const addBatch = writeBatch(db);
    studentData.forEach(student => { const newStudentRef = doc(studentsRef); addBatch.set(newStudentRef, student); });
    await addBatch.commit();
}

// --- BOOK MANAGEMENT ---
window.openBookModal = (id = null) => {
    const bookForm = document.getElementById('book-form');
    bookForm.reset(); document.getElementById('book-id').value = '';
    const locationSelect = document.getElementById('book-location-id');
    locationSelect.innerHTML = '<option value="">-- សូមជ្រើសរើសទីតាំង --</option>';
    locations.forEach(loc => { const option = document.createElement('option'); option.value = loc.id; option.textContent = loc.name; locationSelect.appendChild(option); });
    if (id) {
        const book = books.find(b => b.id === id);
        if (book) {
            document.getElementById('book-modal-title').textContent = 'កែសម្រួលព័ត៌មានសៀវភៅ';
            document.getElementById('book-id').value = book.id;
            document.getElementById('title').value = book.title;
            document.getElementById('author').value = book.author || '';
            document.getElementById('isbn').value = book.isbn || '';
            document.getElementById('quantity').value = book.quantity || 0;
            document.getElementById('book-location-id').value = book.locationId || '';
            document.getElementById('source').value = book.source || '';
        }
    } else { document.getElementById('book-modal-title').textContent = 'បន្ថែមសៀវភៅថ្មី'; }
    document.getElementById('book-modal').classList.remove('hidden');
};
window.closeBookModal = () => document.getElementById('book-modal').classList.add('hidden');
window.editBook = (id) => openBookModal(id);
window.deleteBook = async (id) => {
    if (!currentUserId) return;
    if (confirm('តើអ្នកពិតជាចង់លុបសៀវភៅនេះមែនទេ?')) {
        const isLoaned = loans.some(loan => loan.bookId === id && loan.status === 'ខ្ចី');
        if (isLoaned) { alert('មិនអាចលុបសៀវភៅនេះបានទេ ព្រោះកំពុងមានគេខ្ចី។'); return; }
        try { await deleteDoc(doc(db, "users", currentUserId, "books", id)); } catch (e) { console.error("Error deleting document: ", e); }
    }
};

document.getElementById('book-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) return;
    
    const id = document.getElementById('book-id').value;
    const isbnValue = document.getElementById('isbn').value.trim();
    
    const bookData = {
        title: document.getElementById('title').value,
        author: document.getElementById('author').value,
        isbn: isbnValue,
        quantity: parseInt(document.getElementById('quantity').value, 10) || 0,
        locationId: document.getElementById('book-location-id').value,
        source: document.getElementById('source').value,
    };

    if (!bookData.locationId) {
        alert('សូមជ្រើសរើសទីតាំងរក្សាទុក!');
        return;
    }

    if (bookData.isbn) {
        const booksRef = collection(db, "users", currentUserId, "books");
        const q = query(booksRef, where("isbn", "==", bookData.isbn));
        
        try {
            const querySnapshot = await getDocs(q);
            let isDuplicate = false;
            
            if (!querySnapshot.empty) {
                if (id) { 
                    if (querySnapshot.docs[0].id !== id) {
                        isDuplicate = true;
                    }
                } else { 
                    isDuplicate = true;
                }
            }

            if (isDuplicate) {
                alert(`លេខ ISBN "${bookData.isbn}" នេះមានក្នុងប្រព័ន្ធរួចហើយ។ សូមប្រើលេខផ្សេង។`);
                return; 
            }
        } catch (err) {
            console.error("Error checking for duplicate ISBN:", err);
            alert("មានបញ្ហាក្នុងការត្រួតពិនិត្យ ISBN។ សូមព្យាយាមម្តងទៀត។");
            return;
        }
    }
    
    try {
        if (id) {
            await setDoc(doc(db, "users", currentUserId, "books", id), bookData);
        } else {
            await addDoc(collection(db, "users", currentUserId, "books"), bookData);
        }
        closeBookModal();
    } catch (e) {
        console.error("Error adding/updating document: ", e);
        alert("ការរក្សាទុកទិន្នន័យបានបរាជ័យ។");
    }
});


// --- LOAN MANAGEMENT (INDIVIDUAL) ---
window.clearLoanForm = () => {
    document.getElementById('loan-form').reset();
    document.getElementById('loan-book-id').value = '';
    document.getElementById('loan-borrower-gender').value = '';
    document.getElementById('loan-book-error').textContent = '';
    document.getElementById('loan-student-error').textContent = '';
    setTimeout(() => document.getElementById('loan-isbn-input').focus(), 100);
};

document.getElementById('loan-isbn-input').addEventListener('input', () => {
    const isbn = document.getElementById('loan-isbn-input').value.trim();
    const bookIdInput = document.getElementById('loan-book-id');
    const loanBookTitleDisplay = document.getElementById('loan-book-title-display');
    const loanBookError = document.getElementById('loan-book-error');
    loanBookTitleDisplay.value = ''; bookIdInput.value = ''; loanBookError.textContent = '';
    if (!isbn) return;
    const foundBook = books.find(b => b.isbn && b.isbn.toLowerCase() === isbn.toLowerCase());
    if(foundBook) {
        const loanedCount = loans.filter(loan => loan.bookId === foundBook.id && loan.status === 'ខ្ចី').length;
        const remaining = (foundBook.quantity || 0) - loanedCount;
        if (remaining > 0) { 
            loanBookTitleDisplay.value = `${foundBook.title}`; 
            bookIdInput.value = foundBook.id; 
        } else { 
            loanBookError.textContent = 'សៀវភៅនេះអស់ពីស្តុកហើយ'; 
        }
    } else { 
        loanBookError.textContent = 'រកមិនឃើញ ISBN នេះទេ'; 
    }
});

document.getElementById('loan-student-id-input').addEventListener('input', () => {
    const studentId = document.getElementById('loan-student-id-input').value.trim();
    const loanBorrowerNameDisplay = document.getElementById('loan-borrower-name-display');
    const loanStudentError = document.getElementById('loan-student-error');
    const borrowerGenderInput = document.getElementById('loan-borrower-gender');
    loanBorrowerNameDisplay.value = ''; loanStudentError.textContent = ''; borrowerGenderInput.value = '';
    if (!studentId) return;
    const studentIdKey = students.length > 0 ? Object.keys(students[0]).find(k => k.toLowerCase().includes('អត្តលេខ')) : null;
    if (!studentIdKey) { loanStudentError.textContent = 'រកមិនឃើញជួរឈរ "អត្តលេខ" ទេ។'; return; }
    const foundStudent = students.find(s => s[studentIdKey] && s[studentIdKey].trim() === studentId);
    if (foundStudent) {
        const lastNameKey = Object.keys(foundStudent).find(k => k.includes('នាមត្រកូល'));
        const firstNameKey = Object.keys(foundStudent).find(k => k.includes('នាមខ្លួន'));
        const classKey = Object.keys(foundStudent).find(k => k.includes('ថ្នាក់'));
        const genderKey = Object.keys(foundStudent).find(k => k.includes('ភេទ'));
        const studentFullName = `${foundStudent[lastNameKey] || ''} ${foundStudent[firstNameKey] || ''}`.trim();
        const studentClass = foundStudent[classKey] || '';
        loanBorrowerNameDisplay.value = studentClass ? `${studentFullName} - ${studentClass}` : studentFullName;
        borrowerGenderInput.value = foundStudent[genderKey] || '';
    } else { 
        loanStudentError.textContent = 'រកមិនឃើញអត្តលេខសិស្សនេះទេ។'; 
    }
});

document.getElementById('loan-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    if (!currentUserId) return;
    const bookId = document.getElementById('loan-book-id').value;
    const borrower = document.getElementById('loan-borrower-name-display').value;
    if (!bookId || !borrower) { 
        alert('សូមបំពេញព័ត៌មានឲ្យបានត្រឹមត្រូវ!'); 
        return; 
    }
    const newLoan = { 
        bookId: bookId, 
        borrower: borrower, 
        borrowerGender: document.getElementById('loan-borrower-gender').value,
        loanDate: new Date().toISOString().split('T')[0], 
        returnDate: null, 
        status: 'ខ្ចី' 
    };
    try { 
        await addDoc(collection(db, "users", currentUserId, "loans"), newLoan); 
        clearLoanForm();
    } 
    catch(e) { console.error("Error adding loan: ", e); }
});

window.returnBook = async (id) => {
    if (!currentUserId) return;
    if (confirm('តើអ្នកពិតជាចង់សម្គាល់ថាសៀវភៅនេះត្រូវបានសងវិញមែនទេ?')) {
        try { await updateDoc(doc(db, "users", currentUserId, "loans", id), { status: 'សងវិញ', returnDate: new Date().toISOString().split('T')[0] }); } catch(e) { console.error("Error returning book: ", e); }
    }
};
window.deleteLoan = async (id) => {
    if (!currentUserId) return;
    if (confirm('តើអ្នកពិតជាចង់លុបកំណត់ត្រានេះមែនទេ?')) {
        try { await deleteDoc(doc(db, "users", currentUserId, "loans", id)); } catch (e) { console.error("Error deleting loan: ", e); }
    }
};

// --- LOAN MANAGEMENT (CLASS) ---
const classLoanClassSelect = document.getElementById('class-loan-class-select');
const classInfoText = document.getElementById('class-info-text');

// START: NEW function to update loan count based on checkboxes
window.updateClassLoanCount = () => {
    const checkedStudents = document.querySelectorAll('#class-loan-student-list-container input[type="checkbox"]:checked');
    document.getElementById('class-loan-quantity').value = checkedStudents.length;
};
// END: NEW function

function populateClassLoanForm() {
    document.getElementById('class-loan-form').reset();
    document.getElementById('class-loan-book-id').value = '';
    document.getElementById('class-loan-book-error').textContent = '';
    document.getElementById('class-info-text').textContent = '';
    const studentListContainer = document.getElementById('class-loan-student-list-container');
    studentListContainer.innerHTML = '';
    studentListContainer.classList.add('hidden');
    window.updateClassLoanCount(); // Reset count to 0

    const classKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('ថ្នាក់')) : null;
    classLoanClassSelect.innerHTML = '<option value="">-- សូមជ្រើសរើសថ្នាក់ --</option>';
    if (classKey) {
        const uniqueClasses = [...new Set(students.map(s => s[classKey]))].filter(Boolean).sort();
        uniqueClasses.forEach(className => {
            const option = document.createElement('option');
            option.value = className; option.textContent = className;
            classLoanClassSelect.appendChild(option);
        });
    }
}

document.getElementById('class-loan-isbn-input').addEventListener('input', () => {
    const isbn = document.getElementById('class-loan-isbn-input').value.trim();
    const bookIdInput = document.getElementById('class-loan-book-id');
    const classLoanBookTitleDisplay = document.getElementById('class-loan-book-title-display');
    const classLoanBookError = document.getElementById('class-loan-book-error');
    classLoanBookTitleDisplay.value = ''; bookIdInput.value = ''; classLoanBookError.textContent = '';
    if (!isbn) return;
    const foundBook = books.find(b => b.isbn && b.isbn.toLowerCase() === isbn.toLowerCase());
    if(foundBook) {
        const loanedCount = loans.filter(loan => loan.bookId === foundBook.id && loan.status === 'ខ្ចី').length;
        const remaining = (foundBook.quantity || 0) - loanedCount;
        classLoanBookTitleDisplay.value = `${foundBook.title} (នៅសល់ ${remaining})`;
        bookIdInput.value = foundBook.id;
    } else { classLoanBookError.textContent = 'រកមិនឃើញ ISBN នេះទេ'; }
});

// START: MODIFIED event listener for class selection
classLoanClassSelect.addEventListener('change', () => {
    const className = classLoanClassSelect.value;
    const studentListContainer = document.getElementById('class-loan-student-list-container');
    
    studentListContainer.innerHTML = ''; // Clear previous list
    studentListContainer.classList.add('hidden'); // Hide by default

    if (!className) {
        classInfoText.textContent = '';
        window.updateClassLoanCount(); // Update count to 0
        return;
    }

    const classKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('ថ្នាក់')) : null;
    if (!classKey) {
        classInfoText.textContent = 'Error: Cannot find class data.';
        return;
    }
    const studentsInClass = students.filter(s => s[classKey] === className);

    classInfoText.textContent = `ថ្នាក់នេះមានសិស្ស ${studentsInClass.length} នាក់`;

    if (studentsInClass.length > 0) {
        studentListContainer.classList.remove('hidden');
        const lastNameKey = Object.keys(studentsInClass[0]).find(k => k.includes('នាមត្រកូល'));
        const firstNameKey = Object.keys(studentsInClass[0]).find(k => k.includes('នាមខ្លួន'));
        const genderKey = Object.keys(studentsInClass[0]).find(k => k.includes('ភេទ'));

        const listGrid = document.createElement('div');
        listGrid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2';

        studentsInClass.forEach(student => {
            const studentFullName = `${student[lastNameKey] || ''} ${student[firstNameKey] || ''}`.trim();
            const studentGender = student[genderKey] || '';

            const label = document.createElement('label');
            label.className = 'flex items-center space-x-2 p-1 rounded hover:bg-gray-200 cursor-pointer';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-checkbox h-4 w-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500';
            checkbox.checked = true; // Default to checked
            checkbox.dataset.fullName = studentFullName;
            checkbox.dataset.gender = studentGender;
            
            checkbox.addEventListener('change', window.updateClassLoanCount);

            const span = document.createElement('span');
            span.className = 'text-gray-800 text-sm';
            span.textContent = studentFullName;

            label.appendChild(checkbox);
            label.appendChild(span);
            listGrid.appendChild(label);
        });
        studentListContainer.appendChild(listGrid);
    }
    // Initial count update
    window.updateClassLoanCount();
});
// END: MODIFIED event listener

// START: MODIFIED form submission logic
document.getElementById('class-loan-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    if (!currentUserId) return;

    const bookId = document.getElementById('class-loan-book-id').value;
    const className = classLoanClassSelect.value;
    const checkedStudentCheckboxes = document.querySelectorAll('#class-loan-student-list-container input[type="checkbox"]:checked');
    const quantity = checkedStudentCheckboxes.length;

    if (!bookId || !className || quantity === 0) {
        alert('សូមជ្រើសរើសសៀវភៅ, ថ្នាក់, និងសិស្សយ៉ាងហោចណាស់ម្នាក់។');
        return;
    }
    
    const selectedBook = books.find(b => b.id === bookId);
    if (!selectedBook) {
        alert('រកមិនឃើញព័ត៌មានសៀវភៅទេ។');
        return;
    }
    const currentlyLoanedCount = loans.filter(l => l.bookId === bookId && l.status === 'ខ្ចី').length;
    const availableCopies = selectedBook.quantity - currentlyLoanedCount;

    if (quantity > availableCopies) {
        alert(`សៀវភៅមិនគ្រប់គ្រាន់! អ្នកចង់ខ្ចី ${quantity} ក្បាល, ប៉ុន្តែនៅសល់តែ ${availableCopies} ក្បាលសម្រាប់ខ្ចី។`);
        return;
    }

    loadingOverlay.classList.remove('hidden');
    try {
        const batch = writeBatch(db);
        const today = new Date().toISOString().split('T')[0];
        
        const newClassLoanRef = doc(collection(db, "users", currentUserId, "classLoans"));
        batch.set(newClassLoanRef, { 
            bookId: bookId, 
            className: className, 
            loanedQuantity: quantity, 
            loanDate: today, 
            returnedCount: 0, 
            status: 'ខ្ចី' 
        });
        
        const loansRef = collection(db, "users", currentUserId, "loans");
        
        checkedStudentCheckboxes.forEach(checkbox => {
            const borrowerText = `${checkbox.dataset.fullName} - ${className}`;
            const newLoan = { 
                bookId: bookId, 
                borrower: borrowerText, 
                loanDate: today, 
                returnDate: null, 
                status: 'ខ្ចី', 
                classLoanId: newClassLoanRef.id, 
                borrowerGender: checkbox.dataset.gender || '' 
            };
            batch.set(doc(loansRef), newLoan);
        });

        await batch.commit();
        populateClassLoanForm(); // Reset the form completely
    } catch (err) { 
        console.error("Error creating class loan: ", err); 
        alert("មានបញ្ហាកើតឡើងពេលបង្កើតកំណត់ត្រា។");
    } finally { 
        loadingOverlay.classList.add('hidden'); 
    }
});
// END: MODIFIED form submission logic

window.openClassReturnModal = (id) => {
    const classReturnForm = document.getElementById('class-return-form');
    classReturnForm.reset();
    const classLoan = classLoans.find(cl => cl.id === id);
    if (!classLoan) return;
    const book = books.find(b => b.id === classLoan.bookId);
    document.getElementById('class-return-loan-id').value = id;
    document.getElementById('class-return-book-title').textContent = book ? book.title : 'N/A';
    document.getElementById('class-return-class-name').textContent = classLoan.className;
    document.getElementById('class-return-total-students').textContent = classLoan.loanedQuantity;
    document.getElementById('class-return-already-returned').textContent = classLoan.returnedCount || 0;
    const numberInput = document.getElementById('number-to-return');
    const maxReturn = classLoan.loanedQuantity - (classLoan.returnedCount || 0);
    numberInput.max = maxReturn;
    numberInput.placeholder = `អតិបរមា ${maxReturn}`;
    document.getElementById('class-return-modal').classList.remove('hidden');
};

window.closeClassReturnModal = () => document.getElementById('class-return-modal').classList.add('hidden');

document.getElementById('class-return-form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!currentUserId) return;
    const id = document.getElementById('class-return-loan-id').value;
    const numberToReturn = parseInt(document.getElementById('number-to-return').value, 10);
    const classLoan = classLoans.find(cl => cl.id === id);
    if (!classLoan) return;
    const maxReturn = classLoan.loanedQuantity - (classLoan.returnedCount || 0);
    if (isNaN(numberToReturn) || numberToReturn <= 0 || numberToReturn > maxReturn) { alert(`សូមបញ្ចូលចំនួន hợp lệ ما بين 1 និង ${maxReturn}។`); return; }
    loadingOverlay.classList.remove('hidden');
    try {
        const batch = writeBatch(db);
        const classLoanRef = doc(db, "users", currentUserId, "classLoans", id);
        const q = query(collection(db, "users", currentUserId, "loans"), where("classLoanId", "==", id), where("status", "==", "ខ្ចី"));
        const querySnapshot = await getDocs(q);
        const loansToUpdate = querySnapshot.docs.slice(0, numberToReturn);
        const today = new Date().toISOString().split('T')[0];
        loansToUpdate.forEach(doc => { batch.update(doc.ref, { status: 'សងវិញ', returnDate: today }); });
        const newReturnedCount = (classLoan.returnedCount || 0) + numberToReturn;
        const newStatus = newReturnedCount >= classLoan.loanedQuantity ? 'សង hết' : 'សងខ្លះ';
        batch.update(classLoanRef, { returnedCount: increment(numberToReturn), status: newStatus });
        await batch.commit();
        closeClassReturnModal();
    } catch (err) { console.error("Error updating class loan return: ", err); alert("មានបញ្ហាក្នុងការរក្សាទុកការសង។");
    } finally { loadingOverlay.classList.add('hidden'); }
});

window.openClassLoanEditModal = (id) => {
    const classLoan = classLoans.find(cl => cl.id === id);
    if (!classLoan) return;
    const book = books.find(b => b.id === classLoan.bookId);
    document.getElementById('class-loan-edit-id').value = id;
    document.getElementById('class-loan-edit-book-title').textContent = book ? book.title : 'N/A';
    document.getElementById('class-loan-edit-class-name').textContent = classLoan.className;
    document.getElementById('class-loan-edit-date').value = classLoan.loanDate;
    document.getElementById('class-loan-edit-modal').classList.remove('hidden');
};

window.closeClassLoanEditModal = () => document.getElementById('class-loan-edit-modal').classList.add('hidden');

document.getElementById('class-loan-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!currentUserId) return;
    const id = document.getElementById('class-loan-edit-id').value;
    const newDate = document.getElementById('class-loan-edit-date').value;
    if (!newDate) { alert("សូមជ្រើសរើសកាលបរិច្ឆេទ។"); return; }
    loadingOverlay.classList.remove('hidden');
    try {
        const batch = writeBatch(db);
        const classLoanRef = doc(db, "users", currentUserId, "classLoans", id);
        batch.update(classLoanRef, { loanDate: newDate });
        const q = query(collection(db, "users", currentUserId, "loans"), where("classLoanId", "==", id));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => { batch.update(doc.ref, { loanDate: newDate }); });
        await batch.commit();
        alert("បានកែប្រែកាលបរិច្ឆេទខ្ចីដោយជោគជ័យ។");
        closeClassLoanEditModal();
    } catch (err) { console.error("Error editing class loan date: ", err); alert("ការកែប្រែបានបរាជ័យ។");
    } finally { loadingOverlay.classList.add('hidden'); }
});

window.deleteClassLoan = async (id) => {
    if (!currentUserId) return;
    if (confirm('តើអ្នកពិតជាចង់លុបប្រវត្តិនៃការខ្ចីតាមថ្នាក់នេះមែនទេ? ការធ្វើបែបនេះនឹងលុបកំណត់ត្រាខ្ចីរបស់សិស្សទាំងអស់ដែលពាក់ព័ន្ធនឹងการខ្ចីនេះ។')) {
        loadingOverlay.classList.remove('hidden');
        try {
            const batch = writeBatch(db);
            const q = query(collection(db, "users", currentUserId, "loans"), where("classLoanId", "==", id));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => { batch.delete(doc.ref); });
            const classLoanRef = doc(db, "users", currentUserId, "classLoans", id);
            batch.delete(classLoanRef);
            await batch.commit();
        } catch (e) { console.error("Error deleting class loan and associated loans: ", e); alert("ការលុបបានបរាជ័យ។");
        } finally { loadingOverlay.classList.add('hidden'); }
    }
};

// --- LOCATION MANAGEMENT ---
window.openLocationModal = (id = null) => {
    const locationForm = document.getElementById('location-form');
    locationForm.reset(); document.getElementById('location-id').value = '';
    if (id) {
        const loc = locations.find(l => l.id === id);
        if (loc) {
            document.getElementById('location-modal-title').textContent = 'កែសម្រួលទីតាំង';
            document.getElementById('location-id').value = loc.id;
            document.getElementById('location-name').value = loc.name;
            document.getElementById('location-source').value = loc.source || '';
            document.getElementById('location-year').value = loc.year || '';
        }
    } else { document.getElementById('location-modal-title').textContent = 'បន្ថែមទីតាំងថ្មី'; }
    document.getElementById('location-modal').classList.remove('hidden');
};
window.closeLocationModal = () => document.getElementById('location-modal').classList.add('hidden');
window.editLocation = (id) => openLocationModal(id);
window.deleteLocation = async (id) => {
    if (!currentUserId) return;
    if (confirm('តើអ្នកពិតជាចង់លុបទីតាំងនេះមែនទេ?')) {
        const isUsed = books.some(book => book.locationId === id);
        if (isUsed) { alert('មិនអាចលុបទីតាំងនេះបានទេ ព្រោះកំពុងប្រើប្រាស់ដោយសៀវភៅ។'); return; }
        try { await deleteDoc(doc(db, "users", currentUserId, "locations", id)); } catch (e) { console.error("Error deleting location: ", e); }
    }
};
document.getElementById('location-form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!currentUserId) return;
    const id = document.getElementById('location-id').value;
    const locData = { name: document.getElementById('location-name').value, source: document.getElementById('location-source').value, year: document.getElementById('location-year').value, };
    try { if (id) { await setDoc(doc(db, "users", currentUserId, "locations", id), locData); } else { await addDoc(collection(db, "users", currentUserId, "locations"), locData); } closeLocationModal(); } catch (e) { console.error("Error adding/updating location: ", e); }
});

// --- STUDENT MANAGEMENT ---
window.openStudentModal = (id = null) => {
    const studentForm = document.getElementById('student-form');
    studentForm.reset();
    document.getElementById('student-id').value = '';
    const modalTitle = document.getElementById('student-modal-title');
    
    if (id) {
        const student = students.find(s => s.id === id);
        if (student) {
            modalTitle.textContent = 'កែសម្រួលព័ត៌មានសិស្ស';
            document.getElementById('student-id').value = student.id;
            document.getElementById('student-no').value = student['ល.រ'] || '';
            document.getElementById('student-code').value = student['អត្តលេខ'] || '';
            document.getElementById('student-lastname').value = student['នាមត្រកូល'] || '';
            document.getElementById('student-firstname').value = student['នាមខ្លួន'] || '';
            document.getElementById('student-gender').value = student['ភេទ'] || 'ប្រុស';
            document.getElementById('student-dob').value = student['ថ្ងៃខែឆ្នាំកំណើត'] || '';
            document.getElementById('student-class').value = student['ថ្នាក់'] || '';
            document.getElementById('student-photo-url').value = student['រូបថត URL'] || '';
        }
    } else {
        modalTitle.textContent = 'បន្ថែមសិស្សថ្មី';
        // Intelligent "ល.រ" logic
        let nextStudentNo = 1;
        if (students.length > 0) {
            const existingNos = students
                .map(s => parseInt(s['ល.រ'], 10))
                .filter(n => !isNaN(n));
            
            const noSet = new Set(existingNos);
            let i = 1;
            while (true) {
                if (!noSet.has(i)) {
                    nextStudentNo = i;
                    break;
                }
                i++;
            }
        }
        document.getElementById('student-no').value = nextStudentNo;
    }
    document.getElementById('student-modal').classList.remove('hidden');
};

window.closeStudentModal = () => {
    document.getElementById('student-modal').classList.add('hidden');
};

window.deleteStudent = async (id) => {
    if (!currentUserId) return;
    if (confirm('តើអ្នកពិតជាចង់លុបข้อมูลសិស្សនេះមែនទេ?')) {
        try {
            await deleteDoc(doc(db, "users", currentUserId, "students", id));
        } catch (e) {
            console.error("Error deleting student: ", e);
            alert("ការលុបបានបរាជ័យ។");
        }
    }
};

document.getElementById('student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) return;

    const studentId = document.getElementById('student-id').value;
    const studentData = {
        'ល.រ': document.getElementById('student-no').value,
        'អត្តលេខ': document.getElementById('student-code').value,
        'នាមត្រកូល': document.getElementById('student-lastname').value,
        'នាមខ្លួន': document.getElementById('student-firstname').value,
        'ភេទ': document.getElementById('student-gender').value,
        'ថ្ងៃខែឆ្នាំកំណើត': document.getElementById('student-dob').value,
        'ថ្នាក់': document.getElementById('student-class').value,
        'រូបថត URL': document.getElementById('student-photo-url').value,
    };

    if (!studentData['អត្តលេខ'] || !studentData['នាមត្រកូល'] || !studentData['នាមខ្លួន']) {
        alert('សូមបំពេញអត្តលេខ, នាមត្រកូល, និងនាមខ្លួន។');
        return;
    }

    try {
        if (studentId) {
            // Update existing student
            await setDoc(doc(db, "users", currentUserId, "students", studentId), studentData);
        } else {
            // Add new student
            await addDoc(collection(db, "users", currentUserId, "students"), studentData);
        }
        closeStudentModal();
    } catch (err) {
        console.error("Error saving student data: ", err);
        alert("ការរក្សាទុកទិន្នន័យសិស្សបានបរាជ័យ។");
    }
});


// --- READING LOG MANAGEMENT ---
let isbnScanTimer = null;

// MODIFIED: Prevent Enter key from submitting the form and handle scan flow
document.getElementById('reading-log-form').addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault(); // Always prevent the default form submission on Enter

        const activeElement = document.activeElement;

        // If Enter is pressed in the student ID field, move focus to the ISBN field
        if (activeElement && activeElement.id === 'reading-log-student-id') {
            document.getElementById('reading-log-isbn-input').focus();
            return; 
        }

        // If Enter is pressed in the ISBN field, process the ISBN immediately
        if (activeElement && activeElement.id === 'reading-log-isbn-input') {
            clearTimeout(isbnScanTimer); // Stop any pending input event timer
            
            const isbnInput = document.getElementById('reading-log-isbn-input');
            const isbn = isbnInput.value.trim();
            if (!isbn) return;

            const foundBook = books.find(b => b.isbn && b.isbn.toLowerCase() === isbn.toLowerCase());
            if (foundBook) {
                if (!currentScannedBooks.some(b => b.id === foundBook.id)) {
                    currentScannedBooks.push({ id: foundBook.id, title: foundBook.title });
                    const li = document.createElement('li');
                    li.textContent = foundBook.title;
                    document.getElementById('scanned-books-list').appendChild(li);
                }
                isbnInput.value = ''; // Clear input after successful scan
            }
            // If book is not found, do nothing, leave the value for correction.
        }
    }
});

window.clearReadingLogForm = () => {
    document.getElementById('reading-log-form').reset();
    document.getElementById('reading-log-student-name').value = '';
    document.getElementById('reading-log-student-obj-id').value = '';
    document.getElementById('reading-log-student-error').textContent = '';
    document.getElementById('scanned-books-list').innerHTML = '';
    currentScannedBooks = [];
    currentStudentGender = '';
    document.getElementById('reading-log-student-id').focus();
};

document.getElementById('reading-log-student-id').addEventListener('input', () => {
    const studentId = document.getElementById('reading-log-student-id').value.trim();
    const studentNameInput = document.getElementById('reading-log-student-name');
    const studentObjIdInput = document.getElementById('reading-log-student-obj-id');
    const studentError = document.getElementById('reading-log-student-error');
    studentNameInput.value = ''; studentObjIdInput.value = ''; studentError.textContent = ''; currentStudentGender = '';
    if (!studentId) return;
    const studentIdKey = students.length > 0 ? Object.keys(students[0]).find(k => k.toLowerCase().includes('អត្តលេខ')) : null;
    if (!studentIdKey) { studentError.textContent = 'រកមិនឃើញជួរឈរ "អត្តលេខ" ទេ។'; return; }
    const foundStudent = students.find(s => s[studentIdKey] && s[studentIdKey].trim() === studentId);
    if (foundStudent) {
        const lastNameKey = Object.keys(foundStudent).find(k => k.includes('នាមត្រកូល'));
        const firstNameKey = Object.keys(foundStudent).find(k => k.includes('នាមខ្លួន'));
        const classKey = Object.keys(foundStudent).find(k => k.includes('ថ្នាក់'));
        const genderKey = Object.keys(foundStudent).find(k => k.includes('ភេទ'));
        const studentFullName = `${foundStudent[lastNameKey] || ''} ${foundStudent[firstNameKey] || ''}`.trim();
        const studentClass = foundStudent[classKey] || '';
        studentNameInput.value = studentClass ? `${studentFullName} - ${studentClass}` : studentFullName;
        studentObjIdInput.value = foundStudent.id;
        currentStudentGender = foundStudent[genderKey] || '';
        document.getElementById('reading-log-isbn-input').focus();
    } else { studentError.textContent = 'រកមិនឃើញអត្តលេខសិស្សនេះទេ។'; }
});

document.getElementById('reading-log-isbn-input').addEventListener('input', () => {
    clearTimeout(isbnScanTimer);
    isbnScanTimer = setTimeout(() => {
        const isbnInput = document.getElementById('reading-log-isbn-input');
        const isbn = isbnInput.value.trim();
        if (!isbn) return;
        const foundBook = books.find(b => b.isbn && b.isbn.toLowerCase() === isbn.toLowerCase());
        if (foundBook) {
            if (!currentScannedBooks.some(b => b.id === foundBook.id)) {
                currentScannedBooks.push({ id: foundBook.id, title: foundBook.title });
                const li = document.createElement('li');
                li.textContent = foundBook.title;
                document.getElementById('scanned-books-list').appendChild(li);
            }
            isbnInput.value = '';
        }
    }, 300); 
});

document.getElementById('reading-log-form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!currentUserId) return;
    const studentId = document.getElementById('reading-log-student-obj-id').value;
    const studentName = document.getElementById('reading-log-student-name').value;
    if (!studentId || !studentName) { alert('សូមស្កេនអត្តលេខសិស្សជាមុនសិន។'); return; }
    if (currentScannedBooks.length === 0) { alert('សូមស្កេនសៀវភៅយ៉ាងហោចណាស់មួយក្បាល។'); return; }
    const logData = { studentId: studentId, studentName: studentName, studentGender: currentStudentGender, books: currentScannedBooks, dateTime: new Date().toISOString() };
    try { await addDoc(collection(db, "users", currentUserId, "readingLogs"), logData); window.clearReadingLogForm(); } 
    catch (err) { console.error("Error saving reading log: ", err); alert("ការរក្សាទុកកំណត់ត្រាចូលអានបានបរាជ័យ។"); }
});

window.deleteReadingLog = async (id) => {
     if (!currentUserId) return;
     if (confirm('តើអ្នកពិតជាចង់លុបកំណត់ត្រាចូលអាននេះមែនទេ?')) {
         try { await deleteDoc(doc(db, "users", currentUserId, "readingLogs", id)); } 
         catch (e) { console.error("Error deleting reading log: ", e); alert("ការលុបបានបរាជ័យ។"); }
     }
};

// --- EXPORT DATA TO EXCEL ---
const exportData = () => {
    const select = document.getElementById('export-data-select');
    const dataType = select.value;

    if (!dataType) {
        alert('សូមជ្រើសរើសប្រភេទទិន្នន័យដែលត្រូវនាំចេញជាមុនសិន។');
        return;
    }

    let dataToExport = [];
    let fileName = `${dataType}_export.xlsx`;
    
    switch (dataType) {
        case 'books':
            dataToExport = books.map(book => {
                const location = locations.find(loc => loc.id === book.locationId);
                return {
                    'ចំណងជើង': book.title,
                    'អ្នកនិពន្ធ': book.author,
                    'ISBN': book.isbn,
                    'ចំនួនសរុប': book.quantity,
                    'ទីតាំង': location ? location.name : 'N/A',
                    'ប្រភព': book.source
                };
            });
            break;
        case 'loans':
            dataToExport = loans.filter(l => !l.classLoanId).map(loan => {
                const book = books.find(b => b.id === loan.bookId);
                return {
                    'សៀវភៅ': book ? book.title : 'N/A',
                    'អ្នកខ្ចី': loan.borrower,
                    'ភេទ': loan.borrowerGender,
                    'ថ្ងៃខ្ចី': loan.loanDate,
                    'ថ្ងៃសង': loan.returnDate,
                    'ស្ថានភាព': loan.status
                };
            });
            break;
        case 'class-loans':
            dataToExport = classLoans.map(loan => {
                const book = books.find(b => b.id === loan.bookId);
                return {
                    'សៀវភៅ': book ? book.title : 'N/A',
                    'ថ្នាក់': loan.className,
                    'ថ្ងៃខ្ចី': loan.loanDate,
                    'ចំនួនខ្ចី': loan.loanedQuantity,
                    'ចំនួនបានសង': loan.returnedCount || 0,
                    'ស្ថានភាព': loan.status
                };
            });
            break;
        case 'reading-logs':
            dataToExport = readingLogs.map(log => ({
                'កាលបរិច្ឆេទ': new Date(log.dateTime).toLocaleString('en-GB'),
                'ឈ្មោះសិស្ស': log.studentName,
                'ភេទ': log.studentGender,
                'សៀវភៅបានអាន': log.books.map(b => b.title).join('; ')
            }));
            break;
        case 'locations':
            dataToExport = locations.map(loc => ({
                'ឈ្មោះទីតាំង': loc.name,
                'ប្រភពធ្នើ': loc.source,
                'ឆ្នាំ': loc.year
            }));
            break;
        case 'students':
            dataToExport = students.map(std => {
                // Create a new object to control property order
                const studentData = {};
                studentData['ល.រ'] = std['ល.រ'];
                studentData['អត្តលេខ'] = std['អត្តលេខ'];
                studentData['នាមត្រកូល'] = std['នាមត្រកូល'];
                studentData['នាមខ្លួន'] = std['នាមខ្លួន'];
                studentData['ភេទ'] = std['ភេទ'];
                studentData['ថ្ងៃខែឆ្នាំកំណើត'] = std['ថ្ងៃខែឆ្នាំកំណើត'];
                studentData['ថ្នាក់'] = std['ថ្នាក់'];
                studentData['រូបថត URL'] = std['រូបថត URL'];
                return studentData;
            });
            break;
        case 'settings':
            dataToExport = Object.entries(settingsData).map(([key, value]) => ({
                'ការកំណត់': key,
                'តម្លៃ': value
            }));
            break;
    }

    if (dataToExport.length === 0) {
        alert('មិនមានទិន្នន័យសម្រាប់នាំចេញទេ។');
        return;
    }

    // Using SheetJS to create and download the Excel file
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, fileName);
};


// --- SETTINGS & DATA DELETION ---
window.openPasswordConfirmModal = (collectionName) => {
    document.getElementById('collection-to-delete').value = collectionName;
    document.getElementById('password-confirm-modal').classList.remove('hidden');
    document.getElementById('user-password').focus();
    document.getElementById('password-error').textContent = '';
};

window.closePasswordConfirmModal = () => {
    document.getElementById('password-confirm-modal').classList.add('hidden');
    document.getElementById('password-confirm-form').reset();
};

document.getElementById('password-confirm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const password = document.getElementById('user-password').value;
    const collectionName = document.getElementById('collection-to-delete').value;
    const passwordError = document.getElementById('password-error');
    passwordError.textContent = '';

    if (!password || !collectionName) return;

    loadingOverlay.classList.remove('hidden');

    const credential = EmailAuthProvider.credential(user.email, password);
    
    try {
        await reauthenticateWithCredential(user, credential);
        // Re-authentication successful, proceed with deletion
        await deleteAllData(collectionName);
        closePasswordConfirmModal();
    } catch (error) {
        console.error("Re-authentication failed:", error);
        passwordError.textContent = "ពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ។";
    } finally {
        loadingOverlay.classList.add('hidden');
    }
});

async function deleteAllData(collectionName) {
    if (!currentUserId) return;
    
    const collectionRef = collection(db, "users", currentUserId, collectionName);
    try {
        const querySnapshot = await getDocs(collectionRef);
        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        alert(`បានលុបទិន្នន័យទាំងអស់ក្នុង "${collectionName}" ដោយជោគជ័យ។`);
    } catch (error) {
        console.error(`Error deleting all documents from ${collectionName}:`, error);
        alert(`ការលុបទិន្នន័យក្នុង "${collectionName}" បានបរាជ័យ។`);
    }
}

// --- SETTINGS GENERAL INFO LISTENERS ---
const saveSchoolNameBtn = document.getElementById('save-school-name-btn');
const editSchoolNameBtn = document.getElementById('edit-school-name-btn');
const deleteSchoolNameBtn = document.getElementById('delete-school-name-btn');
const schoolNameInput = document.getElementById('school-name-input');
const schoolNameDisplay = document.getElementById('school-name-display');

saveSchoolNameBtn.addEventListener('click', async () => {
    const name = schoolNameInput.value.trim();
    if (!name) { alert('សូមបញ្ចូលឈ្មោះសាលា។'); return; }
    const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
    try {
        await setDoc(settingsRef, { schoolName: name }, { merge: true });
        alert('រក្សាទុកឈ្មោះសាលាបានជោគជ័យ។');
    } catch (e) { console.error(e); alert('ការរក្សាទុកបានបរាជ័យ។'); }
});

editSchoolNameBtn.addEventListener('click', () => {
    schoolNameDisplay.classList.add('hidden');
    schoolNameInput.classList.remove('hidden');
    saveSchoolNameBtn.classList.remove('hidden');
    editSchoolNameBtn.classList.add('hidden');
    deleteSchoolNameBtn.classList.add('hidden');
    schoolNameInput.focus();
});

deleteSchoolNameBtn.addEventListener('click', async () => {
    if (confirm('តើអ្នកពិតជាចង់លុបឈ្មោះសាលាមែនទេ?')) {
        const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
        try {
            await updateDoc(settingsRef, { schoolName: deleteField() });
            alert('បានលុបឈ្មោះសាលា។');
        } catch (e) { console.error(e); alert('ការលុបបានបរាជ័យ។'); }
    }
});

// Academic Year Listeners
const saveAcademicYearBtn = document.getElementById('save-academic-year-btn');
const editAcademicYearBtn = document.getElementById('edit-academic-year-btn');
const deleteAcademicYearBtn = document.getElementById('delete-academic-year-btn');
const academicYearInput = document.getElementById('academic-year-input');
const academicYearDisplay = document.getElementById('academic-year-display');

saveAcademicYearBtn.addEventListener('click', async () => {
    const year = academicYearInput.value.trim();
    if (!year) { alert('សូមបញ្ចូលឆ្នាំសិក្សា។'); return; }
    const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
    try {
        await setDoc(settingsRef, { academicYear: year }, { merge: true });
        alert('រក្សាទុកឆ្នាំសិក្សាបានជោគជ័យ។');
    } catch (e) { console.error(e); alert('ការរក្សាទុកបានបរាជ័យ។'); }
});

editAcademicYearBtn.addEventListener('click', () => {
    academicYearDisplay.classList.add('hidden');
    academicYearInput.classList.remove('hidden');
    saveAcademicYearBtn.classList.remove('hidden');
    editAcademicYearBtn.classList.add('hidden');
    deleteAcademicYearBtn.classList.add('hidden');
    academicYearInput.focus();
});

deleteAcademicYearBtn.addEventListener('click', async () => {
    if (confirm('តើអ្នកពិតជាចង់លុបឆ្នាំសិក្សាមែនទេ?')) {
        const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
        try {
            await updateDoc(settingsRef, { academicYear: deleteField() });
            alert('បានលុបឆ្នាំសិក្សា។');
        } catch (e) { console.error(e); alert('ការលុបបានបរាជ័យ។'); }
    }
});


const sealImageUrlInput = document.getElementById('seal-image-url');
const sealImagePreview = document.getElementById('seal-image-preview');
const saveSealUrlBtn = document.getElementById('save-seal-url-btn');

sealImageUrlInput.addEventListener('input', () => {
    const url = sealImageUrlInput.value.trim();
    if (url) {
        sealImagePreview.src = url;
    } else {
        sealImagePreview.src = 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Preview';
    }
});

sealImagePreview.onerror = () => {
    sealImagePreview.src = 'https://placehold.co/100x100/e2e8f0/ff0000?text=Error';
};

saveSealUrlBtn.addEventListener('click', async () => {
    const url = sealImageUrlInput.value.trim();
    const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
    try {
        if (url) {
            await setDoc(settingsRef, { sealImageUrl: url }, { merge: true });
            alert('រក្សាទុក URL ត្រាបានជោគជ័យ។');
        } else {
            await updateDoc(settingsRef, { sealImageUrl: deleteField() });
            alert('បានលុប URL ត្រា។');
        }
    } catch (e) { console.error(e); alert('ការរក្សាទុកបានបរាជ័យ។'); }
});

// Card Background Listeners
const cardBgUrlInput = document.getElementById('card-bg-url');
const cardBgPreview = document.getElementById('card-bg-preview');
const saveCardBgBtn = document.getElementById('save-card-bg-btn');

cardBgUrlInput.addEventListener('input', () => {
    const url = cardBgUrlInput.value.trim();
    cardBgPreview.src = url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=Preview';
});

cardBgPreview.onerror = () => {
    cardBgPreview.src = 'https://placehold.co/100x100/e2e8f0/ff0000?text=Error';
};

saveCardBgBtn.addEventListener('click', async () => {
    const url = cardBgUrlInput.value.trim();
    const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
    try {
        if (url) {
            await setDoc(settingsRef, { cardBgUrl: url }, { merge: true });
            alert('រក្សាទុក URL ផ្ទៃខាងក្រោយកាតបានជោគជ័យ។');
        } else {
            await updateDoc(settingsRef, { cardBgUrl: deleteField() });
            alert('បានលុប URL ផ្ទៃខាងក្រោយកាត។');
        }
    } catch (e) { console.error(e); alert('ការរក្សាទុកបានបរាជ័យ។'); }
});


// --- CHANGE PASSWORD LISTENER ---
const changePasswordForm = document.getElementById('change-password-form');
changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const errorP = document.getElementById('change-password-error');
    const successP = document.getElementById('change-password-success');

    errorP.textContent = '';
    successP.textContent = '';

    if (newPassword !== confirmPassword) {
        errorP.textContent = 'ពាក្យសម្ងាត់ថ្មី និងការยืนยันមិនตรงគ្នាទេ។';
        return;
    }
    if (newPassword.length < 6) {
        errorP.textContent = 'ពាក្យសម្ងាត់ថ្មីត្រូវមានอย่างน้อย 6 ตัวอักษร។';
        return;
    }

    loadingOverlay.classList.remove('hidden');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);

    try {
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        successP.textContent = 'ផ្លាស់ប្តូរពាក្យសម្ងាត់បានជោគជ័យ!';
        changePasswordForm.reset();
    } catch (error) {
        console.error("Password change failed:", error);
        if (error.code === 'auth/wrong-password') {
            errorP.textContent = 'ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវទេ។';
        } else {
            errorP.textContent = 'ការផ្លាស់ប្តូរពាក្យសម្ងាត់បានបរាជ័យ។';
        }
    } finally {
        loadingOverlay.classList.add('hidden');
    }
});


// --- FILTER BUTTON LISTENERS ---
document.getElementById('loan-filter-btn').addEventListener('click', renderLoans);
document.getElementById('loan-reset-btn').addEventListener('click', () => {
    document.getElementById('loan-filter-start-date').value = '';
    document.getElementById('loan-filter-end-date').value = '';
    renderLoans();
});
document.getElementById('class-loan-filter-select').addEventListener('change', renderClassLoans);
document.getElementById('class-loan-reset-btn').addEventListener('click', () => {
    document.getElementById('class-loan-filter-select').value = '';
    renderClassLoans();
});
document.getElementById('reading-log-filter-btn').addEventListener('click', renderReadingLogs);
document.getElementById('reading-log-reset-btn').addEventListener('click', () => {
    document.getElementById('reading-log-filter-start-date').value = '';
    document.getElementById('reading-log-filter-end-date').value = '';
    renderReadingLogs();
});

// --- PRINTING ---
const prepareAndPrint = (printClass) => {
    document.body.classList.add(printClass);
    window.print();
};

window.printReport = () => {
    const activePage = document.querySelector('.page:not(.hidden)');
    if (activePage) {
        const titleSpan = document.getElementById('print-report-title');
        let title = '';
        const pageId = activePage.id;

        switch (pageId) {
            case 'page-books':
                title = 'បញ្ជីសៀវភៅ';
                break;
            case 'page-loans':
                const startDateLoans = document.getElementById('loan-filter-start-date').value;
                const endDateLoans = document.getElementById('loan-filter-end-date').value;
                title = 'បញ្ជីការខ្ចី-សងបុគ្គល';
                if (startDateLoans && endDateLoans) {
                    title += ` ពីថ្ងៃ ${startDateLoans} ដល់ថ្ងៃ ${endDateLoans}`;
                }
                break;
            case 'page-class-loans':
                title = 'បញ្ជីការខ្ចីតាមថ្នាក់';
                break;
            case 'page-reading-log':
                const startDateLogs = document.getElementById('reading-log-filter-start-date').value;
                const endDateLogs = document.getElementById('reading-log-filter-end-date').value;
                title = 'បញ្ជីកត់ត្រាការចូលអាន';
                if (startDateLogs && endDateLogs) {
                    title += ` ពីថ្ងៃ ${startDateLogs} ដល់ថ្ងៃ ${endDateLogs}`;
                }
                break;
            case 'page-locations':
                title = 'បញ្ជីទីតាំងរក្សាទុកសៀវភៅ';
                break;
            case 'page-students':
                const academicYear = settingsData.academicYear || '';
                const studentClassFilter = document.getElementById('student-class-filter');
                const selectedClass = studentClassFilter.value;
                
                title = 'បញ្ជីឈ្មោះសិស្ស';
                
                if (selectedClass) {
                    title += ` ថ្នាក់ទី ${selectedClass}`;
                }

                if (academicYear) {
                    title += ` ឆ្នាំសិក្សា ${academicYear}`;
                }
                break;
        }
        titleSpan.textContent = title;
        prepareAndPrint(`printing-${pageId}`);
    }
};

// MODIFIED FUNCTION: Adds a longer delay to ensure all elements are rendered before printing.
window.printCards = () => {
    // Add the printing class to the body
    document.body.classList.add('printing-page-student-cards');
    
    // Use a timeout to allow the browser to render all QR codes and barcodes
    // before opening the print dialog. This fixes issues with missing elements on later pages.
    setTimeout(() => {
        window.print();
    }, 3000); // Increased delay to 3 seconds for larger datasets
};

window.onafterprint = () => {
    const printClasses = Array.from(document.body.classList).filter(
        c => c.startsWith('printing-')
    );
    document.body.classList.remove(...printClasses);
};

// Navigation function for student cards page - Universal compatibility
function navigateToStudentCards() {
    // Use window.open with _self target for maximum compatibility
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const fullUrl = currentOrigin + basePath + 'stcard.html';
    
    // Open in same tab with full URL for universal compatibility
    window.open(fullUrl, '_self');
}

// NEW FUNCTION: Print a detailed class loan report
document.getElementById('print-class-loan-list-btn').addEventListener('click', () => {
    const selectedClass = document.getElementById('class-loan-filter-select').value;
    if (!selectedClass) {
        alert('សូមជ្រើសរើសថ្នាក់ដែលត្រូវបោះពុម្ពជាមុនសិន។');
        return;
    }
    
    const classKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('ថ្នាក់')) : null;
    const lastNameKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('នាមត្រកូល')) : null;
    const firstNameKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('នាមខ្លួន')) : null;
    const genderKey = students.length > 0 ? Object.keys(students[0]).find(k => k.includes('ភេទ')) : null;

    if (!classKey || !lastNameKey || !firstNameKey || !genderKey) {
         alert('ទិន្នន័យសិស្សមិនគ្រប់គ្រាន់សម្រាប់បង្កើតរបាយការណ៍ទេ។');
         return;
    }

    const studentsInClass = students.filter(s => s[classKey] === selectedClass);
    const classLoansForClass = loans.filter(l => l.borrower.includes(selectedClass));
    
    // Group loans by student
    const studentLoanMap = new Map();
    classLoansForClass.forEach(loan => {
        const studentName = loan.borrower.split(' - ')[0];
        if (!studentLoanMap.has(studentName)) {
            studentLoanMap.set(studentName, []);
        }
        studentLoanMap.get(studentName).push(books.find(b => b.id === loan.bookId)?.title || 'N/A');
    });

    // Get all unique book titles
    const allBookTitles = [...new Set(classLoansForClass.map(l => books.find(b => b.id === l.bookId)?.title).filter(Boolean))].sort();

    // Build the table dynamically
    const tableContainer = document.getElementById('class-loan-students-table-container');
    tableContainer.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'w-full text-left whitespace-no-wrap';
    
    // Build table header
    const thead = document.createElement('thead');
    thead.className = 'bg-gray-200';
    const headerRow = document.createElement('tr');
    ['ល.រ', 'ឈ្មោះ', 'ភេទ', ...allBookTitles, 'សរុប'].forEach(text => {
        const th = document.createElement('th');
        th.className = 'p-3 text-center';
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Build table body
    const tbody = document.createElement('tbody');
    let totalStudents = 0;
    let totalMales = 0;
    let totalFemales = 0;
    const bookTotals = {};

    studentsInClass.forEach((student, index) => {
        totalStudents++;
        if (student[genderKey] === 'ប្រុស') totalMales++;
        if (student[genderKey] === 'ស្រី') totalFemales++;
        
        const studentFullName = `${student[lastNameKey] || ''} ${student[firstNameKey] || ''}`.trim();
        const loanedBooks = studentLoanMap.get(studentFullName) || [];
        
        const row = document.createElement('tr');
        row.className = 'border-b';
        
        const noCell = document.createElement('td');
        noCell.className = 'p-3 text-center';
        noCell.textContent = index + 1;
        row.appendChild(noCell);

        const nameCell = document.createElement('td');
        nameCell.className = 'p-3';
        nameCell.textContent = studentFullName;
        row.appendChild(nameCell);
        
        const genderCell = document.createElement('td');
        genderCell.className = 'p-3 text-center';
        genderCell.textContent = student[genderKey];
        row.appendChild(genderCell);

        let studentBookCount = 0;
        allBookTitles.forEach(bookTitle => {
            const count = loanedBooks.filter(title => title === bookTitle).length;
            const cell = document.createElement('td');
            cell.className = 'p-3 text-center';
            cell.textContent = count > 0 ? count : '';
            row.appendChild(cell);
            studentBookCount += count;
            bookTotals[bookTitle] = (bookTotals[bookTitle] || 0) + count;
        });
        
        const totalCell = document.createElement('td');
        totalCell.className = 'p-3 text-center font-bold';
        totalCell.textContent = studentBookCount;
        row.appendChild(totalCell);
        
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // Add summary directly under the table with custom layout
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'mt-4 text-sm';
    
    const todayDate = new Date();
    const day = todayDate.getDate();
    const monthNumber = todayDate.getMonth() + 1;
    const year = todayDate.getFullYear();
    
    // Convert month number to Khmer month name
    const khmerMonths = {
        1: 'មករា', 2: 'កុម្ភៈ', 3: 'មីនា', 4: 'មេសា', 
        5: 'ឧសភា', 6: 'មិថុនា', 7: 'កក្កដា', 8: 'សីហា',
        9: 'កញ្ញា', 10: 'តុលា', 11: 'វិច្ឆិកា', 12: 'ធ្នូ'
    };
    const month = khmerMonths[monthNumber] || monthNumber;
    
    // Line 1: Student count on left, school info on right
    const line1 = document.createElement('div');
    line1.className = 'flex justify-between mb-2';
    line1.innerHTML = `
        <div>សិស្សសរុប៖ ${totalStudents} នាក់ (ស្រី៖ ${totalFemales} នាក់)</div>
        <div>ធ្វើនៅ, ${settingsData.schoolName || 'ឈ្មោះសាលា'} ថ្ងៃទី ${day} ខែ ${month} ឆ្នាំ ${year}</div>
    `;
    
    // Line 2: បណ្ណារក្ស positioned 3 tabs from right
    const line2 = document.createElement('div');
    line2.className = 'mb-2';
    line2.style.paddingLeft = '80%';
    line2.innerHTML = `<div>បណ្ណារក្ស</div>`;
    
    // Create book rows in 3 columns
    const bookRows = [];
    for (let i = 0; i < allBookTitles.length; i += 3) {
        const book1 = allBookTitles[i] ? `${allBookTitles[i]}៖ ${bookTotals[allBookTitles[i]] || 0} ក្បាល` : '';
        const book2 = allBookTitles[i + 1] ? `${allBookTitles[i + 1]}៖ ${bookTotals[allBookTitles[i + 1]] || 0} ក្បាល` : '';
        const book3 = allBookTitles[i + 2] ? `${allBookTitles[i + 2]}៖ ${bookTotals[allBookTitles[i + 2]] || 0} ក្បាល` : '';
        
        const bookRow = document.createElement('div');
        bookRow.className = 'mb-1';
        
        // Create book line with single spaces
        const bookLine = [book1, book2, book3].filter(book => book).join(' ');
        
        bookRow.innerHTML = `<div>${bookLine}</div>`;
        bookRows.push(bookRow);
    }
    
    summaryDiv.appendChild(line1);
    summaryDiv.appendChild(line2);
    bookRows.forEach(row => summaryDiv.appendChild(row));
    
    // QR code after book summary
    const qrDiv = document.createElement('div');
    qrDiv.className = 'text-center mt-4';
    const reportUrl = `${window.location.origin}${window.location.pathname}?class=${selectedClass}&report=loan`;
    const qrId = `qr-code-container-${Date.now()}`;
    qrDiv.innerHTML = `<div id="${qrId}" class="inline-block"></div>`;
    
    // Generate QR code
    setTimeout(() => {
        const qrContainer = document.getElementById(qrId);
        if (qrContainer && window.QRCode) {
            new QRCode(qrContainer, {
                text: reportUrl,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff"
            });
        }
    }, 100);
    
    summaryDiv.appendChild(qrDiv);
    tableContainer.appendChild(summaryDiv);

    // Set up the print title and subtitle
    const titleSpan = document.getElementById('print-report-title');
    titleSpan.textContent = `បញ្ជីឈ្មោះសិស្សខ្ចីសៀវភៅ`;
    const subtitle = document.getElementById('class-loan-report-subtitle');
    subtitle.textContent = `ថ្នាក់ទី ${selectedClass} ឆ្នាំសិក្សា ${settingsData.academicYear || 'N/A'}`;
    subtitle.classList.remove('hidden');

    // Add delay to ensure DOM is fully rendered before printing
    setTimeout(() => {
        prepareAndPrint('printing-page-class-loan-list');
    }, 500);

     // Clean up after print
    setTimeout(() => {
        subtitle.classList.add('hidden');
        tableContainer.innerHTML = '';
    }, 1000);
});

window.onafterprint = () => {
    const printClasses = Array.from(document.body.classList).filter(
        c => c.startsWith('printing-')
    );
    document.body.classList.remove(...printClasses);
};

// --- DEFAULT PAGE SETTING FUNCTIONS ---
const loadDefaultPageSetting = async () => {
    try {
        const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
        const settingsDoc = await getDocs(query(collection(db, "users", currentUserId, "settings")));
        
        let defaultPage = 'home'; // Default to home page
        settingsDoc.forEach(doc => {
            if (doc.id === 'generalInfo' && doc.data().defaultPage) {
                defaultPage = doc.data().defaultPage;
            }
        });
        
        // Update the select dropdown
        const defaultPageSelect = document.getElementById('default-page-select');
        if (defaultPageSelect) {
            defaultPageSelect.value = defaultPage;
        }
        
        // Navigate to the default page
        navigateTo(defaultPage);
    } catch (error) {
        console.error('Error loading default page setting:', error);
        navigateTo('home'); // Fallback to home
    }
};

// Save default page setting
document.getElementById('save-default-page-btn').addEventListener('click', async () => {
    const defaultPage = document.getElementById('default-page-select').value;
    const settingsRef = doc(db, "users", currentUserId, "settings", "generalInfo");
    
    try {
        await setDoc(settingsRef, { defaultPage: defaultPage }, { merge: true });
        alert('រក្សាទុកទំព័រចាប់ផ្តើមលំនាំដើមបានជោគជ័យ។');
    } catch (error) {
        console.error('Error saving default page:', error);
        alert('ការរក្សាទុកបានបរាជ័យ។');
    }
});
