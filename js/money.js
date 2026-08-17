// ===== DS WEALTH TRACKER - Enhanced Money Manager Module =====

let currentMoneyTab = 'all';
let currentMoneyPeriod = 'month';
let moneyChart = null;

// ===== DEFAULT CATEGORIES =====
const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salary', icon: '💼', color: '#10B981' },
  { id: 'bonus', label: 'Bonus', icon: '🎁', color: '#F59E0B' },
  { id: 'dividends', label: 'Dividend', icon: '📈', color: '#6C63FF' },
  { id: 'interest', label: 'Interest Income', icon: '🏦', color: '#3B82F6' },
  { id: 'rental', label: 'Rental Income', icon: '🏠', color: '#8B5CF6' },
  { id: 'freelance', label: 'Freelance Income', icon: '💻', color: '#EC4899' },
  { id: 'business', label: 'Business Revenue', icon: '🏢', color: '#14B8A6' },
  { id: 'capital-gains', label: 'Capital Gains', icon: '📊', color: '#F97316' },
  { id: 'cashback', label: 'Cashback', icon: '💰', color: '#22C55E' },
  { id: 'gift', label: 'Gift Received', icon: '🎀', color: '#F43F5E' },
  { id: 'refund', label: 'Refund', icon: '↩️', color: '#64748B' },
  { id: 'other-income', label: 'Other Income', icon: '💵', color: '#94A3B8' }
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'grocery', label: 'Grocery', icon: '🛒', color: '#22C55E' },
  { id: 'food', label: 'Food & Dining', icon: '🍔', color: '#F97316' },
  { id: 'milk', label: 'Milk & Dairy', icon: '🥛', color: '#60A5FA' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦', color: '#8B5CF6' },
  { id: 'kids-education', label: 'Kids Education', icon: '🎓', color: '#6C63FF' },
  { id: 'medical', label: 'Medical', icon: '🏥', color: '#EF4444' },
  { id: 'fuel', label: 'Fuel', icon: '⛽', color: '#F59E0B' },
  { id: 'transport', label: 'Transport', icon: '🚌', color: '#3B82F6' },
  { id: 'cab', label: 'Cab/Auto', icon: '🚕', color: '#F97316' },
  { id: 'rent', label: 'Rent', icon: '🏠', color: '#8B5CF6' },
  { id: 'electricity', label: 'Electricity', icon: '⚡', color: '#EAB308' },
  { id: 'water', label: 'Water', icon: '💧', color: '#06B6D4' },
  { id: 'internet', label: 'Internet', icon: '🌐', color: '#6366F1' },
  { id: 'mobile', label: 'Mobile Recharge', icon: '📱', color: '#10B981' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#A855F7' },
  { id: 'travel', label: 'Travel', icon: '✈️', color: '#0EA5E9' },
  { id: 'hotel', label: 'Hotel', icon: '🏨', color: '#F59E0B' },
  { id: 'emi', label: 'EMI', icon: '🏦', color: '#EF4444' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', color: '#64748B' },
  { id: 'gym', label: 'Gym/Fitness', icon: '💪', color: '#22C55E' },
  { id: 'beauty', label: 'Beauty/Salon', icon: '💄', color: '#F43F5E' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📺', color: '#8B5CF6' },
  { id: 'parents', label: 'Parents', icon: '👴', color: '#F97316' },
  { id: 'credit-card', label: 'Credit Card', icon: '💳', color: '#EF4444' },
  { id: 'other-expense', label: 'Other Expense', icon: '📦', color: '#94A3B8' }
];

// Quick add shortcuts
const QUICK_ADD_INCOME = [
  { category: 'salary', label: 'Salary', icon: '💼' },
  { category: 'dividends', label: 'Dividend', icon: '📈' },
  { category: 'interest', label: 'Interest', icon: '🏦' },
  { category: 'freelance', label: 'Freelance', icon: '💻' }
];

const QUICK_ADD_EXPENSE = [
  { category: 'grocery', label: 'Grocery', icon: '🛒' },
  { category: 'fuel', label: 'Fuel', icon: '⛽' },
  { category: 'rent', label: 'Rent', icon: '🏠' },
  { category: 'food', label: 'Food', icon: '🍔' },
  { category: 'shopping', label: 'Shopping', icon: '🛍️' },
  { category: 'travel', label: 'Travel', icon: '✈️' },
  { category: 'emi', label: 'EMI', icon: '🏦' },
  { category: 'medical', label: 'Medical', icon: '🏥' }
];

// ===== GET CATEGORY INFO =====
function getCategoryInfo(categoryId, type) {
  const list = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  return list.find(c => c.id === categoryId) || { label: categoryId, icon: type === 'income' ? '💰' : '📦', color: '#94A3B8' };
}

// ===== RENDER MONEY PAGE =====
async function renderMoneyPage() {
  if (!currentUser) return;
  const allTx = await TransactionsDB.getAll(currentUser.id);
  const filtered = filterByPeriod(allTx, currentMoneyPeriod);

  const income = filtered.filter(t => t.type === 'income');
  const expenses = filtered.filter(t => t.type === 'expense');

  const totalIncome = income.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const totalExpenses = expenses.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const savings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

  setText('total-income', formatCurrency(totalIncome, 'INR', true));
  setText('total-expenses', formatCurrency(totalExpenses, 'INR', true));
  setText('savings-amount', formatCurrency(savings, 'INR', true));
  setText('savings-rate', 'Savings Rate: ' + savingsRate.toFixed(1) + '%');

  const savingsBar = document.getElementById('savings-rate-bar');
  if (savingsBar) savingsBar.style.width = Math.max(0, Math.min(savingsRate, 100)) + '%';

  // Render quick add buttons
  renderQuickAddButtons();

  // Render category chart
  renderExpenseCategoryChart(expenses);

  // Filter transactions by tab
  let display = filtered;
  if (currentMoneyTab === 'income') display = income;
  if (currentMoneyTab === 'expense') display = expenses;

  display.sort((a, b) => new Date(b.date) - new Date(a.date));

  const container = document.getElementById('money-transactions');
  if (!container) return;

  if (display.length === 0) {
    container.innerHTML = '<div class="empty-state">No transactions found. Use Quick Add or + Add button.</div>';
    return;
  }

  container.innerHTML = display.map(t => {
    const catInfo = getCategoryInfo(t.category, t.type);
    return `
      <div class="transaction-item">
        <div class="transaction-icon ${t.type}" style="background: ${catInfo.color}22; font-size: 1.3rem; display:flex; align-items:center; justify-content:center;">
          ${catInfo.icon}
        </div>
        <div class="transaction-info">
          <div class="transaction-category">${catInfo.label}</div>
          <div class="transaction-date">${formatDate(t.date)}${t.description ? ' · ' + t.description : ''}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(parseFloat(t.amount), 'INR')}</div>
          <button class="btn-sm btn-delete" onclick="deleteTransaction(${t.id})">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===== RENDER QUICK ADD BUTTONS =====
function renderQuickAddButtons() {
  const container = document.getElementById('quick-add-container');
  if (!container) return;

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Quick Add Income</div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${QUICK_ADD_INCOME.map(q => `
          <button onclick="quickAddTransaction('income', '${q.category}')" style="
            display: flex; align-items: center; gap: 6px; padding: 8px 14px;
            background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3);
            border-radius: 20px; color: #10B981; font-size: 0.8rem; font-weight: 600; cursor: pointer;
          ">${q.icon} ${q.label}</button>
        `).join('')}
      </div>
    </div>
    <div style="margin-bottom: 16px;">
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Quick Add Expense</div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${QUICK_ADD_EXPENSE.map(q => `
          <button onclick="quickAddTransaction('expense', '${q.category}')" style="
            display: flex; align-items: center; gap: 6px; padding: 8px 14px;
            background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
            border-radius: 20px; color: #EF4444; font-size: 0.8rem; font-weight: 600; cursor: pointer;
          ">${q.icon} ${q.label}</button>
        `).join('')}
      </div>
    </div>
  `;
}

// ===== QUICK ADD TRANSACTION =====
function quickAddTransaction(type, category) {
  const catInfo = getCategoryInfo(category, type);
  const amount = prompt(`Enter ${catInfo.label} amount (₹):`);
  if (!amount || isNaN(parseFloat(amount))) return;

  const transaction = {
    type,
    amount: parseFloat(amount),
    category,
    date: new Date().toISOString().split('T')[0],
    description: catInfo.label
  };

  TransactionsDB.add(currentUser.id, transaction).then(() => {
    showToast(catInfo.icon + ' ' + catInfo.label + ' added!');
    renderMoneyPage();
  }).catch(err => showToast('Error: ' + err.message, 'error'));
}

// ===== FILTER BY PERIOD =====
function filterByPeriod(transactions, period) {
  const now = new Date();
  if (period === 'month') {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  } else if (period === 'year') {
    return transactions.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
  }
  return transactions;
}

// ===== RENDER EXPENSE CATEGORY CHART =====
function renderExpenseCategoryChart(expenses) {
  const canvas = document.getElementById('expense-category-chart');
  if (!canvas) return;

  const categoryTotals = {};
  expenses.forEach(t => {
    const catInfo = getCategoryInfo(t.category, 'expense');
    const label = catInfo.label;
    categoryTotals[label] = (categoryTotals[label] || 0) + (parseFloat(t.amount) || 0);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (moneyChart) moneyChart.destroy();
  if (labels.length === 0) return;

  const colors = DEFAULT_EXPENSE_CATEGORIES.map(c => c.color);

  moneyChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
            font: { size: 11 }, boxWidth: 12
          }
        }
      }
    }
  });
}

// ===== SWITCH MONEY TAB =====
function switchMoneyTab(tab) {
  currentMoneyTab = tab;
  document.querySelectorAll('#page-money .tab-bar .tab-btn').forEach((btn, i) => {
    const tabs = ['all', 'income', 'expense'];
    btn.classList.toggle('active', tabs[i] === tab);
  });
  renderMoneyPage();
}

// ===== SWITCH MONEY PERIOD =====
function switchMoneyPeriod(period) {
  currentMoneyPeriod = period;
  document.querySelectorAll('.period-btn').forEach((btn, i) => {
    const periods = ['month', 'year', 'all'];
    btn.classList.toggle('active', periods[i] === period);
  });
  renderMoneyPage();
}

// ===== SHOW ADD TRANSACTION MODAL =====
function showAddTransactionModal() {
  const modal = document.getElementById('modal-add-transaction');
  if (!modal) return;

  // Populate category select with all categories
  const select = document.getElementById('transaction-category');
  if (select) {
    select.innerHTML = `
      <optgroup label="Income">
        ${DEFAULT_INCOME_CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
      </optgroup>
      <optgroup label="Expenses">
        ${DEFAULT_EXPENSE_CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
      </optgroup>
    `;
  }

  document.getElementById('add-transaction-form').reset();
  document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('transaction-type').value = 'income';
  modal.style.display = 'flex';
}

// ===== SET TRANSACTION TYPE =====
function setTransactionType(type) {
  document.getElementById('transaction-type').value = type;
  document.querySelectorAll('#modal-add-transaction .tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === (type === 'income' ? 0 : 1));
  });
}

// ===== SAVE TRANSACTION =====
async function saveTransaction(event) {
  event.preventDefault();

  const transaction = {
    type: document.getElementById('transaction-type').value,
    amount: parseFloat(document.getElementById('transaction-amount').value),
    category: document.getElementById('transaction-category').value,
    date: document.getElementById('transaction-date').value,
    description: document.getElementById('transaction-desc').value.trim()
  };

  if (!transaction.amount || !transaction.date) {
    showToast('Please fill required fields', 'error');
    return;
  }

  try {
    await TransactionsDB.add(currentUser.id, transaction);
    showToast('Transaction added!');
    closeModal('modal-add-transaction');
    await renderMoneyPage();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== DELETE TRANSACTION =====
async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  await TransactionsDB.delete(id);
  showToast('Transaction deleted');
  await renderMoneyPage();
}

// ===== SHOW ADD TRADE MODAL =====
function showAddTradeModal() {
  showToast('Use the Upload page to import trades, or add manually via Portfolio > Add');
}