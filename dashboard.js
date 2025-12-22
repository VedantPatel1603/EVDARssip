const user = JSON.parse(localStorage.getItem("user"));
if (!user || !user.role) window.location.href = "index.html";

document.getElementById("welcome").innerText =
  `evdar — ${user.username} (${user.role})`;

let rawData = [];
let chart = null;
let currentCar = user.car || "car1.csv";

// Show admin panel
if (user.role === "admin") {
  document.getElementById("adminPanel").style.display = "block";
  document.getElementById("clientSelect").onchange = e => {
    currentCar = e.target.value;
    loadCSV();
  };
}

// Haversine distance
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function loadCSV() {
  fetch(`data/${currentCar}`)
    .then(res => res.text())
    .then(text => {
      const rows = text.trim().split("\n").slice(1);
      rawData = rows.map(r => {
        const [t, lat, lon] = r.split(",");
        return { time: new Date(t), lat:+lat, lon:+lon };
      });

      startTime.value = rawData[0].time.toISOString().slice(0,16);
      endTime.value = rawData.at(-1).time.toISOString().slice(0,16);
    });
}

// Load initial CSV
loadCSV();

function loadRange() {
  const start = new Date(startTime.value);
  const end = new Date(endTime.value);
  const range = rawData.filter(d => d.time >= start && d.time <= end);

  if (range.length < 2) return alert("Not enough data");

  let speeds = [];
  let labels = [];
  let total = 0;

  for (let i=1;i<range.length;i++) {
    const d = haversine(
      range[i-1].lat, range[i-1].lon,
      range[i].lat, range[i].lon
    );
    const dt = (range[i].time-range[i-1].time)/3600000;
    const s = dt>0 ? d/dt : 0;
    speeds.push(s.toFixed(1));
    labels.push(range[i].time.toLocaleTimeString());
    total += s;
  }

  speed.innerText = (total/speeds.length).toFixed(1);

  // TABLE
  dataTable.innerHTML = "";
  for (let i=1;i<range.length;i++) {
    dataTable.innerHTML += `
      <tr>
        <td>${range[i].time.toLocaleString()}</td>
        <td>${range[i].lat.toFixed(5)}</td>
        <td>${range[i].lon.toFixed(5)}</td>
        <td>${speeds[i-1]}</td>
      </tr>`;
  }

  // GRAPH
  if (chart) chart.destroy();
  chart = new Chart(speedChart, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Speed (km/h)",
        data: speeds,
        borderColor: "blue",
        tension: 0.3
      }]
    }
  });
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
