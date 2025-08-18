// Import the necessary functions from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
// IMPORTANT: For production, use environment variables or a secure configuration method
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

// Initialize and export Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
