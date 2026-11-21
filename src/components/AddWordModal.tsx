/**
 * Add Word Modal with AI Urdu Translation & Instant Preview
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, ThemeColors } from '../core/theme/tokens';
import { useTheme } from '../core/theme/ThemeContext';
import { getAIService } from '../core/ai/aiFactory';
import { StorageRepository } from '../core/storage/storageRepository';
import { Word } from '../features/words/types';
import { triggerLightHaptic, triggerSuccessHaptic } from '../core/utils/haptics';

interface AddWordModalProps {
  visible: boolean;
  onClose: () => void;
  onWordAdded: () => void;
}

export function AddWordModal({
  visible,
  onClose,
  onWordAdded,
}: AddWordModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [englishWord, setEnglishWord] = useState('');
  const [urduMeaning, setUrduMeaning] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<Partial<Word> | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFetchAI = async () => {
    const trimmed = englishWord.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setErrorMessage('');
    triggerLightHaptic();

    try {
      const ai = getAIService();
      const enrichment = await ai.enrichWord(trimmed);
      setPreview({
        english: trimmed,
        urduMeaning: enrichment.urduMeaning,
        partOfSpeech: enrichment.partOfSpeech,
        pronunciation: enrichment.pronunciation,
        exampleSentence: enrichment.exampleSentence,
      });
      setUrduMeaning(enrichment.urduMeaning || '');
      setExampleSentence(enrichment.exampleSentence || '');
      triggerSuccessHaptic();
    } catch {
      setErrorMessage('Could not auto-generate. You can enter details manually.');
      setPreview({
        english: trimmed,
        urduMeaning: '',
        exampleSentence: '',
        partOfSpeech: 'noun',
        pronunciation: '',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWord = async () => {
    if (!englishWord.trim()) return;

    const finalWord: Word = {
      id: `word-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      english: englishWord.trim(),
      urduMeaning: urduMeaning.trim() || preview?.urduMeaning || 'ترجمہ دستیاب نہیں',
      partOfSpeech: preview?.partOfSpeech || 'noun',
      pronunciation: preview?.pronunciation || '',
      exampleSentence: exampleSentence.trim() || preview?.exampleSentence || '',
      category: 'Vocabulary',
      isFavourite: false,
      repetitions: 0,
      easinessFactor: 2.5,
      intervalDays: 1,
      nextReviewAt: new Date().toISOString(),
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    };

    await StorageRepository.saveWord(finalWord);
    triggerSuccessHaptic();
    resetForm();
    onWordAdded();
    onClose();
  };

  const resetForm = () => {
    setEnglishWord('');
    setUrduMeaning('');
    setExampleSentence('');
    setPreview(null);
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
            <Text style={styles.headerTitle}>Add Word to Vault</Text>
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

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* English Word Input */}
            <Text style={styles.inputLabel}>ENGLISH WORD OR PHRASE</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Serendipity, Resilient..."
                placeholderTextColor={colors.textMuted}
                value={englishWord}
                onChangeText={(text) => {
                  setEnglishWord(text);
                  if (preview) setPreview(null);
                }}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleFetchAI}
              />
              <TouchableOpacity
                style={[styles.aiButton, (!englishWord.trim() || isLoading) && styles.aiButtonDisabled]}
                onPress={handleFetchAI}
                disabled={!englishWord.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={14} color={colors.textWhite} />
                    <Text style={styles.aiButtonText}>Auto-Fill</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            {/* Urdu Meaning Input */}
            <Text style={styles.inputLabel}>URDU MEANING</Text>
            <View style={styles.singleInputWrapper}>
              <TextInput
                style={[styles.input, styles.urduInput]}
                placeholder="اردو معنی درج کریں..."
                placeholderTextColor={colors.textMuted}
                value={urduMeaning}
                onChangeText={setUrduMeaning}
              />
            </View>

            {/* Example Sentence Input */}
            <Text style={styles.inputLabel}>EXAMPLE SENTENCE (OPTIONAL)</Text>
            <View style={styles.singleInputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Example showing natural usage..."
                placeholderTextColor={colors.textMuted}
                value={exampleSentence}
                onChangeText={setExampleSentence}
                multiline
              />
            </View>

            {/* Preview Box */}
            {preview ? (
              <View style={styles.previewBox}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewWord}>{preview.english}</Text>
                  <View style={styles.previewPosChip}>
                    <Text style={styles.previewPosText}>{preview.partOfSpeech}</Text>
                  </View>
                </View>

                {preview.pronunciation ? (
                  <Text style={styles.previewPronunciation}>/{preview.pronunciation}/</Text>
                ) : null}

                <Text style={styles.previewUrdu}>{urduMeaning || preview.urduMeaning}</Text>

                <View style={styles.previewDivider} />

                <Text style={styles.previewExampleLabel}>EXAMPLE:</Text>
                <Text style={styles.previewExample}>"{exampleSentence || preview.exampleSentence}"</Text>
              </View>
            ) : null}

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, !englishWord.trim() && styles.saveButtonDisabled]}
              onPress={handleSaveWord}
              disabled={!englishWord.trim() || isLoading}
            >
              <Text style={styles.saveButtonText}>Add to Vocabulary</Text>
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
      maxHeight: '85%',
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
      marginTop: Spacing.md,
      marginBottom: Spacing.xs + 2,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      gap: 8,
    },
    singleInputWrapper: {
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      paddingVertical: 4,
    },
    urduInput: {
      textAlign: 'right',
      fontFamily: Typography.fontFamily.urdu,
      fontSize: 18,
      color: colors.textUrdu,
    },
    input: {
      flex: 1,
      fontSize: Typography.size.md,
      color: colors.textPrimary,
      paddingVertical: 8,
    },
    aiButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      gap: 4,
    },
    aiButtonDisabled: {
      opacity: 0.5,
    },
    aiButtonText: {
      color: colors.textWhite,
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.semibold,
    },
    errorText: {
      color: colors.dangerRed,
      fontSize: Typography.size.xs,
      marginTop: 6,
    },
    previewBox: {
      marginTop: Spacing.lg,
      backgroundColor: colors.chipSurface,
      borderRadius: 16,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    previewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    previewWord: {
      fontSize: Typography.size.lg,
      fontWeight: Typography.weight.bold,
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    previewPosChip: {
      backgroundColor: colors.categoryBadgeBg,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    previewPosText: {
      fontSize: 10,
      color: colors.categoryBadgeText,
      fontWeight: Typography.weight.bold,
    },
    previewPronunciation: {
      fontSize: Typography.size.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    previewUrdu: {
      fontSize: 22,
      color: colors.textUrdu,
      marginTop: Spacing.sm,
      fontFamily: Typography.fontFamily.urdu,
      textAlign: 'right',
      lineHeight: 36,
    },
    previewDivider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginVertical: Spacing.sm + 4,
    },
    previewExampleLabel: {
      fontSize: 10,
      fontWeight: Typography.weight.bold,
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    previewExample: {
      fontSize: Typography.size.sm,
      fontStyle: 'italic',
      color: colors.textSecondary,
      lineHeight: 18,
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
