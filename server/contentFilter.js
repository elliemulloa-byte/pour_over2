/**
 * Simple content filter to block inappropriate comments.
 * Rejects or censors common profanity and offensive terms.
 */
const BLOCKED = [
  /\b(shit|fuck|asshole|bitch)\b/gi,
  /\b(nigger|nigga|fag|retard)\b/gi,
  /\b(kill|die)\s+(yourself|u|you)\b/gi,
];

export function isCommentInappropriate(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.trim();
  if (normalized.length < 2) return false;
  return BLOCKED.some((re) => re.test(normalized));
}
