// ===== DS WEALTH TRACKER - Enhanced Market Data Module =====

let usdInrRate = 84.5;
let marketDataCache = {};
let lastRefreshTime = null;
let isRefreshing = false;

// ===== SECTOR MAPPING =====
const SECTOR_MAP = {
  'HDFCBANK': 'Banking', 'ICICIBANK': 'Banking', 'SBIN': 'Banking', 'KOTAKBANK': 'Banking',
  'AXISBANK': 'Banking', 'IDFCFIRSTB': 'Banking', 'SOUTHBANK': 'Banking', 'YESBANK': 'Banking',
  'FEDERALBNK': 'Banking', 'INDUSINDBK': 'Banking', 'IDBI': 'Banking', 'KTKBANK': 'Banking',
  'UJJIVANSFB': 'Banking',
  'INFY': 'Technology', 'TCS': 'Technology', 'WIPRO': 'Technology', 'HCLTECH': 'Technology',
  'TECHM': 'Technology', 'KPITTECH': 'Technology', 'ITBEES': 'Technology', 'PACEDIGITK': 'Technology',
  'RELIANCE': 'Energy', 'NTPC': 'Energy', 'SJVN': 'Energy', 'IREDA': 'Energy',
  'WAAREEENER': 'Energy', 'IEX': 'Energy', 'PETRONET': 'Energy',
  'SUNPHARMA': 'Healthcare', 'DRREDDY': 'Healthcare', 'NATCOPHARM': 'Healthcare',
  'PHARMABEES': 'Healthcare', 'CIPLA': 'Healthcare',
  'TATASTEEL': 'Metals', 'NATIONALUM': 'Metals', 'HINDALCO': 'Metals',
  'ITC': 'FMCG', 'HINDUNILVR': 'FMCG', 'FMCGIETF': 'FMCG', 'VBL': 'FMCG',
  'TATAMOTORS': 'Auto', 'MARUTI': 'Auto', 'AUTOIETF': 'Auto', 'TMCV': 'Auto', 'TMPV': 'Auto',
  'KALYANKJIL': 'Retail', 'MANAPPURAM': 'Finance', 'MUTHOOTFIN': 'Finance',
  'ICICIPRULI': 'Insurance', 'HDFCLIFE': 'Insurance', 'FIVESTAR': 'Finance',
  'NBCC': 'Infrastructure', 'TRANSRAILL': 'Infrastructure',
  'STOVEKRAFT': 'Consumer', 'EPL': 'Consumer', 'SWISSMLTRY': 'Consumer',
  'NIFTYBEES': 'ETF', 'GOLDBEES': 'ETF', 'BANKIETF': 'ETF', 'HDFCMID150': 'ETF',
  'CPSEETF': 'ETF', 'MNC': 'ETF', 'CONS': 'ETF', 'MAFANG': 'ETF',
  'NVDA': 'Technology', 'INTC': 'Technology', 'AMD': 'Technology', 'QCOM': 'Technology',
  'AVGO': 'Technology', 'TSM': 'Technology', 'ASML': 'Technology', 'MU': 'Technology',
  'META': 'Technology', 'GOOGL': 'Technology', 'MSFT': 'Technology', 'AAPL': 'Technology',
  'NOW': 'Technology', 'DOCN': 'Technology',
  'VOO': 'ETF', 'SMH': 'ETF', 'XLK': 'ETF', 'SOXX': 'ETF', 'QQQM': 'ETF',
  'EWY': 'ETF', 'EWJ': 'ETF', 'EWT': 'ETF', 'DRAM': 'ETF', 'SKYY': 'ETF',
  'NFLX': 'Entertainment', 'DAL': 'Airlines', 'M': 'Retail',
  'SPCX': 'Aerospace', 'ARM': 'Technology', 'TM': 'Auto'
};

// ===== FETCH WITH TIMEOUT =====
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ===== FETCH USD/INR RATE =====
async function fetchUSDINRRate() {
  const apis = [
    'https://api.exchangerate-api.com/v4/latest/USD',
    'https://open.er-api.com/v6/latest/USD',
    'https://api.fxratesapi.com/latest?base=USD&currencies=INR'
  ];

  for (const api of apis) {
    try {
      const response = await fetchWithTimeout(api, {}, 5000);
      if (response.ok) {
        const data = await response.json();
        const rate = data.rates?.INR || data.conversion_rates?.INR;
        if (rate && rate > 50 && rate < 200) {
          usdInrRate = rate;
          await MarketPricesDB.set('USD_INR', { price: rate, currency: 'INR', updatedAt: new Date().toISOString() });
          updateExchangeRateDisplay();
          console.log('USD/INR rate fetched:', rate);
          return rate;
        }
      }
    } catch (e) { /* try next */ }
  }

  // Try cached rate
  try {
    const cached = await MarketPricesDB.get('USD_INR');
    if (cached && cached.price) {
      usdInrRate = cached.price;
      updateExchangeRateDisplay();
      return usdInrRate;
    }
  } catch (e) {}

  updateExchangeRateDisplay();
  return usdInrRate;
}

// ===== FETCH STOCK PRICE VIA YAHOO FINANCE =====
async function fetchYahooPrice(symbol) {
  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
  ];

  for (const url of endpoints) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
      }, 8000);

      if (response.ok) {
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        if (result) {
          const meta = result.meta;
          const price = meta.regularMarketPrice || meta.previousClose;
          const prevClose = meta.previousClose || meta.chartPreviousClose || price;
          if (price && price > 0) {
            const change = price - prevClose;
            const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
            return {
              price,
              prevClose,
              change,
              changePct,
              currency: meta.currency || 'USD',
              name: meta.longName || meta.shortName || symbol,
              updatedAt: new Date().toISOString()
            };
          }
        }
      }
    } catch (e) { /* try next endpoint */ }
  }
  return null;
}

// ===== FETCH INDIAN STOCK PRICE =====
async function fetchIndianStockPrice(symbol) {
  const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');

  // Try NSE first, then BSE
  const suffixes = ['.NS', '.BO'];
  for (const suffix of suffixes) {
    const result = await fetchYahooPrice(cleanSymbol + suffix);
    if (result) {
      result.currency = 'INR';
      return result;
    }
  }

  // Try without suffix
  const result = await fetchYahooPrice(cleanSymbol);
  if (result) return result;

  return null;
}

// ===== FETCH US STOCK PRICE =====
async function fetchUSStockPrice(symbol) {
  return await fetchYahooPrice(symbol);
}

// ===== FETCH GOLD/SILVER PRICE =====
async function fetchCommodityPrice(type) {
  const symbolMap = { gold: 'GC=F', silver: 'SI=F', crude: 'CL=F' };
  const symbol = symbolMap[type.toLowerCase()];
  if (!symbol) return null;
  return await fetchYahooPrice(symbol);
}

// ===== FETCH CRYPTO PRICE =====
async function fetchCryptoPrice(symbol) {
  const cryptoSymbol = symbol.toUpperCase() + '-USD';
  return await fetchYahooPrice(cryptoSymbol);
}

// ===== BATCH FETCH PRICES =====
async function fetchPricesForHoldings(holdings) {
  const results = {};
  const errors = [];

  // Group by market
  const indianHoldings = holdings.filter(h => h.market === 'indian');
  const usHoldings = holdings.filter(h => h.market === 'us' || h.market === 'rsu');

  // Fetch Indian prices
  for (const h of indianHoldings) {
    try {
      const price = await fetchIndianStockPrice(h.symbol);
      if (price) {
        results[h.symbol] = price;
        await MarketPricesDB.set(h.symbol, price);
      } else {
        errors.push(h.symbol);
      }
      await sleep(150); // Rate limiting
    } catch (e) {
      errors.push(h.symbol);
    }
  }

  // Fetch US prices
  for (const h of usHoldings) {
    try {
      const price = await fetchUSStockPrice(h.symbol);
      if (price) {
        results[h.symbol] = price;
        await MarketPricesDB.set(h.symbol, price);
      } else {
        errors.push(h.symbol);
      }
      await sleep(150);
    } catch (e) {
      errors.push(h.symbol);
    }
  }

  if (errors.length > 0) {
    console.log('Failed to fetch prices for:', errors.join(', '));
  }

  return results;
}

// ===== GET CACHED OR FETCH PRICE =====
async function getPrice(symbol, market) {
  try {
    const cached = await MarketPricesDB.get(symbol);
    const isStale = !cached || (Date.now() - new Date(cached.updatedAt || 0).getTime()) > 15 * 60 * 1000;

    if (cached && !isStale) return cached;

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
  } catch (e) {
    return { price: 0, change: 0, changePct: 0, currency: market === 'indian' ? 'INR' : 'USD' };
  }
}

// ===== REFRESH ALL MARKET DATA =====
async function refreshMarketData() {
  if (!currentUser || isRefreshing) return;
  isRefreshing = true;

  const refreshBtn = document.querySelector('[onclick="refreshMarketData()"]');
  if (refreshBtn) refreshBtn.style.animation = 'spin 1s linear infinite';

  try {
    showToast('Fetching live prices...');

    // Fetch USD/INR rate
    await fetchUSDINRRate();

    // Get all holdings
    const holdings = await HoldingsDB.getAll(currentUser.id);
    if (holdings.length === 0) {
      showToast('No holdings to refresh');
      return;
    }

    // Fetch prices
    const prices = await fetchPricesForHoldings(holdings);
    marketDataCache = prices;
    lastRefreshTime = new Date();

    const successCount = Object.keys(prices).length;
    const totalCount = holdings.length;

    // Update displays
    await renderPortfolioPage();
    await renderDashboard();

    showToast(`Updated ${successCount}/${totalCount} prices ✓`);
    updateLastRefreshTime();

  } catch (e) {
    console.error('Market refresh error:', e);
    showToast('Price refresh failed. Using cached data.', 'error');
  } finally {
    isRefreshing = false;
    if (refreshBtn) refreshBtn.style.animation = '';
  }
}

// ===== UPDATE LAST REFRESH TIME =====
function updateLastRefreshTime() {
  const el = document.getElementById('last-refresh-time');
  if (el && lastRefreshTime) {
    el.textContent = 'Updated: ' + lastRefreshTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
}

// ===== UPDATE EXCHANGE RATE DISPLAY =====
function updateExchangeRateDisplay() {
  const rateEl = document.getElementById('usd-inr-rate');
  if (rateEl) rateEl.textContent = '₹' + usdInrRate.toFixed(2);
}

// ===== GET SECTOR FOR SYMBOL =====
function getSectorForSymbol(symbol) {
  return SECTOR_MAP[symbol ? symbol.toUpperCase() : ''] || 'Other';
}

// ===== CALCULATE HOLDING METRICS =====
function calculateHoldingMetrics(holding, priceData) {
  const qty = parseFloat(holding.quantity) || 0;
  const avgPrice = parseFloat(holding.avgPrice) || 0;
  const currentPrice = (priceData && priceData.price > 0) ? priceData.price : avgPrice;
  const currency = holding.market === 'indian' ? 'INR' : 'USD';

  const investedAmount = qty * avgPrice;
  const currentValue = qty * currentPrice;
  const pnl = currentValue - investedAmount;
  const pnlPct = investedAmount > 0 ? (pnl / investedAmount) * 100 : 0;
  const todayChange = (priceData && priceData.change) ? priceData.change : 0;
  const todayChangePct = (priceData && priceData.changePct) ? priceData.changePct : 0;
  const todayGainLoss = qty * todayChange;
  const multiplier = currency === 'USD' ? usdInrRate : 1;

  return {
    qty, avgPrice, currentPrice, investedAmount, currentValue, pnl, pnlPct,
    todayChange, todayChangePct, todayGainLoss, currency,
    investedINR: investedAmount * multiplier,
    currentValueINR: currentValue * multiplier,
    pnlINR: pnl * multiplier,
    todayGainLossINR: todayGainLoss * multiplier,
    hasPriceData: priceData && priceData.price > 0
  };
}

// ===== CALCULATE PORTFOLIO TOTALS =====
async function calculatePortfolioTotals(userId) {
  const holdings = await HoldingsDB.getAll(userId);
  const prices = await MarketPricesDB.getAll();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });

  let totalInvestedINR = 0, totalCurrentINR = 0, totalTodayGainINR = 0;
  let indianInvested = 0, indianCurrent = 0;
  let usInvested = 0, usCurrent = 0;
  let rsuInvested = 0, rsuCurrent = 0;

  for (const holding of holdings) {
    const m = calculateHoldingMetrics(holding, priceMap[holding.symbol]);
    totalInvestedINR += m.investedINR;
    totalCurrentINR += m.currentValueINR;
    totalTodayGainINR += m.todayGainLossINR;

    if (holding.market === 'indian') {
      indianInvested += m.investedAmount;
      indianCurrent += m.currentValue;
    } else if (holding.market === 'rsu') {
      rsuInvested += m.investedAmount;
      rsuCurrent += m.currentValue;
    } else {
      usInvested += m.investedAmount;
      usCurrent += m.currentValue;
    }
  }

  const totalPnlINR = totalCurrentINR - totalInvestedINR;
  const totalReturns = totalInvestedINR > 0 ? (totalPnlINR / totalInvestedINR) * 100 : 0;

  return {
    totalInvestedINR, totalCurrentINR, totalPnlINR, totalReturns, totalTodayGainINR,
    indianInvested, indianCurrent, usInvested, usCurrent, rsuInvested, rsuCurrent,
    usCurrentINR: usCurrent * usdInrRate, rsuCurrentINR: rsuCurrent * usdInrRate, holdings
  };
}

// ===== CALCULATE REALIZED P&L =====
async function calculateRealizedPnL(userId) {
  try {
    const trades = await TradesDB.getAll(userId);
    const sellTrades = trades.filter(t => t.type === 'SELL');
    let totalRealizedPnLINR = 0;

    for (const sell of sellTrades) {
      const buyTrades = trades.filter(t =>
        t.symbol === sell.symbol && t.type === 'BUY' && new Date(t.date) <= new Date(sell.date)
      );
      if (buyTrades.length > 0) {
        const totalBuyQty = buyTrades.reduce((s, t) => s + t.quantity, 0);
        const avgBuyPrice = totalBuyQty > 0 ?
          buyTrades.reduce((s, t) => s + t.price * t.quantity, 0) / totalBuyQty : 0;
        const pnl = (sell.price - avgBuyPrice) * sell.quantity;
        const multiplier = (sell.market === 'us' || sell.market === 'rsu') ? usdInrRate : 1;
        totalRealizedPnLINR += pnl * multiplier;
      }
    }
    return { totalRealizedPnLINR };
  } catch (e) {
    return { totalRealizedPnLINR: 0 };
  }
}

// ===== CALCULATE XIRR =====
function calculateXIRR(cashflows) {
  if (!cashflows || cashflows.length < 2) return 0;
  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0, dnpv = 0;
    const t0 = new Date(cashflows[0].date).getTime();
    for (const cf of cashflows) {
      const years = (new Date(cf.date).getTime() - t0) / (365.25 * 24 * 3600 * 1000);
      npv += cf.amount / Math.pow(1 + rate, years);
      dnpv -= years * cf.amount / Math.pow(1 + rate, years + 1);
    }
    if (Math.abs(npv) < 0.01 || dnpv === 0) break;
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

// ===== UTILITY FUNCTIONS =====
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function formatCurrency(amount, currency = 'INR', compact = false) {
  if (isNaN(amount) || amount === null || amount === undefined) return currency === 'INR' ? '₹0' : '$0';
  const abs = Math.abs(amount);
  const symbol = currency === 'INR' ? '₹' : '$';
  if (compact) {
    if (abs >= 10000000) return symbol + (amount / 10000000).toFixed(2) + 'Cr';
    if (abs >= 100000) return symbol + (amount / 100000).toFixed(2) + 'L';
    if (abs >= 1000) return symbol + (amount / 1000).toFixed(1) + 'K';
  }
  return symbol + abs.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatPct(value) {
  if (isNaN(value)) return '0.00%';
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(2) + '%';
}

function formatPnL(amount, currency = 'INR') {
  const sign = amount >= 0 ? '+' : '-';
  return sign + formatCurrency(Math.abs(amount), currency);
}

function getPnLClass(value) { return value >= 0 ? 'positive' : 'negative'; }

function showNotifications() { showToast('No new notifications'); }