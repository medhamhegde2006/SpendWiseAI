<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
  >
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
      <!-- Header -->
      <div class="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
          <AppIcon name="database" :size="20" />
        </div>
        <div>
          <h3 class="text-base font-bold text-navy-900">
            Local Data Migration Available
          </h3>
          <p class="text-xs text-slate-500">
            Transfer offline simulation records to your authenticated Firestore account
          </p>
        </div>
      </div>

      <!-- Migration Summary -->
      <div class="mt-4 space-y-3">
        <p class="text-xs text-slate-600 leading-relaxed">
          We detected unmigrated local finance records saved in your browser's local storage. Would you like to import them to your cloud account (<strong>{{ userEmail }}</strong>)?
        </p>

        <div class="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
          <div class="p-2">
            <span class="text-lg font-bold text-navy-900">{{ localTxCount }}</span>
            <p class="text-[11px] text-slate-500">Transactions</p>
          </div>
          <div class="p-2 border-x border-slate-200">
            <span class="text-lg font-bold text-navy-900">{{ localBudgetCount }}</span>
            <p class="text-[11px] text-slate-500">Budgets</p>
          </div>
          <div class="p-2">
            <span class="text-lg font-bold text-navy-900">{{ localGoalCount }}</span>
            <p class="text-[11px] text-slate-500">Savings Goals</p>
          </div>
        </div>

        <div v-if="migrationResult" class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
          <strong>Migration Complete:</strong>
          Successfully transferred {{ migrationResult.importedTransactions }} transactions, {{ migrationResult.importedBudgets }} budgets, and {{ migrationResult.importedGoals }} goals to Cloud Firestore.
        </div>

        <div v-if="migrationError" class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
          {{ migrationError }}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
        <button
          v-if="!migrationResult"
          type="button"
          @click="$emit('dismiss')"
          :disabled="isMigrating"
          class="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          Skip / Start Fresh
        </button>

        <button
          v-if="!migrationResult"
          type="button"
          @click="startMigration"
          :disabled="isMigrating"
          class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <span v-if="isMigrating" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>{{ isMigrating ? 'Migrating Records...' : 'Import to Cloud Firestore' }}</span>
        </button>

        <button
          v-else
          type="button"
          @click="$emit('dismiss')"
          class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useFinanceStore } from '../../stores/financeStore.js';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  localData: {
    type: Object,
    default: () => null
  },
  userEmail: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['dismiss', 'migrated']);

const financeStore = useFinanceStore();
const isMigrating = ref(false);
const migrationResult = ref(null);
const migrationError = ref('');

const localTxCount = computed(() => props.localData?.transactions?.length || 0);
const localBudgetCount = computed(() => props.localData?.budgets?.length || 0);
const localGoalCount = computed(() => props.localData?.savingsGoals?.length || 0);

async function startMigration() {
  if (!props.localData) return;
  isMigrating.value = true;
  migrationError.value = '';

  try {
    const res = await financeStore.migrateLocalDataToCloud(props.localData);
    migrationResult.value = res;
    emit('migrated', res);
  } catch (err) {
    migrationError.value = err.message || 'Migration failed. Please retry.';
  } finally {
    isMigrating.value = false;
  }
}
</script>
