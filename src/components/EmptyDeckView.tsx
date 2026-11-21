/**
 * Empty Deck View
 * Displays a clean, motivating completion state when all due words are finished.
 * Dynamically themed.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, ThemeColors, ThemeShadows } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { triggerLightHaptic } from '../core/utils/haptics';

interface EmptyDeckViewProps {
  onReviewAll: () => void;
  onAddNewWord: () => void;
  completedTodayCount: number;
}

export function EmptyDeckView({
  onReviewAll,
  onAddNewWord,
  completedTodayCount,
}: EmptyDeckViewProps) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="sparkles" size={32} color={colors.accent} />
      </View>

      <Text style={styles.title}>All Caught Up!</Text>
      <Text style={styles.subtitle}>
        You've completed your vocabulary reviews for now.
        {completedTodayCount > 0 ? ` Great job reviewing ${completedTodayCount} words!` : ''}
      </Text>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            triggerLightHaptic();
            onAddNewWord();
          }}
        >
          <Ionicons name="add" size={20} color={colors.textWhite} />
          <Text style={styles.primaryButtonText}>Add New Word</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            triggerLightHaptic();
            onReviewAll();
          }}
        >
          <Ionicons name="refresh" size={18} color={colors.textPrimary} />
          <Text style={styles.secondaryButtonText}>Review Entire Deck</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, shadows: ThemeShadows) =>
  StyleSheet.create({
    container: {
      width: '90%',
      maxWidth: 420,
      alignSelf: 'center',
      backgroundColor: colors.cardSurface,
      borderRadius: 24,
      padding: Spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.card,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontSize: Typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.sm,
    },
    buttonGroup: {
      width: '100%',
      gap: Spacing.sm + 4,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
    },
    primaryButtonText: {
      color: colors.textWhite,
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.semibold,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.chipSurface,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.medium,
    },
  });
