import { DEFAULT_HAT, HAT_IDS, PLAYER_COLORS } from '@stand-up-climber/shared';

const STORAGE_KEY = 'stand-up-climber:look';

/**
 * Your last-picked colour and hat, remembered in this browser so you look the
 * same next week. Sent as a preference when creating/joining a room (the
 * server may give you a different colour if yours is taken) and used for solo
 * practice. Storage failures are ignored: it's only a convenience.
 */
export function loadLook() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    // ignore
  }
  return {
    color: PLAYER_COLORS.includes(saved.color) ? saved.color : PLAYER_COLORS[0],
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
