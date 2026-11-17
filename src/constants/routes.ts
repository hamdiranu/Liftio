import type { Href } from 'expo-router';

/**
 * `exercises/index.tsx` is served at `/exercises`, but SDK 58's typed-routes generator lists it
 * as `/exercises/index`. Keep the canonical URL in one typed place.
 */
export const EXERCISE_LIBRARY = '/exercises' as Href;
