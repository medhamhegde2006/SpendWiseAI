import express from 'express';
import { calculateFinancialSummary } from '../services/financeCalculator.js';
import { validateSummaryRequest } from '../middleware/validator.js';

const router = express.Router();

/**
 * POST /api/finance/summary
 * Calculates all grounded metrics deterministically
 */
router.post('/summary', validateSummaryRequest, (req, res) => {
  try {
    const { transactions, openingBalance, budgets, savingsGoals, referenceDate, clientToday, timezone } = req.body;
    const summary = calculateFinancialSummary({
      transactions,
      openingBalance: Number(openingBalance || 0),
      budgets: budgets || [],
      savingsGoals: savingsGoals || [],
      referenceDate: referenceDate ? new Date(referenceDate) : new Date(),
      clientToday: typeof clientToday === 'string' ? clientToday : null,
      timezone: typeof timezone === 'string' ? timezone : null
    });

    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Calculation Failed',
      message: err.message
    });
  }
});

export default router;
