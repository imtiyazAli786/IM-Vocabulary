# LexiCard — UI/UX Design System Specification
### *Radically Minimal · Content-First · Clean Light Mode*

---

## 1. Design Philosophy

> "The vocabulary card is the hero. Everything else recedes into the background."

- **Zero Clutter**: No walls of text. No redundant borders, badges, or noisy iconography.
- **Comfortable Light Palette**: Soft warm off-white background (`#FAFAFA`), pure white card surfaces (`#FFFFFF`), subtle border separation (`#EFEFEF`), and a single focused indigo accent (`#4F46E5`).
- **Tactile Feedback**:
  - Dragging **UP** tints the top edge in subtle Emerald Green (`#10B981`) + "Got it" indicator.
  - Dragging **DOWN** tints the bottom edge in Warm Amber (`#F59E0B`) + "Review later" indicator.
  - Tapping flips the card smoothly with a 3D perspective rotation.

---

## 2. Color Palette Tokens

```typescript
export const Palette = {
  // Backgrounds
  background: '#F8F9FA',      // Soft off-white page background
  cardSurface: '#FFFFFF',     // Pure white card body
  cardShadow: 'rgba(0, 0, 0, 0.06)',
  borderSubtle: '#EEEEEE',    // Minimal 1px hairline dividers

  // Typography
  textPrimary: '#111827',     // High-contrast near-black for English headword
  textSecondary: '#6B7280',   // Subdued gray for POS and examples
  textMuted: '#9CA3AF',       // Minor captions, dates
  textUrdu: '#3730A3',        // Deep Indigo for Urdu calligraphy (easy on eyes)

  // Accents & Actions
  accentPrimary: '#4F46E5',   // Indigo-600 — primary button / focus
  accentSubtle: '#EEF2FF',    // Indigo-50 — chip background
  
  // Feedback states
  knowItGreen: '#10B981',     // Swipe UP (Recall Success)
  knowItBg: 'rgba(16, 185, 129, 0.08)',
  laterAmber: '#F59E0B',      // Swipe DOWN (Review Later)
  laterBg: 'rgba(245, 158, 11, 0.08)',
  starredGold: '#F59E0B',     // Favourite word star

  // Sync states
  syncSuccess: '#10B981',
  syncPending: '#3B82F6',
  syncOffline: '#9CA3AF',
};
```

---

## 3. Typography & RTL Urdu Standards

1. **English Word (Hero)**:
   - Size: `34px - 38px`
   - Weight: `700` (Bold)
   - Tracking: `-0.5px`
   - Height: `1.2`

2. **Urdu Meaning**:
   - Font Family: `'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif`
   - Size: `24px - 28px`
   - Line-height: `1.9` - `2.2` (Never constrain to tight line boxes)
   - Direction: `rtl`
   - Alignment: `right` or `center` depending on card side

3. **Part of Speech**:
   - Small capsule chip: `11px - 12px`, uppercase, letter spacing `0.8px`
   - Background: `accentSubtle`, text: `accentPrimary`

4. **Example Sentence**:
   - Size: `14px - 15px`, italic, secondary gray color.

---

## 4. Spacing Scale

- `xs`: 4px
- `sm`: 8px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px
- `xxl`: 48px

---

## 5. Card Component Anatomy

```
┌──────────────────────────────────────────────┐
│  [POS CHIP]                     [🔊 LISTEN]  │  ← Top Utility Bar
│                                              │
│                                              │
│                  ephemeral                   │  ← 36px Bold Hero Word
│                                              │
│             /ɪˈfɛm.ər.əl/                    │  ← Phonetic Pronunciation
│                                              │
│  ──────────────────────────────────────────  │  ← Subtle 1px Divider
│                                              │
│                    عارضی                     │  ← Urdu Meaning
│                                              │
│                                              │
│       "Fame in the digital age is            │  ← Example Sentence
│        often ephemeral."                     │
│                                              │
│                                              │
│  [Tap card to flip]         [⭐ Save/Star]   │  ← Bottom Bar
└──────────────────────────────────────────────┘
```
