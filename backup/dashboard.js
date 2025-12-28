let allRows = [];
let speedChart = null;

// Protect dashboard
const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "index.html";

// Header
document.getElementById("welcome").innerText =
  `evdar — ${user.username} (${user.role})`;

document.getElementById("adminControls").style.display =
  user.role === "admin" ? "block" : "none";

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

// CSV helpers
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

// GPS speed calculation
function toRad(d){ return d * Math.PI / 180; }

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*
    Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calculateSpeed(rows) {
  rows[0].speed = 0;
  const MAX_SPEED = 180;

  for (let i = 1; i < rows.length; i++) {
    const t1 = new Date(rows[i-1].timestamp.replace(" ","T"));
    const t2 = new Date(rows[i].timestamp.replace(" ","T"));
    const dt = (t2 - t1) / 1000;
    if (dt <= 0) { rows[i].speed = 0; continue; }

    const d = haversine(
      +rows[i-1].lat, +rows[i-1].lon,
      +rows[i].lat,   +rows[i].lon
    );

    let speed = (d / dt) * 3600;
    rows[i].speed = speed > MAX_SPEED ? 0 : speed.toFixed(1);
  }
}

// Load data
async function loadClientCSV(file) {
  const csv = await loadCSV(file);
  allRows = parseCSV(csv);
  calculateSpeed(allRows);
  renderRows(allRows.slice(-100));
  updateChart(allRows);
  updateOverspeed(allRows);
}

function loadSelectedClient() {
  loadClientCSV(clientSelect.value);
}

function loadByTimeRange() {
  const from = new Date(fromTime.value);
  const to = new Date(toTime.value);

  const filtered = allRows.filter(r => {
    const t = new Date(r.timestamp.replace(" ","T"));
    return t >= from && t <= to;
  });

  renderRows(filtered.slice(-300));
  updateChart(filtered);
  updateOverspeed(filtered);
}

// UI
function renderRows(rows) {
  carTable.innerHTML =
    `<tr>
      <th>Time</th><th>Lat</th><th>Lon</th>
      <th>Speed (km/h)</th><th>Ax</th><th>Ay</th><th>Az</th><th>Event</th>
     </tr>`;

  rows.forEach(r => {
    const row = carTable.insertRow();
    row.insertCell().innerText = r.timestamp;
    row.insertCell().innerText = r.lat;
    row.insertCell().innerText = r.lon;

    const s = row.insertCell();
    s.innerText = r.speed;
    if (r.speed > 100) s.classList.add("speed-red");

    row.insertCell().innerText = r.ax;
    row.insertCell().innerText = r.ay;
    row.insertCell().innerText = r.az;
    row.insertCell().innerText = r.event || "-";
  });
}

function updateChart(rows) {
  const d = rows.slice(-50);
  if (speedChart) speedChart.destroy();

  speedChart = new Chart(document.getElementById("speedChart"), {
    type: "line",
    data: {
      labels: d.map(r => r.timestamp.slice(11)),
      datasets: [{
        label: "Speed (km/h)",
        data: d.map(r => r.speed),
        borderColor: "#2a5298"
      }]
    }
  });
}

function updateOverspeed(rows) {
  overspeedCount.innerText =
    rows.filter(r => r.speed > 100).length;
}

// Auto-load
if (user.role === "admin") loadClientCSV("car1.csv");
else loadClientCSV(user.car);
