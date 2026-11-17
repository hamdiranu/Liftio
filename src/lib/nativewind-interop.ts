import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

// NativeWind only maps `className` on React Native's own components. Register Reanimated's
// animated views so `<Animated.View className="…">` is styled too.
cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });
cssInterop(Animated.ScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });
