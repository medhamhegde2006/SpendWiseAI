/**
 * Categories, Default Classifications, Chart Colors, and Demo Datasets
 */

export const DEFAULT_INCOME_CATEGORIES = [
  'Scholarship',
  'Pocket Money',
  'Salary',
  'Stipend',
  'Gifts',
  'Refunds',
  'Freelance',
  'Other'
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Hostel',
  'Transport',
  'Education',
  'Shopping',
  'Health',
  'Personal Care',
  'Entertainment',
  'Subscriptions',
  'Sports',
  'Travel',
  'Bills',
  'Other'
];

/**
 * Smart default Needs vs Wants mapping when user selects an expense category
 */
export const CATEGORY_DEFAULT_CLASSIFICATION = {
  'Food': 'need',
  'Groceries': 'need',
  'Hostel': 'need',
  'Transport': 'need',
  'Education': 'need',
  'Health': 'need',
  'Bills': 'need',
  'Personal Care': 'need',
  'Shopping': 'want',
  'Entertainment': 'want',
  'Subscriptions': 'want',
  'Sports': 'want',
  'Travel': 'want',
  'Other': 'unclassified'
};

/**
 * Distinct, accessible fintech chart palette
 */
export const CATEGORY_COLORS = {
  'Food': '#10b981',          // Emerald 500
  'Groceries': '#059669',     // Emerald 600
  'Hostel': '#1e3a8a',        // Navy Blue
  'Transport': '#3b82f6',     // Blue 500
  'Education': '#6366f1',     // Indigo 500
  'Shopping': '#f59e0b',      // Amber 500
  'Health': '#ef4444',        // Red 500
  'Personal Care': '#ec4899', // Pink 500
  'Entertainment': '#8b5cf6', // Violet 500
  'Subscriptions': '#06b6d4', // Cyan 500
  'Sports': '#84cc16',        // Lime 500
  'Travel': '#f97316',        // Orange 500
  'Bills': '#475569',         // Slate 600
  'Other': '#94a3b8'          // Slate 400
};

export function getCategoryColor(category, index = 0) {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const fallbackPalette = [
    '#0d9488', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#db2777', '#4f46e5'
  ];
  return fallbackPalette[index % fallbackPalette.length];
}

/**
 * Generates realistic demo transactions relative to TODAY's date
 * so "Today", "This Week", "This Month", and "Last Month" filters & AI queries always have live data.
 */
export function generateStudentDemoData() {
  const now = new Date();
  const fmtDate = (daysAgo) => {
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // Helper for last month dates
  const fmtLastMonth = (dayOfMonth) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth);
    return d.toISOString().split('T')[0];
  };

  const transactions = [
    // TODAY
    {
      id: 'demo-1',
      type: 'expense',
      amount: 240,
      category: 'Food',
      classification: 'need',
      description: 'Campus Canteen Lunch & Coffee',
      notes: 'Had lunch after lab session',
      date: fmtDate(0)
    },
    {
      id: 'demo-2',
      type: 'expense',
      amount: 85,
      category: 'Transport',
      classification: 'need',
      description: 'Metro Card Recharge / Auto',
      notes: 'Daily commute',
      date: fmtDate(0)
    },

    // THIS WEEK / THIS MONTH
    {
      id: 'demo-3',
      type: 'income',
      amount: 12000,
      category: 'Stipend',
      classification: 'income',
      description: 'Monthly Research Internship Stipend',
      notes: 'Credited to virtual account',
      date: fmtDate(2)
    },
    {
      id: 'demo-4',
      type: 'income',
      amount: 6000,
      category: 'Pocket Money',
      classification: 'income',
      description: 'Monthly Allowance from Home',
      notes: 'October allowance',
      date: fmtDate(4)
    },
    {
      id: 'demo-5',
      type: 'expense',
      amount: 5500,
      category: 'Hostel',
      classification: 'need',
      description: 'Hostel & Mess Monthly Fee',
      notes: 'Mandatory semester accommodation',
      date: fmtDate(3)
    },
    {
      id: 'demo-6',
      type: 'expense',
      amount: 1450,
      category: 'Food',
      classification: 'want',
      description: 'Weekend Dinner with Friends at Pizzeria',
      notes: 'Birthday celebration treat',
      date: fmtDate(2)
    },
    {
      id: 'demo-7',
      type: 'expense',
      amount: 890,
      category: 'Groceries',
      classification: 'need',
      description: 'Supermarket Oats, Milk, Fruits & Snacks',
      notes: 'Healthy hostel room supplies',
      date: fmtDate(3)
    },
    {
      id: 'demo-8',
      type: 'expense',
      amount: 1200,
      category: 'Education',
      classification: 'need',
      description: 'Cloud Computing Course & Lab Textbook',
      notes: 'Academic project reference',
      date: fmtDate(5)
    },
    {
      id: 'demo-9',
      type: 'expense',
      amount: 649,
      category: 'Subscriptions',
      classification: 'want',
      description: 'Netflix & Spotify Student Plan',
      notes: 'Monthly recurring entertainment',
      date: fmtDate(5)
    },
    {
      id: 'demo-10',
      type: 'expense',
      amount: 1850,
      category: 'Shopping',
      classification: 'want',
      description: 'Wireless Earbuds & Hoodie',
      notes: 'Online festival sale purchase',
      date: fmtDate(6)
    },
    {
      id: 'demo-11',
      type: 'income',
      amount: 450,
      category: 'Refunds',
      classification: 'income',
      description: 'Returned Damaged Lab Coat Refund',
      notes: 'Store refund processed',
      date: fmtDate(1)
    },
    {
      id: 'demo-12',
      type: 'expense',
      amount: 950,
      category: 'Entertainment',
      classification: 'want',
      description: 'IMAX Movie Tickets & Popcorn',
      notes: 'Sci-fi premiere night',
      date: fmtDate(4)
    },
    {
      id: 'demo-13',
      type: 'expense',
      amount: 420,
      category: 'Health',
      classification: 'need',
      description: 'Pharmacy Vitamins & First Aid',
      notes: 'Seasonal flu prevention',
      date: fmtDate(6)
    },
    {
      id: 'demo-14',
      type: 'expense',
      amount: 599,
      category: 'Bills',
      classification: 'need',
      description: '5G Mobile Data & Fiber Recharge',
      notes: 'Monthly telecom bill',
      date: fmtDate(7)
    },

    // LAST MONTH (For Month-over-Month Chart & AI Comparison)
    {
      id: 'demo-15',
      type: 'income',
      amount: 12000,
      category: 'Stipend',
      classification: 'income',
      description: 'Previous Month Internship Stipend',
      notes: '',
      date: fmtLastMonth(3)
    },
    {
      id: 'demo-16',
      type: 'income',
      amount: 5000,
      category: 'Pocket Money',
      classification: 'income',
      description: 'Previous Month Allowance',
      notes: '',
      date: fmtLastMonth(5)
    },
    {
      id: 'demo-17',
      type: 'expense',
      amount: 5500,
      category: 'Hostel',
      classification: 'need',
      description: 'Previous Month Hostel & Mess Fee',
      notes: '',
      date: fmtLastMonth(4)
    },
    {
      id: 'demo-18',
      type: 'expense',
      amount: 2100,
      category: 'Food',
      classification: 'need',
      description: 'Previous Month Food & Dining',
      notes: '',
      date: fmtLastMonth(12)
    },
    {
      id: 'demo-19',
      type: 'expense',
      amount: 1300,
      category: 'Transport',
      classification: 'need',
      description: 'Train Ticket Home & Local Transit',
      notes: '',
      date: fmtLastMonth(18)
    },
    {
      id: 'demo-20',
      type: 'expense',
      amount: 2400,
      category: 'Shopping',
      classification: 'want',
      description: 'Sneakers & Casual Wear',
      notes: '',
      date: fmtLastMonth(22)
    }
  ];

  const budgets = [
    { id: 'b-1', category: 'Overall', limit: 15000 },
    { id: 'b-2', category: 'Food', limit: 2000 },
    { id: 'b-3', category: 'Shopping', limit: 2000 },
    { id: 'b-4', category: 'Entertainment', limit: 1000 },
    { id: 'b-5', category: 'Subscriptions', limit: 800 }
  ];

  const savingsGoals = [
    {
      id: 'sg-1',
      name: 'Emergency Medical & Exam Fund',
      targetAmount: 10000,
      savedAmount: 6500,
      deadline: '2026-12-31'
    },
    {
      id: 'sg-2',
      name: 'New External Monitor for Coding',
      targetAmount: 12000,
      savedAmount: 4200,
      deadline: '2027-02-15'
    }
  ];

  return {
    openingBalance: 8500,
    transactions,
    budgets,
    savingsGoals
  };
}
