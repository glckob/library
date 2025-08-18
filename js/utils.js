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
 * @param {string} dataType - The type of data being exported.
 * @param {Array<object>} dataToExport - The array of data to be written.
 */
export function exportDataToExcel(dataType, dataToExport) {
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

function prepareAndPrint(printClass) {
    document.body.classList.add(printClass);
    window.print();
}

export function printReport({ activePage, settingsData }) {
    if (activePage) {
        const titleSpan = document.getElementById('print-report-title');
        let title = '';
        const pageId = activePage.id;

        // Logic to determine title based on pageId
        // ... (copy switch statement from original file) ...
        
        titleSpan.textContent = title;
        prepareAndPrint(`printing-${pageId}`);
    }
}

export function printCards() {
    prepareAndPrint('printing-page-student-cards');
}

window.onafterprint = () => {
    const printClasses = Array.from(document.body.classList).filter(
        c => c.startsWith('printing-')
    );
    document.body.classList.remove(...printClasses);
};
