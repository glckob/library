import { db } from '../firebase-config.js';
import { state } from '../main.js';
import {
    collection,
    addDoc,
    doc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Reading Log API Functions ---

/**
 * Adds a new reading log entry.
 * @param {object} logData - The data for the reading log.
 */
export async function addReadingLog(logData) {
    if (!state.currentUserId) throw new Error("User not authenticated.");
    await addDoc(collection(db, "users", state.currentUserId, "readingLogs"), logData);
}

/**
 * Deletes a reading log entry.
 * @param {string} id - The ID of the log to delete.
 */
export async function deleteReadingLog(id) {
    if (!state.currentUserId) throw new Error("User not authenticated.");
    const logRef = doc(db, "users", state.currentUserId, "readingLogs", id);
    await deleteDoc(logRef);
}
