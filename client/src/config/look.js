import { DEFAULT_HAT, HAT_IDS, PLAYER_COLORS } from '@stand-up-climber/shared';

const STORAGE_KEY = 'stand-up-climber:look';

/**
 * Your last-picked colour and hat, remembered in this browser so you look the
 * same next week. Sent when creating/joining a room and used for solo
 * practice. Storage failures are ignored: it's only a convenience.
 *
 * `color` is null until you've picked one, so first-timers let the server
 * hand them a colour nobody's using (rather than everyone defaulting to pink).
 */
export function loadLook() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    // ignore
  }
  return {
    color: PLAYER_COLORS.includes(saved.color) ? saved.color : null,
    hat: HAT_IDS.includes(saved.hat) ? saved.hat : DEFAULT_HAT,
  };
}

export function saveLook(look) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadLook(), ...look }));
  } catch {
    // ignore
  }
}
