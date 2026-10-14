import { test, describe } from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getChatbotResponse, getGroqConfigStatus, resetGroqCooldown } from '../src/services/groqService.js';
import { calculateFinancialSummary } from '../src/services/financeCalculator.js';

// Load server/.env directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

describe('GroqCloud Live Provider Verification', () => {
  test('executes controlled live Groq inference when GROQ_API_KEY is configured', async (t) => {
    resetGroqCooldown();
    const configStatus = getGroqConfigStatus();

    if (!configStatus.configured) {
      t.skip('Skipping live Groq inference: GROQ_API_KEY is not configured in server/.env');
      return;
    }

    const testSummary = calculateFinancialSummary({
      transactions: [
        { id: 't1', type: 'expense', amount: 350, category: 'Food', date: '2026-10-14' },
        { id: 't2', type: 'income', amount: 15000, category: 'Salary', date: '2026-10-01' }
      ],
      openingBalance: 5000,
      clientToday: '2026-10-14'
    });

    const response = await getChatbotResponse({
      userMessage: 'How much did I spend on food today?',
      conversationHistory: [],
      financialSummary: testSummary,
      recentTransactions: testSummary.timeframes.today.transactions
    });

    // Verify that live Groq call actually succeeded
    assert.strictEqual(response.isFallback, false, 'Expected live response, not fallback');
    assert.strictEqual(response.source, 'groq', 'Expected source to be groq');
    assert.strictEqual(response.modelUsed, 'openai/gpt-oss-120b');
    assert.strictEqual(response.devStatus.mode, 'LIVE_GROQ');
    assert.strictEqual(response.devStatus.provider, 'groq-sdk');
    assert.ok(typeof response.reply === 'string' && response.reply.length > 5);
    assert.ok(response.reply.includes('350'), 'Reply must reflect exact grounded food expense of 350');
  });
});
