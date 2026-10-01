const VISIBLE_MS = 3000;

/**
 * Short notices like "Sam left". Plain DOM rather than Phaser so they appear
 * on top of whatever scene is running and survive scene changes.
 */
export function showToast(text, { error = false } = {}) {
  const container = document.getElementById('toasts');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = error ? 'toast toast-error' : 'toast';
  toast.textContent = text;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-hide'), VISIBLE_MS);
  setTimeout(() => toast.remove(), VISIBLE_MS + 400);
}
