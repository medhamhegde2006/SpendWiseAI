/**
 * Request Validation Middleware for SpendWise AI
 */

export function validateChatRequest(req, res, next) {
  const { message, transactions, openingBalance } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Field "message" is required and must be a non-empty string.'
    });
  }

  if (message.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Message exceeds the 500 character limit.'
    });
  }

  if (transactions && !Array.isArray(transactions)) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Field "transactions" must be an array.'
    });
  }

  if (openingBalance !== undefined && isNaN(Number(openingBalance))) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Field "openingBalance" must be a valid number.'
    });
  }

  next();
}

export function validateSummaryRequest(req, res, next) {
  const { transactions, openingBalance, budgets } = req.body;

  if (!Array.isArray(transactions)) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Field "transactions" is required and must be an array.'
    });
  }

  if (openingBalance !== undefined && isNaN(Number(openingBalance))) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Field "openingBalance" must be a number.'
    });
  }

  if (budgets && !Array.isArray(budgets)) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Field "budgets" must be an array.'
    });
  }

  next();
}
