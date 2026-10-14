import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SPENDWISE_SYSTEM_PROMPT, buildGroundedContext } from '../prompts/systemPrompt.js';
import { evaluateSavingsFeasibility } from './financeCalculator.js';

// Ensure server/.env is loaded reliably regardless of execution working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
export const SUPPORTED_GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-safeguard-20b',
  'qwen/qwen3.8-27b'
];

let groqClient = null;
let cachedKeyFingerprint = null;

let quotaCooldownUntil = 0;
let lastCooldownReason = null;

/**
 * Strips any potential API keys or Bearer tokens from error strings before logging or returning.
 * Ensures secrets are NEVER exposed in console logs, errors, or client responses.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeErrorMessage(text) {
  if (!text) return 'Unknown error';
  return String(text)
    .replace(/gsk_[0-9A-Za-z_-]{20,}/g, 'gsk_***REDACTED***')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza***REDACTED***')
    .replace(/AQ\.[0-9A-Za-z-_]+/g, 'AQ.***REDACTED***')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***REDACTED***')
    .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer ***REDACTED***')
    .replace(/key=[A-Za-z0-9_.-]+/gi, 'key=***REDACTED***');
}

/**
 * Checks whether a valid Groq API key is configured in server/.env.
 * Never logs or exposes the key.
 * @returns {{ configured: boolean, reason: string | null }}
 */
export function getGroqConfigStatus() {
  const rawKey = process.env.GROQ_API_KEY;
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
    return { configured: false, reason: 'missing_groq_api_key' };
  }

  const trimmed = rawKey.trim();
  if (
    trimmed.includes('your_groq_api_key') ||
    trimmed.includes('your-groq-api-key') ||
    trimmed === 'gsk_...'
  ) {
    return { configured: false, reason: 'placeholder_api_key' };
  }

  if (!trimmed.startsWith('gsk_') || trimmed.length < 20) {
    return { configured: false, reason: 'invalid_key_format' };
  }

  return { configured: true, reason: null };
}

/**
 * Resolves the configured Groq model name safely against supported models.
 * @returns {{ model: string, warning: string | null }}
 */
export function getConfiguredGroqModel() {
  const rawModel = (process.env.GROQ_MODEL || '').trim();
  if (!rawModel) {
    return { model: DEFAULT_GROQ_MODEL, warning: null };
  }
  if (!SUPPORTED_GROQ_MODELS.includes(rawModel)) {
    return {
      model: rawModel,
      warning: `Configured model "${rawModel}" is not in the standard list (${SUPPORTED_GROQ_MODELS.join(', ')}).`
    };
  }
  return { model: rawModel, warning: null };
}

/**
 * Initializes or returns the singleton official Groq SDK client.
 */
export function getGroqClient() {
  const status = getGroqConfigStatus();
  if (!status.configured) {
    return null;
  }

  const trimmedKey = process.env.GROQ_API_KEY.trim();
  const fingerprint = `${trimmedKey.length}:${trimmedKey.slice(-4)}`;

  if (!groqClient || cachedKeyFingerprint !== fingerprint) {
    groqClient = new Groq({
      apiKey: trimmedKey
    });
    cachedKeyFingerprint = fingerprint;
  }

  return groqClient;
}

/**
 * Returns current GroqCloud API rate-limit cooldown status.
 * Prevents hammering the API endpoint when quota or rate limits are active.
 */
export function getGroqCooldownStatus() {
  const now = Date.now();
  if (now < quotaCooldownUntil) {
    return {
      active: true,
      remainingSeconds: Math.ceil((quotaCooldownUntil - now) / 1000),
      reason: lastCooldownReason
    };
  }
  return { active: false, remainingSeconds: 0, reason: null };
}

/**
 * Sets an active cooldown backoff window.
 */
export function triggerGroqCooldown(seconds = 30, reason = null) {
  quotaCooldownUntil = Date.now() + (seconds * 1000);
  lastCooldownReason = reason;
}

/**
 * Resets any active Groq quota cooldown (used in tests or key rotation).
 */
export function resetGroqCooldown() {
  quotaCooldownUntil = 0;
  lastCooldownReason = null;
}

/**
 * Classifies Groq SDK errors into safe, user-friendly diagnostics without exposing secrets.
 * @param {Error|any} err
 * @returns {{ code: string, safeMessage: string, status: number, retryAfterSeconds?: number | null }}
 */
export function classifyGroqError(err) {
  const status = err?.status || err?.statusCode || 0;
  const rawMsg = sanitizeErrorMessage(err?.message || 'Groq API request failed');
  const lowerMsg = rawMsg.toLowerCase();

  if (
    status === 401 ||
    lowerMsg.includes('invalid api key') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('invalid_api_key')
  ) {
    return {
      code: 'invalid_api_key',
      safeMessage: 'Invalid or unauthorized Groq API key. Check GROQ_API_KEY in server/.env.',
      status: 401
    };
  }

  if (status === 403 || lowerMsg.includes('permission_denied') || lowerMsg.includes('forbidden')) {
    return {
      code: 'permission_denied',
      safeMessage: 'Permission denied for this Groq API key or project.',
      status: 403
    };
  }

  if (
    status === 429 ||
    lowerMsg.includes('rate_limit_exceeded') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('too many requests')
  ) {
    let retryAfterSeconds = null;
    const retryHeader = err?.headers?.['retry-after'] || err?.response?.headers?.get?.('retry-after');
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10);
      if (!isNaN(parsed) && parsed > 0) retryAfterSeconds = parsed;
    }
    const match = lowerMsg.match(/retry\s+in\s+([0-9.]+)\s*s/i) || lowerMsg.match(/wait\s+([0-9.]+)\s*s/i);
    if (match) {
      retryAfterSeconds = Math.ceil(parseFloat(match[1]));
    }

    const isQuota = lowerMsg.includes('quota');
    return {
      code: isQuota ? 'quota_exceeded' : 'rate_limited',
      safeMessage: isQuota
        ? 'GroqCloud quota exhausted (HTTP 429). Using offline deterministic engine.'
        : 'GroqCloud rate limit reached (HTTP 429). Using offline deterministic engine.',
      status: 429,
      retryAfterSeconds
    };
  }

  if (status === 404 || lowerMsg.includes('model_not_found') || lowerMsg.includes('does not exist')) {
    return {
      code: 'model_unavailable',
      safeMessage: 'Configured Groq model was not found or is unavailable for this API key.',
      status: 404
    };
  }

  if (
    status === 408 ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('econnaborted')
  ) {
    return {
      code: 'timeout_error',
      safeMessage: 'Request to GroqCloud timed out. Using offline deterministic engine.',
      status: 408
    };
  }

  if (
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('network')
  ) {
    return {
      code: 'network_error',
      safeMessage: 'Network error while connecting to GroqCloud servers.',
      status: 503
    };
  }

  return {
    code: 'groq_api_error',
    safeMessage: rawMsg,
    status: status || 500
  };
}

/**
 * Checks whether user query is a conversational greeting without specific financial query terms.
 * @param {string} text
 * @returns {boolean}
 */
export function isGreetingQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase().replace(/[!?.,;:~]/g, '').trim();
  if (!clean) return false;

  // Specific financial keywords that turn a message into an active financial inquiry
  const financialKeywords = [
    'food', 'spend', 'spent', 'spending', 'save', 'saving', 'savings', 'money',
    'balance', 'income', 'expense', 'expenses', 'breakdown', 'budget', 'budgets',
    'goal', 'goals', 'need', 'needs', 'want', 'wants', 'compare', 'yesterday',
    'today', 'month', 'week', 'last month', 'this month', 'ratio', 'limit', 'overview',
    'summary', 'report', 'ledger', 'transaction', 'transactions'
  ];

  const hasFinancialTopic = financialKeywords.some(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(clean);
  });

  if (hasFinancialTopic) {
    return false;
  }

  const greetingRegex = /^(hi+|hello+|hey+|heyy+|greetings|good\s*(morning|afternoon|evening|day)|yo+|sup|what'?s\s*up|whats\s*up|howdy|namaste)(\s+(there|spendwise|ai|assistant|friend|bot))?$/i;

  return greetingRegex.test(clean);
}

/**
 * Generates a warm, natural greeting that introduces SpendWise AI
 * without dumping financial balances or transactions.
 * @returns {string}
 */
export function generateGreetingResponse() {
  return `Hello! 👋 I'm **SpendWise AI**, your personal finance advisor powered by GroqCloud.

I can analyze your transactions, monitor your budgets, and provide grounded insights into your spending habits.

Here are a few questions you can ask me:
• *"Where did my money go?"* — Breakdown of your top spending categories
• *"How much did I spend on food today?"* — Today's verified food expenses
• *"Can I save ₹1,000?"* — Savings feasibility check based on your cash flow
• *"Compare this month with last month"* — Month-over-month trend analysis

What would you like to check today?`;
}

/**
 * Deterministic rules-based fallback engine for when Groq is unconfigured or unavailable.
 * Guarantees zero hallucinations and 100% mathematical precision.
 */
export function generateDeterministicFallback(message, summary = {}) {
  const q = (message || '').toLowerCase();
  const currency = summary.currencySymbol || '₹';

  // 1. Natural greeting handling
  if (isGreetingQuery(message)) {
    return generateGreetingResponse();
  }

  // 2. Yesterday spend query
  if (q.includes('yesterday')) {
    const yExpense = summary.timeframes?.yesterday?.expense ?? 0;
    const yCatMap = summary.timeframes?.yesterday?.expensesByCategory || {};
    const yEntries = Object.entries(yCatMap);
    if (yExpense > 0) {
      const catList = yEntries.map(([cat, amt]) => `• **${cat}**: ${currency}${Number(amt).toLocaleString('en-IN')}`).join('\n');
      return `Yesterday, you spent a total of **${currency}${yExpense.toLocaleString('en-IN')}**.\n\n**Category Breakdown Yesterday:**\n${catList}`;
    }
    return `You spent **${currency}0** yesterday (no expense transactions were recorded on ${summary.timeframes?.yesterday?.date || 'yesterday'}).`;
  }

  // 3. Last 7 days / Past week spend
  if (q.includes('last 7 days') || q.includes('past 7 days') || q.includes('past week') || q.includes('this week') || q.includes('weekly spend')) {
    const weekExp = summary.timeframes?.thisWeek?.expense ?? 0;
    const weekInc = summary.timeframes?.thisWeek?.income ?? 0;
    const startD = summary.timeframes?.thisWeek?.startDate || '';
    const endD = summary.timeframes?.thisWeek?.endDate || '';
    return `**Last 7 Days Spending (${startD} to ${endD}):**\n\n• **Total Expenses**: **${currency}${weekExp.toLocaleString('en-IN')}**\n• **Total Income**: ${currency}${weekInc.toLocaleString('en-IN')}\n• **Net Flow (7 Days)**: ${currency}${(weekInc - weekExp).toLocaleString('en-IN')}\n• **Average Daily Spend**: ${currency}${Math.round(weekExp / 7).toLocaleString('en-IN')}/day`;
  }

  // 4. Highest spending category query
  if (
    q.includes('highest spending category') ||
    q.includes('highest category') ||
    q.includes('biggest category') ||
    q.includes('spend the most on') ||
    q.includes('highest expense category') ||
    q.includes('top spending category')
  ) {
    if (!summary.categoryBreakdown || summary.categoryBreakdown.length === 0) {
      return `You have no recorded expenses yet! Once you log expenses, I will identify your highest spending category.`;
    }
    const highest = summary.categoryBreakdown[0];
    return `Your highest spending category is **${highest.category}**.\n\n• **Amount Spent**: **${currency}${highest.amount.toLocaleString('en-IN')}**\n• **Share of Total Expenses**: **${highest.percentage}%** (out of ${currency}${(summary.totalExpenses ?? 0).toLocaleString('en-IN')} total expenses).`;
  }

  // 5. Budgets near limit query (80% - 99%)
  if (
    q.includes('near limit') ||
    q.includes('near their limit') ||
    q.includes('budgets near') ||
    q.includes('warning budget') ||
    q.includes('budget warning') ||
    q.includes('approaching limit')
  ) {
    const nearLimits = (summary.budgetStatuses || []).filter(b => b.status === 'warning' || (b.percentage >= 80 && b.percentage < 100));
    if (nearLimits.length === 0) {
      return `✅ None of your budgets are currently near their limit (all active budgets are below 80% utilization).`;
    }
    const list = nearLimits.map(b => `• **${b.category}**: Spent ${currency}${b.spent.toLocaleString('en-IN')} / Limit ${currency}${b.limit.toLocaleString('en-IN')} (${b.percentage}%) — **${currency}${b.remaining.toLocaleString('en-IN')} remaining**`).join('\n');
    return `⚠️ **Budgets Near Limit (≥80% utilized):**\n\n${list}\n\nKeep an eye on these categories for the rest of the month to prevent overspending.`;
  }

  // 6. Exceeded budgets query (100%+)
  if (
    q.includes('which budgets are exceeded') ||
    q.includes('exceeded budgets') ||
    q.includes('budgets exceeded') ||
    q.includes('over budget') ||
    q.includes('overbudget') ||
    q.includes('exceeded any budget')
  ) {
    const exceeded = (summary.budgetStatuses || []).filter(b => b.status === 'exceeded' || b.percentage >= 100);
    if (exceeded.length === 0) {
      return `✅ Great news! None of your budgets have exceeded their limits this month.`;
    }
    const list = exceeded.map(b => `• **${b.category}**: Spent ${currency}${b.spent.toLocaleString('en-IN')} / Limit ${currency}${b.limit.toLocaleString('en-IN')} (${b.percentage}%) — **Exceeded by ${currency}${(b.spent - b.limit).toLocaleString('en-IN')}**`).join('\n');
    return `🚨 **Exceeded Budgets (100%+ utilized):**\n\n${list}\n\nReview transactions in these categories or adjust your budget limits if necessary.`;
  }

  // 7. How to reduce expenses / Trimming discretionary wants
  if (
    q.includes('reduce expenses') ||
    q.includes('how to reduce') ||
    q.includes('how can i reduce') ||
    q.includes('cut costs') ||
    q.includes('trim expenses') ||
    q.includes('reduce spending') ||
    q.includes('cut down')
  ) {
    const wantsAmt = summary.needsVsWants?.wants?.amount ?? 0;
    const wantsPct = summary.needsVsWants?.wants?.percentage ?? 0;
    const topWants = (summary.categoryBreakdown || [])
      .filter(c => ['Entertainment', 'Shopping', 'Subscriptions', 'Travel', 'Food', 'Other'].includes(c.category))
      .slice(0, 3);
    const topWantsStr = topWants.map(c => `• **${c.category}**: ${currency}${c.amount.toLocaleString('en-IN')} (${c.percentage}%)`).join('\n');
    return `**Actionable Expense Reduction Recommendations:**\n\nYour discretionary "Wants" total **${currency}${wantsAmt.toLocaleString('en-IN')}** (**${wantsPct}%** of total expenses).\n\n**Primary Discretionary Areas to Trim:**\n${topWantsStr || '• Review non-essential purchases and recurring subscriptions.'}\n\n💡 **Tip:** Trimming 20% of discretionary wants would save you approximately **${currency}${Math.round(wantsAmt * 0.2).toLocaleString('en-IN')}** towards your emergency buffer!`;
  }

  // 8. Savings goals requirements / Goals progress
  if (
    q.includes('savings goal') ||
    q.includes('savings goals') ||
    q.includes('goal requirements') ||
    q.includes('goals progress') ||
    q.includes('what do i need for my savings')
  ) {
    const goals = summary.savingsGoalsSummary?.goals || [];
    if (goals.length === 0) {
      return `You have not configured any savings goals yet! You can add goals in the **Budgets & Goals** tab.`;
    }
    const goalsList = goals.map(g => `• **${g.name}**: Saved ${currency}${g.savedAmount.toLocaleString('en-IN')} / Target ${currency}${g.targetAmount.toLocaleString('en-IN')} (${g.percentage}%)${g.remaining > 0 ? ` — **${currency}${g.remaining.toLocaleString('en-IN')} needed**` : ' — ✅ Goal Achieved!'}`).join('\n');
    const totRem = summary.savingsGoalsSummary?.totalRemaining ?? 0;
    const curBal = summary.currentBalance ?? 0;
    return `**Savings Goals Status:**\n\n${goalsList}\n\n• **Total Required to Complete All Goals**: **${currency}${totRem.toLocaleString('en-IN')}**\n• **Current Available Balance**: ${currency}${curBal.toLocaleString('en-IN')}\n\n${curBal >= totRem ? '✅ Your current balance is sufficient to fund your remaining goal targets!' : `You need an additional **${currency}${(totRem - curBal).toLocaleString('en-IN')}** beyond your current balance to fully fund all goals.`}`;
  }

  // 9. Top 3 categories / Where did my money go?
  if (
    q.includes('where did my money go') ||
    q.includes('where is my money') ||
    q.includes('top 3 categories') ||
    q.includes('top categories') ||
    q.includes('spending breakdown') ||
    q.includes('category breakdown')
  ) {
    if (!summary.categoryBreakdown || summary.categoryBreakdown.length === 0) {
      return `You haven't recorded any expenses yet! Once you log transactions, I will analyze your top spending categories.`;
    }
    const top = summary.categoryBreakdown.slice(0, 3);
    const topStr = top.map(c => `• **${c.category}**: ${currency}${c.amount.toLocaleString('en-IN')} (${c.percentage}%)`).join('\n');
    return `Here is where your money went:\n\n${topStr}\n\n• **Total Expenses**: ${currency}${(summary.totalExpenses ?? 0).toLocaleString('en-IN')}\n• **Needs vs Wants**: Needs make up **${summary.needsVsWants?.needs?.percentage ?? 0}%** and Wants make up **${summary.needsVsWants?.wants?.percentage ?? 0}%**.`;
  }

  // 10. Month total spend query
  if (
    q.includes('this month spend') ||
    q.includes('how much did i spend this month') ||
    q.includes('month spend') ||
    q.includes('monthly spend') ||
    q.includes('spent this month') ||
    q.includes('total expenses this month')
  ) {
    const tm = summary.timeframes?.thisMonth?.expense ?? 0;
    const tmIncome = summary.timeframes?.thisMonth?.income ?? 0;
    const netMonth = summary.timeframes?.thisMonth?.netSavings ?? (tmIncome - tm);
    return `**This Month's Spending Overview (${summary.timeframes?.thisMonth?.monthKey || 'Current Month'}):**\n\n• **Total Spent This Month**: **${currency}${tm.toLocaleString('en-IN')}**\n• **Total Income This Month**: ${currency}${tmIncome.toLocaleString('en-IN')}\n• **Net Cash Flow This Month**: ${currency}${netMonth.toLocaleString('en-IN')}\n• **Top Categories**: ${(summary.categoryBreakdown || []).slice(0, 2).map(c => `${c.category} (${currency}${c.amount.toLocaleString('en-IN')})`).join(', ') || 'None'}`;
  }

  // 11. Monthly income query
  if (
    q.includes('monthly income') ||
    q.includes('this month income') ||
    q.includes('income this month') ||
    q.includes('how much did i earn this month') ||
    q.includes('total income this month') ||
    q.includes('what is my income this month')
  ) {
    const tmIncome = summary.timeframes?.thisMonth?.income ?? 0;
    const totIncome = summary.totalIncome ?? 0;
    const topIncomeCat = (summary.incomeBreakdown || []).slice(0, 3).map(c => `• **${c.category}**: ${currency}${c.amount.toLocaleString('en-IN')} (${c.percentage}%)`).join('\n');
    return `**Income Overview:**\n\n• **This Month's Income**: **${currency}${tmIncome.toLocaleString('en-IN')}**\n• **All-Time Total Income**: ${currency}${totIncome.toLocaleString('en-IN')}\n\n${topIncomeCat ? `**Top Income Sources:**\n${topIncomeCat}` : 'No income breakdown available yet.'}`;
  }

  // 12. Current balance query
  if (
    q.includes('current balance') ||
    q.includes('what is my current balance') ||
    q.includes('account balance') ||
    q.includes('how much money do i have') ||
    q.includes('my balance')
  ) {
    const curBal = summary.currentBalance ?? 0;
    const opBal = summary.openingBalance ?? 0;
    const totInc = summary.totalIncome ?? 0;
    const totExp = summary.totalExpenses ?? 0;
    const netSav = summary.netSavings ?? (totInc - totExp);
    return `**Account Balance Breakdown:**\n\n• **Current Balance**: **${currency}${curBal.toLocaleString('en-IN')}**\n• **Opening Balance**: ${currency}${opBal.toLocaleString('en-IN')}\n• **Total Income Recorded**: ${currency}${totInc.toLocaleString('en-IN')}\n• **Total Expenses Recorded**: ${currency}${totExp.toLocaleString('en-IN')}\n• **Net Lifetime Cash Flow**: ${currency}${netSav.toLocaleString('en-IN')}`;
  }

  // 13. Needs vs Wants analysis
  if (q.includes('need') || q.includes('want') || q.includes('50/30/20')) {
    const { needs, wants, unclassified } = summary.needsVsWants || {
      needs: { amount: 0, percentage: 0 },
      wants: { amount: 0, percentage: 0 },
      unclassified: { amount: 0, percentage: 0 }
    };
    return `**Needs vs Wants Analysis (50/30/20 Guideline):**\n\n• **Needs**: ${currency}${(needs.amount ?? 0).toLocaleString('en-IN')} (${needs.percentage ?? 0}%) [Target: 50%]\n• **Wants**: ${currency}${(wants.amount ?? 0).toLocaleString('en-IN')} (${wants.percentage ?? 0}%) [Target: 30%]\n• **Unclassified**: ${currency}${(unclassified.amount ?? 0).toLocaleString('en-IN')} (${unclassified.percentage ?? 0}%)\n\n${wants.percentage > 30 ? '⚠️ Your Wants exceed 30%. Consider reviewing discretionary lifestyle expenses.' : '✅ Your Wants are under control within the 30% guideline.'}`;
  }

  // 14. Category queries (Food, Groceries, Transport, etc.)
  if (q.includes('food') || q.includes('groceries') || q.includes('transport') || q.includes('shopping')) {
    const targetCatName = q.includes('food') ? 'Food'
      : q.includes('groceries') ? 'Groceries'
      : q.includes('transport') ? 'Transport'
      : 'Shopping';

    const todayExpMap = summary.timeframes?.today?.expensesByCategory || {};
    const todayCatEntry = Object.entries(todayExpMap).find(([k]) => k.toLowerCase() === targetCatName.toLowerCase());
    const spentTodayOnCat = todayCatEntry ? todayCatEntry[1] : 0;
    const spentTodayTotal = summary.timeframes?.today?.expense || 0;

    const allTimeCat = (summary.categoryBreakdown || []).find(c => c.category.toLowerCase() === targetCatName.toLowerCase());
    const allTimeAmount = allTimeCat ? allTimeCat.amount : 0;
    const allTimePct = allTimeCat ? allTimeCat.percentage : 0;

    if (q.includes('today')) {
      if (spentTodayOnCat > 0) {
        return `Today, you have spent **${currency}${spentTodayOnCat.toLocaleString('en-IN')}** on **${targetCatName}** (out of **${currency}${spentTodayTotal.toLocaleString('en-IN')}** total spent today across all categories).`;
      }
      return `You have spent **${currency}0** on **${targetCatName}** today (no ${targetCatName} expenses recorded today). Your total recorded expense across all categories today is **${currency}${spentTodayTotal.toLocaleString('en-IN')}**.`;
    }

    if (allTimeCat) {
      return `You have spent **${currency}${allTimeAmount.toLocaleString('en-IN')}** on **${targetCatName}**, accounting for **${allTimePct}%** of your total expenses.`;
    }
    return `You have no recorded transactions under the **${targetCatName}** category.`;
  }

  // 15. Savings feasibility query (e.g. "Can I save ₹1,000?")
  if (q.includes('save')) {
    const match = q.match(/(\d+[\d,]*)/);
    const targetAmount = match ? parseFloat(match[1].replace(/,/g, '')) : 1000;

    const sf = summary.savingsFeasibility && summary.savingsFeasibility.targetAmount === targetAmount
      ? summary.savingsFeasibility
      : evaluateSavingsFeasibility({
          targetAmount,
          currentBalance: summary.currentBalance ?? 0,
          totalIncome: summary.totalIncome ?? 0,
          totalExpenses: summary.totalExpenses ?? 0,
          thisMonthIncome: summary.timeframes?.thisMonth?.income || 0,
          thisMonthExpense: summary.timeframes?.thisMonth?.expense || 0,
          wantsExpense: summary.needsVsWants?.wants?.amount || 0,
          savingsGoals: summary.savingsGoalsSummary?.goals || []
        });

    if (sf.status === 'missing_income') {
      return `I cannot determine whether you can save **${currency}${targetAmount.toLocaleString('en-IN')}** because **no income transactions have been recorded yet** (total income is ${currency}0).\n\n${sf.clarifyingQuestion}`;
    }

    if (sf.feasible) {
      return `**Yes, you can save ${currency}${targetAmount.toLocaleString('en-IN')}!**\n\n• **Current Balance**: ${currency}${(summary.currentBalance ?? 0).toLocaleString('en-IN')}\n• **This Month Net Surplus**: ${currency}${((summary.timeframes?.thisMonth?.netSavings) ?? 0).toLocaleString('en-IN')}\n• **Discretionary Wants**: ${currency}${(summary.needsVsWants?.wants?.amount ?? 0).toLocaleString('en-IN')} (${summary.needsVsWants?.wants?.percentage ?? 0}% of expenses)\n\n${sf.summary} ${sf.actionableAdvice}`;
    } else {
      return `Saving **${currency}${targetAmount.toLocaleString('en-IN')}** will be tight right now.\n\n• **Current Balance**: ${currency}${(summary.currentBalance ?? 0).toLocaleString('en-IN')}\n• **This Month Net Surplus**: ${currency}${((summary.timeframes?.thisMonth?.netSavings) ?? 0).toLocaleString('en-IN')}\n• **Discretionary Wants**: ${currency}${(summary.needsVsWants?.wants?.amount ?? 0).toLocaleString('en-IN')}\n\n${sf.summary} ${sf.actionableAdvice}`;
    }
  }

  // 16. Month comparison
  if (q.includes('compare') || q.includes('last month')) {
    const tm = summary.timeframes?.thisMonth?.expense ?? 0;
    const lm = summary.timeframes?.lastMonth?.expense ?? 0;
    const mom = summary.timeframes?.monthOverMonth || { trend: 'unchanged', difference: 0, percentageChange: 0 };
    return `**Month-over-Month Expense Comparison:**\n\n• **This Month**: ${currency}${tm.toLocaleString('en-IN')}\n• **Last Month**: ${currency}${lm.toLocaleString('en-IN')}\n• **Change**: Spending has **${mom.trend}** by **${currency}${Math.abs(mom.difference).toLocaleString('en-IN')}** (${mom.percentageChange}%).\n\nKeep an eye on non-essential spending to stay within your desired savings trajectory.`;
  }

  // 17. General financial overview requested explicitly
  const isOverviewQuery =
    q.includes('overview') ||
    q.includes('summary') ||
    q.includes('status') ||
    q.includes('how am i doing') ||
    q.includes('financial report') ||
    q.includes('total');

  if (isOverviewQuery) {
    return `**SpendWise Financial Overview:**\n• Current Balance: **${currency}${(summary.currentBalance ?? 0).toLocaleString('en-IN')}**\n• Total Income: **${currency}${(summary.totalIncome ?? 0).toLocaleString('en-IN')}**\n• Total Expenses: **${currency}${(summary.totalExpenses ?? 0).toLocaleString('en-IN')}**\n• Net Savings Rate: **${summary.savingsRate ?? 0}%**\n\nAsk me specific questions like: *"Where did my money go?"*, *"How much did I spend on food today?"*, *"Can I save ₹1,000?"*, or *"Which budgets are near their limit?"*.`;
  }

  // 18. Graceful clarification for general or unrecognized queries
  return `I didn't quite catch that. As your **SpendWise AI** finance advisor, I can help you analyze your spending, check your food budget, evaluate savings targets, or compare monthly cash flow.\n\nTry asking me:\n• *"Where did my money go?"*\n• *"How much did I spend on food today?"*\n• *"Can I save ₹1,000?"*\n• *"Which budgets are near their limit?"*\n• *"How much did I spend in the last 7 days?"*\n• *"Show my financial overview"*`;
}

/**
 * Handles chat query using official Groq SDK (groq-sdk) with strict financial grounding.
 * Never reports a Groq call as successful unless the live API call actually succeeds.
 *
 * @param {Object} options
 * @param {string} options.userMessage - User's inquiry
 * @param {Array} options.conversationHistory - Recent messages
 * @param {Object} options.financialSummary - Pre-computed deterministic metrics
 * @param {Array} options.recentTransactions - Recent transactions
 * @returns {Promise<Object>}
 */
export async function getChatbotResponse({
  userMessage,
  conversationHistory = [],
  financialSummary,
  recentTransactions = []
}) {
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const configStatus = getGroqConfigStatus();
  const { model } = getConfiguredGroqModel();
  const client = getGroqClient();

  try {
    // 1. If no valid Groq API key is configured, return offline fallback immediately
    if (!client || !configStatus.configured) {
      const fallbackReply = generateDeterministicFallback(userMessage, financialSummary);
      const reasonMsg = 'GROQ_API_KEY is not configured in server/.env.';
      return {
        reply: fallbackReply,
        source: 'offline-fallback',
        isFallback: true,
        modelUsed: 'deterministic-rules-engine',
        fallbackReason: {
          code: configStatus.reason || 'missing_groq_api_key',
          message: reasonMsg
        },
        ...(isDev && {
          devStatus: {
            mode: 'OFFLINE_FALLBACK',
            provider: 'local-deterministic-engine',
            apiEndpoint: 'none',
            model: 'deterministic-rules-engine',
            responseId: null,
            fallbackCode: configStatus.reason || 'missing_groq_api_key',
            fallbackMessage: reasonMsg
          }
        })
      };
    }

    // 2. Check if a rate-limit cooldown backoff is currently active
    const cooldown = getGroqCooldownStatus();
    if (cooldown.active) {
      const fallbackReply = generateDeterministicFallback(userMessage, financialSummary);
      const cooldownMsg = `${cooldown.reason?.safeMessage || 'Groq rate limit reached.'} (Backoff active: retry in ${cooldown.remainingSeconds}s)`;
      return {
        reply: fallbackReply,
        source: 'offline-fallback',
        isFallback: true,
        modelUsed: 'deterministic-rules-engine',
        fallbackReason: {
          code: cooldown.reason?.code || 'rate_limited',
          message: cooldownMsg
        },
        ...(isDev && {
          devStatus: {
            mode: 'OFFLINE_FALLBACK',
            provider: 'local-deterministic-engine',
            apiEndpoint: 'none',
            model: 'deterministic-rules-engine',
            responseId: null,
            fallbackCode: cooldown.reason?.code || 'rate_limited',
            fallbackMessage: cooldownMsg
          }
        })
      };
    }

    // 3. Build deterministic grounded context
    const groundedContext = buildGroundedContext(financialSummary, recentTransactions);
    const systemInstruction = `${SPENDWISE_SYSTEM_PROMPT}\n\n${groundedContext}`;

    // Format limited conversation history for OpenAI/Groq standard role/content format
    const formattedHistory = (conversationHistory || [])
      .slice(-4)
      .filter(msg => msg && typeof msg.content === 'string' && msg.content.trim().length > 0)
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content.trim()
      }));

    const messages = [
      {
        role: 'system',
        content: systemInstruction
      },
      ...formattedHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];

    // 4. Execute live Groq API request via official groq-sdk
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 1200
    });

    const replyText = completion?.choices?.[0]?.message?.content?.trim() || '';

    if (!replyText) {
      throw new Error('GroqCloud API returned an empty text output.');
    }

    // Live call succeeded: clear any existing cooldown
    resetGroqCooldown();

    return {
      reply: replyText,
      source: 'groq',
      isFallback: false,
      modelUsed: model,
      fallbackReason: null,
      ...(isDev && {
        devStatus: {
          mode: 'LIVE_GROQ',
          provider: 'groq-sdk',
          apiEndpoint: 'chat.completions.create',
          model,
          responseId: completion.id || null,
          fallbackCode: null,
          fallbackMessage: null
        }
      })
    };

  } catch (err) {
    const classified = classifyGroqError(err);
    console.warn(`[Groq Service] Chat processing error (${classified.code}): ${classified.safeMessage}`);

    // If rate limited or quota exceeded, activate cooldown backoff to prevent retry storms
    if (classified.status === 429) {
      const waitSeconds = classified.retryAfterSeconds || 30;
      triggerGroqCooldown(waitSeconds, classified);
    }

    const fallbackReply = generateDeterministicFallback(userMessage, financialSummary);

    return {
      reply: fallbackReply,
      source: 'offline-fallback',
      isFallback: true,
      modelUsed: 'deterministic-rules-engine',
      fallbackReason: {
        code: classified.code,
        message: classified.safeMessage
      },
      ...(isDev && {
        devStatus: {
          mode: 'OFFLINE_FALLBACK',
          provider: 'local-deterministic-engine',
          apiEndpoint: 'none',
          model: 'deterministic-rules-engine',
          responseId: null,
          fallbackCode: classified.code,
          fallbackMessage: classified.safeMessage
        }
      })
    };
  }
}
