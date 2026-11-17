/** Native platforms don't need cross-origin isolation; see the .web.ts variant. */
export function ensureCrossOriginIsolation(): boolean {
  return true;
}
