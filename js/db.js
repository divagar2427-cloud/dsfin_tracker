// ===== DS WEALTH TRACKER - IndexedDB Module =====
// All data stored locally on device using IndexedDB

const DB_NAME = 'DSWealthTracker';
const DB_VERSION = 1;

const STORES = {
  USERS: 'users',
  HOLDINGS: 'holdings',
  TRADES: 'trades',
  ASSETS: 'assets',
  GOALS: 'goals',
  TRANSACTIONS: 'transactions',
  GROUPS: 'groups',
  MARKET_PRICES: 'market_prices',
  PORTFOLIO_HISTORY: 'portfolio_history',
  SETTINGS: 'settings'
};

let db = null;

// Initialize IndexedDB
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Users store
      if (!database.objectStoreNames.contains(STORES.USERS)) {
        const usersStore = database.createObjectStore(STORES.USERS, { keyPath: 'id', autoIncrement: true });
        usersStore.createIndex('email', 'email', { unique: true });
      }

      // Holdings store
      if (!database.objectStoreNames.contains(STORES.HOLDINGS)) {
        const holdingsStore = database.createObjectStore(STORES.HOLDINGS, { keyPath: 'id', autoIncrement: true });
        holdingsStore.createIndex('userId', 'userId', { unique: false });
        holdingsStore.createIndex('symbol', 'symbol', { unique: false });
        holdingsStore.createIndex('market', 'market', { unique: false });
        holdingsStore.createIndex('type', 'type', { unique: false });
      }

      // Trades store
      if (!database.objectStoreNames.contains(STORES.TRADES)) {
        const tradesStore = database.createObjectStore(STORES.TRADES, { keyPath: 'id', autoIncrement: true });
        tradesStore.createIndex('userId', 'userId', { unique: false });
        tradesStore.createIndex('symbol', 'symbol', { unique: false });
        tradesStore.createIndex('date', 'date', { unique: false });
        tradesStore.createIndex('type', 'type', { unique: false });
      }

      // Assets store
      if (!database.objectStoreNames.contains(STORES.ASSETS)) {
        const assetsStore = database.createObjectStore(STORES.ASSETS, { keyPath: 'id', autoIncrement: true });
        assetsStore.createIndex('userId', 'userId', { unique: false });
        assetsStore.createIndex('assetType', 'assetType', { unique: false });
      }

      // Goals store
      if (!database.objectStoreNames.contains(STORES.GOALS)) {
        const goalsStore = database.createObjectStore(STORES.GOALS, { keyPath: 'id', autoIncrement: true });
        goalsStore.createIndex('userId', 'userId', { unique: false });
      }

      // Transactions store (income/expenses)
      if (!database.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = database.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id', autoIncrement: true });
        txStore.createIndex('userId', 'userId', { unique: false });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('type', 'type', { unique: false });
      }

      // Groups store
      if (!database.objectStoreNames.contains(STORES.GROUPS)) {
        const groupsStore = database.createObjectStore(STORES.GROUPS, { keyPath: 'id', autoIncrement: true });
        groupsStore.createIndex('userId', 'userId', { unique: false });
      }

      // Market prices cache
      if (!database.objectStoreNames.contains(STORES.MARKET_PRICES)) {
        const pricesStore = database.createObjectStore(STORES.MARKET_PRICES, { keyPath: 'symbol' });
        pricesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Portfolio history
      if (!database.objectStoreNames.contains(STORES.PORTFOLIO_HISTORY)) {
        const historyStore = database.createObjectStore(STORES.PORTFOLIO_HISTORY, { keyPath: 'id', autoIncrement: true });
        historyStore.createIndex('userId', 'userId', { unique: false });
        historyStore.createIndex('date', 'date', { unique: false });
      }

      // Settings store
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });
}

// Generic CRUD operations
function getStore(storeName, mode = 'readonly') {
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

async function dbAdd(storeName, data) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.add({ ...data, createdAt: new Date().toISOString() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.put({ ...data, updatedAt: new Date().toISOString() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbClear(storeName) {
  return new Promise((resolve, reject) => {
    const store = getStore(storeName, 'readwrite');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===== USER OPERATIONS =====
const UserDB = {
  async create(userData) {
    const hashedPassword = await hashPassword(userData.password);
    return dbAdd(STORES.USERS, {
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      settings: {
        theme: 'dark',
        currency: 'INR',
        rsuCompany: 'QCOM',
        rebalancingRules: {
          trimThreshold: 30,
          minAllocation: 2,
          maxAllocation: 15
        },
        reentryThreshold: 10
      }
    });
  },

  async findByEmail(email) {
    const users = await dbGetByIndex(STORES.USERS, 'email', email.toLowerCase());
    return users[0] || null;
  },

  async getById(id) {
    return dbGet(STORES.USERS, id);
  },

  async update(id, updates) {
    const user = await dbGet(STORES.USERS, id);
    if (!user) throw new Error('User not found');
    return dbPut(STORES.USERS, { ...user, ...updates });
  },

  async updateSettings(id, settings) {
    const user = await dbGet(STORES.USERS, id);
    if (!user) throw new Error('User not found');
    return dbPut(STORES.USERS, { ...user, settings: { ...user.settings, ...settings } });
  }
};

// ===== HOLDINGS OPERATIONS =====
const HoldingsDB = {
  async add(userId, holding) {
    return dbAdd(STORES.HOLDINGS, { ...holding, userId });
  },

  async getAll(userId) {
    return dbGetByIndex(STORES.HOLDINGS, 'userId', userId);
  },

  async getByMarket(userId, market) {
    const all = await this.getAll(userId);
    return all.filter(h => h.market === market);
  },

  async getByType(userId, type) {
    const all = await this.getAll(userId);
    return all.filter(h => h.type === type);
  },

  async update(id, updates) {
    const holding = await dbGet(STORES.HOLDINGS, id);
    if (!holding) throw new Error('Holding not found');
    return dbPut(STORES.HOLDINGS, { ...holding, ...updates });
  },

  async delete(id) {
    return dbDelete(STORES.HOLDINGS, id);
  },

  async bulkAdd(userId, holdings) {
    const results = [];
    for (const holding of holdings) {
      const result = await this.add(userId, holding);
      results.push(result);
    }
    return results;
  },

  async upsertBySymbol(userId, holding) {
    const all = await this.getAll(userId);
    const existing = all.find(h => h.symbol === holding.symbol && h.market === holding.market);
    if (existing) {
      return this.update(existing.id, holding);
    } else {
      return this.add(userId, holding);
    }
  },

  async clearAll(userId) {
    const all = await this.getAll(userId);
    for (const h of all) {
      await dbDelete(STORES.HOLDINGS, h.id);
    }
  }
};

// ===== TRADES OPERATIONS =====
const TradesDB = {
  async add(userId, trade) {
    return dbAdd(STORES.TRADES, { ...trade, userId });
  },

  async getAll(userId) {
    return dbGetByIndex(STORES.TRADES, 'userId', userId);
  },

  async getBySymbol(userId, symbol) {
    const all = await this.getAll(userId);
    return all.filter(t => t.symbol === symbol);
  },

  async getByDateRange(userId, startDate, endDate) {
    const all = await this.getAll(userId);
    return all.filter(t => {
      const date = new Date(t.date);
      return date >= new Date(startDate) && date <= new Date(endDate);
    });
  },

  async getSellTrades(userId) {
    const all = await this.getAll(userId);
    return all.filter(t => t.type === 'SELL');
  },

  async bulkAdd(userId, trades) {
    const results = [];
    for (const trade of trades) {
      const result = await this.add(userId, trade);
      results.push(result);
    }
    return results;
  },

  async delete(id) {
    return dbDelete(STORES.TRADES, id);
  },

  async clearAll(userId) {
    const all = await this.getAll(userId);
    for (const t of all) {
      await dbDelete(STORES.TRADES, t.id);
    }
  }
};

// ===== ASSETS OPERATIONS =====
const AssetsDB = {
  async add(userId, asset) {
    return dbAdd(STORES.ASSETS, { ...asset, userId });
  },

  async getAll(userId) {
    return dbGetByIndex(STORES.ASSETS, 'userId', userId);
  },

  async getByType(userId, assetType) {
    const all = await this.getAll(userId);
    return all.filter(a => a.assetType === assetType);
  },

  async update(id, updates) {
    const asset = await dbGet(STORES.ASSETS, id);
    if (!asset) throw new Error('Asset not found');
    return dbPut(STORES.ASSETS, { ...asset, ...updates });
  },

  async delete(id) {
    return dbDelete(STORES.ASSETS, id);
  }
};

// ===== GOALS OPERATIONS =====
const GoalsDB = {
  async add(userId, goal) {
    return dbAdd(STORES.GOALS, { ...goal, userId });
  },

  async getAll(userId) {
    return dbGetByIndex(STORES.GOALS, 'userId', userId);
  },

  async update(id, updates) {
    const goal = await dbGet(STORES.GOALS, id);
    if (!goal) throw new Error('Goal not found');
    return dbPut(STORES.GOALS, { ...goal, ...updates });
  },

  async delete(id) {
    return dbDelete(STORES.GOALS, id);
  }
};

// ===== TRANSACTIONS OPERATIONS (Money Manager) =====
const TransactionsDB = {
  async add(userId, transaction) {
    return dbAdd(STORES.TRANSACTIONS, { ...transaction, userId });
  },

  async getAll(userId) {
    return dbGetByIndex(STORES.TRANSACTIONS, 'userId', userId);
  },

  async getByType(userId, type) {
    const all = await this.getAll(userId);
    return all.filter(t => t.type === type);
  },

  async getByDateRange(userId, startDate, endDate) {
    const all = await this.getAll(userId);
    return all.filter(t => {
      const date = new Date(t.date);
      return date >= new Date(startDate) && date <= new Date(endDate);
    });
  },

  async getByMonth(userId, year, month) {
    const all = await this.getAll(userId);
    return all.filter(t => {
      const date = new Date(t.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
  },

  async update(id, updates) {
    const tx = await dbGet(STORES.TRANSACTIONS, id);
    if (!tx) throw new Error('Transaction not found');
    return dbPut(STORES.TRANSACTIONS, { ...tx, ...updates });
  },

  async delete(id) {
    return dbDelete(STORES.TRANSACTIONS, id);
  }
};

// ===== GROUPS OPERATIONS =====
const GroupsDB = {
  async add(userId, group) {
    return dbAdd(STORES.GROUPS, { ...group, userId });
  },

  async getAll(userId) {
    return dbGetByIndex(STORES.GROUPS, 'userId', userId);
  },

  async update(id, updates) {
    const group = await dbGet(STORES.GROUPS, id);
    if (!group) throw new Error('Group not found');
    return dbPut(STORES.GROUPS, { ...group, ...updates });
  },

  async delete(id) {
    return dbDelete(STORES.GROUPS, id);
  }
};

// ===== MARKET PRICES CACHE =====
const MarketPricesDB = {
  async set(symbol, priceData) {
    return dbPut(STORES.MARKET_PRICES, {
      symbol,
      ...priceData,
      updatedAt: new Date().toISOString()
    });
  },

  async get(symbol) {
    return dbGet(STORES.MARKET_PRICES, symbol);
  },

  async getAll() {
    return dbGetAll(STORES.MARKET_PRICES);
  },

  async isStale(symbol, maxAgeMinutes = 15) {
    const price = await this.get(symbol);
    if (!price) return true;
    const age = (Date.now() - new Date(price.updatedAt).getTime()) / 60000;
    return age > maxAgeMinutes;
  },

  async bulkSet(prices) {
    for (const [symbol, data] of Object.entries(prices)) {
      await this.set(symbol, data);
    }
  }
};

// ===== PORTFOLIO HISTORY =====
const PortfolioHistoryDB = {
  async add(userId, snapshot) {
    return dbAdd(STORES.PORTFOLIO_HISTORY, { ...snapshot, userId });
  },

  async getAll(userId) {
    const all = await dbGetByIndex(STORES.PORTFOLIO_HISTORY, 'userId', userId);
    return all.sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  async getRecent(userId, days = 30) {
    const all = await this.getAll(userId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return all.filter(h => new Date(h.date) >= cutoff);
  }
};

// ===== SETTINGS =====
const SettingsDB = {
  async set(key, value) {
    return dbPut(STORES.SETTINGS, { key, value });
  },

  async get(key) {
    const item = await dbGet(STORES.SETTINGS, key);
    return item ? item.value : null;
  },

  async getAll() {
    const items = await dbGetAll(STORES.SETTINGS);
    const result = {};
    items.forEach(item => { result[item.key] = item.value; });
    return result;
  }
};

// ===== UTILITY FUNCTIONS =====
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ds-wealth-salt-2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// Export all data for backup
async function exportAllData(userId) {
  const [holdings, trades, assets, goals, transactions, groups] = await Promise.all([
    HoldingsDB.getAll(userId),
    TradesDB.getAll(userId),
    AssetsDB.getAll(userId),
    GoalsDB.getAll(userId),
    TransactionsDB.getAll(userId),
    GroupsDB.getAll(userId)
  ]);

  return {
    exportDate: new Date().toISOString(),
    version: '1.0',
    holdings,
    trades,
    assets,
    goals,
    transactions,
    groups
  };
}

// Import data from backup
async function importAllData(userId, data) {
  if (data.holdings) {
    for (const h of data.holdings) {
      const { id, createdAt, updatedAt, ...holding } = h;
      await HoldingsDB.add(userId, holding);
    }
  }
  if (data.trades) {
    for (const t of data.trades) {
      const { id, createdAt, updatedAt, ...trade } = t;
      await TradesDB.add(userId, trade);
    }
  }
  if (data.assets) {
    for (const a of data.assets) {
      const { id, createdAt, updatedAt, ...asset } = a;
      await AssetsDB.add(userId, asset);
    }
  }
  if (data.goals) {
    for (const g of data.goals) {
      const { id, createdAt, updatedAt, ...goal } = g;
      await GoalsDB.add(userId, goal);
    }
  }
  if (data.transactions) {
    for (const tx of data.transactions) {
      const { id, createdAt, updatedAt, ...transaction } = tx;
      await TransactionsDB.add(userId, transaction);
    }
  }
  if (data.groups) {
    for (const g of data.groups) {
      const { id, createdAt, updatedAt, ...group } = g;
      await GroupsDB.add(userId, group);
    }
  }
}

// Clear all user data
async function clearUserData(userId) {
  await HoldingsDB.clearAll(userId);
  await TradesDB.clearAll(userId);
  const assets = await AssetsDB.getAll(userId);
  for (const a of assets) await dbDelete(STORES.ASSETS, a.id);
  const goals = await GoalsDB.getAll(userId);
  for (const g of goals) await dbDelete(STORES.GOALS, g.id);
  const txs = await TransactionsDB.getAll(userId);
  for (const t of txs) await dbDelete(STORES.TRANSACTIONS, t.id);
  const groups = await GroupsDB.getAll(userId);
  for (const g of groups) await dbDelete(STORES.GROUPS, g.id);
}