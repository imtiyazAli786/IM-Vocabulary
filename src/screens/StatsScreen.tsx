/**
 * Learning Stats & Settings Screen
 * Visualizes retention metrics, streaks, allows configuring Gemini API key,
 * haptic vibration toggle, and switching between Classic Indigo and Sunset Energy themes.
 * Dynamically themed.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StorageRepository, UserStats } from '../core/storage/storageRepository';
import { Word } from '../features/words/types';
import { isCardDue } from '../core/utils/sm2';
import { setGeminiApiKey, setActiveAIProvider, ACTIVE_PROVIDER } from '../core/ai/aiFactory';
import { Typography, Spacing, ThemeColors, ThemeShadows, ThemeId } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import {
  triggerLightHaptic,
  triggerSuccessHaptic,
  isHapticsEnabled,
  setHapticsEnabled,
  loadHapticsSetting,
} from '../core/utils/haptics';
import { FirebaseSyncModal } from '../components/FirebaseSyncModal';

export function StatsScreen() {
  const { colors, shadows, themeId, setThemeId } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

  const [stats, setStats] = useState<UserStats | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [activeModel, setActiveModel] = useState<'gemini' | 'mock'>(ACTIVE_PROVIDER as any);
  const [isSavedKey, setIsSavedKey] = useState(false);
  const [isSyncModalVisible, setIsSyncModalVisible] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());

  const loadData = useCallback(async () => {
    const [s, w, key, provider, hapticSetting] = await Promise.all([
      StorageRepository.getStats(),
      StorageRepository.getWords(),
      StorageRepository.getCustomApiKey(),
      StorageRepository.getAIProvider(),
      loadHapticsSetting(),
    ]);
    setStats(s);
    setWords(w);
    setHapticsOn(hapticSetting);
    if (key) {
      setApiKeyInput(key);
      setIsSavedKey(true);
    }
    if (provider === 'gemini' || provider === 'mock') {
      setActiveModel(provider);
      setActiveAIProvider(provider);
    }
  }, []);

  useEffect(() => {
    loadData();
    return StorageRepository.subscribe(() => {
      loadData();
    });
  }, [loadData]);

  const handleSaveApiKey = async () => {
    triggerLightHaptic();
    const cleanKey = apiKeyInput.trim();
    await StorageRepository.setCustomApiKey(cleanKey);
    setGeminiApiKey(cleanKey);
    setIsSavedKey(true);
    triggerSuccessHaptic();
    Alert.alert('Saved', 'Gemini API key updated successfully.');
  };

  const handleSwitchModel = async (model: 'gemini' | 'mock') => {
    triggerLightHaptic();
    setActiveModel(model);
    setActiveAIProvider(model);
    await StorageRepository.setAIProvider(model);
  };

  const handleToggleHaptics = async (val: boolean) => {
    setHapticsOn(val);
    await setHapticsEnabled(val);
    if (val) {
      triggerLightHaptic();
    }
  };

  const handleSelectTheme = async (id: ThemeId) => {
    triggerLightHaptic();
    await setThemeId(id);
  };

  const totalWords = words.length;
  const dueCount = words.filter((w) => isCardDue(w.nextReviewAt)).length;
  const masteredCount = words.filter((w) => w.repetitions >= 3).length;
  const retentionPercent =
    totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Progress & Settings</Text>
        <Text style={styles.screenSubtitle}>Your vocabulary mastery at a glance</Text>

        {/* Hero Streak Card */}
        <View style={styles.streakCard}>
          <View style={styles.streakIconCircle}>
            <Text style={styles.streakFire}>🔥</Text>
          </View>
          <View style={styles.streakDetails}>
            <Text style={styles.streakNumber}>{stats?.streak ?? 1} Day Streak</Text>
            <Text style={styles.streakMotivation}>
              {stats?.streak && stats.streak > 2
                ? 'Incredible consistency! Keep the momentum alive.'
                : 'Consistency is key. Complete daily reviews to grow your streak!'}
            </Text>
          </View>
        </View>

        {/* 3 Metric Cards */}
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{totalWords}</Text>
            <Text style={styles.metricLabel}>Total Words</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={[styles.metricVal, { color: colors.accent }]}>{dueCount}</Text>
            <Text style={styles.metricLabel}>Due Today</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={[styles.metricVal, { color: colors.knowItGreen }]}>{retentionPercent}%</Text>
            <Text style={styles.metricLabel}>Mastery</Text>
          </View>
        </View>

        {/* ================= THEME SWITCHER ================= */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeader}>COLOR THEME</Text>
          <Text style={styles.themeSubtitle}>
            Switch instantly between Classic Indigo and vibrant Sunset Energy
          </Text>

          <View style={styles.themeGrid}>
            {/* Classic Indigo Theme Option */}
            <TouchableOpacity
              style={[
                styles.themeOptionCard,
                themeId === 'classic' && styles.themeOptionCardActive,
              ]}
              onPress={() => handleSelectTheme('classic')}
              activeOpacity={0.8}
            >
              <View style={styles.themeHeaderRow}>
                <View style={[styles.swatchCircle, { backgroundColor: '#F0F2FF', borderColor: '#4F46E5' }]}>
                  <View style={[styles.swatchInner, { backgroundColor: '#4F46E5' }]} />
                </View>
                {themeId === 'classic' && (
                  <View style={[styles.activeCheckBadge, { backgroundColor: colors.accent }]}>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  </View>
                )}
              </View>
              <Text style={styles.themeOptionTitle}>Classic Indigo</Text>
              <Text style={styles.themeOptionDesc}>Calm lavender & deep indigo</Text>
            </TouchableOpacity>

            {/* Sunset Energy Theme Option */}
            <TouchableOpacity
              style={[
                styles.themeOptionCard,
                themeId === 'sunset' && styles.themeOptionCardActive,
              ]}
              onPress={() => handleSelectTheme('sunset')}
              activeOpacity={0.8}
            >
              <View style={styles.themeHeaderRow}>
                <View style={[styles.swatchCircle, { backgroundColor: '#FFFBF5', borderColor: '#EA580C' }]}>
                  <View style={[styles.swatchInner, { backgroundColor: '#EA580C' }]} />
                </View>
                {themeId === 'sunset' && (
                  <View style={[styles.activeCheckBadge, { backgroundColor: colors.accent }]}>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  </View>
                )}
              </View>
              <Text style={styles.themeOptionTitle}>Sunset Energy</Text>
              <Text style={styles.themeOptionDesc}>Warm cream, orange & magenta</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Haptic Vibration Section */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeader}>GESTURE & HAPTIC VIBRATION</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleTitle}>Card Vibration Feedback</Text>
              <Text style={styles.toggleSubtitle}>
                Vibrate gently when dragging or swiping cards up and down
              </Text>
            </View>
            <Switch
              value={hapticsOn}
              onValueChange={handleToggleHaptics}
              trackColor={{ false: colors.chipSurface, true: colors.accent }}
              thumbColor={hapticsOn ? colors.textWhite : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Learning Statistics Details */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeader}>RETENTION OVERVIEW</Text>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Total Reviews Completed</Text>
            <Text style={styles.statRowVal}>{stats?.totalCardsSwiped ?? 0}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Cards Mastered (3+ repeats)</Text>
            <Text style={[styles.statRowVal, { color: colors.knowItGreen }]}>{masteredCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Learning In Progress</Text>
            <Text style={[styles.statRowVal, { color: colors.laterAmber }]}>
              {totalWords - masteredCount}
            </Text>
          </View>
          <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.statRowLabel}>Current Daily Streak</Text>
            <Text style={styles.statRowVal}>{stats?.streak ?? 1} days</Text>
          </View>
        </View>

        {/* AI Translation Engine */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeader}>AI TRANSLATION ENGINE</Text>

          <View style={styles.modelSwitcher}>
            <TouchableOpacity
              style={[styles.modelTab, activeModel === 'gemini' && styles.modelTabActive]}
              onPress={() => handleSwitchModel('gemini')}
            >
              <Text style={[styles.modelTabText, activeModel === 'gemini' && styles.modelTabTextActive]}>
                Gemini 2.5 Flash
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modelTab, activeModel === 'mock' && styles.modelTabActive]}
              onPress={() => handleSwitchModel('mock')}
            >
              <Text style={[styles.modelTabText, activeModel === 'mock' && styles.modelTabTextActive]}>
                Offline Dictionary
              </Text>
            </TouchableOpacity>
          </View>

          {activeModel === 'gemini' ? (
            <View>
              <Text style={styles.inputLabel}>CUSTOM GEMINI API KEY</Text>
              <View style={styles.apiKeyInputRow}>
                <TextInput
                  style={styles.apiKeyInput}
                  placeholder="Paste your AIzaSy... key"
                  placeholderTextColor={colors.textMuted}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  autoCapitalize="none"
                  secureTextEntry={isSavedKey}
                />
                <TouchableOpacity style={styles.saveKeyButton} onPress={handleSaveApiKey}>
                  <Text style={styles.saveKeyButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helpText}>
                Get your free API key at ai.google.dev. Used securely on-device only.
              </Text>
            </View>
          ) : (
            <Text style={styles.helpText}>
              ✓ Offline Mode active. Instant Urdu translations and definitions without an internet connection.
            </Text>
          )}
        </View>

        {/* Multi-Device Cloud Sync */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionHeader}>CROSS-DEVICE SYNC</Text>
          <Text style={styles.syncCardDescription}>
            Sync your vocabulary, flashcard progress, and custom additions across all your phones, tablets, and web browsers.
          </Text>

          <TouchableOpacity
            style={styles.syncModalButton}
            onPress={() => {
              triggerLightHaptic();
              setIsSyncModalVisible(true);
            }}
          >
            <Ionicons name="cloud-outline" size={18} color={colors.textWhite} />
            <Text style={styles.syncModalButtonText}>Configure Multi-Device Sync</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sync Credentials Modal */}
      <FirebaseSyncModal
        visible={isSyncModalVisible}
        onClose={() => setIsSyncModalVisible(false)}
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
    container: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxl + 40,
      gap: Spacing.md,
    },
    screenTitle: {
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.heavy,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    screenSubtitle: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: Spacing.xs,
    },
    streakCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSurface,
      borderRadius: 22,
      padding: Spacing.md + 4,
      borderWidth: 1.5,
      borderColor: '#FDE68A',
      gap: Spacing.md,
      ...shadows.card,
    },
    streakIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#FEF3C7',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FDE68A',
    },
    streakFire: {
      fontSize: 28,
    },
    streakDetails: {
      flex: 1,
    },
    streakNumber: {
      fontSize: Typography.size.lg,
      fontWeight: Typography.weight.heavy,
      color: colors.textPrimary,
    },
    streakMotivation: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      marginTop: 3,
      lineHeight: 17,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    metricBox: {
      flex: 1,
      backgroundColor: colors.cardSurface,
      borderRadius: 18,
      padding: Spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.chip,
    },
    metricVal: {
      fontSize: Typography.size.xl,
      fontWeight: Typography.weight.heavy,
      color: colors.textPrimary,
    },
    metricLabel: {
      fontSize: Typography.size.xs,
      color: colors.textMuted,
      fontWeight: Typography.weight.medium,
      marginTop: 4,
      textAlign: 'center',
    },
    cardSection: {
      backgroundColor: colors.cardSurface,
      borderRadius: 22,
      padding: Spacing.md + 4,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.chip,
    },
    sectionHeader: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.heavy,
      color: colors.accent,
      letterSpacing: 1,
      marginBottom: Spacing.xs,
    },
    themeSubtitle: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      marginBottom: Spacing.md,
    },
    themeGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    themeOptionCard: {
      flex: 1,
      backgroundColor: colors.chipSurface,
      borderRadius: 16,
      padding: Spacing.md,
      borderWidth: 2,
      borderColor: colors.cardBorder,
    },
    themeOptionCardActive: {
      borderColor: colors.accent,
      backgroundColor: colors.cardSurface,
      ...shadows.chip,
    },
    themeHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    swatchCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    swatchInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    activeCheckBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    themeOptionTitle: {
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    themeOptionDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    statRowLabel: {
      fontSize: Typography.size.sm,
      color: colors.textSecondary,
    },
    statRowVal: {
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
    },
    modelSwitcher: {
      flexDirection: 'row',
      backgroundColor: colors.chipSurface,
      borderRadius: 14,
      padding: 3,
      marginBottom: Spacing.md,
    },
    modelTab: {
      flex: 1,
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: 12,
    },
    modelTabActive: {
      backgroundColor: colors.cardSurface,
      ...shadows.chip,
    },
    modelTabText: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      fontWeight: Typography.weight.medium,
    },
    modelTabTextActive: {
      color: colors.accent,
      fontWeight: Typography.weight.bold,
    },
    inputLabel: {
      fontSize: 10,
      fontWeight: Typography.weight.bold,
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    apiKeyInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    apiKeyInput: {
      flex: 1,
      fontSize: Typography.size.sm,
      color: colors.textPrimary,
      paddingVertical: 10,
    },
    saveKeyButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 10,
    },
    saveKeyButtonText: {
      color: colors.textWhite,
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.bold,
    },
    helpText: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 8,
      lineHeight: 16,
    },
    syncCardDescription: {
      fontSize: Typography.size.sm,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: Spacing.md,
    },
    syncModalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      paddingVertical: 13,
      borderRadius: 14,
      gap: 8,
      ...shadows.chip,
    },
    syncModalButtonText: {
      color: colors.textWhite,
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.bold,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    toggleTextContainer: {
      flex: 1,
      paddingRight: Spacing.md,
    },
    toggleTitle: {
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.semibold,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    toggleSubtitle: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      lineHeight: 16,
    },
  });
