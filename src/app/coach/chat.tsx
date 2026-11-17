import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoachAvatar, MessageBubble, TypingIndicator } from '@/components/coach/coach-components';
import { AmbientBackground } from '@/components/ui/ambient-background';
import { IconButton } from '@/components/ui/icon-button';
import { MessageSquarePlus, Send, Trash2 } from '@/components/ui/icons';
import { confirm, toast } from '@/components/ui/overlays';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { keyboardAppearanceFor, useColors, fonts } from '@/constants/theme';
import { SUGGESTED_QUESTIONS } from '@/features/ai-coach/engine';
import { useCoachContext, useCreateConversation, useDeleteConversation, useMessages, useSendMessage } from '@/features/ai-coach/hooks';
import { getCoachProvider } from '@/features/ai-coach/service';
import { goBack } from '@/lib/navigation';
import { toErrorMessage } from '@/lib/utils';
import { useStartWorkout } from '@/hooks/use-start-workout';

export default function CoachChatScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ conversationId?: string; prompt?: string; new?: string }>();
  const insets = useSafeAreaInsets();
  const [conversationId, setConversationId] = useState<string | null>(params.conversationId ?? null);
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const messages = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const { ctx } = useCoachContext();
  const startWorkout = useStartWorkout();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const sentPrompt = useRef(false);

  useEffect(() => {
    if (conversationId || createConversation.isPending) return;
    createConversation.mutate(undefined, { onSuccess: (c) => setConversationId(c.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || send.isPending || !conversationId) return;
    if (!ctx) {
      toast('Loading your training data…', 'info');
      return;
    }
    setText('');
    send.mutate(trimmed, {
      onError: (e) => toast(toErrorMessage(e, 'The coach couldn’t answer. Try again.'), 'error'),
    });
  };

  useEffect(() => {
    if (params.prompt && conversationId && ctx && !sentPrompt.current) {
      sentPrompt.current = true;
      submit(params.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.prompt, conversationId, ctx]);

  const list = messages.data ?? [];
  const lastAssistant = [...list].reverse().find((m) => m.role === 'assistant');

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [list.length, send.isPending]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <AmbientBackground intensity="subtle" />
      <ScreenHeader
        title="AI Coach"
        subtitle={getCoachProvider().id === 'edge' ? 'Cloud AI · grounded in your training' : 'On-device · grounded in your training'}
        right={
          <>
            <IconButton icon={MessageSquarePlus} accessibilityLabel="New conversation" size={40} onPress={() => createConversation.mutate(undefined, { onSuccess: (c) => setConversationId(c.id) })} />
            {list.length ? (
              <IconButton
                icon={Trash2}
                accessibilityLabel="Delete conversation"
                size={40}
                color={colors.danger}
                onPress={async () => {
                  if (!conversationId || !(await confirm({ title: 'Delete this conversation?', confirmLabel: 'Delete', destructive: true }))) return;
                  await deleteConversation.mutateAsync(conversationId);
                  goBack('/coach');
                }}
              />
            ) : null}
          </>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top}>
        {messages.error ? (
          <View className="px-5">
            <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={list}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 16, flexGrow: 1 }}
            ListEmptyComponent={
              <View className="flex-1 justify-end gap-4 pb-4">
                <View className="flex-row items-end gap-2">
                  <CoachAvatar />
                  <View className="max-w-[85%] rounded-xl rounded-bl-sm border border-line bg-card px-4 py-3">
                    <Text variant="body">
                      Hey{ctx?.profile.name ? ` ${ctx.profile.name.split(' ')[0]}` : ''}! I’ve looked at your recent training. Ask me for a workout, how to break a plateau, or whether you should rest today.
                    </Text>
                  </View>
                </View>
                <Text variant="overline" tone="muted" style={{ marginTop: 8 }}>
                  Suggested questions
                </Text>
                <View className="gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <PressableScale key={q} onPress={() => submit(q)} accessibilityLabel={q} scaleTo={0.98}>
                      <View className="rounded-lg border border-line bg-card px-4 py-3">
                        <Text variant="small" weight="medium">
                          {q}
                        </Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                showActions={item.id === lastAssistant?.id && !send.isPending}
                onQuickAction={submit}
                onStartWorkout={(w) => void startWorkout({ kind: 'recommendation', recommendation: w })}
              />
            )}
            ListFooterComponent={send.isPending ? <TypingIndicator /> : undefined}
          />
        )}
        <View className="flex-row items-end gap-3 border-t border-line bg-background px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <TextInput
            keyboardAppearance={keyboardAppearanceFor(colors)}
            value={text}
            onChangeText={setText}
            placeholder="Ask about training, recovery, exercises…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={800}
            onSubmitEditing={() => submit(text)}
            blurOnSubmit={false}
            accessibilityLabel="Message the coach"
            className="flex-1 rounded-lg border border-line-strong bg-surface"
            style={{ color: colors.text, fontFamily: fonts.regular, fontSize: 15, maxHeight: 120, minHeight: 48, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 13 }}
          />
          <IconButton icon={Send} variant="accent" size={48} accessibilityLabel="Send message" disabled={!text.trim() || send.isPending} onPress={() => submit(text)} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
