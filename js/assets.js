// ===== DS WEALTH TRACKER - Enhanced Assets Module =====

let currentAssetTab = 'all';

// ===== ASSET TYPE DEFINITIONS =====
const ASSET_TYPES = {
  // Banking & Cash
  savings: { label: 'Savings Account', icon: '🏦', color: '#3B82F6', category: 'banking', hasRate: true, hasMaturity: false },
  current: { label: 'Current Account', icon: '🏛️', color: '#60A5FA', category: 'banking', hasRate: false, hasMaturity: false },
  fd: { label: 'Fixed Deposit', icon: '📜', color: '#2563EB', category: 'banking', hasRate: true, hasMaturity: true },
  cash: { label: 'Cash', icon: '💵', color: '#22C55E', category: 'banking', hasRate: false, hasMaturity: false },
  // Investments
  stocks: { label: 'Stocks', icon: '📈', color: '#10B981', category: 'investments', hasRate: false, hasMaturity: false },
  mf: { label: 'Mutual Funds', icon: '📊', color: '#6366F1', category: 'investments', hasRate: false, hasMaturity: false },
  etf: { label: 'ETFs', icon: '💹', color: '#8B5CF6', category: 'investments', hasRate: false, hasMaturity: false },
  bonds: { label: 'Bonds', icon: '📋', color: '#64748B', category: 'investments', hasRate: true, hasMaturity: true },
  gold: { label: 'Gold', icon: '🥇', color: '#F59E0B', category: 'investments', hasRate: false, hasMaturity: false },
  silver: { label: 'Silver', icon: '🥈', color: '#94A3B8', category: 'investments', hasRate: false, hasMaturity: false },
  crypto: { label: 'Cryptocurrency', icon: '₿', color: '#F97316', category: 'investments', hasRate: false, hasMaturity: false },
  // Government Schemes
  ppf: { label: 'PPF', icon: '🏛️', color: '#0EA5E9', category: 'govt', hasRate: true, hasMaturity: true },
  epf: { label: 'EPF', icon: '💼', color: '#0284C7', category: 'govt', hasRate: true, hasMaturity: false },
  nps: { label: 'NPS', icon: '🏛️', color: '#0369A1', category: 'govt', hasRate: true, hasMaturity: false },
  vpf: { label: 'VPF', icon: '💰', color: '#0891B2', category: 'govt', hasRate: true, hasMaturity: false },
  // Insurance
  lic: { label: 'LIC', icon: '🛡️', color: '#7C3AED', category: 'insurance', hasRate: true, hasMaturity: true },
  ulip: { label: 'ULIP', icon: '📑', color: '#6D28D9', category: 'insurance', hasRate: true, hasMaturity: true },
  // Real Estate
  house: { label: 'House', icon: '🏠', color: '#92400E', category: 'realestate', hasRate: false, hasMaturity: false },
  apartment: { label: 'Apartment', icon: '🏢', color: '#78350F', category: 'realestate', hasRate: false, hasMaturity: false },
  land: { label: 'Land', icon: '🌍', color: '#713F12', category: 'realestate', hasRate: false, hasMaturity: false },
  commercial: { label: 'Commercial Property', icon: '🏬', color: '#92400E', category: 'realestate', hasRate: false, hasMaturity: false },
  // Vehicles
  car: { label: 'Car', icon: '🚗', color: '#DC2626', category: 'vehicles', hasRate: false, hasMaturity: false },
  bike: { label: 'Bike', icon: '🏍️', color: '#B91C1C', category: 'vehicles', hasRate: false, hasMaturity: false },
  // Others
  jewellery: { label: 'Jewellery', icon: '💍', color: '#D97706', category: 'others', hasRate: false, hasMaturity: false },
  watches: { label: 'Watches', icon: '⌚', color: '#B45309', category: 'others', hasRate: false, hasMaturity: false },
  electronics: { label: 'Electronics', icon: '💻', color: '#4B5563', category: 'others', hasRate: false, hasMaturity: false },
  collectibles: { label: 'Collectibles', icon: '🎨', color: '#7C3AED', category: 'others', hasRate: false, hasMaturity: false },
  other: { label: 'Other Asset', icon: '📦', color: '#6B7280', category: 'others', hasRate: false, hasMaturity: false }
};

const ASSET_CATEGORIES = {
  all: { label: 'All Assets', icon: '💎' },
  banking: { label: 'Banking & Cash', icon: '🏦' },
  investments: { label: 'Investments', icon: '📈' },
  govt: { label: 'Govt Schemes', icon: '🏛️' },
  insurance: { label: 'Insurance', icon: '🛡️' },
  realestate: { label: 'Real Estate', icon: '🏠' },
  vehicles: { label: 'Vehicles', icon: '🚗' },
  others: { label: 'Others', icon: '📦' }
};

function getAssetTypeInfo(assetType) {
  return ASSET_TYPES[assetType] || { label: assetType, icon: '📦', color: '#6B7280', category: 'others', hasRate: false, hasMaturity: false };
}

// ===== RENDER ASSETS PAGE =====
async function renderAssetsPage() {
  if (!currentUser) return;
  const assets = await AssetsDB.getAll(currentUser.id);

  let totalInvested = 0, totalCurrent = 0, totalInterest = 0;
  const enriched = assets.map(a => {
    const calc = calculateAssetValue(a);
    totalInvested += calc.investedAmount;
    totalCurrent += calc.currentValue;
    totalInterest += calc.interestEarned;
    return { ...a, ...calc };
  });

  const avgReturn = totalInvested > 0 ? (totalInterest / totalInvested) * 100 : 0;

  setText('total-assets-value', formatCurrency(totalCurrent, 'INR', true));
  setText('assets-invested', formatCurrency(totalInvested, 'INR', true));
  setText('assets-interest', formatCurrency(totalInterest, 'INR', true));
  setText('assets-annual-return', formatPct(avgReturn));

  // Update tab bar with categories
  updateAssetTabBar();

  // Filter by tab
  const filtered = currentAssetTab === 'all' ? enriched :
    enriched.filter(a => {
      const typeInfo = getAssetTypeInfo(a.assetType);
      return typeInfo.category === currentAssetTab;
    });

  const container = document.getElementById('assets-list');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p style="margin-bottom:16px;">No assets in this category.</p>
        <button class="btn-primary" onclick="showAddAssetModal()">+ Add Asset</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const typeInfo = getAssetTypeInfo(a.assetType);
    return `
      <div class="asset-card" style="border-left: 3px solid ${typeInfo.color};">
        <div class="asset-header">
          <div class="asset-icon" style="background:${typeInfo.color}22; font-size:1.5rem; display:flex; align-items:center; justify-content:center;">
            ${typeInfo.icon}
          </div>
          <div class="asset-title">
            <div class="asset-name">${a.name}</div>
            <div class="asset-type" style="color:${typeInfo.color};">${typeInfo.label}</div>
          </div>
          <div class="asset-value">
            <div class="asset-current">${formatCurrency(a.currentValue, 'INR', true)}</div>
            <div class="asset-return ${getPnLClass(a.returnPct)}">${formatPct(a.returnPct)}</div>
          </div>
        </div>
        <div class="asset-details">
          <div class="asset-detail-item">
            <span class="asset-detail-label">Invested</span>
            <span class="asset-detail-value">${formatCurrency(a.investedAmount, 'INR', true)}</span>
          </div>
          <div class="asset-detail-item">
            <span class="asset-detail-label">Gain/Interest</span>
            <span class="asset-detail-value positive">${formatCurrency(a.interestEarned, 'INR', true)}</span>
          </div>
          <div class="asset-detail-item">
            <span class="asset-detail-label">Maturity</span>
            <span class="asset-detail-value">${a.maturityDate ? formatDate(a.maturityDate) : 'N/A'}</span>
          </div>
          <div class="asset-detail-item">
            <span class="asset-detail-label">Rate</span>
            <span class="asset-detail-value">${a.interestRate ? a.interestRate + '%' : 'N/A'}</span>
          </div>
          <div class="asset-detail-item">
            <span class="asset-detail-label">Maturity Value</span>
            <span class="asset-detail-value">${formatCurrency(a.maturityValue, 'INR', true)}</span>
          </div>
          <div class="asset-detail-item">
            <span class="asset-detail-label">Actions</span>
            <span class="asset-detail-value">
              <button class="btn-sm btn-edit" onclick="editAsset(${a.id})">Edit</button>
              <button class="btn-sm btn-delete" onclick="deleteAsset(${a.id})">Del</button>
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== UPDATE ASSET TAB BAR =====
function updateAssetTabBar() {
  const tabBar = document.querySelector('#page-assets .tab-bar');
  if (!tabBar) return;

  tabBar.innerHTML = Object.entries(ASSET_CATEGORIES).map(([key, cat]) => `
    <button class="tab-btn ${currentAssetTab === key ? 'active' : ''}" onclick="switchAssetTab('${key}')">
      ${cat.icon} ${cat.label}
    </button>
  `).join('');
}

// ===== CALCULATE ASSET VALUE =====
function calculateAssetValue(asset) {
  const invested = parseFloat(asset.amount) || 0;
  const rate = parseFloat(asset.interestRate) || 0;
  const startDate = asset.startDate ? new Date(asset.startDate) : new Date();
  const maturityDate = asset.maturityDate ? new Date(asset.maturityDate) : null;
  const now = new Date();

  const yearsElapsed = Math.max((now - startDate) / (365.25 * 24 * 3600 * 1000), 0);
  const yearsToMaturity = maturityDate ? Math.max((maturityDate - startDate) / (365.25 * 24 * 3600 * 1000), 0) : 0;

  let currentValue = invested;
  let maturityValue = invested;
  let interestEarned = 0;

  if (rate > 0) {
    const r = rate / 100;
    const n = getCompoundingFrequency(asset.compounding);

    if (n > 0) {
      currentValue = invested * Math.pow(1 + r / n, n * yearsElapsed);
      maturityValue = yearsToMaturity > 0 ? invested * Math.pow(1 + r / n, n * yearsToMaturity) : currentValue;
    } else {
      currentValue = invested * (1 + r * yearsElapsed);
      maturityValue = yearsToMaturity > 0 ? invested * (1 + r * yearsToMaturity) : currentValue;
    }
    interestEarned = currentValue - invested;
  }

  // For market-linked assets, use invested value (would need live price)
  const marketLinked = ['stocks', 'mf', 'etf', 'crypto', 'gold', 'silver'];
  if (marketLinked.includes(asset.assetType)) {
    currentValue = invested; // Use invested as base
    maturityValue = invested;
    interestEarned = 0;
  }

  const returnPct = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0;

  return {
    investedAmount: invested,
    currentValue,
    maturityValue,
    interestEarned,
    returnPct,
    yearsElapsed
  };
}

function getCompoundingFrequency(compounding) {
  const map = { 'annual': 1, 'semi-annual': 2, 'quarterly': 4, 'monthly': 12 };
  return map[compounding] || 1;
}

// ===== SWITCH ASSET TAB =====
function switchAssetTab(tab) {
  currentAssetTab = tab;
  renderAssetsPage();
}

// ===== SHOW ADD ASSET MODAL =====
function showAddAssetModal(assetId = null) {
  const modal = document.getElementById('modal-add-asset');
  if (!modal) return;

  // Update asset type select with all types
  const select = document.getElementById('asset-type');
  if (select) {
    const categories = {};
    Object.entries(ASSET_TYPES).forEach(([key, info]) => {
      if (!categories[info.category]) categories[info.category] = [];
      categories[info.category].push({ key, ...info });
    });

    select.innerHTML = Object.entries(categories).map(([cat, types]) => `
      <optgroup label="${ASSET_CATEGORIES[cat]?.label || cat}">
        ${types.map(t => `<option value="${t.key}">${t.icon} ${t.label}</option>`).join('')}
      </optgroup>
    `).join('');
  }

  if (assetId) {
    AssetsDB.getAll(currentUser.id).then(assets => {
      const a = assets.find(a => a.id === assetId);
      if (a) {
        document.getElementById('asset-type').value = a.assetType;
        document.getElementById('asset-name').value = a.name;
        document.getElementById('asset-amount').value = a.amount;
        document.getElementById('asset-rate').value = a.interestRate || '';
        document.getElementById('asset-compound').value = a.compounding || 'annual';
        document.getElementById('asset-start-date').value = a.startDate || '';
        document.getElementById('asset-maturity-date').value = a.maturityDate || '';
        document.getElementById('asset-notes').value = a.notes || '';
        modal.dataset.editId = assetId;
        updateAssetForm();
      }
    });
  } else {
    document.getElementById('add-asset-form').reset();
    document.getElementById('asset-start-date').value = new Date().toISOString().split('T')[0];
    delete modal.dataset.editId;
    updateAssetForm();
  }

  modal.style.display = 'flex';
}

// ===== UPDATE ASSET FORM =====
function updateAssetForm() {
  const type = document.getElementById('asset-type')?.value;
  if (!type) return;

  const typeInfo = getAssetTypeInfo(type);
  const rateGroup = document.getElementById('asset-rate-group');
  const compoundGroup = document.getElementById('asset-compound-group');
  const maturityGroup = document.getElementById('asset-maturity-group');

  if (rateGroup) rateGroup.style.display = typeInfo.hasRate ? 'flex' : 'none';
  if (compoundGroup) compoundGroup.style.display = typeInfo.hasRate ? 'flex' : 'none';
  if (maturityGroup) maturityGroup.style.display = typeInfo.hasMaturity ? 'flex' : 'none';
}

// ===== SAVE ASSET =====
async function saveAsset(event) {
  event.preventDefault();
  const modal = document.getElementById('modal-add-asset');
  const editId = modal?.dataset.editId ? parseInt(modal.dataset.editId) : null;

  const asset = {
    assetType: document.getElementById('asset-type').value,
    name: document.getElementById('asset-name').value.trim(),
    amount: parseFloat(document.getElementById('asset-amount').value),
    interestRate: parseFloat(document.getElementById('asset-rate').value) || 0,
    compounding: document.getElementById('asset-compound').value,
    startDate: document.getElementById('asset-start-date').value,
    maturityDate: document.getElementById('asset-maturity-date').value,
    notes: document.getElementById('asset-notes').value.trim()
  };

  if (!asset.name || !asset.amount) {
    showToast('Please fill required fields', 'error');
    return;
  }

  try {
    if (editId) {
      await AssetsDB.update(editId, asset);
      showToast('Asset updated!');
    } else {
      await AssetsDB.add(currentUser.id, asset);
      showToast('Asset added!');
    }
    closeModal('modal-add-asset');
    await renderAssetsPage();
    await renderDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== EDIT ASSET =====
function editAsset(id) { showAddAssetModal(id); }

// ===== DELETE ASSET =====
async function deleteAsset(id) {
  if (!confirm('Delete this asset?')) return;
  await AssetsDB.delete(id);
  showToast('Asset deleted');
  await renderAssetsPage();
  await renderDashboard();
}

// ===== FORMAT DATE =====
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}