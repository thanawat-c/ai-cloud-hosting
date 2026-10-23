/**
 * Safely format any URL to ensure it has http:// or https:// protocol.
 * Prevents browser "about:blank#blocked" security errors on target="_blank" anchor tags.
 */
export function formatExternalUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `http://${trimmed}`;
}
