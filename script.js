// === Google Sheets Config ===
const SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRRMn_yfQj367qpWx_2TeusvW1a_KquEbFhJXCXItvnyTHxmWyQnkWNQTow-EhIbzHEgRW9cQVk7ZEf/pub?output=csv';
// === Login System ===
const VALID_USERS = {
    "Gachara": "LoveMideva2026",
    "Mideva": "LoveGachara2026"
};
let currentUser = null;
let tasks = [];
let nextId = 1;
const timezone = 'Africa/Nairobi';
let currentYear = new Date().getFullYear();
let currentMonth = null;
// Login
function attemptLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (VALID_USERS[username] && VALID_USERS[username] === password) {
        currentUser = username;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('welcome-user').textContent = `Welcome home, ${currentUser} ❤️`;
        loadFromSheets();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}
function logout() {
    currentUser = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-error').style.display = 'none';
}
// === Date Helpers ===
function getCurrentDate() {
    const options = { timeZone: timezone, year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
}
function getCurrentDateISO() {
    const now = new Date();
    const offset = 3 * 60; // EAT = UTC+3
    const eat = new Date(now.getTime() + offset * 60 * 1000);
    return eat.toISOString().split('T')[0];
}
function updateDate() {
    const el = document.getElementById('current-date');
    if(el) el.textContent = `Today: ${getCurrentDate()}`;
}
// === UI Control ===
function toggleAmount(select) {
    const amountInput = select.parentNode.querySelector('input[type="number"]');
    amountInput.style.display = select.value === 'work' ? 'inline' : 'none';
    amountInput.required = select.value === 'work';
}
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    const btn = document.querySelector(`button[onclick="showTab('${tabId}')"]`);
    if (btn) btn.classList.add('active');
   
    if (tabId === 'completed-tasks') {
        renderCalendar();
    }
}
// === Tasks Logic ===
function addTask(person) {
    const form = document.getElementById(person.toLowerCase() + '-form');
    const inputs = form.querySelectorAll('input, select');
    const name = inputs[0].value.trim();
    const type = inputs[1].value;
    const amount = type === 'work' ? parseFloat(inputs[2].value) || 0 : 0;
    const deadline = inputs[3].value;
    if (!name || !deadline) return alert('Task name and deadline required!');
    tasks.push({
        id: nextId++,
        task_name: name,
        type,
        amount,
        deadline,
        done: false,
        completed_date: '',
        person
    });
    renderTasks();
    saveToLocalStorage();
    downloadUpdatedCSV(); // Immediate backup to CSV after add
    form.reset();
    inputs[2].style.display = 'none';
}
function markDone(id, checked) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.done = checked;
        task.completed_date = checked ? getCurrentDateISO() : '';
        renderTasks();
        saveToLocalStorage();
        downloadUpdatedCSV(); // Immediate backup to CSV after update
    }
}
// === Rendering ===
function renderTasks() {
    const today = getCurrentDateISO();
    // 1. Daily To-Do (All undone tasks)
    const dailyTbody = document.querySelector('#daily-todo-table tbody');
    if (dailyTbody) {
        dailyTbody.innerHTML = '';
        const undoneTasks = tasks.filter(t => !t.done);
        undoneTasks.sort((a, b) => a.deadline.localeCompare(b.deadline));
        undoneTasks.forEach(task => {
            const overdueDays = calculateOverdue(task.deadline);
            let status = '';
            if (overdueDays > 0) {
                status = `Overdue ${overdueDays} days`;
            } else if (task.deadline === today) {
                status = 'Due Today';
            } else {
                const daysUntil = -overdueDays; // Since overdueDays is negative for future
                status = `Due in ${daysUntil} days`;
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${task.person}</td>
                <td>${task.task_name}</td>
                <td>${task.type}</td>
                <td>${task.deadline}</td>
                <td>${status}</td>
                <td><input type="checkbox" onchange="markDone(${task.id}, this.checked)"></td>
            `;
            dailyTbody.appendChild(tr);
        });
    }
    // 2. Main Person Tables
    ['gachara', 'mideva'].forEach(p => {
        const table = document.getElementById(`${p}-table`);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';
       
        tasks.filter(t => t.person.toLowerCase() === p).forEach(task => {
            const tr = document.createElement('tr');
            if (task.done) tr.classList.add('done');
            tr.innerHTML = `
                <td>${task.task_name}</td>
                <td>${task.type}</td>
                <td>${task.amount > 0 ? task.amount : '-'}</td>
                <td>${task.deadline}</td>
                <td><input type="checkbox" ${task.done ? 'checked' : ''} onchange="markDone(${task.id}, this.checked)"></td>
            `;
            tbody.appendChild(tr);
        });
    });
    renderReminders();
    renderEarnings();
    renderCalendar();
}
function calculateOverdue(deadline) {
    const today = new Date(getCurrentDateISO());
    const due = new Date(deadline);
    const diff = Math.floor((today - due) / (86400000));
    return diff;
}
function renderReminders() {
    const table = document.getElementById('reminders-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
   
    // Reminders shows all undone tasks that are NOT due today (past due or future)
    const overdue = tasks.filter(t => !t.done)
        .map(t => ({...t, overdueDays: calculateOverdue(t.deadline)}))
        .sort((a,b) => b.overdueDays - a.overdueDays);
    overdue.forEach(task => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${task.person}</td>
            <td>${task.task_name}</td>
            <td>${task.deadline}</td>
            <td>${task.overdueDays > 0 ? task.overdueDays + ' days' : 'Upcoming'}</td>
        `;
        tbody.appendChild(tr);
    });
}
// === Calendar & Completed Tasks Logic ===
function backToYear() {
    currentMonth = null;
    renderCalendar();
}
function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarTitle = document.getElementById('calendar-title');
    const backBtn = document.getElementById('back-btn');
    const headers = document.querySelectorAll('.calendar-header');
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';
    if (currentMonth === null) {
        // Year view: show months
        calendarTitle.textContent = currentYear;
        backBtn.style.display = 'none';
        headers.forEach(h => h.style.display = 'none');
        calendarGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        for (let m = 1; m <= 12; m++) {
            const monthEl = document.createElement('div');
            monthEl.className = 'calendar-month';
            monthEl.textContent = new Date(2000, m - 1).toLocaleString('default', { month: 'short' });
            const monthStr = `${currentYear}-${String(m).padStart(2, '0')}`;
            const tasksInMonth = tasks.filter(t => t.done && t.completed_date.startsWith(monthStr));
            if (tasksInMonth.length > 0) {
                monthEl.classList.add('has-completed');
                monthEl.onclick = () => {
                    currentMonth = m - 1;
                    renderCalendar();
                };
            }
            calendarGrid.appendChild(monthEl);
        }
    } else {
        // Month view: show days
        calendarTitle.textContent = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
        backBtn.style.display = 'block';
        headers.forEach(h => h.style.display = 'block');
        calendarGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        // Create empty slots for start of month
        for (let i = 0; i < firstDay; i++) {
            calendarGrid.appendChild(document.createElement('div'));
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = day;
            const tasksOnDay = tasks.filter(t => t.done && t.completed_date === dateStr);
            if (tasksOnDay.length > 0) {
                dayEl.classList.add('has-completed');
                dayEl.onclick = () => showCompletedDetails(dateStr, tasksOnDay);
            }
            calendarGrid.appendChild(dayEl);
        }
    }
}
function showCompletedDetails(date, dayTasks) {
    const detailDiv = document.getElementById('day-details');
    detailDiv.style.display = 'block';
    detailDiv.innerHTML = `
        <h4>Tasks Completed on ${date}</h4>
        <table class="task-table">
            <thead>
                <tr><th>Person</th><th>Task</th><th>Type</th><th>Amount</th></tr>
            </thead>
            <tbody>
                ${dayTasks.map(t => `
                    <tr>
                        <td>${t.person}</td>
                        <td>${t.task_name}</td>
                        <td>${t.type}</td>
                        <td>${t.amount || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}
// === Earnings Logic ===
function getWeekNumber(dateStr) {
    const d = new Date(dateStr);
    const dayNum = (d.getUTCDay() + 6) % 7 + 1;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart)/86400000)+1)/7);
}
function renderEarnings() {
    const container = document.getElementById('earnings-summary');
    const pastEarnings = document.getElementById('past-earnings');
    const legend = document.getElementById('earnings-legend');
    if (!container) return;
   
    const today = getCurrentDateISO();
    const week = getWeekNumber(today);
    const year = new Date(today).getUTCFullYear();
    const month = new Date(today).getUTCMonth() + 1;
    const doneWork = tasks.filter(t => t.done && t.type === 'work');
    const sum = filter => doneWork.filter(filter).reduce((s,t) => s + (t.amount || 0), 0);
    const daily = sum(t => t.completed_date === today);
    const weekly = sum(t => getWeekNumber(t.completed_date) === week && new Date(t.completed_date).getUTCFullYear() === year);
    const monthly = sum(t => new Date(t.completed_date).getUTCMonth() + 1 === month && new Date(t.completed_date).getUTCFullYear() === year);
    container.innerHTML = `
        <h3>Our Combined Earnings 💕</h3>
        <p>Today: KSh ${daily.toLocaleString()}</p>
        <p>This Week: KSh ${weekly.toLocaleString()}</p>
        <p>This Month: KSh ${monthly.toLocaleString()}</p>
    `;

    // Collect monthly earnings
    let monthlyEarnings = new Map();
    doneWork.forEach(t => {
        if (!t.amount) return;
        const dateKey = t.completed_date.substring(0, 7); // YYYY-MM
        const currentSum = monthlyEarnings.get(dateKey) || 0;
        monthlyEarnings.set(dateKey, currentSum + t.amount);
    });

    // Past months list
    pastEarnings.innerHTML = '<h3>Past Months Earnings</h3>';
    Array.from(monthlyEarnings.keys()).sort((a, b) => b.localeCompare(a)).forEach(key => {
        const d = new Date(`${key}-01`);
        const name = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        pastEarnings.innerHTML += `<p>${name}: KSh ${monthlyEarnings.get(key).toLocaleString()}</p>`;
    });

    // Pie chart for current year
    const currYear = new Date().getFullYear();
    const yearMonths = [];
    let totalYear = 0;
    for (let m = 1; m <= 12; m++) {
        const key = `${currYear}-${String(m).padStart(2, '0')}`;
        const amt = monthlyEarnings.get(key) || 0;
        yearMonths.push(amt);
        totalYear += amt;
    }
    if (totalYear === 0) {
        legend.innerHTML = '<p>No earnings data for this year yet.</p>';
        return;
    }

    const canvas = document.getElementById('earnings-pie');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 300, 300);
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED', '#F7464A', '#66FF66', '#999999', '#CCCCCC', '#333333'];
    let startAngle = 0;
    yearMonths.forEach((amt, i) => {
        const slice = (amt / totalYear) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(150, 150, 100, startAngle, startAngle + slice);
        ctx.lineTo(150, 150);
        ctx.fillStyle = colors[i];
        ctx.fill();
        startAngle += slice;
    });

    // Legend
    legend.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
        const li = document.createElement('li');
        const monthName = new Date(currYear, m - 1).toLocaleString('default', { month: 'short' });
        li.innerHTML = `<span style="background-color:${colors[m - 1]}"></span> ${monthName}: KSh ${yearMonths[m - 1].toLocaleString()}`;
        legend.appendChild(li);
    }
}
// === Google Sheets Integration ===
async function loadFromSheets() {
    try {
        const res = await fetch(SHEETS_CSV_URL, { cache: "no-store" });
        if (!res.ok) throw new Error('Sheet not accessible');
        const text = await res.text();
        if (text.trim().startsWith('<!DOCTYPE html>')) throw new Error('CSV sync error');
        parseCSV(text);
        renderTasks();
        console.log("Synced ✅");
    } catch (e) {
        console.warn("Using Local Cache");
        loadFromLocalStorage();
    }
}
function parseCSV(text) {
    tasks = [];
    nextId = 1;
    const lines = text.trim().split(/\r?\n/);
    if (lines.length <= 1) return;
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    lines.slice(1).forEach(line => {
        const parts = line.split(regex).map(part => part.replace(/^"|"$/g, '').trim());
        if (parts.length < 8) return;
       
        const task = {
            id: parseInt(parts[0]) || 0,
            task_name: parts[1] || '',
            type: parts[2] || 'other',
            amount: parseFloat(parts[3]) || 0,
            deadline: parts[4] || '',
            done: parts[5].toLowerCase() === 'true',
            completed_date: parts[6] || '',
            person: parts[7] || ''
        };
       
        if (task.id >= nextId) nextId = task.id + 1;
        tasks.push(task);
    });
}
// === Local Storage Fallback ===
function loadFromLocalStorage() {
    const saved = localStorage.getItem('midara_tasks');
    if (saved) {
        tasks = JSON.parse(saved);
        nextId = tasks.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
        renderTasks();
    }
}
function saveToLocalStorage() {
    localStorage.setItem('midara_tasks', JSON.stringify(tasks));
}
function downloadUpdatedCSV() {
    const header = 'id,task_name,type,amount,deadline,done,completed_date,person\n';
    const rows = tasks.map(t =>
        `${t.id},"${t.task_name.replace(/"/g, '""')}",${t.type},${t.amount},${t.deadline},${t.done},${t.completed_date},${t.person}`
    ).join('\n');
   
    const csvContent = header + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midara-data-${getCurrentDateISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
// === Initialization ===
updateDate();
setInterval(updateDate, 60000);
setInterval(loadFromSheets, 30000);
loadFromSheets();
