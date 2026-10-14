<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-navy-900">Monthly Budgets & Thresholds</h3>
        <p class="text-xs text-slate-500">Current calendar month usage vs limits</p>
      </div>
      <button
        @click="showAddForm = !showAddForm"
        class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1"
      >
        <AppIcon :name="showAddForm ? 'close' : 'plus'" :size="14" />
        {{ showAddForm ? 'Cancel' : 'Set Limit' }}
      </button>
    </div>

    <!-- Inline Add / Update Budget Form -->
    <form
      v-if="showAddForm"
      @submit.prevent="handleSaveBudget"
      class="mb-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
    >
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
          <select
            v-model="selectedCategory"
            class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          >
            <option value="Overall">Overall Monthly Total</option>
            <option v-for="cat in expenseCategories" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Monthly Limit (₹)</label>
          <input
            v-model.number="limitInput"
            type="number"
            min="100"
            step="100"
            placeholder="e.g. 3000"
            required
            class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <span v-if="formError" class="text-xs text-rose-600">{{ formError }}</span>
        <span v-else class="text-[11px] text-slate-400">Alerts trigger at 80% and 100%</span>
        <button
          type="submit"
          class="px-3.5 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold transition"
        >
          Save Budget
        </button>
      </div>
    </form>

    <!-- Budget List -->
    <div v-if="budgets.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
      <p class="text-sm font-medium text-slate-600">No monthly budgets configured</p>
      <p class="text-xs text-slate-400 mt-1">Click "Set Limit" to track category spending caps.</p>
    </div>

    <div v-else class="space-y-3.5 flex-1 overflow-y-auto pr-1 max-h-72">
      <div
        v-for="b in budgets"
        :key="b.id || b.category"
        class="p-3 rounded-xl border transition"
        :class="
          b.status === 'exceeded'
            ? 'bg-rose-50/40 border-rose-200'
            : b.status === 'warning'
            ? 'bg-amber-50/40 border-amber-200'
            : 'bg-slate-50/60 border-slate-200/80'
        "
      >
        <div class="flex items-center justify-between text-xs mb-1.5">
          <div class="flex items-center gap-2">
            <span class="font-bold text-navy-900">{{ b.category }}</span>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
              :class="
                b.status === 'exceeded'
                  ? 'bg-rose-100 text-rose-700'
                  : b.status === 'warning'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              "
            >
              {{ b.percentage }}%
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-slate-600">
              <strong class="text-slate-900">{{ formatINR(b.spent) }}</strong> / {{ formatINR(b.limit) }}
            </span>
            <button
              @click="$emit('delete-budget', b.id)"
              class="text-slate-400 hover:text-rose-600 transition"
              title="Remove budget limit"
            >
              <AppIcon name="trash" :size="13" />
            </button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            class="h-full transition-all duration-300 rounded-full"
            :class="
              b.status === 'exceeded'
                ? 'bg-rose-500'
                : b.status === 'warning'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            "
            :style="{ width: `${Math.min(100, b.percentage)}%` }"
          ></div>
        </div>

        <div class="flex justify-between text-[11px] mt-1.5">
          <span v-if="b.status === 'exceeded'" class="text-rose-600 font-medium">
            Exceeded by {{ formatINR(b.overAmount) }}
          </span>
          <span v-else class="text-slate-500">
            Remaining: {{ formatINR(b.remaining) }}
          </span>
          <button
            @click="prefillEdit(b)"
            class="text-slate-500 hover:text-navy-900 underline"
          >
            Adjust
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { formatINR } from '../../utils/formatters.js';
import AppIcon from '../common/AppIcon.vue';

defineProps({
  budgets: {
    type: Array,
    default: () => []
  },
  expenseCategories: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['save-budget', 'delete-budget']);

const showAddForm = ref(false);
const selectedCategory = ref('Food');
const limitInput = ref(2500);
const formError = ref('');

function prefillEdit(budgetItem) {
  selectedCategory.value = budgetItem.category;
  limitInput.value = budgetItem.limit;
  formError.value = '';
  showAddForm.value = true;
}

function handleSaveBudget() {
  formError.value = '';
  if (!limitInput.value || Number(limitInput.value) <= 0) {
    formError.value = 'Please enter a valid positive limit.';
    return;
  }
  emit('save-budget', {
    category: selectedCategory.value,
    limit: Number(limitInput.value)
  });
  showAddForm.value = false;
}
</script>
