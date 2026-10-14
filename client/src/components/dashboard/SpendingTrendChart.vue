<template>
  <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-navy-900">14-Day Spending Velocity</h3>
        <p class="text-xs text-slate-500">Daily expense trajectory over the past two weeks</p>
      </div>
      <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
        Daily Trend
      </span>
    </div>

    <div class="flex-1 relative h-48">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip
} from 'chart.js';
import { formatINR } from '../../utils/formatters.js';

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip);

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
    type: 'line',
    data: {
      labels: props.series.labels || [],
      datasets: [
        {
          label: 'Daily Spend',
          data: props.series.data || [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 2.5,
          pointBackgroundColor: '#059669',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 3.5,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.35
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
            label: (ctx) => ` Spent: ${formatINR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            maxTicksLimit: 7
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            callback: (val) => '₹' + val
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
