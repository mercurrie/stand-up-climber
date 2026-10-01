// Room codes travel in the URL (?room=K7F2), so you can share a link instead
// of reading out a code.

export function roomCodeFromUrl() {
  return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
}

/** Put the room code in the address bar (or remove it), without reloading. */
export function setRoomCodeInUrl(code) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState(null, '', url);
}

export function inviteLink(code) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('room', code);
  return url.toString();
}
