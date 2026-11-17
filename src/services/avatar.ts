import * as ImagePicker from 'expo-image-picker';

import { GUEST_USER_ID } from '@/features/auth/store';
import { supabase } from './supabase';

/** Lets the user pick a square photo. Returns a local URI, or null if cancelled. */
export async function pickAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access in Settings to choose a profile photo.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

/**
 * Uploads the photo to the `avatars` bucket when the user has a cloud account and returns its
 * public URL; otherwise the local file URI is kept (it stays on this device only).
 */
export async function persistAvatar(userId: string, localUri: string): Promise<string> {
  if (!supabase || userId === GUEST_USER_ID) return localUri;
  try {
    const response = await fetch(localUri);
    const body = await response.arrayBuffer();
    const path = `${userId}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  } catch (error) {
    console.warn('[avatar] upload failed, keeping local photo', error);
    return localUri;
  }
}
