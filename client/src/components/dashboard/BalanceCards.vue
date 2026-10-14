<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
    <!-- Card 1: Virtual Account Current Balance (Navy Primary Card) -->
    <div class="bg-navy-900 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs uppercase tracking-wider text-slate-300 font-medium">Available Balance</span>
          <div class="text-2xl sm:text-3xl font-bold mt-1 tracking-tight text-white">
            {{ formatINR(stats.currentBalance) }}
          </div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
          <AppIcon name="wallet" :size="20" />
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <div class="text-slate-300">
          Opening: <span class="font-semibold text-white">{{ formatINR(stats.openingBalance) }}</span>
        </div>
        <button
          @click="openEditBalance"
          class="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
          title="Set virtual account opening balance"
        >
          <AppIcon name="edit" :size="13" /> Set Opening
        </button>
      </div>

      <!-- Inline Edit Opening Balance Overlay -->
      <div
        v-if="isEditingOpening"
        class="absolute inset-0 bg-navy-950/95 p-4 flex flex-col justify-center z-10"
      >
        <label class="text-xs font-medium text-slate-300 mb-1.5">Set Opening Balance (₹)</label>
        <div class="flex items-center gap-2">
          <input
            v-model.number="tempOpening"
            type="number"
            min="0"
            step="100"
            class="w-full bg-navy-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-400"
            @keyup.enter="saveOpening"
          />
          <button
            @click="saveOpening"
            class="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded-lg shrink-0"
          >
            Save
          </button>
          <button
            @click="isEditingOpening = false"
            class="text-slate-400 hover:text-white text-xs px-1.5"
          >
            ✕
          </button>
        </div>
        <p v-if="balanceError" class="text-red-400 text-[11px] mt-1">{{ balanceError }}</p>
      </div>
    </div>

    <!-- Card 2: Total Income -->
    <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs uppercase tracking-wider text-slate-500 font-medium">Total Income</span>
          <div class="text-2xl font-bold text-slate-900 mt-1">
            {{ formatINR(stats.periodIncome) }}
          </div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
          <AppIcon name="trending-up" :size="20" />
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Savings Rate:</span>
        <span
          class="font-semibold px-2 py-0.5 rounded-full"
          :class="stats.savingsRate >= 20 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
        >
          {{ stats.savingsRate }}%
        </span>
      </div>
    </div>

    <!-- Card 3: Total Expenses & Daily/Weekly Summary -->
    <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs uppercase tracking-wider text-slate-500 font-medium">Total Expenses</span>
          <div class="text-2xl font-bold text-slate-900 mt-1">
            {{ formatINR(stats.periodExpenses) }}
          </div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
          <AppIcon name="trending-down" :size="20" />
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Today: <strong class="text-slate-800">{{ formatINR(stats.todaySpend) }}</strong></span>
        <span>7-Day: <strong class="text-slate-800">{{ formatINR(stats.weekSpend) }}</strong></span>
      </div>
    </div>

    <!-- Card 4: Needs vs Wants Breakdown -->
    <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs uppercase tracking-wider text-slate-500 font-medium">Needs vs Wants</span>
          <div class="flex items-baseline gap-2 mt-1">
            <span class="text-lg font-bold text-navy-900">
              {{ stats.needsVsWants.needs.percentage }}% Needs
            </span>
            <span class="text-xs text-slate-400">/</span>
            <span class="text-sm font-semibold text-amber-600">
              {{ stats.needsVsWants.wants.percentage }}% Wants
            </span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
          <AppIcon name="piggy-bank" :size="20" />
        </div>
      </div>

      <!-- Stacked Multi-Progress Bar -->
      <div class="mt-3">
        <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            class="bg-navy-800 h-full transition-all duration-300"
            :style="{ width: `${stats.needsVsWants.needs.percentage}%` }"
            title="Needs"
          ></div>
          <div
            class="bg-amber-500 h-full transition-all duration-300"
            :style="{ width: `${stats.needsVsWants.wants.percentage}%` }"
            title="Wants"
          ></div>
          <div
            class="bg-slate-300 h-full transition-all duration-300"
            :style="{ width: `${stats.needsVsWants.unclassified.percentage}%` }"
            title="Unclassified"
          ></div>
        </div>
        <div class="flex justify-between text-[11px] text-slate-500 mt-1.5">
          <span>Needs: {{ formatINR(stats.needsVsWants.needs.amount) }}</span>
          <span>Wants: {{ formatINR(stats.needsVsWants.wants.amount) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { formatINR } from '../../utils/formatters.js';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  stats: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update-opening-balance']);

const isEditingOpening = ref(false);
const tempOpening = ref(0);
const balanceError = ref('');

function openEditBalance() {
  tempOpening.value = props.stats.openingBalance;
  balanceError.value = '';
  isEditingOpening.value = true;
}

function saveOpening() {
  if (tempOpening.value === '' || isNaN(tempOpening.value) || Number(tempOpening.value) < 0) {
    balanceError.value = 'Enter a valid non-negative amount.';
    return;
  }
  emit('update-opening-balance', Number(tempOpening.value));
  isEditingOpening.value = false;
}
</script>
