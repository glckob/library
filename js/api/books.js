import { db } from '../firebase-config.js';
import { state } from '../main.js';
import {
    collection,
    addDoc,
    doc,
    setDoc,
    deleteDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Book API Functions ---

/**
 * Adds or updates a book document in Firestore.
 * @param {object} bookData - The book data to save.
 * @param {string|null} id - The ID of the book to update, or null to add a new one.
 */
export async function saveBook(bookData, id = null) {
    if (!state.currentUserId) throw new Error("User not authenticated.");

    // Check for duplicate ISBN
    if (bookData.isbn) {
        const booksRef = collection(db, "users", state.currentUserId, "books");
        const q = query(booksRef, where("isbn", "==", bookData.isbn));
        const querySnapshot = await getDocs(q);
        
        let isDuplicate = false;
        if (!querySnapshot.empty) {
            if (id) { // Editing a book
                if (querySnapshot.docs[0].id !== id) isDuplicate = true;
            } else { // Adding a new book
                isDuplicate = true;
            }
        }
        if (isDuplicate) {
            throw new Error(`លេខ ISBN "${bookData.isbn}" នេះមានក្នុងប្រព័ន្ធរួចហើយ។`);
        }
    }

    if (id) {
        // Update existing book
        const bookRef = doc(db, "users", state.currentUserId, "books", id);
        await setDoc(bookRef, bookData);
    } else {
        // Add new book
        await addDoc(collection(db, "users", state.currentUserId, "books"), bookData);
    }
}

/**
 * Deletes a book from Firestore.
 * @param {string} id - The ID of the book to delete.
 */
export async function deleteBook(id) {
    if (!state.currentUserId) throw new Error("User not authenticated.");

    // Check if the book is currently on loan
    const isLoaned = state.loans.some(loan => loan.bookId === id && loan.status === 'ខ្ចី');
    if (isLoaned) {
        throw new Error('មិនអាចលុបសៀវភៅនេះបានទេ ព្រោះកំពុងមានគេខ្ចី។');
    }

    const bookRef = doc(db, "users", state.currentUserId, "books", id);
    await deleteDoc(bookRef);
}
