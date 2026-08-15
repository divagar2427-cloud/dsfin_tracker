// ===== DS WEALTH TRACKER - Market Data Module =====
// Fetches live prices for Indian stocks, US stocks, ETFs, and currency rates

let usdInrRate = 84.5; // Default fallback rate
let marketDataCache = {};
let lastRefreshTime = null;

// ===== SECTOR MAPPING =====
const SECTOR_MAP = {
  // Indian Stocks
  'HDFCBANK': 'Banking', 'ICICIBANK': 'Banking', 'SBIN': 'Banking', 'KOTAKBANK': 'Banking',
  'AXISBANK': 'Banking', 'IDFCFIRSTB': 'Banking', 'SOUTHBANK': 'Banking', 'YESBANK': 'Banking',
  'FEDERALBNK': 'Banking', 'INDUSINDBK': 'Banking', 'IDBI': 'Banking', 'KTKBANK': 'Banking',
  'UJJIVANSFB': 'Banking',
  'INFY': 'Technology', 'TCS': 'Technology', 'WIPRO': 'Technology', 'HCLTECH': 'Technology',
  'TECHM': 'Technology', 'KPITTECH': 'Technology', 'MPHASIS': 'Technology',
  'ITBEES': 'Technology', 'PACEDIGITK': 'Technology',
  'RELIANCE': 'Energy', 'NTPC': 'Energy', 'SJVN': 'Energy', 'IREDA': 'Energy',
  'WAAREEENER': 'Energy', 'IEX': 'Energy', 'PETRONET': 'Energy',
  'SUNPHARMA': 'Healthcare', 'DRREDDY': 'Healthcare', 'NATCOPHARM': 'Healthcare',
  'PHARMABEES': 'Healthcare', 'CIPLA': 'Healthcare', 'DIVISLAB': 'Healthcare',
  'TATASTEEL': 'Metals', 'NATIONALUM': 'Metals', 'HINDALCO': 'Metals', 'JSWSTEEL': 'Metals',
  'ITC': 'FMCG', 'HINDUNILVR': 'FMCG', 'NESTLEIND': 'FMCG', 'FMCGIETF': 'FMCG',
  'VARUNBEV': 'FMCG', 'VBL': 'FMCG',
  'TATAMOTORS': 'Auto', 'MARUTI': 'Auto', 'BAJAJ-AUTO': 'Auto', 'AUTOIETF': 'Auto',
  'TMCV': 'Auto', 'TMPV': 'Auto',
  'KALYANKJIL': 'Retail', 'MANAPPURAM': 'Finance', 'MUTHOOTFIN': 'Finance',
  'ICICIPRULI': 'Insurance', 'HDFCLIFE': 'Insurance', 'FIVESTAR': 'Finance',
  'NBCC': 'Infrastructure', 'TRANSRAILL': 'Infrastructure', 'LOTUSDEV': 'Realty',
  'STOVEKRAFT': 'Consumer', 'EPL': 'Consumer', 'SWISSMLTRY': 'Consumer',
  'AVANTIFEED': 'Consumer', 'CLEAN': 'Chemicals',
  'NIFTYBEES': 'ETF', 'GOLDBEES': 'ETF', 'BANKIETF': 'ETF', 'HDFCMID150': 'ETF',
  'CPSEETF': 'ETF', 'MNC': 'ETF', 'CONS': 'ETF', 'MAFANG': 'ETF', 'AUTOBEES': 'ETF',
  // US Stocks
  'NVDA': 'Technology', 'INTC': 'Technology', 'AMD': 'Technology', 'QCOM': 'Technology',
  'AVGO': 'Technology', 'TSM': 'Technology', 'ASML': 'Technology', 'MU': 'Technology',
  'SNDK': 'Technology', 'WDC': 'Technology', 'MRVL': 'Technology',
  'META': 'Technology', 'GOOGL': 'Technology', 'MSFT': 'Technology', 'AAPL': 'Technology',
  'NOW': 'Technology', 'DOCN': 'Technology', 'SKYY': 'Technology',
  'VOO': 'ETF', 'SMH': 'ETF', 'XLK': 'ETF', 'SOXX': 'ETF', 'QQQM': 'ETF',
  'EWY': 'ETF', 'EWJ': 'ETF', 'EWT': 'ETF', 'DRAM': 'ETF', 'USD': 'ETF',
  'NFLX': 'Entertainment', 'DAL': 'Airlines', 'M': 'Retail',
  'SPCX': 'Aerospace', 'ARM': 'Technology', 'TM': 'Auto'
};

// ===== FETCH USD/INR RATE =====
async function fetchUSDINRRate() {
  try {
    // Try multiple free APIs
    const apis = [
      'https://api.exchangerate-api.com/v4/latest/USD',
      'https://open.er-api.com/v6/latest/USD'
    ];

    for (const api of apis) {
      try {
        const response = await fetch(api, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const data = await response.json();
          const rate = data.rates?.INR || data.conversion_rates?.INR;
          if (rate) {
            usdInrRate = rate;
            await MarketPricesDB.set('USD_INR', { price: rate, currency: 'INR' });
            updateExchangeRateDisplay();
            return rate;
          }
        }
      } catch (e) { /* try next */ }
    }
  } catch (e) {
    console.log('Using cached/default USD/INR rate:', usdInrRate);
  }

  // Try cached rate
  const cached = await MarketPricesDB.get('USD_INR');
  if (cached) {
    usdInrRate = cached.price;
    updateExchangeRateDisplay();
  }
  return usdInrRate;
}

// ===== FETCH INDIAN STOCK PRICES =====
async function fetchIndianStockPrice(symbol) {
  // Use Yahoo Finance via a CORS proxy or direct API
  const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');

  try {
    // Try Yahoo Finance
    const yahooSymbol = `${cleanSymbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const meta = result.meta;
        const price = meta.regularMarketPrice || meta.previousClose;
        const prevClose = meta.previousClose || meta.chartPreviousClose;
        const change = price - prevClose;
        const changePct = (change / prevClose) * 100;

        return {
          price,
          prevClose,
          change,
          changePct,
          currency: 'INR',
          name: meta.longName || meta.shortName || symbol
        };
      }
    }
  } catch (e) {
    // Silently fail, use cached
  }

  // Return cached price if available
  const cached = await MarketPricesDB.get(symbol);
  if (cached && cached.price) return cached;

  return null;
}

// ===== FETCH US STOCK PRICE =====
async function fetchUSStockPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const meta = result.meta;
        const price = meta.regularMarketPrice || meta.previousClose;
        const prevClose = meta.previousClose || meta.chartPreviousClose;
        const change = price - prevClose;
        const changePct = (change / prevClose) * 100;

        return {
          price,
          prevClose,
          change,
          changePct,
          currency: 'USD',
          name: meta.longName || meta.shortName || symbol
        };
      }
    }
  } catch (e) {
    // Silently fail
  }

  const cached = await MarketPricesDB.get(symbol);
  if (cached && cached.price) return cached;

  return null;
}

// ===== BATCH FETCH PRICES =====
async function fetchPricesForHoldings(holdings) {
  const indianSymbols = holdings.filter(h => h.market === 'indian').map(h => h.symbol);
  const usSymbols = holdings.filter(h => h.market === 'us' || h.market === 'rsu').map(h => h.symbol);

  const results = {};

  // Fetch Indian prices (with rate limiting)
  for (const symbol of indianSymbols) {
    try {
      const price = await fetchIndianStockPrice(symbol);
      if (price) {
        results[symbol] = price;
        await MarketPricesDB.set(symbol, price);
      }
      await sleep(100); // Rate limiting
    } catch (e) { /* skip */ }
  }

  // Fetch US prices
  for (const symbol of usSymbols) {
    try {
      const price = await fetchUSStockPrice(symbol);
      if (price) {
        results[symbol] = price;
        await MarketPricesDB.set(symbol, price);
      }
      await sleep(100);
    } catch (e) { /* skip */ }
  }

  return results;
}

// ===== GET CACHED OR FETCH PRICE =====
async function getPrice(symbol, market) {
  // Check cache first
  const cached = await MarketPricesDB.get(symbol);
  const isStale = await MarketPricesDB.isStale(symbol, 15);

  if (cached && !isStale) {
    return cached;
  }

  // Fetch fresh price
  let price = null;
  if (market === 'indian') {
    price = await fetchIndianStockPrice(symbol);
  } else {
    price = await fetchUSStockPrice(symbol);
  }

  if (price) {
    await MarketPricesDB.set(symbol, price);
    return price;
  }

  return cached || { price: 0, change: 0, changePct: 0, currency: market === 'indian' ? 'INR' : 'USD' };
}

// ===== REFRESH ALL MARKET DATA =====
async function refreshMarketData() {
  if (!currentUser) return;

  const refreshBtn = document.querySelector('[onclick="refreshMarketData()"]');
  if (refreshBtn) {
    refreshBtn.style.animation = 'spin 1s linear infinite';
  }

  try {
    // Fetch USD/INR rate
    await fetchUSDINRRate();

    // Get all holdings
    const holdings = await HoldingsDB.getAll(currentUser.id);
    if (holdings.length === 0) {
      showToast('No holdings to refresh');
      return;
    }

    // Fetch prices for all holdings
    const prices = await fetchPricesForHoldings(holdings);
    marketDataCache = prices;
    lastRefreshTime = new Date();

    // Update portfolio display
    await renderPortfolioPage();
    await renderDashboard();

    showToast(`Market data updated ✓`);
  } catch (e) {
    console.error('Market refresh error:', e);
    showToast('Market data refresh failed', 'error');
  } finally {
    if (refreshBtn) {
      refreshBtn.style.animation = '';
    }
  }
}

// ===== UPDATE EXCHANGE RATE DISPLAY =====
function updateExchangeRateDisplay() {
  const rateEl = document.getElementById('usd-inr-rate');
  if (rateEl) {
    rateEl.textContent = `₹${usdInrRate.toFixed(2)}`;
  }
}

// ===== GET SECTOR FOR SYMBOL =====
function getSectorForSymbol(symbol) {
  return SECTOR_MAP[symbol.toUpperCase()] || 'Other';
}

// ===== CALCULATE PORTFOLIO METRICS =====
function calculateHoldingMetrics(holding, priceData) {
  const qty = parseFloat(holding.quantity) || 0;
  const avgPrice = parseFloat(holding.avgPrice) || 0;
  const currentPrice = priceData?.price || avgPrice;
  const currency = holding.market === 'indian' ? 'INR' : 'USD';

  const investedAmount = qty * avgPrice;
  const currentValue = qty * currentPrice;
  const pnl = currentValue - investedAmount;
  const pnlPct = investedAmount > 0 ? (pnl / investedAmount) * 100 : 0;
  const todayChange = priceData?.change || 0;
  const todayChangePct = priceData?.changePct || 0;
  const todayGainLoss = qty * todayChange;

  // Convert to INR if USD
  const multiplier = currency === 'USD' ? usdInrRate : 1;

  return {
    qty,
    avgPrice,
    currentPrice,
    investedAmount,
    currentValue,
    pnl,
    pnlPct,
    todayChange,
    todayChangePct,
    todayGainLoss,
    currency,
    investedINR: investedAmount * multiplier,
    currentValueINR: currentValue * multiplier,
    pnlINR: pnl * multiplier,
    todayGainLossINR: todayGainLoss * multiplier
  };
}

// ===== CALCULATE PORTFOLIO TOTALS =====
async function calculatePortfolioTotals(userId) {
  const holdings = await HoldingsDB.getAll(userId);
  const prices = await MarketPricesDB.getAll();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });

  let totalInvestedINR = 0;
  let totalCurrentINR = 0;
  let totalTodayGainINR = 0;
  let indianInvested = 0, indianCurrent = 0;
  let usInvested = 0, usCurrent = 0;
  let rsuInvested = 0, rsuCurrent = 0;

  for (const holding of holdings) {
    const priceData = priceMap[holding.symbol];
    const metrics = calculateHoldingMetrics(holding, priceData);

    totalInvestedINR += metrics.investedINR;
    totalCurrentINR += metrics.currentValueINR;
    totalTodayGainINR += metrics.todayGainLossINR;

    if (holding.market === 'indian') {
      indianInvested += metrics.investedAmount;
      indianCurrent += metrics.currentValue;
    } else if (holding.market === 'rsu') {
      rsuInvested += metrics.investedAmount;
      rsuCurrent += metrics.currentValue;
    } else {
      usInvested += metrics.investedAmount;
      usCurrent += metrics.currentValue;
    }
  }

  const totalPnlINR = totalCurrentINR - totalInvestedINR;
  const totalReturns = totalInvestedINR > 0 ? (totalPnlINR / totalInvestedINR) * 100 : 0;

  return {
    totalInvestedINR,
    totalCurrentINR,
    totalPnlINR,
    totalReturns,
    totalTodayGainINR,
    indianInvested,
    indianCurrent,
    usInvested,
    usCurrent,
    rsuInvested,
    rsuCurrent,
    usCurrentINR: usCurrent * usdInrRate,
    rsuCurrentINR: rsuCurrent * usdInrRate,
    holdings
  };
}

// ===== CALCULATE REALIZED P&L =====
async function calculateRealizedPnL(userId) {
  const trades = await TradesDB.getAll(userId);
  const sellTrades = trades.filter(t => t.type === 'SELL');

  let totalRealizedPnL = 0;
  let totalRealizedPnLINR = 0;

  for (const sell of sellTrades) {
    const buyTrades = trades.filter(t =>
      t.symbol === sell.symbol &&
      t.type === 'BUY' &&
      new Date(t.date) <= new Date(sell.date)
    );

    if (buyTrades.length > 0) {
      const avgBuyPrice = buyTrades.reduce((sum, t) => sum + (t.price * t.quantity), 0) /
                          buyTrades.reduce((sum, t) => sum + t.quantity, 0);
      const pnl = (sell.price - avgBuyPrice) * sell.quantity;
      const multiplier = sell.market === 'us' || sell.market === 'rsu' ? usdInrRate : 1;
      totalRealizedPnL += pnl;
      totalRealizedPnLINR += pnl * multiplier;
    }
  }

  return { totalRealizedPnL, totalRealizedPnLINR };
}

// ===== CALCULATE XIRR =====
function calculateXIRR(cashflows) {
  // Simple XIRR approximation
  if (!cashflows || cashflows.length < 2) return 0;

  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dnpv = 0;
    const t0 = new Date(cashflows[0].date).getTime();

    for (const cf of cashflows) {
      const t = new Date(cf.date).getTime();
      const years = (t - t0) / (365.25 * 24 * 3600 * 1000);
      npv += cf.amount / Math.pow(1 + rate, years);
      dnpv -= years * cf.amount / Math.pow(1 + rate, years + 1);
    }

    if (Math.abs(npv) < 0.01) break;
    if (dnpv === 0) break;
    rate = rate - npv / dnpv;
    if (rate < -0.99) rate = -0.99;
  }

  return rate * 100;
}

// ===== CALCULATE CAGR =====
function calculateCAGR(initialValue, finalValue, years) {
  if (initialValue <= 0 || years <= 0) return 0;
  return (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
}

// ===== UTILITY =====
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCurrency(amount, currency = 'INR', compact = false) {
  if (isNaN(amount)) return currency === 'INR' ? '₹0' : '$0';

  if (compact) {
    if (Math.abs(amount) >= 10000000) return `${currency === 'INR' ? '₹' : '$'}${(amount / 10000000).toFixed(2)}Cr`;
    if (Math.abs(amount) >= 100000) return `${currency === 'INR' ? '₹' : '$'}${(amount / 100000).toFixed(2)}L`;
    if (Math.abs(amount) >= 1000) return `${currency === 'INR' ? '₹' : '$'}${(amount / 1000).toFixed(1)}K`;
  }

  const symbol = currency === 'INR' ? '₹' : '$';
  return `${symbol}${Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatPct(value) {
  if (isNaN(value)) return '0.00%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatPnL(amount, currency = 'INR') {
  const sign = amount >= 0 ? '+' : '-';
  return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
}

function getPnLClass(value) {
  return value >= 0 ? 'positive' : 'negative';
}

// Show notifications
function showNotifications() {
  showToast('No new notifications');
}