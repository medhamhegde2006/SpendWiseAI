import { sanitizeErrorMessage } from '../services/openaiService.js';

/**
 * Global Error Handling Middleware for Express
 * Never logs or returns raw secrets.
 */
export function errorHandler(err, req, res, next) {
  const safeMsg = sanitizeErrorMessage(err?.message || 'Internal Server Error');
  console.error('Unhandled Server Error:', safeMsg);

  const statusCode = err?.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: 'Internal Server Error',
    message: safeMsg,
    status: statusCode
  });
}
