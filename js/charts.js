// ===== DS WEALTH TRACKER - Charts Module =====

let dashboardCharts = {};

// Chart.js default config
const CHART_COLORS = ['#6C63FF', '#FF6584', '#43E97B', '#38F9D7', '#FA8231', '#FED330', '#A29BFE', '#FD79A8', '#00B894', '#0984E3', '#E17055', '#74B9FF'];

function getChartDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    textColor: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.65)',
    gridColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    bgColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)'
  };
}

// ===== RENDER DASHBOARD CHARTS =====
async function renderDashboardCharts(holdings, priceMap) {
  renderAssetAllocationChart(holdings, priceMap);
  renderMarketAllocationChart(holdings, priceMap);
  renderSectorChart(holdings, priceMap);
  await renderPortfolioGrowthChart();
}

// ===== ASSET ALLOCATION CHART =====
function renderAssetAllocationChart(holdings, priceMap) {
  const canvas = document.getElementById('asset-allocation-chart');
  if (!canvas) return;

  if (dashboardCharts.assetAllocation) dashboardCharts.assetAllocation.destroy();

  // Group by type
  const typeMap = {};
  holdings.forEach(h => {
    const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
    const type = h.type === 'etf' ? 'ETF' : h.type === 'mf' ? 'Mutual Fund' : 'Stock';
    typeMap[type] = (typeMap[type] || 0) + m.currentValueINR;
  });

  const labels = Object.keys(typeMap);
  const data = Object.values(typeMap);
  const { textColor } = getChartDefaults();

  dashboardCharts.assetAllocation = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { size: 10 }, boxWidth: 10, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw, 'INR', true)}`
          }
        }
      }
    }
  });
}

// ===== MARKET ALLOCATION CHART =====
function renderMarketAllocationChart(holdings, priceMap) {
  const canvas = document.getElementById('market-allocation-chart');
  if (!canvas) return;

  if (dashboardCharts.marketAllocation) dashboardCharts.marketAllocation.destroy();

  const marketMap = { 'Indian': 0, 'US': 0, 'RSU': 0 };
  holdings.forEach(h => {
    const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
    if (h.market === 'indian') marketMap['Indian'] += m.currentValueINR;
    else if (h.market === 'rsu') marketMap['RSU'] += m.currentValueINR;
    else marketMap['US'] += m.currentValueINR;
  });

  const labels = Object.keys(marketMap).filter(k => marketMap[k] > 0);
  const data = labels.map(k => marketMap[k]);
  const { textColor } = getChartDefaults();

  dashboardCharts.marketAllocation = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#6C63FF', '#43E97B', '#FF6584'],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { size: 10 }, boxWidth: 10, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw, 'INR', true)}`
          }
        }
      }
    }
  });
}

// ===== SECTOR ALLOCATION CHART =====
function renderSectorChart(holdings, priceMap) {
  const canvas = document.getElementById('sector-chart');
  if (!canvas) return;

  if (dashboardCharts.sector) dashboardCharts.sector.destroy();

  // Group by sector
  const sectorMap = {};
  holdings.forEach(h => {
    const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
    const sector = h.sector || getSectorForSymbol(h.symbol) || 'Other';
    sectorMap[sector] = (sectorMap[sector] || 0) + m.currentValueINR;
  });

  // Sort by value
  const sorted = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k);
  const data = sorted.map(([, v]) => v);
  const total = data.reduce((s, v) => s + v, 0);
  const { textColor, gridColor } = getChartDefaults();

  dashboardCharts.sector = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.raw, 'INR', true)} (${total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0}%)`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 10 },
            callback: (v) => formatCurrency(v, 'INR', true)
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 10 } }
        }
      }
    }
  });
}

// ===== PORTFOLIO GROWTH CHART =====
async function renderPortfolioGrowthChart() {
  const canvas = document.getElementById('portfolio-growth-chart');
  if (!canvas || !currentUser) return;

  if (dashboardCharts.growth) dashboardCharts.growth.destroy();

  const history = await PortfolioHistoryDB.getRecent(currentUser.id, 90);
  const { textColor, gridColor } = getChartDefaults();

  if (history.length < 2) {
    // Show placeholder with current value
    const totals = await calculatePortfolioTotals(currentUser.id);
    const today = new Date().toISOString().split('T')[0];

    dashboardCharts.growth = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [today],
        datasets: [{
          label: 'Portfolio Value',
          data: [totals.totalCurrentINR],
          borderColor: '#6C63FF',
          backgroundColor: 'rgba(108,99,255,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${formatCurrency(ctx.raw, 'INR', true)}`
            }
          }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 10 },
              callback: (v) => formatCurrency(v, 'INR', true)
            }
          }
        }
      }
    });
    return;
  }

  const labels = history.map(h => h.date);
  const data = history.map(h => h.totalValue);

  dashboardCharts.growth = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Portfolio Value',
        data,
        borderColor: '#6C63FF',
        backgroundColor: 'rgba(108,99,255,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.raw, 'INR', true)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 6 }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 10 },
            callback: (v) => formatCurrency(v, 'INR', true)
          }
        }
      }
    }
  });
}

// ===== RENDER TOP HOLDINGS =====
async function renderTopHoldings(holdings, priceMap) {
  const container = document.getElementById('top-holdings-list');
  if (!container) return;

  if (holdings.length === 0) {
    container.innerHTML = '<div class="empty-state">No holdings yet. Upload your portfolio to get started.</div>';
    return;
  }

  // Calculate values and sort
  const withValues = holdings.map(h => {
    const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
    return { ...h, ...m };
  }).sort((a, b) => b.currentValueINR - a.currentValueINR);

  const top10 = withValues.slice(0, 10);
  const totalValue = withValues.reduce((s, h) => s + h.currentValueINR, 0);

  container.innerHTML = top10.map((h, i) => {
    const allocation = totalValue > 0 ? (h.currentValueINR / totalValue) * 100 : 0;
    const currency = h.market === 'indian' ? 'INR' : 'USD';

    return `
      <div class="top-holding-item">
        <div class="top-holding-rank">${i + 1}</div>
        <div class="top-holding-info">
          <div class="top-holding-name">${h.symbol}</div>
          <div class="top-holding-allocation">${allocation.toFixed(1)}% · ${h.sector || 'Other'}</div>
        </div>
        <div class="top-holding-value">
          <div class="top-holding-amount">${formatCurrency(h.currentValue, currency)}</div>
          <div class="top-holding-pnl ${getPnLClass(h.pnl)}">${formatPct(h.pnlPct)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== DESTROY ALL CHARTS =====
function destroyAllCharts() {
  Object.values(dashboardCharts).forEach(chart => {
    if (chart) chart.destroy();
  });
  dashboardCharts = {};
}

// ===== SAVE PORTFOLIO SNAPSHOT =====
async function savePortfolioSnapshot(totalValue) {
  if (!currentUser) return;
  const today = new Date().toISOString().split('T')[0];
  const history = await PortfolioHistoryDB.getAll(currentUser.id);
  const todayEntry = history.find(h => h.date === today);

  if (!todayEntry) {
    await PortfolioHistoryDB.add(currentUser.id, {
      date: today,
      totalValue
    });
  }
}