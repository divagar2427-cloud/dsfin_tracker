// ===== DS WEALTH TRACKER - Enhanced Groups Module (Logo Selection, No Defaults) =====

// ===== AVAILABLE GROUP LOGOS =====
const GROUP_LOGOS = [
  // Finance & Investment
  { emoji: '📈', label: 'Investments' },
  { emoji: '💰', label: 'Wealth' },
  { emoji: '🏦', label: 'Banking' },
  { emoji: '💎', label: 'Premium' },
  { emoji: '📊', label: 'Portfolio' },
  { emoji: '💹', label: 'Trading' },
  { emoji: '🪙', label: 'Savings' },
  { emoji: '💳', label: 'Finance' },
  // Family & Personal
  { emoji: '👨‍👩‍👧‍👦', label: 'Family' },
  { emoji: '👤', label: 'Personal' },
  { emoji: '🏠', label: 'Home' },
  { emoji: '🎓', label: 'Education' },
  { emoji: '🏥', label: 'Healthcare' },
  { emoji: '🚗', label: 'Vehicle' },
  // Goals
  { emoji: '🎯', label: 'Goals' },
  { emoji: '🏖️', label: 'Retirement' },
  { emoji: '🛡️', label: 'Emergency' },
  { emoji: '✈️', label: 'Travel' },
  { emoji: '🏗️', label: 'Property' },
  { emoji: '💍', label: 'Wedding' },
  // Business
  { emoji: '💼', label: 'Business' },
  { emoji: '🏢', label: 'Corporate' },
  { emoji: '🚀', label: 'Startup' },
  { emoji: '🤝', label: 'Partnership' },
  // Stocks & Markets
  { emoji: '🇮🇳', label: 'India' },
  { emoji: '🇺🇸', label: 'US' },
  { emoji: '🌍', label: 'Global' },
  { emoji: '⚡', label: 'Energy' },
  { emoji: '💊', label: 'Pharma' },
  { emoji: '🏭', label: 'Industry' },
  { emoji: '🌾', label: 'Agriculture' },
  { emoji: '🔬', label: 'Technology' },
];

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
        <p style="margin-bottom:16px;">No groups yet. Create your first group to organize your portfolio!</p>
        <button class="btn-primary" onclick="showAddGroupModal()" style="margin:0 auto; display:block;">
          + Create Group
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
    const logo = g.logo || g.icon || '📁';
    const color = g.color || '#6C63FF';

    return `
      <div class="group-card" style="border-left: 4px solid ${color};">
        <div class="group-header">
          <div style="
            width:48px; height:48px; border-radius:14px;
            background:${color}22; display:flex; align-items:center;
            justify-content:center; font-size:1.6rem; flex-shrink:0;
          ">${logo}</div>
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

// ===== SHOW ADD GROUP MODAL =====
function showAddGroupModal(groupId = null) {
  const modal = document.getElementById('modal-add-group');
  if (!modal) return;

  // Build logo selector
  const logoSelectorHtml = `
    <div style="display:flex; flex-wrap:wrap; gap:8px; max-height:160px; overflow-y:auto; padding:8px; background:var(--bg-input); border-radius:12px; border:1px solid var(--border-color);">
      ${GROUP_LOGOS.map(l => `
        <button type="button" onclick="selectGroupLogo('${l.emoji}')" id="logo-btn-${l.emoji.codePointAt(0)}" style="
          width:44px; height:44px; border-radius:10px; font-size:1.3rem;
          background:var(--glass-bg); border:2px solid transparent;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          transition:all 0.2s;
        " title="${l.label}">${l.emoji}</button>
      `).join('')}
    </div>
    <input type="hidden" id="group-logo" value="📁">
    <div id="selected-logo-display" style="margin-top:8px; font-size:0.85rem; color:var(--text-muted);">
      Selected: <span id="selected-logo-preview">📁</span>
    </div>
  `;

  // Replace color input with logo selector in modal
  const colorGroup = modal.querySelector('.form-group:has(#group-color)') ||
                     Array.from(modal.querySelectorAll('.form-group')).find(g => g.querySelector('#group-color'));

  if (colorGroup) {
    colorGroup.innerHTML = `
      <label>Group Logo</label>
      ${logoSelectorHtml}
    `;
  }

  // Populate stocks selector
  HoldingsDB.getAll(currentUser.id).then(holdings => {
    const selector = document.getElementById('group-stocks-selector');
    if (selector) {
      if (holdings.length === 0) {
        selector.innerHTML = '<div class="empty-state small">No holdings available</div>';
      } else {
        selector.innerHTML = holdings.map(h => `
          <label class="stock-selector-item">
            <input type="checkbox" name="group-stock" value="${h.symbol}" id="gs-${h.symbol}">
            <span>${h.symbol} - ${h.name || h.symbol} (${h.market === 'indian' ? '🇮🇳' : h.market === 'rsu' ? '🏢' : '🇺🇸'})</span>
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
          const logo = g.logo || g.icon || '📁';
          const logoInput = document.getElementById('group-logo');
          if (logoInput) logoInput.value = logo;
          const preview = document.getElementById('selected-logo-preview');
          if (preview) preview.textContent = logo;
          // Highlight selected logo
          selectGroupLogo(logo);
          (g.symbols || []).forEach(sym => {
            const cb = document.getElementById('gs-' + sym);
            if (cb) cb.checked = true;
          });
          modal.dataset.editId = groupId;
        }
      });
    } else {
      document.getElementById('add-group-form').reset();
      const logoInput = document.getElementById('group-logo');
      if (logoInput) logoInput.value = '📁';
      const preview = document.getElementById('selected-logo-preview');
      if (preview) preview.textContent = '📁';
      delete modal.dataset.editId;
    }
  });

  modal.style.display = 'flex';
}

// ===== SELECT GROUP LOGO =====
function selectGroupLogo(emoji) {
  const logoInput = document.getElementById('group-logo');
  if (logoInput) logoInput.value = emoji;
  const preview = document.getElementById('selected-logo-preview');
  if (preview) preview.textContent = emoji;

  // Highlight selected button
  document.querySelectorAll('[id^="logo-btn-"]').forEach(btn => {
    btn.style.borderColor = 'transparent';
    btn.style.background = 'var(--glass-bg)';
  });
  const btnId = 'logo-btn-' + emoji.codePointAt(0);
  const selectedBtn = document.getElementById(btnId);
  if (selectedBtn) {
    selectedBtn.style.borderColor = 'var(--primary)';
    selectedBtn.style.background = 'rgba(108,99,255,0.15)';
  }
}

// ===== SAVE GROUP =====
async function saveGroup(event) {
  event.preventDefault();
  const modal = document.getElementById('modal-add-group');
  const editId = modal?.dataset.editId ? parseInt(modal.dataset.editId) : null;

  const checkboxes = document.querySelectorAll('input[name="group-stock"]:checked');
  const symbols = Array.from(checkboxes).map(cb => cb.value);
  const logo = document.getElementById('group-logo')?.value || '📁';

  const group = {
    name: document.getElementById('group-name').value.trim(),
    description: document.getElementById('group-desc').value.trim(),
    logo,
    icon: logo, // backward compat
    color: '#6C63FF',
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