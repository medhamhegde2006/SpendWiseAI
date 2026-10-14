<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-navy-900">Monthly Income vs Expenses</h3>
        <p class="text-xs text-slate-500">6-month cashflow comparison</p>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <span class="flex items-center gap-1.5 font-medium text-slate-600">
          <span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Income
        </span>
        <span class="flex items-center gap-1.5 font-medium text-slate-600">
          <span class="w-2.5 h-2.5 rounded-sm bg-navy-800"></span> Expense
        </span>
      </div>
    </div>

    <div class="flex-1 relative h-52">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import { formatINR } from '../../utils/formatters.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const props = defineProps({
  series: {
    type: Object,
    required: true
  }
});

const canvasRef = ref(null);
let chartInstance = null;

function renderChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  if (!canvasRef.value) return;

  chartInstance = new Chart(canvasRef.value, {
    type: 'bar',
    data: {
      labels: props.series.labels || [],
      datasets: [
        {
          label: 'Income',
          data: props.series.incomeData || [],
          backgroundColor: '#10b981',
          borderRadius: 6,
          barPercentage: 0.65,
          categoryPercentage: 0.7
        },
        {
          label: 'Expense',
          data: props.series.expenseData || [],
          backgroundColor: '#1c2541',
          borderRadius: 6,
          barPercentage: 0.65,
          categoryPercentage: 0.7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0b132b',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: (val) => '₹' + (val >= 1000 ? (val / 1000) + 'k' : val)
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
  () => props.series,
  () => {
    nextTick(renderChart);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  if (chartInstance) chartInstance.destroy();
});
</script>
