// ===== DS WEALTH TRACKER - Main App Controller =====

let currentPage = 'dashboard';

// ===== APP INITIALIZATION =====
async function initApp() {
  try {
    console.log('Initializing DS Wealth Tracker...');
    
    // Initialize IndexedDB
    await initDB();
    console.log('DB initialized');

    // Check auth state
    const isLoggedIn = await initAuth();
    console.log('Auth checked, logged in:', isLoggedIn);

    // Setup auth forms
    setupAuthForms();

    // Hide splash after 1.5 seconds
    setTimeout(() => {
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
          splash.style.display = 'none';
        }, 500);
      }

      if (isLoggedIn) {
        showAppSection();
        initializeApp();
      } else {
        showAuthSection();
      }
    }, 1500);

    // Register service worker (non-blocking)
    registerServiceWorker();

  } catch (err) {
    console.error('App init error:', err);
    // Show auth section on error
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    showAuthSection();
  }
}

// ===== SHOW AUTH SECTION =====
function showAuthSection() {
  const splash = document.getElementById('splash-screen');
  const auth = document.getElementById('auth-section');
  const app = document.getElementById('app-section');
  
  if (splash) splash.style.display = 'none';
  if (auth) auth.style.display = 'flex';
  if (app) app.style.display = 'none';
  
  showPage('login-page');
}

// ===== SHOW APP SECTION =====
function showAppSection() {
  const splash = document.getElementById('splash-screen');
  const auth = document.getElementById('auth-section');
  const app = document.getElementById('app-section');
  
  if (splash) splash.style.display = 'none';
  if (auth) auth.style.display = 'none';
  if (app) app.style.display = 'block';
  
  // Initialize all pages as hidden using inline styles
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
    p.classList.remove('hidden');
  });
  
  // Show dashboard by default
  const dashboard = document.getElementById('page-dashboard');
  if (dashboard) {
    dashboard.style.display = 'block';
    dashboard.classList.add('active');
  }
  
  updateProfileDisplay();
  console.log('App section shown, dashboard visible');
}

// ===== INITIALIZE APP AFTER LOGIN =====
async function initializeApp() {
  try {
    console.log('Initializing app features...');
    
    // Fetch USD/INR rate (non-blocking)
    fetchUSDINRRate().catch(e => console.log('USD/INR fetch failed:', e));

    // Render dashboard
    await renderDashboard();

    // Auto-refresh market data every 15 minutes
    setInterval(() => {
      if (currentPage === 'dashboard' || currentPage === 'portfolio') {
        refreshMarketData();
      }
    }, 15 * 60 * 1000);

  } catch (err) {
    console.error('Initialize app error:', err);
  }
}

// ===== RENDER DASHBOARD =====
async function renderDashboard() {
  if (!currentUser) {
    console.log('No current user, skipping dashboard render');
    return;
  }

  try {
    console.log('Rendering dashboard...');
    
    const holdings = await HoldingsDB.getAll(currentUser.id);
    const prices = await MarketPricesDB.getAll();
    const priceMap = {};
    prices.forEach(p => { priceMap[p.symbol] = p; });

    // Calculate portfolio totals
    const totals = await calculatePortfolioTotals(currentUser.id);
    const { totalRealizedPnLINR } = await calculateRealizedPnL(currentUser.id);

    // Get assets total
    const assets = await AssetsDB.getAll(currentUser.id);
    const assetsTotal = assets.reduce((s, a) => s + calculateAssetValue(a).currentValue, 0);

    // Total net worth = portfolio + assets
    const totalNetWorth = totals.totalCurrentINR + assetsTotal;

    // Update net worth display
    setText('total-net-worth', formatCurrency(totalNetWorth, 'INR', true));
    setText('indian-portfolio-value', formatCurrency(totals.indianCurrent, 'INR', true));
    setText('us-portfolio-value', formatCurrency(totals.usCurrent, 'USD', true));
    setText('rsu-portfolio-value', formatCurrency(totals.rsuCurrent, 'USD', true));
    setText('other-assets-value', formatCurrency(assetsTotal, 'INR', true));

    // P&L stats
    const unrealizedEl = document.getElementById('unrealized-pnl');
    if (unrealizedEl) {
      unrealizedEl.textContent = formatPnL(totals.totalPnlINR);
      unrealizedEl.className = 'stat-value ' + getPnLClass(totals.totalPnlINR);
    }

    const realizedEl = document.getElementById('realized-pnl');
    if (realizedEl) {
      realizedEl.textContent = formatPnL(totalRealizedPnLINR);
      realizedEl.className = 'stat-value ' + getPnLClass(totalRealizedPnLINR);
    }

    const todayEl = document.getElementById('todays-gain');
    if (todayEl) {
      todayEl.textContent = formatPnL(totals.totalTodayGainINR);
      todayEl.className = 'stat-value ' + getPnLClass(totals.totalTodayGainINR);
    }

    const returnsEl = document.getElementById('total-returns');
    if (returnsEl) {
      returnsEl.textContent = formatPct(totals.totalReturns);
      returnsEl.className = 'stat-value ' + getPnLClass(totals.totalReturns);
    }

    // Net worth change badge
    const changeBadge = document.querySelector('.change-badge');
    if (changeBadge) {
      changeBadge.textContent = formatPct(totals.totalReturns);
      changeBadge.className = 'change-badge ' + (totals.totalReturns >= 0 ? 'positive' : 'negative');
    }

    // Exchange rate display
    updateExchangeRateDisplay();
    setText('us-portfolio-usd', formatCurrency(totals.usCurrent + totals.rsuCurrent, 'USD', true));
    setText('us-portfolio-inr', formatCurrency((totals.usCurrent + totals.rsuCurrent) * usdInrRate, 'INR', true));

    // Render charts
    if (holdings.length > 0) {
      await renderDashboardCharts(holdings, priceMap);
      await renderTopHoldings(holdings, priceMap);
    }

    // Save portfolio snapshot
    await savePortfolioSnapshot(totalNetWorth);
    
    console.log('Dashboard rendered successfully');

  } catch (err) {
    console.error('Dashboard render error:', err);
  }
}

// ===== NAVIGATE TO PAGE =====
function navigateTo(page) {
  console.log('Navigating to:', page);
  currentPage = page;

  // Hide ALL pages using inline styles (most reliable method)
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  // Show target page using inline styles
  const targetPage = document.getElementById('page-' + page);
  if (targetPage) {
    targetPage.style.display = 'block';
    targetPage.classList.add('active');
    console.log('Page shown:', page);
  } else {
    console.error('Page not found:', 'page-' + page);
  }

  // Update bottom nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.page === page;
    btn.classList.toggle('active', isActive);
  });

  // Render page content
  renderPage(page);

  // Scroll to top
  const container = document.querySelector('.page-container');
  if (container) container.scrollTop = 0;
}

// ===== RENDER PAGE =====
async function renderPage(page) {
  try {
    switch (page) {
      case 'dashboard':
        await renderDashboard();
        break;
      case 'portfolio':
        await renderPortfolioPage();
        break;
      case 'assets':
        await renderAssetsPage();
        break;
      case 'goals':
        await renderGoalsPage();
        break;
      case 'money':
        await renderMoneyPage();
        break;
      case 'trades':
        await renderTradesPage();
        break;
      case 'rebalancing':
        await renderRebalancingPage();
        break;
      case 'reentry':
        await renderReentryPage();
        break;
      case 'groups':
        await renderGroupsPage();
        break;
      case 'comparison':
        await renderSoldStocks();
        break;
      case 'settings':
        updateProfileDisplay();
        break;
      case 'upload':
        break;
    }
  } catch (err) {
    console.error('Render page error for', page, ':', err);
  }
}

// ===== REFRESH ALL PAGES =====
async function refreshAllPages() {
  await renderPage(currentPage);
}

// ===== TOGGLE THEME =====
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', newTheme);

  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = newTheme === 'dark';

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.textContent = newTheme === 'dark' ? '🌙' : '☀️';

  if (currentUser) {
    UserDB.updateSettings(currentUser.id, { theme: newTheme });
    currentUser.settings.theme = newTheme;
  }

  destroyAllCharts();
  if (currentPage === 'dashboard') renderDashboard();
}

// ===== SHOW/HIDE MORE MENU =====
function showMoreMenu() {
  const menu = document.getElementById('more-menu');
  if (menu) menu.style.display = 'flex';
}

function hideMoreMenu() {
  const menu = document.getElementById('more-menu');
  if (menu) menu.style.display = 'none';
}

// ===== MODAL MANAGEMENT =====
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
}

// ===== TOAST NOTIFICATION =====
let toastTimeout = null;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.style.background = type === 'error' ? 'rgba(255,101,132,0.15)' : 'var(--bg-secondary)';
  toast.style.borderColor = type === 'error' ? 'rgba(255,101,132,0.3)' : 'var(--border-color)';
  toast.style.color = type === 'error' ? 'var(--negative)' : 'var(--text-primary)';
  toast.style.display = 'block';

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// ===== LOADING OVERLAY =====
function showLoading(text = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  if (overlay) overlay.style.display = 'flex';
  if (loadingText) loadingText.textContent = text;
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ===== REGISTER SERVICE WORKER =====
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('SW registered');
    }).catch(err => {
      console.log('SW registration failed (non-critical):', err);
    });
  }
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
    hideMoreMenu();
  }
});

// ===== HANDLE ONLINE/OFFLINE =====
window.addEventListener('online', () => {
  showToast('Back online!');
  refreshMarketData();
});

window.addEventListener('offline', () => {
  showToast('You are offline. Using cached data.', 'error');
});

// ===== START APP =====
document.addEventListener('DOMContentLoaded', initApp);