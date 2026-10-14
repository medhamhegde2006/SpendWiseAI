const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Checks backend server health & AI provider configuration status
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      return {
        healthy: false,
        groqConfigured: false,
        geminiConfigured: false,
        configuredModel: null
      };
    }

    const raw = await res.text();
    if (!raw || !raw.trim()) {
      return {
        healthy: false,
        groqConfigured: false,
        geminiConfigured: false,
        configuredModel: null
      };
    }

    const data = JSON.parse(raw);
    const isConfigured = Boolean(data.groqConfigured ?? data.geminiConfigured ?? data.openaiConfigured);
    return {
      healthy: data.status === 'healthy',
      groqConfigured: isConfigured,
      geminiConfigured: isConfigured,
      configuredModel: data.configuredModel || null,
      provider: data.provider || 'groq',
      environment: data.environment || 'development'
    };
  } catch {
    return {
      healthy: false,
      groqConfigured: false,
      geminiConfigured: false,
      configuredModel: null
    };
  }
}

/**
 * Sends user message and financial dataset to the backend Chatbot endpoint
 * Robustly validates HTTP response status, headers, and text before parsing JSON.
 */
export async function sendChatMessage({
  message,
  conversationHistory = [],
  transactions = [],
  openingBalance = 0,
  budgets = [],
  savingsGoals = [],
  clientToday = null,
  timezone = null
}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        message,
        conversationHistory,
        transactions,
        openingBalance,
        budgets,
        savingsGoals,
        clientToday,
        timezone
      })
    });
  } catch (netErr) {
    const err = new Error(
      'SpendWise AI backend server is unreachable. Please verify that the backend server is running on port 5000.'
    );
    err.code = 'backend_unreachable';
    err.originalError = netErr;
    throw err;
  }

  // Safely read response text first to prevent "Unexpected end of JSON input" on empty bodies
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const rawText = await response.text();

  let parsed = null;
  if (rawText && rawText.trim().length > 0) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  // Handle non-2xx HTTP responses
  if (!response.ok) {
    let errorMsg;
    let errorCode = 'backend_error';

    if (response.status === 429) {
      errorCode = 'rate_limited';
      errorMsg = parsed?.message || 'Chat request limit reached. Please wait a moment before sending another message.';
    } else if (response.status === 502 || response.status === 503 || response.status === 504) {
      errorCode = 'backend_unreachable';
      errorMsg = `SpendWise AI backend server is unavailable (HTTP ${response.status} ${response.statusText || 'Bad Gateway'}). Make sure the backend server is running on port 5000.`;
    } else if (parsed && parsed.message) {
      errorMsg = parsed.message;
      errorCode = parsed.error || `http_${response.status}`;
    } else if (rawText && !isJson && rawText.length < 200) {
      errorMsg = rawText.trim();
    } else {
      errorMsg = `Backend server returned HTTP ${response.status} (${response.statusText || 'Error'}).`;
    }

    const err = new Error(errorMsg);
    err.status = response.status;
    err.code = errorCode;
    err.responseBody = parsed || rawText;
    throw err;
  }

  // If response status is 200 OK but body is empty or not JSON
  if (!parsed || typeof parsed !== 'object') {
    const err = new Error(
      'Received empty or invalid JSON response from SpendWise AI backend server.'
    );
    err.status = response.status;
    err.code = 'invalid_response_format';
    throw err;
  }

  if (!parsed.success) {
    const err = new Error(parsed.message || 'Chatbot request was not successful.');
    err.status = response.status;
    err.code = parsed.error || 'request_unsuccessful';
    throw err;
  }

  return parsed.data;
}
