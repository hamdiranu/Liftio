import { Stack } from 'expo-router';

import { useColors } from '@/constants/theme';

export default function ExercisesLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
