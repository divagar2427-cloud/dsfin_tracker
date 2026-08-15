// ===== DS WEALTH TRACKER - Trades Module =====

// ===== RENDER TRADES PAGE =====
async function renderTradesPage() {
  if (!currentUser) return;
  const trades = await TradesDB.getAll(currentUser.id);

  // Apply filters
  const period = document.getElementById('trade-period')?.value || 'all';
  const type = document.getElementById('trade-type')?.value || 'all';
  const market = document.getElementById('trade-market')?.value || 'all';

  let filtered = trades;

  // Period filter
  if (period !== 'all') {
    const now = new Date();
    filtered = filtered.filter(t => {
      const d = new Date(t.date);
      if (period === 'today') return d.toDateString() === now.toDateString();
      if (period === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (period === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      if (period === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  }

  if (type !== 'all') filtered = filtered.filter(t => t.type === type);
  if (market !== 'all') filtered = filtered.filter(t => t.market === market);

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculate summary
  const buyTrades = filtered.filter(t => t.type === 'BUY');
  const sellTrades = filtered.filter(t => t.type === 'SELL');
  const totalBuy = buyTrades.reduce((s, t) => s + (parseFloat(t.amount) || t.quantity * t.price), 0);
  const totalSell = sellTrades.reduce((s, t) => s + (parseFloat(t.amount) || t.quantity * t.price), 0);

  setText('total-trades', filtered.length);
  setText('total-buy-amount', formatCurrency(totalBuy, 'INR', true));
  setText('total-sell-amount', formatCurrency(totalSell, 'INR', true));

  // Calculate realized P&L
  const { totalRealizedPnLINR } = await calculateRealizedPnL(currentUser.id);
  const pnlEl = document.getElementById('trades-realized-pnl');
  if (pnlEl) {
    pnlEl.textContent = formatPnL(totalRealizedPnLINR);
    pnlEl.className = 'summary-value ' + getPnLClass(totalRealizedPnLINR);
  }

  const container = document.getElementById('trades-list');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No trades found. Upload transaction reports to see your trade history.</div>';
    return;
  }

  container.innerHTML = filtered.map(t => {
    const currency = t.market === 'indian' ? 'INR' : 'USD';
    const amount = parseFloat(t.amount) || (t.quantity * t.price);
    return `
      <div class="trade-item">
        <div class="trade-header">
          <div>
            <span class="trade-symbol">${t.symbol}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">${t.name || ''}</span>
          </div>
          <span class="trade-type-badge ${t.type.toLowerCase()}">${t.type}</span>
        </div>
        <div class="trade-details">
          <div class="trade-detail">
            <span class="trade-detail-label">Date</span>
            <span class="trade-detail-value">${formatDate(t.date)}</span>
          </div>
          <div class="trade-detail">
            <span class="trade-detail-label">Qty</span>
            <span class="trade-detail-value">${parseFloat(t.quantity).toFixed(t.quantity < 1 ? 4 : 2)}</span>
          </div>
          <div class="trade-detail">
            <span class="trade-detail-label">Price</span>
            <span class="trade-detail-value">${formatCurrency(t.price, currency)}</span>
          </div>
          <div class="trade-detail">
            <span class="trade-detail-label">Amount</span>
            <span class="trade-detail-value">${formatCurrency(amount, currency)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== FILTER TRADES =====
function filterTrades() {
  renderTradesPage();
}

// ===== RENDER SOLD STOCKS (for comparison page) =====
async function renderSoldStocks() {
  if (!currentUser) return;
  const sellTrades = await TradesDB.getSellTrades(currentUser.id);

  const container = document.getElementById('sold-stocks-list');
  if (!container) return;

  if (sellTrades.length === 0) {
    container.innerHTML = '<div class="empty-state">No sold stocks found.</div>';
    return;
  }

  // Group by symbol
  const grouped = {};
  sellTrades.forEach(t => {
    if (!grouped[t.symbol]) grouped[t.symbol] = [];
    grouped[t.symbol].push(t);
  });

  container.innerHTML = Object.entries(grouped).map(([symbol, trades]) => {
    const lastSell = trades.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const totalQty = trades.reduce((s, t) => s + t.quantity, 0);
    const avgSellPrice = trades.reduce((s, t) => s + t.price * t.quantity, 0) / totalQty;
    return `
      <div class="trade-item" style="margin-bottom:8px;">
        <div class="trade-header">
          <span class="trade-symbol">${symbol}</span>
          <span class="trade-type-badge sell">SOLD</span>
        </div>
        <div class="trade-details">
          <div class="trade-detail">
            <span class="trade-detail-label">Last Sold</span>
            <span class="trade-detail-value">${formatDate(lastSell.date)}</span>
          </div>
          <div class="trade-detail">
            <span class="trade-detail-label">Avg Sell</span>
            <span class="trade-detail-value">${formatCurrency(avgSellPrice, lastSell.market === 'indian' ? 'INR' : 'USD')}</span>
          </div>
          <div class="trade-detail">
            <span class="trade-detail-label">Total Qty</span>
            <span class="trade-detail-value">${totalQty.toFixed(2)}</span>
          </div>
          <div class="trade-detail">
            <span class="trade-detail-label">Market</span>
            <span class="trade-detail-value">${lastSell.market === 'indian' ? '🇮🇳' : '🇺🇸'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== RUN PROFIT COMPARISON =====
async function runComparison() {
  const soldStock = document.getElementById('comp-sold-stock')?.value?.trim().toUpperCase();
  const sellDate = document.getElementById('comp-sell-date')?.value;
  const newStock = document.getElementById('comp-new-stock')?.value?.trim().toUpperCase();

  if (!soldStock || !sellDate) {
    showToast('Please enter stock symbol and sell date', 'error');
    return;
  }

  const trades = await TradesDB.getAll(currentUser.id);
  const sellTrades = trades.filter(t => t.symbol === soldStock && t.type === 'SELL' && t.date >= sellDate);

  if (sellTrades.length === 0) {
    showToast('No sell trades found for ' + soldStock, 'error');
    return;
  }

  const totalSellAmount = sellTrades.reduce((s, t) => s + t.quantity * t.price, 0);
  const totalQty = sellTrades.reduce((s, t) => s + t.quantity, 0);
  const avgSellPrice = totalSellAmount / totalQty;

  // Get current price of sold stock
  const soldPriceData = await MarketPricesDB.get(soldStock);
  const currentSoldPrice = soldPriceData?.price || avgSellPrice;
  const holdReturn = ((currentSoldPrice - avgSellPrice) / avgSellPrice) * 100;
  const holdValue = totalQty * currentSoldPrice;

  // Get current price of new stock
  let newStockReturn = 0;
  let newStockValue = totalSellAmount;
  if (newStock) {
    const newPriceData = await MarketPricesDB.get(newStock);
    if (newPriceData?.price) {
      const buyTrades = trades.filter(t => t.symbol === newStock && t.type === 'BUY' && t.date >= sellDate);
      if (buyTrades.length > 0) {
        const avgBuyPrice = buyTrades.reduce((s, t) => s + t.price * t.quantity, 0) / buyTrades.reduce((s, t) => s + t.quantity, 0);
        newStockReturn = ((newPriceData.price - avgBuyPrice) / avgBuyPrice) * 100;
        newStockValue = totalSellAmount * (1 + newStockReturn / 100);
      }
    }
  }

  const resultsEl = document.getElementById('comparison-results');
  const contentEl = document.getElementById('comparison-content');
  if (!resultsEl || !contentEl) return;

  const didSellHelp = newStockReturn > holdReturn;
  const currency = sellTrades[0].market === 'indian' ? 'INR' : 'USD';

  contentEl.innerHTML = `
    <div class="comparison-result-item">
      <span class="comparison-result-label">Sold ${soldStock} at</span>
      <span class="comparison-result-value">${formatCurrency(avgSellPrice, currency)}</span>
    </div>
    <div class="comparison-result-item">
      <span class="comparison-result-label">${soldStock} current price</span>
      <span class="comparison-result-value">${formatCurrency(currentSoldPrice, currency)}</span>
    </div>
    <div class="comparison-result-item">
      <span class="comparison-result-label">If held ${soldStock}</span>
      <span class="comparison-result-value ${getPnLClass(holdReturn)}">${formatPct(holdReturn)} (${formatCurrency(holdValue, currency)})</span>
    </div>
    ${newStock ? `
    <div class="comparison-result-item">
      <span class="comparison-result-label">Invested in ${newStock}</span>
      <span class="comparison-result-value ${getPnLClass(newStockReturn)}">${formatPct(newStockReturn)} (${formatCurrency(newStockValue, currency)})</span>
    </div>
    ` : ''}
    <div class="comparison-result-item" style="border-top: 2px solid var(--primary); padding-top: 12px; margin-top: 4px;">
      <span class="comparison-result-label" style="font-weight:700;">Verdict</span>
      <span class="comparison-result-value ${didSellHelp ? 'positive' : 'negative'}" style="font-weight:700;">
        ${didSellHelp ? '✅ Selling was the right call!' : '❌ Holding would have been better'}
      </span>
    </div>
  `;

  resultsEl.classList.remove('hidden');
}