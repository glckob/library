import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from './firebase-config.js';
import { state } from './main.js'; // To get currentUserId

// --- DOM Elements ---
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const logoutBtn = document.getElementById('logout-btn');
const changePasswordForm = document.getElementById('change-password-form');
const passwordConfirmForm = document.getElementById('password-confirm-form');

// --- Event Handlers ---
function handleRegistration(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const errorP = document.getElementById('register-error');
    errorP.textContent = '';
    createUserWithEmailAndPassword(auth, email, password)
        .catch(error => {
            errorP.textContent = 'ការចុះឈ្មោះបានបរាជ័យ: ' + error.message;
        });
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorP = document.getElementById('login-error');
    errorP.textContent = '';
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => {
            errorP.textContent = 'ការចូលប្រើបានបរាជ័យ: ' + error.message;
        });
}

function handleLogout() {
    signOut(auth);
}

async function handleChangePassword(e) {
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
        errorP.textContent = 'ពាក្យសម្ងាត់ថ្មីត្រូវមានอย่างน้อย 6 ตัวอักษរ។';
        return;
    }

    // You would typically show a loading indicator here
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
        // Hide loading indicator
    }
}

// --- Setup Function ---
export function setupAuthEventListeners() {
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('register-form-container').classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form-container').classList.add('hidden');
        document.getElementById('login-form-container').classList.remove('hidden');
    });

    registerForm.addEventListener('submit', handleRegistration);
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    changePasswordForm.addEventListener('submit', handleChangePassword);
}
