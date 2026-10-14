import { defineStore } from 'pinia';
import { ref } from 'vue';
import { sendChatMessage, checkBackendHealth } from '../services/api.js';
import { useFinanceStore } from './financeStore.js';
import { formatINR } from '../utils/formatters.js';

export const useChatStore = defineStore('chat', () => {
  const isOpen = ref(false);
  const isTyping = ref(false);
  const error = ref(null);
  const lastVerifiedSource = ref(null); // 'groq' | 'offline-fallback' | null
  const lastFallbackReason = ref(null);

  const backendStatus = ref({
    healthy: true,
    groqConfigured: false,
    geminiConfigured: false,
    configuredModel: null,
    provider: 'groq',
    environment: 'development'
  });

  const messages = ref([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Hello! I'm **SpendWise AI**, your personal finance advisor powered by GroqCloud. All my insights are grounded directly in your real-time account balances and transactions.\n\nTry asking me:\n• *"Where did my money go?"*\n• *"How much did I spend on food today?"*\n• *"Can I save ₹1,000?"*\n• *"Compare this month with last month?"*`,
      timestamp: new Date().toISOString()
    }
  ]);

  const suggestedPrompts = [
    'Where did my money go?',
    'How much did I spend this month?',
    'Analyze my Needs vs Wants ratio',
    'Which budgets are near their limit?',
    'Which budgets are exceeded?',
    'What is my highest spending category?',
    'How much did I spend on food today?',
    'How much did I spend yesterday?',
    'How much did I spend in the last 7 days?',
    'What is my current balance?',
    'What is my monthly income?',
    'How can I reduce expenses?',
    'What do I need for my savings goals?',
    'Can I save ₹1,000?'
  ];

  async function verifyBackend() {
    backendStatus.value = await checkBackendHealth();
  }

  /**
   * Sends a user question to the backend Gemini chatbot
   */
  async function askQuestion(questionText) {
    const cleanText = (questionText || '').trim();
    if (!cleanText || isTyping.value) return;

    error.value = null;
    const financeStore = useFinanceStore();

    // Append user message
    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: cleanText,
      timestamp: new Date().toISOString()
    };
    messages.value.push(userMsg);
    isTyping.value = true;

    try {
      // Prepare recent history excluding the welcome message
      const historyForApi = messages.value
        .filter(m => m.id !== 'welcome-msg')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const now = new Date();
      const clientToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

      const responseData = await sendChatMessage({
        message: cleanText,
        conversationHistory: historyForApi.slice(0, -1),
        transactions: financeStore.transactions,
        openingBalance: financeStore.openingBalance,
        budgets: financeStore.budgets,
        savingsGoals: financeStore.savingsGoals,
        clientToday,
        timezone
      });

      const isFallback = Boolean(responseData.isFallback);
      const source = responseData.source || (isFallback ? 'offline-fallback' : 'groq');

      lastVerifiedSource.value = source;
      lastFallbackReason.value = responseData.fallbackReason || null;

      messages.value.push({
        id: 'ai_' + Date.now(),
        role: 'assistant',
        content: responseData.reply,
        source,
        isFallback,
        modelUsed: responseData.modelUsed,
        fallbackReason: responseData.fallbackReason || null,
        devStatus: responseData.devStatus || null,
        timestamp: responseData.timestamp || new Date().toISOString()
      });

    } catch (err) {
      console.warn('Backend API call error, generating client-side grounded response:', err.message);
      const fallbackText = buildEmergencyClientAnswer(cleanText, financeStore);

      let reasonCode = 'backend_unreachable';
      if (err.code === 'rate_limited' || err.status === 429) {
        reasonCode = 'rate_limited';
      } else if (err.code === 'invalid_response_format') {
        reasonCode = 'invalid_response';
      } else if (err.code) {
        reasonCode = err.code;
      } else if (err.status && err.status < 500) {
        reasonCode = 'client_error';
      }

      const reason = {
        code: reasonCode,
        message: err.message || 'SpendWise AI backend server is unreachable.'
      };

      lastVerifiedSource.value = 'offline-fallback';
      lastFallbackReason.value = reason;

      messages.value.push({
        id: 'ai_' + Date.now(),
        role: 'assistant',
        content: fallbackText,
        source: 'offline-fallback',
        isFallback: true,
        modelUsed: 'local-grounded-engine',
        fallbackReason: reason,
        devStatus: {
          mode: 'OFFLINE_FALLBACK',
          provider: 'client-emergency-fallback',
          apiEndpoint: 'none',
          model: 'local-grounded-engine',
          fallbackCode: reason.code,
          fallbackMessage: reason.message
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      isTyping.value = false;
    }
  }

  function isGreetingQuery(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim().toLowerCase().replace(/[!?.,;:~]/g, '').trim();
    if (!clean) return false;

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

    if (hasFinancialTopic) return false;

    const greetingRegex = /^(hi+|hello+|hey+|heyy+|greetings|good\s*(morning|afternoon|evening|day)|yo+|sup|what'?s\s*up|whats\s*up|howdy|namaste)(\s+(there|spendwise|ai|assistant|friend|bot))?$/i;
    return greetingRegex.test(clean);
  }

  function buildEmergencyClientAnswer(qStr, store) {
    const q = (qStr || '').trim().toLowerCase();
    const stats = store.stats;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 1. Natural greeting detection
    if (isGreetingQuery(qStr)) {
      return `Hello! 👋 I'm **SpendWise AI**, your personal finance advisor.\n\nI can analyze your transactions, monitor your budgets, and provide grounded insights into your spending habits.\n\nHere are a few questions you can ask me:\n• *"Where did my money go?"* — Breakdown of your top spending categories\n• *"How much did I spend this month?"* — Current month cash flow & spending\n• *"Which budgets are near their limit?"* — Active budget utilization warnings\n• *"How much did I spend in the last 7 days?"* — Past week expense analytics\n• *"Can I save ₹1,000?"* — Savings feasibility check based on your cash flow\n\nWhat would you like to check today?`;
    }

    // 2. Yesterday spend query
    if (q.includes('yesterday')) {
      const ySpend = stats.yesterdaySpend || 0;
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      const yDateStr = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, '0')}-${String(yDate.getDate()).padStart(2, '0')}`;
      const yTxs = store.transactions.filter(t => t.type === 'expense' && t.date === yDateStr);
      if (ySpend > 0) {
        const catMap = {};
        for (const t of yTxs) {
          catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount || 0);
        }
        const catList = Object.entries(catMap)
          .map(([cat, amt]) => `• **${cat}**: ${formatINR(amt)}`)
          .join('\n');
        return `Yesterday, you spent a total of **${formatINR(ySpend)}**.\n\n**Category Breakdown Yesterday:**\n${catList}`;
      }
      return `You spent **${formatINR(0)}** yesterday (no expense transactions were recorded on ${yDateStr}).`;
    }

    // 3. Last 7 days / Past week spend
    if (q.includes('last 7 days') || q.includes('past 7 days') || q.includes('past week') || q.includes('this week') || q.includes('weekly spend')) {
      const weekExp = stats.weekSpend || 0;
      return `**Last 7 Days Spending:**\n\n• **Total Expenses (7 Days)**: **${formatINR(weekExp)}**\n• **Average Daily Spend**: ${formatINR(Math.round(weekExp / 7))}/day\n• **Current Account Balance**: ${formatINR(stats.currentBalance)}`;
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
      if (!stats.categoryBreakdown || stats.categoryBreakdown.length === 0) {
        return `You have no recorded expenses yet! Once you log expenses, I will identify your highest spending category.`;
      }
      const highest = stats.categoryBreakdown[0];
      return `Your highest spending category is **${highest.category}**.\n\n• **Amount Spent**: **${formatINR(highest.amount)}**\n• **Share of Total Expenses**: **${highest.percentage}%** (out of ${formatINR(stats.globalExpenses)} total expenses).`;
    }

    // 5. Budgets near limit query
    if (
      q.includes('near limit') ||
      q.includes('near their limit') ||
      q.includes('budgets near') ||
      q.includes('warning budget') ||
      q.includes('budget warning') ||
      q.includes('approaching limit')
    ) {
      const nearLimits = (stats.budgetEvaluations || []).filter(b => b.status === 'warning' || (b.percentage >= 80 && b.percentage < 100));
      if (nearLimits.length === 0) {
        return `✅ None of your budgets are currently near their limit (all active budgets are below 80% utilization).`;
      }
      const list = nearLimits.map(b => `• **${b.category}**: Spent ${formatINR(b.spent)} / Limit ${formatINR(b.limit)} (${b.percentage}%) — **${formatINR(b.remaining)} remaining**`).join('\n');
      return `⚠️ **Budgets Near Limit (≥80% utilized):**\n\n${list}\n\nKeep an eye on these categories for the rest of the month to prevent overspending.`;
    }

    // 6. Exceeded budgets query
    if (
      q.includes('which budgets are exceeded') ||
      q.includes('exceeded budgets') ||
      q.includes('budgets exceeded') ||
      q.includes('over budget') ||
      q.includes('overbudget') ||
      q.includes('exceeded any budget')
    ) {
      const exceeded = (stats.budgetEvaluations || []).filter(b => b.status === 'exceeded' || b.percentage >= 100);
      if (exceeded.length === 0) {
        return `✅ Great news! None of your budgets have exceeded their limits this month.`;
      }
      const list = exceeded.map(b => `• **${b.category}**: Spent ${formatINR(b.spent)} / Limit ${formatINR(b.limit)} (${b.percentage}%) — **Exceeded by ${formatINR(b.spent - b.limit)}**`).join('\n');
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
      const wantsAmt = stats.needsVsWants.wants.amount;
      const wantsPct = stats.needsVsWants.wants.percentage;
      const topWants = (stats.categoryBreakdown || [])
        .filter(c => ['Entertainment', 'Shopping', 'Subscriptions', 'Travel', 'Food', 'Other'].includes(c.category))
        .slice(0, 3);
      const topWantsStr = topWants.map(c => `• **${c.category}**: ${formatINR(c.amount)} (${c.percentage}%)`).join('\n');
      return `**Actionable Expense Reduction Recommendations:**\n\nYour discretionary "Wants" total **${formatINR(wantsAmt)}** (**${wantsPct}%** of total expenses).\n\n**Primary Discretionary Areas to Trim:**\n${topWantsStr || '• Review non-essential purchases and recurring subscriptions.'}\n\n💡 **Tip:** Trimming 20% of discretionary wants would save you approximately **${formatINR(Math.round(wantsAmt * 0.2))}** towards your emergency buffer!`;
    }

    // 8. Savings goals requirements
    if (
      q.includes('savings goal') ||
      q.includes('savings goals') ||
      q.includes('goal requirements') ||
      q.includes('goals progress') ||
      q.includes('what do i need for my savings')
    ) {
      const goals = store.savingsGoals || [];
      if (goals.length === 0) {
        return `You have not configured any savings goals yet! You can add goals in the **Budgets & Goals** tab.`;
      }
      let totalTarget = 0;
      let totalSaved = 0;
      const goalsList = goals.map(g => {
        const target = Number(g.targetAmount || 0);
        const saved = Number(g.savedAmount || 0);
        const rem = Math.max(0, target - saved);
        const pct = target > 0 ? Math.round((saved / target) * 100) : 0;
        totalTarget += target;
        totalSaved += saved;
        return `• **${g.name}**: Saved ${formatINR(saved)} / Target ${formatINR(target)} (${pct}%)${rem > 0 ? ` — **${formatINR(rem)} needed**` : ' — ✅ Goal Achieved!'}`;
      }).join('\n');
      const totRem = Math.max(0, totalTarget - totalSaved);
      return `**Savings Goals Status:**\n\n${goalsList}\n\n• **Total Required to Complete All Goals**: **${formatINR(totRem)}**\n• **Current Available Balance**: ${formatINR(stats.currentBalance)}\n\n${stats.currentBalance >= totRem ? '✅ Your current balance is sufficient to fund your remaining goal targets!' : `You need an additional **${formatINR(totRem - stats.currentBalance)}** beyond your current balance to fully fund all goals.`}`;
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
      const top = stats.categoryBreakdown.slice(0, 3)
        .map(c => `• **${c.category}**: ${formatINR(c.amount)} (${c.percentage}%)`)
        .join('\n');
      return `Here is your grounded spending breakdown:\n\n${top || 'No expenses logged yet.'}\n\n• **Total Expenses**: ${formatINR(stats.globalExpenses)}\n• **Current Balance**: ${formatINR(stats.currentBalance)}`;
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
      const tm = stats.currentMonthSpend || 0;
      const tmInc = stats.currentMonthIncome || 0;
      return `**This Month's Spending Overview:**\n\n• **Total Spent This Month**: **${formatINR(tm)}**\n• **Total Income This Month**: ${formatINR(tmInc)}\n• **Net Cash Flow This Month**: ${formatINR(tmInc - tm)}\n• **Top Categories**: ${(stats.categoryBreakdown || []).slice(0, 2).map(c => `${c.category} (${formatINR(c.amount)})`).join(', ') || 'None'}`;
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
      return `**Income Overview:**\n\n• **This Month's Income**: **${formatINR(stats.currentMonthIncome || 0)}**\n• **All-Time Total Income**: ${formatINR(stats.globalIncome)}\n• **Current Account Balance**: ${formatINR(stats.currentBalance)}`;
    }

    // 12. Current balance query
    if (
      q.includes('current balance') ||
      q.includes('what is my current balance') ||
      q.includes('account balance') ||
      q.includes('how much money do i have') ||
      q.includes('my balance')
    ) {
      return `**Account Balance Breakdown:**\n\n• **Current Balance**: **${formatINR(stats.currentBalance)}**\n• **Opening Balance**: ${formatINR(stats.openingBalance)}\n• **Total Income Recorded**: ${formatINR(stats.globalIncome)}\n• **Total Expenses Recorded**: ${formatINR(stats.globalExpenses)}\n• **Net Lifetime Cash Flow**: ${formatINR(stats.netFlow)}`;
    }

    // 13. Category queries (Food, Groceries, Transport, etc.)
    if (q.includes('food')) {
      const todayFoodTxs = store.transactions.filter(
        t => t.type === 'expense' && t.date === todayStr && t.category?.toLowerCase() === 'food'
      );
      const todayFoodTotal = todayFoodTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      if (q.includes('today')) {
        if (todayFoodTotal > 0) {
          return `Today, you have spent **${formatINR(todayFoodTotal)}** on **Food** (out of **${formatINR(stats.todaySpend)}** total spent today).`;
        }
        return `You have spent **${formatINR(0)}** on **Food** today (no Food expenses logged today). Total spent across all categories today is **${formatINR(stats.todaySpend)}**.`;
      }

      const foodAll = stats.categoryBreakdown.find(c => c.category.toLowerCase() === 'food');
      return `Overall, you have spent **${formatINR(foodAll ? foodAll.amount : 0)}** on **Food** (${foodAll ? foodAll.percentage : 0}% of all expenses).`;
    }

    // 14. Needs vs Wants analysis
    if (q.includes('need') || q.includes('want') || q.includes('50/30/20')) {
      const { needs, wants, unclassified } = stats.needsVsWants;
      return `**Needs vs Wants Analysis (50/30/20 Guideline):**\n\n• **Needs**: ${formatINR(needs.amount)} (${needs.percentage}%) [Target: 50%]\n• **Wants**: ${formatINR(wants.amount)} (${wants.percentage}%) [Target: 30%]\n• **Unclassified**: ${formatINR(unclassified.amount)} (${unclassified.percentage}%)\n\n${wants.percentage > 30 ? '⚠️ Your Wants exceed 30%. Consider reviewing discretionary lifestyle expenses.' : '✅ Your Wants are under control within the 30% guideline.'}`;
    }

    // 15. Savings feasibility query (e.g. "Can I save ₹1,000?")
    if (q.includes('save')) {
      const curBal = stats.currentBalance;
      const netFlow = stats.netFlow;
      const wantsAmt = stats.needsVsWants.wants.amount;

      if (stats.globalIncome <= 0) {
        return `I cannot determine whether you can save ₹1,000 because **no income has been recorded yet** (total income is ₹0). What is your expected monthly income or allowance? Once you log income, I can accurately check your savings feasibility.`;
      }

      if (curBal >= 1000 || netFlow >= 1000) {
        return `**Yes, you can save ₹1,000!**\n\n• Current Balance: **${formatINR(curBal)}**\n• Net Cash Flow: **${formatINR(netFlow)}**\n• Discretionary Wants: **${formatINR(wantsAmt)}** (${stats.needsVsWants.wants.percentage}% of expenses).\n\nYou have adequate financial margin to achieve this goal.`;
      }
      return `Saving **₹1,000** will be tight right now. Your current balance is **${formatINR(curBal)}** and net flow is **${formatINR(netFlow)}**. Consider trimming non-essential Wants (**${formatINR(wantsAmt)}**) to reach this target.`;
    }

    // 16. General financial overview
    const isOverviewQuery =
      q.includes('overview') ||
      q.includes('summary') ||
      q.includes('status') ||
      q.includes('how am i doing') ||
      q.includes('total');

    if (isOverviewQuery) {
      return `**Grounded Account Summary:**\n• Current Balance: **${formatINR(stats.currentBalance)}**\n• Total Income: **${formatINR(stats.globalIncome)}**\n• Total Expenses: **${formatINR(stats.globalExpenses)}**\n• Needs: **${stats.needsVsWants.needs.percentage}%** | Wants: **${stats.needsVsWants.wants.percentage}%**`;
    }

    return `I didn't quite catch that. As your **SpendWise AI** finance advisor, I can help you analyze your spending, check your food budget, evaluate savings targets, or compare monthly cash flow.\n\nTry asking me:\n• *"Where did my money go?"*\n• *"How much did I spend this month?"*\n• *"Which budgets are near their limit?"*\n• *"How much did I spend in the last 7 days?"*\n• *"Can I save ₹1,000?"*\n• *"Show my financial overview"*`;
  }

  function clearHistory() {
    messages.value = [messages.value[0]];
    error.value = null;
    lastVerifiedSource.value = null;
    lastFallbackReason.value = null;
  }

  return {
    isOpen,
    isTyping,
    error,
    backendStatus,
    lastVerifiedSource,
    lastFallbackReason,
    messages,
    suggestedPrompts,
    verifyBackend,
    askQuestion,
    clearHistory
  };
});
