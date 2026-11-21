/**
 * Sentences Screen with Dual Modes & Category System:
 * 1. Interactive Swipe Cards Practice (Swipe UP = Known, Swipe DOWN = Review Later, Tap to Flip)
 * 2. Notebook List View (All sentences with audio, category pills, and delete)
 * 3. Category Filter System (Simple Present WH-Questions, with future support for Past, Future, Modals, Passive Voice)
 * - Dynamically themed for Classic Indigo and Sunset Energy.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserSentence, SENTENCE_CATEGORIES } from '../features/sentences/types';
import { StorageRepository } from '../core/storage/storageRepository';
import { AddSentenceModal } from '../components/AddSentenceModal';
import { SentenceCard } from '../components/SentenceCard';
import { speakEnglish, stopSpeech } from '../core/utils/speech';
import { Typography, Spacing, ThemeColors, ThemeShadows } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../core/utils/haptics';

type ViewMode = 'cards' | 'list';

export function SentencesScreen() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  const [sentences, setSentences] = useState<UserSentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showGrammarGuide, setShowGrammarGuide] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lastSwiped, setLastSwiped] = useState<{ sentence: UserSentence; direction: 'up' | 'down' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSentences = useCallback(async () => {
    try {
      const data = await StorageRepository.getSentences();
      setSentences(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSentences();
    const unsub = StorageRepository.subscribe(() => {
      StorageRepository.getSentences().then(setSentences);
    });
    return () => {
      unsub();
      stopSpeech();
    };
  }, [loadSentences]);

  const activeCategoryMeta = useMemo(() => {
    return SENTENCE_CATEGORIES.find((c) => c.id === selectedCategory) || SENTENCE_CATEGORIES[0];
  }, [selectedCategory]);

  const filteredSentences = useMemo(() => {
    if (selectedCategory === 'all') return sentences;
    const cat = activeCategoryMeta;
    return sentences.filter((s) => {
      if (cat.category && s.category !== cat.category) return false;
      if (cat.subCategory && s.subCategory !== cat.subCategory) return false;
      return true;
    });
  }, [sentences, selectedCategory, activeCategoryMeta]);

  const handleSelectCategory = (categoryId: string) => {
    triggerLightHaptic();
    setSelectedCategory(categoryId);
    setCurrentIndex(0);
    setLastSwiped(null);
  };

  const handleSwipe = (direction: 'up' | 'down') => {
    if (currentIndex >= filteredSentences.length) return;

    const currentSentence = filteredSentences[currentIndex];
    setLastSwiped({ sentence: currentSentence, direction });

    if (direction === 'down') {
      // Re-queue to end of practice deck
      setSentences((prev) => [...prev, currentSentence]);
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (!lastSwiped || currentIndex === 0) return;
    triggerLightHaptic();
    const { sentence, direction } = lastSwiped;
    if (direction === 'down') {
      setSentences((prev) => {
        const copy = [...prev];
        const lastIdx = copy.map((s) => s.id).lastIndexOf(sentence.id);
        if (lastIdx > currentIndex - 1) {
          copy.splice(lastIdx, 1);
        }
        return copy;
      });
    }
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setLastSwiped(null);
  };

  const handleRestartPractice = () => {
    triggerLightHaptic();
    setCurrentIndex(0);
    setLastSwiped(null);
  };

  const handleAudioPress = async (sentence: UserSentence) => {
    setPlayingId(sentence.id);
    triggerLightHaptic();
    await speakEnglish(sentence.english);
    setTimeout(() => setPlayingId(null), 1200);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Sentence', 'Are you sure you want to delete this sentence?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await StorageRepository.deleteSentence(id);
          triggerLightHaptic();
        },
      },
    ]);
  };

  const activeCard = filteredSentences[currentIndex];
  const nextCard = filteredSentences[currentIndex + 1];
  const isDeckFinished = currentIndex >= filteredSentences.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Sentences</Text>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeButton, viewMode === 'cards' && styles.modeButtonActive]}
              onPress={() => {
                triggerLightHaptic();
                setViewMode('cards');
              }}
            >
              <Ionicons
                name="albums-outline"
                size={16}
                color={viewMode === 'cards' ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.modeButtonText, viewMode === 'cards' && styles.modeButtonTextActive]}>
                Practice
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, viewMode === 'list' && styles.modeButtonActive]}
              onPress={() => {
                triggerLightHaptic();
                setViewMode('list');
              }}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={viewMode === 'list' ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.modeButtonText, viewMode === 'list' && styles.modeButtonTextActive]}>
                Notebook
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            triggerLightHaptic();
            setIsModalVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Category Pills Bar */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {SENTENCE_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => handleSelectCategory(cat.id)}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Grammar Formula Banner */}
      {showGrammarGuide && activeCategoryMeta.formula ? (
        <View style={styles.grammarBanner}>
          <View style={styles.grammarBannerContent}>
            <View style={styles.grammarIconCircle}>
              <Ionicons name="bulb-outline" size={16} color={colors.accent} />
            </View>
            <View style={styles.grammarTextContainer}>
              <Text style={styles.grammarTitle}>{activeCategoryMeta.ruleSummary || 'Pattern Rule'}</Text>
              <Text style={styles.grammarFormulaText}>{activeCategoryMeta.formula}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.grammarDismissButton}
            onPress={() => {
              triggerLightHaptic();
              setShowGrammarGuide(false);
            }}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : viewMode === 'cards' ? (
        /* ================= CARDS PRACTICE MODE ================= */
        <View style={styles.cardsContainer}>
          {filteredSentences.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Sentences in this Category</Text>
              <Text style={styles.emptySubtitle}>
                Add your first practice sentence using the '+' button above!
              </Text>
            </View>
          ) : isDeckFinished ? (
            <View style={styles.finishCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="trophy-outline" size={32} color={colors.accent} />
              </View>
              <Text style={styles.finishTitle}>Practice Complete!</Text>
              <Text style={styles.finishSubtitle}>
                You have reviewed all {filteredSentences.length} sentences in this category.
              </Text>
              <TouchableOpacity style={styles.restartButton} onPress={handleRestartPractice}>
                <Ionicons name="refresh" size={18} color={colors.textWhite} />
                <Text style={styles.restartButtonText}>Practice Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.deckStack}>
              {nextCard ? (
                <View style={styles.ghostCard} pointerEvents="none">
                  <SentenceCard
                    key={nextCard.id}
                    sentence={nextCard}
                    onSwipe={() => {}}
                    isTopCard={false}
                  />
                </View>
              ) : null}

              {activeCard ? (
                <SentenceCard
                  key={activeCard.id}
                  sentence={activeCard}
                  onSwipe={handleSwipe}
                  isTopCard={true}
                />
              ) : null}
            </View>
          )}

          {/* Bottom Footer Row */}
          {!isDeckFinished && filteredSentences.length > 0 ? (
            <View style={styles.footerRow}>
              <View style={styles.counterBox}>
                <Text style={styles.counterText}>
                  {currentIndex + 1} of {filteredSentences.length}
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
        </View>
      ) : (
        /* ================= NOTEBOOK LIST MODE ================= */
        <FlatList
          data={filteredSentences}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Notebook Empty</Text>
              <Text style={styles.emptySubtitle}>Tap the '+' button to add your first sentence.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.sentenceCard}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <View style={styles.numberBadge}>
                    <Text style={styles.numberBadgeText}>#{index + 1}</Text>
                  </View>
                  {item.targetWord ? (
                    <View style={styles.tagChip}>
                      <Text style={styles.tagText}>{item.targetWord}</Text>
                    </View>
                  ) : null}
                  {item.subCategory ? (
                    <View style={[styles.tagChip, styles.tagChipSecondary]}>
                      <Text style={styles.tagTextSecondary}>{item.subCategory}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.audioButton, playingId === item.id && styles.audioButtonActive]}
                    onPress={() => handleAudioPress(item)}
                  >
                    <Ionicons
                      name={playingId === item.id ? 'volume-high' : 'volume-medium-outline'}
                      size={20}
                      color={playingId === item.id ? colors.accent : colors.textSecondary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.englishText}>{item.english}</Text>
              <View style={styles.divider} />
              <Text style={styles.urduText}>{item.urduMeaning}</Text>
            </View>
          )}
        />
      )}

      {/* Add Sentence Modal */}
      <AddSentenceModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSentenceAdded={() => {
          loadSentences();
          triggerSuccessHaptic();
        }}
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
      gap: 12,
    },
    screenTitle: {
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.heavy,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    modeToggleRow: {
      flexDirection: 'row',
      backgroundColor: colors.chipSurface,
      borderRadius: 50,
      padding: 3,
      gap: 2,
    },
    modeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 50,
    },
    modeButtonActive: {
      backgroundColor: colors.cardSurface,
      ...shadows.chip,
    },
    modeButtonText: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.medium,
      color: colors.textMuted,
    },
    modeButtonTextActive: {
      color: colors.accent,
      fontWeight: Typography.weight.bold,
    },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    categoryBar: {
      paddingVertical: Spacing.sm,
    },
    categoryScrollContent: {
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
    grammarBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    grammarBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    grammarIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grammarTextContainer: {
      flex: 1,
    },
    grammarTitle: {
      fontSize: 10,
      fontWeight: Typography.weight.bold,
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    grammarFormulaText: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.bold,
      color: colors.accent,
      marginTop: 2,
    },
    grammarDismissButton: {
      padding: 4,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardsContainer: {
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
    finishCard: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSurface,
      borderRadius: 28,
      padding: Spacing.xxl,
      marginHorizontal: Spacing.xl,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      ...shadows.card,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
      borderWidth: 2,
      borderColor: colors.accentBorder,
    },
    finishTitle: {
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    finishSubtitle: {
      fontSize: Typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.xl,
    },
    restartButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent,
      paddingHorizontal: 24,
      paddingVertical: 13,
      borderRadius: 50,
      gap: 8,
      ...shadows.chip,
    },
    restartButtonText: {
      color: colors.textWhite,
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.bold,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      width: '100%',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.sm,
      minHeight: 44,
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
    listContent: {
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    sentenceCard: {
      backgroundColor: colors.cardSurface,
      borderRadius: 20,
      padding: Spacing.md + 4,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.chip,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    numberBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    numberBadgeText: {
      fontSize: 11,
      fontWeight: Typography.weight.bold,
      color: colors.accent,
    },
    tagChip: {
      backgroundColor: colors.categoryBadgeBg,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    tagText: {
      fontSize: 11,
      fontWeight: Typography.weight.bold,
      color: colors.categoryBadgeText,
    },
    tagChipSecondary: {
      backgroundColor: colors.chipSurface,
      borderColor: colors.cardBorder,
    },
    tagTextSecondary: {
      fontSize: 11,
      fontWeight: Typography.weight.medium,
      color: colors.textSecondary,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    audioButton: {
      padding: 7,
      borderRadius: 10,
      backgroundColor: colors.chipSurface,
    },
    audioButtonActive: {
      backgroundColor: colors.accentLight,
    },
    deleteButton: {
      padding: 6,
    },
    englishText: {
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.semibold,
      color: colors.textPrimary,
      lineHeight: 23,
    },
    divider: {
      height: 1.5,
      backgroundColor: colors.divider,
      marginVertical: Spacing.sm + 2,
    },
    urduText: {
      fontSize: 20,
      color: colors.textUrdu,
      textAlign: 'right',
      fontFamily: Typography.fontFamily.urdu,
      lineHeight: 36,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxl,
      paddingHorizontal: Spacing.xl,
    },
    emptyTitle: {
      fontSize: Typography.size.lg,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      marginTop: Spacing.md,
    },
    emptySubtitle: {
      fontSize: Typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: Spacing.xs,
    },
  });
