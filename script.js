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
    document.getElementById('current-date').textContent = `Today: ${getCurrentDate()}`;
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
    }
}

// === Rendering ===
function renderTasks() {
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
}

function calculateOverdue(deadline) {
    const today = new Date(getCurrentDateISO());
    const due = new Date(deadline);
    const diff = Math.floor((today - due) / (86400000));
    return diff > 0 ? diff : 0;
}

function renderReminders() {
    const table = document.getElementById('reminders-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    
    const overdue = tasks.filter(t => !t.done)
        .map(t => ({...t, overdueDays: calculateOverdue(t.deadline)}))
        .sort((a,b) => b.overdueDays - a.overdueDays);

    overdue.forEach(task => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${task.person}</td>
            <td>${task.task_name}</td>
            <td>${task.deadline}</td>
            <td>${task.overdueDays > 0 ? task.overdueDays + ' days' : 'Not yet'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function getWeekNumber(dateStr) {
    const d = new Date(dateStr);
    const dayNum = (d.getUTCDay() + 6) % 7 + 1;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart)/86400000)+1)/7);
}

function renderEarnings() {
    const container = document.getElementById('earnings-summary');
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
}

// === Google Sheets Integration ===
async function loadFromSheets() {
    try {
        // Use cache: "no-store" to ensure we always get the latest data
        const res = await fetch(SHEETS_CSV_URL, { cache: "no-store" });
        if (!res.ok) throw new Error('Sheet not accessible');
        
        const text = await res.text();
        
        // Safety check: If Google returns HTML (login page), don't parse it
        if (text.trim().startsWith('<!DOCTYPE html>')) {
            throw new Error('Received HTML instead of CSV. Check "Publish to Web" settings.');
        }

        parseCSV(text);
        renderTasks();
        console.log("Synced with Google Sheets ✅");
    } catch (e) {
        console.warn("Sheets sync failed:", e.message);
        loadFromLocalStorage();
    }
}

function parseCSV(text) {
    tasks = [];
    nextId = 1;
    const lines = text.trim().split(/\r?\n/);
    if (lines.length <= 1) return;

    // Advanced regex to handle commas inside quotes
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
    // Use JSON.stringify to wrap names in quotes if they have commas
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

    alert('CSV downloaded! 💕\n\nTo sync permanently:\n1. Open your Google Sheet\n2. File → Import → Upload\n3. Select this file\n4. Choose "Replace current sheet"');
}

// === Initialization ===
updateDate();
setInterval(updateDate, 60000);
setInterval(loadFromSheets, 30000); // Auto-refresh every 30s
loadFromSheets(); // Initial load
