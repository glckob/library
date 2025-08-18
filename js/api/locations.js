import { db } from '../firebase-config.js';
import { state } from '../main.js';
import {
    collection,
    addDoc,
    doc,
    setDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Location API Functions ---

/**
 * Adds or updates a location document.
 * @param {object} locationData - The data for the location.
 * @param {string|null} id - The ID of the location to update, or null for a new one.
 */
export async function saveLocation(locationData, id = null) {
    if (!state.currentUserId) throw new Error("User not authenticated.");

    if (id) {
        const locationRef = doc(db, "users", state.currentUserId, "locations", id);
        await setDoc(locationRef, locationData);
    } else {
        await addDoc(collection(db, "users", state.currentUserId, "locations"), locationData);
    }
}

/**
 * Deletes a location document.
 * @param {string} id - The ID of the location to delete.
 */
export async function deleteLocation(id) {
    if (!state.currentUserId) throw new Error("User not authenticated.");

    // Check if the location is in use
    const isUsed = state.books.some(book => book.locationId === id);
    if (isUsed) {
        throw new Error('មិនអាចលុបទីតាំងនេះបានទេ ព្រោះកំពុងប្រើប្រាស់ដោយសៀវភៅ។');
    }

    const locationRef = doc(db, "users", state.currentUserId, "locations", id);
    await deleteDoc(locationRef);
}
