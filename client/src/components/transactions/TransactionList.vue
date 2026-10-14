<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
    <!-- Top Header & Add Button -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <h3 class="text-base font-bold text-navy-900">Transaction Ledger</h3>
        <p class="text-xs text-slate-500">
          Showing {{ displayedTransactions.length }} of {{ transactions.length }} records in period
        </p>
      </div>

      <button
        @click="$emit('add-transaction')"
        class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
      >
        <AppIcon name="plus" :size="16" />
        Add Transaction
      </button>
    </div>

    <!-- Search & Filter Controls Bar -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
      <!-- Search input -->
      <div class="relative lg:col-span-2">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <AppIcon name="search" :size="14" />
        </span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search description, category, or notes..."
          class="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <!-- Type Filter -->
      <select
        v-model="typeFilter"
        class="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
      >
        <option value="all">All Types (Income & Expense)</option>
        <option value="expense">Expenses Only</option>
        <option value="income">Income & Refunds Only</option>
      </select>

      <!-- Category Filter -->
      <select
        v-model="categoryFilter"
        class="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
      >
        <option value="all">All Categories</option>
        <option v-for="cat in availableCategories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>

      <!-- Need/Want & Sort Filter -->
      <select
        v-model="classFilter"
        class="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
      >
        <option value="all">All Classifications</option>
        <option value="need">Needs Only</option>
        <option value="want">Wants Only</option>
        <option value="unclassified">Unclassified Only</option>
      </select>
    </div>

    <!-- Empty State -->
    <div
      v-if="displayedTransactions.length === 0"
      class="py-12 text-center border border-dashed border-slate-200 rounded-xl"
    >
      <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
        <AppIcon name="wallet" :size="22" />
      </div>
      <p class="text-sm font-semibold text-slate-700">No matching transactions found</p>
      <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
        Try clearing your search filters, selecting a broader date period, or recording a new transaction.
      </p>
      <button
        v-if="hasActiveSubFilters"
        @click="resetSubFilters"
        class="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
      >
        Clear Filters
      </button>
    </div>

    <!-- Transactions Table / List -->
    <div v-else class="divide-y divide-slate-100">
      <div
        v-for="tx in displayedTransactions"
        :key="tx.id"
        class="py-3.5 px-2 hover:bg-slate-50/80 rounded-xl transition flex items-center justify-between gap-3"
      >
        <!-- Left: Icon + Details -->
        <div class="flex items-center gap-3.5 min-w-0">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            :class="
              tx.type === 'income'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-slate-100 text-navy-800 border border-slate-200'
            "
          >
            <AppIcon :name="tx.type === 'income' ? 'trending-up' : tx.category" :size="18" />
          </div>

          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-slate-900 truncate">
                {{ tx.description }}
              </span>
              <span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                {{ tx.category }}
              </span>
              <!-- Need / Want Badge for Expenses -->
              <span
                v-if="tx.type === 'expense'"
                class="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide"
                :class="
                  tx.classification === 'need'
                    ? 'bg-navy-900/10 text-navy-900'
                    : tx.classification === 'want'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-600'
                "
              >
                {{ tx.classification || 'unclassified' }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{{ formatDate(tx.date) }}</span>
              <span v-if="tx.notes" class="truncate max-w-xs text-slate-500">
                • {{ tx.notes }}
              </span>
            </div>
          </div>
        </div>

        <!-- Right: Amount & Actions -->
        <div class="flex items-center gap-3 shrink-0">
          <div
            class="text-sm sm:text-base font-bold text-right"
            :class="tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'"
          >
            {{ tx.type === 'income' ? '+' : '-' }}{{ formatINR(tx.amount) }}
          </div>

          <div class="flex items-center gap-1">
            <button
              @click="$emit('edit-transaction', tx)"
              class="p-1.5 rounded-lg text-slate-400 hover:text-navy-900 hover:bg-slate-200/60 transition"
              title="Edit transaction"
            >
              <AppIcon name="edit" :size="15" />
            </button>
            <button
              @click="$emit('delete-transaction', tx.id)"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Delete transaction"
            >
              <AppIcon name="trash" :size="15" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { formatINR, formatDate } from '../../utils/formatters.js';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  transactions: {
    type: Array,
    default: () => []
  },
  limit: {
    type: Number,
    default: 0
  }
});

defineEmits(['add-transaction', 'edit-transaction', 'delete-transaction']);

const searchQuery = ref('');
const typeFilter = ref('all');
const categoryFilter = ref('all');
const classFilter = ref('all');

const availableCategories = computed(() => {
  const set = new Set(props.transactions.map(t => t.category).filter(Boolean));
  return [...set].sort();
});

const hasActiveSubFilters = computed(() => {
  return (
    searchQuery.value.trim() !== '' ||
    typeFilter.value !== 'all' ||
    categoryFilter.value !== 'all' ||
    classFilter.value !== 'all'
  );
});

function resetSubFilters() {
  searchQuery.value = '';
  typeFilter.value = 'all';
  categoryFilter.value = 'all';
  classFilter.value = 'all';
}

const displayedTransactions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();

  const filtered = props.transactions.filter(tx => {
    if (typeFilter.value !== 'all' && tx.type !== typeFilter.value) return false;
    if (categoryFilter.value !== 'all' && tx.category !== categoryFilter.value) return false;
    if (classFilter.value !== 'all' && tx.classification !== classFilter.value) return false;

    if (q) {
      const hay = `${tx.description} ${tx.category} ${tx.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Sort newest date first
  const sorted = [...filtered].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return 0;
  });

  return props.limit > 0 ? sorted.slice(0, props.limit) : sorted;
});
</script>
