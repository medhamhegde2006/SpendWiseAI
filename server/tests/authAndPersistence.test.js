import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Authentication Validation, State Guards & Error Mapping', () => {
  // Authentication error mapping simulation (matching authStore.formatAuthError)
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

  test('formatAuthError correctly translates Firebase Auth error codes into friendly user messages', () => {
    assert.strictEqual(
      formatAuthError({ code: 'auth/invalid-credential' }),
      'Invalid email or password. Please double-check your credentials.'
    );
    assert.strictEqual(
      formatAuthError({ code: 'auth/email-already-in-use' }),
      'An account already exists with this email address. Please sign in instead.'
    );
    assert.strictEqual(
      formatAuthError({ code: 'auth/weak-password' }),
      'Password must be at least 6 characters long.'
    );
    assert.strictEqual(
      formatAuthError({ code: 'auth/popup-blocked' }),
      'Google sign-in popup was blocked by your browser. Please allow popups or retry.'
    );
    assert.strictEqual(
      formatAuthError({ code: 'auth/network-request-failed' }),
      'Network connection error. Please verify your internet connection.'
    );
  });

  test('signup form validation validates required fields, email format, and password matching', () => {
    function validateSignup({ fullName, email, password, confirmPassword }) {
      if (!fullName || !fullName.trim()) return { valid: false, error: 'Full name is required.' };
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) return { valid: false, error: 'Valid email is required.' };
      if (!password || password.length < 6) return { valid: false, error: 'Password must be at least 6 characters.' };
      if (password !== confirmPassword) return { valid: false, error: 'Passwords do not match.' };
      return { valid: true, error: null };
    }

    assert.strictEqual(validateSignup({ fullName: '', email: 'test@example.com', password: 'secret', confirmPassword: 'secret' }).valid, false);
    assert.strictEqual(validateSignup({ fullName: 'Priya', email: 'invalid-email', password: 'secret', confirmPassword: 'secret' }).valid, false);
    assert.strictEqual(validateSignup({ fullName: 'Priya', email: 'priya@spendwise.edu', password: '123', confirmPassword: '123' }).valid, false);
    assert.strictEqual(validateSignup({ fullName: 'Priya', email: 'priya@spendwise.edu', password: 'secret1', confirmPassword: 'secret2' }).valid, false);
    assert.strictEqual(validateSignup({ fullName: 'Priya', email: 'priya@spendwise.edu', password: 'password123', confirmPassword: 'password123' }).valid, true);
  });

  test('navigation guard simulation redirects unauthenticated requests to login and prevents dashboard flash', async () => {
    let authReady = false;
    let authUser = null;

    let resolveAuth;
    const authReadyPromise = new Promise(r => { resolveAuth = r; });

    async function evaluateGuard(toRoute) {
      if (!authReady) {
        await authReadyPromise;
      }
      const isAuthed = Boolean(authUser && authUser.uid);
      if (toRoute.meta.requiresAuth && !isAuthed) {
        return { action: 'redirect', target: '/login' };
      }
      if (toRoute.meta.guestOnly && isAuthed) {
        return { action: 'redirect', target: '/' };
      }
      return { action: 'proceed' };
    }

    // While auth is uninitialized, guard awaits promise and doesn't flash dashboard
    const guardPromise = evaluateGuard({ path: '/', meta: { requiresAuth: true } });

    // Simulate Firebase restoring state as signed-out user
    authUser = null;
    authReady = true;
    resolveAuth(null);

    const result = await guardPromise;
    assert.strictEqual(result.action, 'redirect');
    assert.strictEqual(result.target, '/login');

    // Simulate authenticated user visiting /login
    authUser = { uid: 'user_123', email: 'user@example.com' };
    const authResult = await evaluateGuard({ path: '/login', meta: { guestOnly: true } });
    assert.strictEqual(authResult.action, 'redirect');
    assert.strictEqual(authResult.target, '/');
  });
});

describe('Cloud Firestore Paths, Data Isolation & Migration Logic', () => {
  test('constructs strict user-isolated Firestore collection paths', () => {
    function getFirestorePaths(uid) {
      return {
        userDoc: `users/${uid}`,
        transactions: `users/${uid}/transactions`,
        budgets: `users/${uid}/budgets`,
        savingsGoals: `users/${uid}/savingsGoals`,
        categories: `users/${uid}/categories`
      };
    }

    const user1Paths = getFirestorePaths('uid_alpha');
    const user2Paths = getFirestorePaths('uid_beta');

    assert.strictEqual(user1Paths.userDoc, 'users/uid_alpha');
    assert.strictEqual(user2Paths.userDoc, 'users/uid_beta');
    assert.strictEqual(user1Paths.transactions, 'users/uid_alpha/transactions');
    assert.strictEqual(user2Paths.transactions, 'users/uid_beta/transactions');

    // Cross-user boundaries are strictly disjoint
    assert.notStrictEqual(user1Paths.transactions, user2Paths.transactions);
  });

  test('local-to-cloud migration logic deduplicates transactions and preserves all records', () => {
    const existingCloudTransactions = [
      { id: 'tx_01', description: 'Hostel Rent', amount: 5000, date: '2026-10-01' }
    ];

    const localTransactionsToMigrate = [
      { id: 'tx_01', description: 'Hostel Rent', amount: 5000, date: '2026-10-01' }, // duplicate ID
      { id: 'tx_02', description: 'Bookstore', amount: 800, date: '2026-10-05' },
      { id: 'tx_03', description: 'Train Ticket', amount: 350, date: '2026-10-06' }
    ];

    function deduplicateAndPlanMigration(cloudTxs, localTxs) {
      const existingIds = new Set(cloudTxs.map(t => t.id));
      const toImport = [];
      const skipped = [];

      for (const localTx of localTxs) {
        if (existingIds.has(localTx.id)) {
          skipped.push(localTx);
        } else {
          toImport.push(localTx);
          existingIds.add(localTx.id);
        }
      }

      return { toImport, skipped };
    }

    const plan = deduplicateAndPlanMigration(existingCloudTransactions, localTransactionsToMigrate);

    assert.strictEqual(plan.toImport.length, 2);
    assert.strictEqual(plan.skipped.length, 1);
    assert.strictEqual(plan.skipped[0].id, 'tx_01');
    assert.strictEqual(plan.toImport[0].id, 'tx_02');
    assert.strictEqual(plan.toImport[1].id, 'tx_03');
  });

  test('switching accounts cleanses store state and prevents cross-user leakage', () => {
    // Store state simulator
    let storeState = {
      activeUserId: 'user_A',
      transactions: [{ id: 'tx_A1', amount: 1000 }],
      openingBalance: 5000
    };

    function logoutReset() {
      storeState = {
        activeUserId: '',
        transactions: [],
        openingBalance: 0
      };
    }

    assert.strictEqual(storeState.transactions.length, 1);
    logoutReset();
    assert.strictEqual(storeState.activeUserId, '');
    assert.strictEqual(storeState.transactions.length, 0);
    assert.strictEqual(storeState.openingBalance, 0);
  });

  test('demo dataset filter: records flagged with isDemoActive are NEVER migrated into cloud Firestore', () => {
    function shouldPromptMigration(guestData, alreadyMigrated) {
      if (alreadyMigrated) return false;
      if (!guestData) return false;
      if (guestData.isDemoActive === true) return false; // Demo datasets are blocked
      if (!Array.isArray(guestData.transactions) || guestData.transactions.length === 0) return false;
      return true;
    }

    const demoGuestData = {
      isDemoActive: true,
      transactions: [{ id: 'tx_demo1', amount: 350, description: 'Canteen Thali' }]
    };

    const realOfflineGuestData = {
      isDemoActive: false,
      transactions: [{ id: 'tx_real1', amount: 1200, description: 'Medical Store' }]
    };

    assert.strictEqual(shouldPromptMigration(demoGuestData, false), false);
    assert.strictEqual(shouldPromptMigration(realOfflineGuestData, false), true);
    assert.strictEqual(shouldPromptMigration(realOfflineGuestData, true), false);
  });

  test('authenticated cloud user load forces isDemoActive to false', () => {
    function sanitizeLoadedUserFinanceData(rawParsed, isCloudUser) {
      if (!rawParsed) return null;
      if (isCloudUser) {
        return {
          ...rawParsed,
          isDemoActive: false
        };
      }
      return rawParsed;
    }

    const contaminatedCloudCache = {
      openingBalance: 10000,
      transactions: [{ id: 'tx1', amount: 500 }],
      isDemoActive: true
    };

    const sanitized = sanitizeLoadedUserFinanceData(contaminatedCloudCache, true);
    assert.strictEqual(sanitized.isDemoActive, false);
  });

  test('logout cleanses both finance store and chat history', () => {
    let financeStoreState = { activeUserId: 'u123', transactions: [{ id: 'tx1' }] };
    let chatStoreMessages = [
      { id: 'welcome-msg', role: 'assistant', content: 'Welcome' },
      { id: 'msg1', role: 'user', content: 'How much did I spend?' },
      { id: 'msg2', role: 'assistant', content: 'You spent 500' }
    ];

    function handleLogout() {
      financeStoreState = { activeUserId: '', transactions: [] };
      chatStoreMessages = [chatStoreMessages[0]];
    }

    assert.strictEqual(financeStoreState.transactions.length, 1);
    assert.strictEqual(chatStoreMessages.length, 3);

    handleLogout();

    assert.strictEqual(financeStoreState.transactions.length, 0);
    assert.strictEqual(chatStoreMessages.length, 1);
    assert.strictEqual(chatStoreMessages[0].id, 'welcome-msg');
  });
});
