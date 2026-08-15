// ===== DS WEALTH TRACKER - Groups Module =====

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
    container.innerHTML = '<div class="empty-state">No groups created. Create custom groups to organize your portfolio.</div>';
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

    return `
      <div class="group-card">
        <div class="group-header">
          <div class="group-color-dot" style="background: ${g.color || '#6C63FF'}; width:16px; height:16px; border-radius:50%;"></div>
          <span class="group-name">${g.name}</span>
          <span class="group-count">${groupHoldings.length} stocks</span>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm btn-edit" onclick="editGroup(${g.id})">Edit</button>
            <button class="btn-sm btn-delete" onclick="deleteGroup(${g.id})">Del</button>
          </div>
        </div>
        ${g.description ? `<p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">${g.description}</p>` : ''}
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
          ${groupHoldings.map(h => `<span class="group-stock-tag">${h.symbol}</span>`).join('')}
          ${groupHoldings.length === 0 ? '<span style="font-size:0.8rem; color:var(--text-muted);">No stocks assigned</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ===== SHOW ADD GROUP MODAL =====
function showAddGroupModal(groupId = null) {
  const modal = document.getElementById('modal-add-group');
  if (!modal) return;

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
          // Check selected stocks
          (g.symbols || []).forEach(sym => {
            const cb = document.getElementById(`gs-${sym}`);
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

  modal.classList.remove('hidden');
}

// ===== SAVE GROUP =====
async function saveGroup(event) {
  event.preventDefault();
  const modal = document.getElementById('modal-add-group');
  const editId = modal?.dataset.editId ? parseInt(modal.dataset.editId) : null;

  // Get selected symbols
  const checkboxes = document.querySelectorAll('input[name="group-stock"]:checked');
  const symbols = Array.from(checkboxes).map(cb => cb.value);

  const group = {
    name: document.getElementById('group-name').value.trim(),
    description: document.getElementById('group-desc').value.trim(),
    color: document.getElementById('group-color').value,
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
function editGroup(id) {
  showAddGroupModal(id);
}

// ===== DELETE GROUP =====
async function deleteGroup(id) {
  if (!confirm('Delete this group?')) return;
  await GroupsDB.delete(id);
  showToast('Group deleted');
  await renderGroupsPage();
}