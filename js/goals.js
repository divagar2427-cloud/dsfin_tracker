// ===== DS WEALTH TRACKER - Goals Module =====

const GOAL_ICONS = {
  house: '🏠', education: '🎓', car: '🚗', retirement: '🏖️',
  vacation: '✈️', emergency: '🛡️', other: '🎯'
};

// ===== RENDER GOALS PAGE =====
async function renderGoalsPage() {
  if (!currentUser) return;
  const goals = await GoalsDB.getAll(currentUser.id);

  let totalTarget = 0, totalAchieved = 0, totalProgress = 0;
  const enriched = goals.map(g => {
    const calc = calculateGoalProgress(g);
    totalTarget += calc.targetAmount;
    totalAchieved += calc.currentSavings;
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
    container.innerHTML = '<div class="empty-state">No goals set yet. Click + Add to create your first goal.</div>';
    return;
  }

  container.innerHTML = enriched.map(g => `
    <div class="goal-card">
      <div class="goal-header">
        <div class="goal-icon">${GOAL_ICONS[g.goalType] || '🎯'}</div>
        <div class="goal-info">
          <div class="goal-name">${g.name}</div>
          <div class="goal-target">Target: ${formatCurrency(g.targetAmount, 'INR', true)} by ${g.targetYear}</div>
        </div>
        <div class="goal-actions">
          <button class="btn-sm btn-edit" onclick="editGoal(${g.id})">Edit</button>
          <button class="btn-sm btn-delete" onclick="deleteGoal(${g.id})">Del</button>
        </div>
      </div>
      <div class="goal-progress-section">
        <div class="goal-progress-header">
          <span class="goal-progress-label">Progress</span>
          <span class="goal-progress-pct">${g.progressPct.toFixed(1)}%</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width: ${Math.min(g.progressPct, 100)}%"></div>
        </div>
      </div>
      <div class="goal-stats">
        <div class="goal-stat">
          <span class="goal-stat-label">Saved</span>
          <span class="goal-stat-value">${formatCurrency(g.currentSavings, 'INR', true)}</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Monthly SIP</span>
          <span class="goal-stat-value">${formatCurrency(g.requiredMonthlySIP, 'INR', true)}</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Inflation Adj.</span>
          <span class="goal-stat-value">${formatCurrency(g.inflationAdjustedTarget, 'INR', true)}</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Years Left</span>
          <span class="goal-stat-value">${g.yearsLeft.toFixed(1)}</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Expected Return</span>
          <span class="goal-stat-value">${g.expectedReturn}%</span>
        </div>
        <div class="goal-stat">
          <span class="goal-stat-label">Probability</span>
          <span class="goal-stat-value ${g.achievementProbability >= 70 ? 'positive' : 'negative'}">${g.achievementProbability}%</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== CALCULATE GOAL PROGRESS =====
function calculateGoalProgress(goal) {
  const targetAmount = parseFloat(goal.targetAmount) || 0;
  const targetYear = parseInt(goal.targetYear) || new Date().getFullYear() + 5;
  const expectedReturn = parseFloat(goal.expectedReturn) || 12;
  const currentSavings = parseFloat(goal.currentSavings) || 0;
  const inflationRate = parseFloat(goal.inflationRate) || 6;

  const now = new Date();
  const yearsLeft = Math.max(targetYear - now.getFullYear(), 0);

  // Inflation-adjusted target
  const inflationAdjustedTarget = targetAmount * Math.pow(1 + inflationRate / 100, yearsLeft);

  // Progress percentage
  const progressPct = inflationAdjustedTarget > 0 ? (currentSavings / inflationAdjustedTarget) * 100 : 0;

  // Required monthly SIP to reach goal
  const r = expectedReturn / 100 / 12; // Monthly rate
  const n = yearsLeft * 12; // Number of months
  const futureValueOfCurrentSavings = currentSavings * Math.pow(1 + r, n);
  const remainingAmount = Math.max(inflationAdjustedTarget - futureValueOfCurrentSavings, 0);

  let requiredMonthlySIP = 0;
  if (n > 0 && r > 0) {
    requiredMonthlySIP = remainingAmount * r / (Math.pow(1 + r, n) - 1);
  } else if (n > 0) {
    requiredMonthlySIP = remainingAmount / n;
  }

  // Achievement probability (simplified)
  let achievementProbability = 0;
  if (progressPct >= 100) {
    achievementProbability = 100;
  } else if (yearsLeft <= 0) {
    achievementProbability = progressPct >= 100 ? 100 : Math.min(progressPct, 99);
  } else {
    // Based on how much is saved vs required
    const savingsRatio = currentSavings / Math.max(inflationAdjustedTarget * 0.1, 1);
    achievementProbability = Math.min(Math.round(progressPct * 0.7 + savingsRatio * 30), 95);
  }

  return {
    targetAmount,
    inflationAdjustedTarget,
    currentSavings,
    progressPct: Math.min(progressPct, 100),
    requiredMonthlySIP,
    yearsLeft,
    achievementProbability,
    expectedReturn
  };
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
    inflationRate: parseFloat(document.getElementById('goal-inflation').value) || 6
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
      showToast('Goal added!');
    }
    closeModal('modal-add-goal');
    await renderGoalsPage();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== EDIT GOAL =====
function editGoal(id) {
  showAddGoalModal(id);
}

// ===== DELETE GOAL =====
async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  await GoalsDB.delete(id);
  showToast('Goal deleted');
  await renderGoalsPage();
}
