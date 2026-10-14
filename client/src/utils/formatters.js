/**
 * Formatting helpers for currency, dates, and percentages
 */

/**
 * Formats a number as Indian Rupees (₹)
 * @param {number|string} value
 * @returns {string}
 */
export function formatINR(value) {
  const num = Number(value);
  if (isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: num % 1 === 0 ? 0 : 2
  }).format(num);
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a readable label
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Simple markdown-to-HTML formatter for AI Chatbot responses
 * Converts bold (**text**), bullet points, and line breaks safely.
 */
export function renderChatMarkdown(text) {
  if (!text) return '';
  // Escape raw HTML tags first for XSS prevention
  let safe = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert **bold**
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  // Convert *italic*
  safe = safe.replace(/\*(.*?)\*/g, '<em class="italic text-slate-600">$1</em>');
  // Convert `code`
  safe = safe.replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-700">$1</code>');
  // Line breaks
  safe = safe.replace(/\n/g, '<br/>');

  return safe;
}
