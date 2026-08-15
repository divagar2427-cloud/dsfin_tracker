// ===== DS WEALTH TRACKER - Main App Controller =====

let currentPage = 'dashboard';

// ===== APP INITIALIZATION =====
async function initApp() {
  try {
    // Initialize IndexedDB
    await initDB();

    // Check auth state
    const isLoggedIn = await initAuth();

    // Hide splash after 2 seconds
    setTimeout(() => {
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.classList.add('hidden'), 500);
      }

      if (isLoggedIn) {
        showAppSection();
        initializeApp();
      } else {
        showAuthSection();
      }
    }, 2000);

    // Setup auth forms
    setupAuthForms();

    // Register service worker
    registerServiceWorker();

  } catch (err) {
    console.error('App init error:', err);
    showAuthSection();
  }
}

// ===== INITIALIZE APP AFTER LOGIN =====
async function initializeApp() {
  try {
    // Fetch USD/INR rate
    fetchUSDINRRate().catch(() => {});

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
  if (!currentUser) return;

  try {
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

  } catch (err) {
    console.error('Dashboard render error:', err);
  }
}

// ===== NAVIGATE TO PAGE =====
function navigateTo(page) {
  currentPage = page;

  // Hide all pages (remove active, add hidden)
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });

  // Show target page (remove hidden, add active)
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.remove('hidden');
    targetPage.classList.add('active');
  }

  // Update bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Render page content
  renderPage(page);

  // Scroll to top
  document.querySelector('.page-container')?.scrollTo(0, 0);
}

// ===== RENDER PAGE =====
async function renderPage(page) {
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
      // Reset upload status
      break;
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

  // Save preference
  if (currentUser) {
    UserDB.updateSettings(currentUser.id, { theme: newTheme });
    currentUser.settings.theme = newTheme;
  }

  // Re-render charts with new theme
  destroyAllCharts();
  if (currentPage === 'dashboard') renderDashboard();
}

// ===== SHOW/HIDE MORE MENU =====
function showMoreMenu() {
  document.getElementById('more-menu')?.classList.remove('hidden');
}

function hideMoreMenu() {
  document.getElementById('more-menu')?.classList.add('hidden');
}

// ===== MODAL MANAGEMENT =====
function closeModal(modalId) {
  document.getElementById(modalId)?.classList.add('hidden');
}

// ===== TOAST NOTIFICATION =====
let toastTimeout = null;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.style.background = type === 'error' ? 'rgba(255,101,132,0.15)' :
                           type === 'success' ? 'var(--bg-secondary)' : 'var(--bg-secondary)';
  toast.style.borderColor = type === 'error' ? 'rgba(255,101,132,0.3)' : 'var(--border-color)';
  toast.style.color = type === 'error' ? 'var(--negative)' : 'var(--text-primary)';

  toast.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ===== LOADING OVERLAY =====
function showLoading(text = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  if (overlay) overlay.classList.remove('hidden');
  if (loadingText) loadingText.textContent = text;
}

function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden');
}

// ===== REGISTER SERVICE WORKER =====
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_MARKET_DATA') {
        refreshMarketData();
      }
    });
  }
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close any open modal
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    hideMoreMenu();
  }
});

// ===== HANDLE BACK BUTTON =====
window.addEventListener('popstate', () => {
  // Handle browser back button
  hideMoreMenu();
  document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
});

// ===== PREVENT ZOOM ON DOUBLE TAP =====
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// ===== HANDLE ONLINE/OFFLINE =====
window.addEventListener('online', () => {
  showToast('Back online! Refreshing data...');
  refreshMarketData();
});

window.addEventListener('offline', () => {
  showToast('You are offline. Using cached data.', 'error');
});

// ===== START APP =====
document.addEventListener('DOMContentLoaded', initApp);