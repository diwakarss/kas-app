/**
 * Auth Screen
 *
 * Handles sign in and sign up for the app.
 * Design follows the Liquid Story design system.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../core/theme/tokens';
import { useAuth } from '../core/context/AuthContext';

type AuthMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    email.includes('@') &&
    password.length >= 6 &&
    (mode === 'signin' || name.trim().length > 0);

  const handleSubmit = async () => {
    if (!isValid || isLoading) return;

    setIsLoading(true);
    setError(null);

    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, name);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'Something went wrong');
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>KAS</Text>
            <Text style={styles.title}>
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signin'
                ? 'Sign in to access your apps'
                : 'Get started with your business app'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.mist}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.mist}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.mist}
                secureTextEntry
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={[
                styles.button,
                (!isValid || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.dawn} />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Toggle mode */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {mode === 'signin'
                ? "Don't have an account?"
                : 'Already have an account?'}
            </Text>
            <Pressable onPress={toggleMode}>
              <Text style={styles.footerLink}>
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dawn,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 32,
    fontFamily: 'Inter_600SemiBold',
    color: colors.stream,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.secondary,
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.body,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    height: 48,
    borderBottomWidth: 2,
    borderBottomColor: colors.mist,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: colors.clay,
    paddingVertical: spacing.sm,
  },
  errorContainer: {
    backgroundColor: `${colors.ember}15`,
    padding: spacing.sm,
    borderRadius: 8,
  },
  errorText: {
    ...typography.warning,
    textAlign: 'center',
  },
  button: {
    height: 48,
    backgroundColor: colors.stream,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: colors.dawn,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    ...typography.secondary,
  },
  footerLink: {
    ...typography.action,
    fontFamily: 'Inter_500Medium',
  },
});
