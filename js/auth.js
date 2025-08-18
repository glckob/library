import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from './firebase-config.js';
import { db } from './firebase-config.js';
import { collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Setup Function ---
export function setupAuthEventListeners() {
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('register-form-container').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form-container').classList.add('hidden');
        document.getElementById('login-form-container').classList.remove('hidden');
    });

    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const errorP = document.getElementById('register-error');
        errorP.textContent = '';
        createUserWithEmailAndPassword(auth, email, password)
            .catch(error => {
                errorP.textContent = 'ការចុះឈ្មោះបានបរាជ័យ: ' + error.message;
            });
    });

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorP = document.getElementById('login-error');
        errorP.textContent = '';
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => {
                errorP.textContent = 'ការចូលប្រើបានបរាជ័យ: ' + error.message;
            });
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        signOut(auth);
    });
}

export async function changePassword(currentPassword, newPassword, confirmPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated.");

    if (newPassword !== confirmPassword) {
        throw new Error('ពាក្យសម្ងាត់ថ្មី និងការยืนยันមិនตรงគ្នាទេ។');
    }
    if (newPassword.length < 6) {
        throw new Error('ពាក្យសម្ងាត់ថ្មីត្រូវមានอย่างน้อย 6 ตัวอักษร។');
    }

    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
}


export async function reauthenticateAndDeleteAllData(password, collectionName, userId) {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated.");

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    // Re-authentication successful, proceed with deletion
    const collectionRef = collection(db, "users", userId, collectionName);
    const querySnapshot = await getDocs(collectionRef);
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}
