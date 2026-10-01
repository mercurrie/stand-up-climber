/** 0..1 → "87%". Floors so nobody sees 100% until they've actually finished. */
export function formatPercent(fraction) {
  return `${Math.floor(fraction * 100)}%`;
}

/** Milliseconds → "1:05". */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export const MEDALS = ['🥇', '🥈', '🥉'];

/** "Bartholomew" → "Barthol…" when space is tight. */
export function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** "SAM IS HOSTING" / "YOU ARE HOSTING" (solo practice uses the name "You"). */
export function hostingLine(name) {
  const verb = name.toLowerCase() === 'you' ? 'ARE' : 'IS';
  return `${name.toUpperCase()} ${verb} HOSTING\nSTAND-UP NEXT WEEK!`;
}
