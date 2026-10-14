import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore.js';

import DashboardView from '../views/DashboardView.vue';
import LoginView from '../views/LoginView.vue';
import SignupView from '../views/SignupView.vue';
import ForgotPasswordView from '../views/ForgotPasswordView.vue';

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { guestOnly: true }
  },
  {
    path: '/signup',
    name: 'signup',
    component: SignupView,
    meta: { guestOnly: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordView,
    meta: { guestOnly: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Authentication Navigation Guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Wait for initial Firebase auth restoration before making routing decisions
  if (!authStore.isAuthReady) {
    await authStore.authReadyPromise;
  }

  const isAuthed = authStore.isAuthenticated;

  if (to.meta.requiresAuth && !isAuthed) {
    // Unauthenticated user trying to access protected dashboard -> redirect to Login
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }

  if (to.meta.guestOnly && isAuthed) {
    // Authenticated user trying to access Login / Signup / ForgotPassword -> redirect to Dashboard
    return next({ path: '/' });
  }

  next();
});

export default router;
