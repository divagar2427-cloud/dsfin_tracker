// ===== DS WEALTH TRACKER - Money Manager Module =====

let currentMoneyTab = 'all';
let currentMoneyPeriod = 'month';
let moneyChart = null;

const CATEGORY_ICONS = {
  salary: '💼', bonus: '🎁', dividends: '📈', business: '🏢', 'other-income': '💰',
  rent: '🏠', food: '🍔', travel: '✈️', shopping: '🛍️', utilities: '⚡',
  emi: '🏦', insurance: '🛡️', healthcare: '🏥', entertainment: '🎬', 'other-expense': '📦'
};

const CATEGORY_LABELS = {
  salary: 'Salary', bonus: 'Bonus', dividends: 'Dividends', business: 'Business', 'other-income': 'Other Income',
  rent: 'Rent', food: 'Food & Dining', travel: 'Travel', shopping: 'Shopping', utilities: 'Utilities',
  emi: 'EMI', insurance: 'Insurance', healthcare: 'Healthcare', entertainment: 'Entertainment', 'other-expense': 'Other Expense'
};

// ===== RENDER MONEY PAGE =====
async function renderMoneyPage() {
  if (!currentUser) return;
  const allTx = await TransactionsDB.getAll(currentUser.id);

  // Filter by period
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
  setText('savings-rate', `Savings Rate: ${savingsRate.toFixed(1)}%`);

  const savingsBar = document.getElementById('savings-rate-bar');
  if (savingsBar) savingsBar.style.width = Math.max(0, Math.min(savingsRate, 100)) + '%';

  // Render category chart
  renderExpenseCategoryChart(expenses);

  // Filter transactions by tab
  let display = filtered;
  if (currentMoneyTab === 'income') display = income;
  if (currentMoneyTab === 'expense') display = expenses;

  // Sort by date descending
  display.sort((a, b) => new Date(b.date) - new Date(a.date));

  const container = document.getElementById('money-transactions');
  if (!container) return;

  if (display.length === 0) {
    container.innerHTML = '<div class="empty-state">No transactions found. Click + Add to record income or expenses.</div>';
    return;
  }

  container.innerHTML = display.map(t => `
    <div class="transaction-item">
      <div class="transaction-icon ${t.type}">${CATEGORY_ICONS[t.category] || (t.type === 'income' ? '💚' : '❤️')}</div>
      <div class="transaction-info">
        <div class="transaction-category">${CATEGORY_LABELS[t.category] || t.category}</div>
        <div class="transaction-date">${formatDate(t.date)}${t.description ? ' · ' + t.description : ''}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(parseFloat(t.amount), 'INR')}</div>
        <button class="btn-sm btn-delete" onclick="deleteTransaction(${t.id})">✕</button>
      </div>
    </div>
  `).join('');
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

  // Group by category
  const categoryTotals = {};
  expenses.forEach(t => {
    const cat = CATEGORY_LABELS[t.category] || t.category;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(t.amount) || 0);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (moneyChart) moneyChart.destroy();

  if (labels.length === 0) return;

  const colors = ['#6C63FF', '#FF6584', '#43E97B', '#38F9D7', '#FA8231', '#FED330', '#A29BFE', '#FD79A8', '#00B894', '#0984E3'];

  moneyChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
            font: { size: 11 },
            boxWidth: 12
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
  document.getElementById('add-transaction-form').reset();
  document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('transaction-type').value = 'income';
  modal.classList.remove('hidden');
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