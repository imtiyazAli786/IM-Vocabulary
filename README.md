# LexiCard (IM-VOCABULARY) — v1.0.0

A high-performance, minimalist vocabulary learning application built with **React Native**, **Expo SDK 58**, and **TypeScript**. Designed for rapid English-Urdu vocabulary mastery through interactive spaced repetition flashcards.

![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-green)
![License](https://img.shields.io/badge/License-MIT-purple)
![Offline](https://img.shields.io/badge/Architecture-Local--First-orange)

---

## ✨ Features

### 📇 1. Smart Flashcard Practice (Cards)
- **1,245+ Preloaded Words & Phrases**: Phrasal verbs, collocations, homophones, confused words, affixes, connectors, and verb forms.
- **Urdu Translations & Context**: Clear English pronunciations, contextual sentences, and authentic Nastaliq Urdu translations.
- **Spaced Repetition (SM-2 Algorithm)**:
  - **Swipe UP**: Marked as Known / Mastered (interval increases).
  - **Swipe DOWN**: Review Later (re-queued in the active deck).
  - **Tap to Flip**: 3D flip revealing context, usage examples, and repetition stats.
- **Instant Undo**: Accidentally swiped a card? One tap reverts both the card and the SM-2 interval.

### 💬 2. Sentence Notebook & WH-Questions Practice (Sentences)
- **48 Preloaded WH-Questions**: WH-questions in the Simple Present tense with grammar formula guides (`WH-word + do/does + subject + base verb?`).
- **Dual Modes**:
  - **Practice Mode**: Swipeable flashcard deck for mastering full English sentence structures.
  - **Notebook Mode**: Complete scrollable catalog with audio playback and quick delete.
- **Native Audio Pronunciation**: Crystal-clear offline-friendly speech playback.

### 🔍 3. Vocabulary Vault (Search)
- Instant search across English words, Urdu translations, and parts of speech.
- Filter by category, favorites, or words due for review today.

### 🎨 4. Dual-Theme Engine (Classic Indigo & Sunset Energy)
- **Classic Indigo**: Calm lavender background (`#F0F2FF`), deep indigo accents (`#4F46E5`), and rich navy Urdu script.
- **Sunset Energy**: Warm cream canvas (`#FFFBF5`), vibrant sunset orange accents (`#EA580C`), magenta category badges (`#DB2777`), and high-contrast burnt orange Urdu text.
- **One-Tap Switcher**: Change themes anytime in the Progress tab with immediate re-rendering and storage persistence.

### ☁️ 5. Local-First with Automatic Cloud Sync
- **100% Offline Capability**: Works without an internet connection using local SQLite/AsyncStorage and built-in dictionary.
- **Firebase Firestore Synchronization**: Automatically connects to hosted Firebase (`im-vocabulary-app`) whenever internet is available.
- Syncs learning streaks, card reviews, deck progress, and custom additions across Android, iOS, and Web.

### 📳 6. Customization & Settings (Progress)
- Daily streak tracker and retention mastery metrics.
- In-app toggle for gesture haptic vibration.
- Configurable Gemini API key for dynamic AI enrichment, with offline dictionary fallback.

---

## 🛠️ Tech Stack

- **Framework**: Expo SDK 58 (React Native 0.88, React 19)
- **Language**: TypeScript (Strict Mode)
- **Navigation**: State-driven navigation with safe-area insets
- **Storage**: `@react-native-async-storage/async-storage`
- **Cloud & Hosting**: Firebase Firestore & Firebase Hosting
- **Algorithms**: SuperMemo SM-2 Spaced Repetition
- **Audio & Haptics**: `expo-speech`, `expo-haptics`

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or bun

### Installation
```bash
git clone https://github.com/imtiyazAli786/IM-Vocabulary.git
cd IM-Vocabulary
npm install
```

### Running Locally
```bash
# Run web preview
npm run web

# Run on Android (emulator or connected device)
npm run android

# Typecheck and test
npm run typecheck
npm test
```

### Production Build
```bash
# Web Export
npm run build:web

# Android Release APK (standalone offline build)
cd android && ./gradlew assembleRelease
```

---

## 📦 Download Android APK
Pre-built release APK is available under [Releases](https://github.com/imtiyazAli786/IM-Vocabulary/releases/tag/v1.0.0).

---

## 📄 License
MIT License. Created by [Imtiyaz Ali](https://github.com/imtiyazAli786).
