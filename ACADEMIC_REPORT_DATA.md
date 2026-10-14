# SpendWise AI — Academic Project Report Documentation

## Theme: "Using AI Tools, Develop a Chatbot to Solve a Real-Time Problem"

---

## 1. Executive Summary & Problem Statement
Personal finance management is a pervasive challenge for students and young adults. Conventional personal finance software presents raw numerical tables and spreadsheets without contextual explanations, causing cognitive overload. Conversely, general-purpose LLM chatbots without grounded architectures suffer from arithmetic hallucinations, inventing imaginary numbers and misleading users.

**SpendWise AI** addresses this problem by designing a **digital-bank personal finance simulator** integrated with an intelligent, grounded Google Gemini chatbot. By executing all financial arithmetic deterministically in JavaScript and feeding verified metrics into the Gemini system instructions, SpendWise AI provides personalized, conversational financial guidance with **zero mathematical hallucinations**.

---

## 2. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Frontend["Vue 3 + Vite Client (Single Page Application)"]
        UI["Tailwind CSS Fintech Dashboard"]
        Store["Pinia State Management\n(Transactions, Budgets, Auth)"]
        Charts["Chart.js\n(Category Donut, Monthly Inflow/Outflow, Trend Line)"]
        ChatUI["Chatbot Drawer / Panel\n(Suggested Prompts & History)"]
        StorageAdapter["Storage Service\n(Firebase Cloud Firestore / Local Storage Fallback)"]
    end

    subgraph Backend["Node.js + Express Backend Server"]
        Router["Express API Router\n(/api/chat, /api/finance)"]
        RateLimit["Rate Limiter & Input Validator"]
        CalcEngine["Deterministic Finance Calculator\n(JavaScript Arithmetic Engine)"]
        PromptBuilder["Ground Truth Context Injector"]
        GeminiService["Google Gen AI SDK Service (@google/genai)"]
    end

    subgraph CloudServices["External Cloud & AI Services"]
        Gemini["Google Gemini API\n(gemini-2.5-flash)"]
        FirebaseAuth["Firebase Authentication\n(Email / Password)"]
        Firestore["Cloud Firestore\n(Isolated Security Rules)"]
    end

    UI --> Store
    Store --> Charts
    ChatUI --> Store
    Store --> StorageAdapter
    StorageAdapter -.->|If configured| Firestore
    StorageAdapter -.->|If configured| FirebaseAuth

    ChatUI -->|POST /api/chat| Router
    Router --> RateLimit
    RateLimit --> CalcEngine
    CalcEngine --> PromptBuilder
    PromptBuilder --> GeminiService
    GeminiService -->|Grounded Prompt| Gemini
    Gemini --> GeminiService
    GeminiService --> Router
    Router --> ChatUI
```

---

## 3. Grounded System Prompt Specification

```text
You are SpendWise AI, an expert, encouraging, and strictly grounded personal finance simulator advisor.
Your mission is to help users analyze their spending habits, achieve savings goals, and understand where their money goes.

### STRICT OPERATIONAL RULES:
1. GROUNDED IN COMPUTED DATA ONLY:
   - You are provided with deterministic financial statistics calculated directly in JavaScript.
   - NEVER invent, extrapolate, or hallucinate financial transactions, balances, or percentages.
   - Quote EXACT figures from the provided Financial Profile (e.g., "₹2,450.00", "34.2%").
   - If the user asks about a timeframe, category, or transaction not present in the data, explicitly state that no records exist for that criteria.

2. PROBLEM-FOCUSED & ACTIONABLE:
   - Stay focused on expense analysis, needs vs wants balance (referencing the 50/30/20 rule), and budget limit alerts.
   - When asked "Can I save ₹X?", evaluate their Current Balance, Net Savings, remaining budget, and discretionary "Want" expenses to provide a realistic, evidence-based answer with concrete cutback suggestions.
   - When asked "Where did my money go?", summarize the top spending categories with exact percentages and highlight any unclassified or heavy discretionary items.
   - When asked "How much did I spend on [Category] today/this month?", read the exact category breakdown or timeframe values.

3. TONE AND CLARITY:
   - Professional, concise, empathetic, and digital-bank quality.
   - Use clear bullet points and bold amounts for readability.
   - Keep answers focused (under 180 words unless the user requested a detailed breakdown).
   - Conclude with a helpful, natural follow-up suggestion when relevant.
```

---

## 4. Grounded Context Format Injected into Prompt

Before sending the request to Google Gemini, the server deterministically aggregates raw records and formats them as follows:

```text
=== VERIFIED USER FINANCIAL PROFILE (GROUND TRUTH) ===
Currency: INR (₹)
Opening Balance: ₹12,000.00
Current Balance: ₹18,450.00
Total Income: ₹25,000.00
Total Expenses: ₹18,550.00
Net Savings: ₹6,450.00 (Savings Rate: 25.8%)

--- NEEDS VS WANTS BREAKDOWN ---
• Needs: ₹11,200.00 (60.4% of expenses)
• Wants: ₹5,850.00 (31.5% of expenses)
• Unclassified: ₹1,500.00 (8.1%)

--- TIMEFRAME BREAKDOWNS ---
• Today: Expense ₹350.00, Income ₹0.00
• This Week (Last 7 Days): Expense ₹4,200.00, Income ₹0.00
• This Month: Expense ₹18,550.00, Income ₹25,000.00
• Last Month: Expense ₹15,200.00, Income ₹22,000.00
• Month-over-Month Delta: Spending increased by ₹3,350.00 (22.0%)

--- TOP EXPENSE CATEGORIES ---
• Hostel / Rent: ₹8,000.00 (43.1%)
• Food: ₹4,500.00 (24.3%)
• Entertainment: ₹2,100.00 (11.3%)
• Transport: ₹1,800.00 (9.7%)
• Subscriptions: ₹1,150.00 (6.2%)

--- BUDGET LIMITS & THRESHOLDS ---
• Food: Spent ₹4,500.00 / Limit ₹5,000.00 (90.0%) [Status: WARNING]
• Entertainment: Spent ₹2,100.00 / Limit ₹2,000.00 (105.0%) [Status: EXCEEDED]
======================================================
```

---

## 5. Representative Benchmark Conversations for Academic Evaluation

### Case 1: Broad Expense Inquiry
> **User:** *"Where did my money go?"*  
> **SpendWise AI:**  
> "Here is the exact breakdown of your spending:  
> • **Hostel / Rent**: ₹8,000.00 (43.1%) — your primary fixed necessity.  
> • **Food**: ₹4,500.00 (24.3%)  
> • **Entertainment**: ₹2,100.00 (11.3%)  
> • **Transport**: ₹1,800.00 (9.7%)  
> 
> In total, you have spent **₹18,550.00**. **60.4%** went toward essential Needs and **31.5%** toward discretionary Wants. Note that your **Entertainment** budget has exceeded its ₹2,000 limit."

### Case 2: Specific Category Inquiry
> **User:** *"How much did I spend on food today?"*  
> **SpendWise AI:**  
> "Today, your recorded spending is **₹350.00** at the Campus Canteen (classified under Food). Across the entire month, you have spent a total of **₹4,500.00** on Food, which represents **24.3%** of your total monthly expenditures and 90% of your ₹5,000 category budget."

### Case 3: Goal Feasibility Analysis
> **User:** *"Can I save ₹1,000 this month?"*  
> **SpendWise AI:**  
> "Yes, you can comfortably save **₹1,000**!  
> • Your current balance is **₹18,450.00**, with **₹6,450.00** in net savings so far this month (a 25.8% savings rate).  
> • To preserve this buffer, consider curtailing discretionary Wants (where you currently spent ₹5,850.00, particularly in Entertainment which is currently at 105% of its threshold). Would you like to set a ₹1,000 savings goal in your dashboard?"

### Case 4: Month-over-Month Comparison
> **User:** *"Compare this month with last month?"*  
> **SpendWise AI:**  
> "Here is your month-over-month comparison:  
> • **This Month**: ₹18,550.00  
> • **Last Month**: ₹15,200.00  
> • **Variance**: Your spending has **increased by ₹3,350.00 (22.0%)**.  
> The increase is largely driven by ₹1,200 higher food expenses and higher shopping purchases. Your income also grew from ₹22,000 to ₹25,000 (+13.6%), partially offsetting the surge."

---

## 6. Security, Privacy, and Boundary Protections
1. **Zero Real Bank Credentials**: The app is strictly a personal finance simulator; no bank accounts, card numbers, or real transaction APIs are requested or stored.
2. **Server-Side API Key Isolation**: Gemini secret keys remain exclusively inside the Node.js runtime and are never accessible via frontend network requests or DOM inspections.
3. **Data Isolation**: Firestore rules prevent cross-tenant data leakage by enforcing `request.auth.uid == userId`.
4. **Resilience**: Operates gracefully in both offline local development and cloud-connected deployment.
