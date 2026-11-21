/**
 * LexiCard — App Root Component
 * Lightweight, crazy fast, minimal UI vocabulary learning application.
 * Supports dual dynamic themes: Classic Indigo & Sunset Energy.
 * iOS · Android · Web
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabType, BottomTabBar } from './src/components/BottomTabBar';
import { DeckScreen } from './src/screens/DeckScreen';
import { SentencesScreen } from './src/screens/SentencesScreen';
import { BrowseScreen } from './src/screens/BrowseScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { StorageRepository } from './src/core/storage/storageRepository';
import { setGeminiApiKey, setActiveAIProvider } from './src/core/ai/aiFactory';
import { ThemeProvider, useTheme } from './src/core/theme/ThemeContext';
import { syncService } from './src/core/sync/syncService';

// Keep the splash screen visible while fonts and resources load
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppMain() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('cards');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        {activeTab === 'cards' && <DeckScreen />}
        {activeTab === 'sentences' && <SentencesScreen />}
        {activeTab === 'browse' && <BrowseScreen />}
        {activeTab === 'stats' && <StatsScreen />}
      </View>

      <BottomTabBar activeTab={activeTab} onSelectTab={setActiveTab} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Restore custom API key & AI provider if user previously saved one
    StorageRepository.getCustomApiKey().then((savedKey) => {
      if (savedKey) {
        setGeminiApiKey(savedKey);
      }
    });
    StorageRepository.getAIProvider().then((savedProvider) => {
      if (savedProvider === 'gemini' || savedProvider === 'mock') {
        setActiveAIProvider(savedProvider);
      }
    });

    // Automatically synchronize stats & progress with Firebase Cloud when online
    syncService.triggerSync().catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppMain />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2FF',
  },
  content: {
    flex: 1,
  },
});
