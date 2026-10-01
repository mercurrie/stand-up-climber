import { DEFAULT_HAT } from '@stand-up-climber/shared';

/** One connected person in a room. Holds their look and latest reported position. */
export class Player {
  constructor({ id, socket, name }) {
    this.id = id;
    this.socket = socket;
    this.name = name;
    // Assigned by GameRoom when they join (colours must be unique per room).
    this.color = null;
    this.hat = DEFAULT_HAT;
    // Latest position from PLAYER_STATE, relayed to others in snapshots.
    this.x = 0;
    this.y = 0;
    this.flip = false;
    this.hidden = false;
  }

  send(msg) {
    if (this.socket.readyState === this.socket.OPEN) this.socket.send(JSON.stringify(msg));
  }

  toJSON() {
    return { id: this.id, name: this.name, color: this.color, hat: this.hat };
  }
}
