import express from 'express';
import rateLimit from 'express-rate-limit';
import { getChatbotResponse } from '../services/groqService.js';
import { calculateFinancialSummary } from '../services/financeCalculator.js';
import { validateChatRequest } from '../middleware/validator.js';

const router = express.Router();

// Rate limiter for Chat endpoint (60 requests per 15 minutes per IP)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate Limit Exceeded',
    message: 'Too many chat requests from this IP. Please try again after a few minutes.'
  }
});

/**
 * POST /api/chat
 * Analyzes spending and responds to user inquiries using GroqCloud SDK
 * strictly grounded in deterministic financial data.
 */
router.post('/', chatLimiter, validateChatRequest, async (req, res, next) => {
  try {
    const {
      message,
      conversationHistory = [],
      transactions = [],
      openingBalance = 0,
      budgets = [],
      savingsGoals = [],
      clientToday = null,
      timezone = null
    } = req.body;

    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const safeBudgets = Array.isArray(budgets) ? budgets : [];
    const safeSavingsGoals = Array.isArray(savingsGoals) ? savingsGoals : [];

    // 1. Calculate deterministic statistics on the backend using user's local date
    let financialSummary;
    try {
      financialSummary = calculateFinancialSummary({
        transactions: safeTransactions,
        openingBalance: Number(openingBalance || 0),
        budgets: safeBudgets,
        savingsGoals: safeSavingsGoals,
        referenceDate: new Date(),
        clientToday: typeof clientToday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientToday) ? clientToday : null,
        timezone: typeof timezone === 'string' ? timezone : null
      });
    } catch (calcErr) {
      console.warn('[Chat Route] calculateFinancialSummary warning:', calcErr.message);
      financialSummary = {
        openingBalance: Number(openingBalance || 0),
        currentBalance: Number(openingBalance || 0),
        totalIncome: 0,
        totalExpenses: 0,
        netSavings: 0,
        savingsRate: 0,
        categoryBreakdown: [],
        budgetStatuses: [],
        timeframes: {
          today: { date: clientToday || 'Today', expense: 0, income: 0, expensesByCategory: {} },
          yesterday: { date: 'Yesterday', expense: 0, income: 0, expensesByCategory: {} },
          thisWeek: { expense: 0, income: 0 },
          thisMonth: { expense: 0, income: 0, netSavings: 0 }
        },
        needsVsWants: {
          needs: { amount: 0, percentage: 0 },
          wants: { amount: 0, percentage: 0 },
          unclassified: { amount: 0, percentage: 0 }
        },
        currencySymbol: '₹'
      };
    }

    // 2. Ensure recent transactions are sorted newest-first so today's transactions are never omitted
    const sortedTransactions = [...safeTransactions].sort((a, b) => {
      const da = new Date(a?.date || 0).getTime();
      const db = new Date(b?.date || 0).getTime();
      return db - da;
    });

    // 3. Query GroqCloud via server SDK (or fall back safely if key is missing/invalid/quota-limited)
    const response = await getChatbotResponse({
      userMessage: message.trim(),
      conversationHistory,
      financialSummary,
      recentTransactions: sortedTransactions.slice(0, 15)
    });

    res.json({
      success: true,
      data: {
        reply: response.reply,
        source: response.source,
        isFallback: response.isFallback,
        modelUsed: response.modelUsed,
        fallbackReason: response.fallbackReason || null,
        ...(response.devStatus && { devStatus: response.devStatus }),
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.warn('[Chat Route] Unexpected error during chat processing:', err.message);
    res.json({
      success: true,
      data: {
        reply: "I encountered an unexpected issue while processing your financial inquiry. Please verify your transaction data or ask me again.",
        source: 'offline-fallback',
        isFallback: true,
        modelUsed: 'deterministic-rules-engine',
        fallbackReason: {
          code: 'processing_error',
          message: 'Safe offline recovery from unexpected processing error.'
        },
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;
