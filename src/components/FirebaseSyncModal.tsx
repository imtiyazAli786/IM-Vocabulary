/**
 * Multi-Device Real-Time Sync Configuration Modal
 * Allows connecting across Android, iOS, and Web via Firebase Firestore.
 * Dynamically themed.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, ThemeColors } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { firebaseSync } from '../core/sync/firebaseSyncService';
import { saveFirebaseConfig, isFirebaseConfigured, getSavedFirebaseConfig } from '../core/firebase/firebaseConfig';
import { triggerLightHaptic, triggerSuccessHaptic } from '../core/utils/haptics';

interface FirebaseSyncModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FirebaseSyncModal({ visible, onClose }: FirebaseSyncModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [appId, setAppId] = useState('');
  const [syncUserId, setSyncUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCurrentConfig();
    }
  }, [visible]);

  const loadCurrentConfig = async () => {
    const config = await getSavedFirebaseConfig();
    if (config) {
      setApiKey(config.apiKey || '');
      setProjectId(config.projectId || '');
      setAppId(config.appId || '');
    }
    const configured = await isFirebaseConfigured();
    setIsConnected(configured);
    const userId = await firebaseSync.getSyncUserId();
    setSyncUserId(userId);
  };

  const handleSaveAndConnect = async () => {
    const cleanApiKey = apiKey.trim();
    const cleanProjectId = projectId.trim();
    const cleanUserId = syncUserId.trim();

    if (!cleanApiKey || !cleanProjectId) {
      Alert.alert('Missing Fields', 'Please enter your Firebase API Key and Project ID.');
      return;
    }

    setIsLoading(true);
    triggerLightHaptic();

    try {
      if (cleanUserId) {
        await firebaseSync.setSyncUserId(cleanUserId);
      }

      await saveFirebaseConfig({
        apiKey: cleanApiKey,
        projectId: cleanProjectId,
        appId: appId.trim() || '',
      });

      setIsConnected(true);
      triggerSuccessHaptic();
      Alert.alert(
        'Connected!',
        `Multi-device sync is now active on User ID "${cleanUserId || syncUserId}". Progress will update in real time.`
      );
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to connect Firebase.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Multi-Device Sync</Text>
              <Text style={styles.headerSubtitle}>Sync across mobile phones, tablets, and web</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Connection Status Card */}
            <View style={[styles.statusCard, isConnected && styles.statusCardConnected]}>
              <Ionicons
                name={isConnected ? 'checkmark-circle' : 'cloud-offline-outline'}
                size={22}
                color={isConnected ? colors.knowItGreen : colors.textMuted}
              />
              <Text style={styles.statusText}>
                {isConnected
                  ? 'Connected to Firebase Cloud Firestore. Syncing in background.'
                  : 'Operating in Local-First mode. Cards and stats are saved on this device.'}
              </Text>
            </View>

            {/* Sync User ID Field */}
            <Text style={styles.inputLabel}>SHARED SYNC USER ID</Text>
            <Text style={styles.inputHelp}>
              Use the exact same ID on all your devices to share your cards and streaks.
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="e.g. my-family-vault or user_123"
                placeholderTextColor={colors.textMuted}
                value={syncUserId}
                onChangeText={setSyncUserId}
                autoCapitalize="none"
              />
            </View>

            {/* Firebase Config Fields */}
            <Text style={styles.sectionHeader}>FIREBASE CREDENTIALS</Text>

            <Text style={styles.inputLabel}>FIREBASE API KEY</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="AIzaSy..."
                placeholderTextColor={colors.textMuted}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                secureTextEntry
              />
            </View>

            <Text style={styles.inputLabel}>FIREBASE PROJECT ID</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="e.g. lexicard-app"
                placeholderTextColor={colors.textMuted}
                value={projectId}
                onChangeText={setProjectId}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.inputLabel}>FIREBASE APP ID (OPTIONAL)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="1:123456789:web:abcdef..."
                placeholderTextColor={colors.textMuted}
                value={appId}
                onChangeText={setAppId}
                autoCapitalize="none"
              />
            </View>

            {/* Connect Button */}
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleSaveAndConnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.textWhite} />
              ) : (
                <>
                  <Ionicons name="sync" size={18} color={colors.textWhite} />
                  <Text style={styles.connectButtonText}>Save & Connect Devices</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.cardSurface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '90%',
      paddingBottom: Spacing.xl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
    },
    headerTitle: {
      fontSize: Typography.size.lg,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.chipSurface,
      borderRadius: 14,
      padding: Spacing.md,
      gap: 10,
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    statusCardConnected: {
      backgroundColor: colors.knowItBg,
      borderColor: colors.knowItGreen,
      borderWidth: 1,
    },
    statusText: {
      flex: 1,
      fontSize: Typography.size.xs,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    sectionHeader: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.heavy,
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginTop: Spacing.lg,
      marginBottom: Spacing.xs,
    },
    inputLabel: {
      fontSize: 10,
      fontWeight: Typography.weight.bold,
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginTop: Spacing.sm + 2,
      marginBottom: 4,
    },
    inputHelp: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    inputWrapper: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 4,
    },
    input: {
      fontSize: Typography.size.sm,
      color: colors.textPrimary,
      paddingVertical: 8,
    },
    connectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 14,
      marginTop: Spacing.xl,
      gap: 8,
    },
    connectButtonText: {
      color: colors.textWhite,
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.bold,
    },
  });
