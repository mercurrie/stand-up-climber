import Phaser from 'phaser';
import { Rules } from '@stand-up-climber/shared';
import { Level } from '../level/Level.js';
import { LEVEL_1 } from '../level/level1.js';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { ObstacleField } from '../entities/ObstacleField.js';
import { createObstacleSchedule } from '../level/obstacleSchedule.js';
import { Effects } from '../effects/Effects.js';
import { SoloRound } from '../round/SoloRound.js';
import { Hud } from '../ui/Hud.js';
import { ObstacleWarnings } from '../ui/ObstacleWarnings.js';
import { ProgressTrack } from '../ui/ProgressTrack.js';
import { CAMERA } from '../config/gameplay.js';
import { COLORS, GAME_HEIGHT, PLAYER_COLORS } from '../config/display.js';

// Arcade only reports the frame *after* overlap, so allow a little slack when
// deciding whether the player was above a platform last frame.
const LANDING_TOLERANCE = 2;
// Pause on the final frame before showing results, so the ending registers.
const RESULTS_DELAY_MS = 1800;

const HIT_WORDS = ['BONK!', 'OOF!', 'OUCH!', 'NOPE!', 'BACK TO\nTHE START!'];

/**
 * One round of climbing.
 *
 * Time: everything is driven by `round.startAt` (a local Date.now() value).
 * Obstacles, the countdown and the timer are all derived from it each frame,
 * so in multiplayer they line up across browsers as long as everyone agrees
 * on the start time.
 *
 * Progress: the height of the highest platform you've landed on, as a
 * fraction of the course (0..1). Jump apexes don't count, so progress only
 * moves when you've actually made it somewhere.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  /**
   * @param {{ seed?: number, round?: object }} data
   *   seed:  obstacle seed. In multiplayer the server provides it so everyone
   *          gets the same obstacles; solo play picks one.
   *   round: the round to play (see SoloRound for the interface). Defaults to
   *          a solo practice round.
   */
  init(data) {
    this.seed = data?.seed ?? Phaser.Math.Between(1, 1e9);
    this.round = data?.round ?? null;
  }

  create() {
    this.isSolo = !this.round;
    this.round ??= new SoloRound({ player: { id: 'local', name: 'You', color: PLAYER_COLORS[0] } });
    const playerColor = this.round.localPlayer.color;

    this.level = new Level(LEVEL_1);
    const { width, worldHeight } = this.level;

    this.physics.world.setBounds(0, 0, width, worldHeight);
    this.level.drawBackground(this);
    this.platforms = this.level.createPlatforms(this);
    this.effects = new Effects(this);
    this.obstacles = new ObstacleField(this, createObstacleSchedule(this.seed, this.level), this.effects);

    const start = this.level.startPosition;
    this.player = new LocalPlayer(this, start.x, start.y, playerColor);
    this.progress = { current: 0, best: 0, finished: false };
    this.lastReportedProgress = null;

    // One-way platforms: the process callback rejects collisions unless the
    // player is falling onto the top surface. The collide callback is the
    // automatic jump.
    this.physics.add.collider(
      this.player.hitbox,
      this.platforms,
      (_hitbox, platform) => this.handleLanding(platform),
      (_hitbox, platform) => this.canLand(platform),
    );

    const camera = this.cameras.main;
    camera.setBounds(0, 0, width, worldHeight);
    camera.startFollow(this.player.hitbox, true, 1, CAMERA.LERP_Y);
    camera.setFollowOffset(0, GAME_HEIGHT * CAMERA.FOLLOW_OFFSET_Y);

    this.sfx = this.registry.get('sfx');
    this.hud = new Hud(this, this.sfx);
    this.warnings = new ObstacleWarnings(this, this.obstacles, (x) => this.hud.clearTopAt(x));
    this.track = new ProgressTrack(this);
    this.hud.announce('← → or A D to move\nYou bounce automatically!', {
      holdMs: Math.max(0, this.round.startAt - Date.now()),
      color: COLORS.text,
    });

    // Other players: sprites that follow server snapshots (NetworkRound only).
    this.remotePlayers = new Map();
    this.round.on('snapshot', this.onSnapshot, this);

    this.phase = null;
    this.round.on('first-finish', this.onFirstFinish, this);
    this.round.once('ended', this.onRoundEnded, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.round.destroy());

    if (this.isSolo) {
      // Practice only: restart with a fresh seed (new obstacle pattern).
      this.input.keyboard.on('keydown-R', () => this.scene.restart({}));
    }
  }

  update(_time, delta) {
    const now = Date.now();
    const phase = this.round.phase(now);
    if (phase !== this.phase) this.onPhaseChange(phase);

    this.player.update(delta);
    this.obstacles.update(now - this.round.startAt);

    // Each client only checks hits against its own player. Remote players
    // detect their own hits and we just see their progress/position change.
    if (!this.progress.finished && this.player.canBeHit && this.obstacles.findHit(this.player.bounds)) {
      this.onPlayerHit();
    }

    this.remotePlayers.forEach((remote) => remote.update(delta));
    this.round.reportPosition({
      x: Math.round(this.player.body.center.x),
      y: Math.round(this.player.body.bottom),
      flip: this.player.sprite.flipX,
      hidden: !this.player.sprite.visible,
    }, now);

    this.round.update(now);
    this.hud.update({ now, phase, round: this.round, ...this.progress });
    this.warnings.update();
    this.updateTrack();
  }

  updateTrack() {
    const fractionAt = (worldY) => this.level.toHeight(worldY) / this.level.goalHeight;
    const entries = [{ color: this.player.color, fraction: fractionAt(this.player.footY), isLocal: true }];
    for (const remote of this.remotePlayers.values()) {
      if (remote.sprite.visible) entries.push({ color: remote.color, fraction: fractionAt(remote.sprite.y), isLocal: false });
    }
    this.track.update(entries);
  }

  onSnapshot({ players }) {
    const seen = new Set();
    for (const state of players) {
      const info = this.round.roster.get(state.id);
      if (!info) continue;
      seen.add(state.id);
      if (!this.remotePlayers.has(state.id)) this.remotePlayers.set(state.id, new RemotePlayer(this, info));
      this.remotePlayers.get(state.id).setTarget(state);
    }
    // Anyone missing from the snapshot has left.
    for (const [id, remote] of this.remotePlayers) {
      if (!seen.has(id)) {
        remote.destroy();
        this.remotePlayers.delete(id);
      }
    }
  }

  onPhaseChange(phase) {
    this.phase = phase;
    this.player.setFrozen(phase === 'countdown' || phase === 'ended');
  }

  onFirstFinish({ name, isLocal }) {
    const seconds = Rules.FINISH_WINDOW_MS / 1000;
    const message = isLocal
      ? `YOU MADE IT! 🎉\nOthers have ${seconds}s to catch up`
      : `${name.toUpperCase()} REACHED THE TOP!\n${seconds} seconds left!`;
    this.hud.announce(message, { holdMs: 3500 });
  }

  onRoundEnded({ rankings }) {
    const message = this.progress.finished ? 'FINISHED!' : "TIME'S UP!";
    this.hud.announce(message, { holdMs: null, color: this.progress.finished ? COLORS.good : COLORS.bad });
    this.time.delayedCall(RESULTS_DELAY_MS, () => {
      this.scene.start('Results', { rankings, localId: this.round.localId, solo: this.isSolo });
    });
  }

  onPlayerHit() {
    const { x, y } = this.player.body.center;
    this.effects.burst(x, y, this.player.color, 24);
    this.effects.floatingText(x, y - 20, Phaser.Utils.Array.GetRandom(HIT_WORDS), COLORS.bad);
    this.cameras.main.shake(180, 0.01);
    this.sfx.hit();

    const start = this.level.startPosition;
    this.player.hit(start.x, start.y);
    this.setProgress(0);
  }

  canLand(platform) {
    const body = this.player.body;
    const wasAbove = body.prev.y + body.height <= platform.body.top + LANDING_TOLERANCE;
    return body.velocity.y >= 0 && wasAbove;
  }

  handleLanding(platform) {
    this.player.bounce();
    if (this.player.frozen) return;

    const height = this.level.toHeight(platform.body.top) / this.level.goalHeight;
    this.effects.dust(this.player.body.center.x, this.player.body.bottom);
    this.sfx.bounce(height);

    if (platform.getData('goal') && !this.progress.finished) {
      this.progress.finished = true;
      this.effects.burst(this.player.body.center.x, this.player.body.bottom, 0xffd166, 40);
      this.sfx.finish();
    }
    this.setProgress(height);
  }

  /** Update progress and report it to the round, but only when it changed. */
  setProgress(current) {
    const p = this.progress;
    p.current = current;
    p.best = Math.max(p.best, current);
    const key = `${p.current}|${p.best}|${p.finished}`;
    if (key === this.lastReportedProgress) return;
    this.lastReportedProgress = key;
    this.round.reportProgress({ ...p });
  }
}
