<template>
  <div class="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
    <!-- Left Sidebar (Navy Fintech Base) -->
    <aside class="bg-navy-900 text-white lg:w-64 shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-navy-800">
      <div>
        <!-- Brand Header -->
        <div class="px-5 py-5 flex items-center justify-between border-b border-white/10">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-navy-950 font-bold shadow-sm">
              <AppIcon name="wallet" :size="20" />
            </div>
            <div>
              <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                SpendWise <span class="text-emerald-400">AI</span>
              </h1>
              <p class="text-[11px] text-slate-400">Personal Finance Simulator</p>
            </div>
          </div>

          <!-- Mobile menu toggle -->
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
          >
            <AppIcon :name="mobileMenuOpen ? 'close' : 'filter'" :size="20" />
          </button>
        </div>

        <!-- Navigation Links -->
        <nav
          class="px-3 py-4 space-y-1.5"
          :class="mobileMenuOpen ? 'block' : 'hidden lg:block'"
        >
          <button
            v-for="tab in navTabs"
            :key="tab.id"
            @click="selectTab(tab.id)"
            class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
            :class="
              activeTab === tab.id
                ? 'bg-emerald-500 text-navy-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            "
          >
            <div class="flex items-center gap-3">
              <AppIcon :name="tab.icon" :size="18" />
              <span>{{ tab.label }}</span>
            </div>
            <span
              v-if="tab.badge"
              class="px-2 py-0.5 rounded-full text-[10px] font-bold"
              :class="activeTab === tab.id ? 'bg-navy-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-300'"
            >
              {{ tab.badge }}
            </span>
          </button>

          <!-- Quick Add Transaction CTA in Sidebar -->
          <div class="pt-3 mt-3 border-t border-white/10">
            <button
              @click="openAddTransactionModal"
              class="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <AppIcon name="plus" :size="16" />
              New Transaction
            </button>
          </div>
        </nav>
      </div>

      <!-- Bottom User Profile & Session Controls -->
      <div
        class="p-4 border-t border-white/10 space-y-3"
        :class="mobileMenuOpen ? 'block' : 'hidden lg:block'"
      >
        <div class="p-3 rounded-xl bg-navy-800/90 border border-white/10">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                {{ userInitials }}
              </div>
              <div class="min-w-0">
                <p class="text-xs font-semibold text-white truncate">
                  {{ authStore.user?.displayName || 'User' }}
                </p>
                <p class="text-[10px] text-emerald-400 font-mono truncate flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Cloud Firestore Sync
                </p>
              </div>
            </div>
            <button
              @click="handleLogout"
              class="text-[11px] text-slate-300 hover:text-rose-400 shrink-0 ml-1 flex items-center gap-1 cursor-pointer transition"
              title="Sign Out of SpendWise AI"
            >
              <span>Logout</span>
            </button>
          </div>

          <p class="text-[10px] text-slate-400 mt-2 truncate font-mono">
            {{ authStore.user?.email }}
          </p>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span class="flex items-center gap-1">
            <AppIcon name="shield" :size="13" class="text-emerald-400" />
            Isolated Cloud DB
          </span>
          <button
            @click="triggerAlertSettingsModal"
            class="hover:text-white underline cursor-pointer"
          >
            Alerts Info
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top Bar -->
      <header class="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
        <div>
          <h2 class="text-base sm:text-lg font-bold text-navy-900">
            {{ currentTabTitle }}
          </h2>
          <p class="text-xs text-slate-500 hidden sm:block">
            {{ currentTabSubtitle }}
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <!-- OpenAI / Gemini AI Advisor Drawer Button -->
          <button
            v-if="activeTab !== 'advisor'"
            @click="chatDrawerOpen = !chatDrawerOpen"
            class="px-3.5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <AppIcon name="bot" :size="16" class="text-emerald-400" />
            <span>Ask SpendWise AI</span>
          </button>

          <!-- Add Transaction Button -->
          <button
            @click="openAddTransactionModal"
            class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <AppIcon name="plus" :size="16" />
            <span class="hidden sm:inline">Add Transaction</span>
          </button>
        </div>
      </header>

      <!-- Workspace Body -->
      <main class="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
        <!-- Global Date Range Filter Bar -->
        <DateFilterBar
          v-model="financeStore.dateFilter"
          v-model:customStart="financeStore.customStartDate"
          v-model:customEnd="financeStore.customEndDate"
          :is-demo-active="financeStore.isDemoActive"
          :has-backup="financeStore.hasBackup"
          @restore-real="financeStore.restoreRealUserData()"
        />

        <!-- Budget Threshold Alerts Banner -->
        <BudgetAlertsBanner
          :alerts="financeStore.stats.activeAlerts"
          :open-modal-signal="alertModalSignal"
        />

        <!-- TAB 1: OVERVIEW DASHBOARD -->
        <template v-if="activeTab === 'dashboard'">
          <!-- 4 Key Balance & Summary Cards -->
          <BalanceCards
            :stats="financeStore.stats"
            @update-opening-balance="financeStore.updateOpeningBalance"
          />

          <!-- Charts Row 1: Category Donut & Monthly Income vs Expense Bar -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div class="lg:col-span-6">
              <CategoryDonutChart :breakdown="financeStore.stats.categoryBreakdown" />
            </div>
            <div class="lg:col-span-6">
              <MonthlyBarChart :series="financeStore.monthlyChartSeries" />
            </div>
          </div>

          <!-- Charts Row 2: 14-Day Spending Velocity Line & Budgets & Goals -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div class="lg:col-span-5">
              <SpendingTrendChart :series="financeStore.spendingTrendSeries" />
            </div>
            <div class="lg:col-span-4">
              <BudgetsWidget
                :budgets="financeStore.stats.budgetEvaluations"
                :expense-categories="financeStore.expenseCategories"
                @save-budget="financeStore.saveBudget"
                @delete-budget="financeStore.deleteBudget"
              />
            </div>
            <div class="lg:col-span-3">
              <SavingsGoalsWidget
                :goals="financeStore.savingsGoals"
                @save-goal="financeStore.saveSavingsGoal"
                @delete-goal="financeStore.deleteSavingsGoal"
              />
            </div>
          </div>

          <!-- Recent Transactions (Top 8 with link to full ledger) -->
          <TransactionList
            :transactions="financeStore.dateFilteredTransactions"
            :limit="8"
            @add-transaction="openAddTransactionModal"
            @edit-transaction="openEditTransactionModal"
            @delete-transaction="handleDeleteTransaction"
          />
        </template>

        <!-- TAB 2: FULL TRANSACTIONS LEDGER -->
        <template v-else-if="activeTab === 'transactions'">
          <BalanceCards
            :stats="financeStore.stats"
            @update-opening-balance="financeStore.updateOpeningBalance"
          />

          <TransactionList
            :transactions="financeStore.dateFilteredTransactions"
            @add-transaction="openAddTransactionModal"
            @edit-transaction="openEditTransactionModal"
            @delete-transaction="handleDeleteTransaction"
          />
        </template>

        <!-- TAB 3: BUDGETS, NEEDS VS WANTS & SAVINGS GOALS -->
        <template v-else-if="activeTab === 'budgets'">
          <!-- 50/30/20 Needs vs Wants Evaluation Card -->
          <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 class="text-base font-bold text-navy-900">50 / 30 / 20 Needs vs Wants Diagnostic</h3>
                <p class="text-xs text-slate-500">
                  Compares your actual expense classifications against the benchmark 50% Needs, 30% Wants, 20% Savings framework
                </p>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-semibold bg-navy-900 text-emerald-400 self-start">
                Savings Rate: {{ financeStore.stats.savingsRate }}%
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Essential Needs (Target ≤ 50%)</span>
                  <span class="text-navy-900 font-bold">{{ financeStore.stats.needsVsWants.needs.percentage }}%</span>
                </div>
                <div class="text-lg font-bold text-navy-900 mb-2">
                  {{ formatINR(financeStore.stats.needsVsWants.needs.amount) }}
                </div>
                <p class="text-[11px] text-slate-500">
                  Includes Hostel, Groceries, Food essentials, Education, Transport, Bills, Health.
                </p>
              </div>

              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Discretionary Wants (Target ≤ 30%)</span>
                  <span
                    class="font-bold"
                    :class="financeStore.stats.needsVsWants.wants.percentage > 30 ? 'text-amber-600' : 'text-emerald-600'"
                  >
                    {{ financeStore.stats.needsVsWants.wants.percentage }}%
                  </span>
                </div>
                <div class="text-lg font-bold text-navy-900 mb-2">
                  {{ formatINR(financeStore.stats.needsVsWants.wants.amount) }}
                </div>
                <p class="text-[11px] text-slate-500">
                  Includes Shopping, Entertainment, Subscriptions, Dining out, Leisure travel.
                </p>
              </div>

              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>Unclassified Expenses</span>
                  <span class="text-slate-700 font-bold">{{ financeStore.stats.needsVsWants.unclassified.percentage }}%</span>
                </div>
                <div class="text-lg font-bold text-navy-900 mb-2">
                  {{ formatINR(financeStore.stats.needsVsWants.unclassified.amount) }}
                </div>
                <p class="text-[11px] text-slate-500">
                  Edit any unclassified transaction in the ledger to assign it as Need or Want.
                </p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <BudgetsWidget
              :budgets="financeStore.stats.budgetEvaluations"
              :expense-categories="financeStore.expenseCategories"
              @save-budget="financeStore.saveBudget"
              @delete-budget="financeStore.deleteBudget"
            />
            <SavingsGoalsWidget
              :goals="financeStore.savingsGoals"
              @save-goal="financeStore.saveSavingsGoal"
              @delete-goal="financeStore.deleteSavingsGoal"
            />
          </div>
        </template>

        <!-- TAB 4: DEDICATED AI FINANCIAL ADVISOR -->
        <template v-else-if="activeTab === 'advisor'">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div class="lg:col-span-8 h-[620px]">
              <ChatPanel :closable="false" />
            </div>

            <!-- Side Grounding Inspector Card -->
            <div class="lg:col-span-4 space-y-4">
              <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                <h3 class="text-sm font-bold text-navy-900 flex items-center gap-2">
                  <AppIcon name="shield" :size="16" class="text-emerald-600" />
                  Grounded AI Verification
                </h3>
                <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                  SpendWise AI never guesses or invents numbers. Every question evaluates your verified account figures:
                </p>

                <div class="mt-3 space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Opening Balance:</span>
                    <strong class="text-slate-900">{{ formatINR(financeStore.stats.openingBalance) }}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Current Balance:</span>
                    <strong class="text-emerald-700">{{ formatINR(financeStore.stats.currentBalance) }}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Total Income:</span>
                    <strong class="text-slate-900">{{ formatINR(financeStore.stats.globalIncome) }}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Total Expenses:</span>
                    <strong class="text-slate-900">{{ formatINR(financeStore.stats.globalExpenses) }}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Spent Today:</span>
                    <strong class="text-slate-900">{{ formatINR(financeStore.stats.todaySpend) }}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Needs / Wants:</span>
                    <strong class="text-slate-900">
                      {{ financeStore.stats.needsVsWants.needs.percentage }}% / {{ financeStore.stats.needsVsWants.wants.percentage }}%
                    </strong>
                  </div>
                </div>
              </div>

              <div class="bg-navy-900 text-white rounded-2xl p-5 shadow-sm">
                <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Sample Report Queries
                </h4>
                <p class="text-xs text-slate-300 mt-1">
                  Click any benchmark prompt to test the AI advisor:
                </p>
                <div class="mt-3 space-y-2">
                  <button
                    v-for="q in chatStore.suggestedPrompts"
                    :key="q"
                    @click="chatStore.askQuestion(q)"
                    class="w-full text-left px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white transition flex items-center justify-between cursor-pointer"
                  >
                    <span>"{{ q }}"</span>
                    <AppIcon name="send" :size="12" class="text-emerald-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <!-- Slide-Over AI Chat Drawer (When on Dashboard/Transactions/Budgets tabs) -->
    <div
      v-if="chatDrawerOpen && activeTab !== 'advisor'"
      class="fixed inset-0 bg-navy-950/40 backdrop-blur-2xs z-40 flex justify-end"
      @click.self="chatDrawerOpen = false"
    >
      <div class="w-full max-w-md bg-white h-full shadow-2xl p-2 sm:p-3 flex flex-col">
        <ChatPanel :closable="true" @close="chatDrawerOpen = false" />
      </div>
    </div>

    <!-- Add / Edit Transaction Modal -->
    <TransactionModal
      :is-open="txModalOpen"
      :edit-item="editingTransaction"
      :income-categories="financeStore.incomeCategories"
      :expense-categories="financeStore.expenseCategories"
      @close="txModalOpen = false"
      @save="handleSaveTransaction"
      @add-custom-category="handleAddCustomCategory"
    />

    <!-- Local Data Migration Modal -->
    <DataMigrationModal
      :is-open="showMigrationModal"
      :local-data="detectedLocalData"
      :user-email="authStore.user?.email || ''"
      @dismiss="handleMigrationDismiss"
      @migrated="handleMigrationSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore.js';
import { useFinanceStore } from '../stores/financeStore.js';
import { useChatStore } from '../stores/chatStore.js';
import { getLocalUserData } from '../services/storageService.js';
import { formatINR } from '../utils/formatters.js';

import AppIcon from '../components/common/AppIcon.vue';
import BalanceCards from '../components/dashboard/BalanceCards.vue';
import DateFilterBar from '../components/dashboard/DateFilterBar.vue';
import CategoryDonutChart from '../components/dashboard/CategoryDonutChart.vue';
import MonthlyBarChart from '../components/dashboard/MonthlyBarChart.vue';
import SpendingTrendChart from '../components/dashboard/SpendingTrendChart.vue';
import BudgetsWidget from '../components/dashboard/BudgetsWidget.vue';
import SavingsGoalsWidget from '../components/dashboard/SavingsGoalsWidget.vue';
import BudgetAlertsBanner from '../components/alerts/BudgetAlertsBanner.vue';
import TransactionList from '../components/transactions/TransactionList.vue';
import TransactionModal from '../components/transactions/TransactionModal.vue';
import ChatPanel from '../components/chat/ChatPanel.vue';
import DataMigrationModal from '../components/auth/DataMigrationModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const financeStore = useFinanceStore();
const chatStore = useChatStore();

const activeTab = ref('dashboard');
const mobileMenuOpen = ref(false);
const chatDrawerOpen = ref(false);
const txModalOpen = ref(false);
const editingTransaction = ref(null);
const alertModalSignal = ref(0);

const showMigrationModal = ref(false);
const detectedLocalData = ref(null);

const navTabs = computed(() => [
  { id: 'dashboard', label: 'Dashboard Overview', icon: 'chart' },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: 'wallet',
    badge: financeStore.transactions.length || null
  },
  {
    id: 'budgets',
    label: 'Budgets & Goals',
    icon: 'target',
    badge: financeStore.stats.activeAlerts.length > 0 ? `${financeStore.stats.activeAlerts.length}!` : null
  },
  { id: 'advisor', label: 'AI Financial Advisor', icon: 'bot', badge: 'AI' }
]);

const currentTabTitle = computed(() => {
  const map = {
    dashboard: 'Financial Overview Dashboard',
    transactions: 'Virtual Account Transactions',
    budgets: 'Budgets, Needs vs Wants & Savings Goals',
    advisor: 'SpendWise AI — Grounded Financial Advisor'
  };
  return map[activeTab.value] || 'SpendWise AI';
});

const currentTabSubtitle = computed(() => {
  const map = {
    dashboard: 'Real-time simulated account balance, cashflow analytics, and spending velocity',
    transactions: 'Add, edit, filter, and classify your income, expenses, and refunds',
    budgets: 'Monitor monthly category thresholds and 50/30/20 Needs vs Wants ratios',
    advisor: 'Ask personalized questions powered by GroqCloud and deterministic math'
  };
  return map[activeTab.value] || '';
});

const userInitials = computed(() => {
  const name = authStore.user?.displayName || 'User';
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
});

function selectTab(tabId) {
  activeTab.value = tabId;
  mobileMenuOpen.value = false;
  if (tabId === 'advisor') {
    chatDrawerOpen.value = false;
  }
}

function openAddTransactionModal() {
  editingTransaction.value = null;
  txModalOpen.value = true;
}

function openEditTransactionModal(tx) {
  editingTransaction.value = tx;
  txModalOpen.value = true;
}

async function handleSaveTransaction(txData) {
  if (txData.id) {
    await financeStore.updateTransaction(txData.id, txData);
  } else {
    await financeStore.addTransaction(txData);
  }
}

async function handleDeleteTransaction(id) {
  await financeStore.deleteTransaction(id);
}

async function handleAddCustomCategory({ type, name }) {
  await financeStore.addCustomCategory(type, name);
}

function triggerAlertSettingsModal() {
  alertModalSignal.value += 1;
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

function handleMigrationSuccess() {
  try {
    localStorage.removeItem('spendwise_user_data_guest_local');
    localStorage.setItem('spendwise_guest_migrated', 'true');
  } catch {}
  showMigrationModal.value = false;
}

function handleMigrationDismiss() {
  try {
    localStorage.removeItem('spendwise_user_data_guest_local');
    localStorage.setItem('spendwise_guest_migrated', 'true');
  } catch {}
  showMigrationModal.value = false;
}

onMounted(async () => {
  if (authStore.user?.uid) {
    await financeStore.initFinanceData(authStore.user.uid, true);

    // Only prompt migration if guestData has REAL user transactions (never demo dataset)
    // and user has not already migrated or dismissed it
    const alreadyMigrated = localStorage.getItem('spendwise_guest_migrated') === 'true';
    if (!alreadyMigrated) {
      const guestData = getLocalUserData('guest_local');
      if (
        guestData &&
        !guestData.isDemoActive &&
        Array.isArray(guestData.transactions) &&
        guestData.transactions.length > 0 &&
        financeStore.transactions.length === 0
      ) {
        detectedLocalData.value = guestData;
        showMigrationModal.value = true;
      }
    }
  }
});
</script>
