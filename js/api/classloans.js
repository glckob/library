import { db } from '../firebase-config.js';
import { state } from '../main.js';
import {
    collection,
    doc,
    writeBatch,
    query,
    where,
    getDocs,
    increment,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Class Loan API Functions ---

/**
 * Creates a class loan and individual loan records for each student.
 * @param {Array} studentLoansData - Array of individual loan objects for each student.
 */
export async function addClassLoan(studentLoansData) {
    if (!state.currentUserId) throw new Error("User not authenticated.");
    if (studentLoansData.length === 0) return;

    const batch = writeBatch(db);
    const today = new Date().toISOString().split('T')[0];
    
    const { bookId, className } = studentLoansData[0]; // Get common data

    // Create the main classLoan document
    const newClassLoanRef = doc(collection(db, "users", state.currentUserId, "classLoans"));
    batch.set(newClassLoanRef, {
        bookId: bookId,
        className: className,
        loanedQuantity: studentLoansData.length,
        loanDate: today,
        returnedCount: 0,
        status: 'ខ្ចី'
    });

    // Create individual loan documents linked to the classLoan
    const loansRef = collection(db, "users", state.currentUserId, "loans");
    studentLoansData.forEach(studentLoan => {
        const newLoanRef = doc(loansRef);
        batch.set(newLoanRef, {
            ...studentLoan,
            classLoanId: newClassLoanRef.id,
            loanDate: today,
            status: 'ខ្ចី'
        });
    });

    await batch.commit();
}

/**
 * Marks a specified number of books from a class loan as returned.
 * @param {string} classLoanId - The ID of the class loan.
 * @param {number} numberToReturn - The number of books being returned.
 */
export async function returnClassBooks(classLoanId, numberToReturn) {
    if (!state.currentUserId) throw new Error("User not authenticated.");

    const batch = writeBatch(db);
    const classLoanRef = doc(db, "users", state.currentUserId, "classLoans", classLoanId);
    
    // Find individual loans to mark as returned
    const q = query(
        collection(db, "users", state.currentUserId, "loans"),
        where("classLoanId", "==", classLoanId),
        where("status", "==", "ខ្ចី")
    );
    const querySnapshot = await getDocs(q);
    const loansToUpdate = querySnapshot.docs.slice(0, numberToReturn);
    
    const today = new Date().toISOString().split('T')[0];
    loansToUpdate.forEach(doc => {
        batch.update(doc.ref, { status: 'សងវិញ', returnDate: today });
    });

    // Update the main class loan document
    batch.update(classLoanRef, { returnedCount: increment(numberToReturn) });

    await batch.commit();
}

/**
 * Deletes a class loan and all associated individual loans.
 * @param {string} classLoanId - The ID of the class loan to delete.
 */
export async function deleteClassLoan(classLoanId) {
    if (!state.currentUserId) throw new Error("User not authenticated.");

    const batch = writeBatch(db);

    // Find and delete associated individual loans
    const q = query(collection(db, "users", state.currentUserId, "loans"), where("classLoanId", "==", classLoanId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // Delete the main class loan document
    const classLoanRef = doc(db, "users", state.currentUserId, "classLoans", classLoanId);
    batch.delete(classLoanRef);

    await batch.commit();
}
