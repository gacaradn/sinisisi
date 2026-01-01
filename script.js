// === IMPORTANT: UPDATE THESE ===
const GITHUB_OWNER = 'your-github-username';     // e.g., 'gachara123'
const GITHUB_REPO = 'your-repo-name';           // e.g., 'midara-diary'
const CSV_PATH = 'data.csv';
const GITHUB_BRANCH = 'main';
const RAW_CSV_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${CSV_PATH}`;

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
        loadFromGitHub();
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

// === Date ===
function getCurrentDate() {
    const options = { timeZone: timezone, year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
}

function getCurrentDateISO() {
    const now = new Date();
    const offset = 3 * 60;
    const eat = new Date(now.getTime() + offset * 60 * 1000);
    return eat.toISOString().split('T')[0];
}

function updateDate() {
    document.getElementById('current-date').textContent = `Today: ${getCurrentDate()}`;
}

// === UI ===
function toggleAmount(select) {
    const amountInput = select.parentNode.querySelector('input[type="number"]');
    amountInput.style.display = select.value === 'work' ? 'inline' : 'none';
    amountInput.required = select.value === 'work';
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    document.querySelector(`button[onclick="showTab('${tabId}')"]`).classList.add('active');
}

// === Tasks ===
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
    form.reset();
    inputs[2].style.display = 'none';
}

function markDone(id, checked) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.done = checked;
        task.completed_date = checked ? getCurrentDateISO() : '';
        renderTasks();
    }
}

// === Rendering ===
function renderTasks() {
    ['gachara', 'mideva'].forEach(p => {
        const tbody = document.getElementById(`${p}-table`).querySelector('tbody');
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
    const tbody = document.getElementById('reminders-table').querySelector('tbody');
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
            <td>${task.overdueDays > 0 ? task.overdueDays : 'Not yet'}</td>
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
    const today = getCurrentDateISO();
    const week = getWeekNumber(today);
    const year = new Date(today).getUTCFullYear();
    const month = new Date(today).getUTCMonth() + 1;

    const doneWork = tasks.filter(t => t.done && t.type === 'work');
    const sum = filter => doneWork.filter(filter).reduce((s,t) => s + t.amount, 0);

    const daily = sum(t => t.completed_date === today);
    const weekly = sum(t => getWeekNumber(t.completed_date) === week && new Date(t.completed_date).getUTCFullYear() === year);
    const monthly = sum(t => new Date(t.completed_date).getUTCMonth() + 1 === month && new Date(t.completed_date).getUTCFullYear() === year);

    container.innerHTML = `
        <h3>Our Combined Earnings 💕</h3>
        <p>Today: KSh ${daily}</p>
        <p>This Week: KSh ${weekly}</p>
        <p>This Month: KSh ${monthly}</p>
    `;
}

// === GitHub CSV ===
function getGitHubToken() {
    let token = sessionStorage.getItem('github_pat');
    if (!token) {
        token = prompt('Enter your GitHub Personal Access Token (PAT) to save:');
        if (token) sessionStorage.setItem('github_pat', token);
    }
    return token;
}

async function loadFromGitHub() {
    try {
        const res = await fetch(RAW_CSV_URL + '?t=' + Date.now()); // cache bust
        if (!res.ok) throw new Error('Not found or private repo');
        const text = await res.text();
        parseCSV(text);
        renderTasks();
    } catch (e) {
        alert('Could not load data: ' + e.message + '\nCheck repo settings or internet.');
    }
}

function parseCSV(text) {
    tasks = [];
    nextId = 1;
    const lines = text.trim().split('\n');
    if (lines.length <= 1) return; // empty or header only
    lines.slice(1).forEach(line => {
        const [id, name, type, amount, deadline, done, completed, person] = line.split(',');
        const task = {
            id: parseInt(id),
            task_name: name,
            type,
            amount: parseFloat(amount) || 0,
            deadline,
            done: done === 'true',
            completed_date: completed || '',
            person
        };
        tasks.push(task);
        if (task.id >= nextId) nextId = task.id + 1;
    });
}

async function getFileSHA() {
    const token = getGitHubToken();
    if (!token) return null;
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${CSV_PATH}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha;
}

async function saveToGitHub() {
    const token = getGitHubToken();
    if (!token) return alert('PAT required to save');

    const sha = await getFileSHA();
    if (!sha) return alert('Could not get file info (wrong PAT or repo?)');

    const header = 'id,task_name,type,amount,deadline,done,completed_date,person\n';
    const rows = tasks.map(t => `${t.id},${t.task_name},${t.type},${t.amount},${t.deadline},${t.done},${t.completed_date},${t.person}`).join('\n');
    const content = btoa(unescape(encodeURIComponent(header + rows)));

    const body = {
        message: `MIDARA update by ${currentUser} on ${new Date().toISOString()}`,
        content,
        sha,
        branch: GITHUB_BRANCH
    };

    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${CSV_PATH}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
        },
        body: JSON.stringify(body)
    });

    if (res.ok) {
        alert('Saved successfully! 💕');
        loadFromGitHub();
    } else {
        const err = await res.json();
        alert('Save failed: ' + (err.message || 'Unknown error'));
    }
}

// === Init ===
updateDate();
setInterval(updateDate, 60000);
setInterval(loadFromGitHub, 30000); // Auto-refresh every 30s
