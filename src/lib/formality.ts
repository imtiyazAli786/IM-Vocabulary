export type PermanentCategory = 'daily-life' | 'workplace' | 'news-reading';

export interface FormalitySpectrumData {
  category: PermanentCategory;
  formal: string;
  neutral: string;
  informal: string;
}

export const CATEGORY_CONFIG: Record<
  PermanentCategory,
  {
    tag: string;
    label: string;
    shortLabel: string;
    description: string;
    colorBadge: string;
    colorBorder: string;
    colorBg: string;
    colorText: string;
    colorActivePill: string;
    icon: string;
  }
> = {
  'daily-life': {
    tag: 'daily-life',
    label: '🏠 Daily Life (Home, Friends, Shows)',
    shortLabel: '🏠 Daily Life',
    description: 'Home, family conversations, friends, reality shows & casual slang',
    colorBadge: 'bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60 font-medium',
    colorBorder: 'border-purple-200',
    colorBg: 'bg-purple-50/50',
    colorText: 'text-purple-800 dark:text-purple-300',
    colorActivePill: 'bg-purple-100 text-purple-900 border-purple-300 shadow-xs ring-1 ring-purple-400/20 font-semibold dark:bg-purple-900/50 dark:text-purple-100 dark:border-purple-700',
    icon: '🏠',
  },
  workplace: {
    tag: 'workplace',
    label: '💼 Workplace (Office, Meetings, Emails)',
    shortLabel: '💼 Workplace',
    description: 'Office environment, professional discussions, emails & meetings',
    colorBadge: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 font-medium',
    colorBorder: 'border-emerald-200',
    colorBg: 'bg-emerald-50/50',
    colorText: 'text-emerald-800 dark:text-emerald-300',
    colorActivePill: 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-xs ring-1 ring-emerald-400/20 font-semibold dark:bg-emerald-900/50 dark:text-emerald-100 dark:border-emerald-700',
    icon: '💼',
  },
  'news-reading': {
    tag: 'news-reading',
    label: '📰 News Reading (Articles, Editorials)',
    shortLabel: '📰 News Reading',
    description: 'Newspaper articles, formal writing, serious essays & editorials',
    colorBadge: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60 font-medium',
    colorBorder: 'border-sky-200',
    colorBg: 'bg-sky-50/50',
    colorText: 'text-sky-800 dark:text-sky-300',
    colorActivePill: 'bg-sky-100 text-sky-900 border-sky-300 shadow-xs ring-1 ring-sky-400/20 font-semibold dark:bg-sky-900/50 dark:text-sky-100 dark:border-sky-700',
    icon: '📰',
  },
};

// Aliases for backwards compatibility
export const REGISTER_CONFIG = {
  informal: CATEGORY_CONFIG['daily-life'],
  neutral: CATEGORY_CONFIG['workplace'],
  formal: CATEGORY_CONFIG['news-reading'],
  'daily-life': CATEGORY_CONFIG['daily-life'],
  workplace: CATEGORY_CONFIG['workplace'],
  'news-reading': CATEGORY_CONFIG['news-reading'],
};

export type FormalityRegister = 'formal' | 'neutral' | 'informal' | 'daily-life' | 'workplace' | 'news-reading';

export function normalizeCategory(cat: string | undefined): PermanentCategory {
  if (!cat) return 'daily-life';
  const clean = cat.toLowerCase().trim();
  if (
    clean.includes('news') ||
    clean.includes('article') ||
    clean.includes('formal') ||
    clean.includes('editorial') ||
    clean.includes('academic')
  ) {
    return 'news-reading';
  }
  if (
    clean.includes('work') ||
    clean.includes('office') ||
    clean.includes('neutral') ||
    clean.includes('business') ||
    clean.includes('meeting')
  ) {
    return 'workplace';
  }
  return 'daily-life';
}

/**
 * Parses category & formality spectrum metadata from notes, tags, or fields.
 */
export function extractFormalitySpectrum(wordObj: {
  word?: string;
  tags?: string[] | null;
  notes?: string | null;
  synonym?: string | null;
  one_word_en?: string | null;
}): FormalitySpectrumData & { register: PermanentCategory } {
  const headword = wordObj.word?.trim() || '';
  const tags = Array.isArray(wordObj.tags) ? wordObj.tags.map((t) => t.toLowerCase().trim()) : [];

  // Try parsing JSON embedded in notes
  if (wordObj.notes) {
    try {
      const match = wordObj.notes.match(/\{[\s\S]*"(category|register)"[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const cat = normalizeCategory(parsed.category || parsed.register);
        return {
          category: cat,
          register: cat,
          formal: parsed.formal || (cat === 'news-reading' ? headword : ''),
          neutral: parsed.neutral || (cat === 'workplace' ? headword : ''),
          informal: parsed.informal || (cat === 'daily-life' ? headword : ''),
        };
      }
    } catch {}
  }

  // Detect from tags
  let detectedCategory: PermanentCategory = 'daily-life';
  if (tags.some((t) => ['news-reading', 'news', 'formal', 'newspaper', 'academic', 'article'].includes(t))) {
    detectedCategory = 'news-reading';
  } else if (tags.some((t) => ['workplace', 'work', 'office', 'neutral', 'meeting', 'business'].includes(t))) {
    detectedCategory = 'workplace';
  } else if (tags.some((t) => ['daily-life', 'daily', 'informal', 'spoken', 'home', 'friends', 'shows', 'slang', 'casual'].includes(t))) {
    detectedCategory = 'daily-life';
  } else {
    // Heuristic detection
    if (headword.includes(' ') || /^(put|get|give|take|look|call|set|turn|break|make|keep|hang|chill|mess)\s/i.test(headword)) {
      detectedCategory = 'daily-life';
    } else if (/(tion|ity|ment|ence|ance|ous|ate)$/i.test(headword) || headword.length > 9) {
      detectedCategory = 'news-reading';
    } else {
      detectedCategory = 'workplace';
    }
  }

  return {
    category: detectedCategory,
    register: detectedCategory,
    formal: detectedCategory === 'news-reading' ? headword : wordObj.synonym || '',
    neutral: detectedCategory === 'workplace' ? headword : wordObj.one_word_en || '',
    informal: detectedCategory === 'daily-life' ? headword : '',
  };
}

/**
 * Strips internal JSON metadata from user notes so only real human notes are displayed.
 */
export function cleanUserNotes(notes?: string | null): string {
  if (!notes) return '';
  const cleaned = notes.replace(/\{[\s\S]*?"(category|register)"[\s\S]*?\}/g, '').trim();
  return cleaned;
}

