<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-navy-900">Savings Goals</h3>
        <p class="text-xs text-slate-500">Track progress toward financial milestones</p>
      </div>
      <button
        @click="openNewGoal"
        class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-navy-900 text-white hover:bg-navy-800 transition flex items-center gap-1"
      >
        <AppIcon :name="showForm ? 'close' : 'plus'" :size="14" />
        {{ showForm ? 'Cancel' : 'New Goal' }}
      </button>
    </div>

    <!-- Add / Edit Savings Goal Form -->
    <form
      v-if="showForm"
      @submit.prevent="submitGoal"
      class="mb-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
    >
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Goal Name</label>
        <input
          v-model="form.name"
          type="text"
          placeholder="e.g. Emergency Fund, Laptop Upgrade"
          required
          class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Target Amount (₹)</label>
          <input
            v-model.number="form.targetAmount"
            type="number"
            min="100"
            required
            class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Saved So Far (₹)</label>
          <input
            v-model.number="form.savedAmount"
            type="number"
            min="0"
            required
            class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div class="flex justify-end pt-1">
        <button
          type="submit"
          class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
        >
          {{ form.id ? 'Update Goal' : 'Create Goal' }}
        </button>
      </div>
    </form>

    <!-- Empty State -->
    <div v-if="goals.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
      <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
        <AppIcon name="target" :size="20" />
      </div>
      <p class="text-sm font-medium text-slate-600">No active savings goals</p>
      <p class="text-xs text-slate-400 mt-0.5">Set a target like ₹1,000 monthly savings or an emergency fund.</p>
    </div>

    <!-- Goals List -->
    <div v-else class="space-y-3 flex-1 overflow-y-auto pr-1 max-h-72">
      <div
        v-for="goal in goals"
        :key="goal.id"
        class="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80"
      >
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <h4 class="text-xs font-bold text-navy-900">{{ goal.name }}</h4>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Saved <strong class="text-emerald-700">{{ formatINR(goal.savedAmount) }}</strong> of {{ formatINR(goal.targetAmount) }}
            </p>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {{ getGoalPercent(goal) }}%
            </span>
            <button
              @click="editGoal(goal)"
              class="text-slate-400 hover:text-navy-900 p-1"
              title="Edit goal"
            >
              <AppIcon name="edit" :size="13" />
            </button>
            <button
              @click="$emit('delete-goal', goal.id)"
              class="text-slate-400 hover:text-rose-600 p-1"
              title="Delete goal"
            >
              <AppIcon name="trash" :size="13" />
            </button>
          </div>
        </div>

        <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            :style="{ width: `${Math.min(100, getGoalPercent(goal))}%` }"
          ></div>
        </div>

        <div class="flex items-center justify-between mt-2 text-[11px] text-slate-500">
          <span>
            {{ goal.targetAmount > goal.savedAmount ? `${formatINR(goal.targetAmount - goal.savedAmount)} to go` : '🎉 Goal Reached!' }}
          </span>
          <button
            v-if="goal.savedAmount < goal.targetAmount"
            @click="quickAddSavings(goal, 500)"
            class="text-emerald-600 hover:text-emerald-700 font-semibold"
          >
            + Add ₹500
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
  goals: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['save-goal', 'delete-goal']);

const showForm = ref(false);
const form = ref({
  id: null,
  name: '',
  targetAmount: 5000,
  savedAmount: 1000
});

function getGoalPercent(goal) {
  if (!goal.targetAmount || goal.targetAmount <= 0) return 0;
  return Math.round((goal.savedAmount / goal.targetAmount) * 100);
}

function openNewGoal() {
  if (showForm.value) {
    showForm.value = false;
    return;
  }
  form.value = { id: null, name: '', targetAmount: 5000, savedAmount: 500 };
  showForm.value = true;
}

function editGoal(goal) {
  form.value = { ...goal };
  showForm.value = true;
}

function quickAddSavings(goal, increment) {
  emit('save-goal', {
    ...goal,
    savedAmount: Number(goal.savedAmount || 0) + increment
  });
}

function submitGoal() {
  if (!form.value.name.trim() || form.value.targetAmount <= 0) return;
  emit('save-goal', { ...form.value });
  showForm.value = false;
}
</script>
