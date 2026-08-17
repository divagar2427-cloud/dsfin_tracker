// ===== DS WEALTH TRACKER - Enhanced Rebalancing Module =====

let rebalancingMarketFilter = 'all'; // 'all', 'indian', 'us'
let rebalancingEditMode = false;

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

  // Filter holdings by market
  let filteredHoldings = holdings;
  if (rebalancingMarketFilter === 'indian') {
    filteredHoldings = holdings.filter(h => h.market === 'indian');
  } else if (rebalancingMarketFilter === 'us') {
    // US = only US market, EXCLUDING RSU
    filteredHoldings = holdings.filter(h => h.market === 'us');
  } else if (rebalancingMarketFilter === 'rsu') {
    filteredHoldings = holdings.filter(h => h.market === 'rsu');
  }

  // Calculate total value for the FILTERED market only
  // Indian: total Indian holdings value in INR
  // US: total US holdings value (excluding RSU) in INR
  // All: total portfolio value in INR
  let totalValue = 0;
  const holdingMetrics = filteredHoldings.map(h => {
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

    if (h.pnlPct > rules.trimThreshold) {
      action = 'SELL';
      reason = `Gain of ${h.pnlPct.toFixed(1)}% exceeds ${rules.trimThreshold}% target. Consider trimming.`;
      sellCount++;
    } else if (allocation > rules.maxAllocation) {
      action = 'SELL';
      reason = `Allocation ${allocation.toFixed(1)}% exceeds max ${rules.maxAllocation}%. Reduce concentration risk.`;
      sellCount++;
    } else if (allocation < rules.minAllocation && allocation > 0) {
      action = 'BUY';
      reason = `Allocation ${allocation.toFixed(1)}% below min ${rules.minAllocation}%. Consider adding more.`;
      buyCount++;
    } else if (h.pnlPct < -20) {
      action = 'REVIEW';
      reason = `Loss of ${Math.abs(h.pnlPct).toFixed(1)}%. Review fundamentals before averaging down.`;
      holdCount++;
    } else {
      action = 'HOLD';
      reason = `Allocation ${allocation.toFixed(1)}% within target. Returns: ${h.pnlPct.toFixed(1)}%`;
      holdCount++;
    }

    recommendations.push({ ...h, action, reason, allocation });
  }

  recommendations.sort((a, b) => {
    const order = { SELL: 0, BUY: 1, REVIEW: 2, HOLD: 3 };
    return (order[a.action] || 3) - (order[b.action] || 3);
  });

  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (sellCount * 15) - (buyCount * 5) + (holdCount * 2))));

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

  // Render filter bar and recommendations
  const container = document.getElementById('rebalancing-recommendations');
  if (!container) return;

  const marketLabel = rebalancingMarketFilter === 'indian' ? '🇮🇳 Indian Portfolio' :
                      rebalancingMarketFilter === 'us' ? '🇺🇸 US Portfolio (excl. RSU)' :
                      rebalancingMarketFilter === 'rsu' ? '🏢 RSU Holdings' : '🌍 All Holdings';

  container.innerHTML = `
    <!-- Filter Bar -->
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
      <button onclick="setRebalancingFilter('all')" style="
        padding:8px 16px; border-radius:20px; font-size:0.8rem; font-weight:600; cursor:pointer;
        background:${rebalancingMarketFilter === 'all' ? 'var(--primary)' : 'var(--bg-input)'};
        color:${rebalancingMarketFilter === 'all' ? 'white' : 'var(--text-secondary)'};
        border:1px solid ${rebalancingMarketFilter === 'all' ? 'var(--primary)' : 'var(--border-color)'};
      ">🌍 All</button>
      <button onclick="setRebalancingFilter('indian')" style="
        padding:8px 16px; border-radius:20px; font-size:0.8rem; font-weight:600; cursor:pointer;
        background:${rebalancingMarketFilter === 'indian' ? 'var(--primary)' : 'var(--bg-input)'};
        color:${rebalancingMarketFilter === 'indian' ? 'white' : 'var(--text-secondary)'};
        border:1px solid ${rebalancingMarketFilter === 'indian' ? 'var(--primary)' : 'var(--border-color)'};
      ">🇮🇳 Indian</button>
      <button onclick="setRebalancingFilter('us')" style="
        padding:8px 16px; border-radius:20px; font-size:0.8rem; font-weight:600; cursor:pointer;
        background:${rebalancingMarketFilter === 'us' ? 'var(--primary)' : 'var(--bg-input)'};
        color:${rebalancingMarketFilter === 'us' ? 'white' : 'var(--text-secondary)'};
        border:1px solid ${rebalancingMarketFilter === 'us' ? 'var(--primary)' : 'var(--border-color)'};
      ">🇺🇸 US (excl. RSU)</button>
      <button onclick="setRebalancingFilter('rsu')" style="
        padding:8px 16px; border-radius:20px; font-size:0.8rem; font-weight:600; cursor:pointer;
        background:${rebalancingMarketFilter === 'rsu' ? 'var(--primary)' : 'var(--bg-input)'};
        color:${rebalancingMarketFilter === 'rsu' ? 'white' : 'var(--text-secondary)'};
        border:1px solid ${rebalancingMarketFilter === 'rsu' ? 'var(--primary)' : 'var(--border-color)'};
      ">🏢 RSU</button>
    </div>

    <!-- Market Info -->
    <div style="
      padding:10px 14px; border-radius:10px; background:var(--bg-input);
      font-size:0.82rem; color:var(--text-secondary); margin-bottom:12px;
    ">
      📊 ${marketLabel} · Total: ${formatCurrency(totalValue, 'INR', true)} · ${filteredHoldings.length} holdings
    </div>

    ${recommendations.length === 0 ? '<div class="empty-state">No holdings in this market.</div>' :
      recommendations.map(r => {
        const actionClass = r.action === 'BUY' ? 'buy' : r.action === 'SELL' ? 'sell' : 'hold';
        const actionIcon = r.action === 'BUY' ? '📈' : r.action === 'SELL' ? '📉' : r.action === 'REVIEW' ? '🔍' : '⏸️';
        const currency = r.market === 'indian' ? 'INR' : 'USD';
        return `
          <div class="recommendation-card">
            <div class="rec-signal ${actionClass}">${actionIcon}</div>
            <div class="rec-info">
              <div class="rec-symbol">${r.symbol}
                <span style="font-size:0.7rem;color:var(--text-muted);margin-left:6px;">${r.allocation.toFixed(1)}% of ${marketLabel}</span>
              </div>
              <div class="rec-reason">${r.reason}</div>
              <div style="font-size:0.75rem;margin-top:4px;color:var(--text-muted);">
                Value: ${formatCurrency(r.currentValue, currency)} · P&L: <span class="${getPnLClass(r.pnl)}">${formatPct(r.pnlPct)}</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
              <span class="rec-action ${actionClass}">${r.action}</span>
              <button onclick="editHoldingFromRebalancing(${r.id})" style="
                padding:4px 10px; border-radius:8px; font-size:0.72rem; font-weight:600;
                background:var(--bg-input); border:1px solid var(--border-color);
                color:var(--text-secondary); cursor:pointer;
              ">✏️ Edit</button>
            </div>
          </div>
        `;
      }).join('')
    }
  `;
}

// ===== SET REBALANCING FILTER =====
function setRebalancingFilter(market) {
  rebalancingMarketFilter = market;
  renderRebalancingPage();
}

// ===== EDIT HOLDING FROM REBALANCING =====
function editHoldingFromRebalancing(holdingId) {
  showAddHoldingModal(holdingId);
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