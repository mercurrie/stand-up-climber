import Phaser from 'phaser';
import { Rules } from '@stand-up-climber/shared';
import { SERVER_URL } from '../config/network.js';
import { COLORS, FONT_FAMILY, GAME_WIDTH } from '../config/display.js';
import { roomCodeFromUrl, setRoomCodeInUrl } from '../networking/inviteLink.js';
import { addMuteButton } from '../ui/MuteButton.js';
import { loadLook } from '../config/look.js';

const NAME_STORAGE_KEY = 'stand-up-climber:name';
// Re-enable the buttons if the server never answers.
const REQUEST_TIMEOUT_MS = 5000;

const FORM_HTML = `
  <form class="menu-form" autocomplete="off">
    <label>Your name
      <input name="name" maxlength="${Rules.MAX_NAME_LENGTH}" placeholder="e.g. Sam" />
    </label>
    <button type="button" data-action="create">Create room</button>
    <div class="divider">or join one</div>
    <div class="join-row">
      <label>Room code
        <input name="code" class="code-input" maxlength="${Rules.ROOM_CODE_LENGTH}" placeholder="K7F2" />
      </label>
      <button type="submit" data-action="join">Join</button>
    </div>
    <p class="error"></p>
    <button type="button" class="secondary" data-action="practice">Practice solo</button>
  </form>
`;

/**
 * Title screen: enter a name, then create a room, join one by code, or
 * practise solo. A ?room=CODE link pre-fills the code.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  /** @param {{ error?: string }} data  Message to show, e.g. after a disconnect. */
  init(data) {
    this.initialError = data?.error ?? '';
  }

  create() {
    this.session = this.registry.get('session');
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 110, 'STAND-UP\nCLIMBER', {
      fontFamily: FONT_FAMILY, fontSize: '56px', fontStyle: 'bold', color: COLORS.accent, align: 'center',
    }).setOrigin(0.5);
    this.statusText = this.add.text(cx, 205, '', {
      fontFamily: FONT_FAMILY, fontSize: '15px', color: COLORS.textMuted,
    }).setOrigin(0.5);

    this.form = this.add.dom(cx, 470).createFromHTML(FORM_HTML);
    const node = this.form.node;
    this.nameInput = node.querySelector('input[name="name"]');
    this.codeInput = node.querySelector('input[name="code"]');
    this.errorText = node.querySelector('.error');
    this.buttons = [...node.querySelectorAll('button')];

    this.nameInput.value = loadName();
    this.codeInput.value = roomCodeFromUrl();
    this.showError(this.initialError);

    node.querySelector('[data-action="create"]').addEventListener('click', () => this.createRoom());
    node.querySelector('[data-action="practice"]').addEventListener('click', () => this.scene.start('Game'));
    node.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (this.codeInput.value.trim()) this.joinRoom();
      else this.createRoom();
    });

    // If you arrived via an invite link, jump straight to the name field.
    (this.nameInput.value ? this.codeInput : this.nameInput).focus();

    const onRoom = (room) => this.enterLobby(room);
    const onError = ({ message }) => {
      this.showError(message);
      this.setBusy(false);
    };
    this.session.on('room', onRoom);
    this.session.on('error', onError);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.session.off('room', onRoom);
      this.session.off('error', onError);
      clearTimeout(this.busyTimer);
    });

    addMuteButton(this);
    this.updateStatus();
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updateStatus() });
  }

  createRoom() {
    const name = this.readName();
    if (!name) return;
    this.request(() => this.session.createRoom(name, loadLook()));
  }

  joinRoom() {
    const name = this.readName();
    const code = this.codeInput.value.trim().toUpperCase();
    if (!name) return;
    if (code.length !== Rules.ROOM_CODE_LENGTH) {
      this.showError(`Room codes are ${Rules.ROOM_CODE_LENGTH} characters`);
      return;
    }
    this.request(() => this.session.joinRoom(code, name, loadLook()));
  }

  /** Send a request, with the buttons disabled until the server answers. */
  request(send) {
    this.showError('');
    if (!send()) {
      this.showError('Not connected to the server yet…');
      return;
    }
    this.setBusy(true);
    this.busyTimer = setTimeout(() => {
      this.setBusy(false);
      this.showError('The server did not respond. Try again?');
    }, REQUEST_TIMEOUT_MS);
  }

  readName() {
    const name = this.nameInput.value.trim();
    if (!name) {
      this.showError('Enter your name first');
      this.nameInput.focus();
      return null;
    }
    saveName(name);
    return name;
  }

  enterLobby(room) {
    setRoomCodeInUrl(room.code);
    this.scene.start('Lobby');
  }

  setBusy(busy) {
    clearTimeout(this.busyTimer);
    this.buttons.forEach((b) => { b.disabled = busy; });
  }

  showError(message) {
    this.errorText.textContent = message;
  }

  updateStatus() {
    const net = this.session.net;
    if (net.isConnected) {
      const ping = net.latencyMs === null ? '' : `  ·  ping ${net.latencyMs} ms`;
      this.statusText.setText(`Connected ✓${ping}`).setColor(COLORS.good);
    } else {
      this.statusText.setText(`Connecting to ${SERVER_URL}…`).setColor(COLORS.textMuted);
    }
  }
}

// Remembering your name is a convenience only, so storage failures (private
// browsing, blocked storage) are ignored.
function loadName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // ignore
  }
}
