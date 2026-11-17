import { router, type Href } from 'expo-router';

/** Goes back when there is history (normal in-app flow), otherwise replaces with `fallback` (deep links, web reloads). */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
