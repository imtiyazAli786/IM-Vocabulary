export type FormalityRegister = 'formal' | 'neutral' | 'informal';

export interface FormalitySpectrumData {
  register: FormalityRegister;
  formal: string;
  neutral: string;
  informal: string;
}

export const REGISTER_CONFIG: Record<
  FormalityRegister,
  {
    label: string;
    shortLabel: string;
    source: string;
    colorBadge: string;
    colorBorder: string;
    colorBg: string;
    colorText: string;
    icon: string;
  }
> = {
  formal: {
    label: '📰 Formal (Newspapers / Articles)',
    shortLabel: '📰 Formal',
    source: 'Newspapers & Editorial Articles',
    colorBadge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    colorBorder: 'border-sky-500/40',
    colorBg: 'bg-sky-500/5',
    colorText: 'text-sky-700 dark:text-sky-300',
    icon: '📰',
  },
  neutral: {
    label: '💬 Neutral (Everyday Life)',
    shortLabel: '💬 Everyday',
    source: 'Standard Daily Conversations & Work',
    colorBadge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    colorBorder: 'border-emerald-500/40',
    colorBg: 'bg-emerald-500/5',
    colorText: 'text-emerald-700 dark:text-emerald-300',
    icon: '💬',
  },
  informal: {
    label: '🎬 Informal (Reality Shows / Slang / Friends)',
    shortLabel: '🎬 Informal / Shows',
    source: 'Reality Shows, Spoken Chats & Slang',
    colorBadge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
    colorBorder: 'border-purple-500/40',
    colorBg: 'bg-purple-500/5',
    colorText: 'text-purple-700 dark:text-purple-300',
    icon: '🎬',
  },
};

/**
 * Parses formality spectrum metadata from notes, tags, or fields.
 */
export function extractFormalitySpectrum(wordObj: {
  word?: string;
  tags?: string[] | null;
  notes?: string | null;
  synonym?: string | null;
  one_word_en?: string | null;
}): FormalitySpectrumData {
  const headword = wordObj.word?.trim() || '';
  const tags = Array.isArray(wordObj.tags) ? wordObj.tags.map((t) => t.toLowerCase().trim()) : [];

  // Try parsing JSON embedded in notes
  if (wordObj.notes) {
    try {
      const match = wordObj.notes.match(/\{[\s\S]*"register"[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.register) {
          return {
            register: normalizeRegister(parsed.register),
            formal: parsed.formal || (parsed.register === 'formal' ? headword : ''),
            neutral: parsed.neutral || (parsed.register === 'neutral' ? headword : ''),
            informal: parsed.informal || (parsed.register === 'informal' ? headword : ''),
          };
        }
      }
    } catch {}
  }

  // Detect from tags
  let detectedRegister: FormalityRegister = 'neutral';
  if (tags.some((t) => t === 'formal' || t === 'academic' || t === 'newspaper' || t === 'news')) {
    detectedRegister = 'formal';
  } else if (
    tags.some(
      (t) =>
        t === 'informal' ||
        t === 'spoken' ||
        t === 'slang' ||
        t === 'idiom' ||
        t === 'phrasal' ||
        t === 'reality-shows' ||
        t === 'shows' ||
        t === 'casual'
    )
  ) {
    detectedRegister = 'informal';
  } else if (tags.some((t) => t === 'daily' || t === 'everyday' || t === 'neutral')) {
    detectedRegister = 'neutral';
  } else {
    // Heuristic detection based on phrasal verb or common suffixes
    if (headword.includes(' ') || /^(put|get|give|take|look|call|set|turn|break|make|keep)\s/i.test(headword)) {
      detectedRegister = 'informal';
    } else if (/(tion|ity|ment|ence|ance|ous|ate)$/i.test(headword) || headword.length > 9) {
      detectedRegister = 'formal';
    }
  }

  return {
    register: detectedRegister,
    formal: detectedRegister === 'formal' ? headword : wordObj.synonym || '',
    neutral: detectedRegister === 'neutral' ? headword : wordObj.one_word_en || '',
    informal: detectedRegister === 'informal' ? headword : '',
  };
}

export function normalizeRegister(reg: string | undefined): FormalityRegister {
  if (!reg) return 'neutral';
  const clean = reg.toLowerCase().trim();
  if (clean.includes('formal') && !clean.includes('informal')) return 'formal';
  if (clean.includes('informal') || clean.includes('spoken') || clean.includes('slang') || clean.includes('show')) return 'informal';
  return 'neutral';
}
