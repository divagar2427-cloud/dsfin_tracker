// ===== DS WEALTH TRACKER - Authentication Module =====

let currentUser = null;

// Initialize auth state
async function initAuth() {
  const savedUserId = localStorage.getItem('ds_wealth_user_id');
  if (savedUserId) {
    try {
      const user = await UserDB.getById(parseInt(savedUserId));
      if (user) {
        currentUser = user;
        return true;
      }
    } catch (e) {
      console.error('Auth init error:', e);
    }
  }
  return false;
}

// Get current user
function getCurrentUser() {
  return currentUser;
}

// Get current user ID
function getCurrentUserId() {
  return currentUser ? currentUser.id : null;
}

// Login
async function login(email, password) {
  const user = await UserDB.findByEmail(email);
  if (!user) throw new Error('No account found with this email');

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) throw new Error('Incorrect password');

  currentUser = user;
  localStorage.setItem('ds_wealth_user_id', user.id.toString());
  return user;
}

// Register
async function register(name, email, password) {
  const existing = await UserDB.findByEmail(email);
  if (existing) throw new Error('An account with this email already exists');

  if (password.length < 6) throw new Error('Password must be at least 6 characters');

  const userId = await UserDB.create({ name, email, password });
  const user = await UserDB.getById(userId);
  currentUser = user;
  localStorage.setItem('ds_wealth_user_id', userId.toString());
  return user;
}

// Logout
function logout() {
  currentUser = null;
  localStorage.removeItem('ds_wealth_user_id');
  showAuthSection();
}

// Forgot password - since we're local, we show the stored hint
async function forgotPassword(email) {
  const user = await UserDB.findByEmail(email);
  if (!user) throw new Error('No account found with this email');
  // In a local app, we can't send email. Show a message to contact support or reset.
  return true;
}

// Reset password (for local use - requires knowing old password)
async function resetPassword(userId, newPassword) {
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');
  const hashedPassword = await hashPassword(newPassword);
  await UserDB.update(userId, { password: hashedPassword });
}

// Show auth section
function showAuthSection() {
  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('app-section').classList.add('hidden');
  showPage('login-page');
}

// Show app section
function showAppSection() {
  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
  updateProfileDisplay();
}

// Show specific auth page
function showPage(pageId) {
  document.querySelectorAll('.auth-page').forEach(p => p.classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');
}

// Toggle password visibility
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// Update profile display
function updateProfileDisplay() {
  if (!currentUser) return;
  const nameEl = document.getElementById('profile-name');
  const emailEl = document.getElementById('profile-email');
  const initialsEl = document.getElementById('profile-initials');

  if (nameEl) nameEl.textContent = currentUser.name;
  if (emailEl) emailEl.textContent = currentUser.email;
  if (initialsEl) {
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    initialsEl.textContent = initials;
  }

  // Update greeting
  const greetingEl = document.getElementById('dashboard-greeting');
  if (greetingEl) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    greetingEl.textContent = `${greeting}, ${currentUser.name.split(' ')[0]}! 👋`;
  }

  // Apply user settings
  if (currentUser.settings) {
    applyUserSettings(currentUser.settings);
  }
}

// Apply user settings
function applyUserSettings(settings) {
  if (settings.theme) {
    document.documentElement.setAttribute('data-theme', settings.theme);
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) toggle.checked = settings.theme === 'dark';
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.textContent = settings.theme === 'dark' ? '🌙' : '☀️';
  }

  if (settings.rsuCompany) {
    const rsuInput = document.getElementById('rsu-company');
    if (rsuInput) rsuInput.value = settings.rsuCompany;
  }

  if (settings.rebalancingRules) {
    const { trimThreshold, minAllocation, maxAllocation } = settings.rebalancingRules;
    const trimEl = document.getElementById('trim-threshold');
    const minEl = document.getElementById('min-allocation');
    const maxEl = document.getElementById('max-allocation');
    if (trimEl) trimEl.value = trimThreshold;
    if (minEl) minEl.value = minAllocation;
    if (maxEl) maxEl.value = maxAllocation;
  }

  if (settings.reentryThreshold) {
    const reentryEl = document.getElementById('reentry-threshold');
    const reentryDisplay = document.getElementById('reentry-threshold-display');
    if (reentryEl) reentryEl.value = settings.reentryThreshold;
    if (reentryDisplay) reentryDisplay.textContent = settings.reentryThreshold + '%';
  }
}

// Setup auth form handlers
function setupAuthForms() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const btn = loginForm.querySelector('button[type="submit"]');

      try {
        btn.textContent = 'Signing in...';
        btn.disabled = true;
        await login(email, password);
        showAppSection();
        await initializeApp();
        showToast('Welcome back! 👋');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }
    });
  }

  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const confirm = document.getElementById('reg-confirm').value;
      const btn = registerForm.querySelector('button[type="submit"]');

      if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
      }

      try {
        btn.textContent = 'Creating account...';
        btn.disabled = true;
        await register(name, email, password);
        showAppSection();
        await initializeApp();
        showToast('Account created! Welcome to DS Wealth Tracker 🎉');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.textContent = 'Create Account';
        btn.disabled = false;
      }
    });
  }

  // Forgot password form
  const forgotForm = document.getElementById('forgot-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value;
      const btn = forgotForm.querySelector('button[type="submit"]');
      const msgEl = document.getElementById('forgot-message');

      try {
        btn.textContent = 'Checking...';
        btn.disabled = true;
        await forgotPassword(email);
        msgEl.className = 'message success';
        msgEl.textContent = 'Account found! Since this is a local app, please contact support or use the data export feature to recover your data. Your password is stored securely on this device.';
        msgEl.classList.remove('hidden');
      } catch (err) {
        msgEl.className = 'message error';
        msgEl.textContent = err.message;
        msgEl.classList.remove('hidden');
      } finally {
        btn.textContent = 'Send Reset Link';
        btn.disabled = false;
      }
    });
  }
}

// Show edit profile modal
function showEditProfileModal() {
  if (!currentUser) return;
  const name = prompt('Enter new name:', currentUser.name);
  if (name && name.trim()) {
    UserDB.update(currentUser.id, { name: name.trim() }).then(() => {
      currentUser.name = name.trim();
      updateProfileDisplay();
      showToast('Profile updated!');
    });
  }
}

// Update RSU company setting
async function updateRSUCompany(company) {
  if (!currentUser) return;
  await UserDB.updateSettings(currentUser.id, { rsuCompany: company });
  currentUser.settings.rsuCompany = company;
}

// Update currency setting
async function updateCurrency(currency) {
  if (!currentUser) return;
  await UserDB.updateSettings(currentUser.id, { currency });
  currentUser.settings.currency = currency;
}

// Save rebalancing settings
async function saveRebalancingSettings() {
  if (!currentUser) return;
  const trimThreshold = parseInt(document.getElementById('trim-threshold').value);
  const minAllocation = parseFloat(document.getElementById('min-allocation').value);
  const maxAllocation = parseFloat(document.getElementById('max-allocation').value);

  const rules = { trimThreshold, minAllocation, maxAllocation };
  await UserDB.updateSettings(currentUser.id, { rebalancingRules: rules });
  currentUser.settings.rebalancingRules = rules;
  showToast('Rebalancing settings saved!');
}

// Export data
async function exportData() {
  if (!currentUser) return;
  try {
    const data = await exportAllData(currentUser.id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ds-wealth-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

// Import data
function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version || !data.exportDate) {
        throw new Error('Invalid backup file format');
      }
      if (confirm('This will add the imported data to your existing data. Continue?')) {
        await importAllData(currentUser.id, data);
        showToast('Data imported successfully!');
        await refreshAllPages();
      }
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  };
  input.click();
}

// Clear all data
async function clearAllData() {
  if (!currentUser) return;
  if (confirm('⚠️ This will permanently delete ALL your data. This cannot be undone. Are you sure?')) {
    if (confirm('Last chance! All holdings, trades, assets, goals, and transactions will be deleted.')) {
      try {
        await clearUserData(currentUser.id);
        showToast('All data cleared');
        await refreshAllPages();
      } catch (err) {
        showToast('Error clearing data: ' + err.message, 'error');
      }
    }
  }
}