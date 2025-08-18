import { db } from '../firebase-config.js';
import { state } from '../main.js';
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Personal Loan API Functions ---

/**
 * Creates a new personal loan record.
 * @param {object} loanData - The data for the new loan.
 */
export async function addPersonalLoan(loanData) {
    if (!state.currentUserId) throw new Error("User not authenticated.");
    await addDoc(collection(db, "users", state.currentUserId, "loans"), loanData);
}

/**
 * Marks a personal loan as returned.
 * @param {string} loanId - The ID of the loan to return.
 */
export async function returnPersonalLoan(loanId) {
    if (!state.currentUserId) throw new Error("User not authenticated.");
    const loanRef = doc(db, "users", state.currentUserId, "loans", loanId);
    await updateDoc(loanRef, {
        status: 'សងវិញ',
        returnDate: new Date().toISOString().split('T')[0]
    });
}

/**
 * Deletes a personal loan record.
 * @param {string} loanId - The ID of the loan to delete.
 */
export async function deletePersonalLoan(loanId) {
    if (!state.currentUserId) throw new Error("User not authenticated.");
    const loanRef = doc(db, "users", state.currentUserId, "loans", loanId);
    await deleteDoc(loanRef);
}
