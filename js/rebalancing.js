// ===== DS WEALTH TRACKER - Rebalancing Module =====

// ===== RENDER REBALANCING PAGE =====
async function renderRebalancingPage() {
  if (!currentUser) return;
  const holdings = await HoldingsDB.getAll(currentUser.id);
  if (holdings.length === 0) {
    document.getElementById('rebalancing-recommendations').innerHTML =
      '<div class="empty-state">No portfolio data. Upload holdings to get rebalancing recommendations.</div>';
    return;
  }

  const prices = await MarketPricesDB.getAll();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });

  const rules = currentUser.settings?.rebalancingRules || { trimThreshold: 30, minAllocation: 2, maxAllocation: 15 };

  // Calculate total portfolio value
  let totalValue = 0;
  const holdingMetrics = holdings.map(h => {
    const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
    totalValue += m.currentValueINR;
    return { ...h, ...m };
  });

  // Generate recommendations
  const recommendations = [];
  let buyCount = 0, sellCount = 0, holdCount = 0;

  for (const h of holdingMetrics) {
    const allocation = totalValue > 0 ? (h.currentValueINR / totalValue) * 100 : 0;
    let action = 'HOLD';
    let reason = '';
    let priority = 'low';

    // Check gain threshold (trim if gain > threshold)
    if (h.pnlPct > rules.trimThreshold) {
      action = 'SELL';
      reason = `Gain of ${h.pnlPct.toFixed(1)}% exceeds ${rules.trimThreshold}% target. Consider trimming.`;
      priority = 'high';
      sellCount++;
    }
    // Check max allocation (reduce concentration risk)
    else if (allocation > rules.maxAllocation) {
      action = 'SELL';
      reason = `Allocation ${allocation.toFixed(1)}% exceeds max ${rules.maxAllocation}%. Reduce concentration risk.`;
      priority = 'medium';
      sellCount++;
    }
    // Check min allocation (add more)
    else if (allocation < rules.minAllocation && allocation > 0) {
      action = 'BUY';
      reason = `Allocation ${allocation.toFixed(1)}% below min ${rules.minAllocation}%. Consider adding more.`;
      priority = 'low';
      buyCount++;
    }
    // Negative returns - consider reviewing
    else if (h.pnlPct < -20) {
      action = 'REVIEW';
      reason = `Loss of ${Math.abs(h.pnlPct).toFixed(1)}%. Review fundamentals before averaging down.`;
      priority = 'medium';
      holdCount++;
    }
    else {
      action = 'HOLD';
      reason = `Allocation ${allocation.toFixed(1)}% is within target range. Returns: ${h.pnlPct.toFixed(1)}%`;
      holdCount++;
    }

    recommendations.push({ ...h, action, reason, allocation, priority });
  }

  // Sort: SELL first, then BUY, then HOLD
  recommendations.sort((a, b) => {
    const order = { SELL: 0, BUY: 1, REVIEW: 2, HOLD: 3 };
    return (order[a.action] || 3) - (order[b.action] || 3);
  });

  // Calculate health score
  const healthScore = Math.max(0, Math.min(100, Math.round(
    100 - (sellCount * 15) - (buyCount * 5) + (holdCount * 2)
  )));

  // Update summary
  const scoreEl = document.getElementById('rebalancing-score');
  const scoreCircle = document.getElementById('rebalancing-score-circle');
  if (scoreEl) scoreEl.textContent = healthScore;
  if (scoreCircle) {
    const color = healthScore >= 70 ? '#43E97B' : healthScore >= 40 ? '#FA8231' : '#FF6584';
    scoreCircle.style.background = `linear-gradient(135deg, ${color}, ${color}88)`;
  }

  setText('buy-signals', buyCount);
  setText('sell-signals', sellCount);
  setText('hold-signals', holdCount);

  // Render recommendations
  const container = document.getElementById('rebalancing-recommendations');
  if (!container) return;

  container.innerHTML = recommendations.map(r => {
    const actionClass = r.action === 'BUY' ? 'buy' : r.action === 'SELL' ? 'sell' : 'hold';
    const actionIcon = r.action === 'BUY' ? '📈' : r.action === 'SELL' ? '📉' : r.action === 'REVIEW' ? '🔍' : '⏸️';
    const currency = r.market === 'indian' ? 'INR' : 'USD';

    return `
      <div class="recommendation-card">
        <div class="rec-signal ${actionClass}">${actionIcon}</div>
        <div class="rec-info">
          <div class="rec-symbol">${r.symbol} <span style="font-size:0.7rem;color:var(--text-muted);">${r.allocation.toFixed(1)}% allocation</span></div>
          <div class="rec-reason">${r.reason}</div>
          <div style="font-size:0.75rem; margin-top:4px; color:var(--text-muted);">
            Value: ${formatCurrency(r.currentValue, currency)} · P&L: <span class="${getPnLClass(r.pnl)}">${formatPct(r.pnlPct)}</span>
          </div>
        </div>
        <span class="rec-action ${actionClass}">${r.action}</span>
      </div>
    `;
  }).join('');
}

// ===== SHOW REBALANCING SETTINGS =====
function showRebalancingSettings() {
  navigateTo('settings');
  showToast('Adjust rebalancing rules in Settings');
}

// ===== UPDATE REENTRY THRESHOLD =====
function updateReentryThreshold(value) {
  const display = document.getElementById('reentry-threshold-display');
  if (display) display.textContent = value + '%';
  if (currentUser) {
    UserDB.updateSettings(currentUser.id, { reentryThreshold: parseInt(value) });
    currentUser.settings.reentryThreshold = parseInt(value);
  }
}

// ===== SHOW REENTRY SETTINGS =====
function showReentrySettings() {
  showToast('Adjust the threshold slider above');
}