# DS Wealth Tracker 💰

A complete **Personal Financial Management & Net Worth Tracking PWA** (Progressive Web App) that works like a native mobile app.

## 🚀 Features

### Portfolio Management
- **Indian Portfolio** - Track NSE/BSE stocks, ETFs, Mutual Funds
- **US Portfolio** - Track US stocks, ETFs via Alpaca broker
- **RSU Holdings** - Separate tracking for Qualcomm RSUs and other RSUs
- **Live Market Prices** - Real-time prices via Yahoo Finance API
- **USD/INR Exchange Rate** - Live currency conversion

### Dashboard
- Total Net Worth (Portfolio + Assets)
- Indian/US/RSU Portfolio breakdown
- Unrealized & Realized P&L
- Today's Gain/Loss
- Asset Allocation Chart
- Market Allocation Chart
- Sector Allocation Chart
- Top Holdings
- Portfolio Growth Chart

### Import Portfolio
- **Indian Holdings** - Upload IndMoney DP Statement PDF or Excel
- **Indian Transactions** - Upload IndMoney transaction Excel
- **US Holdings** - Upload Alpaca holdings Excel
- **US Transactions** - Upload Alpaca transaction Excel
- Automatic ISIN → Symbol mapping
- Auto-categorization (Stock/ETF/MF/RSU)

### Financial Features
- **Assets Tracker** - FD, Gold, PPF, EPF, NPS, Real Estate, Crypto, etc.
- **Goals Tracker** - House, Education, Retirement with inflation-adjusted calculations
- **Money Manager** - Income & Expense tracking with category charts
- **Trade History** - Complete buy/sell history with filters
- **Rebalancing** - Smart Buy/Hold/Sell recommendations
- **Re-Entry Tracker** - Track sold stocks for re-entry opportunities
- **Stock Groups** - Create custom groups (AI Stocks, Dividend Stocks, etc.)
- **Profit Comparison** - Compare actual vs hypothetical returns

### Technical Features
- **100% Local Storage** - All data stored in IndexedDB on your device
- **No Server Required** - Works completely offline
- **PWA** - Install on Android/iOS like a native app
- **Dark/Light Mode** - Toggle between themes
- **Mobile-First** - Designed for mobile, works on desktop

## 📱 How to Use

### Option 1: Open Directly
Simply open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).

### Option 2: Serve Locally (Recommended for PWA features)
```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .

# Using VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

Then open `http://localhost:8080` in your browser.

### Option 3: Deploy to Web
Upload all files to any static hosting:
- **Netlify** - Drag & drop the folder
- **Vercel** - `vercel deploy`
- **GitHub Pages** - Push to gh-pages branch
- **Firebase Hosting** - `firebase deploy`

## 📊 Importing Your Data

### Indian Holdings (IndMoney)
1. Go to IndMoney → Portfolio → Download DP Statement (PDF)
2. Or download as Excel from your broker
3. Upload in DS Wealth Tracker → Upload → Indian Holdings

### Indian Transactions (IndMoney)
1. The provided Excel file (`Indmoney-TransactionsReport-*.xlsx`) works directly
2. Upload in DS Wealth Tracker → Upload → Indian Transactions

### US Holdings (Alpaca)
1. The provided Excel file (`US_SHARE_HOLD.xlsx`) works directly
2. Upload in DS Wealth Tracker → Upload → US Holdings

### US Transactions (Alpaca)
1. The provided Excel file (`US_TRANS.xlsx`) works directly
2. Upload in DS Wealth Tracker → Upload → US Transactions

## 🔐 Authentication
- Create an account with Email + Password
- All credentials stored locally (hashed with SHA-256)
- No data leaves your device

## 📁 File Structure
```
DS_WEALTH_TRACKER/
├── index.html          # Main app shell
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── css/
│   └── app.css        # Main stylesheet
├── js/
│   ├── db.js          # IndexedDB data layer
│   ├── auth.js        # Authentication
│   ├── market.js      # Market data & calculations
│   ├── portfolio.js   # Portfolio management
│   ├── upload.js      # File parsing (Excel/PDF)
│   ├── assets.js      # Assets (FD, Gold, etc.)
│   ├── goals.js       # Goals tracker
│   ├── money.js       # Money manager
│   ├── trades.js      # Trade history
│   ├── rebalancing.js # Rebalancing recommendations
│   ├── reentry.js     # Re-entry tracker
│   ├── groups.js      # Stock groups
│   ├── charts.js      # Chart rendering
│   └── app.js         # Main controller
└── icons/             # PWA icons
```

## 🛠️ Technology Stack
- **HTML5/CSS3/JavaScript** - Pure vanilla, no framework
- **IndexedDB** - Local data storage
- **Chart.js** - Charts and graphs
- **SheetJS (XLSX)** - Excel file parsing
- **Yahoo Finance API** - Live market prices
- **ExchangeRate API** - USD/INR conversion
- **Service Worker** - Offline capability

## 📈 Supported Stocks
The app includes pre-mapped ISIN codes for all stocks in the sample data:
- HDFCBANK, ICICIBANK, INFY, TCS, WIPRO, ITC, TATASTEEL
- ITBEES, PHARMABEES, NIFTYBEES, BANKIETF, FMCGIETF
- NVDA, META, INTC, VOO, SMH, XLK, QCOM, ASML, TSM
- And 100+ more...

## ⚙️ Settings
- **Dark/Light Mode** toggle
- **RSU Company** - Set your RSU company symbol (default: QCOM)
- **Rebalancing Rules** - Customize trim/add thresholds
- **Re-Entry Threshold** - Set price drop % for re-entry alerts
- **Data Export/Import** - Backup and restore your data

## 🔄 Data Privacy
- All data is stored **only on your device** using IndexedDB
- No data is sent to any server
- No analytics or tracking
- Export your data anytime as JSON backup

---

**Built with ❤️ for DS Wealth Tracker**