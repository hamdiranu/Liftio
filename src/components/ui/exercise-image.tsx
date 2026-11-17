import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

import { EXERCISE_IMAGES, GYM_IMAGES } from '@/constants/image-manifest';
import { useColors } from '@/constants/theme';
import { exerciseImagePublicUrl } from '@/services/supabase';
import type { MuscleGroup } from '@/types';
import { Activity, BicepsFlexed, Dumbbell, Footprints, Layers, Target, type IconComponent } from './icons';
import { Text } from './text';
import { ThemeScope } from './theme-scope';

const GROUP_ICON: Record<MuscleGroup, IconComponent> = {
  chest: Dumbbell,
  back: Layers,
  shoulders: Target,
  arms: BicepsFlexed,
  legs: Footprints,
  core: Activity,
};

/** Stable per-slug variation so fallback cards don't all look identical. */
function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function FallbackArt({ seed, group, label, showBadge = true }: { seed: string; group?: MuscleGroup; label?: string; showBadge?: boolean }) {
  const colors = useColors();
  const h = hash(seed);
  const cx = 20 + (h % 60);
  const cy = 10 + ((h >> 3) % 40);
  const Icon = group ? GROUP_ICON[group] : Dumbbell;
  const gradId = `g${h}`;
  return (
    <View style={{ flex: 1, overflow: 'hidden' }} accessibilityLabel={label ? `${label} illustration` : undefined}>
      <LinearGradient colors={['#1F1A16', '#141210', '#0E0E0E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id={gradId} cx={`${cx}%`} cy={`${cy}%`} rx="70%" ry="70%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.38} />
            <Stop offset="0.6" stopColor={colors.accentDeep} stopOpacity={0.08} />
            <Stop offset="1" stopColor={colors.accentDeep} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        {Array.from({ length: 7 }, (_, i) => (
          <Line
            key={i}
            x1={`${-20 + i * 22}%`}
            y1="110%"
            x2={`${30 + i * 22}%`}
            y2="-10%"
            stroke="#FFFFFF"
            strokeOpacity={0.025}
            strokeWidth={14}
          />
        ))}
      </Svg>
      <View style={{ position: 'absolute', right: -14, bottom: -18, opacity: 0.16, transform: [{ rotate: '-12deg' }] }}>
        <Icon size={120} color={colors.accentSoft} strokeWidth={1.4} />
      </View>
      {showBadge ? (
        <View style={{ position: 'absolute', left: 14, top: 14 }}>
          <View className="h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
            <Icon size={18} color={colors.accent} strokeWidth={2} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export interface ExerciseImageProps {
  slug: string;
  name?: string;
  muscleGroup?: MuscleGroup;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  overlay?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

/** Exercise photo: bundled file → Supabase Storage → designed fallback art. */
export const ExerciseImage = memo(function ExerciseImage({
  slug,
  name,
  muscleGroup,
  style,
  radius = 16,
  overlay = false,
  priority = 'normal',
}: ExerciseImageProps) {
  const colors = useColors();
  const local = EXERCISE_IMAGES[slug];
  const remote = local ? null : exerciseImagePublicUrl(slug);
  const [failed, setFailed] = useState(false);
  const source: ImageSource | number | null = local ?? (remote ? { uri: remote } : null);

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: colors.card }, style]}>
      {source && !failed ? (
        <Image
          source={source}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={250}
          priority={priority}
          cachePolicy="memory-disk"
          recyclingKey={slug}
          onError={() => setFailed(true)}
          accessibilityLabel={name ? `${name} exercise photo` : undefined}
        />
      ) : (
        <FallbackArt seed={slug} group={muscleGroup} label={name} />
      )}
      {overlay ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(16,16,16,0)', 'rgba(16,16,16,0.35)', 'rgba(16,16,16,0.92)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
});

/** Large cinematic hero with a dark overlay and warm ambient light. */
export function GymHero({
  image = 'hero',
  height = 220,
  children,
  style,
  focus = 'center',
}: {
  image?: string;
  height?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Where to anchor the crop; use 'top' for portraits so faces stay in frame. */
  focus?: 'top' | 'center';
}) {
  const colors = useColors();
  // Screens without their own photo reuse the main hero rather than falling back to art.
  const local = GYM_IMAGES[image] ?? GYM_IMAGES.hero;
  return (
    <View style={[{ height, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.card }, style]}>
      {local ? (
        <Image
          source={local}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={focus === 'top' ? { top: '12%', left: '50%' } : 'center'}
          transition={300}
          priority="high"
        />
      ) : (
        <View style={StyleSheet.absoluteFill}>
          <FallbackArt seed={`hero-${image}`} showBadge={false} />
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,138,54,0.22)', 'rgba(16,16,16,0.15)', 'rgba(16,16,16,0.94)']}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ThemeScope mode="dark" style={{ flex: 1, justifyContent: 'flex-end', padding: 18 }}>
        {children}
      </ThemeScope>
    </View>
  );
}

/**
 * Full-screen gym photo for `Screen`'s `backdrop`, darkened so dark-theme text and cards stay
 * readable on top of it. Render the screen inside `<ThemeScope mode="dark">` so light mode matches.
 */
export function GymBackdrop({ image }: { image: string }) {
  const local = GYM_IMAGES[image] ?? GYM_IMAGES.hero;
  if (!local) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={local} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} priority="high" />
      <LinearGradient
        colors={['rgba(16,16,16,0.62)', 'rgba(16,16,16,0.84)', 'rgba(16,16,16,0.95)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,138,54,0.22)', 'rgba(255,138,54,0)']}
        locations={[0, 0.6]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function ImageLabel({ children }: { children: string }) {
  return (
    <Text variant="caption" weight="semibold" numberOfLines={1}>
      {children}
    </Text>
  );
}
