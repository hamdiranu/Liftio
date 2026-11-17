import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CircleCheck, Lock, Mail, UserRound } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useColors } from '@/constants/theme';
import { signUpSchema, type SignUpValues } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/store';
import { getProfile, saveProfile } from '@/features/profile/repository';
import { toErrorMessage } from '@/lib/utils';

export default function SignUpScreen() {
  const colors = useColors();
  const signUp = useAuth((s) => s.signUp);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { needsConfirmation } = await signUp(values.email.trim(), values.password, values.name.trim());
      if (needsConfirmation) {
        setConfirmEmail(values.email.trim());
        return;
      }
      const userId = useAuth.getState().userId;
      if (userId) await saveProfile({ ...(await getProfile(userId)), name: values.name.trim() });
    } catch (e) {
      setError(toErrorMessage(e, 'Couldn’t create your account. Try again.'));
    }
  });

  if (confirmEmail) {
    return (
      <AuthShell back title="Check your inbox" subtitle={`We sent a confirmation link to ${confirmEmail}.`}>
        <Card>
          <View className="flex-row gap-3">
            <CircleCheck size={20} color={colors.success} />
            <Text variant="small" tone="secondary" style={{ flex: 1 }}>
              Open the link on this device, then come back and sign in.
            </Text>
          </View>
        </Card>
        <View className="mt-6">
          <Button label="Back to sign in" fullWidth size="lg" onPress={() => router.replace('/auth/sign-in')} />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell back title="Create your account" subtitle="Back up your training and get coaching that follows you.">
      <View className="gap-4">
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Input label="Name" icon={UserRound} placeholder="Jordan Davis" autoComplete="name" textContentType="name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Input label="Email" icon={Mail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Input label="Password" icon={Lock} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" textContentType="newPassword" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} hint="Use 8+ characters with a number." />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field, fieldState }) => (
            <Input label="Confirm password" icon={Lock} placeholder="Repeat password" secureTextEntry autoComplete="new-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} onSubmitEditing={() => void onSubmit()} error={fieldState.error?.message} />
          )}
        />
        {error ? (
          <Text variant="small" tone="danger">
            {error}
          </Text>
        ) : null}
        <Button label="Create account" size="lg" fullWidth loading={formState.isSubmitting} onPress={onSubmit} />
      </View>
    </AuthShell>
  );
}
