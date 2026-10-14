<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 class="text-base font-bold text-navy-900">
            {{ editItem ? 'Edit Transaction' : 'Record New Transaction' }}
          </h3>
          <p class="text-xs text-slate-500">Virtual account ledger entry</p>
        </div>
        <button
          @click="$emit('close')"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="mt-4 space-y-4">
        <!-- Type Switcher (Expense vs Income) -->
        <div class="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            @click="switchType('expense')"
            class="py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
            :class="
              form.type === 'expense'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <AppIcon name="trending-down" :size="14" />
            Expense
          </button>
          <button
            type="button"
            @click="switchType('income')"
            class="py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
            :class="
              form.type === 'income'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            "
          >
            <AppIcon name="trending-up" :size="14" />
            Income / Refund
          </button>
        </div>

        <!-- Amount & Date -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
            <input
              v-model.number="form.amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
            <input
              v-model="form.date"
              type="date"
              required
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
          <input
            v-model="form.description"
            type="text"
            maxlength="100"
            placeholder="e.g. Campus Canteen Lunch, Monthly Stipend"
            required
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <!-- Category Selector + Custom Category Creator -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-semibold text-slate-700">Category *</label>
            <button
              type="button"
              @click="showCustomCatInput = !showCustomCatInput"
              class="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
            >
              {{ showCustomCatInput ? 'Select Existing' : '+ Add Custom Category' }}
            </button>
          </div>

          <div v-if="showCustomCatInput" class="flex gap-2">
            <input
              v-model="customCategoryName"
              type="text"
              placeholder="Enter custom category name"
              class="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              @click="createCustomCategory"
              class="px-3 py-2 rounded-xl bg-navy-900 text-white text-xs font-semibold"
            >
              Add
            </button>
          </div>

          <select
            v-else
            v-model="form.category"
            @change="handleCategoryChange"
            required
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
          >
            <option
              v-for="cat in activeCategoryList"
              :key="cat"
              :value="cat"
            >
              {{ cat }}
            </option>
          </select>
        </div>

        <!-- Needs vs Wants Classification (Only for Expenses) -->
        <div v-if="form.type === 'expense'">
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">
            Expense Classification (Needs vs Wants)
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              @click="form.classification = 'need'"
              class="py-2 px-2.5 rounded-xl border text-xs font-semibold transition text-center"
              :class="
                form.classification === 'need'
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              "
            >
              Need (Essential)
            </button>
            <button
              type="button"
              @click="form.classification = 'want'"
              class="py-2 px-2.5 rounded-xl border text-xs font-semibold transition text-center"
              :class="
                form.classification === 'want'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              "
            >
              Want (Lifestyle)
            </button>
            <button
              type="button"
              @click="form.classification = 'unclassified'"
              class="py-2 px-2.5 rounded-xl border text-xs font-semibold transition text-center"
              :class="
                form.classification === 'unclassified'
                  ? 'bg-slate-600 text-white border-slate-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              "
            >
              Unclassified
            </button>
          </div>
        </div>

        <!-- Optional Notes -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
          <textarea
            v-model="form.notes"
            rows="2"
            maxlength="200"
            placeholder="Optional payment details, merchant, or context..."
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
          ></textarea>
        </div>

        <!-- Validation Error -->
        <p v-if="errorMsg" class="text-xs font-medium text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
          {{ errorMsg }}
        </p>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition"
          >
            {{ isSubmitting ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Transaction') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { CATEGORY_DEFAULT_CLASSIFICATION } from '../../utils/categories.js';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  editItem: {
    type: Object,
    default: null
  },
  incomeCategories: {
    type: Array,
    default: () => []
  },
  expenseCategories: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'save', 'add-custom-category']);

const isSubmitting = ref(false);
const errorMsg = ref('');
const showCustomCatInput = ref(false);
const customCategoryName = ref('');

const todayDate = () => new Date().toISOString().split('T')[0];

const form = ref({
  type: 'expense',
  amount: '',
  date: todayDate(),
  description: '',
  category: 'Food',
  classification: 'need',
  notes: ''
});

const activeCategoryList = computed(() =>
  form.value.type === 'income' ? props.incomeCategories : props.expenseCategories
);

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    errorMsg.value = '';
    showCustomCatInput.value = false;
    isSubmitting.value = false;

    if (props.editItem) {
      form.value = {
        type: props.editItem.type || 'expense',
        amount: props.editItem.amount,
        date: props.editItem.date || todayDate(),
        description: props.editItem.description || '',
        category: props.editItem.category || 'Food',
        classification: props.editItem.classification || 'need',
        notes: props.editItem.notes || ''
      };
    } else {
      form.value = {
        type: 'expense',
        amount: '',
        date: todayDate(),
        description: '',
        category: props.expenseCategories[0] || 'Food',
        classification: 'need',
        notes: ''
      };
    }
  }
);

function switchType(newType) {
  form.value.type = newType;
  if (newType === 'income') {
    form.value.category = props.incomeCategories[0] || 'Stipend';
    form.value.classification = 'income';
  } else {
    form.value.category = props.expenseCategories[0] || 'Food';
    form.value.classification = CATEGORY_DEFAULT_CLASSIFICATION[form.value.category] || 'need';
  }
}

function handleCategoryChange() {
  if (form.value.type === 'expense') {
    const suggested = CATEGORY_DEFAULT_CLASSIFICATION[form.value.category];
    if (suggested) {
      form.value.classification = suggested;
    }
  }
}

function createCustomCategory() {
  const clean = customCategoryName.value.trim();
  if (!clean) return;
  emit('add-custom-category', { type: form.value.type, name: clean });
  form.value.category = clean;
  customCategoryName.value = '';
  showCustomCatInput.value = false;
}

async function handleSubmit() {
  if (isSubmitting.value) return;
  errorMsg.value = '';

  const numAmount = Number(form.value.amount);
  if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
    errorMsg.value = 'Please enter a valid amount greater than ₹0.';
    return;
  }
  if (!form.value.description.trim()) {
    errorMsg.value = 'Please provide a transaction description.';
    return;
  }

  isSubmitting.value = true;
  try {
    emit('save', {
      id: props.editItem?.id || null,
      ...form.value,
      amount: numAmount
    });
    emit('close');
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save transaction.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>
