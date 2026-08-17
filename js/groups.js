// ===== DS WEALTH TRACKER - Enhanced Groups Module =====

// ===== DEFAULT GROUP TEMPLATES =====
const DEFAULT_GROUPS = [
  {
    name: 'Personal Finance',
    description: 'My personal income, expenses & savings',
    color: '#3B82F6',
    icon: '👤',
    category: 'personal',
    symbols: []
  },
  {
    name: 'Family Finance',
    description: 'Family expenses, education & healthcare',
    color: '#10B981',
    icon: '👨‍👩‍👧‍👦',
    category: 'family',
    symbols: []
  },
  {
    name: 'Investments',
    description: 'Stocks, ETFs, Mutual Funds & other investments',
    color: '#F59E0B',
    icon: '📈',
    category: 'investment',
    symbols: []
  },
  {
    name: 'Savings Goals',
    description: 'Emergency fund, vacation, big purchases',
    color: '#14B8A6',
    icon: '🏦',
    category: 'savings',
    symbols: []
  },
  {
    name: 'Home Expenses',
    description: 'Rent, utilities, maintenance & household',
    color: '#8B5CF6',
    icon: '🏠',
    category: 'home',
    symbols: []
  }
];

// ===== INITIALIZE DEFAULT GROUPS =====
async function initDefaultGroups(userId) {
  const existing = await GroupsDB.getAll(userId);
  if (existing.length > 0) return; // Already has groups

  for (const group of DEFAULT_GROUPS) {
    await GroupsDB.add(userId, group);
  }
  console.log('Default groups created');
}

// ===== RENDER GROUPS PAGE =====
async function renderGroupsPage() {
  if (!currentUser) return;
  const groups = await GroupsDB.getAll(currentUser.id);
  const holdings = await HoldingsDB.getAll(currentUser.id);
  const prices = await MarketPricesDB.getAll();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });

  const container = document.getElementById('groups-list');
  if (!container) return;

  if (groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No groups yet.</p>
        <button class="btn-primary" onclick="createDefaultGroups()" style="margin-top:12px;">
          ✨ Create Default Groups
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = groups.map(g => {
    const groupHoldings = holdings.filter(h => (g.symbols || []).includes(h.symbol));
    let totalInvested = 0, totalCurrent = 0, totalPnl = 0;
    groupHoldings.forEach(h => {
      const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
      totalInvested += m.investedINR;
      totalCurrent += m.currentValueINR;
      totalPnl += m.pnlINR;
    });
    const returns = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    const icon = g.icon || '📁';
    const color = g.color || '#6C63FF';

    return `
      <div class="group-card" style="border-left: 4px solid ${color};">
        <div class="group-header">
          <div style="width:44px; height:44px; border-radius:12px; background:${color}22; display:flex; align-items:center; justify-content:center; font-size:1.5rem; flex-shrink:0;">${icon}</div>
          <div style="flex:1; min-width:0;">
            <div class="group-name">${g.name}</div>
            ${g.description ? `<div style="font-size:0.75rem; color:var(--text-muted);">${g.description}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm btn-edit" onclick="editGroup(${g.id})">Edit</button>
            <button class="btn-sm btn-delete" onclick="deleteGroup(${g.id})">Del</button>
          </div>
        </div>
        <div class="group-stats">
          <div class="group-stat">
            <span class="group-stat-label">Invested</span>
            <span class="group-stat-value">${formatCurrency(totalInvested, 'INR', true)}</span>
          </div>
          <div class="group-stat">
            <span class="group-stat-label">Current</span>
            <span class="group-stat-value">${formatCurrency(totalCurrent, 'INR', true)}</span>
          </div>
          <div class="group-stat">
            <span class="group-stat-label">Returns</span>
            <span class="group-stat-value ${getPnLClass(returns)}">${formatPct(returns)}</span>
          </div>
        </div>
        <div class="group-stocks">
          ${groupHoldings.map(h => `<span class="group-stock-tag" style="border-color:${color}44;">${h.symbol}</span>`).join('')}
          ${groupHoldings.length === 0 ? `<span style="font-size:0.8rem; color:var(--text-muted);">No stocks assigned · <button onclick="editGroup(${g.id})" style="background:none;color:var(--primary);font-size:0.8rem;cursor:pointer;">Add stocks</button></span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ===== CREATE DEFAULT GROUPS =====
async function createDefaultGroups() {
  if (!currentUser) return;
  await initDefaultGroups(currentUser.id);
  showToast('Default groups created! ✨');
  await renderGroupsPage();
}

// ===== SHOW ADD GROUP MODAL =====
function showAddGroupModal(groupId = null) {
  const modal = document.getElementById('modal-add-group');
  if (!modal) return;

  HoldingsDB.getAll(currentUser.id).then(holdings => {
    const selector = document.getElementById('group-stocks-selector');
    if (selector) {
      if (holdings.length === 0) {
        selector.innerHTML = '<div class="empty-state small">No holdings available</div>';
      } else {
        selector.innerHTML = holdings.map(h => `
          <label class="stock-selector-item">
            <input type="checkbox" name="group-stock" value="${h.symbol}" id="gs-${h.symbol}">
            <span>${h.symbol} - ${h.name || h.symbol}</span>
          </label>
        `).join('');
      }
    }

    if (groupId) {
      GroupsDB.getAll(currentUser.id).then(groups => {
        const g = groups.find(g => g.id === groupId);
        if (g) {
          document.getElementById('group-name').value = g.name;
          document.getElementById('group-desc').value = g.description || '';
          document.getElementById('group-color').value = g.color || '#6C63FF';
          (g.symbols || []).forEach(sym => {
            const cb = document.getElementById('gs-' + sym);
            if (cb) cb.checked = true;
          });
          modal.dataset.editId = groupId;
        }
      });
    } else {
      document.getElementById('add-group-form').reset();
      document.getElementById('group-color').value = '#6C63FF';
      delete modal.dataset.editId;
    }
  });

  modal.style.display = 'flex';
}

// ===== SAVE GROUP =====
async function saveGroup(event) {
  event.preventDefault();
  const modal = document.getElementById('modal-add-group');
  const editId = modal?.dataset.editId ? parseInt(modal.dataset.editId) : null;

  const checkboxes = document.querySelectorAll('input[name="group-stock"]:checked');
  const symbols = Array.from(checkboxes).map(cb => cb.value);

  const group = {
    name: document.getElementById('group-name').value.trim(),
    description: document.getElementById('group-desc').value.trim(),
    color: document.getElementById('group-color').value,
    icon: '📁',
    symbols
  };

  if (!group.name) {
    showToast('Please enter a group name', 'error');
    return;
  }

  try {
    if (editId) {
      await GroupsDB.update(editId, group);
      showToast('Group updated!');
    } else {
      await GroupsDB.add(currentUser.id, group);
      showToast('Group created!');
    }
    closeModal('modal-add-group');
    await renderGroupsPage();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== EDIT GROUP =====
function editGroup(id) { showAddGroupModal(id); }

// ===== DELETE GROUP =====
async function deleteGroup(id) {
  if (!confirm('Delete this group?')) return;
  await GroupsDB.delete(id);
  showToast('Group deleted');
  await renderGroupsPage();
}