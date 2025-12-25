async function login(event) {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        // If you're serving the frontend with Live Server (127.0.0.1:5500)
        // the API is on the Flask server at port 5000. Use that base
        // URL so the request reaches the backend. When the frontend is
        // served by the Flask app itself, `API_BASE` can be an empty string.
        const API_BASE = "https://untempting-untemperamentally-renata.ngrok-free.dev";

        const res = await fetch(API_BASE + "/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            alert("Invalid username or password");
            return;
        }

        const data = await res.json();

        // store session under the `user` key (dashboard.js expects this)
        localStorage.setItem("user", JSON.stringify(data));
        window.location.href = "dashboard.html";
    } catch (err) {
        alert("Login failed — check server connection");
        console.error(err);
    }
}
