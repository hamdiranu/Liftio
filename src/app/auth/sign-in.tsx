import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Lock, Mail, Smartphone } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Divider } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { signInSchema, type SignInValues } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/store';
import { toErrorMessage } from '@/lib/utils';
import { isSupabaseConfigured } from '@/services/supabase';

export default function SignInScreen() {
  const colors = useColors();
  const signIn = useAuth((s) => s.signIn);
  const continueAsGuest = useAuth((s) => s.continueAsGuest);
  const [error, setError] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const { control, handleSubmit, formState } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email.trim(), values.password);
    } catch (e) {
      setError(toErrorMessage(e, 'Couldn’t sign in. Check your details and try again.'));
    }
  });

  return (
    <AuthShell
      background="auth"
      title={isSupabaseConfigured ? 'Welcome back' : 'Welcome to Liftio'}
      subtitle={
        isSupabaseConfigured
          ? 'Sign in to sync your training across devices.'
          : 'Log every set and watch your progress add up.'
      }>
      {isSupabaseConfigured ? (
        <View className="gap-4">
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Input
                label="Email"
                icon={Mail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Input
                label="Password"
                icon={Lock}
                placeholder="Your password"
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void onSubmit()}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
          {error ? (
            <Text variant="small" tone="danger">
              {error}
            </Text>
          ) : null}
          <Button label="Sign in" size="lg" fullWidth loading={formState.isSubmitting} onPress={onSubmit} />
          <View className="flex-row justify-between">
            <Link href="/auth/forgot-password" asChild>
              <Text variant="small" tone="accent" weight="semibold" accessibilityRole="link">
                Forgot password?
              </Text>
            </Link>
            <Link href="/auth/sign-up" asChild>
              <Text variant="small" tone="accent" weight="semibold" accessibilityRole="link">
                Create account
              </Text>
            </Link>
          </View>
          <View className="my-2 flex-row items-center gap-3">
            <Divider className="flex-1" />
            <Text variant="caption" tone="muted">
              or
            </Text>
            <Divider className="flex-1" />
          </View>
        </View>
      ) : (
        <Card className="mb-5">
          <View className="flex-row gap-3">
            <Smartphone size={20} color={colors.accent} />
            <View className="flex-1">
              <Text variant="subheading">No account needed</Text>
              <Text variant="small" tone="secondary" style={{ marginTop: 4 }}>
                Your workouts are saved privately on this phone. Everything works offline.
              </Text>
            </View>
          </View>
        </Card>
      )}
      <Button
        label={isSupabaseConfigured ? 'Continue without an account' : 'Get started'}
        variant={isSupabaseConfigured ? 'secondary' : 'primary'}
        size="lg"
        iconRight={ArrowRight}
        fullWidth
        loading={guestLoading}
        onPress={async () => {
          setGuestLoading(true);
          await continueAsGuest();
          router.replace('/');
        }}
      />
      {isSupabaseConfigured ? (
        <Text variant="caption" tone="muted" align="center" style={{ marginTop: 14 }}>
          Without an account, workouts stay on this device. Sign in later to back them up.
        </Text>
      ) : null}
    </AuthShell>
  );
}
