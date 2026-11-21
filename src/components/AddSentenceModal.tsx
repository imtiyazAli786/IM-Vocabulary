/**
 * Add Sentence Modal with AI Urdu Translation
 * Dynamically themed.
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, ThemeColors } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { getAIService } from '../core/ai/aiFactory';
import { StorageRepository } from '../core/storage/storageRepository';
import { UserSentence } from '../features/sentences/types';
import { triggerLightHaptic, triggerSuccessHaptic } from '../core/utils/haptics';

interface AddSentenceModalProps {
  visible: boolean;
  onClose: () => void;
  onSentenceAdded: () => void;
}

export function AddSentenceModal({
  visible,
  onClose,
  onSentenceAdded,
}: AddSentenceModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [englishText, setEnglishText] = useState('');
  const [urduTranslation, setUrduTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTranslate = async () => {
    const trimmed = englishText.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setErrorMessage('');
    triggerLightHaptic();

    try {
      const ai = getAIService();
      const translation = await ai.translateSentence(trimmed);
      setUrduTranslation(translation);
      triggerSuccessHaptic();
    } catch {
      setErrorMessage('Could not auto-translate. You can enter the translation directly.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!englishText.trim()) return;

    const trimmed = englishText.trim();
    const lower = trimmed.toLowerCase();
    let targetWord: string | undefined;
    if (lower.startsWith('what time')) targetWord = 'What time';
    else if (lower.startsWith('what kind')) targetWord = 'What kind of';
    else if (lower.startsWith('what')) targetWord = 'What';
    else if (lower.startsWith('where')) targetWord = 'Where';
    else if (lower.startsWith('when')) targetWord = 'When';
    else if (lower.startsWith('why')) targetWord = 'Why';
    else if (lower.startsWith('who')) targetWord = 'Who';
    else if (lower.startsWith('whom')) targetWord = 'Whom';
    else if (lower.startsWith('whose')) targetWord = 'Whose';
    else if (lower.startsWith('which')) targetWord = 'Which';
    else if (lower.startsWith('how often')) targetWord = 'How often';
    else if (lower.startsWith('how long')) targetWord = 'How long';
    else if (lower.startsWith('how many')) targetWord = 'How many';
    else if (lower.startsWith('how much')) targetWord = 'How much';
    else if (lower.startsWith('how far')) targetWord = 'How far';
    else if (lower.startsWith('how well')) targetWord = 'How well';
    else if (lower.startsWith('how quickly')) targetWord = 'How quickly';
    else if (lower.startsWith('how')) targetWord = 'How';

    const newSentence: UserSentence = {
      id: `sent-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      english: trimmed,
      urduMeaning: urduTranslation.trim() || 'ترجمہ زیر التوا ہے',
      category: targetWord ? 'Simple Present' : 'General',
      subCategory: targetWord ? 'WH-Questions' : undefined,
      targetWord,
      grammarPattern: targetWord ? 'WH-word + do/does + subject + base verb?' : undefined,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    };

    await StorageRepository.saveSentence(newSentence);
    triggerSuccessHaptic();
    resetForm();
    onSentenceAdded();
    onClose();
  };

  const resetForm = () => {
    setEnglishText('');
    setUrduTranslation('');
    setErrorMessage('');
    setIsLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Sentence</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                onClose();
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.inputLabel}>YOUR ENGLISH SENTENCE</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Where do you live? / What time does the train leave?"
              placeholderTextColor={colors.textMuted}
              value={englishText}
              onChangeText={setEnglishText}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.translateButton, (!englishText.trim() || isLoading) && styles.translateButtonDisabled]}
              onPress={handleTranslate}
              disabled={!englishText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.textWhite} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={colors.textWhite} />
                  <Text style={styles.translateButtonText}>Auto-Translate with AI</Text>
                </>
              )}
            </TouchableOpacity>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>URDU MEANING</Text>
            <TextInput
              style={[styles.textArea, styles.urduText]}
              placeholder="اردو ترجمہ یہاں درج کریں..."
              placeholderTextColor={colors.textMuted}
              value={urduTranslation}
              onChangeText={setUrduTranslation}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.saveButton, !englishText.trim() && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!englishText.trim()}
            >
              <Text style={styles.saveButtonText}>Save to Notebook</Text>
            </TouchableOpacity>
          </View>
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
      paddingBottom: Spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    headerTitle: {
      fontSize: Typography.size.lg,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
    },
    inputLabel: {
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.bold,
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: Spacing.xs,
    },
    textArea: {
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      padding: Spacing.md,
      fontSize: Typography.size.md,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    urduText: {
      textAlign: 'right',
      fontFamily: Typography.fontFamily.urdu,
      fontSize: 18,
      color: colors.textUrdu,
      lineHeight: 32,
    },
    translateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      paddingVertical: 10,
      borderRadius: 12,
      marginTop: Spacing.sm,
      gap: 6,
    },
    translateButtonDisabled: {
      opacity: 0.5,
    },
    translateButtonText: {
      color: colors.textWhite,
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.semibold,
    },
    errorText: {
      color: colors.dangerRed,
      fontSize: Typography.size.xs,
      marginTop: 6,
    },
    saveButton: {
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      color: colors.textWhite,
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.bold,
    },
  });
