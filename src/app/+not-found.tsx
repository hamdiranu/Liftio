import { router } from 'expo-router';
import { View } from 'react-native';

import { Compass } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';

export default function NotFoundScreen() {
  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center">
        <EmptyState icon={Compass} title="This page doesn’t exist" body="The link may be out of date." actionLabel="Go home" onAction={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
