// ===== DS WEALTH TRACKER - Market Data Module v3 =====
// Uses same approach as DS_WEALTH_OS but adapted for browser with CORS proxy

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
  'TECHM': 'Technology', 'KPITTECH': 'Technology', 'ITBEES': 'Technology',
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
  'NFLX': 'Entertainment', 'DAL': 'Airlines', 'SPCX': 'Aerospace', 'ARM': 'Technology',
  'BTC': 'Crypto', 'ETH': 'Crypto', 'SOL': 'Crypto'
};

// ===== FETCH WITH TIMEOUT =====
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
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

// ===== FETCH YAHOO FINANCE (with CORS proxy fallback) =====
// Mirrors DS_WEALTH_OS approach but for browser
async function fetchYahooChart(yfSymbol) {
  const baseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=1d&range=1d`;
  const baseUrl2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=1d&range=1d`;

  // Try 1: Direct fetch (works in some environments)
  for (const url of [baseUrl, baseUrl2]) {
    try {
      const resp = await fetchWithTimeout(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, 6000);
      if (resp.ok) {
        const data = await resp.json();
        const result = parseYahooData(data, yfSymbol);
        if (result) { console.log(`✓ Direct: ${yfSymbol} = ${result.price}`); return result; }
      }
    } catch (e) { /* CORS blocked, try proxy */ }
  }

  // Try 2: corsproxy.io (no URL encoding needed)
  try {
    const proxyUrl = `https://corsproxy.io/?${baseUrl}`;
    const resp = await fetchWithTimeout(proxyUrl, {}, 10000);
    if (resp.ok) {
      const data = await resp.json();
      const result = parseYahooData(data, yfSymbol);
      if (result) { console.log(`✓ Proxy1: ${yfSymbol} = ${result.price}`); return result; }
    }
  } catch (e) { /* try next */ }

  // Try 3: allorigins proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(baseUrl)}`;
    const resp = await fetchWithTimeout(proxyUrl, {}, 10000);
    if (resp.ok) {
      const data = await resp.json();
      const result = parseYahooData(data, yfSymbol);
      if (result) { console.log(`✓ Proxy2: ${yfSymbol} = ${result.price}`); return result; }
    }
  } catch (e) { /* try next */ }

  // Try 4: thingproxy
  try {
    const proxyUrl = `https://thingproxy.freeboard.io/fetch/${baseUrl}`;
    const resp = await fetchWithTimeout(proxyUrl, {}, 10000);
    if (resp.ok) {
      const data = await resp.json();
      const result = parseYahooData(data, yfSymbol);
      if (result) { console.log(`✓ Proxy3: ${yfSymbol} = ${result.price}`); return result; }
    }
  } catch (e) { /* all failed */ }

  console.log(`✗ All attempts failed for: ${yfSymbol}`);
  return null;
}

// ===== PARSE YAHOO FINANCE RESPONSE =====
function parseYahooData(data, symbol) {
  try {
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice || meta.previousClose;
    if (!price || price <= 0) return null;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return {
      price,
      prevClose,
      change,
      changePct,
      currency: meta.currency || 'USD',
      name: meta.shortName || meta.longName || symbol,
      updatedAt: new Date().toISOString()
    };
  } catch (e) { return null; }
}

// ===== NORMALIZE SYMBOL (same as DS_WEALTH_OS) =====
function normalizeSymbol(symbol, exchange) {
  const ex = (exchange || '').toUpperCase();
  const base = symbol.replace(/\.(NS|BO|US|L)$/i, '').toUpperCase().trim();
  if (ex === 'NSE') return base + '.NS';
  if (ex === 'BSE') return base + '.BO';
  return base;
}

// ===== FETCH INDIAN STOCK PRICE =====
async function fetchIndianStockPrice(symbol) {
  const clean = symbol.replace('.NS', '').replace('.BO', '');
  // Try NSE first, then BSE (same as DS_WEALTH_OS)
  for (const suffix of ['.NS', '.BO']) {
    const result = await fetchYahooChart(clean + suffix);
    if (result) { result.currency = 'INR'; return result; }
  }
  return null;
}

// ===== FETCH US STOCK PRICE =====
async function fetchUSStockPrice(symbol) {
  return await fetchYahooChart(symbol);
}

// ===== FETCH CRYPTO (CoinGecko - CORS enabled) =====
async function fetchCryptoPrice(symbol) {
  const coinMap = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana',
    'BNB': 'binancecoin', 'ADA': 'cardano', 'XRP': 'ripple', 'DOGE': 'dogecoin'
  };
  const coinId = coinMap[symbol.toUpperCase()];
  if (coinId) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;
      const resp = await fetchWithTimeout(url, {}, 8000);
      if (resp.ok) {
        const data = await resp.json();
        const d = data[coinId];
        if (d && d.usd) {
          const price = d.usd;
          const changePct = d.usd_24h_change || 0;
          const prevClose = price / (1 + changePct / 100);
          return { price, prevClose, change: price - prevClose, changePct, currency: 'USD', name: symbol, updatedAt: new Date().toISOString() };
        }
      }
    } catch (e) {}
  }
  return await fetchYahooChart(symbol + '-USD');
}

// ===== FETCH MUTUAL FUND NAV (mfapi.in - CORS enabled) =====
async function fetchMutualFundNAV(symbol) {
  try {
    const searchUrl = `https://api.mfapi.in/mf/search?q=${encodeURIComponent(symbol)}`;
    const resp = await fetchWithTimeout(searchUrl, {}, 8000);
    if (resp.ok) {
      const results = await resp.json();
      if (results && results.length > 0) {
        const schemeCode = results[0].schemeCode;
        const navResp = await fetchWithTimeout(`https://api.mfapi.in/mf/${schemeCode}`, {}, 8000);
        if (navResp.ok) {
          const navData = await navResp.json();
          if (navData?.data?.length >= 1) {
            const latest = navData.data[0];
            const prev = navData.data[1] || latest;
            const nav = parseFloat(latest.nav);
            const prevNav = parseFloat(prev.nav);
            if (nav > 0) {
              return {
                price: nav, prevClose: prevNav, change: nav - prevNav,
                changePct: prevNav > 0 ? ((nav - prevNav) / prevNav) * 100 : 0,
                currency: 'INR', name: navData.meta?.scheme_name || symbol,
                updatedAt: new Date().toISOString()
              };
            }
          }
        }
      }
    }
  } catch (e) {}
  return null;
}

// ===== FETCH USD/INR RATE =====
async function fetchUSDINRRate() {
  // Try Yahoo Finance USDINR=X first (same as DS_WEALTH_OS)
  const result = await fetchYahooChart('USDINR=X');
  if (result && result.price > 50 && result.price < 200) {
    usdInrRate = result.price;
    await MarketPricesDB.set('USD_INR', { price: usdInrRate, currency: 'INR', updatedAt: new Date().toISOString() });
    updateExchangeRateDisplay();
    console.log('✓ USD/INR:', usdInrRate);
    return usdInrRate;
  }

  // Fallback to exchange rate APIs
  const apis = [
    'https://api.exchangerate-api.com/v4/latest/USD',
    'https://open.er-api.com/v6/latest/USD'
  ];
  for (const api of apis) {
    try {
      const resp = await fetchWithTimeout(api, {}, 5000);
      if (resp.ok) {
        const data = await resp.json();
        const rate = data.rates?.INR || data.conversion_rates?.INR;
        if (rate && rate > 50 && rate < 200) {
          usdInrRate = rate;
          await MarketPricesDB.set('USD_INR', { price: rate, currency: 'INR', updatedAt: new Date().toISOString() });
          updateExchangeRateDisplay();
          return rate;
        }
      }
    } catch (e) {}
  }

  // Use cached
  try {
    const cached = await MarketPricesDB.get('USD_INR');
    if (cached?.price) { usdInrRate = cached.price; updateExchangeRateDisplay(); return usdInrRate; }
  } catch (e) {}

  updateExchangeRateDisplay();
  return usdInrRate;
}

// ===== BATCH FETCH PRICES =====
async function fetchPricesForHoldings(holdings) {
  const results = {};
  const errors = [];

  const indian = holdings.filter(h => h.market === 'indian');
  const us = holdings.filter(h => h.market === 'us' || h.market === 'rsu');

  console.log(`Fetching: ${indian.length} Indian + ${us.length} US holdings`);

  for (const h of indian) {
    try {
      // Check if it's a mutual fund (ISIN starts with INF)
      const isMF = h.isin && h.isin.startsWith('INF') && (h.type === 'mf');
      let price = null;
      if (isMF) {
        price = await fetchMutualFundNAV(h.symbol);
      }
      if (!price) {
        price = await fetchIndianStockPrice(h.symbol);
      }
      if (price) {
        results[h.symbol] = price;
        await MarketPricesDB.set(h.symbol, price);
      } else {
        errors.push(h.symbol);
      }
      await sleep(300);
    } catch (e) { errors.push(h.symbol); }
  }

  for (const h of us) {
    try {
      const price = await fetchUSStockPrice(h.symbol);
      if (price) {
        results[h.symbol] = price;
        await MarketPricesDB.set(h.symbol, price);
      } else {
        errors.push(h.symbol);
      }
      await sleep(300);
    } catch (e) { errors.push(h.symbol); }
  }

  console.log(`Done: ${Object.keys(results).length} success, ${errors.length} failed`);
  if (errors.length > 0) console.log('Failed:', errors.join(', '));
  return results;
}

// ===== REFRESH ALL MARKET DATA =====
async function refreshMarketData() {
  if (!currentUser || isRefreshing) return;
  isRefreshing = true;

  const refreshBtn = document.querySelector('[onclick="refreshMarketData()"]');
  if (refreshBtn) refreshBtn.style.animation = 'spin 1s linear infinite';

  try {
    showToast('🔄 Fetching live prices...');
    await fetchUSDINRRate();

    const holdings = await HoldingsDB.getAll(currentUser.id);
    if (holdings.length === 0) {
      showToast('No holdings to refresh. Add holdings first.');
      return;
    }

    const prices = await fetchPricesForHoldings(holdings);
    marketDataCache = prices;
    lastRefreshTime = new Date();

    const successCount = Object.keys(prices).length;
    await renderPortfolioPage();
    await renderDashboard();

    if (successCount > 0) {
      showToast(`✅ Updated ${successCount}/${holdings.length} prices`);
    } else {
      showToast('⚠️ Could not fetch prices. Check console for details.', 'error');
    }
    updateLastRefreshTime();
  } catch (e) {
    console.error('Refresh error:', e);
    showToast('Price refresh failed.', 'error');
  } finally {
    isRefreshing = false;
    if (refreshBtn) refreshBtn.style.animation = '';
  }
}

// ===== UPDATE DISPLAYS =====
function updateLastRefreshTime() {
  const el = document.getElementById('last-refresh-time');
  if (el && lastRefreshTime) {
    el.textContent = 'Updated: ' + lastRefreshTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
}

function updateExchangeRateDisplay() {
  const el = document.getElementById('usd-inr-rate');
  if (el) el.textContent = '₹' + usdInrRate.toFixed(2);
}

// ===== SECTOR =====
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
  const todayChange = priceData?.change || 0;
  const todayChangePct = priceData?.changePct || 0;
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

  for (const h of holdings) {
    const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
    totalInvestedINR += m.investedINR;
    totalCurrentINR += m.currentValueINR;
    totalTodayGainINR += m.todayGainLossINR;
    if (h.market === 'indian') { indianInvested += m.investedAmount; indianCurrent += m.currentValue; }
    else if (h.market === 'rsu') { rsuInvested += m.investedAmount; rsuCurrent += m.currentValue; }
    else { usInvested += m.investedAmount; usCurrent += m.currentValue; }
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
      const buyTrades = trades.filter(t => t.symbol === sell.symbol && t.type === 'BUY' && new Date(t.date) <= new Date(sell.date));
      if (buyTrades.length > 0) {
        const totalBuyQty = buyTrades.reduce((s, t) => s + t.quantity, 0);
        const avgBuyPrice = totalBuyQty > 0 ? buyTrades.reduce((s, t) => s + t.price * t.quantity, 0) / totalBuyQty : 0;
        const pnl = (sell.price - avgBuyPrice) * sell.quantity;
        const multiplier = (sell.market === 'us' || sell.market === 'rsu') ? usdInrRate : 1;
        totalRealizedPnLINR += pnl * multiplier;
      }
    }
    return { totalRealizedPnLINR };
  } catch (e) { return { totalRealizedPnLINR: 0 }; }
}

// ===== UTILITIES =====
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatCurrency(amount, currency = 'INR', compact = false) {
  if (isNaN(amount) || amount == null) return currency === 'INR' ? '₹0' : '$0';
  const abs = Math.abs(amount);
  const sym = currency === 'INR' ? '₹' : '$';
  if (compact) {
    if (abs >= 10000000) return sym + (amount / 10000000).toFixed(2) + 'Cr';
    if (abs >= 100000) return sym + (amount / 100000).toFixed(2) + 'L';
    if (abs >= 1000) return sym + (amount / 1000).toFixed(1) + 'K';
  }
  return sym + abs.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatPct(value) {
  if (isNaN(value)) return '0.00%';
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

function formatPnL(amount, currency = 'INR') {
  return (amount >= 0 ? '+' : '-') + formatCurrency(Math.abs(amount), currency);
}

function getPnLClass(value) { return value >= 0 ? 'positive' : 'negative'; }

function calculateXIRR(cashflows) {
  if (!cashflows || cashflows.length < 2) return 0;
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    let npv = 0, dnpv = 0;
    const t0 = new Date(cashflows[0].date).getTime();
    for (const cf of cashflows) {
      const y = (new Date(cf.date).getTime() - t0) / (365.25 * 24 * 3600 * 1000);
      npv += cf.amount / Math.pow(1 + rate, y);
      dnpv -= y * cf.amount / Math.pow(1 + rate, y + 1);
    }
    if (Math.abs(npv) < 0.01 || dnpv === 0) break;
    rate = rate - npv / dnpv;
    if (rate < -0.99) rate = -0.99;
  }
  return rate * 100;
}

function calculateCAGR(iv, fv, years) {
  if (iv <= 0 || years <= 0) return 0;
  return (Math.pow(fv / iv, 1 / years) - 1) * 100;
}

function showNotifications() { showToast('No new notifications'); }