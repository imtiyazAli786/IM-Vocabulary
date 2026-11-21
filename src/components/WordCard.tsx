/**
 * Interactive Word Card with Vertical Swipe & Flip
 * - Drag UP: I know it (Green glow, SM-2 interval increase)
 * - Drag DOWN: Review later (Amber glow, requeued)
 * - Tap: 3D Flip to reveal full meaning & context
 * - Audio: One-tap crystal clear native pronunciation
 * - Dynamically themed for Classic Indigo and Sunset Energy
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Word, SwipeDirection } from '../features/words/types';
import { Typography, Spacing, ThemeColors, ThemeShadows } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { speakEnglish } from '../core/utils/speech';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../core/utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 90;

interface WordCardProps {
  word: Word;
  onSwipe: (direction: SwipeDirection) => void;
  onToggleFavourite: (id: string) => void;
  isTopCard?: boolean;
}

export function WordCard({
  word,
  onSwipe,
  onToggleFavourite,
  isTopCard = true,
}: WordCardProps) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Position animations for dragging
  const panY = useRef(new Animated.Value(0)).current;

  // Flip 3D rotation animation
  const flipAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return isTopCard && Math.abs(gesture.dy) > 10;
      },
      onPanResponderGrant: () => {
        triggerLightHaptic();
      },
      onPanResponderMove: (_, gesture) => {
        panY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -SWIPE_THRESHOLD) {
          // Swiped UP -> Know it
          triggerSuccessHaptic();
          Animated.timing(panY, {
            toValue: -SCREEN_HEIGHT * 0.7,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            onSwipe('up');
            panY.setValue(0);
            setIsFlipped(false);
          });
        } else if (gesture.dy > SWIPE_THRESHOLD) {
          // Swiped DOWN -> Review later
          triggerWarningHaptic();
          Animated.timing(panY, {
            toValue: SCREEN_HEIGHT * 0.7,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            onSwipe('down');
            panY.setValue(0);
            setIsFlipped(false);
          });
        } else {
          // Snap back with gentle spring
          Animated.spring(panY, {
            toValue: 0,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const toggleFlip = () => {
    triggerLightHaptic();
    const toValue = isFlipped ? 0 : 180;
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const handleAudioPress = async () => {
    setIsPlayingAudio(true);
    triggerLightHaptic();
    await speakEnglish(word.english);
    setTimeout(() => setIsPlayingAudio(false), 800);
  };

  // Interpolations
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  // Top/bottom glow opacities based on drag direction
  const knowItOpacity = panY.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const laterOpacity = panY.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [{ translateY: panY }],
        },
      ]}
      {...(isTopCard ? panResponder.panHandlers : {})}
    >
      {/* Visual Feedback on Dragging UP */}
      <Animated.View style={[styles.feedbackBadge, styles.feedbackUp, { opacity: knowItOpacity }]}>
        <Ionicons name="checkmark-circle" size={18} color={colors.knowItGreen} />
        <Text style={styles.feedbackUpText}>I KNOW THIS</Text>
      </Animated.View>

      {/* Visual Feedback on Dragging DOWN */}
      <Animated.View style={[styles.feedbackBadge, styles.feedbackDown, { opacity: laterOpacity }]}>
        <Ionicons name="refresh-circle" size={18} color={colors.laterAmber} />
        <Text style={styles.feedbackDownText}>REVIEW LATER</Text>
      </Animated.View>

      {/* ================= CARD FRONT ================= */}
      <Animated.View
        pointerEvents={isFlipped ? 'none' : 'auto'}
        style={[
          styles.cardFace,
          styles.cardFront,
          {
            transform: [{ rotateY: frontInterpolate }],
            backfaceVisibility: 'hidden',
            zIndex: isFlipped ? 1 : 2,
            opacity: isFlipped ? 0 : 1,
          },
        ]}
      >
        {/* Top Header: Category Tag & Quick Action Icons */}
        <View style={styles.headerRow}>
          <View style={styles.posChip}>
            <Text style={styles.posText}>{word.partOfSpeech.toUpperCase()}</Text>
          </View>

          <View style={styles.actionIcons}>
            <TouchableOpacity
              onPress={handleAudioPress}
              style={[styles.iconButton, isPlayingAudio && styles.iconButtonActive]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isPlayingAudio ? 'volume-high' : 'volume-medium-outline'}
                size={22}
                color={isPlayingAudio ? colors.accent : colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                onToggleFavourite(word.id);
              }}
              style={styles.iconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={word.isFavourite ? 'star' : 'star-outline'}
                size={22}
                color={word.isFavourite ? colors.starGold : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Center: English Word & Direct Urdu Meaning */}
        <TouchableOpacity activeOpacity={0.9} onPress={toggleFlip} style={styles.wordHeroContainer}>
          <Text style={styles.wordHeroText}>{word.english}</Text>

          {word.pronunciation ? (
            <Text style={styles.phoneticText}>/{word.pronunciation}/</Text>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.urduMeaningText}>{word.urduMeaning}</Text>
        </TouchableOpacity>

        {/* Bottom Hint */}
        <TouchableOpacity onPress={toggleFlip} style={styles.flipHintRow}>
          <Ionicons name="swap-vertical" size={14} color={colors.textMuted} />
          <Text style={styles.flipHintText}>Tap card for context & examples</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ================= CARD BACK (Context & Examples) ================= */}
      <Animated.View
        pointerEvents={isFlipped ? 'auto' : 'none'}
        style={[
          styles.cardFace,
          styles.cardBack,
          {
            transform: [{ rotateY: backInterpolate }],
            backfaceVisibility: 'hidden',
            zIndex: isFlipped ? 2 : 1,
            opacity: isFlipped ? 1 : 0,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.posChip}>
            <Text style={styles.posText}>
              {word.category ? `${word.category.toUpperCase()} · CONTEXT` : 'CONTEXT & USAGE'}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleFlip} style={styles.iconButton}>
            <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Center: Full Sentence & Deep Meaning */}
        <TouchableOpacity activeOpacity={0.9} onPress={toggleFlip} style={styles.backBody}>
          <Text style={styles.backWordTitle}>{word.english}</Text>
          <Text style={styles.backUrduTitle}>{word.urduMeaning}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>EXAMPLE SENTENCE</Text>
          <Text style={styles.exampleSentenceText}>
            "{word.exampleSentence || 'No example sentence provided yet.'}"
          </Text>

          {/* Spaced Repetition Meta */}
          <View style={styles.sm2BadgeRow}>
            <View style={styles.sm2Badge}>
              <Text style={styles.sm2BadgeLabel}>Interval</Text>
              <Text style={styles.sm2BadgeValue}>{word.intervalDays}d</Text>
            </View>
            <View style={styles.sm2Badge}>
              <Text style={styles.sm2BadgeLabel}>Repetitions</Text>
              <Text style={styles.sm2BadgeValue}>{word.repetitions}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Bottom Hint */}
        <TouchableOpacity onPress={toggleFlip} style={styles.flipHintRow}>
          <Ionicons name="return-up-back-outline" size={14} color={colors.textMuted} />
          <Text style={styles.flipHintText}>Tap to flip back</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors, shadows: ThemeShadows) =>
  StyleSheet.create({
    cardContainer: {
      width: Math.min(SCREEN_WIDTH - 28, 440),
      height: Math.min(SCREEN_HEIGHT * 0.65, 540),
      alignSelf: 'center',
      position: 'relative',
    },
    cardFace: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.cardSurface,
      borderRadius: 28,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      padding: Spacing.lg,
      justifyContent: 'space-between',
      ...shadows.card,
    },
    cardFront: {
      zIndex: 2,
    },
    cardBack: {
      backgroundColor: colors.cardBackSurface,
      zIndex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    posChip: {
      backgroundColor: colors.categoryBadgeBg,
      paddingHorizontal: Spacing.sm + 4,
      paddingVertical: 5,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    posText: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.bold,
      color: colors.categoryBadgeText,
      letterSpacing: 0.8,
    },
    actionIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconButton: {
      padding: 7,
      borderRadius: 12,
      backgroundColor: colors.chipSurface,
    },
    iconButtonActive: {
      backgroundColor: colors.accentLight,
    },
    wordHeroContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
    },
    wordHeroText: {
      fontSize: Typography.size.heroEnglish,
      fontWeight: Typography.weight.heavy,
      color: colors.textPrimary,
      textAlign: 'center',
      letterSpacing: -1,
    },
    phoneticText: {
      fontSize: Typography.size.sm,
      color: colors.textMuted,
      marginTop: 6,
      backgroundColor: colors.chipSurface,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 50,
      overflow: 'hidden',
    },
    divider: {
      height: 1.5,
      backgroundColor: colors.divider,
      width: '50%',
      marginVertical: Spacing.lg,
    },
    urduMeaningText: {
      fontSize: Typography.size.heroUrdu,
      fontWeight: Typography.weight.medium,
      color: colors.textUrdu,
      textAlign: 'center',
      fontFamily: Platform.select({
        web: Typography.fontFamily.urdu,
        default: Typography.fontFamily.urdu,
      }),
      lineHeight: 46,
      paddingHorizontal: Spacing.md,
    },
    flipHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    flipHintText: {
      fontSize: Typography.size.xs,
      color: colors.textMuted,
    },
    // Back card
    backBody: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    backWordTitle: {
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
    },
    backUrduTitle: {
      fontSize: 22,
      color: colors.textUrdu,
      marginTop: 4,
      lineHeight: 38,
      fontFamily: Typography.fontFamily.urdu,
    },
    sectionLabel: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.bold,
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    exampleSentenceText: {
      fontSize: Typography.size.md,
      fontStyle: 'italic',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: Spacing.md,
    },
    sm2BadgeRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: Spacing.lg,
    },
    sm2Badge: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    sm2BadgeLabel: {
      fontSize: 10,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    sm2BadgeValue: {
      fontSize: 13,
      fontWeight: Typography.weight.bold,
      color: colors.accent,
      marginTop: 2,
    },
    // Swipe indicators
    feedbackBadge: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 50,
      zIndex: 10,
    },
    feedbackUp: {
      top: -52,
      backgroundColor: colors.knowItBg,
      borderColor: colors.knowItGreen,
      borderWidth: 1.5,
    },
    feedbackUpText: {
      color: colors.knowItGreen,
      fontSize: 12,
      fontWeight: Typography.weight.heavy,
      letterSpacing: 0.8,
    },
    feedbackDown: {
      bottom: -52,
      backgroundColor: colors.laterBg,
      borderColor: colors.laterAmber,
      borderWidth: 1.5,
    },
    feedbackDownText: {
      color: colors.laterAmber,
      fontSize: 12,
      fontWeight: Typography.weight.heavy,
      letterSpacing: 0.8,
    },
  });
