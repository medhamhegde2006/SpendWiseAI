import { db, isFirebaseConfigured } from './firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch
} from 'firebase/firestore';

const STORAGE_PREFIX = 'spendwise_user_data_';
const REAL_BACKUP_PREFIX = 'spendwise_real_backup_';

/**
 * Default clean account state for a newly registered user
 */
export function getInitialUserData() {
  return {
    openingBalance: 10000,
    transactions: [],
    budgets: [
      { id: 'b-overall', category: 'Overall', limit: 15000 },
      { id: 'b-food', category: 'Food', limit: 3500 },
      { id: 'b-ent', category: 'Entertainment', limit: 1500 }
    ],
    savingsGoals: [
      {
        id: 'sg-default',
        name: 'Emergency Buffer Fund',
        targetAmount: 10000,
        savedAmount: 2500,
        deadline: '2026-12-31'
      }
    ],
    customCategories: {
      income: [],
      expense: []
    },
    isDemoActive: false,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Loads user data from Cloud Firestore (if configured & authenticated) or isolated LocalStorage
 * @param {string} userId
 * @param {boolean} isCloudUser
 * @returns {Promise<Object|null>}
 */
export async function loadUserFinanceData(userId = 'guest_local', isCloudUser = false) {
  const localKey = `${STORAGE_PREFIX}${userId}`;

  if (isFirebaseConfigured && isCloudUser && db) {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userDocRef);

      const txColRef = collection(db, 'users', userId, 'transactions');
      const budgetsColRef = collection(db, 'users', userId, 'budgets');
      const goalsColRef = collection(db, 'users', userId, 'savingsGoals');

      const [txSnap, budgetsSnap, goalsSnap] = await Promise.all([
        getDocs(txColRef),
        getDocs(budgetsColRef),
        getDocs(goalsColRef)
      ]);

      const transactions = [];
      txSnap.forEach(d => {
        const item = d.data();
        transactions.push({ ...item, id: item.id || d.id });
      });

      const budgets = [];
      budgetsSnap.forEach(d => {
        const item = d.data();
        budgets.push({ ...item, id: item.id || d.id });
      });

      const savingsGoals = [];
      goalsSnap.forEach(d => {
        const item = d.data();
        savingsGoals.push({ ...item, id: item.id || d.id });
      });

      // If user document or subcollection records exist in Cloud Firestore
      if (userSnap.exists() || transactions.length > 0 || budgets.length > 0) {
        const userData = userSnap.exists() ? userSnap.data() : {};
        const cloudData = {
          openingBalance: Number(userData.openingBalance ?? 10000),
          transactions,
          budgets,
          savingsGoals,
          customCategories: userData.customCategories || { income: [], expense: [] },
          isDemoActive: false, // Cloud accounts are strictly production user data
          isCloudSynced: true,
          updatedAt: userData.updatedAt || new Date().toISOString()
        };

        // Cache locally for instant offline fallback strictly scoped to this user UID
        localStorage.setItem(localKey, JSON.stringify(cloudData));
        return cloudData;
      }
    } catch (err) {
      console.warn('Firestore load failed (falling back to local cache):', err.message);
    }
  }

  // Fallback to local storage (offline mode or unconfigured)
  // Strictly isolated by userId key: never fallback to guest_local if userId != 'guest_local'
  const raw = localStorage.getItem(localKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isCloudUser) {
        parsed.isDemoActive = false; // Never treat cloud user cache as demo
      }
      return parsed;
    } catch (e) {
      console.error('Corrupted local storage JSON:', e);
    }
  }

  return null;
}

/**
 * Saves user financial state to isolated LocalStorage and updates Cloud Firestore user doc
 */
export async function saveUserFinanceData(userId = 'guest_local', data, isCloudUser = false) {
  const localKey = `${STORAGE_PREFIX}${userId}`;
  const payload = {
    ...data,
    updatedAt: new Date().toISOString()
  };

  // Always save to isolated local storage immediately for fast local persistence
  localStorage.setItem(localKey, JSON.stringify(payload));

  let cloudSynced = false;
  let cloudError = null;

  if (isFirebaseConfigured && isCloudUser && db) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        openingBalance: data.openingBalance ?? 0,
        customCategories: data.customCategories || { income: [], expense: [] },
        isDemoActive: Boolean(data.isDemoActive),
        updatedAt: payload.updatedAt
      }, { merge: true });
      cloudSynced = true;
    } catch (err) {
      cloudError = err.message || 'Firestore write failed';
      console.warn('Firestore write warning (data preserved locally):', cloudError);
    }
  }

  return {
    success: true,
    cloudSynced,
    ...(cloudError && { error: cloudError })
  };
}

/**
 * Saves or updates an individual transaction in Cloud Firestore
 */
export async function saveCloudTransaction(userId, transaction) {
  if (!isFirebaseConfigured || !db || !userId) return;
  try {
    const txDocRef = doc(db, 'users', userId, 'transactions', transaction.id);
    await setDoc(txDocRef, {
      ...transaction,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to save transaction to Firestore:', err.message);
  }
}

/**
 * Deletes an individual transaction from Cloud Firestore
 */
export async function deleteCloudTransaction(userId, transactionId) {
  if (!isFirebaseConfigured || !db || !userId) return;
  try {
    const txDocRef = doc(db, 'users', userId, 'transactions', transactionId);
    await deleteDoc(txDocRef);
  } catch (err) {
    console.warn('Failed to delete transaction from Firestore:', err.message);
  }
}

/**
 * Saves or updates a budget limit in Cloud Firestore
 */
export async function saveCloudBudget(userId, budget) {
  if (!isFirebaseConfigured || !db || !userId) return;
  try {
    const budgetDocRef = doc(db, 'users', userId, 'budgets', budget.id);
    await setDoc(budgetDocRef, {
      ...budget,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to save budget to Firestore:', err.message);
  }
}

/**
 * Deletes a budget limit from Cloud Firestore
 */
export async function deleteCloudBudget(userId, budgetId) {
  if (!isFirebaseConfigured || !db || !userId) return;
  try {
    const budgetDocRef = doc(db, 'users', userId, 'budgets', budgetId);
    await deleteDoc(budgetDocRef);
  } catch (err) {
    console.warn('Failed to delete budget from Firestore:', err.message);
  }
}

/**
 * Saves or updates a savings goal in Cloud Firestore
 */
export async function saveCloudSavingsGoal(userId, goal) {
  if (!isFirebaseConfigured || !db || !userId) return;
  try {
    const goalDocRef = doc(db, 'users', userId, 'savingsGoals', goal.id);
    await setDoc(goalDocRef, {
      ...goal,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to save savings goal to Firestore:', err.message);
  }
}

/**
 * Deletes a savings goal from Cloud Firestore
 */
export async function deleteCloudSavingsGoal(userId, goalId) {
  if (!isFirebaseConfigured || !db || !userId) return;
  try {
    const goalDocRef = doc(db, 'users', userId, 'savingsGoals', goalId);
    await deleteDoc(goalDocRef);
  } catch (err) {
    console.warn('Failed to delete savings goal from Firestore:', err.message);
  }
}

/**
 * Atomically migrates local user records into Cloud Firestore using WriteBatch
 */
export async function batchMigrateLocalToCloud(userId, localData) {
  if (!isFirebaseConfigured || !db || !userId || !localData) {
    throw new Error('Firebase is not initialized or invalid migration parameters.');
  }

  const batch = writeBatch(db);

  // 1. Root user doc
  const userDocRef = doc(db, 'users', userId);
  batch.set(userDocRef, {
    openingBalance: localData.openingBalance ?? 10000,
    customCategories: localData.customCategories || { income: [], expense: [] },
    isDemoActive: false,
    migratedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  let txCount = 0;
  for (const tx of localData.transactions || []) {
    const txId = tx.id || 'tx_' + Math.random().toString(36).substring(2, 9);
    const txDocRef = doc(db, 'users', userId, 'transactions', txId);
    batch.set(txDocRef, { ...tx, id: txId }, { merge: true });
    txCount++;
  }

  let budgetCount = 0;
  for (const b of localData.budgets || []) {
    const bId = b.id || 'b_' + Math.random().toString(36).substring(2, 9);
    const bDocRef = doc(db, 'users', userId, 'budgets', bId);
    batch.set(bDocRef, { ...b, id: bId }, { merge: true });
    budgetCount++;
  }

  let goalCount = 0;
  for (const g of localData.savingsGoals || []) {
    const gId = g.id || 'sg_' + Math.random().toString(36).substring(2, 9);
    const gDocRef = doc(db, 'users', userId, 'savingsGoals', gId);
    batch.set(gDocRef, { ...g, id: gId }, { merge: true });
    goalCount++;
  }

  await batch.commit();

  // Clean up guest local records once migrated to prevent re-prompting or demo pollution
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}guest_local`);
    localStorage.setItem('spendwise_guest_migrated', 'true');
  } catch (cleanErr) {
    console.warn('LocalStorage cleanup warning:', cleanErr);
  }

  return {
    importedTransactions: txCount,
    importedBudgets: budgetCount,
    importedGoals: goalCount
  };
}

/**
 * Retrieves unmigrated local records for an ID
 */
export function getLocalUserData(userId = 'guest_local') {
  const localKey = `${STORAGE_PREFIX}${userId}`;
  const raw = localStorage.getItem(localKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Backs up real user records before loading sample demo data
 */
export function backupRealRecords(userId = 'guest_local', currentData) {
  if (!currentData) return;
  if (Array.isArray(currentData.transactions) && currentData.transactions.length === 0) return;
  const backupKey = `${REAL_BACKUP_PREFIX}${userId}`;
  localStorage.setItem(backupKey, JSON.stringify(currentData));
}

/**
 * Checks if a user has backed-up real records that can be restored
 */
export function hasRealBackup(userId = 'guest_local') {
  const backupKey = `${REAL_BACKUP_PREFIX}${userId}`;
  return Boolean(localStorage.getItem(backupKey));
}

/**
 * Restores backed-up real records and clears the demo flag
 */
export function restoreRealRecords(userId = 'guest_local') {
  const backupKey = `${REAL_BACKUP_PREFIX}${userId}`;
  const raw = localStorage.getItem(backupKey);
  if (!raw) return null;
  try {
    const restored = JSON.parse(raw);
    localStorage.removeItem(backupKey);
    return {
      ...restored,
      isDemoActive: false
    };
  } catch (e) {
    return null;
  }
}
