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
    icon: string;
  }
> = {
  'daily-life': {
    tag: 'daily-life',
    label: '🏠 Daily Life (Home, Friends, Shows)',
    shortLabel: '🏠 Daily Life',
    description: 'Home, family conversations, friends, reality shows & casual slang',
    colorBadge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
    colorBorder: 'border-purple-500/40',
    colorBg: 'bg-purple-500/5',
    colorText: 'text-purple-700 dark:text-purple-300',
    icon: '🏠',
  },
  workplace: {
    tag: 'workplace',
    label: '💼 Workplace (Office, Meetings, Emails)',
    shortLabel: '💼 Workplace',
    description: 'Office environment, professional discussions, emails & meetings',
    colorBadge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    colorBorder: 'border-emerald-500/40',
    colorBg: 'bg-emerald-500/5',
    colorText: 'text-emerald-700 dark:text-emerald-300',
    icon: '💼',
  },
  'news-reading': {
    tag: 'news-reading',
    label: '📰 News Reading (Articles, Editorials)',
    shortLabel: '📰 News Reading',
    description: 'Newspaper articles, formal writing, serious essays & editorials',
    colorBadge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    colorBorder: 'border-sky-500/40',
    colorBg: 'bg-sky-500/5',
    colorText: 'text-sky-700 dark:text-sky-300',
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

