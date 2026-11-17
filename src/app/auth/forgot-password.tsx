import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Mail } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { resetSchema, type ResetValues } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/store';
import { toErrorMessage } from '@/lib/utils';

export default function ForgotPasswordScreen() {
  const sendPasswordReset = useAuth((s) => s.sendPasswordReset);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  });
  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  });

  return (
    <AuthShell back title="Reset password" subtitle="Enter your email and we’ll send you a reset link.">
      <View className="gap-4">
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Input label="Email" icon={Mail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} onSubmitEditing={() => void onSubmit()} error={fieldState.error?.message} />
          )}
        />
        {sent ? (
          <Text variant="small" tone="success">
            Reset link sent. Check your inbox.
          </Text>
        ) : null}
        {error ? (
          <Text variant="small" tone="danger">
            {error}
          </Text>
        ) : null}
        <Button label={sent ? 'Send again' : 'Send reset link'} size="lg" fullWidth loading={formState.isSubmitting} onPress={onSubmit} />
      </View>
    </AuthShell>
  );
}
