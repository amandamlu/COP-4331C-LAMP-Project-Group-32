// Base API endpoint URL

const urlBase = 'https://contacts.tomasstep.com/api/index.php';

// Session State Variables
let userId = 0;
let firstName = "";
let lastName = "";
let role = "User";
let accStatus = "Active";

// ==========================================
// Initialization & Session Management
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  readCookie();
  if (userId <= 0) return; // Prevent executing dashboard code if redirected

  initDashboard();

  // Attach Event Listeners
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", doLogout);

  const searchInput = document.getElementById("searchContacts");
  if (searchInput) searchInput.addEventListener("input", handleSearchInput);

  const addForm = document.getElementById("addEmployeeForm");
  if (addForm) addForm.addEventListener("submit", handleAddContact);

  const editForm = document.getElementById("editContactForm");
  if (editForm) editForm.addEventListener("submit", handleEditContact);
});

function readCookie() {
  userId = -1;
  firstName = "";
  lastName = "";
  role = "User";
  accStatus = "Active";

  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim();
    if (c.startsWith("userId=")) {
      userId = parseInt(c.substring("userId=".length), 10);
    } else if (c.startsWith("firstName=")) {
      firstName = decodeURIComponent(c.substring("firstName=".length));
    } else if (c.startsWith("lastName=")) {
      lastName = decodeURIComponent(c.substring("lastName=".length));
    } else if (c.startsWith("role=")) {
      role = decodeURIComponent(c.substring("role=".length));
    } else if (c.startsWith("accStatus=")) {
      accStatus = decodeURIComponent(c.substring("accStatus=".length));
    }
  }

  // Redirect to landing/login page if no active session exists
  if ((isNaN(userId) || userId <= 0) && !window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
    window.location.href = "index.html";
  }
}

function doLogout() {
  userId = 0;
  firstName = "";
  lastName = "";
  role = "";
  accStatus = "";
  
  // Expire all session cookies
  document.cookie = "userId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.cookie = "firstName=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.cookie = "lastName=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.cookie = "role=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.cookie = "accStatus=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  
  window.location.href = "index.html";
}

function initDashboard() {
  // Update UI user header display
  const nameDisplay = document.getElementById("userNameDisplay");
  const welcomeHeading = document.getElementById("welcomeHeading");
  const roleBadge = document.getElementById("treeRoleBadge");

  if (nameDisplay) {
    nameDisplay.innerHTML = `<i class="bi bi-person-circle text-primary me-1"></i> ${firstName} ${lastName}`;
  }
  if (welcomeHeading) {
    welcomeHeading.textContent = `Welcome, ${firstName}!`;
  }
  if (roleBadge) {
    roleBadge.textContent = `${role} View`;
  }

  // Fetch initial contacts list
  fetchContacts();
}

// ==========================================
// Contact Management API Operations
// ==========================================

async function fetchContacts() {
  const tableBody = document.getElementById("employeeTableBody");
  const countBadge = document.getElementById("contactCount");

  try {
    const res = await fetch(`${urlBase}?action=getall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // API expects user metadata in body for accstatus validation
      body: JSON.stringify({
        userid: userId,
        accstatus: accStatus
      })
    });

    const data = await res.json();

    if (res.ok && Array.isArray(data.contacts)) {
      renderContactsTable(data.contacts);
    } else {
      showFeedback(data.error || "Failed to load contacts", "danger");
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error loading data.</td></tr>`;
    }
  } catch (err) {
    console.error("fetchContacts Error:", err);
    showFeedback("Network error connecting to database server.", "danger");
  }
}

let searchDebounce = null;
function handleSearchInput(e) {
  clearTimeout(searchDebounce);
  const query = e.target.value.trim();

  searchDebounce = setTimeout(() => {
    if (!query) {
      fetchContacts();
      return;
    }

    // Split entry into first name and last name search terms
    const parts = query.split(" ");
    const searchFirst = parts[0] || "";
    const searchLast = parts.slice(1).join(" ") || "";

    searchContacts(searchFirst, searchLast);
  }, 300);
}

async function searchContacts(firstNameSearch, lastNameSearch) {
  try {
    const res = await fetch(`${urlBase}?action=getpartial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userid: userId,
        accstatus: accStatus,
        firstName: firstNameSearch,
        lastName: lastNameSearch
      })
    });

    const data = await res.json();
    if (res.ok && Array.isArray(data.contacts)) {
      renderContactsTable(data.contacts);
    }
  } catch (err) {
    console.error("searchContacts Error:", err);
  }
}

async function handleAddContact(e) {
  e.preventDefault();

  const firstNameVal = document.getElementById("addFirstName")?.value.trim();
  const lastNameVal = document.getElementById("addLastName")?.value.trim();
  const emailVal = document.getElementById("addEmail")?.value.trim();
  const phoneVal = document.getElementById("addPhone")?.value.trim();
  const feedbackEl = document.getElementById("addModalFeedback");

  if (!firstNameVal || !lastNameVal || !emailVal || !phoneVal) {
    if (feedbackEl) {
      feedbackEl.className = "small fw-semibold text-danger";
      feedbackEl.textContent = "Please fill in all fields.";
    }
    return;
  }

  try {
    const res = await fetch(`${urlBase}?action=add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userid: userId,
        accstatus: accStatus,
        firstName: firstNameVal,
        lastName: lastNameVal,
        emailAddress: emailVal,
        phoneNumber: phoneVal
      })
    });

    const data = await res.json();

    if (res.status === 201) {
      if (feedbackEl) {
        feedbackEl.className = "small fw-semibold text-success";
        feedbackEl.textContent = "Contact added successfully!";
      }

      // Reset form & close Bootstrap modal
      document.getElementById("addEmployeeForm").reset();
      const modalInstance = bootstrap.Modal.getInstance(document.getElementById("addEmployeeModal"));
      if (modalInstance) setTimeout(() => modalInstance.hide(), 800);

      // Refresh list
      fetchContacts();
      showFeedback("New contact added.", "success");
    } else {
      if (feedbackEl) {
        feedbackEl.className = "small fw-semibold text-danger";
        feedbackEl.textContent = data.error || "Failed to add contact.";
      }
    }
  } catch (err) {
    console.error("handleAddContact Error:", err);
    if (feedbackEl) {
      feedbackEl.className = "small fw-semibold text-danger";
      feedbackEl.textContent = "Server communication failure.";
    }
  }
}

async function deleteContact(contactId) {
  if (!confirm("Are you sure you want to delete this contact?")) return;

  try {
    const res = await fetch(`${urlBase}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: contactId,
        userid: userId,
        accstatus: accStatus
      })
    });

    if (res.status === 204 || res.ok) {
      showFeedback("Contact deleted.", "info");
      fetchContacts();
    } else {
      const data = await res.json();
      showFeedback(data.error || "Failed to delete contact.", "danger");
    }
  } catch (err) {
    console.error("deleteContact Error:", err);
    showFeedback("Could not perform delete action.", "danger");
  }
}

function openEditModal(id, firstName, lastName, email, phone) {
  document.getElementById("editContactId").value = id;
  document.getElementById("editFirstName").value = firstName;
  document.getElementById("editLastName").value = lastName;
  document.getElementById("editEmail").value = email;
  document.getElementById("editPhone").value = phone;

  const feedback = document.getElementById("editModalFeedback");
  if (feedback) feedback.textContent = "";

  const modal = new bootstrap.Modal(document.getElementById("editContactModal"));
  modal.show();
}

async function handleEditContact(e) {
  e.preventDefault();

  const idVal = document.getElementById("editContactId").value;
  const firstNameVal = document.getElementById("editFirstName").value.trim();
  const lastNameVal = document.getElementById("editLastName").value.trim();
  const emailVal = document.getElementById("editEmail").value.trim();
  const phoneVal = document.getElementById("editPhone").value.trim();
  const feedbackEl = document.getElementById("editModalFeedback");

  try {
    const res = await fetch(`${urlBase}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: idVal,
        accstatus: accStatus,
        firstName: firstNameVal,
        lastName: lastNameVal,
        emailAddress: emailVal,
        phoneNumber: phoneVal
      })
    });

    if (res.ok) {
      const modalEl = document.getElementById("editContactModal");
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();

      fetchContacts();
      showFeedback("Contact updated successfully!", "success");
    } else {
      const data = await res.json();
      if (feedbackEl) {
        feedbackEl.className = "small fw-semibold text-danger";
        feedbackEl.textContent = data.error || "Failed to update contact.";
      }
    }
  } catch (err) {
    console.error("handleEditContact Error:", err);
  }
}

// ==========================================
// UI Rendering & Helpers
// ==========================================

function renderContactsTable(contacts) {
  const tableBody = document.getElementById("employeeTableBody");
  const countBadge = document.getElementById("contactCount");

  if (countBadge) {
    countBadge.textContent = `${contacts.length} Contact${contacts.length === 1 ? '' : 's'} Total`;
  }

  if (!tableBody) return;

  if (contacts.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-body-secondary">
          <i class="bi bi-inbox fs-3 d-block mb-1"></i>
          No contacts found.
        </td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = contacts.map(c => `
    <tr>
      <th scope="row" class="ps-3 text-body-secondary">#${c.ID}</th>
      <td class="fw-medium">${escapeHTML(c['First Name'] || '')}</td>
      <td class="fw-medium">${escapeHTML(c['Last Name'] || '')}</td>
      <td>
        <a href="mailto:${escapeHTML(c['E-mail Address'] || '')}" class="text-decoration-none">
          ${escapeHTML(c['E-mail Address'] || '')}
        </a>
      </td>
      <td>${escapeHTML(c['Phone Number'] || '')}</td>
      <!-- Actions -->
      <td class="text-end pe-3">
        <!-- Edit Button in Action Column -->
        <button class="btn btn-sm btn-outline-primary me-1" 
                onclick="openEditModal(${c.ID}, '${escapeHTML(c['First Name'] || '')}', '${escapeHTML(c['Last Name'] || '')}', '${escapeHTML(c['E-mail Address'] || '')}', '${escapeHTML(c['Phone Number'] || '')}')" 
                title="Edit Contact">
          <i class="bi bi-pencil"></i>
        </button>

        <!-- Delete Button -->
        <button class="btn btn-sm btn-outline-danger" onclick="deleteContact(${c.ID})" title="Delete Contact">
          <i class="bi bi-trash"></i>
        </button>      </td>
    </tr>
  `).join('');
}

function showFeedback(message, type = "info") {
  const alertContainer = document.getElementById("dashboardFeedback");
  if (!alertContainer) return;

  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
      <i class="bi bi-info-circle-fill me-2"></i> ${escapeHTML(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;

  setTimeout(() => {
    const alert = alertContainer.querySelector(".alert");
    if (alert) alert.classList.remove("show");
  }, 4000);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// ==========================================
// ORG CHART LOGIC
// ==========================================
google.charts.load('current', {packages:["orgchart"]});
function loadOrgChart() {
    // Grab the username
    const activeUsername = localStorage.getItem("username");
    var data = new google.visualization.DataTable();
    data.addColumn('string', 'Name');
    data.addColumn('string', 'Manager');
    data.addColumn('string', 'ToolTip');
    fetch('/api/index.php?action=getorg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: userId }) 
    })
    .then(response => response.json())
    .then(apiData => {
        const chartRows = [];
        apiData.users.forEach(user => {
            const fullName = `${user['First Name']} ${user['Last Name']}`;
            chartRows.push([
                { 
                    v: user.Username, 
                    f: `<div style="font-weight:bold; font-size: 14px; color: #ffffff;">${fullName}</div>
                        <div style="color:#0dcaf0; font-size:11px; margin-top: 5px;">${user.Role}</div>` 
                },
                user.Boss || '', 
                user['Acc Status']
            ]);
        });

        data.addRows(chartRows);
        var chart = new google.visualization.OrgChart(document.getElementById('org_chart_div'));
        chart.draw(data, {allowHtml:true});
    })
    .catch(error => console.error('Error fetching org data:', error));
}
