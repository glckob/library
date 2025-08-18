import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from './firebase-config.js'; // Correctly imports from the same directory

export function setupAuthEventListeners() {
    // ... (All the event listener setup for login, register, logout forms)
}
