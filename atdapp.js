// --- CONFIGURATION ---
const SUPABASE_URL = 'https://bcbwrymhpjcncgiwjllr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjYndyeW1ocGpjbmNnaXdqbGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MDA5MDEsImV4cCI6MjA3MTE3NjkwMX0.ZiU1uF9_5h2N9choQvNihTvKWfqtPlHdvQm2iPaI2jw';

// --- GLOBAL STATE ---
let supabase = null;
let session = null;
let isProcessing = false;
let currentView = 'dashboard';

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    if (window.lucide) lucide.createIcons();
    
    // Init Date
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) currentDateEl.textContent = new Date().toLocaleDateString('km-KH');
    
    // Default Report Date to Today & Current Month
    const reportDateEl = document.getElementById('report-date');
    if (reportDateEl) reportDateEl.valueAsDate = new Date();
    
    const reportMonthEl = document.getElementById('report-month');
    if (reportMonthEl) reportMonthEl.value = new Date().toISOString().slice(0, 7); // YYYY-MM

    try {
        if (!window.supabase) {
            await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Session Check
        const { data } = await supabase.auth.getSession();
        session = data.session;
        
        supabase.auth.onAuthStateChange((_event, _session) => {
            session = _session;
            updateUIState();
        });

        updateUIState();
        setupEventListeners();

    } catch (err) {
        console.error(err);
        showErrorState(err.message);
    }
});

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = "anonymous";
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
    });
}

function showErrorState(msg) {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="text-red-500 text-center p-4">
                <h3 class="font-bold mb-2">កំហុសប្រព័ន្ធ</h3>
                <p class="text-sm">${msg}</p>
                <button onclick="window.location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded">ព្យាយាមម្តងទៀត</button>
            </div>
        `;
    }
}

function updateUIState() {
    const loadingScreen = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');

    if (loadingScreen) loadingScreen.classList.add('hidden');

    if (session) {
        if (authScreen) authScreen.classList.add('hidden');
        if (mainApp) {
            mainApp.classList.remove('hidden');
            mainApp.classList.add('fade-in');
        }
        // Load initial data based on current view
        switchTab('dashboard');
    } else {
        if (mainApp) mainApp.classList.add('hidden');
        if (typeof window !== 'undefined') { window.location.href = 'index.html'; return; }
    }
}

// --- HELPER: Local Date String (Fixes Timezone Issues) ---
function getLocalDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// --- NEW: Print Report ---
function printReport() {
    window.print();
}

// --- NAVIGATION LOGIC ---
// Explicitly attach to window for HTML onclick events
window.switchTab = function(tabName) {
    currentView = tabName;
    
    // 1. Update Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active', 'text-blue-600', 'bg-blue-50');
        btn.classList.add('text-gray-500');
    });
    const activeBtn = document.getElementById(`nav-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.classList.remove('text-gray-500');
    }

    // 2. Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
    });

    // 3. Show selected view
    const selectedView = document.getElementById(`view-${tabName}`);
    if (selectedView) {
        selectedView.classList.remove('hidden');
        selectedView.classList.add('fade-in');
    }

    // 4. Load Data
    if (tabName === 'dashboard') {
        fetchTodaysLogs();
        setTimeout(() => document.getElementById('scanner-input')?.focus(), 100);
    } else if (tabName === 'students') {
        loadStudents();
    } else if (tabName === 'classes') {
        loadClasses();
    } else if (tabName === 'schedules') {
        loadSchedules();
    } else if (tabName === 'reports') {
        // Fire both tasks
        populateReportClassFilter(); 
        loadReport();
    }
}

// --- REPORT UI LOGIC ---
// Make accessible globally
window.toggleReportDateInput = function() {
    const type = document.getElementById('report-type').value;
    const dailyDiv = document.getElementById('report-daily-input');
    const monthlyDiv = document.getElementById('report-monthly-input');
    
    if (type === 'daily') {
        dailyDiv.classList.remove('hidden');
        monthlyDiv.classList.add('hidden');
    } else {
        dailyDiv.classList.add('hidden');
        monthlyDiv.classList.remove('hidden');
    }
    loadReport(); // Trigger reload when type changes
}

// Make accessible globally
window.loadReport = async function() {
    const tbody = document.getElementById('report-table-body');
    const type = document.getElementById('report-type').value;
    const selectedClass = document.getElementById('report-class').value;
    const dateInput = document.getElementById('report-date').value;
    const monthInput = document.getElementById('report-month').value;
    
    // --- VALIDATION: Ensure Class is Selected ---
    if (!selectedClass) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">សូមជ្រើសរើសថ្នាក់ជាមុនសិន</td></tr>';
        return;
    }

    // UI: Show loading immediately
    tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center"><div class="flex justify-center items-center gap-2"><div class="spinner w-6 h-6 border-blue-500"></div><span>កំពុងបង្កើតរបាយការណ៍...</span></div></td></tr>';

    if (type === 'daily') {
        // Update Print Header for Daily
        document.getElementById('print-title').textContent = "របាយការណ៍វត្តមានប្រចាំថ្ងៃ";
        const dateStr = dateInput ? new Date(dateInput).toLocaleDateString('km-KH') : '---';
        document.getElementById('print-subtitle').textContent = `ថ្នាក់៖ ${selectedClass} | កាលបរិច្ឆេទ៖ ${dateStr}`;
        await loadDailyReport(selectedClass);
    } else {
        // Update Print Header for Monthly
        document.getElementById('print-title').textContent = "របាយការណ៍វត្តមានប្រចាំខែ";
        
        // UPDATED: Format Month to MM-YYYY
        let formattedMonth = '---';
        if (monthInput) {
            const [year, month] = monthInput.split('-');
            formattedMonth = `${month}-${year}`;
        }

        document.getElementById('print-subtitle').textContent = `ថ្នាក់៖ ${selectedClass} | ខែ៖ ${formattedMonth}`;
        await loadMonthlyReport(selectedClass);
    }
}

// --- MODAL LOGIC ---
window.openScheduleModal = function() {
    document.getElementById('schedule-modal').classList.remove('hidden');
    document.getElementById('add-schedule-form').reset();
    document.getElementById('sch-id').value = ''; 
    document.getElementById('modal-title').textContent = "បន្ថែមកាលវិភាគថ្មី";
    document.getElementById('save-sch-btn').textContent = "រក្សាទុក";
    document.getElementById('sch-class-id').focus();
    
    populateScheduleClassDropdown();
}

window.closeScheduleModal = function() {
    document.getElementById('schedule-modal').classList.add('hidden');
}

// --- NEW: Edit Schedule ---
window.editSchedule = async function(id) {
    document.getElementById('schedule-modal').classList.remove('hidden');
    document.getElementById('modal-title').textContent = "កែប្រែកាលវិភាគ";
    document.getElementById('save-sch-btn').textContent = "ធ្វើបច្ចុប្បន្នភាព";
    document.getElementById('sch-id').value = id;

    await populateScheduleClassDropdown();

    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        alert("កំហុសក្នុងការទាញយកទិន្នន័យ");
        closeScheduleModal();
        return;
    }

    document.getElementById('sch-class-id').value = data.class_id;
    document.getElementById('sch-day').value = data.day_of_week;
    document.getElementById('sch-start').value = data.start_time;
    document.getElementById('sch-end').value = data.end_time;
}

window.deleteSchedule = async function(id) {
    if (!confirm("តើអ្នកពិតជាចង់លុបកាលវិភាគនេះមែនទេ?")) return;
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) alert("កំហុសក្នុងការលុប: " + error.message);
    else { showAlert('success', 'លុបកាលវិភាគបានជោគជ័យ'); loadSchedules(); }
}

window.deleteLog = async function(id) {
    if (!confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?")) return;
    const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
    if (error) alert("កំហុសក្នុងការលុប: " + error.message);
    else { showAlert('success', 'លុបទិន្នន័យបានជោគជ័យ'); loadReport(); }
}

// --- NEW: Toggle Monthly Status ---
window.toggleMonthlyStatus = async function(studentId, dateStr, currentStatus, classId) {
    if (isProcessing) return;
    isProcessing = true;

    // Determine new status: If currently Present -> make Absent. Otherwise -> make Present.
    let newStatus = 'វត្តមាន';
    if (currentStatus === 'វត្តមាន') {
        newStatus = 'អវត្តមាន';
    }

    try {
        // 1. Check if log exists
        const { data: existingLogs, error: fetchError } = await supabase
            .from('attendance_logs')
            .select('id')
            .eq('user_id', session.user.id) // Safety check
            .eq('student_id', studentId)
            .eq('attendance_date', dateStr);
            
        if (fetchError) throw fetchError;
        
        const log = existingLogs && existingLogs[0];

        if (log) {
            // UPDATE
            const { error: updateError } = await supabase
                .from('attendance_logs')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', log.id);
            if (updateError) throw updateError;
        } else {
            // INSERT (Need schedule_id)
            const d = new Date(dateStr);
            const dayOfWeek = d.getDay();
            
            const { data: schedules } = await supabase
                .from('schedules')
                .select('id, start_time')
                .eq('class_id', classId)
                .eq('day_of_week', dayOfWeek)
                .eq('user_id', session.user.id)
                .limit(1);
                
            if (!schedules || schedules.length === 0) {
                alert("មិនមានកាលវិភាគសម្រាប់ថ្ងៃនេះទេ មិនអាចកែប្រែបានឡើយ");
                isProcessing = false;
                return;
            }

            const scheduleId = schedules[0].id;
            // Construct scan time based on schedule start
            const [y, m, day] = dateStr.split('-');
            const [h, min] = schedules[0].start_time.split(':');
            const scanTime = new Date(y, m-1, day, h, min);

            // Fetch student info
             const { data: student } = await supabase
                .from('students')
                .select('first_name, last_name, gender')
                .eq('student_id', studentId)
                .single();
                
            const { error: insertError } = await supabase
                .from('attendance_logs')
                .insert([{
                    user_id: session.user.id,
                    student_id: studentId,
                    student_name: `${student.last_name} ${student.first_name}`,
                    class_id: classId,
                    schedule_id: scheduleId,
                    attendance_date: dateStr,
                    scan_time_in: scanTime.toISOString(),
                    status: newStatus,
                    gender: student.gender
                }]);
                
            if (insertError) throw insertError;
        }
        
        // Refresh Report without full page reload flash
        await loadMonthlyReport(classId); 
        
    } catch (err) {
        console.error(err);
        alert("កំហុស: " + err.message);
    } finally {
        isProcessing = false;
    }
}

// --- NEW: Bulk Toggle All for Date (FIXED for mixed Insert/Update) ---
window.toggleAllMonthlyStatus = async function(dateStr, classId, scheduleId, startTime) {
    if (isProcessing) return;
    if (!confirm(`តើអ្នកចង់ផ្លាស់ប្តូរវត្តមានសម្រាប់សិស្សទាំងអស់នៅថ្ងៃ ${dateStr} ដែរឬទេ?`)) return;

    isProcessing = true;
    try {
        // 1. Fetch All Students
        const { data: students } = await supabase
            .from('students')
            .select('student_id, first_name, last_name, gender')
            .eq('user_id', session.user.id)
            .eq('class_id', classId)
            .limit(100000);

        if (!students || students.length === 0) throw new Error("មិនមានសិស្ស");

        // 2. Fetch Existing Logs for Date
        const { data: logs } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('class_id', classId)
            .eq('attendance_date', dateStr);
        
        // 3. Determine Target Status
        // If ALL students currently logged as 'វត្តមាន', toggle to 'អវត្តមាន'.
        // Otherwise (mixed, all absent, or unscanned), toggle ALL to 'វត្តមាន'.
        const allPresent = students.every(s => {
            const log = logs.find(l => l.student_id === s.student_id);
            return log && log.status === 'វត្តមាន';
        });
        
        const newStatus = allPresent ? 'អវត្តមាន' : 'វត្តមាន';
        const nowISO = new Date().toISOString();

        // 4. Prepare Data
        const [y, m, d] = dateStr.split('-');
        const [h, min] = startTime ? startTime.split(':') : ['07', '00'];
        const defaultScanTime = new Date(y, m-1, d, h, min).toISOString();

        const toInsert = [];
        const toUpdate = [];

        students.forEach(s => {
            const log = logs.find(l => l.student_id === s.student_id);
            
            if (log) {
                // Existing Record -> Update
                toUpdate.push({
                    id: log.id,
                    user_id: session.user.id, // Include for RLS safety
                    student_id: s.student_id,
                    student_name: `${s.last_name} ${s.first_name}`,
                    class_id: classId,
                    schedule_id: scheduleId,
                    attendance_date: dateStr,
                    status: newStatus,
                    gender: s.gender,
                    scan_time_in: log.scan_time_in, // Keep old time
                    updated_at: nowISO
                });
            } else {
                // New Record -> Insert
                toInsert.push({
                    user_id: session.user.id,
                    student_id: s.student_id,
                    student_name: `${s.last_name} ${s.first_name}`,
                    class_id: classId,
                    schedule_id: scheduleId,
                    attendance_date: dateStr,
                    status: newStatus,
                    gender: s.gender,
                    scan_time_in: defaultScanTime,
                    updated_at: nowISO
                });
            }
        });

        // 5. Execute Split Batch Operations
        if (toUpdate.length > 0) {
            const { error: updateError } = await supabase
                .from('attendance_logs')
                .upsert(toUpdate);
            if (updateError) throw updateError;
        }

        if (toInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('attendance_logs')
                .insert(toInsert);
            if (insertError) throw insertError;
        }

        // Reload
        await loadMonthlyReport(classId);

    } catch (err) {
        console.error(err);
        alert("កំហុស: " + err.message);
    } finally {
        isProcessing = false;
    }
}

// --- EXPOSED GLOBAL FUNCTIONS (For HTML onClick) ---
window.loadStudents = loadStudents;
window.loadClasses = loadClasses;
window.loadSchedules = loadSchedules;
window.fetchTodaysLogs = fetchTodaysLogs;

// --- CORE FUNCTIONS (Changed to Function Declarations to Fix Hoisting) ---

async function populateReportClassFilter() {
    const selectEl = document.getElementById('report-class');
    if (selectEl.options.length > 1) return;

    // Fetch classes that have schedules
    const { data, error } = await supabase
        .from('schedules')
        .select('class_id')
        .eq('user_id', session.user.id)
        .limit(1000);

    if (data) {
        const uniqueClasses = [...new Set(data.map(item => item.class_id?.trim()).filter(Boolean))];
        uniqueClasses.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        
        uniqueClasses.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls;
            opt.textContent = cls;
            selectEl.appendChild(opt);
        });
    }
}

async function populateScheduleClassDropdown() {
    const selectEl = document.getElementById('sch-class-id');
    const currentValue = selectEl.value; 
    selectEl.innerHTML = '<option value="">កំពុងផ្ទុក...</option>';

    // Selecting only class_id makes it faster
    const { data, error } = await supabase
        .from('students')
        .select('class_id')
        .eq('user_id', session.user.id)
        .limit(100000);

    if (error) {
        console.error(error);
        selectEl.innerHTML = '<option value="">កំហុសក្នុងការផ្ទុក</option>';
        return;
    }

    const uniqueClasses = [...new Set(data.map(item => item.class_id?.trim()).filter(Boolean))];
    uniqueClasses.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (uniqueClasses.length === 0) {
        selectEl.innerHTML = '<option value="">មិនមានថ្នាក់</option>';
        return;
    }

    selectEl.innerHTML = uniqueClasses.map(cls => `<option value="${cls}">${cls}</option>`).join('');
    
    if (currentValue && uniqueClasses.includes(currentValue)) {
        selectEl.value = currentValue;
    }
}

async function loadDailyReport(selectedClass) {
    const dateInput = document.getElementById('report-date').value;
    const thead = document.getElementById('report-table-head-row');
    const tbody = document.getElementById('report-table-body');

    // Reset Header to Daily Format (UPDATED: No Class, Added No.)
    thead.innerHTML = `
        <th class="px-6 py-3 w-[50px] text-center">ល.រ</th>
        <th class="px-6 py-3 print-hidden">កាលបរិច្ឆេទ</th>
        <th class="px-6 py-3">ឈ្មោះ</th>
        <th class="px-6 py-3 print-hidden">ភេទ</th>
        <th class="px-6 py-3">ម៉ោងចូល</th>
        <th class="px-6 py-3">ម៉ោងចេញ</th>
        <th class="px-6 py-3">ស្ថានភាព</th>
        <th class="px-6 py-3 text-right no-print">សកម្មភាព</th>
    `;

    // 1. Logs Query
    let logQuery = supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('class_id', selectedClass)
        .eq('attendance_date', dateInput)
        .order('scan_time_in', { ascending: false })
        .limit(100000);

    // 2. Schedule Query
    let schedulePromise = Promise.resolve(null);
    if (dateInput) {
        const d = new Date(dateInput + 'T12:00:00'); 
        const dayOfWeek = d.getDay(); 
        schedulePromise = supabase
            .from('schedules')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('class_id', selectedClass)
            .eq('day_of_week', dayOfWeek)
            .maybeSingle(); 
    }

    // 3. Students Query
    let studentPromise = supabase
        .from('students')
        .select('student_id, first_name, last_name, gender, class_id') 
        .eq('user_id', session.user.id)
        .eq('class_id', selectedClass)
        .limit(100000);

    // --- PARALLEL EXECUTION ---
    const [
        { data: logs, error: logError },
        scheduleRes,
        studentRes
    ] = await Promise.all([
        logQuery,
        schedulePromise,
        studentPromise
    ]);

    if (logError) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-center text-red-500">កំហុសក្នុងការផ្ទុកទិន្នន័យ: ${logError.message}</td></tr>`;
        return;
    }

    let finalData = [];

    // --- MERGE LOGIC ---
    const classSchedule = scheduleRes?.data; 
    
    // UPDATE PRINT HEADER WITH TIME
    let timeStr = "";
    if (classSchedule) {
       const start = classSchedule.start_time.slice(0, 5);
       const end = classSchedule.end_time.slice(0, 5);
       timeStr = ` | ម៉ោងសិក្សា ${start}-${end}`;
    }
    const dateStr = dateInput ? new Date(dateInput).toLocaleDateString('km-KH') : '---';
    document.getElementById('print-subtitle').textContent = `ថ្នាក់៖ ${selectedClass} | កាលបរិច្ឆេទ៖ ${dateStr}${timeStr}`;

    if (dateInput && studentRes) {
        const students = studentRes.data || [];
        
        const logMap = new Map();
        (logs || []).forEach(l => logMap.set(l.student_id, l));

        finalData = students.map(student => {
            const log = logMap.get(student.student_id);
            let status = 'មិនទាន់ស្កេន'; 

            if (!classSchedule) {
                status = 'មិនមានម៉ោងសិក្សា';
            } else {
                if (!log) {
                    const reportDate = new Date(dateInput);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    reportDate.setHours(0,0,0,0);

                    if (reportDate < today) {
                        status = 'អវត្តមាន'; // Past date
                    } else if (reportDate.getTime() === today.getTime()) {
                        if (classSchedule.end_time) {
                            const now = new Date();
                            const [endHour, endMinute] = classSchedule.end_time.split(':');
                            const classEndTime = new Date();
                            classEndTime.setHours(parseInt(endHour), parseInt(endMinute), 0);
                            
                            if (now > classEndTime) {
                                status = 'អវត្តមាន';
                            }
                        }
                    }
                }
            }

            if (log) {
                return {
                    id: log.id,
                    attendance_date: log.attendance_date,
                    student_name: log.student_name,
                    student_id: log.student_id,
                    gender: log.gender || student.gender,
                    class_id: log.class_id,
                    scan_time_in: log.scan_time_in,
                    scan_time_out: log.scan_time_out,
                    status: log.status
                };
            } else {
                return {
                    id: null,
                    attendance_date: dateInput,
                    student_name: `${student.last_name} ${student.first_name}`,
                    student_id: student.student_id,
                    gender: student.gender,
                    class_id: student.class_id,
                    scan_time_in: null,
                    scan_time_out: null,
                    status: status
                };
            }
        });

        // Client-side sort
        finalData.sort((a, b) => a.student_name.localeCompare(b.student_name));
    }

    if (finalData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center">មិនមានទិន្នន័យ</td></tr>';
        return;
    }

    // --- RENDER ---
    // Prepare Date for "Not Scanned Out" Check
    let classEndTime = null;
    if (classSchedule && classSchedule.end_time) {
        const [eH, eM] = classSchedule.end_time.split(':');
        classEndTime = new Date(dateInput);
        classEndTime.setHours(parseInt(eH), parseInt(eM), 0, 0);
    }
    const now = new Date();
    const reportDateObj = new Date(dateInput);
    reportDateObj.setHours(0,0,0,0);
    const todayObj = new Date();
    todayObj.setHours(0,0,0,0);


    const rows = finalData.map((item, index) => { 
        let statusColor = "text-gray-600 bg-gray-100";
        let statusText = item.status || '-';
        
        if (statusText === 'វត្តមាន') statusColor = "text-blue-700 bg-blue-100";
        else if (statusText === 'អវត្តមាន' || statusText.includes('ចូលយឺត')) statusColor = "text-red-700 bg-red-100";
        else if (statusText === 'មិនទាន់ស្កេន') statusColor = "text-orange-700 bg-orange-100";
        else if (statusText === 'មិនមានម៉ោងសិក្សា') statusColor = "text-gray-500 bg-gray-200";

        const gender = item.gender || '-';
        
        // Format Name for Female Students
        let displayName = item.student_name;
        if (gender === 'ស្រី' || gender === 'F' || gender === 'Female') {
            displayName = `ក. ${displayName}`;
        }

        const inTime = item.scan_time_in ? new Date(item.scan_time_in).toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' }) : '-';
        
        // Calculate Out Time Status
        let outTime = '-';
        if (item.scan_time_out) {
            outTime = new Date(item.scan_time_out).toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' });
        } else if (item.scan_time_in) {
            // Checked in but not out
            // Check if class is over
            let isClassOver = false;
            if (classEndTime) {
                if (reportDateObj < todayObj) {
                    isClassOver = true;
                } else if (reportDateObj.getTime() === todayObj.getTime()) {
                    if (now > classEndTime) {
                        isClassOver = true;
                    }
                }
            }

            if (isClassOver) {
                outTime = '<span class="text-red-500 font-bold">មិនបានស្កេនចេញ</span>';
            } else {
                outTime = '<span class="text-yellow-500 font-bold">កំពុងសិក្សា</span>';
            }
        }

        const deleteBtn = item.id 
            ? `<button onclick="deleteLog('${item.id}')" class="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50 no-print" title="លុបទិន្នន័យ"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
            : '';

        return `
        <tr class="bg-white border-b hover:bg-gray-50 text-base">
            <td class="px-6 py-4 text-center">${index + 1}</td>
            <td class="px-6 py-4 print-hidden">${new Date(item.attendance_date).toLocaleDateString('km-KH')}</td>
            <td class="px-6 py-4 text-gray-900">
                ${displayName}<br>
                <span class="text-xs text-gray-400 print-hidden">${item.student_id}</span>
            </td>
            <td class="px-6 py-4 print-hidden">${gender}</td>
            <td class="px-6 py-4 font-mono text-sm">${inTime}</td>
            <td class="px-6 py-4 font-mono text-sm">${outTime}</td>
            <td class="px-6 py-4">
                <span class="${statusColor} px-2 py-1 rounded text-sm font-medium whitespace-nowrap">${statusText}</span>
            </td>
            <td class="px-6 py-4 text-right no-print">
                ${deleteBtn}
            </td>
        </tr>
    `}).join('');

    tbody.innerHTML = rows;
    
    if (window.lucide) lucide.createIcons();
}

// --- MONTHLY REPORT LOGIC (FIXED) ---
async function loadMonthlyReport(selectedClass) {
    const monthInput = document.getElementById('report-month').value; // YYYY-MM
    const thead = document.getElementById('report-table-head-row');
    const tbody = document.getElementById('report-table-body');

    if (!monthInput) {
        tbody.innerHTML = '<tr><td colspan="100%" class="px-6 py-4 text-center">សូមជ្រើសរើសខែ</td></tr>';
        return;
    }

    // 1. Determine Date Range (Local Time)
    const [year, month] = monthInput.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    // 2. Fetch Schedules to find valid study days
    const { data: schedules } = await supabase
        .from('schedules')
        .select('*') // Fetch ALL fields to get start_time
        .eq('user_id', session.user.id)
        .eq('class_id', selectedClass);

    if (!schedules || schedules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="px-6 py-4 text-center">មិនមានកាលវិភាគសម្រាប់ថ្នាក់នេះទេ</td></tr>';
        return;
    }

    const studyDays = new Set(schedules.map(s => s.day_of_week)); // Set of [1, 3, 5] etc.

    // 3. Generate Valid Dates
    const validDates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (studyDays.has(d.getDay())) {
            validDates.push(new Date(d)); // Store copy
        }
    }

    if (validDates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="px-6 py-4 text-center">គ្មានថ្ងៃសិក្សាក្នុងខែនេះ</td></tr>';
        return;
    }

    // 4. Fetch Students
    const studentPromise = supabase
        .from('students')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('class_id', selectedClass)
        .order('last_name')
        .limit(100000);

    // 5. Fetch Logs for entire month
    // FIXED: Use getLocalDateString to ensure we send correct YYYY-MM-DD to DB
    const startStr = getLocalDateString(startDate);
    const endStr = getLocalDateString(endDate);
    
    const logPromise = supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('class_id', selectedClass)
        .gte('attendance_date', startStr)
        .lte('attendance_date', endStr)
        .limit(100000);

    const [stRes, logRes] = await Promise.all([studentPromise, logPromise]);
    const students = stRes.data || [];
    const logs = logRes.data || [];

    // 6. Build Header (UPDATED: Added No, Formatted Date)
    let headerHTML = `
        <th class="px-2 py-3 text-center w-[40px] bg-gray-50">ល.រ</th>
        <th class="px-4 py-3 sticky left-0 bg-gray-50 z-10">ឈ្មោះ</th>
        <th class="px-4 py-3 print-hidden">ភេទ</th>
    `;
    
    validDates.forEach(d => {
        const dateStrDisplay = String(d.getDate()).padStart(2, '0');
        const dateStrFull = getLocalDateString(d);
        const dayOfWeek = d.getDay();
        // Find schedule for this day
        const schedule = schedules.find(s => s.day_of_week === dayOfWeek);
        const scheduleId = schedule ? schedule.id : '';
        const startTime = schedule ? schedule.start_time : '07:00:00';

        headerHTML += `<th onclick="toggleAllMonthlyStatus('${dateStrFull}', '${selectedClass}', '${scheduleId}', '${startTime}')" class="px-2 py-3 text-center text-xs font-bold w-[40px] cursor-pointer hover:bg-gray-200 transition-colors" title="ប្ដូរទាំងអស់">${dateStrDisplay}</th>`;
    });

    headerHTML += `
        <th class="px-4 py-3 text-center bg-green-50 text-green-700">សរុបវត្តមាន</th>
        <th class="px-4 py-3 text-center bg-red-50 text-red-700">សរុបអវត្តមាន</th>
    `;
    thead.innerHTML = headerHTML;

    // 7. Map Logs for fast lookup
    const logMap = new Map();
    logs.forEach(l => {
        logMap.set(`${l.student_id}_${l.attendance_date}`, l.status);
    });

    // 8. Build Rows
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="px-6 py-4 text-center">មិនមានសិស្សក្នុងថ្នាក់នេះ</td></tr>';
        return;
    }

    // FIXED: Use local string comparison for "Today" and "Past" logic
    const todayStr = getLocalDateString(new Date());

    const rowsHTML = students.map((student, index) => { // Added index
        const gender = student.gender || '-';
        
        // Format Name for Female Students
        let displayName = `${student.last_name} ${student.first_name}`;
        if (gender === 'ស្រី' || gender === 'F' || gender === 'Female') {
            displayName = `ក. ${displayName}`;
        }

        let cells = `
            <td class="px-2 py-3 text-center border-r border-gray-100">${index + 1}</td>
            <td class="px-4 py-3 sticky left-0 bg-white font-medium text-gray-900 border-r border-gray-100 shadow-sm">${displayName}</td>
            <td class="px-4 py-3 text-gray-600 print-hidden">${gender}</td>
        `;

        let presentCount = 0;
        let absentCount = 0;

        validDates.forEach(date => {
            // FIXED: Use local date string generator
            const dateStr = getLocalDateString(date); 
            const status = logMap.get(`${student.student_id}_${dateStr}`);
            
            let symbol = '<span class="text-gray-300">-</span>'; // Default future
            let clickAction = `onclick="toggleMonthlyStatus('${student.student_id}', '${dateStr}', '${status || 'null'}', '${selectedClass}')"`;
            let cursorClass = "cursor-pointer hover:bg-gray-100";
            
            // Logic
            if (status === 'វត្តមាន' || status?.includes('ចូលយឺត')) {
                symbol = '<i data-lucide="check" class="w-4 h-4 text-green-600 mx-auto font-bold"></i>';
                presentCount++;
            } else if (status === 'អវត្តមាន') {
                symbol = '<i data-lucide="x" class="w-4 h-4 text-red-600 mx-auto font-bold"></i>';
                absentCount++;
            } else {
                // No log found. Check if past date.
                // FIXED: String comparison is safer than Date object comparison here
                if (dateStr < todayStr) {
                    symbol = '<i data-lucide="x" class="w-4 h-4 text-red-600 mx-auto font-bold"></i>';
                    absentCount++;
                    // Allow clicking to mark present if absent by default
                } else if (dateStr === todayStr) {
                    // Today: if not scanned yet, show ?
                    symbol = '<span class="text-orange-400 font-bold">?</span>';
                }
            }

            cells += `<td ${clickAction} class="px-2 py-3 text-center border-l border-gray-50 ${cursorClass}">${symbol}</td>`;
        });

        cells += `
            <td class="px-4 py-3 text-center font-bold text-green-600 bg-green-50 border-l border-white">${presentCount}</td>
            <td class="px-4 py-3 text-center font-bold text-red-600 bg-red-50 border-l border-white">${absentCount}</td>
        `;

        return `<tr class="hover:bg-gray-50 border-b border-gray-100 text-base">${cells}</tr>`;
    }).join('');

    tbody.innerHTML = rowsHTML;
    
    if (window.lucide) lucide.createIcons();
}

function setupEventListeners() {
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('auth-btn');
            const alertBox = document.getElementById('auth-alert');

            btn.disabled = true;
            btn.innerHTML = "កំពុងដំណើរការ...";
            alertBox.classList.add('hidden');

            try {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } catch (err) {
                alertBox.classList.remove('hidden');
                document.getElementById('auth-alert-msg').textContent = "អ៊ីមែល ឬ ពាក្យសម្ងាត់មិនត្រឹមត្រូវ";
                btn.disabled = false;
                btn.innerHTML = "ចូលប្រើប្រាស់";
            }
        });
    }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
    });

    const scannerForm = document.getElementById('scanner-form');
    if (scannerForm) {
        scannerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('scanner-input');
            const val = input.value.trim();
            if (val) {
                handleAttendance(val);
            }
        });
    }

    const schForm = document.getElementById('add-schedule-form');
    if (schForm) {
        schForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-sch-btn');
            btn.disabled = true;
            btn.textContent = "កំពុងរក្សាទុក...";
            
            const id = document.getElementById('sch-id').value;
            const classId = document.getElementById('sch-class-id').value; 
            const day = document.getElementById('sch-day').value;
            const start = document.getElementById('sch-start').value;
            const end = document.getElementById('sch-end').value;

            const payload = {
                user_id: session.user.id,
                class_id: classId,
                day_of_week: parseInt(day),
                start_time: start,
                end_time: end
            };

            try {
                let error;
                if (id) {
                    const res = await supabase.from('schedules').update(payload).eq('id', id);
                    error = res.error;
                } else {
                    const res = await supabase.from('schedules').insert([payload]);
                    error = res.error;
                }

                if (error) throw error;

                closeScheduleModal();
                loadSchedules();
                showAlert('success', id ? 'កែប្រែកាលវិភាគបានជោគជ័យ' : 'បន្ថែមកាលវិភាគបានជោគជ័យ');

            } catch (err) {
                console.error(err);
                alert('កំហុសក្នុងការរក្សាទុក: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = id ? "ធ្វើបច្ចុប្បន្នភាព" : "រក្សាទុក";
            }
        });
    }

    document.getElementById('view-dashboard')?.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A' && e.target.tagName !== 'INPUT') {
            document.getElementById('scanner-input')?.focus();
        }
    });
}

// --- DATA FETCHING (OPTIMIZED) ---

// 1. Students
async function loadStudents() {
    const tbody = document.getElementById('students-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center"><div class="spinner w-6 h-6 mx-auto border-blue-500"></div></td></tr>';
    
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_name', { ascending: true })
        .limit(100000); 

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">កំហុស: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">មិនមានទិន្នន័យសិស្ស</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(st => `
        <tr class="bg-white border-b hover:bg-gray-50 text-base">
            <td class="px-6 py-4 font-medium font-mono text-blue-600">${st.student_id}</td>
            <td class="px-6 py-4 text-gray-800">${st.last_name} ${st.first_name}</td>
            <td class="px-6 py-4 text-gray-600">${st.gender || '-'}</td>
            <td class="px-6 py-4 text-gray-600">${st.class_id}</td>
            <td class="px-6 py-4 text-gray-500">${st.dob ? new Date(st.dob).toLocaleDateString('km-KH') : '-'}</td>
        </tr>
    `).join('');
}

// 2. Classes
async function loadClasses() {
    const tbody = document.getElementById('classes-table-body');
    tbody.innerHTML = '<tr><td colspan="2" class="px-6 py-4 text-center"><div class="spinner w-6 h-6 mx-auto border-blue-500"></div></td></tr>';
    
    // Select minimal data
    const { data, error } = await supabase
        .from('students')
        .select('class_id')
        .eq('user_id', session.user.id)
        .limit(100000); 

    if (error) {
        tbody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-red-500">កំហុស: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="px-6 py-4 text-center">មិនមានទិន្នន័យថ្នាក់</td></tr>';
        return;
    }

    const classCounts = {};
    data.forEach(student => {
        let classId = student.class_id || 'Unknown';
        if (typeof classId === 'string') classId = classId.trim();
        classCounts[classId] = (classCounts[classId] || 0) + 1;
    });

    const sortedClasses = Object.keys(classCounts).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    tbody.innerHTML = sortedClasses.map(cls => `
        <tr class="bg-white border-b hover:bg-gray-50 text-base">
            <td class="px-6 py-4 text-gray-900">${cls}</td>
            <td class="px-6 py-4"><span class="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">${classCounts[cls]} នាក់</span></td>
        </tr>
    `).join('');
}

// 3. Schedules
async function loadSchedules() {
    const tbody = document.getElementById('schedules-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center"><div class="spinner w-6 h-6 mx-auto border-blue-500"></div></td></tr>';
    
    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', session.user.id)
        .order('day_of_week', { ascending: true });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">កំហុសក្នុងការផ្ទុកកាលវិភាគ</td></tr>`;
        return;
    }

    const days = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">មិនមានកាលវិភាគ</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(sch => `
        <tr class="bg-white border-b hover:bg-gray-50 text-base">
            <td class="px-6 py-4 text-gray-900">${sch.class_id}</td>
            <td class="px-6 py-4"><span class="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">${days[sch.day_of_week]}</span></td>
            <td class="px-6 py-4 font-mono">${sch.start_time}</td>
            <td class="px-6 py-4 font-mono">${sch.end_time}</td>
            <td class="px-6 py-4 text-right space-x-2">
                <button onclick="editSchedule('${sch.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-2 py-1 rounded">កែប្រែ</button>
                <button onclick="deleteSchedule('${sch.id}')" class="text-red-600 hover:text-red-800 text-sm font-medium bg-red-50 px-2 py-1 rounded">លុប</button>
            </td>
        </tr>
    `).join('');
}

// --- CORE ATTENDANCE LOGIC ---
async function fetchTodaysLogs() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('attendance_date', today)
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false }); 

    const list = document.getElementById('activity-list');
    
    if (data) {
        document.getElementById('total-scans').textContent = data.length;
        
        if (data.length === 0) {
            list.innerHTML = `<div class="p-8 text-center text-gray-400 text-base">មិនមានការស្កេននៅឡើយទេក្នុងថ្ងៃនេះ!</div>`;
            return;
        }

        list.innerHTML = data.map(log => `
            <div class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                    <div class="text-base font-bold text-gray-800">${log.student_name || 'មិនស្គាល់'}</div>
                    <div class="text-sm text-gray-500 flex items-center gap-2">
                        <span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-bold">${log.student_id}</span>
                        <span>${log.class_id}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-base font-mono font-medium text-gray-600">
                        ${new Date(log.scan_time_in).toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div class="text-sm font-bold uppercase ${log.scan_time_out ? 'text-green-500' : 'text-orange-500'}">
                        ${log.scan_time_out ? 'បានចេញ' : 'បានចូល'}
                    </div>
                </div>
            </div>
        `).join('');
        
        if (window.lucide) lucide.createIcons();
    }
}

async function handleAttendance(studentId) {
    if (isProcessing) return;
    isProcessing = true;
    const inputEl = document.getElementById('scanner-input');
    inputEl.disabled = true; 
    
    try {
        // 1. Fetch Student
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('*')
            .eq('student_id', studentId)
            .eq('user_id', session.user.id)
            .single();

        if (studentError || !student) throw new Error(`រកមិនឃើញសិស្សដែលមានអត្តលេខៈ ${studentId}`);

        // 2. Find Schedule (Day + Time)
        const now = new Date();
        const currentDay = now.getDay();
        
        // Fetch all schedules for this class on this day
        const { data: schedules, error: scheduleError } = await supabase
            .from('schedules')
            .select('*')
            .eq('class_id', student.class_id)
            .eq('day_of_week', currentDay)
            .eq('user_id', session.user.id);

        if (scheduleError) throw scheduleError;

        let activeSchedule = null;
        let activeStatus = 'វត្តមាន'; // Default

        // Logic to find the matching schedule based on time window (Start - 10m to End)
        // And calculate status (Late)
        for (const schedule of schedules) {
            // Parse schedule times
            // schedule.start_time is "HH:MM:SS"
            const [sHour, sMin] = schedule.start_time.split(':');
            const [eHour, eMin] = schedule.end_time.split(':');

            const startTime = new Date(now);
            startTime.setHours(parseInt(sHour), parseInt(sMin), 0, 0);

            const endTime = new Date(now);
            endTime.setHours(parseInt(eHour), parseInt(eMin), 0, 0);

            // Allow scanning 10 mins before start
            const earlyWindow = new Date(startTime.getTime() - 10 * 60000);

            if (now >= earlyWindow && now <= endTime) {
                activeSchedule = schedule;
                
                // Check Late Status: > 10 mins after start
                const lateThreshold = new Date(startTime.getTime() + 10 * 60000);
                
                if (now > lateThreshold) {
                    const diffMs = now - startTime;
                    const lateMinutes = Math.floor(diffMs / 60000);
                    activeStatus = `ចូលយឺត ${lateMinutes} នាទី`;
                }
                break;
            }
        }

        if (!activeSchedule) throw new Error(`មិនមានម៉ោងសិក្សាសម្រាប់ ${student.first_name} នៅពេលនេះទេ (អាចស្កេនមុន ១០នាទី)`);

        const todayStr = now.toISOString().split('T')[0];

        // 3. Logic: Check In or Check Out
        const { data: existingLog } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('student_id', studentId)
            .eq('schedule_id', activeSchedule.id)
            .eq('attendance_date', todayStr)
            .single();

        let message = "";
        let type = "success";

        if (existingLog) {
            if (!existingLog.scan_time_out) {
                const { error } = await supabase
                    .from('attendance_logs')
                    .update({ 
                        scan_time_out: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingLog.id);
                if (error) throw error;
                message = `បានស្កេនចេញ: ${student.last_name} ${student.first_name}`;
            } else {
                message = `បានបញ្ចប់ការសិក្សារួចរាល់: ${student.last_name}`;
                type = "error"; 
            }
        } else {
            const { error } = await supabase
                .from('attendance_logs')
                .insert([{
                    user_id: session.user.id,
                    student_id: student.student_id,
                    student_name: `${student.last_name} ${student.first_name}`,
                    class_id: student.class_id,
                    schedule_id: activeSchedule.id,
                    attendance_date: todayStr,
                    scan_time_in: new Date().toISOString(),
                    status: activeStatus, 
                    gender: student.gender 
                }]);
            if (error) throw error;
            message = `បានស្កេនចូល: ${student.last_name} ${student.first_name} (${activeStatus})`;
        }

        showAlert(type, message);
        inputEl.value = ""; 
        fetchTodaysLogs();

    } catch (err) {
        showAlert('error', err.message);
        inputEl.select(); 
    } finally {
        isProcessing = false;
        inputEl.disabled = false;
        inputEl.focus(); 
    }
}

function showAlert(type, msg) {
    const alertBox = document.getElementById('dash-alert');
    const content = document.getElementById('dash-alert-content');
    const msgSpan = document.getElementById('dash-alert-msg');
    
    alertBox.classList.remove('hidden');
    msgSpan.textContent = msg;

    if (type === 'error') {
        content.className = "flex items-center p-4 rounded-lg border bg-red-100 text-red-800 border-red-200 shadow-lg";
        document.getElementById('dash-alert-icon').innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
    } else {
        content.className = "flex items-center p-4 rounded-lg border bg-green-100 text-green-800 border-green-200 shadow-lg";
        document.getElementById('dash-alert-icon').innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
    }
    
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 4000);
}