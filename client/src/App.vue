<template>
  <div>
    <!-- Initial Auth Restoration Splash Screen (Guarantees Zero Dashboard Flash) -->
    <div
      v-if="!authStore.isAuthReady"
      class="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6 text-white text-center"
    >
      <div class="w-14 h-14 rounded-2xl bg-emerald-500 text-navy-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20 mb-4 animate-pulse">
        <AppIcon name="wallet" :size="30" />
      </div>
      <h2 class="text-xl font-bold tracking-tight flex items-center gap-2">
        SpendWise <span class="text-emerald-400">AI</span>
      </h2>
      <p class="text-xs text-slate-400 mt-1">Personal Finance Simulator</p>

      <div class="mt-8 flex items-center gap-2.5 text-xs text-slate-300">
        <span class="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></span>
        <span>Securing financial session with Firebase...</span>
      </div>
    </div>

    <!-- Routed Application Views -->
    <router-view v-else />
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/authStore.js';
import AppIcon from './components/common/AppIcon.vue';

const authStore = useAuthStore();
</script>
