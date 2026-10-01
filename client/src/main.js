import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { NetworkClient } from './networking/NetworkClient.js';
import { RoomSession } from './networking/RoomSession.js';
import { NetworkRound } from './round/NetworkRound.js';
import { showToast } from './ui/toast.js';
import { Sfx } from './audio/Sfx.js';
import { SERVER_URL } from './config/network.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from './config/display.js';
import { GRAVITY } from './config/gameplay.js';

// Add ?debug to the URL to draw physics bodies.
const debug = new URLSearchParams(window.location.search).has('debug');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  // Lets MenuScene use real HTML inputs, scaled along with the canvas.
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: GRAVITY }, debug },
  },
  scene: [MenuScene, LobbyScene, GameScene, ResultsScene],
});

// One connection, room session and sound player for the whole app, shared
// with scenes via the registry.
const net = new NetworkClient(SERVER_URL);
const session = new RoomSession(net);
const sfx = new Sfx(game);
game.registry.set('session', session);
game.registry.set('sfx', sfx);
net.connect();

// M toggles sound anywhere (except while typing in the menu's inputs).
window.addEventListener('keydown', (event) => {
  if (event.key?.toLowerCase() !== 'm' || event.target instanceof HTMLInputElement) return;
  sfx.toggleMute();
  showToast(sfx.muted ? 'Sound off (M to turn on)' : 'Sound on');
});

// Scene changes driven by the server live here, in one place, rather than
// in every scene that might be showing when they happen.
function switchTo(key, data) {
  game.scene.getScenes(true).forEach((scene) => scene.scene.stop());
  game.scene.start(key, data);
}

session.on('round-start', (msg) => {
  // Late joiners are in the room but not in this round: they stay in the lobby.
  if (!msg.playerIds.includes(session.localId)) return;
  switchTo('Game', { seed: msg.seed, round: new NetworkRound(session, msg) });
});

session.on('disconnected', ({ wasInRoom }) => {
  if (wasInRoom) switchTo('Menu', { error: 'Lost connection to the server.' });
});

session.on('notice', ({ text }) => showToast(text));
session.on('error', ({ message }) => {
  // The menu shows its own errors inline.
  if (!game.scene.isActive('Menu')) showToast(message, { error: true });
});

// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) window.game = game;
