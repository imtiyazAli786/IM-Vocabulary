/**
 * Minimalist Bottom Tab Bar
 * 4 clear tabs with active state indicator and haptic feedback.
 * Dynamically themed for Classic Indigo and Sunset Energy.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Spacing, ThemeColors, ThemeShadows } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { triggerLightHaptic } from '../core/utils/haptics';

export type TabType = 'cards' | 'sentences' | 'browse' | 'stats';

interface BottomTabBarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export function BottomTabBar({ activeTab, onSelectTab }: BottomTabBarProps) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 14);

  const tabs: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'cards', label: 'Cards', icon: 'card-outline', activeIcon: 'card' },
    { key: 'sentences', label: 'Sentences', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
    { key: 'browse', label: 'Search', icon: 'search-outline', activeIcon: 'search' },
    { key: 'stats', label: 'Progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  ];

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => {
              if (!isActive) {
                triggerLightHaptic();
                onSelectTab(tab.key);
              }
            }}
          >
            {isActive ? <View style={styles.activeIndicator} /> : null}
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={22}
              color={isActive ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors, shadows: ThemeShadows) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.cardSurface,
      borderTopWidth: 1.5,
      borderTopColor: colors.cardBorder,
      paddingTop: Spacing.sm,
      justifyContent: 'space-around',
      alignItems: 'center',
      ...shadows.card,
    },
    tabItem: {
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: Spacing.md,
      gap: 3,
      minWidth: 60,
    },
    activeIndicator: {
      width: 24,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.accent,
      marginBottom: 4,
    },
    tabLabel: {
      fontSize: Typography.size.xs,
      color: colors.textMuted,
      fontWeight: Typography.weight.medium,
    },
    tabLabelActive: {
      color: colors.accent,
      fontWeight: Typography.weight.bold,
    },
  });
