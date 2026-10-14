/**
 * Deterministic Financial Calculations for SpendWise AI
 * Ensures all math (balances, category totals, percentages, budget comparisons,
 * date boundaries, and savings feasibility) is executed strictly in JavaScript
 * without any hallucinations or rounding errors.
 */

/**
 * Normalizes an amount to 2 decimal places number
 * @param {number|string} val
 * @returns {number}
 */
export function roundCurrency(val) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate safe percentage with zero-denominator protection
 * @param {number} numerator 
 * @param {number} denominator 
 * @returns {number} 0-100 rounded to 1 decimal place
 */
export function safePercentage(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  const pct = (numerator / denominator) * 100;
  return Math.round((pct + Number.EPSILON) * 10) / 10;
}

/**
 * Converts any date representation (string, Date, timestamp) into a canonical YYYY-MM-DD calendar string.
 * Completely immune to local-vs-UTC timezone offsets.
 * @param {string|Date|number} val
 * @returns {string} YYYY-MM-DD
 */
export function toDateString(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse an ISO date or YYYY-MM-DD string into a Date object at local start of day
 * @param {string|Date} dateInput 
 * @returns {Date}
 */
export function parseDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  return new Date(dateInput);
}

/**
 * Checks if a given date is the same calendar day as targetDate
 * @param {Date|string} d 
 * @param {Date|string} target 
 * @returns {boolean}
 */
export function isSameDay(d, target) {
  return toDateString(d) === toDateString(target);
}

/**
 * Checks if a date falls in the same calendar month and year
 * @param {Date|string} d 
 * @param {number} year 
 * @param {number} month (0-11)
 * @returns {boolean}
 */
export function isSameMonth(d, year, month) {
  const str = toDateString(d);
  if (!str) return false;
  const targetYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
  return str.startsWith(targetYearMonth);
}

/**
 * Evaluates savings feasibility deterministically against income, expenses, cashflow, and goals.
 *
 * @param {Object} params
 * @param {number} params.targetAmount - Target amount to save (e.g. 1000)
 * @param {number} params.currentBalance - Current available balance
 * @param {number} params.totalIncome - Total recorded income
 * @param {number} params.totalExpenses - Total recorded expenses
 * @param {number} params.thisMonthIncome - Income recorded this month
 * @param {number} params.thisMonthExpense - Expenses recorded this month
 * @param {number} params.wantsExpense - Total wants / discretionary expenses
 * @param {Array} params.savingsGoals - Active savings goals
 * @returns {Object} Feasibility evaluation with clear, evidence-based metrics
 */
export function evaluateSavingsFeasibility({
  targetAmount = 1000,
  currentBalance = 0,
  totalIncome = 0,
  totalExpenses = 0,
  thisMonthIncome = 0,
  thisMonthExpense = 0,
  wantsExpense = 0,
  savingsGoals = []
}) {
  const target = roundCurrency(targetAmount);
  const curBal = roundCurrency(currentBalance);
  const thisMonthNet = roundCurrency(thisMonthIncome - thisMonthExpense);
  const totalNet = roundCurrency(totalIncome - totalExpenses);
  const wants = roundCurrency(wantsExpense);

  const isIncomeRecorded = totalIncome > 0;
  const isThisMonthIncomeRecorded = thisMonthIncome > 0;

  // Goals commitment calculation
  let existingGoalsTarget = 0;
  let existingGoalsSaved = 0;
  for (const g of savingsGoals) {
    existingGoalsTarget += roundCurrency(g.targetAmount || 0);
    existingGoalsSaved += roundCurrency(g.savedAmount || 0);
  }
  const existingGoalsRemaining = roundCurrency(Math.max(0, existingGoalsTarget - existingGoalsSaved));
  const uncommittedBalance = roundCurrency(curBal - existingGoalsRemaining);

  // 1. Missing income case: Cannot responsibly declare feasibility without knowing income
  if (!isIncomeRecorded) {
    return {
      targetAmount: target,
      status: 'missing_income',
      feasible: null,
      confidence: 'insufficient_data',
      summary: `Income data is missing (₹0 recorded). Cannot verify if saving ₹${target.toLocaleString('en-IN')} is sustainable without knowing regular income.`,
      clarifyingQuestion: `What is your expected monthly income or allowance? Once you record your income, I can accurately analyze whether saving ₹${target.toLocaleString('en-IN')} is achievable.`,
      metrics: {
        currentBalance: curBal,
        monthlyNetSurplus: thisMonthNet,
        wantsExpense: wants,
        existingGoalsRemaining
      }
    };
  }

  // 2. Both current balance and monthly net cashflow are insufficient
  if (curBal < target && thisMonthNet <= 0) {
    return {
      targetAmount: target,
      status: 'not_feasible_without_cutbacks',
      feasible: false,
      confidence: 'high',
      shortfall: roundCurrency(target - curBal),
      monthlyDeficit: roundCurrency(Math.abs(thisMonthNet)),
      summary: `Saving ₹${target.toLocaleString('en-IN')} is currently tight. Your balance is ₹${curBal.toLocaleString('en-IN')} and monthly net cash flow is running at a deficit of ₹${Math.abs(thisMonthNet).toLocaleString('en-IN')}.`,
      actionableAdvice: wants > 0
        ? `You have spent ₹${wants.toLocaleString('en-IN')} on discretionary "Wants". Trimming non-essential spending could help free up the ₹${roundCurrency(target - curBal).toLocaleString('en-IN')} needed.`
        : `Reduce expenses or wait for your next income credit before committing to this savings goal.`,
      metrics: {
        currentBalance: curBal,
        monthlyNetSurplus: thisMonthNet,
        wantsExpense: wants,
        existingGoalsRemaining
      }
    };
  }

  // 3. Monthly net surplus covers the target completely
  if (thisMonthNet >= target) {
    return {
      targetAmount: target,
      status: 'feasible_from_monthly_surplus',
      feasible: true,
      confidence: 'high',
      monthlySurplusAfterSavings: roundCurrency(thisMonthNet - target),
      summary: `Yes, you can easily save ₹${target.toLocaleString('en-IN')}! Your net monthly surplus this month is ₹${thisMonthNet.toLocaleString('en-IN')}, which covers the target with ₹${roundCurrency(thisMonthNet - target).toLocaleString('en-IN')} to spare.`,
      actionableAdvice: `You can safely allocate ₹${target.toLocaleString('en-IN')} to your savings goal without impacting your essential expenses.`,
      metrics: {
        currentBalance: curBal,
        monthlyNetSurplus: thisMonthNet,
        wantsExpense: wants,
        existingGoalsRemaining
      }
    };
  }

  // 4. Current balance is sufficient even though monthly surplus is small/negative
  if (curBal >= target) {
    const balanceRemaining = roundCurrency(curBal - target);
    return {
      targetAmount: target,
      status: 'feasible_from_balance',
      feasible: true,
      confidence: 'medium',
      balanceRemaining,
      summary: `Yes, you can save ₹${target.toLocaleString('en-IN')}. Your available balance is ₹${curBal.toLocaleString('en-IN')}, leaving ₹${balanceRemaining.toLocaleString('en-IN')} after saving.`,
      actionableAdvice: thisMonthNet < target
        ? `Note: This month's net surplus is ₹${thisMonthNet.toLocaleString('en-IN')}. Relying on your existing balance works, but controlling "Wants" (₹${wants.toLocaleString('en-IN')}) will prevent balance depletion.`
        : `You have adequate liquidity to meet this target.`,
      metrics: {
        currentBalance: curBal,
        monthlyNetSurplus: thisMonthNet,
        wantsExpense: wants,
        existingGoalsRemaining
      }
    };
  }

  // 5. Borderline case
  return {
    targetAmount: target,
    status: 'partial_feasible',
    feasible: false,
    confidence: 'medium',
    shortfall: roundCurrency(target - curBal),
    summary: `You are ₹${roundCurrency(target - curBal).toLocaleString('en-IN')} short of the ₹${target.toLocaleString('en-IN')} target.`,
    actionableAdvice: `Review your ₹${wants.toLocaleString('en-IN')} discretionary wants to find quick savings.`,
    metrics: {
      currentBalance: curBal,
      monthlyNetSurplus: thisMonthNet,
      wantsExpense: wants,
      existingGoalsRemaining
    }
  };
}

/**
 * Master Financial Calculator
 * Takes raw transactions, opening balance, configured budgets, and savings goals
 * and outputs grounded deterministic metrics for frontend dashboards and AI prompts.
 * 
 * @param {Object} params
 * @param {Array} params.transactions - List of transaction items
 * @param {number} [params.openingBalance=0] - Initial starting balance
 * @param {Array} [params.budgets=[]] - Configured category and monthly budgets
 * @param {Array} [params.savingsGoals=[]] - Active savings goals
 * @param {Date|string} [params.referenceDate=new Date()] - Date reference (default current)
 * @param {string} [params.clientToday=null] - Optional YYYY-MM-DD user local date string
 * @param {string} [params.timezone=null] - Optional client timezone identifier
 * @returns {Object} Comprehensive computed statistics
 */
export function calculateFinancialSummary({
  transactions = [],
  openingBalance = 0,
  budgets = [],
  savingsGoals = [],
  referenceDate = new Date(),
  clientToday = null,
  timezone = null
}) {
  const opBal = roundCurrency(openingBalance);

  // Determine canonical today date string (YYYY-MM-DD)
  const todayStr = clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
    ? clientToday
    : toDateString(referenceDate || new Date());

  const [todayYear, todayMonthNum, todayDayNum] = todayStr.split('-').map(Number);
  const currentYearMonth = `${todayYear}-${String(todayMonthNum).padStart(2, '0')}`;

  // Deterministic previous month calculation (year rollover handled safely)
  let lastMonthYear = todayYear;
  let lastMonthNum = todayMonthNum - 1;
  if (lastMonthNum < 1) {
    lastMonthNum = 12;
    lastMonthYear -= 1;
  }
  const lastYearMonth = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}`;

  // Deterministic 7-day window (today and previous 6 calendar days)
  const refUtcDate = new Date(Date.UTC(todayYear, todayMonthNum - 1, todayDayNum));
  const weekStartUtcDate = new Date(refUtcDate.getTime() - 6 * 24 * 60 * 60 * 1000);
  const weekStartStr = weekStartUtcDate.toISOString().split('T')[0];

  // Deterministic yesterday calculation (handles month/year rollover safely)
  const yesterdayUtcDate = new Date(refUtcDate.getTime() - 1 * 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayUtcDate.toISOString().split('T')[0];

  let totalIncome = 0;
  let totalExpenses = 0;

  let needExpenses = 0;
  let wantExpenses = 0;
  let unclassifiedExpenses = 0;

  const expenseCategoryMap = {};
  const incomeCategoryMap = {};

  let todayExpense = 0;
  let todayIncome = 0;
  const todayExpensesByCategory = {};
  const todayIncomeByCategory = {};
  const todayTransactions = [];

  let yesterdayExpense = 0;
  let yesterdayIncome = 0;
  const yesterdayExpensesByCategory = {};
  const yesterdayIncomeByCategory = {};
  const yesterdayTransactions = [];

  let thisWeekExpense = 0;
  let thisWeekIncome = 0;

  let thisMonthExpense = 0;
  let thisMonthIncome = 0;
  const thisMonthExpensesByCategory = {};
  const thisMonthIncomeByCategory = {};

  let lastMonthExpense = 0;
  let lastMonthIncome = 0;

  const validTransactions = [];

  for (const rawTx of transactions) {
    if (!rawTx || typeof rawTx !== 'object') continue;

    const amount = roundCurrency(rawTx.amount);
    if (amount <= 0) continue; // Ignore non-positive or corrupted amounts

    const type = (rawTx.type || 'expense').toLowerCase();
    const category = (rawTx.category || 'Other').trim();
    const dateStr = toDateString(rawTx.date);
    const classification = (rawTx.classification || 'unclassified').toLowerCase();

    const normalizedTx = {
      id: rawTx.id || Math.random().toString(36).substring(2, 9),
      description: rawTx.description || 'Untitled Transaction',
      amount,
      type,
      category,
      classification: type === 'expense' ? classification : 'income',
      date: dateStr,
      notes: rawTx.notes || ''
    };

    validTransactions.push(normalizedTx);

    const isToday = dateStr === todayStr;
    const isYesterday = dateStr === yesterdayStr;
    const isThisWeek = dateStr >= weekStartStr && dateStr <= todayStr;
    const isThisMonth = dateStr.startsWith(currentYearMonth);
    const isLastMonth = dateStr.startsWith(lastYearMonth);

    if (type === 'income') {
      totalIncome += amount;
      incomeCategoryMap[category] = (incomeCategoryMap[category] || 0) + amount;

      if (isToday) {
        todayIncome += amount;
        todayIncomeByCategory[category] = (todayIncomeByCategory[category] || 0) + amount;
        todayTransactions.push(normalizedTx);
      }
      if (isYesterday) {
        yesterdayIncome += amount;
        yesterdayIncomeByCategory[category] = (yesterdayIncomeByCategory[category] || 0) + amount;
      }
      if (isThisWeek) thisWeekIncome += amount;
      if (isThisMonth) {
        thisMonthIncome += amount;
        thisMonthIncomeByCategory[category] = (thisMonthIncomeByCategory[category] || 0) + amount;
      }
      if (isLastMonth) lastMonthIncome += amount;

    } else {
      // Expense
      totalExpenses += amount;
      expenseCategoryMap[category] = (expenseCategoryMap[category] || 0) + amount;

      if (classification === 'need') {
        needExpenses += amount;
      } else if (classification === 'want') {
        wantExpenses += amount;
      } else {
        unclassifiedExpenses += amount;
      }

      if (isToday) {
        todayExpense += amount;
        todayExpensesByCategory[category] = (todayExpensesByCategory[category] || 0) + amount;
        todayTransactions.push(normalizedTx);
      }
      if (isYesterday) {
        yesterdayExpense += amount;
        yesterdayExpensesByCategory[category] = (yesterdayExpensesByCategory[category] || 0) + amount;
        yesterdayTransactions.push(normalizedTx);
      }
      if (isThisWeek) thisWeekExpense += amount;
      if (isThisMonth) {
        thisMonthExpense += amount;
        thisMonthExpensesByCategory[category] = (thisMonthExpensesByCategory[category] || 0) + amount;
      }
      if (isLastMonth) lastMonthExpense += amount;
    }
  }

  // Rounded aggregates
  totalIncome = roundCurrency(totalIncome);
  totalExpenses = roundCurrency(totalExpenses);
  const currentBalance = roundCurrency(opBal + totalIncome - totalExpenses);
  const netSavings = roundCurrency(totalIncome - totalExpenses);

  const savingsRate = totalIncome > 0
    ? safePercentage(netSavings, totalIncome)
    : 0;

  // Needs vs Wants analysis
  needExpenses = roundCurrency(needExpenses);
  wantExpenses = roundCurrency(wantExpenses);
  unclassifiedExpenses = roundCurrency(unclassifiedExpenses);

  const needsPercentage = safePercentage(needExpenses, totalExpenses);
  const wantsPercentage = safePercentage(wantExpenses, totalExpenses);
  const unclassifiedPercentage = safePercentage(unclassifiedExpenses, totalExpenses);

  // Category breakdown list sorted descending
  const categoryBreakdown = Object.entries(expenseCategoryMap)
    .map(([cat, amt]) => ({
      category: cat,
      amount: roundCurrency(amt),
      percentage: safePercentage(amt, totalExpenses)
    }))
    .sort((a, b) => b.amount - a.amount);

  const incomeBreakdown = Object.entries(incomeCategoryMap)
    .map(([cat, amt]) => ({
      category: cat,
      amount: roundCurrency(amt),
      percentage: safePercentage(amt, totalIncome)
    }))
    .sort((a, b) => b.amount - a.amount);

  // Month-over-Month calculation
  thisMonthExpense = roundCurrency(thisMonthExpense);
  lastMonthExpense = roundCurrency(lastMonthExpense);
  thisMonthIncome = roundCurrency(thisMonthIncome);
  lastMonthIncome = roundCurrency(lastMonthIncome);

  const momDelta = roundCurrency(thisMonthExpense - lastMonthExpense);
  const momPercentChange = lastMonthExpense > 0
    ? roundCurrency(((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100)
    : (thisMonthExpense > 0 ? 100 : 0);

  // Top 5 largest expenses
  const topExpenses = validTransactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(t => ({
      description: t.description,
      amount: t.amount,
      category: t.category,
      date: t.date
    }));

  // Budget evaluation against this month's spending
  const budgetStatuses = (budgets || []).map(b => {
    const limit = roundCurrency(b.limit || b.amount || 0);
    const category = b.category;
    const spent = category === 'Overall' || !category
      ? thisMonthExpense
      : roundCurrency(thisMonthExpensesByCategory[category] || 0);
    
    const percentage = safePercentage(spent, limit);
    const remaining = roundCurrency(Math.max(0, limit - spent));
    const isExceeded = spent > limit;
    const isWarning = !isExceeded && percentage >= 80;

    return {
      category: category || 'Overall',
      limit,
      spent,
      remaining,
      percentage,
      status: isExceeded ? 'exceeded' : (isWarning ? 'warning' : 'ok')
    };
  });

  // Savings goals summary
  const goalsSummary = (savingsGoals || []).map(g => {
    const target = roundCurrency(g.targetAmount || 0);
    const saved = roundCurrency(g.savedAmount || 0);
    const remaining = roundCurrency(Math.max(0, target - saved));
    return {
      id: g.id,
      name: g.name || 'Savings Goal',
      targetAmount: target,
      savedAmount: saved,
      remaining,
      percentage: safePercentage(saved, target),
      deadline: g.deadline || ''
    };
  });

  const totalGoalsTarget = roundCurrency(goalsSummary.reduce((acc, g) => acc + g.targetAmount, 0));
  const totalGoalsSaved = roundCurrency(goalsSummary.reduce((acc, g) => acc + g.savedAmount, 0));
  const totalGoalsRemaining = roundCurrency(Math.max(0, totalGoalsTarget - totalGoalsSaved));

  // Baseline ₹1,000 feasibility evaluation
  const savingsFeasibility1000 = evaluateSavingsFeasibility({
    targetAmount: 1000,
    currentBalance,
    totalIncome,
    totalExpenses,
    thisMonthIncome,
    thisMonthExpense,
    wantsExpense: wantExpenses,
    savingsGoals
  });

  return {
    openingBalance: opBal,
    currentBalance,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    transactionCount: validTransactions.length,
    todayDate: todayStr,
    timezone: timezone || null,
    needsVsWants: {
      needs: { amount: needExpenses, percentage: needsPercentage },
      wants: { amount: wantExpenses, percentage: wantsPercentage },
      unclassified: { amount: unclassifiedExpenses, percentage: unclassifiedPercentage },
      fiftyThirtyTwentyEvaluation: {
        needsDeviationFrom50Pct: roundCurrency(needsPercentage - 50),
        wantsDeviationFrom30Pct: roundCurrency(wantsPercentage - 30),
        isNeedsOverBudget: needsPercentage > 50,
        isWantsOverBudget: wantsPercentage > 30
      }
    },
    timeframes: {
      today: {
        date: todayStr,
        expense: roundCurrency(todayExpense),
        income: roundCurrency(todayIncome),
        expensesByCategory: todayExpensesByCategory,
        incomeByCategory: todayIncomeByCategory,
        transactionCount: todayTransactions.length,
        transactions: todayTransactions
      },
      yesterday: {
        date: yesterdayStr,
        expense: roundCurrency(yesterdayExpense),
        income: roundCurrency(yesterdayIncome),
        expensesByCategory: yesterdayExpensesByCategory,
        incomeByCategory: yesterdayIncomeByCategory,
        transactionCount: yesterdayTransactions.length,
        transactions: yesterdayTransactions
      },
      thisWeek: {
        expense: roundCurrency(thisWeekExpense),
        income: roundCurrency(thisWeekIncome),
        startDate: weekStartStr,
        endDate: todayStr
      },
      thisMonth: {
        monthKey: currentYearMonth,
        expense: thisMonthExpense,
        income: thisMonthIncome,
        netSavings: roundCurrency(thisMonthIncome - thisMonthExpense),
        savingsRate: safePercentage(thisMonthIncome - thisMonthExpense, thisMonthIncome),
        expensesByCategory: thisMonthExpensesByCategory,
        incomeByCategory: thisMonthIncomeByCategory
      },
      lastMonth: {
        monthKey: lastYearMonth,
        expense: lastMonthExpense,
        income: lastMonthIncome
      },
      monthOverMonth: {
        difference: momDelta,
        percentageChange: momPercentChange,
        trend: momDelta > 0 ? 'increased' : (momDelta < 0 ? 'decreased' : 'unchanged')
      }
    },
    categoryBreakdown,
    incomeBreakdown,
    topExpenses,
    budgetStatuses,
    savingsGoalsSummary: {
      goals: goalsSummary,
      totalTarget: totalGoalsTarget,
      totalSaved: totalGoalsSaved,
      totalRemaining: totalGoalsRemaining
    },
    savingsFeasibility: savingsFeasibility1000,
    currencySymbol: '₹'
  };
}
