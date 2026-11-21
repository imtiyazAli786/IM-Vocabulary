/**
 * Browse & Search Screen
 * Quick search across vocabulary words with filters for Favourites and Due Today.
 * Dynamically themed for Classic Indigo and Sunset Energy.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Word } from '../features/words/types';
import { StorageRepository } from '../core/storage/storageRepository';
import { isCardDue } from '../core/utils/sm2';
import { speakEnglish, stopSpeech } from '../core/utils/speech';
import { Typography, Spacing, ThemeColors, ThemeShadows } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { triggerLightHaptic } from '../core/utils/haptics';

type FilterType = 'all' | 'pronouns' | 'homophones' | 'confused_words' | 'collocations' | 'affixes' | 'phrasal_verbs' | 'connectors' | 'verb_forms' | 'due' | 'favourites';

export function BrowseScreen() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  const [words, setWords] = useState<Word[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const loadWords = useCallback(async () => {
    const allWords = await StorageRepository.getWords();
    setWords(allWords);
  }, []);

  useEffect(() => {
    loadWords();
    const unsub = StorageRepository.subscribe(() => {
      StorageRepository.getWords().then(setWords);
    });
    return () => {
      unsub();
      stopSpeech();
    };
  }, [loadWords]);

  const filteredWords = useMemo(() => {
    let result = words;

    // Apply category filter
    if (activeFilter === 'pronouns') {
      result = result.filter((w) => w.category === 'Pronouns');
    } else if (activeFilter === 'homophones') {
      result = result.filter((w) => w.category === 'Homophones');
    } else if (activeFilter === 'confused_words') {
      result = result.filter((w) => w.category === 'Confused Words');
    } else if (activeFilter === 'collocations') {
      result = result.filter(
        (w) =>
          w.category === 'Collocations & Phrases' ||
          w.partOfSpeech === 'collocation' ||
          w.partOfSpeech === 'prepositional verb'
      );
    } else if (activeFilter === 'affixes') {
      result = result.filter((w) => w.category === 'Prefixes & Suffixes');
    } else if (activeFilter === 'phrasal_verbs') {
      result = result.filter((w) => w.category === 'Phrasal Verbs' || w.partOfSpeech === 'phrasal verb');
    } else if (activeFilter === 'connectors') {
      result = result.filter((w) => w.category === 'Connectors & Phrases');
    } else if (activeFilter === 'verb_forms') {
      result = result.filter((w) => w.category === 'Forms of Verbs');
    } else if (activeFilter === 'due') {
      result = result.filter((w) => isCardDue(w.nextReviewAt));
    } else if (activeFilter === 'favourites') {
      result = result.filter((w) => w.isFavourite);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (w) =>
          w.english.toLowerCase().includes(q) ||
          w.urduMeaning.toLowerCase().includes(q) ||
          w.partOfSpeech.toLowerCase().includes(q) ||
          (w.category && w.category.toLowerCase().includes(q))
      );
    }

    return result;
  }, [words, activeFilter, searchQuery]);

  const handleAudioPress = async (word: Word) => {
    setPlayingId(word.id);
    triggerLightHaptic();
    await speakEnglish(word.english);
    setTimeout(() => setPlayingId(null), 800);
  };

  const handleToggleFavourite = async (id: string) => {
    triggerLightHaptic();
    await StorageRepository.toggleFavourite(id);
  };

  const renderItem = ({ item }: { item: Word }) => {
    const isPlaying = playingId === item.id;
    const isDue = isCardDue(item.nextReviewAt);

    return (
      <View style={styles.wordItem}>
        <View style={styles.wordLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.englishWord}>{item.english}</Text>
            <View style={styles.posChip}>
              <Text style={styles.posText}>{item.partOfSpeech.slice(0, 4)}</Text>
            </View>
            {isDue ? (
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>DUE</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.urduText}>{item.urduMeaning}</Text>
        </View>

        <View style={styles.wordActions}>
          <TouchableOpacity
            style={[styles.actionButton, isPlaying && styles.actionButtonActive]}
            onPress={() => handleAudioPress(item)}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={18}
              color={isPlaying ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleFavourite(item.id)}
          >
            <Ionicons
              name={item.isFavourite ? 'star' : 'star-outline'}
              size={18}
              color={item.isFavourite ? colors.starGold : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const filterTabs: FilterType[] = [
    'all',
    'due',
    'favourites',
    'phrasal_verbs',
    'collocations',
    'confused_words',
    'homophones',
    'affixes',
    'pronouns',
    'connectors',
    'verb_forms',
  ];

  const labels: Record<FilterType, string> = {
    all: 'All',
    due: 'Due Today',
    favourites: 'Favorites',
    phrasal_verbs: 'Phrasal Verbs',
    collocations: 'Collocations',
    confused_words: 'Confused Words',
    homophones: 'Homophones',
    affixes: 'Prefix/Suffix',
    pronouns: 'Pronouns',
    connectors: 'Connectors',
    verb_forms: 'Verb Forms',
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Vocabulary Vault</Text>
        <Text style={styles.screenSubtitle}>Search and explore your complete word library</Text>

        {/* Search Bar Input */}
        <View style={styles.searchBarWrapper}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search in English, Urdu, or part of speech..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Horizontal Badges */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterTabs.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => {
                  triggerLightHaptic();
                  setActiveFilter(filter);
                }}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {labels[filter]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredWords}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No matching words found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search query or filter.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, shadows: ThemeShadows) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      backgroundColor: colors.cardSurface,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    screenTitle: {
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    screenSubtitle: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: Spacing.md,
    },
    searchBarWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSurface,
      borderRadius: 50,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      gap: 8,
      ...shadows.chip,
    },
    searchInput: {
      flex: 1,
      fontSize: Typography.size.sm,
      color: colors.textPrimary,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: Spacing.md,
      paddingRight: Spacing.lg,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 50,
      backgroundColor: colors.chipSurface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    filterChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accentDark,
    },
    filterText: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      fontWeight: Typography.weight.medium,
    },
    filterTextActive: {
      color: colors.textWhite,
      fontWeight: Typography.weight.bold,
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xxl,
      gap: Spacing.sm,
    },
    wordItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cardSurface,
      padding: Spacing.md,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.chip,
    },
    wordLeft: {
      flex: 1,
      marginRight: Spacing.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    englishWord: {
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    posChip: {
      backgroundColor: colors.categoryBadgeBg,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    posText: {
      fontSize: 9,
      color: colors.categoryBadgeText,
      fontWeight: Typography.weight.bold,
      textTransform: 'uppercase',
    },
    dueBadge: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: '#FDE68A',
    },
    dueBadgeText: {
      fontSize: 9,
      color: '#92400E',
      fontWeight: Typography.weight.bold,
    },
    urduText: {
      fontSize: 16,
      color: colors.textUrdu,
      fontFamily: Typography.fontFamily.urdu,
      marginTop: 2,
      lineHeight: 26,
    },
    wordActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 10,
      backgroundColor: colors.chipSurface,
    },
    actionButtonActive: {
      backgroundColor: colors.accentLight,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxl,
    },
    emptyTitle: {
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      marginTop: Spacing.sm,
    },
    emptySubtitle: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
