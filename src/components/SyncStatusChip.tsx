/**
 * Minimal Sync Status Chip
 * Shows live sync state (✓ Synced / ⏳ Syncing / ☁️ Offline).
 * Dynamically themed.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { syncService, SyncStatus } from '../core/sync/syncService';
import { Typography, Spacing, ThemeColors } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';

export function SyncStatusChip() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<SyncStatus>('offline');

  useEffect(() => {
    return syncService.subscribe((newStatus) => setStatus(newStatus));
  }, []);

  const config = {
    synced: { text: 'Cloud Synced', color: colors.syncSuccess, dot: '●' },
    syncing: { text: 'Syncing…', color: colors.syncPending, dot: '○' },
    offline: { text: 'Offline Mode', color: colors.accent, dot: '✓' },
    error: { text: 'Local Only', color: colors.syncOffline, dot: '●' },
  }[status];

  return (
    <View style={styles.container}>
      <Text style={[styles.dot, { color: config.color }]}>{config.dot}</Text>
      <Text style={[styles.label, { color: config.color }]}>{config.text}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm + 4,
      paddingVertical: 5,
      borderRadius: 50,
      backgroundColor: colors.chipSurface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 5,
    },
    dot: {
      fontSize: 10,
    },
    label: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.bold,
    },
  });
