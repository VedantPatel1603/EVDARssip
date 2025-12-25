// 🔒 prevent double execution
if (window.__dashboardLoaded) {
    console.warn("Dashboard script already loaded");
} else {
    window.__dashboardLoaded = true;

    document.addEventListener("DOMContentLoaded", () => {
        // Delay prevents Live Server race condition
        setTimeout(initDashboard, 100);
    });
}

function initDashboard() {
    const raw = localStorage.getItem("user");

    if (!raw) {
        safeRedirect();
        return;
    }

    let user;
    try {
        user = JSON.parse(raw);
    } catch (e) {
        console.error("Invalid JSON in storage", e);
        safeRedirect();
        return;
    }

    if (!user.username || !user.role) {
        safeRedirect();
        return;
    }

    // ---- UI BINDING ----
    const welcomeEl = document.getElementById("welcome");
    if (welcomeEl) welcomeEl.innerText = `Welcome ${user.username} (${user.role})`;

    const userIdEl = document.getElementById("userId");
    if (userIdEl) userIdEl.innerText = user.user_id ?? "N/A";

    const select = document.getElementById("clientSelect");
    if (select) {
        select.innerHTML = "";

        if (user.role === "admin") {
            ["car1", "car2", "car3"].forEach(c => {
                const o = document.createElement("option");
                o.value = c;
                o.textContent = c;
                select.appendChild(o);
            });
        } else {
            const o = document.createElement("option");
            o.value = user.car;
            o.textContent = user.car;
            select.appendChild(o);
        }
    }

    console.log("Dashboard ready", user);
    // expose current user for other scripts
    window.__evdarUser = user;

    // render default view
    // show admin link only for admins
    const adminLink = document.querySelector('.admin-link');
    if (adminLink) adminLink.style.display = (user.role === 'admin') ? 'block' : 'none';

    if (window.renderView) window.renderView('overview');
}

function logout() {
    localStorage.removeItem("user");
    window.location.href = "index.html";
}

function safeRedirect() {
    console.warn("Redirecting due to missing session");
    setTimeout(() => {
        window.location.href = "index.html";
    }, 200);
}

// render content into the main area based on sidebar selection
window.renderView = function(view) {
    const main = document.getElementById('mainContent');
    const raw = localStorage.getItem('user');
    let user = null;
    try { user = raw ? JSON.parse(raw) : null; } catch(e) { user = null; }

    if (!main) return;

    if (view === 'overview') {
        const name = user && user.username ? user.username : 'User';
        const hrs = new Date().getHours();
        let salutation = 'Hello';
        if (hrs < 12) salutation = 'Good morning';
        else if (hrs < 18) salutation = 'Good afternoon';
        else salutation = 'Good evening';

        main.innerHTML = `<h2>${salutation}, ${name}!</h2><p>Overview — select another page from the sidebar.</p>`;
        return;
    }

    if (view === 'vehicle') {
        main.innerHTML = `<h2>Vehicle Location</h2><p>Map placeholder — integrate a map here.</p>`;
        return;
    }

    if (view === 'admin') {
        // admin-only page
        const raw = localStorage.getItem('user');
        let user = null;
        try { user = raw ? JSON.parse(raw) : null; } catch(e) { user = null; }

        if (!user || user.role !== 'admin') {
            main.innerHTML = `<h2>Access denied</h2><p>This page is for administrators only.</p>`;
            return;
        }

        main.innerHTML = `
          <h2>Admin Console</h2>
          <p>Welcome, ${user.username}. Use these tools to manage the system.</p>
          <div style="margin-top:12px">
            <button id="btnReloadUsers">Reload user list</button>
            <div id="adminOutput" style="margin-top:12px;font-family:monospace;white-space:pre-wrap"></div>
          </div>`;

                // add user form
                const formHtml = `
                    <hr />
                    <h3>Add user</h3>
                    <form id="adminAddUserForm">
                        <label>Username<br><input name="username" required></label><br>
                        <label>Password<br><input name="password" type="password" required></label><br>
                        <label>Role<br>
                            <select name="role">
                                <option value="user">user</option>
                                <option value="admin">admin</option>
                            </select>
                        </label><br>
                        <label>Car (optional)<br><input name="car" placeholder="car1.csv"></label><br>
                        <button type="submit">Add user</button>
                    </form>
                    <div id="adminAddOutput" style="margin-top:10px"></div>
                `;

                main.insertAdjacentHTML('beforeend', formHtml);

        // simple client-side action: fetch users from backend `/users` and render a table
        const btn = document.getElementById('btnReloadUsers');
        const out = document.getElementById('adminOutput');
        function renderUsersTable(users) {
            if (!Array.isArray(users) || users.length === 0) {
                out.innerHTML = '<p>No users found.</p>';
                return;
            }
            const keys = Object.keys(users[0]);
            let html = '<table style="width:100%;border-collapse:collapse">';
            html += '<thead><tr>' + keys.map(k=>`<th style="text-align:left;border-bottom:1px solid #ddd;padding:6px">${k}</th>`).join('') + '</tr></thead>';
            html += '<tbody>' + users.map(u => '<tr>' + keys.map(k=>`<td style="padding:6px;border-bottom:1px solid #f3f3f3">${(u[k]===undefined)?'':u[k]}</td>`).join('') + '</tr>').join('') + '</tbody>';
            html += '</table>';
            out.innerHTML = html;
        }

        if (btn && out) {
            btn.addEventListener('click', async () => {
                out.textContent = 'Loading...';
                try {
                    // If frontend is served via Live Server (port 5500),
                    // point requests to the Flask backend on port 5000.
                    const API_BASE =  "https://untempting-untemperamentally-renata.ngrok-free.dev";

                    const res = await fetch(API_BASE + '/users');
                    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
                    const users = await res.json();
                    renderUsersTable(users);
                } catch (err) {
                    out.textContent = 'Could not load users: ' + err.message;
                }
            });
        }

        // --- Add user form handling ---
        const addForm = document.getElementById('adminAddUserForm');
        const addOutput = document.getElementById('adminAddOutput');
        if (addForm && addOutput) {
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = new FormData(addForm);
                const payload = {
                    username: form.get('username'),
                    password: form.get('password'),
                    role: form.get('role'),
                    car: form.get('car')
                };

                addOutput.textContent = 'Adding...';
                try {
                    const API_BASE = "https://untempting-untemperamentally-renata.ngrok-free.dev";


                    const res = await fetch(API_BASE + '/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Create failed');
                    addOutput.textContent = 'User added (id: ' + data.user_id + ')';
                } catch (err) {
                    addOutput.textContent = 'Could not add user: ' + err.message;
                }
            });
        }

        return;
    }

    if (view === 'help') {
        main.innerHTML = `<h2>Help</h2><p>For assistance, contact support.</p>`;
        return;
    }

    if (view === 'contact') {
        main.innerHTML = `<h2>Contact Us</h2><p>Email: support@EVDAR.example</p>`;
        return;
    }

    if (view === 'about') {
        main.innerHTML = `<h2>About</h2><p>EVDAR — vehicle telemetry dashboard</p>`;
        return;
    }

    main.innerHTML = `<p>Unknown view: ${view}</p>`;
}
