// ===== DS WEALTH TRACKER - Assets Module =====

let currentAssetTab = 'all';

const ASSET_ICONS = {
  fd: '🏦', bonds: '📜', gold: '🥇', silver: '🥈', lic: '🛡️',
  ppf: '📊', epf: '💼', nps: '🏛️', realestate: '🏠', crypto: '₿',
  cash: '💵', other: '📦'
};

const ASSET_LABELS = {
  fd: 'Fixed Deposit', bonds: 'Bonds', gold: 'Gold', silver: 'Silver',
  lic: 'LIC', ppf: 'PPF', epf: 'EPF', nps: 'NPS',
  realestate: 'Real Estate', crypto: 'Crypto', cash: 'Cash', other: 'Other'
};

// ===== RENDER ASSETS PAGE =====
async function renderAssetsPage() {
  if (!currentUser) return;
  const assets = await AssetsDB.getAll(currentUser.id);

  // Calculate totals
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

  // Filter by tab
  const filtered = currentAssetTab === 'all' ? enriched : enriched.filter(a => a.assetType === currentAssetTab);

  const container = document.getElementById('assets-list');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No assets found. Click + Add to add your first asset.</div>';
    return;
  }

  container.innerHTML = filtered.map(a => `
    <div class="asset-card">
      <div class="asset-header">
        <div class="asset-icon" style="background: rgba(108,99,255,0.15);">${ASSET_ICONS[a.assetType] || '📦'}</div>
        <div class="asset-title">
          <div class="asset-name">${a.name}</div>
          <div class="asset-type">${ASSET_LABELS[a.assetType] || a.assetType}</div>
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
          <span class="asset-detail-label">Interest Earned</span>
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
  `).join('');
}

// ===== CALCULATE ASSET VALUE =====
function calculateAssetValue(asset) {
  const invested = parseFloat(asset.amount) || 0;
  const rate = parseFloat(asset.interestRate) || 0;
  const startDate = asset.startDate ? new Date(asset.startDate) : new Date();
  const maturityDate = asset.maturityDate ? new Date(asset.maturityDate) : null;
  const now = new Date();

  // Years elapsed
  const yearsElapsed = (now - startDate) / (365.25 * 24 * 3600 * 1000);
  const yearsToMaturity = maturityDate ? (maturityDate - startDate) / (365.25 * 24 * 3600 * 1000) : 0;

  let currentValue = invested;
  let maturityValue = invested;
  let interestEarned = 0;

  if (rate > 0) {
    const r = rate / 100;
    const n = getCompoundingFrequency(asset.compounding);

    if (n > 0) {
      // Compound interest
      currentValue = invested * Math.pow(1 + r / n, n * Math.max(yearsElapsed, 0));
      maturityValue = yearsToMaturity > 0 ? invested * Math.pow(1 + r / n, n * yearsToMaturity) : currentValue;
    } else {
      // Simple interest
      currentValue = invested * (1 + r * Math.max(yearsElapsed, 0));
      maturityValue = yearsToMaturity > 0 ? invested * (1 + r * yearsToMaturity) : currentValue;
    }

    interestEarned = currentValue - invested;
  }

  // For gold/silver/crypto, use approximate current value
  if (['gold', 'silver', 'crypto'].includes(asset.assetType)) {
    currentValue = invested; // Would need live price
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
    yearsElapsed: Math.max(yearsElapsed, 0)
  };
}

function getCompoundingFrequency(compounding) {
  const map = { 'annual': 1, 'semi-annual': 2, 'quarterly': 4, 'monthly': 12 };
  return map[compounding] || 1;
}

// ===== SWITCH ASSET TAB =====
function switchAssetTab(tab) {
  currentAssetTab = tab;
  document.querySelectorAll('#page-assets .tab-btn').forEach(btn => {
    const tabTypes = ['all', 'fd', 'gold', 'ppf', 'epf', 'nps', 'realestate', 'crypto', 'other'];
    const idx = Array.from(document.querySelectorAll('#page-assets .tab-btn')).indexOf(btn);
    btn.classList.toggle('active', tabTypes[idx] === tab);
  });
  renderAssetsPage();
}

// ===== SHOW ADD ASSET MODAL =====
function showAddAssetModal(assetId = null) {
  const modal = document.getElementById('modal-add-asset');
  if (!modal) return;

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
      }
    });
  } else {
    document.getElementById('add-asset-form').reset();
    document.getElementById('asset-start-date').value = new Date().toISOString().split('T')[0];
    delete modal.dataset.editId;
  }

  modal.classList.remove('hidden');
}

// ===== UPDATE ASSET FORM =====
function updateAssetForm() {
  const type = document.getElementById('asset-type').value;
  const noRateTypes = ['gold', 'silver', 'realestate', 'crypto', 'cash'];
  const rateGroup = document.getElementById('asset-rate-group');
  const compoundGroup = document.getElementById('asset-compound-group');
  const maturityGroup = document.getElementById('asset-maturity-group');

  if (rateGroup) rateGroup.style.display = noRateTypes.includes(type) ? 'none' : 'flex';
  if (compoundGroup) compoundGroup.style.display = noRateTypes.includes(type) ? 'none' : 'flex';
  if (maturityGroup) maturityGroup.style.display = ['gold', 'silver', 'realestate', 'crypto', 'cash', 'epf', 'nps'].includes(type) ? 'none' : 'flex';
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
function editAsset(id) {
  showAddAssetModal(id);
}

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