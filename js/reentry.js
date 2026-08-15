// ===== DS WEALTH TRACKER - Re-Entry Tracker Module =====

// ===== RENDER RE-ENTRY PAGE =====
async function renderReentryPage() {
  if (!currentUser) return;
  const sellTrades = await TradesDB.getSellTrades(currentUser.id);
  const threshold = currentUser.settings?.reentryThreshold || 10;

  if (sellTrades.length === 0) {
    document.getElementById('reentry-list').innerHTML =
      '<div class="empty-state">No sold stocks tracked. Sell transactions will appear here automatically.</div>';
    return;
  }

  // Group sell trades by symbol
  const soldMap = {};
  sellTrades.forEach(t => {
    if (!soldMap[t.symbol]) {
      soldMap[t.symbol] = { symbol: t.symbol, name: t.name, trades: [], market: t.market };
    }
    soldMap[t.symbol].trades.push(t);
  });

  // Get current prices
  const prices = await MarketPricesDB.getAll();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });

  const reentryItems = [];

  for (const [symbol, data] of Object.entries(soldMap)) {
    // Calculate average sell price
    const totalQty = data.trades.reduce((s, t) => s + t.quantity, 0);
    const avgSellPrice = data.trades.reduce((s, t) => s + t.price * t.quantity, 0) / totalQty;
    const lastSellDate = data.trades.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date;

    // Get current price
    const priceData = priceMap[symbol];
    const currentPrice = priceData?.price || 0;

    if (currentPrice <= 0) continue;

    // Calculate price drop from sell price
    const priceDrop = ((avgSellPrice - currentPrice) / avgSellPrice) * 100;
    const reentryPrice = avgSellPrice * (1 - threshold / 100);
    const isOpportunity = currentPrice <= reentryPrice;
    const isWatch = priceDrop > 0 && priceDrop < threshold;

    reentryItems.push({
      symbol,
      name: data.name || symbol,
      market: data.market,
      avgSellPrice,
      currentPrice,
      reentryPrice,
      priceDrop,
      isOpportunity,
      isWatch,
      lastSellDate,
      totalQty
    });
  }

  // Sort: opportunities first, then watch, then others
  reentryItems.sort((a, b) => {
    if (a.isOpportunity && !b.isOpportunity) return -1;
    if (!a.isOpportunity && b.isOpportunity) return 1;
    if (a.isWatch && !b.isWatch) return -1;
    if (!a.isWatch && b.isWatch) return 1;
    return b.priceDrop - a.priceDrop;
  });

  const container = document.getElementById('reentry-list');
  if (!container) return;

  if (reentryItems.length === 0) {
    container.innerHTML = '<div class="empty-state">No re-entry opportunities found. Prices are above sell levels.</div>';
    return;
  }

  container.innerHTML = reentryItems.map(item => {
    const currency = item.market === 'indian' ? 'INR' : 'USD';
    const badgeClass = item.isOpportunity ? 'opportunity' : item.isWatch ? 'watch' : '';
    const badgeText = item.isOpportunity ? '🎯 Re-Entry!' : item.isWatch ? '👀 Watch' : '📊 Monitor';

    return `
      <div class="reentry-card">
        <div class="reentry-header">
          <div>
            <span class="reentry-symbol">${item.symbol}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">${item.name}</span>
          </div>
          ${badgeClass ? `<span class="reentry-badge ${badgeClass}">${badgeText}</span>` : ''}
        </div>
        <div class="reentry-details">
          <div class="reentry-detail">
            <span class="reentry-detail-label">Sold At</span>
            <span class="reentry-detail-value">${formatCurrency(item.avgSellPrice, currency)}</span>
          </div>
          <div class="reentry-detail">
            <span class="reentry-detail-label">Current</span>
            <span class="reentry-detail-value ${getPnLClass(-item.priceDrop)}">${formatCurrency(item.currentPrice, currency)}</span>
          </div>
          <div class="reentry-detail">
            <span class="reentry-detail-label">Drop</span>
            <span class="reentry-detail-value ${item.priceDrop > 0 ? 'positive' : 'negative'}">${item.priceDrop > 0 ? '-' : '+'}${Math.abs(item.priceDrop).toFixed(1)}%</span>
          </div>
          <div class="reentry-detail">
            <span class="reentry-detail-label">Re-Entry Level</span>
            <span class="reentry-detail-value">${formatCurrency(item.reentryPrice, currency)}</span>
          </div>
          <div class="reentry-detail">
            <span class="reentry-detail-label">Sold Date</span>
            <span class="reentry-detail-value">${formatDate(item.lastSellDate)}</span>
          </div>
          <div class="reentry-detail">
            <span class="reentry-detail-label">Qty Sold</span>
            <span class="reentry-detail-value">${item.totalQty.toFixed(2)}</span>
          </div>
        </div>
        ${item.isOpportunity ? `
          <div style="margin-top:10px; padding:8px 12px; background:rgba(67,233,123,0.1); border-radius:8px; font-size:0.8rem; color:var(--positive);">
            ✅ Price has fallen ${item.priceDrop.toFixed(1)}% below your sell price. Consider re-entering!
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}