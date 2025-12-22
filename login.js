// 🔗 Backend API URL (ngrok)
const API = "https://untempting-untemperamentally-renata.ngrok-free.dev";

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const err = document.getElementById("error");

  fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
  .then(res => {
    if (!res.ok) throw new Error("Invalid login");
    return res.json();
  })
  .then(data => {
    // ✅ Store full user object expected by dashboard
    const user = {
      username: username,
      role: data.role,
      car: data.car || null
    };

    localStorage.setItem("user", JSON.stringify(user));
    window.location.href = "dashboard.html";
  })
  .catch(() => {
    err.innerText = "Invalid username or password";
  });
}
