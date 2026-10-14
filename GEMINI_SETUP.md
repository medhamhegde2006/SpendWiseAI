# Google Gemini Setup & Grounding Architecture Guide

SpendWise AI leverages Google's official `@google/genai` Node.js SDK to power its intelligent expense analysis chatbot.

---

## 1. Obtaining a Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. In the left navigation, click **Get API key**.
4. Click **Create API key** (in a new or existing Google Cloud project) and copy the generated key.

---

## 2. Server Configuration
Open `server/.env` (or copy from `server/.env.example`) and insert your Gemini configuration:

```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
CLIENT_ORIGIN=http://localhost:5173
```

> **Security Note:**
> The `GEMINI_API_KEY` is **never** sent to or exposed in the frontend client code, browser network payloads, or logs. All LLM calls pass strictly through the Express backend proxy at `POST /api/chat`.

---

## 3. Supported Models
- **`gemini-2.5-flash`** (Default): Fast, highly capable, and excels at instruction following and structured JSON grounding.
- **`gemini-2.5-pro`**: Advanced reasoning for complex multi-month financial analyses.
- **`gemini-2.0-flash`**: High-throughput multimodal baseline.
- **`gemini-2.0-flash-lite`**: Ultra-lightweight option.

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
  • Injected into Gemini systemInstruction as VERIFIED GROUND TRUTH
              │
              ▼
[ Google Gen AI SDK (@google/genai) ]
  • Low temperature (0.2)
  • Explicit directive: Never invent numbers; quote only verified facts
              │
              ▼
[ User Interface ]
```

---

## 5. Offline / No-Key Deterministic Fallback Mode
If `GEMINI_API_KEY` is omitted or left as a placeholder:
- SpendWise AI backend does **not** fail or crash.
- It automatically activates the **Deterministic Rules Engine**.
- Answers queries like *"Where did my money go?"*, *"Can I save ₹1,000?"*, *"Food expenses"*, and *"Compare this month with last month"* with 100% precision directly from the computed financial summary.
- The development status indicator honestly shows `OFFLINE FALLBACK` rather than disguising fallback responses as live AI output.
