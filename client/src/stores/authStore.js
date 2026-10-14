import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { auth, db, googleProvider, isFirebaseConfigured } from '../services/firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useFinanceStore } from './financeStore.js';
import { useChatStore } from './chatStore.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const loading = ref(false);
  const isAuthReady = ref(false);
  const error = ref(null);
  const isCloudAuth = ref(isFirebaseConfigured);

  const isAuthenticated = computed(() => Boolean(user.value && user.value.uid));

  let authReadyResolver = null;
  const authReadyPromise = new Promise((resolve) => {
    authReadyResolver = resolve;
  });

  /**
   * Translates Firebase Auth error codes into clear, user-friendly messages
   */
  function formatAuthError(err) {
    if (!err) return 'An unexpected error occurred.';
    const code = err.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please double-check your credentials.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in window was closed before completing.';
      case 'auth/popup-blocked':
        return 'Google sign-in popup was blocked by your browser. Please allow popups or retry.';
      case 'auth/network-request-failed':
        return 'Network connection error. Please verify your internet connection.';
      case 'auth/too-many-requests':
        return 'Too many sign-in attempts. Please wait a moment and try again.';
      default:
        return err.message || 'Authentication request failed.';
    }
  }

  /**
   * Initializes the real Firebase Auth listener
   */
  function initAuth(onUserChangedCallback) {
    if (isFirebaseConfigured && auth) {
      // Check for redirect result from Google sign in
      getRedirectResult(auth).catch(() => {});

      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          user.value = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            photoURL: firebaseUser.photoURL || null,
            isCloud: true
          };
        } else {
          user.value = null;
          const financeStore = useFinanceStore();
          financeStore.resetStateForLogout();
          const chatStore = useChatStore();
          chatStore.clearHistory();
        }

        if (!isAuthReady.value) {
          isAuthReady.value = true;
          if (authReadyResolver) authReadyResolver(user.value);
        }

        if (onUserChangedCallback) {
          await onUserChangedCallback(user.value);
        }
      });
    } else {
      // Local fallback mode when Firebase credentials are unconfigured
      user.value = null;
      isAuthReady.value = true;
      if (authReadyResolver) authReadyResolver(null);
      if (onUserChangedCallback) onUserChangedCallback(null);
    }
  }

  /**
   * Registers a new user with Email and Password
   */
  async function registerWithEmail({ email, password, displayName }) {
    error.value = null;
    loading.value = true;
    try {
      if (!isFirebaseConfigured || !auth) {
        throw new Error('Firebase Authentication is not configured in client/.env.');
      }

      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (displayName || '').trim() || cleanEmail.split('@')[0];

      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(cred.user, { displayName: cleanName });

      // Create initial user profile doc in Cloud Firestore
      if (db) {
        try {
          const userDocRef = doc(db, 'users', cred.user.uid);
          await setDoc(userDocRef, {
            uid: cred.user.uid,
            email: cleanEmail,
            displayName: cleanName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn('Initial user profile firestore write warning:', dbErr.message);
        }
      }

      user.value = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cleanName,
        photoURL: null,
        isCloud: true
      };

      return user.value;
    } catch (err) {
      error.value = formatAuthError(err);
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Signs in an existing user with Email and Password
   */
  async function loginWithEmail({ email, password }) {
    error.value = null;
    loading.value = true;
    try {
      if (!isFirebaseConfigured || !auth) {
        throw new Error('Firebase Authentication is not configured in client/.env.');
      }

      const cleanEmail = (email || '').trim().toLowerCase();
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);

      user.value = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || cleanEmail.split('@')[0],
        photoURL: cred.user.photoURL || null,
        isCloud: true
      };

      return user.value;
    } catch (err) {
      error.value = formatAuthError(err);
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Signs in with Google using popup with redirect fallback
   */
  async function loginWithGoogle() {
    error.value = null;
    loading.value = true;
    try {
      if (!isFirebaseConfigured || !auth || !googleProvider) {
        throw new Error('Google Sign-In is not configured in client/.env.');
      }

      let cred;
      try {
        cred = await signInWithPopup(auth, googleProvider);
      } catch (popupErr) {
        // If popup was blocked by browser, try redirect
        if (popupErr.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, googleProvider);
          return null;
        }
        throw popupErr;
      }

      if (cred && cred.user) {
        const u = cred.user;
        const displayName = u.displayName || u.email?.split('@')[0] || 'Google User';

        // Update profile in Firestore
        if (db) {
          try {
            const userDocRef = doc(db, 'users', u.uid);
            await setDoc(userDocRef, {
              uid: u.uid,
              email: u.email,
              displayName,
              photoURL: u.photoURL || null,
              lastLoginAt: new Date().toISOString()
            }, { merge: true });
          } catch (dbErr) {
            console.warn('Google user profile write warning:', dbErr.message);
          }
        }

        user.value = {
          uid: u.uid,
          email: u.email,
          displayName,
          photoURL: u.photoURL || null,
          isCloud: true
        };

        return user.value;
      }
      return null;
    } catch (err) {
      error.value = formatAuthError(err);
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Sends password reset email via Firebase
   */
  async function sendPasswordReset(email) {
    error.value = null;
    loading.value = true;
    try {
      if (!isFirebaseConfigured || !auth) {
        throw new Error('Firebase Authentication is not configured in client/.env.');
      }

      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail) {
        throw new Error('Please enter your email address.');
      }

      await sendPasswordResetEmail(auth, cleanEmail);
      return true;
    } catch (err) {
      error.value = formatAuthError(err);
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Signs out current user and resets stores
   */
  async function logout() {
    loading.value = true;
    try {
      if (isFirebaseConfigured && auth) {
        await signOut(auth);
      }
      user.value = null;
      error.value = null;

      // Cleanly reset finance store in-memory state so no cached data leaks
      const financeStore = useFinanceStore();
      financeStore.resetStateForLogout();

      // Cleanly reset chat store history so no previous user messages or insights leak
      const chatStore = useChatStore();
      chatStore.clearHistory();
    } finally {
      loading.value = false;
    }
  }

  return {
    user,
    loading,
    isAuthReady,
    authReadyPromise,
    error,
    isCloudAuth,
    isAuthenticated,
    initAuth,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    sendPasswordReset,
    logout
  };
});
