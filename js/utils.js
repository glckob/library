// --- Utility Functions ---

/**
 * Parses CSV text into an array of objects.
 * @param {string} text - The CSV content as a string.
 * @returns {Array<object>}
 */
export function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] ? values[index].trim() : '';
        });
        return obj;
    });
    return data;
}

/**
 * Exports data to an Excel file using SheetJS library.
 * @param {string} dataType - The type of data being exported (e.g., 'books', 'students').
 * @param {Array<object>} dataToExport - The array of data to be written to the sheet.
 */
export function exportToExcel(dataType, dataToExport) {
    if (dataToExport.length === 0) {
        alert('មិនមានទិន្នន័យសម្រាប់នាំចេញទេ។');
        return;
    }

    const fileName = `${dataType}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, fileName);
}

/**
 * Prepares the document for printing a report or student cards.
 * @param {string} printClass - The CSS class to add to the body for print styling.
 */
function prepareAndPrint(printClass) {
    document.body.classList.add(printClass);
    window.print();
}

/**
 * Handles the logic for printing various reports based on the active page.
 * @param {object} state - The current application state.
 */
export function printReport(state) {
    // ... Logic from the original file to determine the title and call prepareAndPrint ...
    // This function will need access to the currently active page.
    const activePage = document.querySelector('.page:not(.hidden)');
    if (activePage) {
        // ... switch statement based on activePage.id ...
        prepareAndPrint(`printing-${activePage.id}`);
    }
}

/**
 * Specifically handles printing student cards.
 */
export function printCards() {
    prepareAndPrint('printing-page-student-cards');
}

// Add a listener to clean up print classes after printing is done
window.onafterprint = () => {
    const printClasses = Array.from(document.body.classList).filter(
        c => c.startsWith('printing-')
    );
    document.body.classList.remove(...printClasses);
};
