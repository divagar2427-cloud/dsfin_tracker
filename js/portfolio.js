// ===== DS WEALTH TRACKER - Portfolio Module =====

let currentPortfolioTab = 'indian';
let allHoldings = [];
let filteredHoldings = [];

// ===== RENDER PORTFOLIO PAGE =====
async function renderPortfolioPage() {
  if (!currentUser) return;
  const userId = currentUser.id;

  allHoldings = await HoldingsDB.getAll(userId);
  const prices = await MarketPricesDB.getAll();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });

  // Calculate totals
  let totalInvested = 0, totalCurrent = 0;
  for (const h of allHoldings) {
    const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
    totalInvested += m.investedINR;
    totalCurrent += m.currentValueINR;
  }

  const totalPnl = totalCurrent - totalInvested;
  const totalReturns = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  // Update summary
  setText('portfolio-invested', formatCurrency(totalInvested, 'INR', true));
  setText('portfolio-current', formatCurrency(totalCurrent, 'INR', true));
  const pnlEl = document.getElementById('portfolio-pnl');
  if (pnlEl) {
    pnlEl.textContent = formatPnL(totalPnl);
    pnlEl.className = 'summary-value ' + getPnLClass(totalPnl);
  }
  const retEl = document.getElementById('portfolio-returns');
  if (retEl) {
    retEl.textContent = formatPct(totalReturns);
    retEl.className = 'summary-value ' + getPnLClass(totalReturns);
  }

  // Filter and render
  filterPortfolio();
}

// ===== SWITCH PORTFOLIO TAB =====
function switchPortfolioTab(tab) {
  currentPortfolioTab = tab;
  document.querySelectorAll('#page-portfolio .tab-btn').forEach((btn, i) => {
    const tabs = ['indian', 'us', 'rsu', 'etf', 'mf'];
    btn.classList.toggle('active', tabs[i] === tab);
  });
  filterPortfolio();
}

// ===== FILTER PORTFOLIO =====
function filterPortfolio() {
  const search = (document.getElementById('portfolio-search')?.value || '').toLowerCase();
  const sort = document.getElementById('portfolio-sort')?.value || 'value';

  let filtered = allHoldings.filter(h => {
    if (currentPortfolioTab === 'indian') return h.market === 'indian' && h.type !== 'etf' && h.type !== 'mf';
    if (currentPortfolioTab === 'us') return h.market === 'us';
    if (currentPortfolioTab === 'rsu') return h.market === 'rsu';
    if (currentPortfolioTab === 'etf') return h.type === 'etf';
    if (currentPortfolioTab === 'mf') return h.type === 'mf';
    return true;
  });

  if (search) {
    filtered = filtered.filter(h =>
      h.symbol.toLowerCase().includes(search) ||
      (h.name || '').toLowerCase().includes(search)
    );
  }

  filteredHoldings = filtered;
  sortPortfolio(sort);
}

// ===== SORT PORTFOLIO =====
function sortPortfolio(sortBy) {
  const sort = sortBy || document.getElementById('portfolio-sort')?.value || 'value';
  const prices = {};

  filteredHoldings.sort((a, b) => {
    const ma = calculateHoldingMetrics(a, null);
    const mb = calculateHoldingMetrics(b, null);
    if (sort === 'value') return mb.currentValueINR - ma.currentValueINR;
    if (sort === 'pnl') return mb.pnlINR - ma.pnlINR;
    if (sort === 'returns') return mb.pnlPct - ma.pnlPct;
    if (sort === 'name') return (a.symbol || '').localeCompare(b.symbol || '');
    return 0;
  });

  renderHoldingsList();
}

// ===== RENDER HOLDINGS LIST =====
async function renderHoldingsList() {
  const container = document.getElementById('portfolio-holdings');
  if (!container) return;

  if (filteredHoldings.length === 0) {
    container.innerHTML = '<div class="empty-state">No holdings found. Upload your portfolio or add manually.</div>';
    return;
  }

  const prices = await MarketPricesDB.getAll();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });

  const totalCurrentINR = filteredHoldings.reduce((sum, h) => {
    return sum + calculateHoldingMetrics(h, priceMap[h.symbol]).currentValueINR;
  }, 0);

  container.innerHTML = filteredHoldings.map(h => {
    const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
    const allocation = totalCurrentINR > 0 ? (m.currentValueINR / totalCurrentINR) * 100 : 0;
    const currency = h.market === 'indian' ? 'INR' : 'USD';
    const logoText = h.symbol.substring(0, 3);

    return `
      <div class="holding-card" onclick="showHoldingDetail(${h.id})">
        <div class="holding-logo">${logoText}</div>
        <div class="holding-info">
          <div class="holding-name">${h.name || h.symbol}</div>
          <div class="holding-symbol">${h.symbol} · ${h.sector || 'Other'} · ${allocation.toFixed(1)}%</div>
        </div>
        <div class="holding-values">
          <div class="holding-value">${formatCurrency(m.currentValue, currency)}</div>
          <div class="holding-pnl ${getPnLClass(m.pnl)}">${formatPnL(m.pnl, currency)} (${formatPct(m.pnlPct)})</div>
        </div>
      </div>
      <div class="holding-details" id="detail-${h.id}" style="display:none; padding: 12px 16px; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 0 0 16px 16px; margin-top: -8px; margin-bottom: 8px;">
        <div class="holding-detail-item">
          <span class="holding-detail-label">Qty</span>
          <span class="holding-detail-value">${m.qty.toFixed(m.qty < 1 ? 6 : 2)}</span>
        </div>
        <div class="holding-detail-item">
          <span class="holding-detail-label">Avg Price</span>
          <span class="holding-detail-value">${formatCurrency(m.avgPrice, currency)}</span>
        </div>
        <div class="holding-detail-item">
          <span class="holding-detail-label">Live Price</span>
          <span class="holding-detail-value">${formatCurrency(m.currentPrice, currency)}</span>
        </div>
        <div class="holding-detail-item">
          <span class="holding-detail-label">Invested</span>
          <span class="holding-detail-value">${formatCurrency(m.investedAmount, currency)}</span>
        </div>
        <div class="holding-detail-item">
          <span class="holding-detail-label">Today</span>
          <span class="holding-detail-value ${getPnLClass(m.todayGainLoss)}">${formatPnL(m.todayGainLoss, currency)}</span>
        </div>
        <div class="holding-detail-item">
          <span class="holding-detail-label">Actions</span>
          <span class="holding-detail-value">
            <button class="btn-sm btn-edit" onclick="editHolding(${h.id}, event)">Edit</button>
            <button class="btn-sm btn-delete" onclick="deleteHolding(${h.id}, event)">Del</button>
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// ===== SHOW HOLDING DETAIL =====
function showHoldingDetail(id) {
  const detail = document.getElementById(`detail-${id}`);
  if (detail) {
    detail.style.display = detail.style.display === 'none' ? 'grid' : 'none';
  }
}

// ===== SHOW ADD HOLDING MODAL =====
function showAddHoldingModal(holdingId = null) {
  const modal = document.getElementById('modal-add-holding');
  if (!modal) return;

  if (holdingId) {
    HoldingsDB.getAll(currentUser.id).then(holdings => {
      const h = holdings.find(h => h.id === holdingId);
      if (h) {
        document.getElementById('holding-market').value = h.market;
        document.getElementById('holding-symbol').value = h.symbol;
        document.getElementById('holding-name').value = h.name || '';
        document.getElementById('holding-qty').value = h.quantity;
        document.getElementById('holding-avg-price').value = h.avgPrice;
        document.getElementById('holding-sector').value = h.sector || '';
        document.getElementById('holding-type').value = h.type || 'stock';
        modal.dataset.editId = holdingId;
      }
    });
  } else {
    document.getElementById('add-holding-form').reset();
    delete modal.dataset.editId;
  }

  modal.style.display = 'flex';
}

// ===== SAVE HOLDING =====
async function saveHolding(event) {
  event.preventDefault();
  const modal = document.getElementById('modal-add-holding');
  const editId = modal?.dataset.editId ? parseInt(modal.dataset.editId) : null;

  const holding = {
    market: document.getElementById('holding-market').value,
    symbol: document.getElementById('holding-symbol').value.trim().toUpperCase(),
    name: document.getElementById('holding-name').value.trim(),
    quantity: parseFloat(document.getElementById('holding-qty').value),
    avgPrice: parseFloat(document.getElementById('holding-avg-price').value),
    sector: document.getElementById('holding-sector').value || getSectorForSymbol(document.getElementById('holding-symbol').value),
    type: document.getElementById('holding-type').value
  };

  if (!holding.symbol || !holding.quantity || !holding.avgPrice) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  try {
    if (editId) {
      await HoldingsDB.update(editId, holding);
      showToast('Holding updated!');
    } else {
      await HoldingsDB.add(currentUser.id, holding);
      showToast('Holding added!');
    }
    closeModal('modal-add-holding');
    await renderPortfolioPage();
    await renderDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== EDIT HOLDING =====
function editHolding(id, event) {
  if (event) event.stopPropagation();
  showAddHoldingModal(id);
}

// ===== DELETE HOLDING =====
async function deleteHolding(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Delete this holding?')) return;
  await HoldingsDB.delete(id);
  showToast('Holding deleted');
  await renderPortfolioPage();
  await renderDashboard();
}

// ===== UPDATE HOLDING MARKET =====
function updateHoldingMarket() {
  // Could update currency display based on market
}

// ===== HELPER =====
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}