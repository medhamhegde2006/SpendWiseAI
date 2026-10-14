import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  generateStudentDemoData
} from '../utils/categories.js';
import {
  computeDashboardStats,
  filterTransactionsByDate,
  buildMonthlyChartSeries,
  buildSpendingTrendSeries,
  roundCurrency
} from '../services/financeStats.js';
import {
  loadUserFinanceData,
  saveUserFinanceData,
  getInitialUserData,
  backupRealRecords,
  hasRealBackup,
  restoreRealRecords,
  saveCloudTransaction,
  deleteCloudTransaction,
  saveCloudBudget,
  deleteCloudBudget,
  saveCloudSavingsGoal,
  deleteCloudSavingsGoal,
  batchMigrateLocalToCloud
} from '../services/storageService.js';

export const useFinanceStore = defineStore('finance', () => {
  const activeUserId = ref('guest_local');
  const isCloudMode = ref(false);
  const isLoading = ref(false);
  const cloudSyncError = ref(null);

  // Core Financial State
  const openingBalance = ref(8500);
  const transactions = ref([]);
  const budgets = ref([]);
  const savingsGoals = ref([]);
  const customCategories = ref({ income: [], expense: [] });
  const isDemoActive = ref(false);
  const hasBackup = ref(false);

  // Dashboard Filter State
  const dateFilter = ref('all'); // 'all' | 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'custom'
  const customStartDate = ref('');
  const customEndDate = ref('');

  // Computed Categories (Defaults + User Custom Categories)
  const incomeCategories = computed(() => {
    const custom = customCategories.value?.income || [];
    return [...new Set([...DEFAULT_INCOME_CATEGORIES, ...custom])];
  });

  const expenseCategories = computed(() => {
    const custom = customCategories.value?.expense || [];
    return [...new Set([...DEFAULT_EXPENSE_CATEGORIES, ...custom])];
  });

  // Filtered Transactions based on selected Date Range
  const dateFilteredTransactions = computed(() => {
    return filterTransactionsByDate(
      transactions.value,
      dateFilter.value,
      customStartDate.value,
      customEndDate.value
    );
  });

  // Master Computed Dashboard Metrics
  const stats = computed(() => {
    return computeDashboardStats({
      allTransactions: transactions.value,
      filteredTransactions: dateFilteredTransactions.value,
      openingBalance: openingBalance.value,
      budgets: budgets.value
    });
  });

  // Chart Series
  const monthlyChartSeries = computed(() => buildMonthlyChartSeries(transactions.value));
  const spendingTrendSeries = computed(() => buildSpendingTrendSeries(transactions.value));

  /**
   * Persist current state to storage (both local and Cloud Firestore)
   */
  async function persistState() {
    const payload = {
      openingBalance: openingBalance.value,
      transactions: transactions.value,
      budgets: budgets.value,
      savingsGoals: savingsGoals.value,
      customCategories: customCategories.value,
      isDemoActive: isDemoActive.value
    };
    const res = await saveUserFinanceData(activeUserId.value, payload, isCloudMode.value);
    if (res && res.error) {
      cloudSyncError.value = res.error;
    } else {
      cloudSyncError.value = null;
    }
    hasBackup.value = hasRealBackup(activeUserId.value);
  }

  /**
   * Initialize financial state for a given user
   */
  async function initFinanceData(userId = 'guest_local', isCloud = false) {
    isLoading.value = true;
    activeUserId.value = userId;
    isCloudMode.value = isCloud;
    cloudSyncError.value = null;

    try {
      const saved = await loadUserFinanceData(userId, isCloud);
      if (saved) {
        openingBalance.value = roundCurrency(saved.openingBalance ?? 8500);
        transactions.value = Array.isArray(saved.transactions) ? saved.transactions : [];
        budgets.value = Array.isArray(saved.budgets) ? saved.budgets : [];
        savingsGoals.value = Array.isArray(saved.savingsGoals) ? saved.savingsGoals : [];
        customCategories.value = saved.customCategories || { income: [], expense: [] };
        isDemoActive.value = isCloud ? false : Boolean(saved.isDemoActive);
      } else {
        if (isCloud) {
          // Fresh authenticated cloud user: initialize with clean slate
          const clean = getInitialUserData();
          openingBalance.value = clean.openingBalance;
          transactions.value = [];
          budgets.value = clean.budgets;
          savingsGoals.value = clean.savingsGoals;
          customCategories.value = { income: [], expense: [] };
          isDemoActive.value = false;
          await persistState();
        } else {
          // First time offline guest: load realistic student demo dataset
          const demo = generateStudentDemoData();
          openingBalance.value = demo.openingBalance;
          transactions.value = demo.transactions;
          budgets.value = demo.budgets;
          savingsGoals.value = demo.savingsGoals;
          customCategories.value = { income: [], expense: [] };
          isDemoActive.value = true;
          await persistState();
        }
      }
      hasBackup.value = hasRealBackup(userId);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Resets in-memory store completely when logging out or switching accounts
   * to guarantee zero data leakage between sessions.
   */
  function resetStateForLogout() {
    activeUserId.value = '';
    isCloudMode.value = false;
    openingBalance.value = 0;
    transactions.value = [];
    budgets.value = [];
    savingsGoals.value = [];
    customCategories.value = { income: [], expense: [] };
    isDemoActive.value = false;
    hasBackup.value = false;
    cloudSyncError.value = null;
  }

  /**
   * Update Opening Balance
   */
  async function updateOpeningBalance(newAmount) {
    const num = roundCurrency(newAmount);
    if (num < 0) throw new Error('Opening balance cannot be negative.');
    openingBalance.value = num;
    isDemoActive.value = false;
    await persistState();
  }

  /**
   * Add a new transaction with validation and Firestore sync
   */
  async function addTransaction(txInput) {
    const amount = roundCurrency(txInput.amount);
    if (amount <= 0) {
      throw new Error('Transaction amount must be greater than zero.');
    }
    if (!txInput.description || !txInput.description.trim()) {
      throw new Error('Description is required.');
    }
    if (!txInput.category) {
      throw new Error('Category is required.');
    }

    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: txInput.type === 'income' ? 'income' : 'expense',
      amount,
      description: txInput.description.trim(),
      category: txInput.category.trim(),
      classification: txInput.type === 'income' ? 'income' : (txInput.classification || 'unclassified'),
      date: txInput.date || new Date().toISOString().split('T')[0],
      notes: (txInput.notes || '').trim(),
      createdAt: new Date().toISOString()
    };

    transactions.value = [newTx, ...transactions.value];
    isDemoActive.value = false;
    await persistState();

    if (isCloudMode.value) {
      saveCloudTransaction(activeUserId.value, newTx).catch(err => {
        cloudSyncError.value = err.message;
      });
    }

    return newTx;
  }

  /**
   * Edit an existing transaction and sync to Firestore
   */
  async function updateTransaction(id, updatedFields) {
    const idx = transactions.value.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transaction not found.');

    const amount = roundCurrency(updatedFields.amount);
    if (amount <= 0) throw new Error('Amount must be greater than zero.');

    const existing = transactions.value[idx];
    const updated = {
      ...existing,
      ...updatedFields,
      amount,
      description: (updatedFields.description || existing.description).trim(),
      classification: updatedFields.type === 'income' ? 'income' : (updatedFields.classification || existing.classification),
      updatedAt: new Date().toISOString()
    };

    const copy = [...transactions.value];
    copy[idx] = updated;
    transactions.value = copy;
    isDemoActive.value = false;
    await persistState();

    if (isCloudMode.value) {
      saveCloudTransaction(activeUserId.value, updated).catch(err => {
        cloudSyncError.value = err.message;
      });
    }

    return updated;
  }

  /**
   * Delete a transaction by ID
   */
  async function deleteTransaction(id) {
    transactions.value = transactions.value.filter(t => t.id !== id);
    isDemoActive.value = false;
    await persistState();

    if (isCloudMode.value) {
      deleteCloudTransaction(activeUserId.value, id).catch(err => {
        cloudSyncError.value = err.message;
      });
    }
  }

  /**
   * Add a custom category
   */
  async function addCustomCategory(type, name) {
    const clean = (name || '').trim();
    if (!clean) return;
    const target = type === 'income' ? 'income' : 'expense';
    const existingList = target === 'income' ? incomeCategories.value : expenseCategories.value;
    if (existingList.some(c => c.toLowerCase() === clean.toLowerCase())) {
      return; // Already exists
    }
    customCategories.value[target] = [...(customCategories.value[target] || []), clean];
    isDemoActive.value = false;
    await persistState();
  }

  /**
   * Save or update a monthly category budget
   */
  async function saveBudget({ category, limit }) {
    const cleanLimit = roundCurrency(limit);
    if (cleanLimit <= 0) throw new Error('Budget limit must be greater than zero.');

    let budgetItem = null;
    const existingIdx = budgets.value.findIndex(b => b.category === category);
    if (existingIdx > -1) {
      budgetItem = { ...budgets.value[existingIdx], limit: cleanLimit };
      const copy = [...budgets.value];
      copy[existingIdx] = budgetItem;
      budgets.value = copy;
    } else {
      budgetItem = { id: 'b_' + Date.now(), category, limit: cleanLimit };
      budgets.value = [...budgets.value, budgetItem];
    }

    isDemoActive.value = false;
    await persistState();

    if (isCloudMode.value && budgetItem) {
      saveCloudBudget(activeUserId.value, budgetItem).catch(err => {
        cloudSyncError.value = err.message;
      });
    }
  }

  /**
   * Remove a budget limit
   */
  async function deleteBudget(id) {
    budgets.value = budgets.value.filter(b => b.id !== id);
    isDemoActive.value = false;
    await persistState();

    if (isCloudMode.value) {
      deleteCloudBudget(activeUserId.value, id).catch(err => {
        cloudSyncError.value = err.message;
      });
    }
  }

  /**
   * Add or update a savings goal
   */
  async function saveSavingsGoal(goalInput) {
    const targetAmount = roundCurrency(goalInput.targetAmount);
    const savedAmount = roundCurrency(goalInput.savedAmount || 0);
    if (targetAmount <= 0) throw new Error('Target amount must be greater than zero.');

    let goalItem = null;
    if (goalInput.id) {
      const idx = savingsGoals.value.findIndex(g => g.id === goalInput.id);
      if (idx > -1) {
        goalItem = { ...savingsGoals.value[idx], ...goalInput, targetAmount, savedAmount };
        const copy = [...savingsGoals.value];
        copy[idx] = goalItem;
        savingsGoals.value = copy;
      }
    }

    if (!goalItem) {
      goalItem = {
        id: 'sg_' + Date.now(),
        name: goalInput.name.trim(),
        targetAmount,
        savedAmount,
        deadline: goalInput.deadline || ''
      };
      savingsGoals.value = [...savingsGoals.value, goalItem];
    }

    isDemoActive.value = false;
    await persistState();

    if (isCloudMode.value && goalItem) {
      saveCloudSavingsGoal(activeUserId.value, goalItem).catch(err => {
        cloudSyncError.value = err.message;
      });
    }
  }

  /**
   * Delete a savings goal
   */
  async function deleteSavingsGoal(id) {
    savingsGoals.value = savingsGoals.value.filter(g => g.id !== id);
    isDemoActive.value = false;
    await persistState();

    if (isCloudMode.value) {
      deleteCloudSavingsGoal(activeUserId.value, id).catch(err => {
        cloudSyncError.value = err.message;
      });
    }
  }

  /**
   * Migrates local dataset to current cloud user account
   */
  async function migrateLocalDataToCloud(localData) {
    if (!isCloudMode.value || !activeUserId.value) {
      throw new Error('Cannot migrate: user is not in authenticated cloud mode.');
    }
    const result = await batchMigrateLocalToCloud(activeUserId.value, localData);
    // Reload state from cloud
    await initFinanceData(activeUserId.value, true);
    return result;
  }

  /**
   * Load Sample Demo Data safely (backs up user records before loading demo dataset)
   */
  async function loadSampleDemoData() {
    if (transactions.value.length > 0) {
      backupRealRecords(activeUserId.value, {
        openingBalance: openingBalance.value,
        transactions: transactions.value,
        budgets: budgets.value,
        savingsGoals: savingsGoals.value,
        customCategories: customCategories.value,
        isDemoActive: false
      });
    }

    const demo = generateStudentDemoData();
    openingBalance.value = demo.openingBalance;
    transactions.value = demo.transactions;
    budgets.value = demo.budgets;
    savingsGoals.value = demo.savingsGoals;
    isDemoActive.value = true;
    await persistState();
  }

  /**
   * Restore user's real records from backup
   */
  async function restoreRealUserData() {
    const restored = restoreRealRecords(activeUserId.value);
    if (restored) {
      openingBalance.value = restored.openingBalance;
      transactions.value = restored.transactions || [];
      budgets.value = restored.budgets || [];
      savingsGoals.value = restored.savingsGoals || [];
      customCategories.value = restored.customCategories || { income: [], expense: [] };
      isDemoActive.value = false;
      await persistState();
    }
  }

  /**
   * Reset / Clear account to empty state
   */
  async function resetToEmptyAccount() {
    if (transactions.value.length > 0) {
      backupRealRecords(activeUserId.value, {
        openingBalance: openingBalance.value,
        transactions: transactions.value,
        budgets: budgets.value,
        savingsGoals: savingsGoals.value,
        customCategories: customCategories.value,
        isDemoActive: false
      });
    }

    const clean = getInitialUserData();
    openingBalance.value = clean.openingBalance;
    transactions.value = [];
    budgets.value = clean.budgets;
    savingsGoals.value = [];
    isDemoActive.value = false;
    await persistState();
  }

  return {
    activeUserId,
    isCloudMode,
    isLoading,
    cloudSyncError,
    openingBalance,
    transactions,
    budgets,
    savingsGoals,
    customCategories,
    isDemoActive,
    hasBackup,
    dateFilter,
    customStartDate,
    customEndDate,
    incomeCategories,
    expenseCategories,
    dateFilteredTransactions,
    stats,
    monthlyChartSeries,
    spendingTrendSeries,
    initFinanceData,
    resetStateForLogout,
    updateOpeningBalance,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCustomCategory,
    saveBudget,
    deleteBudget,
    saveSavingsGoal,
    deleteSavingsGoal,
    migrateLocalDataToCloud,
    loadSampleDemoData,
    restoreRealUserData,
    resetToEmptyAccount
  };
});
