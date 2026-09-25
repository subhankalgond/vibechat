import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { PrimaryButton, TextField } from '../components/ui';
import { colors } from '../theme';

export default function RegisterScreen({ navigation }: { navigation: any }) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.full_name = 'Full name is required.';
    if (!/^[a-z0-9_]+$/i.test(username.trim())) {
      errors.username = 'Use letters, numbers and underscore only.';
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email.';
    if (password.length < 8) errors.password = 'Password must contain at least 8 characters.';
    if (password !== confirmPassword) errors.confirm_password = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleRegister() {
    setError('');
    if (!validate()) return;
    setLoading(true);
    const result = await register({
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'Could not create the account.');
      if (result.errors) setFieldErrors(result.errors);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Pick a unique username. Friends can find you with it.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
        />
        {fieldErrors.full_name ? <Text style={styles.fieldError}>{fieldErrors.full_name}</Text> : null}

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. subhan"
        />
        {fieldErrors.username ? <Text style={styles.fieldError}>{fieldErrors.username}</Text> : null}

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />
        {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

        <TextField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Repeat the password"
        />
        {fieldErrors.confirm_password ? (
          <Text style={styles.fieldError}>{fieldErrors.confirm_password}</Text>
        ) : null}

        <PrimaryButton title="Create account" onPress={handleRegister} loading={loading} />

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkWrap}>
          <Text style={styles.link}>
            Already have an account? <Text style={styles.linkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 10,
  },
  fieldError: {
    color: colors.danger,
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
  },
  linkWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  link: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkBold: {
    color: colors.primary,
    fontWeight: '700',
  },
} as const);
