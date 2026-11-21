/**
 * Firebase Initialization & Configuration
 * Supports default project 'im-vocabulary-app', environment variables, or in-app custom configuration.
 * Cross-platform across Web, iOS, and Android.
 * Fully offline-first: never crashes when network is unavailable.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, signInAnonymously } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIREBASE_CONFIG_KEY = '@lexicard_firebase_config_v1';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

// Official hosted Firebase project configuration
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigOptions = {
  projectId: 'im-vocabulary-app',
  appId: '1:672213294507:web:5499aaed1ecb9434a146ee',
  storageBucket: 'im-vocabulary-app.firebasestorage.app',
  apiKey: 'AIzaSyAI51CyQ7V1ThPdjOleIKpk0_IuOeoDlZw',
  authDomain: 'im-vocabulary-app.firebaseapp.com',
  messagingSenderId: '672213294507',
};

export async function isFirebaseConfigured(): Promise<boolean> {
  const config = await getSavedFirebaseConfig();
  return Boolean(config && config.apiKey && config.projectId);
}

export async function getSavedFirebaseConfig(): Promise<FirebaseConfigOptions | null> {
  try {
    const raw = await AsyncStorage.getItem(FIREBASE_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }

  // Check process.env defaults
  if (process.env.EXPO_PUBLIC_FIREBASE_API_KEY && process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) {
    return {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
    };
  }

  // Default to the user's hosted Firebase app
  return DEFAULT_FIREBASE_CONFIG;
}

export async function saveFirebaseConfig(config: FirebaseConfigOptions): Promise<void> {
  await AsyncStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
  // Re-initialize
  await initFirebase(config);
}

export async function initFirebase(customConfig?: FirebaseConfigOptions): Promise<{ app: FirebaseApp; db: Firestore; auth: Auth } | null> {
  const config = customConfig || (await getSavedFirebaseConfig());
  if (!config || !config.apiKey || !config.projectId) {
    return null;
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }

    db = getFirestore(app);
    auth = getAuth(app);

    // Auto sign-in anonymously if not signed in (offline-safe)
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    } catch {
      // Silently ignore offline auth errors
    }

    return { app, db, auth };
  } catch (err) {
    // Graceful offline handling
    return null;
  }
}

export function getFirebaseInstances() {
  return { app, db, auth };
}
