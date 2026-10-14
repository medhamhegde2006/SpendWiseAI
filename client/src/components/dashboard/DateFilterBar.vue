<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex flex-wrap items-center justify-between gap-3">
    <!-- Left: Date Filter Buttons -->
    <div class="flex flex-wrap items-center gap-1.5">
      <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-2 px-1">
        <AppIcon name="calendar" :size="15" />
        <span>Period:</span>
      </div>

      <button
        v-for="opt in filterOptions"
        :key="opt.value"
        @click="selectFilter(opt.value)"
        class="px-3 py-1.5 rounded-xl text-xs font-medium transition"
        :class="
          modelValue === opt.value
            ? 'bg-navy-900 text-white shadow-sm'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        "
      >
        {{ opt.label }}
      </button>

      <!-- Custom Range Date Inputs -->
      <div v-if="modelValue === 'custom'" class="flex items-center gap-2 ml-2">
        <input
          :value="customStart"
          @input="$emit('update:customStart', $event.target.value)"
          type="date"
          class="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
        />
        <span class="text-xs text-slate-400">to</span>
        <input
          :value="customEnd"
          @input="$emit('update:customEnd', $event.target.value)"
          type="date"
          class="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
        />
      </div>
    </div>

    <!-- Right: Restore Real Records (if backup exists) or Status Badge -->
    <div class="flex items-center gap-2">
      <span
        v-if="isDemoActive"
        class="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Demo Dataset Active
      </span>

      <button
        v-if="hasBackup && isDemoActive"
        @click="$emit('restore-real')"
        class="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer"
        title="Restore your previously saved real records"
      >
        <AppIcon name="refresh" :size="14" />
        Restore Real Records
      </button>
    </div>
  </div>
</template>

<script setup>
import AppIcon from '../common/AppIcon.vue';

defineProps({
  modelValue: {
    type: String,
    default: 'all'
  },
  customStart: {
    type: String,
    default: ''
  },
  customEnd: {
    type: String,
    default: ''
  },
  isDemoActive: {
    type: Boolean,
    default: false
  },
  hasBackup: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:modelValue',
  'update:customStart',
  'update:customEnd',
  'restore-real'
]);

const filterOptions = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Custom', value: 'custom' }
];

function selectFilter(val) {
  emit('update:modelValue', val);
}
</script>
