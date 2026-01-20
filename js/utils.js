// utils.js: Shared helper functions

window.logout = function () {
    localStorage.removeItem("user");
    window.location.href = "index.html";
};

window.safeRedirect = function () {
    console.warn("Redirecting due to missing session");
    setTimeout(() => {
        window.location.href = "index.html";
    }, 200);
};

window.getUser = function () {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
};

window.getApiBase = function () {
    // CONFIG: Replace with your active backend URL
    const LIVE_BACKEND_URL = 'http://127.0.0.1:5000';
    return (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
        ? LIVE_BACKEND_URL : '';
};
