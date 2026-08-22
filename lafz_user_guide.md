# 📖 Lafz (لفظ) User Guide & Feature Manual

Welcome to **Lafz**, your personal vocabulary manager, language trainer, and fluency building application. Lafz is designed to help you collect vocabulary words, practice Urdu-to-English translations, build sentence structures, and master grammar through dynamic AI coaching.

---

## 🚀 1. Core Features & How They Work

### 📥 1. Smart Vocabulary Import & Backup Scanner
Lafz includes a bulk import page that allows you to easily ingest thousands of vocabulary entries from backup files or documents.
*   **Gemini AI Parsing**: When you upload a text or Word (`.docx`) document, Gemini reads the text, extracts the vocabulary words, translates them to Urdu, writes English definitions and example sentences, and automatically categorizes them into types: `word`, `phrase`, `connector`, `idiom`, or `tense_pattern`.
*   **Local Backups Scanning**: Instantly scans your local CSV backups (`vocabulary_backup.csv`, etc.) in the project directories to restore previously collected words.
*   **Review Panel**: Before committing to your database, you can review, select/deselect, and verify entries.

### 📖 2. Minimalist Vocabulary Library
Your main vocabulary library lists all the words, phrases, and idioms you've collected.
*   **Minimalist Cards**: Cards are rendered in a clean, single-line format showing the word, type, part of speech, translation, synonyms, and antonyms.
*   **Direct Click-to-Detail**: Clicking anywhere on a card opens its dedicated detailed page to keep your workspace simple and fast.
*   **Search**: A live search bar filters through English words, Urdu translations, and English definitions instantly.

### 📝 3. AI Sentence Practice Workshop
Transition from passive recognition to active production by writing sentences with your words.
*   **AI Grammar Check**: Input a custom English sentence using the target word. Gemini evaluates it specifically for errors common to Urdu/Hindi speakers:
    *   Subject-verb agreement
    *   Missing articles (`a`, `an`, `the`)
    *   Tense disagreements
    *   Preposition mistakes
    *   Literal translation patterns
*   **Visual Color-Coded Corrections**: Highlights exact parts of the sentence that are incorrect, explains the grammar rule, and provides native, natural alternatives.
*   **Spaced Repetition Integration (SRS)**: When you finish your attempt, you can rate it (*Got it Right*, *Accepted Fix*, or *Study Again*). The app uses a modified SuperMemo (SM-2) algorithm to recalculate the word's review interval and schedule when it next shows up.
*   **Practice Queue**: The `/practice` route aggregates up to 10 words (prioritizing due words first, with recent words as fallback) for structured writing sessions.

### 🔊 4. Text-to-Speech (TTS) Pronunciation
Integrated browser-native TTS allows you to hear the correct rhythm and pronunciation of English.
*   Listen to individual vocabulary words.
*   Hear example sentences read aloud.
*   Listen to correct grammar rewrites in the sentence workshop.

### 🏆 5. Daily Vocabulary Quiz
Test your vocabulary recall in an interactive 10-question quiz.
*   **Dynamic Questions**: Automatically builds multiple-choice questions from your library:
    *   *English to Urdu* (Select the correct translation)
    *   *Urdu to English* (Select the correct word)
    *   *Sentence Fill-in-the-blank* (Select the correct word to complete the example sentence)
*   **Distractor Generation**: Automatically picks other words in your library as incorrect options to keep quizzes challenging.

### 🎓 6. Grammar Tense Trainer
A dedicated module at `/grammar` to practice structure and tense speed independently of your vocabulary words.
*   **Tense Identification**: Given a sentence, select its correct tense (e.g. Present Perfect, Past Continuous) from 4 options.
*   **Tense Transformation**: Open-ended exercise to rewrite a sentence in a different tense (e.g. converting a past tense sentence to future perfect).
*   **Fill in the Blanks**: Verb conjugation practice by typing the correct form of the verb in parentheses.
*   **Spot the Error**: Sentence correction challenge to fix a grammatical error.
*   **Mixed Challenge**: A randomized test combining all 4 types.

### 📊 7. Stats, Streaks, & Gamification
*   **Streak Tracking**: Tracks consecutive days studied, updating your *Current Streak* and *Longest Streak* on your profile.
*   **Daily XP**: Earn +10 XP for every correct answer in the Grammar Tense Trainer, showing your daily growth.

---

## 🔑 2. How to Set Up & Run the App Locally

### 1. Configure Your API Keys (`.env`)
Make sure your [.env](file:///Users/imtiyazali/Documents/01_PERSONAL/WebApplications/lafz-main/.env) file is set up with the correct Supabase credentials and your Google Gemini key:
```env
# Supabase credentials (connected to your project devkmlyxrahksxygsgca)
SUPABASE_URL="https://devkmlyxrahksxygsgca.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."

VITE_SUPABASE_URL="https://devkmlyxrahksxygsgca.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."

# Get your API key from https://aistudio.google.com/
GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_KEY"
```

### 2. Push Database Schema
If tables are not set up on your project yet, run the Supabase push command:
```bash
cd /Users/imtiyazali/Documents/01_PERSONAL/WebApplications/lafz-main
npx supabase db push
```
*(Alternatively, you can copy the SQL contents of the migrations inside `supabase/migrations/` and execute them directly in the SQL Editor on your Supabase web dashboard).*

### 3. Start the Development Server
```bash
cd /Users/imtiyazali/Documents/01_PERSONAL/WebApplications/lafz-main
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 📱 3. Step-by-Step Usage Guide

### How to Import Your Backups
1.  Log in at `http://localhost:8080/login`.
2.  Click **Words** in the bottom navigation, then click the **Import** button in the header.
3.  Choose **Scan backups** to load local CSV files, or select a document (`.docx` / `.txt`) to let Gemini extract words.
4.  Check/uncheck entries on the list and click **Import Selected** to add them to your library.

### How to Practice Sentence Structure
1.  Go to the **Practice** tab (`/practice`).
2.  Type an English sentence utilizing the target word.
3.  Click **Verify with Grammar AI** to inspect errors and view corrected phrasing.
4.  Listen to correct phrasing by clicking the **Volume 🔊** icon.
5.  Select a rating (*Got it Right*, *Accepted Fix*, *Study Again*) to update your spaced repetition database statistics and load the next word.

### How to Practice Grammar Drills
1.  Go to the **Grammar** tab (`/grammar`).
2.  Select a mode (e.g., **Fill in the Blanks** or **Mixed Challenge**).
3.  Input or select your answer, then click **Verify Answer**.
4.  Review the explanation, correct grammar rule, and earn daily XP!
