# LexiCard — Architecture & Engineering Guide
### *Self-Contained · LLM-Agnostic · Zero-Break Stability*

---

## 1. Architectural Philosophy

LexiCard is built with **strict feature-isolation** and **layer decoupling** so that:
1. Any AI assistant or developer can add or modify features **without breaking existing functionality**.
2. Switching between AI models (Gemini, Claude, OpenAI, DeepSeek, local LLMs) takes **1 single line change** in `aiFactory.ts`.
3. All UI operates on clean domain interfaces rather than raw SDK calls or network requests.
4. The app is **offline-first**: every action is saved immediately to local storage and asynchronously synced.

---

## 2. Directory Structure

```
├── ARCHITECTURE.md           # This document — read before any modification
├── DESIGN_SYSTEM.md          # UI/UX design tokens and constraints
├── src/
│   ├── core/                 # Shared cross-cutting domain logic
│   │   ├── ai/               # Pluggable AI Service abstraction
│   │   │   ├── aiService.ts  # The abstract interface & data contracts
│   │   │   ├── geminiService.ts # Google Gemini implementation
│   │   │   ├── mockAIService.ts # Instant offline fallback/testing service
│   │   │   └── aiFactory.ts  # Factory provider (switch models here)
│   │   ├── storage/          # Local persistence (AsyncStorage / SQLite)
│   │   │   └── storageRepository.ts # Domain repository for words & sentences
│   │   ├── sync/             # Real-time cloud sync engine
│   │   │   └── syncService.ts # Local-to-cloud sync & conflict resolver
│   │   ├── utils/
│   │   │   ├── sm2.ts        # Pure SM-2 spaced repetition algorithm
│   │   │   ├── speech.ts     # Platform-safe TTS pronunciation
│   │   │   └── haptics.ts    # Tactile feedback wrapper
│   │   └── theme/
│   │       └── tokens.ts     # Design system colors, fonts, spacing
│   │
│   ├── features/
│   │   ├── words/            # Vocabulary cards & review deck
│   │   │   ├── types.ts      # Word data models
│   │   │   └── useWordDeck.ts# Deck state & swipe handler
│   │   └── sentences/        # Custom sentence translation
│   │       ├── types.ts      # Sentence data models
│   │       └── useSentences.ts
│   │
│   └── components/           # Reusable minimal UI components
│       ├── WordCard.tsx      # Vertical swiper card with flip animation
│       ├── WordCardFront.tsx # Word, POS, Audio, Urdu hint
│       ├── WordCardBack.tsx  # Detailed translation, meaning, sentence
│       ├── SwipeGlowOverlay.tsx # Visual feedback on drag (Up=Green, Down=Amber)
│       ├── SyncStatusChip.tsx# Real-time sync indicator
│       ├── BottomTabBar.tsx  # Minimal 4-tab bar (Cards, Sentences, Search, Stats)
│       ├── AddWordModal.tsx  # Fast word entry with instant AI preview
│       ├── AddSentenceModal.tsx
│       └── EmptyDeckView.tsx # "All caught up" milestone view
```

---

## 3. The Anti-Break Rules (CRITICAL FOR ALL AI AGENTS)

Whenever making a change or adding a feature, you **MUST** follow these 6 Golden Rules:

### Rule 1: Never Call AI Directly from UI
- **Forbidden**: `fetch('https://generativelanguage.googleapis.com/...')` inside a React component.
- **Required**: Use `getAIService().enrichWord(word)` via `aiFactory.ts`.

### Rule 2: Never Modify Existing Model Fields Without Backwards Compatibility
- If you add a field to `Word` (e.g., `etymology`), make it **optional** (`etymology?: string`).
- Existing local databases with saved words will continue to load without runtime schema crashes.

### Rule 3: Maintain SM-2 as Pure Logic
- `src/core/utils/sm2.ts` has zero dependencies on React or React Native.
- It is a pure mathematical function: `(card, quality) => newCardState`. It has 100% test coverage.

### Rule 4: Local Storage is Source of Truth
- UI updates are **instantaneous** (optimistic).
- Writes hit local storage first, then queue for cloud sync.
- A network drop never prevents a user from swiping cards or reading their saved words.

### Rule 5: Keep Urdu Script Legible (RTL & Line Height)
- Urdu uses the Nastaliq script which requires **1.8x - 2.2x line-height** and **right-to-left (RTL)** alignment.
- Never wrap Urdu text in fixed-height small boxes that clip calligraphic ascenders/descenders.

### Rule 6: Type Safety & Compilation
- Run `npx tsc --noEmit` before declaring any task done.
- Zero TypeScript errors permitted.

---

## 4. How to Switch or Add an AI Model

1. Create a class implementing `AIService` in `src/core/ai/`:
   ```typescript
   export class ClaudeAIService implements AIService {
     async enrichWord(word: string): Promise<WordEnrichment> { ... }
     async translateSentence(sentence: string): Promise<string> { ... }
   }
   ```
2. Open `src/core/ai/aiFactory.ts` and set your active provider:
   ```typescript
   export const ACTIVE_AI_PROVIDER: AIProviderType = 'gemini'; // or 'claude', 'openai'
   ```
3. That is literally it. Zero changes to UI, state, or storage.

---

## 5. Sentence Category Extension System (For Future Grammar Additions)

The sentence learning module is architected with a decoupled category and grammar rule system:
- Categories are defined in [`src/features/sentences/types.ts`](file:///Users/imtiyazali/Documents/AI/MyApps/IM-VOCABULARY/src/features/sentences/types.ts) (`SENTENCE_CATEGORIES`).
- Each category entry specifies:
  - `id`: Unique slug (e.g. `'simple-present-wh'`, `'past-tense'`, `'future-tense'`, `'modals'`, `'passive-voice'`)
  - `title`: Display label on the category chip
  - `category`: Top-level grammar classification (e.g. `'Simple Present'`, `'Past Tense'`)
  - `subCategory`: Optional sub-grouping (e.g. `'WH-Questions'`)
  - `formula`: Active grammar pattern banner (e.g. `'WH-word + do/does + subject + base verb?'`)
  - `ruleSummary`: Usage rule guide (e.g. `'Use do with I, you, we, they • Use does with he, she, it'`)
  - `icon`: Vector icon name for visual distinction

### How to Add Future Grammar Sets (Past, Future, Modals, Passive Voice):
1. Add the category definition to `SENTENCE_CATEGORIES` in `src/features/sentences/types.ts`.
2. Add your sentences to `SEED_SENTENCES` in `src/core/storage/storageRepository.ts` with matching `category`, `subCategory`, and `targetWord`.
3. The `SentencesScreen.tsx` will automatically render the new category tab, compute counts, display the grammar formula banner, and filter cards and notebook view seamlessly without breaking any existing code.

