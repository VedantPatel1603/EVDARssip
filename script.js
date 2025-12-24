let allRows = [];
let speedChart = null;

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

/* CSV helpers */
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

/* Speed calculation */
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
  for (let i = 1; i < rows.length; i++) {
    const p1 = rows[i-1], p2 = rows[i];
    const t1 = new Date(p1.timestamp.replace(" ", "T"));
    const t2 = new Date(p2.timestamp.replace(" ", "T"));
    const dt = (t2 - t1) / 1000;
    if (dt <= 0) { rows[i].speed = 0; continue; }
    const d = haversine(+p1.lat, +p1.lon, +p2.lat, +p2.lon);
    rows[i].speed = ((d / dt) * 3600).toFixed(1);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) { window.location.href = "index.html"; return; }

  document.getElementById("welcome").innerText =
    `Welcome ${user.username} (${user.role})`;

  if (user.role === "admin")
    document.getElementById("adminControls").style.display = "block";

  window.loadSelectedClient = () =>
    loadAndRender(document.getElementById("clientSelect").value);

  window.loadByTimeRange = () => {};

  loadAndRender(user.role === "admin" ? "car1.csv" : user.car);
});

async function loadAndRender(file) {
  const csv = await loadCSV(file);
  allRows = parseCSV(csv);
  calculateSpeed(allRows);
}
