const API = "https://YOUR-NGROK-URL.ngrok-free.dev";

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
    const user = {
      username,
      role: data.role,
      car: data.car || "car1.csv"
    };
    localStorage.setItem("user", JSON.stringify(user));
    window.location.href = "dashboard.html";
  })
  .catch(() => {
    err.innerText = "Invalid username or password";
  });
}
