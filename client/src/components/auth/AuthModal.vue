<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-navy-900 text-emerald-400 flex items-center justify-center">
            <AppIcon name="shield" :size="18" />
          </div>
          <div>
            <h3 class="text-base font-bold text-navy-900">
              {{ isRegister ? 'Create SpendWise Account' : 'Sign In / Switch User' }}
            </h3>
            <p class="text-xs text-slate-500">
              {{ authStore.isCloudAuth ? 'Firebase Cloud Authentication' : 'Isolated Multi-User Simulator' }}
            </p>
          </div>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600">
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <!-- Mode Tabs -->
      <div class="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mt-4">
        <button
          type="button"
          @click="isRegister = false"
          class="py-1.5 rounded-lg text-xs font-semibold transition"
          :class="!isRegister ? 'bg-white text-navy-900 shadow-2xs' : 'text-slate-500'"
        >
          Sign In
        </button>
        <button
          type="button"
          @click="isRegister = true"
          class="py-1.5 rounded-lg text-xs font-semibold transition"
          :class="isRegister ? 'bg-white text-navy-900 shadow-2xs' : 'text-slate-500'"
        >
          Create Account
        </button>
      </div>

      <form @submit.prevent="handleAuth" class="mt-4 space-y-3.5">
        <div v-if="isRegister">
          <label class="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
          <input
            v-model="displayName"
            type="text"
            placeholder="e.g. Priya Verma"
            required
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
          <input
            v-model="email"
            type="email"
            placeholder="student@university.edu"
            required
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <input
            v-model="password"
            type="password"
            minlength="6"
            placeholder="••••••••"
            required
            class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <p v-if="errorMsg" class="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
          {{ errorMsg }}
        </p>

        <button
          type="submit"
          :disabled="authStore.loading"
          class="w-full py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold transition shadow-xs"
        >
          {{ authStore.loading ? 'Authenticating...' : (isRegister ? 'Create Isolated Account' : 'Sign In to Account') }}
        </button>
      </form>

      <div class="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-2">
        <p>
          <strong>Data Isolation Guarantee:</strong> Each user UID maintains a strictly isolated ledger of transactions, budgets, and savings goals.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../../stores/authStore.js';
import AppIcon from '../common/AppIcon.vue';

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'authenticated']);

const authStore = useAuthStore();
const isRegister = ref(false);
const displayName = ref('');
const email = ref('');
const password = ref('');
const errorMsg = ref('');

async function handleAuth() {
  errorMsg.value = '';
  try {
    let loggedUser = null;
    if (isRegister.value) {
      loggedUser = await authStore.registerUser({
        email: email.value,
        password: password.value,
        displayName: displayName.value
      });
    } else {
      loggedUser = await authStore.loginUser({
        email: email.value,
        password: password.value
      });
    }
    emit('authenticated', loggedUser);
    emit('close');
  } catch (err) {
    errorMsg.value = err.message || 'Authentication failed.';
  }
}
</script>
