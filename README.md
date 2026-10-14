# SpendWise AI 🏦🤖

**Theme:** *"Personal Finance Simulator & Grounded Gemini AI Financial Advisor"*

**SpendWise AI** is a full-stack digital-bank-like personal finance simulator integrated with a grounded Google Gemini financial advisor chatbot. Built with **Vue 3 + Vite + Tailwind CSS + Chart.js** on the frontend and **Node.js + Express + Official Google Gen AI SDK (`@google/genai`)** on the backend, it solves the problem of arithmetic hallucination in financial AI assistants by executing all financial calculations deterministically in JavaScript before grounding the LLM prompt.

---

## ✨ Key Features

1. **Virtual Bank Account Simulator**
   - Set custom **Opening Balance**.
   - Real-time deterministic calculation: `Current Balance = Opening Balance + Total Income - Total Expenses`.
   - Consistent handling of **Refunds** (recorded under Income to restore balance accurately).
   - Zero real banking or payment credentials required.

2. **Comprehensive Transaction Management**
   - Add, edit, delete, search, and filter transactions by Date Period (*All Time, Today, Last 7 Days, This Month, Last Month, Custom Range*), Type (*Income/Expense*), Category, and Classification.
   - **Pre-configured Income Categories**: Scholarship, Pocket Money, Salary, Stipend, Gifts, Refunds, Freelance, Other.
   - **Pre-configured Expense Categories**: Food, Groceries, Hostel, Transport, Education, Shopping, Health, Personal Care, Entertainment, Subscriptions, Sports, Travel, Bills, Other.
   - **Custom Categories**: Create custom income or expense categories on the fly.

3. **Needs vs. Wants & 50/30/20 Diagnostic**
   - Classify every expense as **Need (Essential)**, **Want (Lifestyle)**, or **Unclassified**.
   - Automatic calculation of dollar/rupee totals and percentages with zero-denominator protection.
   - Live comparison against the 50% Needs / 30% Wants / 20% Savings benchmark.

4. **Fintech Dashboard & Interactive Charts (Chart.js)**
   - **Category Donut Chart**: Proportional expense distribution with interactive tooltips.
   - **Monthly Cashflow Bar Chart**: 6-month Income vs. Expense side-by-side comparison.
   - **14-Day Spending Velocity Line Chart**: Daily spending trend line.
   - **Savings Goals Tracker**: Create milestones, allocate funds, and monitor progress bars.

5. **Budgets, Threshold Warnings & Alert Policy**
   - Set monthly spending limits per category or overall.
   - Automatic in-app warning banners at **80% usage** (`WARNING`) and **100%+ usage** (`EXCEEDED`).
   - Built-in Web Notifications tester and transparent documentation of browser notification limitations (HTTPS context, permission grants, service worker lifecycle, OS Focus modes).

6. **Grounded Google Gemini Advisor Chatbot**
   - Powered by the official `@google/genai` Node.js SDK (`gemini-2.5-flash` / `gemini-2.5-pro`).
   - **Zero-Hallucination Grounding**: JavaScript computes exact balances, category percentages, timeframe totals, and month-over-month deltas, injecting them as verified ground truth into the Gemini system instructions.
   - Supports natural questions:
     - *"Where did my money go?"*
     - *"How much did I spend on food today?"*
     - *"Can I save ₹1,000?"*
     - *"Compare this month with last month?"*
   - Includes an **Honest Offline Deterministic Rules Fallback** so the chatbot remains 100% functional even when an API key is missing or quota is exhausted.

7. **Non-Destructive Sample Demo Data**
   - Load rich, realistic student financial data with one click.
   - Automatically backs up any existing real user records so users can switch between Demo Data and their Real Records without data loss.

---

## 📁 Project Structure

```text
SpendWise AI/
├── .env.example                 # Root environment template (Gemini & Firebase)
├── .gitignore                   # Git exclusions (protects all .env files & node_modules)
├── firestore.rules              # Cloud Firestore user-isolation security rules
├── FIREBASE_SETUP.md            # Step-by-step Firebase Auth & Firestore guide
├── GEMINI_SETUP.md              # Google Gemini API key & grounding guide
├── ACADEMIC_REPORT_DATA.md      # System prompt, Mermaid architecture & sample chats
├── package.json                 # Root workspace runner scripts
├── server/                      # Node.js + Express Backend
│   ├── .env.example             # Server environment template
│   ├── package.json             # Server dependencies (@google/genai, express, cors)
│   ├── src/
│   │   ├── index.js             # Express entry point & health check
│   │   ├── routes/
│   │   │   ├── chat.js          # POST /api/chat (Rate-limited Gemini endpoint)
│   │   │   └── finance.js       # POST /api/finance/summary
│   │   ├── services/
│   │   │   ├── financeCalculator.js # Deterministic financial math engine
│   │   │   └── geminiService.js     # Official Google Gen AI SDK integration
│   │   ├── prompts/
│   │   │   └── systemPrompt.js      # Grounded System prompt & context injector
│   │   └── middleware/
│   │       ├── validator.js         # Input validation
│   │       └── errorHandler.js      # Central error handling with secret redaction
│   └── tests/
│       ├── financeCalculator.test.js # Unit tests for financial calculations
│       └── chatGrounding.test.js     # Tests for Gemini grounding & fallback
└── client/                      # Vue 3 + Vite + Tailwind CSS Frontend
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── vite.config.js           # Vite config with /api and /health proxy
    ├── tailwind.config.js       # Navy & Emerald fintech theme
    └── src/
        ├── App.vue              # Main application layout & tab router
        ├── main.js              # Vue 3 & Pinia bootstrap
        ├── components/
        │   ├── alerts/          # BudgetAlertsBanner & Browser Notification modal
        │   ├── auth/            # AuthModal (Firebase & Local Isolated Vault)
        │   ├── chat/            # ChatPanel (Gemini Advisor UI with dev indicator)
        │   ├── common/          # AppIcon SVG system
        │   ├── dashboard/       # BalanceCards, Donut/Bar/Line Charts, Budgets, Goals
        │   └── transactions/    # TransactionList & TransactionModal
        ├── services/            # api.js, firebase.js, financeStats.js, storageService.js
        ├── stores/              # Pinia stores (authStore, financeStore, chatStore)
        └── utils/               # categories.js (demo data & colors), formatters.js
```

---

## 🚀 Getting Started (Local Execution)

### 1. Install Dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure Environment Variables
1. Copy `server/.env.example` to `server/.env` and add your `GEMINI_API_KEY`:
   ```env
   PORT=5000
   NODE_ENV=development
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
2. (Optional) Copy `client/.env.example` to `client/.env` and add your Firebase credentials if Cloud Firestore synchronization is desired.

### 3. Start Backend & Frontend Servers
Open two terminals:

**Terminal 1 — Start Backend API (Port 5000):**
```bash
cd server
npm run dev
```

**Terminal 2 — Start Vue 3 Frontend (Port 5173):**
```bash
cd client
npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## 🧪 Running Automated Tests & Production Build

### Run Backend Financial & Chatbot Tests
```bash
cd server
npm test
```

### Build Frontend for Production
```bash
cd client
npm run build
```

---

## 📚 Additional Documentation
- **[GEMINI_SETUP.md](./GEMINI_SETUP.md)**: Google Gemini setup and zero-hallucination dual-layer grounding explanation.
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**: Firebase Authentication, Cloud Firestore setup, and Security Rules.
- **[ACADEMIC_REPORT_DATA.md](./ACADEMIC_REPORT_DATA.md)**: System Architecture Diagram, Grounded System Prompt, and Benchmark Conversations.
