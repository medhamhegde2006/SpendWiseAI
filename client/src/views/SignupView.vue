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
        Create your personal account
      </h2>
      <p class="mt-1 text-center text-xs text-slate-600">
        Already have an account?
        <router-link to="/login" class="font-semibold text-emerald-600 hover:text-emerald-500 underline ml-1">
          Sign in here
        </router-link>
      </p>
    </div>

    <div class="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
      <div class="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-200/80 sm:px-10">
        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
        >
          <AppIcon name="close" :size="16" class="shrink-0 mt-0.5 text-rose-500" />
          <div class="flex-1">{{ errorMessage }}</div>
        </div>

        <!-- Google Sign-In Option -->
        <div>
          <button
            type="button"
            @click="handleGoogleLogin"
            :disabled="isLoading"
            class="w-full flex justify-center items-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500 transition shadow-2xs disabled:opacity-60 cursor-pointer"
          >
            <!-- Google SVG Icon -->
            <svg class="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign up with Google</span>
          </button>
        </div>

        <div class="mt-6 relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200" />
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="px-2 bg-white text-slate-400 font-medium">Or register with email</span>
          </div>
        </div>

        <!-- Registration Form -->
        <form @submit.prevent="handleRegister" class="mt-6 space-y-4">
          <div>
            <label for="fullName" class="block text-xs font-semibold text-slate-700">
              Full Name
            </label>
            <div class="mt-1">
              <input
                id="fullName"
                v-model="fullName"
                type="text"
                autocomplete="name"
                required
                placeholder="e.g. Alex Sharma"
                :disabled="isLoading"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label for="email" class="block text-xs font-semibold text-slate-700">
              Email address
            </label>
            <div class="mt-1">
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
                :disabled="isLoading"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label for="password" class="block text-xs font-semibold text-slate-700">
              Password (min. 6 characters)
            </label>
            <div class="mt-1 relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                required
                minlength="6"
                placeholder="••••••••"
                :disabled="isLoading"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition disabled:opacity-60 pr-10"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabindex="-1"
              >
                <AppIcon :name="showPassword ? 'close' : 'eye'" :size="16" />
              </button>
            </div>
          </div>

          <div>
            <label for="confirmPassword" class="block text-xs font-semibold text-slate-700">
              Confirm Password
            </label>
            <div class="mt-1 relative">
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                required
                placeholder="••••••••"
                :disabled="isLoading"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition disabled:opacity-60 pr-10"
              />
            </div>
          </div>

          <div class="pt-2">
            <button
              type="submit"
              :disabled="isLoading || !isFormValid"
              class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span v-if="isLoading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>{{ isLoading ? 'Creating account...' : 'Create Account' }}</span>
            </button>
          </div>
        </form>

        <!-- Terms and Privacy -->
        <p class="mt-5 text-center text-[11px] text-slate-400">
          By signing up, you agree to isolated, private simulation storage on Cloud Firestore.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore.js';
import AppIcon from '../components/common/AppIcon.vue';

const router = useRouter();
const authStore = useAuthStore();

const fullName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

const isFormValid = computed(() => {
  return (
    fullName.value.trim().length > 0 &&
    email.value.trim().length > 0 &&
    password.value.length >= 6 &&
    password.value === confirmPassword.value
  );
});

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }
  if (password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters.';
    return;
  }

  errorMessage.value = '';
  isLoading.value = true;

  try {
    await authStore.registerWithEmail({
      email: email.value,
      password: password.value,
      displayName: fullName.value
    });
    router.push('/');
  } catch (err) {
    errorMessage.value = err.message || 'Registration failed. Please try again.';
  } finally {
    isLoading.value = false;
  }
}

async function handleGoogleLogin() {
  if (isLoading.value) return;
  errorMessage.value = '';
  isLoading.value = true;

  try {
    const user = await authStore.loginWithGoogle();
    if (user) {
      router.push('/');
    }
  } catch (err) {
    errorMessage.value = err.message || 'Google sign-in failed. Please try again.';
  } finally {
    isLoading.value = false;
  }
}
</script>
