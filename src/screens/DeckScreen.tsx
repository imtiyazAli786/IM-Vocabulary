/**
 * Deck Screen — The Primary Learning Experience
 * Shows the swipeable flashcard deck with category filtering, progress tracking, and undo capability.
 * Dynamically themed for Classic Indigo and Sunset Energy.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Word, SwipeDirection } from '../features/words/types';
import { StorageRepository, UserStats } from '../core/storage/storageRepository';
import { calculateSM2 } from '../core/utils/sm2';
import { WordCard } from '../components/WordCard';
import { EmptyDeckView } from '../components/EmptyDeckView';
import { SyncStatusChip } from '../components/SyncStatusChip';
import { AddWordModal } from '../components/AddWordModal';
import { firebaseSync } from '../core/sync/firebaseSyncService';
import { Typography, Spacing, ThemeColors } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../core/utils/haptics';
import { stopSpeech } from '../core/utils/speech';

type DeckCategory = 'all' | 'pronouns' | 'homophones' | 'confused_words' | 'collocations' | 'affixes' | 'phrasal_verbs' | 'connectors' | 'verb_forms';

export function DeckScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [deck, setDeck] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<DeckCategory>('all');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSwiped, setLastSwiped] = useState<{ word: Word; prevSM2: any; direction: SwipeDirection } | null>(null);
  const [isAddWordVisible, setIsAddWordVisible] = useState(false);
  const [completedToday, setCompletedToday] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [dueWords, userStats] = await Promise.all([
        StorageRepository.getDueWords(),
        StorageRepository.getStats(),
      ]);
      setDeck(dueWords);
      setStats(userStats);
      setCurrentIndex(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to remote real-time deck progress (resuming where you left off on other devices)
    let unsubscribeRemote: (() => void) | null = null;
    firebaseSync.subscribeToRemoteProgress((remote) => {
      if (typeof remote.currentIndex === 'number' && remote.currentIndex >= 0) {
        setCurrentIndex((prev) => Math.max(prev, remote.currentIndex));
        if (typeof remote.completedTodayCount === 'number') {
          setCompletedToday((prev) => Math.max(prev, remote.completedTodayCount));
        }
      }
    }).then((unsub) => {
      unsubscribeRemote = unsub;
    });

    const unsubStorage = StorageRepository.subscribe(() => {
      StorageRepository.getStats().then(setStats);
    });

    return () => {
      unsubStorage();
      if (unsubscribeRemote) unsubscribeRemote();
      stopSpeech();
    };
  }, [loadData]);

  const filteredDeck = useMemo(() => {
    if (selectedCategory === 'all') return deck;
    if (selectedCategory === 'pronouns') {
      return deck.filter((w) => w.category === 'Pronouns');
    }
    if (selectedCategory === 'homophones') {
      return deck.filter((w) => w.category === 'Homophones');
    }
    if (selectedCategory === 'confused_words') {
      return deck.filter((w) => w.category === 'Confused Words');
    }
    if (selectedCategory === 'collocations') {
      return deck.filter(
        (w) =>
          w.category === 'Collocations & Phrases' ||
          w.partOfSpeech === 'collocation' ||
          w.partOfSpeech === 'prepositional verb'
      );
    }
    if (selectedCategory === 'affixes') {
      return deck.filter((w) => w.category === 'Prefixes & Suffixes');
    }
    if (selectedCategory === 'phrasal_verbs') {
      return deck.filter((w) => w.category === 'Phrasal Verbs' || w.partOfSpeech === 'phrasal verb');
    }
    if (selectedCategory === 'connectors') {
      return deck.filter((w) => w.category === 'Connectors & Phrases');
    }
    if (selectedCategory === 'verb_forms') {
      return deck.filter((w) => w.category === 'Forms of Verbs');
    }
    return deck;
  }, [deck, selectedCategory]);

  const handleSelectCategory = (cat: DeckCategory) => {
    triggerLightHaptic();
    setSelectedCategory(cat);
    setCurrentIndex(0);
    setLastSwiped(null);
  };

  const handleSwipe = async (direction: SwipeDirection) => {
    if (currentIndex >= filteredDeck.length) return;

    const currentWord = filteredDeck[currentIndex];
    const prevSM2 = {
      repetitions: currentWord.repetitions,
      intervalDays: currentWord.intervalDays,
      easinessFactor: currentWord.easinessFactor,
      nextReviewAt: currentWord.nextReviewAt,
    };

    setLastSwiped({ word: currentWord, prevSM2, direction });

    const quality = direction === 'up' ? 5 : 2;
    const sm2Update = calculateSM2(
      {
        repetitions: currentWord.repetitions,
        easinessFactor: currentWord.easinessFactor,
        intervalDays: currentWord.intervalDays,
      },
      quality
    );

    const updatedWord: Word = {
      ...currentWord,
      repetitions: sm2Update.repetitions,
      intervalDays: sm2Update.intervalDays,
      easinessFactor: sm2Update.easinessFactor,
      nextReviewAt: sm2Update.nextReviewAt,
      syncedToCloud: false,
    };

    await StorageRepository.updateWord(updatedWord);
    await StorageRepository.recordCardSwipe();

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    const newCompleted = completedToday + 1;
    setCompletedToday(newCompleted);

    firebaseSync.syncDeckProgress(newIndex, newCompleted);

    if (direction === 'down') {
      setDeck((prev) => [...prev, updatedWord]);
    }
  };

  const handleUndo = async () => {
    if (!lastSwiped || currentIndex === 0) return;
    triggerLightHaptic();

    const { word, prevSM2, direction } = lastSwiped;
    const revertedWord: Word = {
      ...word,
      repetitions: prevSM2.repetitions,
      intervalDays: prevSM2.intervalDays,
      easinessFactor: prevSM2.easinessFactor,
      nextReviewAt: prevSM2.nextReviewAt,
      syncedToCloud: false,
    };

    await StorageRepository.updateWord(revertedWord);

    if (direction === 'down') {
      setDeck((prev) => {
        const copy = [...prev];
        const lastIdx = copy.map((w) => w.id).lastIndexOf(revertedWord.id);
        if (lastIdx > currentIndex - 1) {
          copy.splice(lastIdx, 1);
        }
        return copy;
      });
    }

    const newIndex = Math.max(0, currentIndex - 1);
    setCurrentIndex(newIndex);
    setLastSwiped(null);

    firebaseSync.syncDeckProgress(newIndex, Math.max(0, completedToday - 1));
  };

  const handleToggleFavourite = async (id: string) => {
    await StorageRepository.toggleFavourite(id);
    setDeck((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isFavourite: !w.isFavourite } : w))
    );
  };

  const activeCard = filteredDeck[currentIndex];
  const nextCard = filteredDeck[currentIndex + 1];
  const isDeckFinished = currentIndex >= filteredDeck.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appTitle}>LexiCard</Text>
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{stats?.streak ?? 1}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <SyncStatusChip />
          <TouchableOpacity
            style={styles.addWordButton}
            onPress={() => {
              triggerLightHaptic();
              setIsAddWordVisible(true);
            }}
          >
            <Ionicons name="add" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Horizontal Filter Row */}
      <View style={styles.categoryRowContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {(
            [
              { key: 'all', label: `All (${deck.length})` },
              { key: 'phrasal_verbs', label: 'Phrasal Verbs' },
              { key: 'collocations', label: 'Collocations' },
              { key: 'confused_words', label: 'Confused Words' },
              { key: 'homophones', label: 'Homophones' },
              { key: 'affixes', label: 'Prefix & Suffix' },
              { key: 'pronouns', label: 'Pronouns' },
              { key: 'connectors', label: 'Connectors' },
              { key: 'verb_forms', label: 'Verb Forms' },
            ] as const
          ).map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => handleSelectCategory(cat.key)}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Flashcard Body */}
      <View style={styles.body}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : isDeckFinished || !activeCard ? (
          <EmptyDeckView
            onReviewAll={async () => {
              const all = await StorageRepository.getWords();
              setDeck(all);
              setCurrentIndex(0);
              setSelectedCategory('all');
            }}
            onAddNewWord={() => setIsAddWordVisible(true)}
            completedTodayCount={completedToday}
          />
        ) : (
          <View style={styles.deckStack}>
            {/* Background Ghost Card */}
            {nextCard ? (
              <View style={styles.ghostCard} pointerEvents="none">
                <WordCard
                  key={nextCard.id}
                  word={nextCard}
                  onSwipe={() => {}}
                  onToggleFavourite={() => {}}
                  isTopCard={false}
                />
              </View>
            ) : null}

            {/* Active Card */}
            <WordCard
              key={activeCard.id}
              word={activeCard}
              onSwipe={handleSwipe}
              onToggleFavourite={handleToggleFavourite}
              isTopCard={true}
            />
          </View>
        )}
      </View>

      {/* Bottom Footer Row */}
      {!isDeckFinished && filteredDeck.length > 0 ? (
        <View style={styles.footerRow}>
          <View style={styles.counterBox}>
            <Text style={styles.counterText}>
              Card {currentIndex + 1} of {filteredDeck.length}
            </Text>
          </View>

          {lastSwiped ? (
            <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
              <Ionicons name="arrow-undo-outline" size={16} color={colors.accent} />
              <Text style={styles.undoText}>Undo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Add Word Modal */}
      <AddWordModal
        visible={isAddWordVisible}
        onClose={() => setIsAddWordVisible(false)}
        onWordAdded={() => {
          loadData();
          triggerSuccessHaptic();
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      backgroundColor: colors.cardSurface,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    appTitle: {
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.heavy,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 50,
      gap: 3,
      borderWidth: 1,
      borderColor: '#FDE68A',
    },
    streakEmoji: {
      fontSize: 12,
    },
    streakText: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.bold,
      color: '#92400E',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    addWordButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    categoryRowContainer: {
      paddingVertical: Spacing.sm,
    },
    categoryRow: {
      paddingHorizontal: Spacing.lg,
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 50,
      backgroundColor: colors.chipSurface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    categoryChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accentDark,
    },
    categoryChipText: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.medium,
      color: colors.textSecondary,
    },
    categoryChipTextActive: {
      color: colors.textWhite,
      fontWeight: Typography.weight.bold,
    },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
    },
    deckStack: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    ghostCard: {
      position: 'absolute',
      top: 10,
      opacity: 0.3,
      transform: [{ scale: 0.94 }],
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      minHeight: 48,
    },
    counterBox: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    counterText: {
      fontSize: Typography.size.xs,
      color: colors.accent,
      fontWeight: Typography.weight.bold,
    },
    undoButton: {
      position: 'absolute',
      right: Spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentLight,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 50,
      gap: 5,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    undoText: {
      fontSize: Typography.size.xs,
      color: colors.accent,
      fontWeight: Typography.weight.bold,
    },
  });
