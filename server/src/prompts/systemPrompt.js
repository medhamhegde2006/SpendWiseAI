/**
 * Grounded System Prompt for SpendWise AI Chatbot
 * Adheres strictly to the AI project theme:
 * "Using OpenAI Tool, Develop a Chatbot to Solve a Real-Time Problem."
 */

export const SPENDWISE_SYSTEM_PROMPT = `You are SpendWise AI, an expert, encouraging, and strictly grounded personal finance simulator advisor.
Your mission is to help users analyze their spending habits, achieve savings goals, and understand where their money goes.

### STRICT OPERATIONAL RULES:
1. GROUNDED IN COMPUTED DATA ONLY:
   - You are provided with deterministic financial statistics calculated directly in JavaScript.
   - NEVER invent, extrapolate, or hallucinate financial transactions, balances, or percentages.
   - Quote EXACT figures from the provided Financial Profile (e.g., "₹2,450.00", "34.2%").
   - If the user asks about a timeframe, category, or transaction not present in the data, explicitly state that no records exist for that criteria.

2. SPECIFIC CATEGORY & TIMEFRAME ACCURACY:
   - When asked "How much did I spend on [Category] today?", check TODAY'S BREAKDOWN.
     * If expenses for that category exist today, quote the EXACT today's category amount and list the specific item(s) if present.
     * If no expenses for that category were recorded today, clearly state: "You have not spent anything on [Category] today (₹0 recorded)."
     * NEVER confuse today's specific category spend with today's total across all categories or with all-time category totals.
   - When asked "Where did my money go?", summarize the top spending categories with exact percentages and highlight needs vs wants.

3. SAVINGS FEASIBILITY & CASH FLOW ANALYSIS:
   - When asked "Can I save ₹X?" (e.g. "Can I save ₹1,000?"):
     * Check SAVINGS FEASIBILITY & CASH FLOW ANALYSIS.
     * If essential data is missing (e.g., total income is ₹0 / unrecorded), do NOT give ungrounded reassurance. Clearly state that income has not been recorded, and ask a clarifying question about their regular monthly income or allowance.
     * If income is recorded, evaluate feasibility using: Current Balance, This Month's Net Cashflow, Discretionary "Wants", and committed Savings Goals.
     * If feasible, state why with exact numbers (surplus, balance buffer).
     * If tight or not feasible, state the exact shortfall and suggest concrete cutbacks in discretionary Wants.

4. TONE AND CLARITY:
   - Professional, concise, empathetic, and digital-bank quality.
   - Use clear bullet points and bold amounts for readability.
   - Keep answers focused (under 180 words unless the user requested a detailed breakdown).
   - Conclude with a helpful, natural follow-up suggestion when relevant.

5. GREETINGS & CASUAL INTERACTION:
   - When the user sends a greeting (e.g., "Hii", "Hello", "Hey", "Good morning", "What's up") without a specific financial question:
     * Respond with a warm, natural greeting and introduce yourself as SpendWise AI, their personal finance advisor.
     * Suggest 2-3 sample questions they can ask (e.g., "Where did my money go?", "How much did I spend on food today?", "Can I save ₹1,000?").
     * DO NOT dump the full financial summary, opening balance, or transaction lists in response to a simple greeting.
`;

/**
 * Builds the dynamic contextual prompt with the user's grounded financial figures
 * @param {Object} summary - Output from calculateFinancialSummary
 * @param {Array} recentTransactions - Recent raw transaction items
 * @returns {string} Grounded context text to insert into the system or user prompt
 */
export function buildGroundedContext(summary = {}, recentTransactions = []) {
  const topCategories = (summary.categoryBreakdown || [])
    .slice(0, 5)
    .map(c => `• ${c.category}: ₹${(c.amount ?? 0).toLocaleString('en-IN')} (${c.percentage ?? 0}%)`)
    .join('\n') || '• No expense categories recorded.';

  const budgetsInfo = (summary.budgetStatuses || []).map(b => {
    return `• ${b.category}: Spent ₹${(b.spent ?? 0).toLocaleString('en-IN')} / Limit ₹${(b.limit ?? 0).toLocaleString('en-IN')} (${b.percentage ?? 0}%) [Status: ${(b.status || 'OK').toUpperCase()}]`;
  }).join('\n') || '• No budgets configured.';

  // Today's category breakdown
  const todayExpMap = summary.timeframes?.today?.expensesByCategory || {};
  const todayEntries = Object.entries(todayExpMap);
  const todayCategoryBreakdown = todayEntries.length > 0
    ? todayEntries.map(([cat, amt]) => `• ${cat}: ₹${(amt ?? 0).toLocaleString('en-IN')}`).join('\n')
    : '• No category expenses recorded today (₹0).';

  // Today's transactions
  const todayTxList = (summary.timeframes?.today?.transactions || []).slice(0, 5).map(t => {
    return `[${(t.type || 'expense').toUpperCase()}] ${t.description || 'Transaction'} - ₹${(t.amount ?? 0).toLocaleString('en-IN')} (${t.category || 'Other'})`;
  }).join('\n') || 'None recorded today.';

  // Active savings goals
  const goals = (summary.savingsGoalsSummary?.goals || []).map(g => {
    return `• ${g.name}: Saved ₹${(g.savedAmount ?? 0).toLocaleString('en-IN')} of ₹${(g.targetAmount ?? 0).toLocaleString('en-IN')} (${g.percentage ?? 0}%)${g.deadline ? ` [Deadline: ${g.deadline}]` : ''}`;
  }).join('\n') || '• No active savings goals set.';

  // Deterministic savings feasibility summary
  const sf = summary.savingsFeasibility || {};
  const savingsFeasibilityText = sf.status === 'missing_income'
    ? `Status: Missing Income Data\n• Note: Total recorded income is ₹0. Feasibility cannot be verified.\n• Clarifying Question Needed: "${sf.clarifyingQuestion}"`
    : `Status: ${sf.status?.toUpperCase() || 'EVALUATED'} (Feasible: ${sf.feasible ? 'YES' : 'NO'})\n• Summary: ${sf.summary || 'N/A'}\n• Advice: ${sf.actionableAdvice || 'N/A'}`;

  // Recent transactions sorted descending
  const recentSorted = (Array.isArray(recentTransactions) ? recentTransactions : [])
    .slice(0, 10)
    .map(t => `[${t.date || 'N/A'}] ${(t.type || 'expense').toUpperCase()}: ${t.description || 'Transaction'} - ₹${(t.amount ?? 0).toLocaleString('en-IN')} (${t.category || 'Other'}, ${t.classification || 'N/A'})`)
    .join('\n') || 'No recent transactions.';

  const opBal = summary.openingBalance ?? 0;
  const curBal = summary.currentBalance ?? 0;
  const totInc = summary.totalIncome ?? 0;
  const totExp = summary.totalExpenses ?? 0;
  const netSav = summary.netSavings ?? 0;
  const savRate = summary.savingsRate ?? 0;

  const todayExpense = summary.timeframes?.today?.expense ?? 0;
  const todayIncome = summary.timeframes?.today?.income ?? 0;
  const yesterdayExpense = summary.timeframes?.yesterday?.expense ?? 0;
  const yesterdayIncome = summary.timeframes?.yesterday?.income ?? 0;
  const thisWeekExpense = summary.timeframes?.thisWeek?.expense ?? 0;
  const thisWeekIncome = summary.timeframes?.thisWeek?.income ?? 0;

  const tmExpense = summary.timeframes?.thisMonth?.expense ?? 0;
  const tmIncome = summary.timeframes?.thisMonth?.income ?? 0;
  const tmNetSavings = summary.timeframes?.thisMonth?.netSavings ?? (tmIncome - tmExpense);

  const lmExpense = summary.timeframes?.lastMonth?.expense ?? 0;
  const lmIncome = summary.timeframes?.lastMonth?.income ?? 0;

  const momTrend = summary.timeframes?.monthOverMonth?.trend || 'unchanged';
  const momDiff = Math.abs(summary.timeframes?.monthOverMonth?.difference ?? 0);
  const momPct = summary.timeframes?.monthOverMonth?.percentageChange ?? 0;

  const needsAmt = summary.needsVsWants?.needs?.amount ?? 0;
  const needsPct = summary.needsVsWants?.needs?.percentage ?? 0;
  const wantsAmt = summary.needsVsWants?.wants?.amount ?? 0;
  const wantsPct = summary.needsVsWants?.wants?.percentage ?? 0;
  const unclassAmt = summary.needsVsWants?.unclassified?.amount ?? 0;
  const unclassPct = summary.needsVsWants?.unclassified?.percentage ?? 0;

  return `
=== VERIFIED USER FINANCIAL PROFILE (GROUND TRUTH) ===
Currency: INR (₹)
Reference Today: ${summary.todayDate || summary.timeframes?.today?.date || 'Today'}
Opening Balance: ₹${opBal.toLocaleString('en-IN')}
Current Balance: ₹${curBal.toLocaleString('en-IN')}
Total Income: ₹${totInc.toLocaleString('en-IN')}
Total Expenses: ₹${totExp.toLocaleString('en-IN')}
Net Savings: ₹${netSav.toLocaleString('en-IN')} (Savings Rate: ${savRate}%)

--- TODAY'S BREAKDOWN (${summary.todayDate || 'Today'}) ---
• Total Spent Today: ₹${todayExpense.toLocaleString('en-IN')}
• Total Income Today: ₹${todayIncome.toLocaleString('en-IN')}
• Today's Category Spending:
${todayCategoryBreakdown}
• Today's Transactions:
${todayTxList}

--- YESTERDAY'S BREAKDOWN (${summary.timeframes?.yesterday?.date || 'Yesterday'}) ---
• Total Spent Yesterday: ₹${yesterdayExpense.toLocaleString('en-IN')}
• Total Income Yesterday: ₹${yesterdayIncome.toLocaleString('en-IN')}

--- THIS MONTH CASH FLOW (${summary.timeframes?.thisMonth?.monthKey || 'Current Month'}) ---
• This Month Income: ₹${tmIncome.toLocaleString('en-IN')}
• This Month Expenses: ₹${tmExpense.toLocaleString('en-IN')}
• This Month Net Surplus: ₹${tmNetSavings.toLocaleString('en-IN')}

--- NEEDS VS WANTS BREAKDOWN ---
• Needs: ₹${needsAmt.toLocaleString('en-IN')} (${needsPct}% of expenses)
• Wants: ₹${wantsAmt.toLocaleString('en-IN')} (${wantsPct}% of expenses) [Discretionary]
• Unclassified: ₹${unclassAmt.toLocaleString('en-IN')} (${unclassPct}%)

--- TIMEFRAME COMPARISONS ---
• Past 7 Days (Week): Expense ₹${thisWeekExpense.toLocaleString('en-IN')}, Income ₹${thisWeekIncome.toLocaleString('en-IN')}
• Yesterday: Expense ₹${yesterdayExpense.toLocaleString('en-IN')}
• Last Month: Expense ₹${lmExpense.toLocaleString('en-IN')}, Income ₹${lmIncome.toLocaleString('en-IN')}
• Month-over-Month Delta: Spending ${momTrend} by ₹${momDiff.toLocaleString('en-IN')} (${momPct}%)

--- SAVINGS GOALS & ₹1,000 FEASIBILITY ANALYSIS ---
${goals}
Feasibility for ₹1,000 Target:
${savingsFeasibilityText}

--- TOP EXPENSE CATEGORIES (All-Time) ---
${topCategories}

--- BUDGET LIMITS & THRESHOLDS ---
${budgetsInfo}

--- RECENT TRANSACTIONS (Newest First) ---
${recentSorted}
======================================================
`;
}
