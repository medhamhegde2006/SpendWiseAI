/**
 * Frontend Deterministic Financial Statistics Engine
 * Mirrors backend calculations and builds Chart.js series for instant reactive UI updates.
 */

export function roundCurrency(val) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function safePercentage(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  const pct = (numerator / denominator) * 100;
  return Math.round((pct + Number.EPSILON) * 10) / 10;
}

/**
 * Filters transactions by selected date range filter
 * @param {Array} transactions
 * @param {string} dateRange ('all' | 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'custom')
 * @param {string} [customStart]
 * @param {string} [customEnd]
 * @returns {Array}
 */
export function filterTransactionsByDate(transactions = [], dateRange = 'all', customStart = '', customEnd = '') {
  if (!dateRange || dateRange === 'all') return transactions;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  const lastMonthDate = new Date(curYear, curMonth - 1, 1);
  const lastYear = lastMonthDate.getFullYear();
  const lastMonth = lastMonthDate.getMonth();

  return transactions.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return false;

    if (dateRange === 'today') {
      return t.date === todayStr;
    }
    if (dateRange === 'week') {
      return d >= startOfWeek && d <= now;
    }
    if (dateRange === 'thisMonth') {
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    }
    if (dateRange === 'lastMonth') {
      return d.getFullYear() === lastYear && d.getMonth() === lastMonth;
    }
    if (dateRange === 'custom') {
      const afterStart = customStart ? t.date >= customStart : true;
      const beforeEnd = customEnd ? t.date <= customEnd : true;
      return afterStart && beforeEnd;
    }
    return true;
  });
}

/**
 * Computes full dashboard statistics from transactions, openingBalance, and budgets
 */
export function computeDashboardStats({
  allTransactions = [],
  filteredTransactions = null,
  openingBalance = 0,
  budgets = []
}) {
  const opBal = roundCurrency(openingBalance);
  const txList = filteredTransactions !== null ? filteredTransactions : allTransactions;

  // Overall Account Balance always uses ALL transactions so account balance is consistent
  let globalIncome = 0;
  let globalExpenses = 0;
  for (const t of allTransactions) {
    const amt = roundCurrency(t.amount);
    if (amt <= 0) continue;
    if (t.type === 'income') globalIncome += amt;
    else globalExpenses += amt;
  }
  const currentBalance = roundCurrency(opBal + globalIncome - globalExpenses);

  // Filtered view metrics
  let periodIncome = 0;
  let periodExpenses = 0;
  let needAmount = 0;
  let wantAmount = 0;
  let unclassifiedAmount = 0;

  const categoryTotals = {};
  const incomeCategoryTotals = {};

  for (const t of txList) {
    const amt = roundCurrency(t.amount);
    if (amt <= 0) continue;

    if (t.type === 'income') {
      periodIncome += amt;
      incomeCategoryTotals[t.category] = (incomeCategoryTotals[t.category] || 0) + amt;
    } else {
      periodExpenses += amt;
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;

      const cls = (t.classification || 'unclassified').toLowerCase();
      if (cls === 'need') needAmount += amt;
      else if (cls === 'want') wantAmount += amt;
      else unclassifiedAmount += amt;
    }
  }

  periodIncome = roundCurrency(periodIncome);
  periodExpenses = roundCurrency(periodExpenses);
  const netFlow = roundCurrency(periodIncome - periodExpenses);
  const savingsRate = periodIncome > 0 ? safePercentage(netFlow, periodIncome) : 0;

  // Needs vs Wants
  const needsVsWants = {
    needs: {
      amount: roundCurrency(needAmount),
      percentage: safePercentage(needAmount, periodExpenses)
    },
    wants: {
      amount: roundCurrency(wantAmount),
      percentage: safePercentage(wantAmount, periodExpenses)
    },
    unclassified: {
      amount: roundCurrency(unclassifiedAmount),
      percentage: safePercentage(unclassifiedAmount, periodExpenses)
    }
  };

  // Category Breakdown
  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount: roundCurrency(amount),
      percentage: safePercentage(amount, periodExpenses)
    }))
    .sort((a, b) => b.amount - a.amount);

  // Daily & Weekly summaries (always relative to current date across allTransactions)
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  let todaySpend = 0;
  let yesterdaySpend = 0;
  let weekSpend = 0;
  let currentMonthSpend = 0;
  let currentMonthIncome = 0;
  const currentMonthByCategory = {};

  for (const t of allTransactions) {
    const amt = roundCurrency(t.amount);
    if (amt <= 0) continue;
    const d = new Date(t.date);

    if (t.type === 'income') {
      if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
        currentMonthIncome += amt;
      }
      continue;
    }

    if (t.date === todayStr) todaySpend += amt;
    if (t.date === yesterdayStr) yesterdaySpend += amt;
    if (d >= weekAgo && d <= now) weekSpend += amt;
    if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
      currentMonthSpend += amt;
      currentMonthByCategory[t.category] = (currentMonthByCategory[t.category] || 0) + amt;
    }
  }

  // Evaluate budgets against current month spending
  const budgetEvaluations = (budgets || []).map(b => {
    const limit = roundCurrency(b.limit);
    const spent = b.category === 'Overall'
      ? roundCurrency(currentMonthSpend)
      : roundCurrency(currentMonthByCategory[b.category] || 0);
    const percentage = safePercentage(spent, limit);
    const remaining = roundCurrency(Math.max(0, limit - spent));
    const overAmount = roundCurrency(Math.max(0, spent - limit));
    const status = spent > limit ? 'exceeded' : (percentage >= 80 ? 'warning' : 'ok');

    return {
      ...b,
      limit,
      spent,
      percentage,
      remaining,
      overAmount,
      status
    };
  });

  // Active budget alerts (warning or exceeded)
  const activeAlerts = budgetEvaluations.filter(b => b.status === 'warning' || b.status === 'exceeded');

  return {
    openingBalance: opBal,
    currentBalance,
    globalIncome: roundCurrency(globalIncome),
    globalExpenses: roundCurrency(globalExpenses),
    periodIncome,
    periodExpenses,
    netFlow,
    savingsRate,
    needsVsWants,
    categoryBreakdown,
    todaySpend: roundCurrency(todaySpend),
    yesterdaySpend: roundCurrency(yesterdaySpend),
    weekSpend: roundCurrency(weekSpend),
    currentMonthSpend: roundCurrency(currentMonthSpend),
    currentMonthIncome: roundCurrency(currentMonthIncome),
    budgetEvaluations,
    activeAlerts
  };
}

/**
 * Generates Monthly Bar Chart Data (Last 6 Months Income vs Expenses)
 */
export function buildMonthlyChartSeries(allTransactions = []) {
  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    months.push({ key, label, income: 0, expense: 0 });
  }

  const monthMap = Object.fromEntries(months.map(m => [m.key, m]));

  for (const t of allTransactions) {
    if (!t.date) continue;
    const key = t.date.substring(0, 7); // YYYY-MM
    if (monthMap[key]) {
      const amt = roundCurrency(t.amount);
      if (t.type === 'income') monthMap[key].income = roundCurrency(monthMap[key].income + amt);
      else monthMap[key].expense = roundCurrency(monthMap[key].expense + amt);
    }
  }

  return {
    labels: months.map(m => m.label),
    incomeData: months.map(m => m.income),
    expenseData: months.map(m => m.expense)
  };
}

/**
 * Generates Daily Spending Trend Line Series (Last 14 Days)
 */
export function buildSpendingTrendSeries(allTransactions = []) {
  const now = new Date();
  const days = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    days.push({ dateStr, label, expense: 0 });
  }

  const dayMap = Object.fromEntries(days.map(d => [d.dateStr, d]));

  for (const t of allTransactions) {
    if (t.type !== 'expense' || !t.date) continue;
    if (dayMap[t.date]) {
      dayMap[t.date].expense = roundCurrency(dayMap[t.date].expense + roundCurrency(t.amount));
    }
  }

  return {
    labels: days.map(d => d.label),
    data: days.map(d => d.expense)
  };
}
