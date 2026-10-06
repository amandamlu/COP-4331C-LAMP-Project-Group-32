const API_URL = '/api/index.php';
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
  
  document.getElementById('adminWelcome').innerText = `Welcome, Admin ${sessionStorage.getItem('firstName') || ''}`;
  loadUsers();
});

// 1. Fetch System Users (Admin API)
async function loadUsers() {
  try {
    const res = await fetch(`${API_URL}?action=getusers`, {
      method: 'POST', // standard JSON payload handling based on API
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentAdminUsername })
    });
    
    // Support GET or POST fallback per API signature
    const data = await res.json();
    if (res.ok && data.users) {
      systemUsersList = data.users;
      renderUsersTable(systemUsersList);
    } else {
      showFeedback('adminFeedback', data.error || 'Failed to load user registry.', 'danger');
    }
  } catch (err) {
    showFeedback('adminFeedback', 'Connection error to database backend.', 'danger');
  }
}

// Render Users Table
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3">No users registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr class="${selectedTargetUser === u.Username ? 'table-warning text-dark' : ''}">
      <td class="fw-bold">${u.Username}</td>
      <td>${u['First Name']} ${u['Last Name']}</td>
      <td><span class="badge ${u.Role === 'Admin' ? 'text-bg-warning' : 'text-bg-secondary'}">${u.Role}</span></td>
      <td><span class="badge ${u['Acc Status'] === 'Active' ? 'text-bg-success' : 'text-bg-danger'}">${u['Acc Status']}</span></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-info me-1" onclick="selectUserForContacts('${u.Username}')" title="View Contacts">
          <i class="bi bi-eye-fill"></i>
        </button>
        <button class="btn btn-sm btn-outline-warning me-1" onclick="openPasswordModal('${u.Username}')" title="Change Password">
          <i class="bi bi-key-fill"></i>
        </button>
        ${u['Acc Status'] === 'Active' ? `
          <button class="btn btn-sm btn-outline-danger" onclick="disableUser('${u.Username}')" title="Disable User">
            <i class="bi bi-slash-circle-fill"></i>
          </button>
        ` : ''}
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

// 2. Select User & Fetch Their Contacts (Admin API)
async function selectUserForContacts(username) {
  selectedTargetUser = username;
  document.getElementById('activeUserBadge').innerText = `@${username}`;
  renderUsersTable(systemUsersList); // refresh highlighting

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
        `<tr><td colspan="6" class="text-center py-3 text-danger">${data.error || 'Could not fetch contacts.'}</td></tr>`;
    }
  } catch (err) {
    showFeedback('adminFeedback', 'Error retrieving target user contacts.', 'danger');
  }
}

// Render Contacts Directory Table
function renderContactsTable(contacts) {
  const tbody = document.getElementById('adminContactsTableBody');
  if (!contacts || contacts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-body-secondary">No contacts found for this account.</td></tr>`;
    return;
  }

  tbody.innerHTML = contacts.map(c => `
    <tr>
      <td class="fw-bold">${c.ID}</td>
      <td>${c['First Name']}</td>
      <td>${c['Last Name']}</td>
      <td>${c['E-mail Address']}</td>
      <td>${c['Phone Number']}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-warning me-1" onclick="openEditContactModal(${c.ID}, '${escapeQuotes(c['First Name'])}', '${escapeQuotes(c['Last Name'])}', '${escapeQuotes(c['E-mail Address'])}', '${escapeQuotes(c['Phone Number'])}')" title="Edit Entry">
          <i class="bi bi-pencil-fill"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteContact(${c.ID})" title="Delete Entry">
          <i class="bi bi-trash-fill"></i>
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

// 3. Disable User (Admin API)
async function disableUser(searchedUser) {
  if (!confirm(`Are you sure you want to disable account "${searchedUser}"?`)) return;

  try {
    const res = await fetch(`${API_URL}?action=disable`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: currentAdminUsername, 
        searchedUser: searchedUser 
      })
    });

    const data = await res.json();
    if (res.ok) {
      showFeedback('adminFeedback', `Account @${searchedUser} disabled successfully.`, 'success');
      loadUsers();
    } else {
      showFeedback('adminFeedback', data.error || 'Failed to disable user.', 'danger');
    }
  } catch (err) {
    showFeedback('adminFeedback', 'Server communication failure.', 'danger');
  }
}

// 4. Change Password (Admin API)
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
      bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
      showFeedback('adminFeedback', `Password updated for @${searchedUser}.`, 'success');
    } else {
      document.getElementById('changePassFeedback').className = 'text-danger small fw-semibold';
      document.getElementById('changePassFeedback').innerText = data.error || 'Failed to change password.';
    }
  } catch (err) {
    document.getElementById('changePassFeedback').innerText = 'Server error during password update.';
  }
}

// 5. Create Admin (Admin API)
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
    if (res.status === 201) {
      bootstrap.Modal.getInstance(document.getElementById('createAdminModal')).hide();
      showFeedback('adminFeedback', 'New administrator created successfully!', 'success');
      document.getElementById('createAdminForm').reset();
      loadUsers();
    } else {
      document.getElementById('createAdminFeedback').className = 'text-danger small fw-semibold';
      document.getElementById('createAdminFeedback').innerText = data.error || 'Error creating admin.';
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
      bootstrap.Modal.getInstance(document.getElementById('editContactModal')).hide();
      showFeedback('adminFeedback', 'Contact updated successfully.', 'success');
      selectUserForContacts(selectedTargetUser);
    } else {
      document.getElementById('editContactFeedback').className = 'text-danger small fw-semibold';
      document.getElementById('editContactFeedback').innerText = data.error || 'Update failed.';
    }
  } catch (err) {
    document.getElementById('editContactFeedback').innerText = 'Error saving changes.';
  }
}

// 7. Delete Contact Entry (DELETE)
async function deleteContact(id) {
  if (!confirm(`Delete contact #${id}?`)) return;

  try {
    const res = await fetch(API_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        accstatus: 'Active', 
        id: id,
        userid: sessionStorage.getItem('userId') || 0
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
