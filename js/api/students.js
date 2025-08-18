import { db } from '../firebase-config.js';
import { state } from '../main.js';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    addDoc,
    writeBatch,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Student Data API Functions ---

/**
 * Replaces all existing student data with new data from a CSV.
 * @param {Array<object>} studentData - An array of student objects.
 */
export async function syncStudentsFromCSV(studentData) {
    if (!state.currentUserId) throw new Error("User not authenticated.");

    const studentsRef = collection(db, "users", state.currentUserId, "students");

    // Delete all existing students
    const existingStudentsSnapshot = await getDocs(studentsRef);
    const deleteBatch = writeBatch(db);
    existingStudentsSnapshot.forEach(doc => {
        deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();

    // Add new students
    const addBatch = writeBatch(db);
    studentData.forEach(student => {
        const newStudentRef = doc(studentsRef);
        addBatch.set(newStudentRef, student);
    });
    await addBatch.commit();
}

/**
 * Adds or updates a single student record.
 * @param {object} studentData - The data for the student.
 * @param {string|null} id - The ID of the student to update, or null for a new student.
 */
export async function saveStudent(studentData, id = null) {
    if (!state.currentUserId) throw new Error("User not authenticated.");

    if (id) {
        const studentRef = doc(db, "users", state.currentUserId, "students", id);
        await setDoc(studentRef, studentData);
    } else {
        await addDoc(collection(db, "users", state.currentUserId, "students"), studentData);
    }
}

/**
 * Deletes a single student record.
 * @param {string} id - The ID of the student to delete.
 */
export async function deleteStudent(id) {
    if (!state.currentUserId) throw new Error("User not authenticated.");
    const studentRef = doc(db, "users", state.currentUserId, "students", id);
    await deleteDoc(studentRef);
}
