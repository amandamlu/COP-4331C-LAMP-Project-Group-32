const API_URL = (
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
let currentAdminUsername = sessionStorage.getItem('username') || '';
let selectedTargetUser = '';
let systemUsersList = [];
let targetContactsList = [];

document.addEventListener('DOMContentLoaded', () => {
  // Session / Authorization verification
  const role = sessionStorage.getItem('role');
  if (!currentAdminUsername || role !== 'Admin') {
    window.location.href = 'index.html';
    return;
  }
  
  const welcomeHeading = document.getElementById('adminWelcome');
  if (welcomeHeading) {
    welcomeHeading.innerText = `Welcome, Admin ${sessionStorage.getItem('firstName') || ''}`;
  }
  
  loadUsers();
});

// 1. Fetch System Users (Admin API)
async function loadUsers() {
  try {
    const res = await fetch(`${API_URL}?action=getusers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentAdminUsername })
    });
    
    const data = await res.json();
    if (res.ok && data.users) {
      systemUsersList = data.users;
      renderUsersTable(systemUsersList);
      // renderOrgChart(systemUsersList);
    } else {
      showFeedback('adminFeedback', data.error || 'Failed to load user registry.', 'danger');
    }
  } catch (err) {
    showFeedback('adminFeedback', 'Connection error to database backend.', 'danger');
  }
}


google.charts.load('current', {packages:["orgchart"]});
function loadOrgChart() {
    const adminUserId = sessionStorage.getItem('userId');
    var data = new google.visualization.DataTable();
    data.addColumn('string', 'Name');
    data.addColumn('string', 'Manager');
    data.addColumn('string', 'ToolTip');
    fetch(`${API_URL}?action=getorg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: adminUserId })
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
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-body-secondary">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr 
      class="${selectedTargetUser === u.Username ? 'table-warning text-dark' : ''}" 
      style="cursor: pointer;" 
      onclick="selectUserForContacts('${u.Username}')"
    >
      <th scope="row" class="ps-3 fw-bold">${u.Username}</th>
      <td class="fw-medium">${u['First Name']} ${u['Last Name']}</td>
      <td><span class="badge ${u.Role === 'Admin' ? 'text-bg-warning' : 'text-bg-secondary'}">${u.Role}</span></td>
      <td><span class="badge ${u['Acc Status'] === 'Active' ? 'text-bg-success' : 'text-bg-danger'}">${u['Acc Status']}</span></td>
      <td class="text-end pe-3">
        <!-- Flexbox container with min-width keeps column alignment uniform across rows -->
        <div class="d-inline-flex gap-1 justify-content-end" style="min-width: 72px;">

	 <!-- BOSS BUTTON -->
	 <button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); openAssignBossModal('${u.Username}')" title="Assign Superior">
            <i class="bi bi-diagram-3"></i>
          </button>

          <!-- Change User Password -->
          <button class="btn btn-sm btn-outline-warning" onclick="event.stopPropagation(); openPasswordModal('${u.Username}')" title="Change Password">
            <i class="bi bi-key"></i>
          </button>
          <!-- Disable User (Hidden if user is already Disabled) -->
          ${u['Acc Status'] === 'Active' ? `
            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); disableUser('${u.Username}')" title="Disable User">
              <i class="bi bi-slash-circle"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Filter Users
function filterUsersTable() {
  const q = document.getElementById('searchUsersInput').value.toLowerCase();
  const filtered = systemUsersList.filter(u => 
    u.Username.toLowerCase().includes(q) ||
    u['First Name'].toLowerCase().includes(q) ||
    u['Last Name'].toLowerCase().includes(q)
  );
  renderUsersTable(filtered);
}

// 2. Select User & Fetch Their Contacts
async function selectUserForContacts(username) {
  selectedTargetUser = username;
  document.getElementById('activeUserBadge').innerText = `@${username}`;
  renderUsersTable(systemUsersList);
  // renderOrgChart(systemUsersList); // Re-render to highlight active node in chart

  try {
    const res = await fetch(`${API_URL}?action=getusercontacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: currentAdminUsername, 
        searchedUsername: username 
      })
    });

    const data = await res.json();
    if (res.ok && data.contacts) {
      targetContactsList = data.contacts;
      renderContactsTable(targetContactsList);
    } else {
      document.getElementById('adminContactsTableBody').innerHTML = 
        `<tr><td colspan="6" class="text-center py-4 text-danger">${data.error || 'Could not fetch contacts.'}</td></tr>`;
    }
  } catch (err) {
    showFeedback('adminFeedback', 'Error retrieving target user contacts.', 'danger');
  }
}

// Render Contacts Directory Table
function renderContactsTable(contacts) {
  const tbody = document.getElementById('adminContactsTableBody');
  if (!tbody) return;

  if (!contacts || contacts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-body-secondary">No contacts found for this account.</td></tr>`;
    return;
  }

  tbody.innerHTML = contacts.map(c => `
    <tr>
      <th scope="row" class="ps-3 text-body-secondary">#${c.ID}</th>
      <td class="fw-medium">${c['First Name']}</td>
      <td class="fw-medium">${c['Last Name']}</td>
      <td>
        <a href="mailto:${c['E-mail Address']}" class="text-decoration-none">${c['E-mail Address']}</a>
      </td>
      <td>${c['Phone Number']}</td>
      <td class="text-end pe-3">
        <button class="btn btn-sm btn-outline-warning me-1" onclick="openEditContactModal(${c.ID}, '${escapeQuotes(c['First Name'])}', '${escapeQuotes(c['Last Name'])}', '${escapeQuotes(c['E-mail Address'])}', '${escapeQuotes(c['Phone Number'])}')" title="Edit Contact">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteContact(${c.ID})" title="Delete Contact">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// Filter Contacts Directory
function filterContactsTable() {
  const q = document.getElementById('searchContactsInput').value.toLowerCase();
  const filtered = targetContactsList.filter(c => 
    c['First Name'].toLowerCase().includes(q) ||
    c['Last Name'].toLowerCase().includes(q) ||
    c['E-mail Address'].toLowerCase().includes(q) ||
    c['Phone Number'].toLowerCase().includes(q) ||
    String(c.ID).includes(q)
  );
  renderContactsTable(filtered);
}

// Disable / Enable User Account Toggle
async function disableUser(searchedUser, currentStatus) {
  const isSuspending = currentStatus === 'Active';
  const actionText = isSuspending ? 'suspend' : 'unsuspend';
  
  if (!confirm(`Are you sure you want to ${actionText} account "${searchedUser}"?`)) return;

  try {
    const res = await fetch(`${API_URL}?action=disable`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: currentAdminUsername, 
        searchedUser: searchedUser 
      })
    });
// Filter Contacts Directory
    const data = await res.json();
    if (res.ok) {
      const updatedStatus = isSuspending ? 'suspended' : 'activated';
      showFeedback('adminFeedback', `Account @${searchedUser} has been ${updatedStatus}.`, 'success');
      loadUsers();
    } else {
      showFeedback('adminFeedback', data.error || `Failed to ${actionText} user.`, 'danger');
    }
  } catch (err) {
    showFeedback('adminFeedback', 'Server communication failure.', 'danger');
  }
}
// 4. Change User Password
function openPasswordModal(username) {
  document.getElementById('passTargetUsername').value = username;
  document.getElementById('passTargetDisplay').value = `@${username}`;
  document.getElementById('newAdminPasswordInput').value = '';
  document.getElementById('changePassFeedback').innerText = '';
  new bootstrap.Modal(document.getElementById('changePasswordModal')).show();
}

async function handleChangePassword(e) {
  e.preventDefault();
  const searchedUser = document.getElementById('passTargetUsername').value;
  const newPassword = document.getElementById('newAdminPasswordInput').value;

  try {
    const res = await fetch(`${API_URL}?action=changepass`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: currentAdminUsername, 
        searchedUser: searchedUser,
        newPassword: newPassword
      })
    });

    const data = await res.json();
    if (res.ok) {
      const modalEl = document.getElementById('changePasswordModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
      showFeedback('adminFeedback', `Password updated for @${searchedUser}.`, 'success');
    } else {
      const fb = document.getElementById('changePassFeedback');
      fb.className = 'text-danger small fw-semibold';
      fb.innerText = data.error || 'Failed to change password.';
    }
  } catch (err) {
    document.getElementById('changePassFeedback').innerText = 'Server error during password update.';
  }
}

// 5. Create Admin Account
async function handleCreateAdmin(e) {
  e.preventDefault();
  const payload = {
    adminUser: currentAdminUsername,
    firstName: document.getElementById('adminFirstName').value,
    lastName: document.getElementById('adminLastName').value,
    username: document.getElementById('adminUsername').value,
    password: document.getElementById('adminPassword').value
  };

  try {
    const res = await fetch(`${API_URL}?action=createadmin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.status === 201 || res.ok) {
      const modalEl = document.getElementById('createAdminModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
      showFeedback('adminFeedback', 'New administrator created successfully!', 'success');
      document.getElementById('createAdminForm').reset();
      loadUsers();
    } else {
      const fb = document.getElementById('createAdminFeedback');
      fb.className = 'text-danger small fw-semibold';
      fb.innerText = data.error || 'Error creating admin.';
    }
  } catch (err) {
    document.getElementById('createAdminFeedback').innerText = 'Connection failure.';
  }
}

// 6. Edit Contact Entry (PATCH)
function openEditContactModal(id, firstName, lastName, email, phone) {
  document.getElementById('editContactId').value = id;
  document.getElementById('editFirstName').value = firstName;
  document.getElementById('editLastName').value = lastName;
  document.getElementById('editEmail').value = email;
  document.getElementById('editPhone').value = phone;
  new bootstrap.Modal(document.getElementById('editContactModal')).show();
}

async function handleUpdateContact(e) {
  e.preventDefault();
  const payload = {
    accstatus: 'Active',
    id: document.getElementById('editContactId').value,
    firstName: document.getElementById('editFirstName').value,
    lastName: document.getElementById('editLastName').value,
    emailAddress: document.getElementById('editEmail').value,
    phoneNumber: document.getElementById('editPhone').value
  };

  try {
    const res = await fetch(API_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      const modalEl = document.getElementById('editContactModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
      showFeedback('adminFeedback', 'Contact updated successfully.', 'success');
      selectUserForContacts(selectedTargetUser);
    } else {
      const fb = document.getElementById('editContactFeedback');
      fb.className = 'text-danger small fw-semibold';
      fb.innerText = data.error || 'Update failed.';
    }
  } catch (err) {
    document.getElementById('editContactFeedback').innerText = 'Error saving changes.';
  }
}

// 7. Delete Contact Entry (DELETE)
async function deleteContact(id) {
  if (!confirm(`Delete contact #${id}?`)) return;

  // Use the target user's own ID, not the admin's — the backend's ownership
  // check requires the contact's real owner, and systemUsersList already has it.
  const targetUser = systemUsersList.find(u => u.Username === selectedTargetUser);
  const targetUserId = targetUser ? targetUser.ID : null;

  if (!targetUserId) {
    showFeedback('adminFeedback', 'Could not determine contact owner. Re-select the account and try again.', 'danger');
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        accstatus: 'Active', 
        id: id,
        userid: targetUserId
      })
    });

    if (res.status === 204 || res.ok) {
      showFeedback('adminFeedback', `Contact #${id} deleted.`, 'success');
      selectUserForContacts(selectedTargetUser);
    } else {
      const data = await res.json();
      showFeedback('adminFeedback', data.error || 'Delete failed.', 'danger');
    }
  } catch (err) {
    showFeedback('adminFeedback', 'Server connection failed.', 'danger');
  }
}

// Helpers
function showFeedback(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
  }
}

function escapeQuotes(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function doLogout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}
// the logic for the BOSS BUTTON
function openAssignBossModal(employeeUsername) {
  document.getElementById("assignEmployeeUsername").value = employeeUsername;
  document.getElementById("assignEmployeeDisplay").textContent = employeeUsername;
  document.getElementById("bossUsernameInput").value = "";
  document.getElementById("assignBossFeedback").textContent = "";
  
  const bossModal = new bootstrap.Modal(document.getElementById("assignBossModal"));
  bossModal.show();
}

document.getElementById("assignBossForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  const employee = document.getElementById("assignEmployeeUsername").value;
  const newBoss = document.getElementById("bossUsernameInput").value.trim();
  const statusText = document.getElementById("assignBossFeedback");
  
  const getCookieVal = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : '';
  };
  const adminUser = getCookieVal("username");
  
  statusText.className = "small text-info fw-semibold mt-1";
  statusText.innerHTML = "<div class='spinner-border spinner-border-sm me-1'></div>Assigning...";

  try {
    const apiResponse = await fetch("/api/index.php?action=assignboss", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: adminUser,      
        searchedUser: employee, 
        boss: newBoss            
      })
    });

    const parsedJson = await apiResponse.json();

    if (apiResponse.ok) {
      statusText.className = "small text-success fw-semibold mt-1";
      statusText.textContent = "Boss successfully assigned!";
      
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById("assignBossModal")).hide();
        window.location.reload(); 
      }, 1500);
    } else {
      statusText.className = "small text-danger fw-semibold mt-1";
      statusText.textContent = parsedJson.error || "Failed to assign boss.";
    }
  } catch (e) {
    statusText.className = "small text-danger fw-semibold mt-1";
    statusText.textContent = "Network error connecting to the server.";
  }
});
