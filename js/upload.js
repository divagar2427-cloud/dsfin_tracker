// ===== DS WEALTH TRACKER - Upload & Parsing Module =====

// ===== HANDLE FILE UPLOAD =====
async function handleFileUpload(type, input) {
  const file = input.files[0];
  if (!file) return;

  const statusMap = {
    'indian-holdings': 'indian-holdings-status',
    'indian-transactions': 'indian-trans-status',
    'us-holdings': 'us-holdings-status',
    'us-transactions': 'us-trans-status'
  };

  const statusEl = document.getElementById(statusMap[type]);
  if (statusEl) statusEl.textContent = '⏳ Processing...';

  showUploadProgress(true);
  updateUploadProgress(10, 'Reading file...');

  try {
    let result;
    const ext = file.name.split('.').pop().toLowerCase();
    updateUploadProgress(30, 'Parsing file...');

    if (ext === 'pdf') {
      result = await parsePDF(file, type);
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      result = await parseExcel(file, type);
    } else {
      throw new Error('Unsupported format. Use PDF, Excel (.xlsx/.xls), or CSV.');
    }

    updateUploadProgress(70, 'Saving data...');
    await saveUploadedData(type, result);
    updateUploadProgress(100, 'Complete!');

    if (statusEl) statusEl.textContent = '✅ ' + result.count + ' records imported';
    showUploadResults(type, result);
    showToast(result.count + ' records imported successfully!');

    setTimeout(async () => {
      try { await renderPortfolioPage(); await renderDashboard(); } catch(e) {}
    }, 500);

  } catch (err) {
    console.error('Upload error:', err);
    if (statusEl) statusEl.textContent = '❌ Error: ' + err.message;
    showToast('Import failed: ' + err.message, 'error');
  } finally {
    setTimeout(() => showUploadProgress(false), 2000);
    input.value = '';
  }
}

// ===== PARSE EXCEL =====
async function parseExcel(file, type) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: false });
        let result;
        if (type === 'indian-holdings') result = parseIndianHoldingsExcel(workbook);
        else if (type === 'indian-transactions') result = parseIndianTransactionsExcel(workbook);
        else if (type === 'us-holdings') result = parseUSHoldingsExcel(workbook);
        else if (type === 'us-transactions') result = parseUSTransactionsExcel(workbook);
        else throw new Error('Unknown type: ' + type);
        resolve(result);
      } catch (err) {
        reject(new Error('Parse error: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ===== FIND HEADER ROW =====
function findHeaderRow(rows, keywords1, keywords2, maxRows) {
  for (let i = 0; i < Math.min(rows.length, maxRows || 25); i++) {
    const rowStr = rows[i].join(' ').toLowerCase();
    const has1 = keywords1.some(k => rowStr.includes(k));
    const has2 = keywords2 ? keywords2.some(k => rowStr.includes(k)) : true;
    if (has1 && has2) return i;
  }
  return -1;
}

// ===== GET COLUMN VALUE =====
function makeGetCol(headers, row) {
  return function(names) {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name));
      if (idx !== -1 && row[idx] !== undefined && String(row[idx]).trim() !== '') return row[idx];
    }
    return '';
  };
}

// ===== PARSE DATE =====
function parseDate(dateRaw) {
  if (!dateRaw) return new Date().toISOString().split('T')[0];
  if (dateRaw instanceof Date) return dateRaw.toISOString().split('T')[0];
  const dateStr = String(dateRaw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
  // Handle "04 May 2026, 11:19 PM" or "04 May 2026 11:19 PM"
  const clean = dateStr.replace(',', '');
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  // Manual: "04 May 2026 11:19 PM"
  const parts = clean.split(' ');
  if (parts.length >= 3) {
    const d = new Date(parts[1] + ' ' + parts[0] + ', ' + parts[2]);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

// ===== PARSE INDIAN HOLDINGS EXCEL =====
function parseIndianHoldingsExcel(workbook) {
  const holdings = [];
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  const headerRow = findHeaderRow(rows,
    ['isin', 'symbol', 'scrip'],
    ['qty', 'quantity', 'balance', 'tot qty', 'units']
  );

  if (headerRow === -1) return parseIndMoneyDPStatement(rows);

  const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c || String(c).trim() === '')) continue;
    const getCol = makeGetCol(headers, row);

    const symbol = String(getCol(['symbol', 'scrip symbol', 'ticker', 'scrip'])).trim().toUpperCase();
    const name = String(getCol(['company name', 'scrip name', 'name', 'security', 'company'])).trim();
    const qty = parseFloat(String(getCol(['tot qty', 'free bal', 'quantity', 'qty', 'balance', 'units'])).replace(/,/g, '')) || 0;
    const avgPrice = parseFloat(String(getCol(['avg', 'average', 'avg price', 'buy price', 'cost price'])).replace(/,/g, '')) || 0;
    const currentPrice = parseFloat(String(getCol(['rate', 'ltp', 'current price', 'market price', 'price', 'nav'])).replace(/,/g, '')) || 0;
    const isin = String(getCol(['isin'])).trim();
    const value = parseFloat(String(getCol(['value', 'current value', 'market value', 'amount'])).replace(/,/g, '')) || 0;

    if ((!symbol && !isin) || qty <= 0) continue;

    const finalSymbol = symbol || getSymbolFromISIN(isin) || isin;
    if (!finalSymbol) continue;

    let holdingType = 'stock';
    let sector = getSectorForSymbol(finalSymbol);
    if (isin.startsWith('INF') || name.toLowerCase().includes('etf') ||
        name.toLowerCase().includes('bees') || name.toLowerCase().includes('fund')) {
      holdingType = name.toLowerCase().includes('mutual') ? 'mf' : 'etf';
      sector = 'ETF';
    }

    const calcAvgPrice = avgPrice || (qty > 0 && value > 0 ? value / qty : currentPrice);
    holdings.push({ symbol: finalSymbol, name: name || finalSymbol, quantity: qty, avgPrice: calcAvgPrice, currentPrice: currentPrice || calcAvgPrice, market: 'indian', type: holdingType, sector, isin });
  }

  return { holdings, trades: [], count: holdings.length, type: 'indian-holdings' };
}

// ===== PARSE INDMONEY DP STATEMENT =====
function parseIndMoneyDPStatement(rows) {
  const holdings = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const rowStr = row.join(' ');
    const isinMatch = rowStr.match(/IN[EF][A-Z0-9]{10}/);
    if (!isinMatch) continue;
    const isin = isinMatch[0];
    const numbers = (rowStr.match(/[\d,]+\.?\d*/g) || []).map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n) && n > 0);
    if (numbers.length < 1) continue;
    const qty = numbers[0];
    const price = numbers.length >= 3 ? numbers[numbers.length - 2] : 0;
    const value = numbers.length >= 2 ? numbers[numbers.length - 1] : 0;
    const symbol = getSymbolFromISIN(isin);
    if (!symbol || qty <= 0) continue;
    const calcAvgPrice = price || (qty > 0 && value > 0 ? value / qty : 0);
    holdings.push({ symbol, name: symbol, quantity: qty, avgPrice: calcAvgPrice, currentPrice: price || calcAvgPrice, market: 'indian', type: isin.startsWith('INF') ? 'etf' : 'stock', sector: getSectorForSymbol(symbol), isin });
  }
  return { holdings, trades: [], count: holdings.length, type: 'indian-holdings' };
}

// ===== PARSE INDIAN TRANSACTIONS EXCEL =====
function parseIndianTransactionsExcel(workbook) {
  const trades = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

    const headerRow = findHeaderRow(rows,
      ['execution date', 'trade date', 'date'],
      ['symbol', 'scrip']
    );
    if (headerRow === -1) continue;

    const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => !c || String(c).trim() === '')) continue;
      const getCol = makeGetCol(headers, row);

      const dateRaw = getCol(['execution date', 'trade date', 'date']);
      const symbol = String(getCol(['scrip symbol', 'symbol', 'ticker', 'scrip'])).trim().toUpperCase();
      const name = String(getCol(['scrip name', 'name', 'company', 'security'])).trim();
      const typeRaw = String(getCol(['type', 'transaction type', 'buy/sell'])).trim().toUpperCase();
      const qty = parseFloat(String(getCol(['quantity', 'qty'])).replace(/,/g, '')) || 0;
      const price = parseFloat(String(getCol(['price', 'rate', 'trade price'])).replace(/,/g, '')) || 0;
      const exchange = String(getCol(['exchange'])).trim() || 'NSE';
      const isin = String(getCol(['isin'])).trim();
      const status = String(getCol(['order status', 'status'])).trim().toLowerCase();

      if (status && (status.includes('cancel') || status.includes('reject'))) continue;
      if (!symbol || qty <= 0 || !price) continue;

      let type = typeRaw;
      if (type.includes('BUY') || type === 'B') type = 'BUY';
      else if (type.includes('SELL') || type === 'S') type = 'SELL';
      else continue;

      trades.push({ symbol, name: name || symbol, date: parseDate(dateRaw), type, quantity: qty, price, amount: qty * price, exchange, market: 'indian', isin });
    }

    if (trades.length > 0) break;
  }

  const holdings = computeHoldingsFromTrades(trades, 'indian');
  return { holdings, trades, count: trades.length, type: 'indian-transactions' };
}

// ===== PARSE US HOLDINGS EXCEL =====
function parseUSHoldingsExcel(workbook) {
  const holdings = [];
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  const headerRow = findHeaderRow(rows,
    ['stock symbol', 'symbol'],
    ['quantity', 'qty']
  );
  if (headerRow === -1) throw new Error('Header not found. Expected: Stock Symbol, Quantity, Avg. Price ($)');

  const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());
  const rsuCompany = (currentUser && currentUser.settings && currentUser.settings.rsuCompany ? currentUser.settings.rsuCompany : 'QCOM').toUpperCase();

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c || String(c).trim() === '')) continue;
    const getCol = makeGetCol(headers, row);

    const symbol = String(getCol(['stock symbol', 'symbol', 'ticker'])).trim().toUpperCase();
    const qty = parseFloat(String(getCol(['quantity', 'qty'])).replace(/,/g, '')) || 0;
    const avgPrice = parseFloat(String(getCol(['avg. price', 'avg price', 'average price', 'avg.', 'price'])).replace(/[$,]/g, '')) || 0;
    const totalValue = parseFloat(String(getCol(['total value', 'value', 'market value'])).replace(/[$,]/g, '')) || 0;
    const holdingSince = String(getCol(['holding since', 'since', 'date'])).trim();

    if (!symbol || qty <= 0 || symbol.length > 10 || symbol.includes(' ')) continue;

    const isRSU = symbol === rsuCompany;
    const calcAvgPrice = avgPrice || (qty > 0 && totalValue > 0 ? totalValue / qty : 0);

    holdings.push({ symbol, name: symbol, quantity: qty, avgPrice: calcAvgPrice, currentPrice: calcAvgPrice, market: isRSU ? 'rsu' : 'us', type: isETF(symbol) ? 'etf' : 'stock', sector: getSectorForSymbol(symbol), holdingSince: holdingSince || null });
  }

  return { holdings, trades: [], count: holdings.length, type: 'us-holdings' };
}

// ===== PARSE US TRANSACTIONS EXCEL =====
function parseUSTransactionsExcel(workbook) {
  const trades = [];
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

  const headerRow = findHeaderRow(rows,
    ['stock name', 'stock symbol'],
    ['quantity', 'price']
  );
  if (headerRow === -1) throw new Error('Header not found. Expected: Stock Name, Stock Symbol, Transaction Type, Quantity, Price ($)');

  const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());
  const rsuCompany = (currentUser && currentUser.settings && currentUser.settings.rsuCompany ? currentUser.settings.rsuCompany : 'QCOM').toUpperCase();

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c || String(c).trim() === '')) continue;
    const getCol = makeGetCol(headers, row);

    const name = String(getCol(['stock name'])).trim();
    const symbol = String(getCol(['stock symbol', 'symbol', 'ticker'])).trim().toUpperCase();
    const dateRaw = getCol(['order placed time', 'order execution time', 'execution time', 'date']);
    const typeRaw = String(getCol(['transaction type', 'type', 'buy/sell'])).trim().toUpperCase();
    const qty = parseFloat(String(getCol(['quantity', 'qty'])).replace(/,/g, '')) || 0;
    const price = parseFloat(String(getCol(['price ($)', 'price', 'rate'])).replace(/[$,]/g, '')) || 0;
    const amount = parseFloat(String(getCol(['order amount', 'amount ($)', 'amount', 'total'])).replace(/[$,]/g, '')) || 0;

    if (!symbol || qty <= 0 || symbol.length > 10 || symbol.includes(' ')) continue;

    let type = typeRaw;
    if (type.includes('BUY') || type === 'B') type = 'BUY';
    else if (type.includes('SELL') || type === 'S') type = 'SELL';
    else continue;

    const isRSU = symbol === rsuCompany;
    trades.push({ symbol, name: name || symbol, date: parseDate(dateRaw), type, quantity: qty, price, amount: amount || qty * price, market: isRSU ? 'rsu' : 'us', currency: 'USD' });
  }

  const holdings = computeHoldingsFromTrades(trades, 'us');
  return { holdings, trades, count: trades.length, type: 'us-transactions' };
}

// ===== PARSE PDF =====
async function parsePDF(file, type) {
  const text = await extractTextFromPDF(file);
  const lines = text.split('\n').filter(l => l.trim());
  if (type === 'indian-holdings') return parseIndianHoldingsPDFText(text);
  if (type === 'indian-transactions') return parseIndianTransactionsPDFText(lines);
  throw new Error('PDF not supported for this type. Please use Excel/CSV.');
}

// ===== EXTRACT TEXT FROM PDF =====
async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (typeof pdfjsLib !== 'undefined') {
          const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
          }
          resolve(text);
        } else {
          resolve(new TextDecoder('utf-8').decode(e.target.result));
        }
      } catch (err) {
        reject(new Error('Could not parse PDF. Please use Excel/CSV format.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read PDF'));
    reader.readAsArrayBuffer(file);
  });
}

// ===== PARSE INDIAN HOLDINGS FROM PDF =====
function parseIndianHoldingsPDFText(fullText) {
  const holdings = [];
  const isinRegex = /IN[EF][A-Z0-9]{10}/g;
  let match;

  while ((match = isinRegex.exec(fullText)) !== null) {
    const isin = match[0];
    const pos = match.index;
    const before = fullText.substring(Math.max(0, pos - 150), pos);
    const after = fullText.substring(pos, Math.min(fullText.length, pos + 150));
    const context = before + after;

    const numbers = (context.match(/[\d,]+\.?\d*/g) || [])
      .map(n => parseFloat(n.replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0 && n < 1000000000);

    if (numbers.length < 1) continue;

    const qty = numbers.find(n => n > 0 && n < 100000) || numbers[0];
    if (!qty || qty <= 0) continue;

    const price = numbers.length >= 3 ? numbers[numbers.length - 2] : 0;
    const value = numbers.length >= 2 ? numbers[numbers.length - 1] : 0;

    const symbol = getSymbolFromISIN(isin);
    if (!symbol) continue;

    const calcAvgPrice = price || (qty > 0 && value > 0 ? value / qty : 0);
    holdings.push({ symbol, name: symbol, quantity: qty, avgPrice: calcAvgPrice, currentPrice: price || calcAvgPrice, market: 'indian', type: isin.startsWith('INF') ? 'etf' : 'stock', sector: getSectorForSymbol(symbol), isin });
  }

  return { holdings, trades: [], count: holdings.length, type: 'indian-holdings' };
}

// ===== PARSE INDIAN TRANSACTIONS FROM PDF =====
function parseIndianTransactionsPDFText(lines) {
  const trades = [];
  for (const line of lines) {
    const dateMatch = line.match(/\d{4}-\d{2}-\d{2}/);
    if (!dateMatch) continue;
    const typeMatch = line.match(/\b(BUY|SELL)\b/i);
    if (!typeMatch) continue;
    const numbers = (line.match(/[\d,]+\.?\d*/g) || []).map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n) && n > 0);
    if (numbers.length < 2) continue;
    const symbolMatch = (line.match(/[A-Z]{2,15}/g) || []).filter(s => !['BUY','SELL','NSE','BSE','EXECUTED'].includes(s));
    const symbol = symbolMatch[0] || '';
    if (!symbol) continue;
    trades.push({ symbol, name: symbol, date: dateMatch[0], type: typeMatch[1].toUpperCase(), quantity: numbers[0], price: numbers[1], amount: numbers[0] * numbers[1], market: 'indian' });
  }
  const holdings = computeHoldingsFromTrades(trades, 'indian');
  return { holdings, trades, count: trades.length, type: 'indian-transactions' };
}

// ===== COMPUTE HOLDINGS FROM TRADES =====
function computeHoldingsFromTrades(trades, market) {
  const holdingMap = {};
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const trade of sorted) {
    const key = trade.symbol;
    if (!holdingMap[key]) holdingMap[key] = { symbol: trade.symbol, name: trade.name, quantity: 0, totalCost: 0, market: trade.market || market };

    if (trade.type === 'BUY') {
      holdingMap[key].quantity += trade.quantity;
      holdingMap[key].totalCost += trade.quantity * trade.price;
    } else if (trade.type === 'SELL') {
      holdingMap[key].quantity -= trade.quantity;
      if (holdingMap[key].quantity > 0) {
        const avgPrice = holdingMap[key].totalCost / (holdingMap[key].quantity + trade.quantity);
        holdingMap[key].totalCost = holdingMap[key].quantity * avgPrice;
      } else {
        holdingMap[key].quantity = 0;
        holdingMap[key].totalCost = 0;
      }
    }
  }

  return Object.values(holdingMap)
    .filter(h => h.quantity > 0.0001)
    .map(h => ({
      symbol: h.symbol, name: h.name, quantity: h.quantity,
      avgPrice: h.quantity > 0 ? h.totalCost / h.quantity : 0,
      currentPrice: 0, market: h.market,
      type: isETF(h.symbol) ? 'etf' : 'stock',
      sector: getSectorForSymbol(h.symbol)
    }));
}

// ===== SAVE UPLOADED DATA =====
async function saveUploadedData(type, result) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('Not logged in');

  if (result.holdings && result.holdings.length > 0) {
    for (const holding of result.holdings) {
      await HoldingsDB.upsertBySymbol(userId, holding);
    }
  }

  if (result.trades && result.trades.length > 0) {
    const market = type.includes('indian') ? 'indian' : 'us';
    const existingTrades = await TradesDB.getAll(userId);
    const marketTrades = existingTrades.filter(t => t.market === market);

    for (const trade of result.trades) {
      const exists = marketTrades.some(t =>
        t.symbol === trade.symbol && t.date === trade.date &&
        t.type === trade.type && Math.abs(t.quantity - trade.quantity) < 0.001
      );
      if (!exists) await TradesDB.add(userId, trade);
    }
  }
}

// ===== SHOW UPLOAD PROGRESS =====
function showUploadProgress(show) {
  const el = document.getElementById('upload-progress');
  if (el) el.classList.toggle('hidden', !show);
}

function updateUploadProgress(pct, text) {
  const fill = document.getElementById('upload-progress-fill');
  const textEl = document.getElementById('upload-progress-text');
  if (fill) fill.style.width = pct + '%';
  if (textEl) textEl.textContent = text;
}

// ===== SHOW UPLOAD RESULTS =====
function showUploadResults(type, result) {
  const el = document.getElementById('upload-results');
  const content = document.getElementById('upload-results-content');
  if (!el || !content) return;

  const labels = { 'indian-holdings': '🇮🇳 Indian Holdings', 'indian-transactions': '📋 Indian Transactions', 'us-holdings': '🇺🇸 US Holdings', 'us-transactions': '💹 US Transactions' };
  content.innerHTML = '<div style="padding:8px 0;">' +
    '<strong>' + (labels[type] || type) + '</strong>' +
    '<div style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary);">' +
    (result.holdings && result.holdings.length ? '✅ ' + result.holdings.length + ' holdings imported<br>' : '') +
    (result.trades && result.trades.length ? '✅ ' + result.trades.length + ' trades imported<br>' : '') +
    (result.count === 0 ? '⚠️ No data found in file' : '') +
    '</div></div>';
  el.classList.remove('hidden');
}

// ===== ISIN TO SYMBOL MAPPING =====
const ISIN_SYMBOL_MAP = {
  'INF204KB15V2': 'ITBEES', 'INF204KC1089': 'PHARMABEES', 'INE202E01016': 'IREDA',
  'INE040A01034': 'HDFCBANK', 'INF109KC10V2': 'AUTOIETF', 'INE683A01023': 'SOUTHBANK',
  'INE092T01019': 'IDFCFIRSTB', 'INE528G01035': 'YESBANK', 'INE081A01020': 'TATASTEEL',
  'INE154A01025': 'ITC', 'INE095N01031': 'NBCC', 'INE002L01015': 'SJVN',
  'INE551W01018': 'UJJIVANSFB', 'INE008A01015': 'IDBI', 'INF109KC15I8': 'BANKIETF',
  'INE075A01022': 'WIPRO', 'INF174KA1JF2': 'MNC', 'INF174KA1ZF8': 'CONS',
  'INE303R01014': 'KALYANKJIL', 'INF204KB17I5': 'GOLDBEES', 'INE987B01026': 'NATCOPHARM',
  'INE171A01029': 'FEDERALBNK', 'INE009A01021': 'INFY', 'INE089A01031': 'DRREDDY',
  'INE467B01029': 'TCS', 'INF109KC19V3': 'FMCGIETF', 'INF204KB14I2': 'NIFTYBEES',
  'INF204KC1337': 'AUTOBEES', 'INE414G01012': 'MUTHOOTFIN', 'INF457M01133': 'CPSEETF',
  'INE377N01017': 'WAAREEENER', 'INE095A01012': 'INDUSINDBK', 'INE155A01022': 'TMPV',
  'INE1TAE01010': 'TMCV', 'INE128S01021': 'FIVESTAR', 'INE200M01039': 'VBL',
  'INE04I401011': 'KPITTECH', 'INE00IN01015': 'STOVEKRAFT', 'INF179KC1HT0': 'HDFCMID150',
  'INE726G01019': 'ICICIPRULI', 'INE795G01014': 'HDFCLIFE', 'INE022Q01020': 'IEX',
  'INE454P01035': 'TRANSRAILL', 'INE522D01027': 'MANAPPURAM', 'INE126A01031': 'EIDPARRY',
  'INE024001021': 'AEROFLEX', 'INE0DK501011': 'PPLPHARMA', 'INE614B01018': 'KTKBANK',
  'INE255A01020': 'EPL', 'INE010C01025': 'SWISSMLTRY', 'INE565A01014': 'IOB',
  'INE733E01010': 'NTPC', 'INE139A01034': 'NATIONALUM', 'INE0S3G01027': 'PACEDIGITK',
  'INE0V9Q01010': 'LOTUSDEV', 'INF769K01HF4': 'MAFANG', 'INE450U01017': 'ROUTE',
  'INF789F01XA0': 'UTINIFTY50', 'INF204K01K15': 'NIPPONSMALLCAP', 'INF966L01689': 'QUANTSMALLCAP',
  'INF769K01BI1': 'MIRAELARGMID', 'INE871C01038': 'AVANTIFEED', 'INE227W01023': 'CLEAN',
  'INE347G01014': 'PETRONET'
};

function getSymbolFromISIN(isin) {
  return ISIN_SYMBOL_MAP[isin] || null;
}

function isETF(symbol) {
  const etfKeywords = ['BEES', 'ETF', 'IETF', 'VOO', 'SMH', 'XLK', 'SOXX', 'QQQM', 'EWY', 'EWJ', 'EWT', 'DRAM', 'SKYY'];
  return etfKeywords.some(k => symbol.toUpperCase().includes(k));
}