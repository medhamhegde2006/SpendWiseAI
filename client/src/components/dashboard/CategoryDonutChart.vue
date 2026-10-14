<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-navy-900">Expense Breakdown by Category</h3>
        <p class="text-xs text-slate-500">Proportional distribution for selected period</p>
      </div>
      <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        {{ breakdown.length }} Categories
      </span>
    </div>

    <div v-if="breakdown.length === 0" class="flex-1 flex flex-col items-center justify-center py-10 text-center">
      <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <AppIcon name="chart" :size="22" />
      </div>
      <p class="text-sm font-medium text-slate-600">No expenses in this period</p>
      <p class="text-xs text-slate-400 mt-1">Add an expense or change the date filter to view category breakdown.</p>
    </div>

    <div v-else class="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
      <!-- Donut Canvas -->
      <div class="md:col-span-6 relative h-52 flex items-center justify-center">
        <canvas ref="canvasRef"></canvas>
      </div>

      <!-- Category Legend List -->
      <div class="md:col-span-6 space-y-2 max-h-52 overflow-y-auto pr-1">
        <div
          v-for="(item, idx) in breakdown"
          :key="item.category"
          class="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-slate-50 transition"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="w-3 h-3 rounded-full shrink-0"
              :style="{ backgroundColor: getCategoryColor(item.category, idx) }"
            ></span>
            <span class="font-medium text-slate-700 truncate">{{ item.category }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-2">
            <span class="font-semibold text-slate-900">{{ formatINR(item.amount) }}</span>
            <span class="text-slate-400 w-10 text-right">{{ item.percentage }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import { getCategoryColor } from '../../utils/categories.js';
import { formatINR } from '../../utils/formatters.js';
import AppIcon from '../common/AppIcon.vue';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

const props = defineProps({
  breakdown: {
    type: Array,
    default: () => []
  }
});

const canvasRef = ref(null);
let chartInstance = null;

function renderChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  if (!canvasRef.value || props.breakdown.length === 0) return;

  const labels = props.breakdown.map(i => i.category);
  const data = props.breakdown.map(i => i.amount);
  const colors = props.breakdown.map((i, idx) => getCategoryColor(i.category, idx));

  chartInstance = new Chart(canvasRef.value, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#0b132b',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed || 0;
              const item = props.breakdown[ctx.dataIndex];
              const pct = item ? item.percentage : 0;
              return ` ${ctx.label}: ${formatINR(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

onMounted(() => {
  nextTick(renderChart);
});

watch(
  () => props.breakdown,
  () => {
    nextTick(renderChart);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  if (chartInstance) chartInstance.destroy();
});
</script>
