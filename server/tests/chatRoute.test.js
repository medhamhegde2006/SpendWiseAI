import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import app from '../src/index.js';
import { resetGroqCooldown } from '../src/services/groqService.js';

describe('HTTP Route Integration: /api/chat and /health', () => {
  let server;
  let baseUrl;
  let savedGroqKey;

  before(async () => {
    savedGroqKey = process.env.GROQ_API_KEY;
    // Test in offline fallback mode during mock route verification
    process.env.GROQ_API_KEY = '';
    resetGroqCooldown();

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (savedGroqKey !== undefined) {
      process.env.GROQ_API_KEY = savedGroqKey;
    }
    resetGroqCooldown();

    await new Promise((resolve) => {
      if (server) {
        server.close(resolve);
      } else {
        resolve();
      }
    });
  });

  test('GET /health returns 200 with valid JSON status and Groq provider info', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('application/json'));

    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.service, 'SpendWise AI API');
    assert.strictEqual(data.provider, 'groq');
  });

  test('POST /api/chat returns 200 with valid JSON response contract', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Where did my money go?',
        transactions: [
          { id: '1', type: 'expense', amount: 500, category: 'Food', date: '2026-10-14' }
        ],
        openingBalance: 1000
      })
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('application/json'));

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data);
    assert.ok(typeof json.data.reply === 'string');
    assert.strictEqual(json.data.isFallback, true);
  });

  test('POST /api/chat handles greeting "Hii" returning natural greeting without financial dump', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hii',
        transactions: [
          { id: '1', type: 'expense', amount: 500, category: 'Food', date: '2026-10-14' }
        ],
        openingBalance: 1000
      })
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.reply.toLowerCase().includes('hello') || json.data.reply.toLowerCase().includes('spendwise ai'));
    assert.ok(!json.data.reply.includes('SpendWise Financial Overview:'));
    assert.ok(!json.data.reply.includes('Current Balance:'));
  });

  test('POST /api/chat rejects empty message with 400 Bad Request JSON', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: ''
      })
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.headers.get('content-type')?.includes('application/json'));
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.ok(json.message);
  });
});
