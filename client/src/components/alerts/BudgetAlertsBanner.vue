<template>
  <div class="space-y-3">
    <!-- Active Threshold Alert Banner -->
    <div
      v-if="alerts.length > 0 && !isDismissed"
      class="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
      :class="
        hasExceeded
          ? 'bg-rose-50/90 border-rose-200 text-rose-900'
          : 'bg-amber-50/90 border-amber-200 text-amber-900'
      "
    >
      <div class="flex items-start gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          :class="hasExceeded ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'"
        >
          <AppIcon name="alert" :size="18" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-bold">
              {{ hasExceeded ? 'Budget Limit Exceeded!' : 'Budget Threshold Warning (80%+)' }}
            </h4>
            <span class="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/70 border border-current/20">
              {{ alerts.length }} {{ alerts.length === 1 ? 'Alert' : 'Alerts' }}
            </span>
          </div>
          <ul class="mt-1 space-y-0.5 text-xs">
            <li v-for="alert in alerts" :key="alert.category">
              • <strong>{{ alert.category }}</strong>: Spent <strong>{{ formatINR(alert.spent) }}</strong> of {{ formatINR(alert.limit) }} limit (<strong>{{ alert.percentage }}%</strong>)
              <span v-if="alert.status === 'exceeded'" class="font-semibold underline ml-1">
                — Over by {{ formatINR(alert.overAmount) }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          @click="showNotificationInfo = true"
          class="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/80 hover:bg-white border border-slate-300 text-slate-700 transition flex items-center gap-1.5"
        >
          <AppIcon name="bell" :size="14" />
          Alert Settings
        </button>
        <button
          @click="isDismissed = true"
          class="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition"
          title="Dismiss banner for now"
        >
          <AppIcon name="close" :size="16" />
        </button>
      </div>
    </div>

    <!-- Modal: Browser Notification Limitations & In-App Alert Architecture -->
    <div
      v-if="showNotificationInfo"
      class="fixed inset-0 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      @click.self="showNotificationInfo = false"
    >
      <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-navy-900 text-emerald-400 flex items-center justify-center">
              <AppIcon name="bell" :size="18" />
            </div>
            <div>
              <h3 class="text-base font-bold text-navy-900">SpendWise Alert System & Browser Notifications</h3>
              <p class="text-xs text-slate-500">How budget threshold alerts are delivered</p>
            </div>
          </div>
          <button @click="showNotificationInfo = false" class="text-slate-400 hover:text-slate-600">
            <AppIcon name="close" :size="18" />
          </button>
        </div>

        <div class="mt-4 space-y-3 text-xs text-slate-600 leading-relaxed">
          <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
            <strong class="font-semibold block mb-1">1. Primary Channel: Deterministic In-App Alerts (Active)</strong>
            SpendWise AI continuously monitors your monthly spending against configured category limits in real time. Warnings trigger automatically at <strong>80% usage</strong> and critical alerts at <strong>100% usage</strong>.
          </div>

          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <strong class="font-semibold text-navy-900 block mb-1">2. Browser Notification Limitations</strong>
            While SpendWise AI supports the Web Notifications API, browser notifications have strict platform constraints:
            <ul class="list-disc pl-4 mt-1.5 space-y-1 text-slate-600">
              <li><strong>Explicit User Permission:</strong> Browsers block notifications unless manually granted by the user.</li>
              <li><strong>Secure Context (HTTPS):</strong> Web Notifications only function over HTTPS or <code>localhost</code>.</li>
              <li><strong>Tab Lifecycle:</strong> Without a persistent background Service Worker and VAPID Push Server, browser notifications only trigger while the web app is open.</li>
              <li><strong>OS Focus Modes:</strong> Windows Focus Assist or macOS Do Not Disturb can silently suppress browser popups.</li>
            </ul>
          </div>

          <div class="flex items-center justify-between pt-2">
            <div>
              <span class="font-medium text-slate-700">Browser Permission Status: </span>
              <span class="font-bold uppercase text-navy-900">{{ browserPermission }}</span>
            </div>
            <button
              @click="requestBrowserNotification"
              class="px-3.5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-medium text-xs transition"
            >
              Test / Enable Browser Alert
            </button>
          </div>
          <p v-if="testFeedback" class="text-emerald-600 font-medium text-xs">{{ testFeedback }}</p>
        </div>

        <div class="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            @click="showNotificationInfo = false"
            class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { formatINR } from '../../utils/formatters.js';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  alerts: {
    type: Array,
    default: () => []
  },
  openModalSignal: {
    type: Number,
    default: 0
  }
});

const isDismissed = ref(false);
const showNotificationInfo = ref(false);
const testFeedback = ref('');

const browserPermission = ref(
  typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
);

const hasExceeded = computed(() =>
  props.alerts.some(a => a.status === 'exceeded')
);

watch(
  () => props.alerts.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) isDismissed.value = false;
  }
);

watch(
  () => props.openModalSignal,
  (val) => {
    if (val > 0) showNotificationInfo.value = true;
  }
);

async function requestBrowserNotification() {
  testFeedback.value = '';
  if (typeof Notification === 'undefined') {
    testFeedback.value = 'Web Notifications API is not supported in this browser environment.';
    return;
  }
  try {
    const perm = await Notification.requestPermission();
    browserPermission.value = perm;
    if (perm === 'granted') {
      new Notification('SpendWise AI Budget Monitor', {
        body: props.alerts.length > 0
          ? `You have ${props.alerts.length} active budget threshold alert(s).`
          : 'Browser notifications are active! You will be alerted when categories cross 80%.'
      });
      testFeedback.value = 'Browser notification sent successfully!';
    } else {
      testFeedback.value = 'Permission denied or dismissed in browser settings. In-app alerts remain active.';
    }
  } catch (e) {
    testFeedback.value = 'Could not trigger browser notification: ' + e.message;
  }
}
</script>
