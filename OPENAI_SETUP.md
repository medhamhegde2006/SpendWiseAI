# OpenAI Setup & Grounding Architecture Guide

SpendWise AI leverages the official OpenAI Node.js SDK to power its intelligent expense analysis chatbot.

---

## 1. Obtaining an OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com/).
2. Log in or create an account.
3. In the sidebar, navigate to **API Keys**.
4. Click **Create new secret key**, give it a name (e.g. `SpendWise-Backend`), and copy the key (starts with `sk-...`).
5. Ensure your OpenAI account has billing/credits enabled.

---

## 2. Server Configuration
Open `server/.env` (or copy from `server/.env.example`) and insert your API key:

```env
PORT=5000
NODE_ENV=development
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY_HERE
OPENAI_MODEL=gpt-4o-mini
CLIENT_ORIGIN=http://localhost:5173
```

> **Security Note:**
> The `OPENAI_API_KEY` is **never** sent to or exposed in the frontend client code. All LLM calls pass through the Express backend proxy at `POST /api/chat`.

---

## 3. Recommended Models
- **`gpt-4o-mini`** (Default): Fast, cost-efficient, and excels at instruction following and structured JSON grounding.
- **`gpt-4o`**: Enhanced reasoning for complex multi-month financial analyses.
- **`gpt-3.5-turbo`**: Legacy fallback.

---

## 4. Grounding & Zero-Hallucination Architecture
A common pitfall with AI finance bots is arithmetic hallucination (inventing balances or getting percentages wrong). SpendWise AI solves this with a **Dual-Layer Grounding Architecture**:

```
[ User Transactions & Budgets ]
              │
              ▼
[ Server Deterministic Math Engine (JavaScript) ]
  • Exact Opening & Current Balance (Opening + Income - Expense)
  • Needs vs Wants percentages (Safe zero-denominator division)
  • Category breakdowns & Month-over-month deltas
  • Budget threshold warnings
              │
              ▼
[ Grounded Context Injector ]
  • Injected into System Prompt as VERIFIED GROUND TRUTH
              │
              ▼
[ OpenAI Responses / Chat Completion API ]
  • Low temperature (0.2)
  • Explicit directive: Never invent numbers; quote only verified facts
              │
              ▼
[ User Interface ]
```

---

## 5. Offline / No-Key Deterministic Fallback Mode
If `OPENAI_API_KEY` is omitted or left as a placeholder:
- SpendWise AI backend does **not** fail or crash.
- It automatically activates the **Deterministic Rules Engine**.
- Answers queries like *"Where did my money go?"*, *"Can I save ₹1,000?"*, *"Food expenses"*, and *"Compare this month with last month"* with 100% precision directly from the computed financial summary.
