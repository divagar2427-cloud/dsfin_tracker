// ===== DS WEALTH TRACKER - Enhanced Goals Module with Investment Linking =====

const GOAL_ICONS = {
  house: '🏠', education: '🎓', car: '🚗', retirement: '🏖️',
  vacation: '✈️', emergency: '🛡️', wedding: '💍', business: '💼',
  other: '🎯'
};

// Expected returns by asset type (annual %)
const ASSET_EXPECTED_RETURNS = {
  epf: 8.15, ppf: 7.1, vpf: 8.15, nps: 10, fd: 7.5,
  bonds: 7, 'mutual-fund': 12, etf: 11, stocks: 15,
  gold: 8, silver: 6, realestate: 10, savings: 4,
  liquid: 6, elss: 13, ulip: 9
};

// ===== RENDER GOALS PAGE =====
async function renderGoalsPage() {
  if (!currentUser) return;
  const goals = await GoalsDB.getAll(currentUser.id);
  const assets = await AssetsDB.getAll(currentUser.id);
  const holdings = await HoldingsDB.getAll(currentUser.id);
  const prices = await MarketPricesDB.getAll();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });

  let totalTarget = 0, totalAchieved = 0, totalProgress = 0;
  const enriched = goals.map(g => {
    const calc = calculateGoalProgress(g, assets, holdings, priceMap);
    totalTarget += calc.targetAmount;
    totalAchieved += calc.currentValue;
    totalProgress += calc.progressPct;
    return { ...g, ...calc };
  });

  const avgProgress = goals.length > 0 ? totalProgress / goals.length : 0;

  setText('active-goals-count', goals.length);
  setText('goals-total-target', formatCurrency(totalTarget, 'INR', true));
  setText('goals-achieved', formatCurrency(totalAchieved, 'INR', true));
  setText('goals-avg-progress', formatPct(avgProgress));

  const container = document.getElementById('goals-list');
  if (!container) return;

  if (enriched.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p style="margin-bottom:16px;">No goals set yet. Create your first financial goal!</p>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
          ${Object.entries(GOAL_ICONS).map(([type, icon]) => `
            <button onclick="quickCreateGoal('${type}')" style="
              padding:10px 16px; border-radius:12px; background:var(--glass-bg);
              border:1px solid var(--glass-border); color:var(--text-primary);
              font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:6px;
            ">${icon} ${type.charAt(0).toUpperCase() + type.slice(1)}</button>
          `).join('')}
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = enriched.map(g => renderGoalCard(g)).join('');
}

// ===== RENDER GOAL CARD =====
function renderGoalCard(g) {
  const statusInfo = getGoalStatus(g);
  const icon = GOAL_ICONS[g.goalType] || '🎯';

  return `
    <div class="goal-card" style="border-left: 4px solid ${statusInfo.color};">
      <div class="goal-header">
        <div class="goal-icon" style="background: ${statusInfo.color}22;">${icon}</div>
        <div class="goal-info">
          <div class="goal-name">${g.name}</div>
          <div class="goal-target">Target: ${formatCurrency(g.targetAmount, 'INR', true)} by ${g.targetYear}</div>
        </div>
        <div class="goal-actions">
          <button class="btn-sm btn-edit" onclick="editGoal(${g.id})">Edit</button>
          <button class="btn-sm btn-delete" onclick="deleteGoal(${g.id})">Del</button>
        </div>
      </div>

      <!-- Status Badge -->
      <div style="margin-bottom:12px;">
        <span style="
          padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700;
          background:${statusInfo.color}22; color:${statusInfo.color}; border:1px solid ${statusInfo.color}44;
        ">${statusInfo.emoji} ${statusInfo.label}</span>
      </div>

      <!-- Progress Bar -->
      <div class="goal-progress-section">
        <div class="goal-progress-header">
          <span class="goal-progress-label">Progress</span>
          <span class="goal-progress-pct" style="color:${statusInfo.color};">${g.progressPct.toFixed(1)}%</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:${Math.min(g.progressPct, 100)}%; background:${statusInfo.color};"></div>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="goal-stats">
        <div class="goal-stat">
          <span class="goal-stat-label">Current Value</span>
          <span class="goal-stat-value">${formatCurrency(g.currentValue, 'INR', true)}</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Remaining</span>
          <span class="goal-stat-value">${formatCurrency(Math.max(0, g.inflationAdjustedTarget - g.currentValue), 'INR', true)}</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Years Left</span>
          <span class="goal-stat-value">${g.yearsLeft.toFixed(1)}</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Required SIP</span>
          <span class="goal-stat-value" style="color:var(--primary);">${formatCurrency(g.requiredMonthlySIP, 'INR', true)}/mo</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Inflation Adj. Target</span>
          <span class="goal-stat-value">${formatCurrency(g.inflationAdjustedTarget, 'INR', true)}</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Probability</span>
          <span class="goal-stat-value ${g.achievementProbability >= 70 ? 'positive' : 'negative'}">${g.achievementProbability}%</span>
        </div>
      </div>

      <!-- Recommendation -->
      ${g.recommendation ? `
        <div style="
          margin-top:12px; padding:10px 14px; border-radius:10px;
          background:${statusInfo.color}11; border:1px solid ${statusInfo.color}33;
          font-size:0.82rem; color:var(--text-secondary); line-height:1.5;
        ">
          💡 ${g.recommendation}
        </div>
      ` : ''}

      <!-- Linked Investments -->
      ${g.linkedAssets && g.linkedAssets.length > 0 ? `
        <div style="margin-top:12px;">
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">Linked Investments</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${g.linkedAssets.map(a => `
              <span style="
                padding:3px 10px; border-radius:8px; font-size:0.75rem; font-weight:600;
                background:var(--bg-input); border:1px solid var(--border-color);
              ">${a}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ===== GET GOAL STATUS =====
function getGoalStatus(goal) {
  const { progressPct, yearsLeft, requiredMonthlySIP } = goal;

  if (progressPct >= 100) {
    return { label: 'Goal Achieved!', emoji: '🎉', color: '#10B981' };
  } else if (progressPct >= 80) {
    return { label: 'Almost There', emoji: '🚀', color: '#6C63FF' };
  } else if (progressPct >= 50) {
    return { label: 'On Track', emoji: '✅', color: '#22C55E' };
  } else if (progressPct >= 25) {
    return { label: 'Slightly Behind', emoji: '⚠️', color: '#F59E0B' };
  } else {
    return { label: 'Needs Attention', emoji: '🚨', color: '#EF4444' };
  }
}

// ===== CALCULATE GOAL PROGRESS =====
function calculateGoalProgress(goal, assets = [], holdings = [], priceMap = {}) {
  const targetAmount = parseFloat(goal.targetAmount) || 0;
  const targetYear = parseInt(goal.targetYear) || new Date().getFullYear() + 5;
  const expectedReturn = parseFloat(goal.expectedReturn) || 12;
  const inflationRate = parseFloat(goal.inflationRate) || 6;

  const now = new Date();
  const yearsLeft = Math.max(targetYear - now.getFullYear() - (now.getMonth() / 12), 0);

  // Inflation-adjusted target
  const inflationAdjustedTarget = targetAmount * Math.pow(1 + inflationRate / 100, yearsLeft);

  // Calculate current value from linked assets + manual savings
  let currentValue = parseFloat(goal.currentSavings) || 0;

  // Add value from linked assets
  const linkedAssets = goal.linkedAssets || [];
  if (linkedAssets.length > 0 && assets.length > 0) {
    assets.forEach(a => {
      if (linkedAssets.includes(a.name) || linkedAssets.includes(a.assetType)) {
        const calc = calculateAssetValue(a);
        currentValue += calc.currentValue;
      }
    });
  }

  // Add value from linked holdings
  const linkedHoldings = goal.linkedHoldings || [];
  if (linkedHoldings.length > 0 && holdings.length > 0) {
    holdings.forEach(h => {
      if (linkedHoldings.includes(h.symbol)) {
        const m = calculateHoldingMetrics(h, priceMap[h.symbol]);
        currentValue += m.currentValueINR;
      }
    });
  }

  // Progress percentage
  const progressPct = inflationAdjustedTarget > 0 ? Math.min((currentValue / inflationAdjustedTarget) * 100, 100) : 0;

  // Required monthly SIP
  const r = expectedReturn / 100 / 12;
  const n = yearsLeft * 12;
  const futureValueOfCurrentSavings = currentValue * Math.pow(1 + r, n);
  const remainingAmount = Math.max(inflationAdjustedTarget - futureValueOfCurrentSavings, 0);

  let requiredMonthlySIP = 0;
  if (n > 0 && r > 0) {
    requiredMonthlySIP = remainingAmount * r / (Math.pow(1 + r, n) - 1);
  } else if (n > 0) {
    requiredMonthlySIP = remainingAmount / n;
  }

  // Achievement probability
  let achievementProbability = 0;
  if (progressPct >= 100) {
    achievementProbability = 100;
  } else if (yearsLeft <= 0) {
    achievementProbability = Math.min(Math.round(progressPct), 99);
  } else {
    const onTrackRatio = currentValue / Math.max(inflationAdjustedTarget * (1 - yearsLeft / 30), 1);
    achievementProbability = Math.min(Math.round(progressPct * 0.6 + onTrackRatio * 40), 95);
  }

  // Smart recommendation
  let recommendation = '';
  if (progressPct < 25 && yearsLeft > 2) {
    recommendation = `Start a SIP of ${formatCurrency(requiredMonthlySIP, 'INR', true)}/month to reach your goal. Consider linking EPF, PPF, or Mutual Funds.`;
  } else if (progressPct >= 25 && progressPct < 60) {
    recommendation = `Increase your monthly investment by ${formatCurrency(requiredMonthlySIP * 0.3, 'INR', true)} to stay on track.`;
  } else if (progressPct >= 60 && progressPct < 90) {
    recommendation = `You're doing well! Maintain your current investment pace to achieve this goal.`;
  } else if (progressPct >= 90) {
    recommendation = `Almost there! You need just ${formatCurrency(inflationAdjustedTarget - currentValue, 'INR', true)} more to complete this goal.`;
  }

  return {
    targetAmount,
    inflationAdjustedTarget,
    currentValue,
    progressPct,
    requiredMonthlySIP,
    yearsLeft,
    achievementProbability,
    expectedReturn,
    recommendation,
    linkedAssets
  };
}

// ===== QUICK CREATE GOAL =====
function quickCreateGoal(type) {
  const modal = document.getElementById('modal-add-goal');
  if (!modal) return;
  document.getElementById('add-goal-form').reset();
  document.getElementById('goal-type').value = type;
  document.getElementById('goal-return').value = 12;
  document.getElementById('goal-current').value = 0;
  document.getElementById('goal-inflation').value = 6;
  document.getElementById('goal-year').value = new Date().getFullYear() + 5;
  delete modal.dataset.editId;
  modal.style.display = 'flex';
}

// ===== SHOW ADD GOAL MODAL =====
function showAddGoalModal(goalId = null) {
  const modal = document.getElementById('modal-add-goal');
  if (!modal) return;

  if (goalId) {
    GoalsDB.getAll(currentUser.id).then(goals => {
      const g = goals.find(g => g.id === goalId);
      if (g) {
        document.getElementById('goal-name').value = g.name;
        document.getElementById('goal-type').value = g.goalType;
        document.getElementById('goal-target').value = g.targetAmount;
        document.getElementById('goal-year').value = g.targetYear;
        document.getElementById('goal-return').value = g.expectedReturn || 12;
        document.getElementById('goal-current').value = g.currentSavings || 0;
        document.getElementById('goal-inflation').value = g.inflationRate || 6;
        modal.dataset.editId = goalId;
      }
    });
  } else {
    document.getElementById('add-goal-form').reset();
    document.getElementById('goal-return').value = 12;
    document.getElementById('goal-current').value = 0;
    document.getElementById('goal-inflation').value = 6;
    document.getElementById('goal-year').value = new Date().getFullYear() + 5;
    delete modal.dataset.editId;
  }

  modal.style.display = 'flex';
}

// ===== SAVE GOAL =====
async function saveGoal(event) {
  event.preventDefault();
  const modal = document.getElementById('modal-add-goal');
  const editId = modal?.dataset.editId ? parseInt(modal.dataset.editId) : null;

  const goal = {
    name: document.getElementById('goal-name').value.trim(),
    goalType: document.getElementById('goal-type').value,
    targetAmount: parseFloat(document.getElementById('goal-target').value),
    targetYear: parseInt(document.getElementById('goal-year').value),
    expectedReturn: parseFloat(document.getElementById('goal-return').value) || 12,
    currentSavings: parseFloat(document.getElementById('goal-current').value) || 0,
    inflationRate: parseFloat(document.getElementById('goal-inflation').value) || 6,
    linkedAssets: [],
    linkedHoldings: []
  };

  if (!goal.name || !goal.targetAmount || !goal.targetYear) {
    showToast('Please fill required fields', 'error');
    return;
  }

  try {
    if (editId) {
      await GoalsDB.update(editId, goal);
      showToast('Goal updated!');
    } else {
      await GoalsDB.add(currentUser.id, goal);
      showToast('Goal created! 🎯');
    }
    closeModal('modal-add-goal');
    await renderGoalsPage();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== EDIT GOAL =====
function editGoal(id) { showAddGoalModal(id); }

// ===== DELETE GOAL =====
async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  await GoalsDB.delete(id);
  showToast('Goal deleted');
  await renderGoalsPage();
}