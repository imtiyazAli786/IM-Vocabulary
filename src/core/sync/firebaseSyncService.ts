/**
 * Real-Time Firebase Sync Service
 * Synchronizes exact card swipe progress, learning stats (streaks, total words swiped),
 * words, and sentences across Web and Mobile in real time.
 * Offline-first: operations gracefully succeed or queue with fast timeouts so UI never hangs.
 */

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseInstances, initFirebase } from '../firebase/firebaseConfig';
import { Word } from '../../features/words/types';
import { UserSentence } from '../../features/sentences/types';
import { UserStats } from '../storage/storageRepository';
import { syncService } from './syncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHARED_USER_ID_KEY = '@lexicard_shared_sync_id';
const TIMEOUT_MS = 1500;

export interface RemoteDeckProgress {
  currentIndex: number;
  completedTodayCount: number;
  lastActiveDate: string;
  sourceDevice?: string;
  updatedAt?: any;
}

class FirebaseSyncManager {
  private currentUserId: string | null = null;
  private unsubscribeProgress: (() => void) | null = null;
  private unsubscribeStats: (() => void) | null = null;

  async getSyncUserId(): Promise<string> {
    if (this.currentUserId) return this.currentUserId;

    // Check saved shared ID (so user can pair phone & web with same ID)
    const saved = await AsyncStorage.getItem(SHARED_USER_ID_KEY);
    if (saved) {
      this.currentUserId = saved;
      return saved;
    }

    const { auth } = getFirebaseInstances();
    if (auth?.currentUser) {
      this.currentUserId = auth.currentUser.uid;
      await AsyncStorage.setItem(SHARED_USER_ID_KEY, this.currentUserId);
      return this.currentUserId;
    }

    const fallbackId = `user-${Math.random().toString(36).substring(2, 10)}`;
    this.currentUserId = fallbackId;
    await AsyncStorage.setItem(SHARED_USER_ID_KEY, fallbackId);
    return fallbackId;
  }

  async setSyncUserId(userId: string): Promise<void> {
    this.currentUserId = userId.trim();
    await AsyncStorage.setItem(SHARED_USER_ID_KEY, this.currentUserId);
  }

  /**
   * Syncs user learning statistics (streak, totalCardsSwiped, dailyGoal) to Firestore.
   */
  async syncStats(stats: UserStats): Promise<void> {
    let instances = getFirebaseInstances();
    if (!instances.db) {
      await initFirebase();
      instances = getFirebaseInstances();
    }
    if (!instances.db) return;

    try {
      const uid = await this.getSyncUserId();
      const statsRef = doc(instances.db, 'users', uid, 'session', 'stats');

      const writePromise = setDoc(
        statsRef,
        {
          streak: stats.streak,
          lastActiveDate: stats.lastActiveDate,
          totalCardsSwiped: stats.totalCardsSwiped,
          dailyGoal: stats.dailyGoal,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await Promise.race([
        writePromise,
        new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS)),
      ]);
      syncService.reportSyncSuccess();
    } catch {
      // Graceful offline fallback
    }
  }

  /**
   * Pulls remote stats from Firestore and returns them if available.
   */
  async pullRemoteStats(): Promise<UserStats | null> {
    let instances = getFirebaseInstances();
    if (!instances.db) {
      await initFirebase();
      instances = getFirebaseInstances();
    }
    if (!instances.db) return null;

    try {
      const uid = await this.getSyncUserId();
      const statsRef = doc(instances.db, 'users', uid, 'session', 'stats');

      const snap = await Promise.race([
        getDoc(statsRef),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
      ]);

      if (snap && snap.exists()) {
        const data = snap.data();
        return {
          streak: data.streak ?? 1,
          lastActiveDate: data.lastActiveDate ?? new Date().toISOString().split('T')[0],
          totalCardsSwiped: data.totalCardsSwiped ?? 0,
          dailyGoal: data.dailyGoal ?? 20,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Listen to real-time stats updates from other connected devices.
   */
  async subscribeToRemoteStats(
    onRemoteStats: (stats: UserStats) => void
  ): Promise<() => void> {
    let instances = getFirebaseInstances();
    if (!instances.db) {
      await initFirebase();
      instances = getFirebaseInstances();
    }

    if (!instances.db) return () => {};

    const uid = await this.getSyncUserId();
    const statsRef = doc(instances.db, 'users', uid, 'session', 'stats');

    try {
      this.unsubscribeStats = onSnapshot(
        statsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            onRemoteStats({
              streak: data.streak ?? 1,
              lastActiveDate: data.lastActiveDate ?? new Date().toISOString().split('T')[0],
              totalCardsSwiped: data.totalCardsSwiped ?? 0,
              dailyGoal: data.dailyGoal ?? 20,
            });
          }
        },
        () => {
          // Gracefully ignore offline warnings
        }
      );
    } catch {
      return () => {};
    }

    return () => {
      if (this.unsubscribeStats) {
        this.unsubscribeStats();
      }
    };
  }

  /**
   * Syncs the exact deck position so mobile resumes from the same card.
   * e.g., After swiping 13 cards on Web, currentIndex = 13 is saved to cloud.
   */
  async syncDeckProgress(currentIndex: number, completedTodayCount: number): Promise<void> {
    let instances = getFirebaseInstances();
    if (!instances.db) {
      await initFirebase();
      instances = getFirebaseInstances();
    }
    if (!instances.db) return;

    try {
      const uid = await this.getSyncUserId();
      const progressRef = doc(instances.db, 'users', uid, 'session', 'deckProgress');

      const writePromise = setDoc(
        progressRef,
        {
          currentIndex,
          completedTodayCount,
          lastActiveDate: new Date().toISOString().split('T')[0],
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await Promise.race([
        writePromise,
        new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS)),
      ]);
      syncService.reportSyncSuccess();
    } catch {
      // Graceful offline fallback
    }
  }

  /**
   * Listen to real-time deck progress from other devices.
   */
  async subscribeToRemoteProgress(
    onRemoteProgress: (progress: RemoteDeckProgress) => void
  ): Promise<() => void> {
    let instances = getFirebaseInstances();
    if (!instances.db) {
      await initFirebase();
      instances = getFirebaseInstances();
    }

    if (!instances.db) return () => {};

    const uid = await this.getSyncUserId();
    const progressRef = doc(instances.db, 'users', uid, 'session', 'deckProgress');

    try {
      this.unsubscribeProgress = onSnapshot(
        progressRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as RemoteDeckProgress;
            onRemoteProgress(data);
          }
        },
        () => {
          // Gracefully ignore offline warnings
        }
      );
    } catch {
      return () => {};
    }

    return () => {
      if (this.unsubscribeProgress) {
        this.unsubscribeProgress();
      }
    };
  }

  /**
   * Push an updated Word card to Firestore with field-level merge.
   */
  async syncWord(word: Word): Promise<void> {
    let instances = getFirebaseInstances();
    if (!instances.db) {
      await initFirebase();
      instances = getFirebaseInstances();
    }
    if (!instances.db) return;

    try {
      const uid = await this.getSyncUserId();
      const wordRef = doc(instances.db, 'users', uid, 'words', word.id);
      const writePromise = setDoc(wordRef, { ...word, syncedToCloud: true, updatedAt: serverTimestamp() }, { merge: true });
      await Promise.race([
        writePromise,
        new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS)),
      ]);
      syncService.reportSyncSuccess();
    } catch {
      // Graceful offline fallback
    }
  }

  /**
   * Push a Sentence to Firestore.
   */
  async syncSentence(sentence: UserSentence): Promise<void> {
    let instances = getFirebaseInstances();
    if (!instances.db) {
      await initFirebase();
      instances = getFirebaseInstances();
    }
    if (!instances.db) return;

    try {
      const uid = await this.getSyncUserId();
      const sentenceRef = doc(instances.db, 'users', uid, 'sentences', sentence.id);
      const writePromise = setDoc(sentenceRef, { ...sentence, syncedToCloud: true, updatedAt: serverTimestamp() }, { merge: true });
      await Promise.race([
        writePromise,
        new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS)),
      ]);
      syncService.reportSyncSuccess();
    } catch {
      // Graceful offline fallback
    }
  }

  /**
   * Delete a Sentence from Firestore.
   */
  async deleteSentence(id: string): Promise<void> {
    let instances = getFirebaseInstances();
    if (!instances.db) {
      await initFirebase();
      instances = getFirebaseInstances();
    }
    if (!instances.db) return;

    try {
      const uid = await this.getSyncUserId();
      const sentenceRef = doc(instances.db, 'users', uid, 'sentences', id);
      const deletePromise = deleteDoc(sentenceRef);
      await Promise.race([
        deletePromise,
        new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS)),
      ]);
      syncService.reportSyncSuccess();
    } catch {
      // Graceful offline fallback
    }
  }

  /**
   * Performs a comprehensive sync round with Firebase cloud when connected.
   */
  async fullSync(localStats?: UserStats): Promise<void> {
    const instances = await initFirebase();
    if (!instances?.db) return;

    if (localStats) {
      await this.syncStats(localStats);
    }
  }
}

export const firebaseSync = new FirebaseSyncManager();
