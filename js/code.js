// Base API endpoint URL
const urlBase = (
  typeof window !== 'undefined' && 
  window.location && 
  (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.origin.includes('tomasstep')
  )
)
  ? '/api/index.php'
  : 'https://contacts.tomasstep.com/api/index.php';

let userId = 0;
let firstName = "";
let lastName = "";

// ==========================================
// Authentication Functions
// ==========================================
async function doLogin(event) {
  if (event) event.preventDefault();
  userId = 0; firstName = ""; lastName = "";

  const username = document.getElementById("loginName")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value.trim() || "";
  const resultEl = document.getElementById("loginResult");
  const show = (msg) => { if (resultEl) resultEl.textContent = msg; };

  if (!username || !password) return show("Please enter both username and password");

  try {
    const res = await fetch(`${urlBase}?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const text = await res.text();
    console.log("login response:", res.status, text);

    let data = {};
    try { data = JSON.parse(text); } catch (e) {}

    if (res.ok && data.id > 0) {
      userId = data.id;
      firstName = data.firstName || "";
      lastName = data.lastName || "";
      saveCookie();
      window.location.href = "contacts.html";
    } else if (res.status === 401) {
      show("Invalid username or password");
    } else {
      show(data.error || `Server error (HTTP ${res.status})`);
    }
  } catch (err) {
    show("Could not reach the API (network or CORS issue)");
    console.error(err);
  }
}

function doRegister(event) {
  if (event) event.preventDefault();

  const fNameInput = document.getElementById("regFirstName");
  const lNameInput = document.getElementById("regLastName");
  const userInput = document.getElementById("regUsername");
  const passInput = document.getElementById("regPassword");
  const resultEl = document.getElementById("registerResult");

  const fName = fNameInput ? fNameInput.value.trim() : "";
  const lName = lNameInput ? lNameInput.value.trim() : "";
  const username = userInput ? userInput.value.trim() : "";
  const password = passInput ? passInput.value.trim() : "";

  if (resultEl) resultEl.innerHTML = "";

  const jsonPayload = JSON.stringify({
    firstName: fName,
    lastName: lName,
    login: username,
    username: username,
    password: password
  });

  const url = `${urlBase}?action=register`;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  try {
    xhr.onreadystatechange = function () {
      if (this.readyState === 4) {
        if (this.status === 201) {
          if (resultEl) {
            resultEl.className = "mt-1 small text-success fw-semibold";
            resultEl.innerHTML = "<i class='bi bi-check-circle-fill me-1'></i> Account created! Switching to login...";
          }
          setTimeout(() => {
            const loginTabTrigger = document.getElementById("login-tab");
            if (loginTabTrigger) {
              const tab = new bootstrap.Tab(loginTabTrigger);
              tab.show();
            }
          }, 1500);
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            if (resultEl) {
              resultEl.className = "mt-1 small text-danger fw-semibold";
              resultEl.innerHTML = `<i class='bi bi-exclamation-circle-fill me-1'></i> ${res.error || "Registration failed"}`;
            }
          } catch (e) {
            if (resultEl) {
              resultEl.className = "mt-1 small text-danger fw-semibold";
              resultEl.innerHTML = "Registration request failed";
            }
          }
        }
      }
    };
    xhr.send(jsonPayload);
  } catch (err) {
    if (resultEl) {
      resultEl.className = "mt-1 small text-danger fw-semibold";
      resultEl.innerHTML = err.message;
    }
  }
}

// ==========================================
// Cookie & Session Handling
// ==========================================

function saveCookie() {
  const minutes = 20;
  const date = new Date();
  date.setTime(date.getTime() + minutes * 60 * 1000);
  
  document.cookie = `userId=${userId}; expires=${date.toUTCString()}; path=/`;
  document.cookie = `firstName=${encodeURIComponent(firstName)}; expires=${date.toUTCString()}; path=/`;
  document.cookie = `lastName=${encodeURIComponent(lastName)}; expires=${date.toUTCString()}; path=/`;
}

function readCookie() {
  userId = -1;
  firstName = "";
  lastName = "";

  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim();
    if (c.startsWith("userId=")) {
      userId = parseInt(c.substring("userId=".length), 10);
    } else if (c.startsWith("firstName=")) {
      firstName = decodeURIComponent(c.substring("firstName=".length));
    } else if (c.startsWith("lastName=")) {
      lastName = decodeURIComponent(c.substring("lastName=".length));
    }
  }

  // Redirect to login if user is not logged in and not already on index.html
  if ((isNaN(userId) || userId <= 0) && !window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
    window.location.href = "index.html";
  }
}

function doLogout() {
  userId = 0;
  firstName = "";
  lastName = "";
  
  // Clear cookies by setting expiration in the past
  document.cookie = "userId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.cookie = "firstName=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.cookie = "lastName=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const roleToggle = document.getElementById('roleToggle');
  const roleLabel = document.getElementById('roleLabel');

  if (roleToggle && roleLabel) {
    roleToggle.addEventListener('change', () => {
      if (roleToggle.checked) {
        roleLabel.textContent = 'Admin Mode';
        roleLabel.classList.remove('text-secondary');
        roleLabel.classList.add('text-warning');
      } else {
        roleLabel.textContent = 'User Mode';
        roleLabel.classList.remove('text-warning');
        roleLabel.classList.add('text-secondary');
      }
    });
  }
});
