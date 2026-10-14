import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  calculateFinancialSummary,
  safePercentage,
  roundCurrency,
  toDateString,
  evaluateSavingsFeasibility
} from '../src/services/financeCalculator.js';

describe('Financial Math & Deterministic Calculations', () => {
  test('correctly calculates balance from opening balance, income, and expenses', () => {
    const transactions = [
      { id: '1', type: 'income', amount: 25000, category: 'Salary', date: '2026-10-01' },
      { id: '2', type: 'expense', amount: 5000, category: 'Groceries', classification: 'need', date: '2026-10-02' },
      { id: '3', type: 'expense', amount: 2000, category: 'Entertainment', classification: 'want', date: '2026-10-03' },
      { id: '4', type: 'income', amount: 1500, category: 'Refunds', date: '2026-10-04' } // Refund handled as income
    ];

    const result = calculateFinancialSummary({
      transactions,
      openingBalance: 10000,
      referenceDate: new Date('2026-10-10')
    });

    // Opening: 10,000 + Income: (25,000 + 1,500 = 26,500) - Expense: (5,000 + 2,000 = 7,000)
    // Balance should be: 10,000 + 26,500 - 7,000 = 29,500
    assert.strictEqual(result.openingBalance, 10000);
    assert.strictEqual(result.totalIncome, 26500);
    assert.strictEqual(result.totalExpenses, 7000);
    assert.strictEqual(result.currentBalance, 29500);
    assert.strictEqual(result.netSavings, 19500);
  });

  test('zero-denominator safeguards return 0% and do not crash on empty expenses', () => {
    assert.strictEqual(safePercentage(100, 0), 0);
    assert.strictEqual(safePercentage(0, 0), 0);
    assert.strictEqual(safePercentage(-5, 0), 0);

    const emptyResult = calculateFinancialSummary({
      transactions: [],
      openingBalance: 5000
    });

    assert.strictEqual(emptyResult.totalIncome, 0);
    assert.strictEqual(emptyResult.totalExpenses, 0);
    assert.strictEqual(emptyResult.currentBalance, 5000);
    assert.strictEqual(emptyResult.savingsRate, 0);
    assert.strictEqual(emptyResult.needsVsWants.needs.percentage, 0);
    assert.strictEqual(emptyResult.needsVsWants.wants.percentage, 0);
  });

  test('computes Needs vs Wants totals and percentages accurately', () => {
    const transactions = [
      { id: '1', type: 'expense', amount: 600, category: 'Hostel', classification: 'need', date: '2026-10-01' },
      { id: '2', type: 'expense', amount: 300, category: 'Shopping', classification: 'want', date: '2026-10-02' },
      { id: '3', type: 'expense', amount: 100, category: 'Other', classification: 'unclassified', date: '2026-10-03' }
    ];

    const result = calculateFinancialSummary({
      transactions,
      openingBalance: 0
    });

    assert.strictEqual(result.totalExpenses, 1000);
    assert.strictEqual(result.needsVsWants.needs.amount, 600);
    assert.strictEqual(result.needsVsWants.needs.percentage, 60);
    assert.strictEqual(result.needsVsWants.wants.amount, 300);
    assert.strictEqual(result.needsVsWants.wants.percentage, 30);
    assert.strictEqual(result.needsVsWants.unclassified.amount, 100);
    assert.strictEqual(result.needsVsWants.unclassified.percentage, 10);
    assert.strictEqual(result.needsVsWants.fiftyThirtyTwentyEvaluation.isNeedsOverBudget, true);
    assert.strictEqual(result.needsVsWants.fiftyThirtyTwentyEvaluation.isWantsOverBudget, false);
  });

  test('correctly evaluates budget thresholds (ok, warning >=80%, exceeded >=100%)', () => {
    const transactions = [
      { id: '1', type: 'expense', amount: 850, category: 'Food', date: '2026-10-02' },
      { id: '2', type: 'expense', amount: 1200, category: 'Entertainment', date: '2026-10-03' },
      { id: '3', type: 'expense', amount: 200, category: 'Transport', date: '2026-10-04' }
    ];

    const budgets = [
      { category: 'Food', limit: 1000 },          // 85% -> warning
      { category: 'Entertainment', limit: 1000 }, // 120% -> exceeded
      { category: 'Transport', limit: 1000 }      // 20% -> ok
    ];

    const result = calculateFinancialSummary({
      transactions,
      budgets,
      referenceDate: new Date('2026-10-10')
    });

    const foodStatus = result.budgetStatuses.find(b => b.category === 'Food');
    const entStatus = result.budgetStatuses.find(b => b.category === 'Entertainment');
    const transStatus = result.budgetStatuses.find(b => b.category === 'Transport');

    assert.strictEqual(foodStatus.status, 'warning');
    assert.strictEqual(foodStatus.percentage, 85);
    assert.strictEqual(entStatus.status, 'exceeded');
    assert.strictEqual(entStatus.percentage, 120);
    assert.strictEqual(transStatus.status, 'ok');
    assert.strictEqual(transStatus.percentage, 20);
  });

  test('correctly handles month-over-month difference and percent change', () => {
    const transactions = [
      // September 2026 (last month)
      { id: '1', type: 'expense', amount: 4000, category: 'Food', date: '2026-09-15' },
      // October 2026 (this month)
      { id: '2', type: 'expense', amount: 6000, category: 'Food', date: '2026-10-05' }
    ];

    const result = calculateFinancialSummary({
      transactions,
      referenceDate: new Date('2026-10-12')
    });

    assert.strictEqual(result.timeframes.thisMonth.expense, 6000);
    assert.strictEqual(result.timeframes.lastMonth.expense, 4000);
    assert.strictEqual(result.timeframes.monthOverMonth.difference, 2000);
    assert.strictEqual(result.timeframes.monthOverMonth.percentageChange, 50);
    assert.strictEqual(result.timeframes.monthOverMonth.trend, 'increased');
  });

  test('toDateString reliably normalizes ISO strings, local dates, and YYYY-MM-DD strings', () => {
    assert.strictEqual(toDateString('2026-10-13'), '2026-10-13');
    assert.strictEqual(toDateString('2026-10-13T14:30:00.000Z'), '2026-10-13');
    assert.strictEqual(toDateString(''), '');
  });

  test('correctly calculates today expenses broken down by category using clientToday', () => {
    const transactions = [
      { id: '1', type: 'expense', amount: 350, category: 'Food', date: '2026-10-13' },
      { id: '2', type: 'expense', amount: 150, category: 'Transport', date: '2026-10-13' },
      { id: '3', type: 'expense', amount: 500, category: 'Food', date: '2026-10-12' }, // yesterday
      { id: '4', type: 'income', amount: 2000, category: 'Freelance', date: '2026-10-13' }
    ];

    const result = calculateFinancialSummary({
      transactions,
      openingBalance: 5000,
      clientToday: '2026-10-13'
    });

    assert.strictEqual(result.timeframes.today.date, '2026-10-13');
    assert.strictEqual(result.timeframes.today.expense, 500); // 350 food + 150 transport
    assert.strictEqual(result.timeframes.today.income, 2000);
    assert.strictEqual(result.timeframes.today.expensesByCategory['Food'], 350);
    assert.strictEqual(result.timeframes.today.expensesByCategory['Transport'], 150);
    assert.strictEqual(result.timeframes.today.transactionCount, 3);
  });

  test('evaluateSavingsFeasibility flags missing income and asks clarifying question', () => {
    const feasibility = evaluateSavingsFeasibility({
      targetAmount: 1000,
      currentBalance: 500,
      totalIncome: 0,
      totalExpenses: 200,
      thisMonthIncome: 0,
      thisMonthExpense: 200,
      wantsExpense: 50
    });

    assert.strictEqual(feasibility.status, 'missing_income');
    assert.strictEqual(feasibility.feasible, null);
    assert.ok(feasibility.clarifyingQuestion.includes('income'));
  });

  test('evaluateSavingsFeasibility approves target when monthly surplus or balance covers it', () => {
    const feasibilitySurplus = evaluateSavingsFeasibility({
      targetAmount: 1000,
      currentBalance: 12000,
      totalIncome: 25000,
      totalExpenses: 8000,
      thisMonthIncome: 25000,
      thisMonthExpense: 8000,
      wantsExpense: 2000
    });

    assert.strictEqual(feasibilitySurplus.status, 'feasible_from_monthly_surplus');
    assert.strictEqual(feasibilitySurplus.feasible, true);
    assert.strictEqual(feasibilitySurplus.monthlySurplusAfterSavings, 16000);

    const feasibilityBalance = evaluateSavingsFeasibility({
      targetAmount: 1000,
      currentBalance: 3000,
      totalIncome: 5000,
      totalExpenses: 4500,
      thisMonthIncome: 5000,
      thisMonthExpense: 4500,
      wantsExpense: 1200
    });

    assert.strictEqual(feasibilityBalance.status, 'feasible_from_balance');
    assert.strictEqual(feasibilityBalance.feasible, true);
    assert.strictEqual(feasibilityBalance.balanceRemaining, 2000);
  });
});
