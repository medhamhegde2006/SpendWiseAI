<template>
  <div class="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Logo & Brand Header -->
      <div class="flex items-center justify-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center text-navy-950 font-bold shadow-md">
          <AppIcon name="wallet" :size="24" />
        </div>
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-navy-900 flex items-center gap-1.5">
            SpendWise <span class="text-emerald-500">AI</span>
          </h1>
          <p class="text-xs text-slate-500">Personal Finance Simulator</p>
        </div>
      </div>

      <h2 class="mt-6 text-center text-xl font-bold tracking-tight text-navy-900">
        Reset your password
      </h2>
      <p class="mt-1 text-center text-xs text-slate-600">
        Enter your verified email and we'll send a secure password reset link.
      </p>
    </div>

    <div class="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
      <div class="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-200/80 sm:px-10">
        <!-- Success Banner -->
        <div
          v-if="successMessage"
          class="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5"
        >
          <AppIcon name="check" :size="16" class="shrink-0 mt-0.5 text-emerald-600" />
          <div class="flex-1 leading-relaxed">
            {{ successMessage }}
          </div>
        </div>

        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
        >
          <AppIcon name="close" :size="16" class="shrink-0 mt-0.5 text-rose-500" />
          <div class="flex-1">{{ errorMessage }}</div>
        </div>

        <form @submit.prevent="handleSendReset" class="space-y-4">
          <div>
            <label for="email" class="block text-xs font-semibold text-slate-700">
              Account Email Address
            </label>
            <div class="mt-1">
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
                :disabled="isLoading || !!successMessage"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition disabled:opacity-60"
              />
            </div>
          </div>

          <div class="pt-2">
            <button
              type="submit"
              :disabled="isLoading || !email.trim() || !!successMessage"
              class="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span v-if="isLoading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>{{ isLoading ? 'Sending reset link...' : 'Send Password Reset Link' }}</span>
            </button>
          </div>
        </form>

        <div class="mt-6 pt-4 border-t border-slate-100 text-center">
          <router-link
            to="/login"
            class="text-xs font-semibold text-emerald-600 hover:text-emerald-500 hover:underline flex items-center justify-center gap-1.5"
          >
            <span>← Back to Sign In</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/authStore.js';
import AppIcon from '../components/common/AppIcon.vue';

const authStore = useAuthStore();

const email = ref('');
const isLoading = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

async function handleSendReset() {
  if (isLoading.value || !email.value.trim()) return;
  errorMessage.value = '';
  successMessage.value = '';
  isLoading.value = true;

  try {
    await authStore.sendPasswordReset(email.value);
    successMessage.value = `A password reset link has been dispatched to ${email.value}. Please check your inbox and follow the instructions to set a new password.`;
  } catch (err) {
    errorMessage.value = err.message || 'Failed to dispatch password reset email. Please try again.';
  } finally {
    isLoading.value = false;
  }
}
</script>
