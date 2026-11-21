/**
 * Interactive Sentence Card with Vertical Swipe & Flip
 * - Drag UP: I know this sentence (Green glow)
 * - Drag DOWN: Review later (Amber glow, requeued)
 * - Tap: 3D Flip to reveal the authentic Urdu translation
 * - Audio: Speaks the full sentence aloud with native pronunciation
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserSentence } from '../features/sentences/types';
import { Typography, Spacing, ThemeColors, ThemeShadows } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { speakEnglish } from '../core/utils/speech';
import { triggerLightHaptic, triggerSuccessHaptic, triggerWarningHaptic } from '../core/utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 90;

interface SentenceCardProps {
  sentence: UserSentence;
  onSwipe: (direction: 'up' | 'down') => void;
  isTopCard?: boolean;
}

export function SentenceCard({
  sentence,
  onSwipe,
  isTopCard = true,
}: SentenceCardProps) {
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
          // Snap back
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
    await speakEnglish(sentence.english);
    setTimeout(() => setIsPlayingAudio(false), 1200);
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

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
        <View style={styles.headerRow}>
          <View style={styles.tagChip}>
            <Text style={styles.tagText}>
              {sentence.targetWord ? `${sentence.targetWord.toUpperCase()} · PRESENT` : 'SENTENCE PRACTICE'}
            </Text>
          </View>

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
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={toggleFlip} style={styles.bodyContainer}>
          <Text style={styles.englishSentenceText}>{sentence.english}</Text>

          <View style={styles.divider} />

          <Text style={styles.previewHint}>Tap to reveal Urdu translation</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleFlip} style={styles.flipHintRow}>
          <Ionicons name="swap-vertical" size={14} color={colors.textMuted} />
          <Text style={styles.flipHintText}>Tap card for Urdu translation</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ================= CARD BACK (Urdu Translation) ================= */}
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
        <View style={styles.headerRow}>
          <View style={styles.tagChip}>
            <Text style={styles.tagText}>
              {sentence.category ? `${sentence.category.toUpperCase()} · URDU` : 'URDU TRANSLATION'}
            </Text>
          </View>
          <TouchableOpacity onPress={toggleFlip} style={styles.iconButton}>
            <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={toggleFlip} style={styles.bodyContainer}>
          <Text style={styles.backEnglishQuote}>"{sentence.english}"</Text>
          <View style={styles.divider} />
          <Text style={styles.urduSentenceText}>{sentence.urduMeaning}</Text>
        </TouchableOpacity>

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
    tagChip: {
      backgroundColor: colors.categoryBadgeBg,
      paddingHorizontal: Spacing.sm + 4,
      paddingVertical: 5,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    tagText: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.bold,
      color: colors.categoryBadgeText,
      letterSpacing: 0.8,
    },
    iconButton: {
      padding: 7,
      borderRadius: 12,
      backgroundColor: colors.chipSurface,
    },
    iconButtonActive: {
      backgroundColor: colors.accentLight,
    },
    bodyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
    },
    englishSentenceText: {
      fontSize: 24,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      textAlign: 'center',
      lineHeight: 34,
      letterSpacing: -0.3,
      paddingHorizontal: Spacing.sm,
    },
    divider: {
      height: 1.5,
      backgroundColor: colors.divider,
      width: '50%',
      marginVertical: Spacing.lg,
    },
    previewHint: {
      fontSize: Typography.size.sm,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    backEnglishQuote: {
      fontSize: Typography.size.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      fontStyle: 'italic',
      paddingHorizontal: Spacing.sm,
    },
    urduSentenceText: {
      fontSize: 26,
      color: colors.textUrdu,
      textAlign: 'center',
      fontFamily: Typography.fontFamily.urdu,
      lineHeight: 46,
      paddingHorizontal: Spacing.sm,
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
