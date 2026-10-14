import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { calculateFinancialSummary } from '../src/services/financeCalculator.js';
import { buildGroundedContext } from '../src/prompts/systemPrompt.js';
import {
  getChatbotResponse,
  sanitizeErrorMessage,
  classifyGroqError,
  getGroqConfigStatus,
  getConfiguredGroqModel,
  isGreetingQuery,
  generateGreetingResponse,
  getGroqCooldownStatus,
  triggerGroqCooldown,
  resetGroqCooldown,
  DEFAULT_GROQ_MODEL
} from '../src/services/groqService.js';

describe('Groq Grounding, Secret Sanitization, and Representative Case Tests', () => {
  const sampleTransactions = [
    { id: '1', type: 'income', amount: 15000, category: 'Stipend', date: '2026-10-01' },
    { id: '2', type: 'expense', amount: 3500, category: 'Food', classification: 'need', date: '2026-10-02' },
    { id: '3', type: 'expense', amount: 1500, category: 'Entertainment', classification: 'want', date: '2026-10-03' },
    { id: '4', type: 'expense', amount: 2000, category: 'Transport', classification: 'need', date: '2026-10-04' }
  ];

  const budgets = [
    { category: 'Food', limit: 4000 },
    { category: 'Entertainment', limit: 1200 }
  ];

  const summary = calculateFinancialSummary({
    transactions: sampleTransactions,
    openingBalance: 5000,
    budgets,
    referenceDate: new Date('2026-10-10')
  });

  let savedGroqKey;
  before(() => {
    savedGroqKey = process.env.GROQ_API_KEY;
    // Set empty key during unit test suite to ensure tests run offline without consuming live quota
    process.env.GROQ_API_KEY = '';
    resetGroqCooldown();
  });

  after(() => {
    if (savedGroqKey !== undefined) {
      process.env.GROQ_API_KEY = savedGroqKey;
    }
    resetGroqCooldown();
  });

  test('sanitizeErrorMessage strips Groq, Gemini, and OpenAI keys from error strings', () => {
    const raw = 'Error with gsk_sampleDummyKeyForTest1234567890abcdef and key=AIzaSyA1234567890abcdef1234567890abcdef';
    const sanitized = sanitizeErrorMessage(raw);
    assert.ok(!sanitized.includes('sampleDummyKeyForTest1234567890abcdef'));
    assert.ok(!sanitized.includes('AIzaSyA1234567890abcdef1234567890abcdef'));
    assert.ok(sanitized.includes('gsk_***REDACTED***'));
    assert.ok(sanitized.includes('key=***REDACTED***'));
  });

  test('classifyGroqError safely categorizes 401 invalid key, 403 permission, 404 model, 408 timeout, 429 rate limit, and network errors', () => {
    const err401 = classifyGroqError({ status: 401, message: 'Invalid API Key for gsk_secretKey1234567890' });
    assert.strictEqual(err401.code, 'invalid_api_key');
    assert.ok(!err401.safeMessage.includes('secretKey'));

    const err403 = classifyGroqError({ status: 403, message: 'Permission denied for project' });
    assert.strictEqual(err403.code, 'permission_denied');

    const err429 = classifyGroqError({ status: 429, message: 'rate_limit_exceeded' });
    assert.strictEqual(err429.code, 'rate_limited');

    const err404 = classifyGroqError({ status: 404, message: 'The model `not-found` does not exist' });
    assert.strictEqual(err404.code, 'model_unavailable');

    const err408 = classifyGroqError({ status: 408, message: 'Request timeout' });
    assert.strictEqual(err408.code, 'timeout_error');

    const errNet = classifyGroqError({ message: 'fetch failed: ENOTFOUND api.groq.com' });
    assert.strictEqual(errNet.code, 'network_error');
  });

  test('classifyGroqError extracts retry-after duration when provided in headers or body', () => {
    const errWithHeader = classifyGroqError({
      status: 429,
      message: 'Rate limit exceeded',
      headers: { 'retry-after': '25' }
    });
    assert.strictEqual(errWithHeader.code, 'rate_limited');
    assert.strictEqual(errWithHeader.retryAfterSeconds, 25);

    const errWithMsg = classifyGroqError({
      status: 429,
      message: 'Rate limit reached. Please retry in 18.5s'
    });
    assert.strictEqual(errWithMsg.code, 'rate_limited');
    assert.strictEqual(errWithMsg.retryAfterSeconds, 19);
  });

  test('Groq cooldown circuit breaker triggers on 429 and recovers upon reset', () => {
    resetGroqCooldown();
    assert.strictEqual(getGroqCooldownStatus().active, false);

    triggerGroqCooldown(10, { code: 'rate_limited', safeMessage: 'Rate limited' });
    const activeStatus = getGroqCooldownStatus();
    assert.strictEqual(activeStatus.active, true);
    assert.ok(activeStatus.remainingSeconds > 0);
    assert.strictEqual(activeStatus.reason.code, 'rate_limited');

    resetGroqCooldown();
    assert.strictEqual(getGroqCooldownStatus().active, false);
  });

  test('isGreetingQuery accurately identifies greetings while excluding active financial questions', () => {
    assert.strictEqual(isGreetingQuery('Hii'), true);
    assert.strictEqual(isGreetingQuery('Hello'), true);
    assert.strictEqual(isGreetingQuery('Hey'), true);
    assert.strictEqual(isGreetingQuery('Good morning'), true);
    assert.strictEqual(isGreetingQuery('yo'), true);
    assert.strictEqual(isGreetingQuery('Hi SpendWise'), true);
    assert.strictEqual(isGreetingQuery('Hello!'), true);

    // Active financial inquiries must NOT be treated as pure greetings
    assert.strictEqual(isGreetingQuery('How much did I spend on food today?'), false);
    assert.strictEqual(isGreetingQuery('Where did my money go?'), false);
    assert.strictEqual(isGreetingQuery('Can I save ₹1,000?'), false);
    assert.strictEqual(isGreetingQuery('Hello, how much did I spend on food today?'), false);
  });

  test('greeting query: "Hii" returns natural greeting without financial balance dump', async () => {
    const res = await getChatbotResponse({
      userMessage: 'Hii',
      conversationHistory: [],
      financialSummary: summary,
      recentTransactions: sampleTransactions
    });

    assert.ok(res.reply.toLowerCase().includes('hello') || res.reply.toLowerCase().includes('spendwise ai'));
    assert.ok(!res.reply.includes('SpendWise Financial Overview:'));
    assert.ok(!res.reply.includes('Current Balance: ₹13,000'));
    assert.ok(!res.reply.includes('Total Expenses: ₹7,000'));
    assert.ok(res.reply.includes('Where did my money go?'));
  });

  test('greeting query: "Hello" returns natural greeting without financial balance dump', async () => {
    const res = await getChatbotResponse({
      userMessage: 'Hello',
      conversationHistory: [],
      financialSummary: summary,
      recentTransactions: sampleTransactions
    });

    assert.ok(res.reply.toLowerCase().includes('hello') || res.reply.toLowerCase().includes('spendwise ai'));
    assert.ok(!res.reply.includes('SpendWise Financial Overview:'));
    assert.ok(!res.reply.includes('Current Balance: ₹13,000'));
  });

  test('unrecognized query returns friendly clarification rather than full financial ledger dump', async () => {
    const res = await getChatbotResponse({
      userMessage: 'xyz123 random question',
      conversationHistory: [],
      financialSummary: summary,
      recentTransactions: sampleTransactions
    });

    assert.ok(res.reply.toLowerCase().includes('catch that') || res.reply.toLowerCase().includes('help you'));
    assert.ok(!res.reply.includes('SpendWise Financial Overview:'));
    assert.ok(!res.reply.includes('Current Balance: ₹13,000'));
  });

  test('explicit overview query: "Show my financial overview" returns full financial overview', async () => {
    const res = await getChatbotResponse({
      userMessage: 'Show my financial overview',
      conversationHistory: [],
      financialSummary: summary,
      recentTransactions: sampleTransactions
    });

    assert.ok(res.reply.includes('SpendWise Financial Overview:'));
    assert.ok(res.reply.includes('Current Balance:'));
    assert.ok(res.reply.includes('Total Expenses:'));
  });

  test('getGroqConfigStatus detects missing or placeholder keys accurately', () => {
    process.env.GROQ_API_KEY = '';
    assert.strictEqual(getGroqConfigStatus().configured, false);
    assert.strictEqual(getGroqConfigStatus().reason, 'missing_groq_api_key');

    process.env.GROQ_API_KEY = 'your_groq_api_key_here';
    assert.strictEqual(getGroqConfigStatus().configured, false);
    assert.strictEqual(getGroqConfigStatus().reason, 'placeholder_api_key');

    process.env.GROQ_API_KEY = 'short_key';
    assert.strictEqual(getGroqConfigStatus().configured, false);
    assert.strictEqual(getGroqConfigStatus().reason, 'invalid_key_format');

    process.env.GROQ_API_KEY = '';
  });

  test('getConfiguredGroqModel defaults to openai/gpt-oss-120b', () => {
    const original = process.env.GROQ_MODEL;
    delete process.env.GROQ_MODEL;
    assert.strictEqual(getConfiguredGroqModel().model, DEFAULT_GROQ_MODEL);

    process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
    assert.strictEqual(getConfiguredGroqModel().model, 'openai/gpt-oss-20b');

    if (original !== undefined) {
      process.env.GROQ_MODEL = original;
    }
  });

  test('buildGroundedContext creates factual data block without hallucinations', () => {
    const context = buildGroundedContext(summary, sampleTransactions);

    assert.ok(context.includes('Opening Balance: ₹5,000'));
    assert.ok(context.includes('Current Balance: ₹13,000'));
    assert.ok(context.includes('Total Income: ₹15,000'));
    assert.ok(context.includes('Total Expenses: ₹7,000'));
    assert.ok(context.includes('Food: ₹3,500'));
    assert.ok(context.includes('Needs: ₹5,500'));
    assert.ok(context.includes('Wants: ₹1,500'));
  });

  test('representative query: "Where did my money go?" returns grounded breakdown with honest fallback metadata', async () => {
    const res = await getChatbotResponse({
      userMessage: 'Where did my money go?',
      conversationHistory: [],
      financialSummary: summary,
      recentTransactions: sampleTransactions
    });

    assert.ok(res.reply.length > 20);
    assert.strictEqual(res.isFallback, true);
    assert.strictEqual(res.source, 'offline-fallback');
    assert.strictEqual(res.devStatus.mode, 'OFFLINE_FALLBACK');
    assert.ok(res.reply.includes('Food') || res.reply.includes('₹7,000'));
  });

  test('representative query: "Can I save ₹1,000?" answers based on balance & wants', async () => {
    const res = await getChatbotResponse({
      userMessage: 'Can I save ₹1,000?',
      conversationHistory: [],
      financialSummary: summary,
      recentTransactions: sampleTransactions
    });

    assert.ok(res.reply.toLowerCase().includes('yes') || res.reply.includes('1,000'));
  });

  test('representative query: "How much did I spend on food today?" with today food expense reports exact today food spend', async () => {
    const todaySummary = calculateFinancialSummary({
      transactions: [
        { id: '1', type: 'expense', amount: 350, category: 'Food', date: '2026-10-14' },
        { id: '2', type: 'expense', amount: 150, category: 'Transport', date: '2026-10-14' }
      ],
      openingBalance: 5000,
      clientToday: '2026-10-14'
    });

    const res = await getChatbotResponse({
      userMessage: 'How much did I spend on food today?',
      conversationHistory: [],
      financialSummary: todaySummary,
      recentTransactions: todaySummary.timeframes.today.transactions
    });

    assert.ok(res.reply.includes('350'));
    assert.ok(res.reply.toLowerCase().includes('food'));
    assert.ok(res.reply.toLowerCase().includes('today'));
  });

  test('representative query: "How much did I spend on food today?" with NO food expense today clearly states ₹0', async () => {
    const todaySummary = calculateFinancialSummary({
      transactions: [
        { id: '1', type: 'expense', amount: 200, category: 'Transport', date: '2026-10-14' },
        { id: '2', type: 'expense', amount: 500, category: 'Food', date: '2026-10-10' } // food on an earlier day
      ],
      openingBalance: 5000,
      clientToday: '2026-10-14'
    });

    const res = await getChatbotResponse({
      userMessage: 'How much did I spend on food today?',
      conversationHistory: [],
      financialSummary: todaySummary,
      recentTransactions: todaySummary.timeframes.today.transactions
    });

    assert.ok(res.reply.includes('0'));
    assert.ok(res.reply.toLowerCase().includes('food'));
    assert.ok(res.reply.toLowerCase().includes('today'));
  });

  test('representative query: "Can I save ₹1,000?" asks clarifying question if income is missing', async () => {
    const noIncomeSummary = calculateFinancialSummary({
      transactions: [
        { id: '1', type: 'expense', amount: 500, category: 'Food', date: '2026-10-14' }
      ],
      openingBalance: 2000,
      clientToday: '2026-10-14'
    });

    const res = await getChatbotResponse({
      userMessage: 'Can I save ₹1,000?',
      conversationHistory: [],
      financialSummary: noIncomeSummary,
      recentTransactions: []
    });

    assert.ok(res.reply.toLowerCase().includes('income'));
    assert.ok(res.reply.includes('?') || res.reply.toLowerCase().includes('expected'));
  });

  test('financial context isolation: User A data is not mixed with User B context', () => {
    const userASummary = calculateFinancialSummary({
      transactions: [{ id: 'a1', type: 'income', amount: 50000, category: 'Salary', date: '2026-10-01' }],
      openingBalance: 10000
    });

    const userBSummary = calculateFinancialSummary({
      transactions: [{ id: 'b1', type: 'expense', amount: 300, category: 'Food', date: '2026-10-01' }],
      openingBalance: 500
    });

    const contextA = buildGroundedContext(userASummary, userASummary.timeframes.today.transactions);
    const contextB = buildGroundedContext(userBSummary, userBSummary.timeframes.today.transactions);

    assert.ok(contextA.includes('50,000'));
    assert.ok(!contextA.includes('300'));
    assert.ok(contextB.includes('300'));
    assert.ok(!contextB.includes('50,000'));
  });

  describe('12 Deterministic Grounded Analysis Questions', () => {
    const fullTestSummary = calculateFinancialSummary({
      transactions: [
        { id: 't1', type: 'income', amount: 30000, category: 'Salary', date: '2026-10-01' },
        { id: 't2', type: 'expense', amount: 5000, category: 'Rent', classification: 'need', date: '2026-10-02' },
        { id: 't3', type: 'expense', amount: 4000, category: 'Food', classification: 'need', date: '2026-10-05' },
        { id: 't4', type: 'expense', amount: 2500, category: 'Entertainment', classification: 'want', date: '2026-10-08' },
        { id: 't5', type: 'expense', amount: 1500, category: 'Shopping', classification: 'want', date: '2026-10-09' },
        { id: 't6', type: 'expense', amount: 600, category: 'Food', classification: 'need', date: '2026-10-13' }, // yesterday
        { id: 't7', type: 'expense', amount: 400, category: 'Transport', classification: 'need', date: '2026-10-14' } // today
      ],
      openingBalance: 10000,
      budgets: [
        { category: 'Rent', limit: 6000 },
        { category: 'Food', limit: 5000 }, // spent 4600 -> 92% (warning / near limit)
        { category: 'Entertainment', limit: 2000 } // spent 2500 -> 125% (exceeded)
      ],
      savingsGoals: [
        { id: 'g1', name: 'MacBook Fund', targetAmount: 80000, savedAmount: 20000, deadline: '2026-12-31' }
      ],
      clientToday: '2026-10-14'
    });

    test('1. "Where did my money go?" returns top 3 spending categories', async () => {
      const res = await getChatbotResponse({
        userMessage: 'Where did my money go?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('Food') || res.reply.includes('Rent'));
      assert.ok(res.reply.includes('Total Expenses'));
      assert.strictEqual(res.isFallback, true);
    });

    test('2. "How much did I spend this month?" returns exact month spend & cash flow', async () => {
      const res = await getChatbotResponse({
        userMessage: 'How much did I spend this month?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('14,000')); // 5000+4000+2500+1500+600+400 = 14000
      assert.ok(res.reply.includes('30,000')); // income
    });

    test('3. "Analyze my Needs vs Wants ratio" returns 50/30/20 breakdown', async () => {
      const res = await getChatbotResponse({
        userMessage: 'Analyze my Needs vs Wants ratio',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('Needs'));
      assert.ok(res.reply.includes('Wants'));
      assert.ok(res.reply.includes('50/30/20'));
    });

    test('4. "What is my highest spending category?" identifies Rent', async () => {
      const res = await getChatbotResponse({
        userMessage: 'What is my highest spending category?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('Rent'));
      assert.ok(res.reply.includes('5,000'));
    });

    test('5. "Which budgets are near their limit?" lists Food (≥80%)', async () => {
      const res = await getChatbotResponse({
        userMessage: 'Which budgets are near their limit?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('Food'));
      assert.ok(res.reply.includes('4,600') || res.reply.includes('92%'));
    });

    test('6. "Which budgets are exceeded?" lists Entertainment (≥100%)', async () => {
      const res = await getChatbotResponse({
        userMessage: 'Which budgets are exceeded?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('Entertainment'));
      assert.ok(res.reply.includes('2,500') || res.reply.includes('Exceeded'));
    });

    test('7. "What is my monthly income?" returns this month income', async () => {
      const res = await getChatbotResponse({
        userMessage: 'What is my monthly income?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('30,000'));
    });

    test('8. "What is my current balance?" returns calculated balance', async () => {
      const res = await getChatbotResponse({
        userMessage: 'What is my current balance?',
        financialSummary: fullTestSummary
      });
      // opening 10000 + 30000 - 14000 = 26000
      assert.ok(res.reply.includes('26,000'));
      assert.ok(res.reply.includes('10,000'));
    });

    test('9. "How much did I spend yesterday?" returns yesterday spend', async () => {
      const res = await getChatbotResponse({
        userMessage: 'How much did I spend yesterday?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('600'));
      assert.ok(res.reply.includes('Food'));
    });

    test('10. "How much did I spend in the last 7 days?" returns week spend', async () => {
      const res = await getChatbotResponse({
        userMessage: 'How much did I spend in the last 7 days?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('Last 7 Days'));
      assert.ok(res.reply.includes('Total Expenses'));
    });

    test('11. "How can I reduce expenses?" recommends trimming discretionary wants', async () => {
      const res = await getChatbotResponse({
        userMessage: 'How can I reduce expenses?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('Wants'));
      assert.ok(res.reply.includes('4,000')); // 2500 + 1500 wants
    });

    test('12. "What do I need for my savings goals?" reports remaining goal balance', async () => {
      const res = await getChatbotResponse({
        userMessage: 'What do I need for my savings goals?',
        financialSummary: fullTestSummary
      });
      assert.ok(res.reply.includes('MacBook Fund'));
      assert.ok(res.reply.includes('60,000')); // 80000 - 20000
    });

    test('Resilience: handles empty or undefined summary without throwing', async () => {
      const res = await getChatbotResponse({
        userMessage: 'What is my balance?',
        financialSummary: {}
      });
      assert.ok(res.reply);
      assert.strictEqual(res.isFallback, true);
    });
  });
});
