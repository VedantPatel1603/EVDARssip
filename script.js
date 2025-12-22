const users = [
  { username: "admin",   password: "admin@123", role: "admin" },
  { username: "client1", password: "c1@456",    role: "client", car: "car1.csv" },
  { username: "client2", password: "c2@789",    role: "client", car: "car2.csv" },
  { username: "client3", password: "c3@321",    role: "client", car: "car3.csv" },
  { username: "client4", password: "c4@654",    role: "client", car: "car4.csv" },
  { username: "client5", password: "c5@987",    role: "client", car: "car5.csv" }
];

let allRows = [];
let speedChart = null;

/* ================= LOGIN PAGE ================= */

function login() {
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;
  const err = document.getElementById("error");

  const user = users.find(x => x.username === u && x.password === p);
  if (!user) {
    err.innerText = "Invalid username or password";
    return;
  }

  localStorage.setItem("user", JSON.stringify(user));
  window.location.href = "dashboard.html";
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

/* ================= CSV HELPERS ================= */

async function loadCSV(file) {
  const res = await fetch("data/" + file);
  return await res.text();
}

function parseCSV(csv) {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(l => {
    const v = l.split(",");
    let o = {};
    headers.forEach((h,i)=>o[h]=v[i]);
    return o;
  });
}

/* ================= GPS SPEED ================= */

function toRad(d){ return d * Math.PI / 180; }

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calculateSpeed(rows) {
  if (rows.length === 0) return;
  rows[0].speed = 0;

  const MIN_DISTANCE_KM = 0.005;

  for (let i = 1; i < rows.length; i++) {
    const p1 = rows[i-1];
    const p2 = rows[i];

    const t1 = new Date(p1.timestamp.replace(" ", "T"));
    const t2 = new Date(p2.timestamp.replace(" ", "T"));
    const dt = (t2 - t1) / 1000;

    if (dt <= 0 || isNaN(dt)) {
      rows[i].speed = 0;
      continue;
    }

    const d = haversine(+p1.lat, +p1.lon, +p2.lat, +p2.lon);
    if (d < MIN_DISTANCE_KM) {
      rows[i].speed = 0;
      continue;
    }

    rows[i].speed = Number(((d / dt) * 3600).toFixed(1));
  }
}

/* ================= DASHBOARD PAGE ================= */

document.addEventListener("DOMContentLoaded", () => {

  // 🚫 Stop here if NOT dashboard
  if (!window.location.pathname.includes("dashboard.html")) return;

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Safe DOM references
  const welcome = document.getElementById("welcome");
  const adminControls = document.getElementById("adminControls");
  const clientSelect = document.getElementById("clientSelect");
  const fromTime = document.getElementById("fromTime");
  const toTime = document.getElementById("toTime");
  const carTable = document.getElementById("carTable");
  const overspeedCount = document.getElementById("overspeedCount");

  welcome.innerText = `Welcome ${user.username} (${user.role})`;

  window.loadSelectedClient = () => loadClientCSV(clientSelect.value);
  window.loadByTimeRange = loadByTimeRange;

  if (user.role === "admin") {
    adminControls.style.display = "block";
    loadClientCSV("car1.csv");
  } else {
    adminControls.style.display = "none";
    loadClientCSV(user.car);
  }

  async function loadClientCSV(file) {
    const csv = await loadCSV(file);
    allRows = parseCSV(csv);
    calculateSpeed(allRows);
    renderRows(allRows.slice(-100));
    updateOverspeedCount(allRows);
    updateSpeedChart(allRows);
  }

  function loadByTimeRange() {
    const from = new Date(fromTime.value);
    const to = new Date(toTime.value);

    const filtered = allRows.filter(r => {
      const t = new Date(r.timestamp.replace(" ", "T"));
      return t >= from && t <= to;
    });

    renderRows(filtered.slice(-300));
    updateOverspeedCount(filtered);
    updateSpeedChart(filtered);
  }

  function renderRows(rows) {
    carTable.innerHTML =
      `<tr>
        <th>Time</th><th>Lat</th><th>Lon</th>
        <th>Speed</th><th>Ax</th><th>Ay</th><th>Az</th><th>Event</th>
      </tr>`;

    rows.forEach(r => {
      const row = carTable.insertRow();
      row.insertCell().innerText = r.timestamp;
      row.insertCell().innerText = r.lat;
      row.insertCell().innerText = r.lon;

      const s = Number(r.speed || 0);
      const sc = row.insertCell();
      sc.innerText = s;
      if (s > 100) sc.classList.add("speed-red");

      row.insertCell().innerText = r.ax;
      row.insertCell().innerText = r.ay;
      row.insertCell().innerText = r.az;
      row.insertCell().innerText = r.event || "-";
    });
  }

  function updateSpeedChart(rows) {
    const d = rows.slice(-50);
    if (speedChart) speedChart.destroy();

    speedChart = new Chart(document.getElementById("speedChart"), {
      type: "line",
      data: {
        labels: d.map(r => r.timestamp.slice(11)),
        datasets: [{
          label: "Speed (km/h)",
          data: d.map(r => Number(r.speed || 0)),
          borderColor: "#2a5298",
          fill: false
        }]
      },
      options: { scales: { y: { min: 0, max: 160 } } }
    });
  }

  function updateOverspeedCount(rows) {
    overspeedCount.innerText =
      rows.filter(r => Number(r.speed || 0) > 100).length;
  }
});
