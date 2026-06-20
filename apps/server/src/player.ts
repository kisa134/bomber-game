import {
  Direction,
  START_BOMBS,
  START_POWER,
  START_SPEED,
  START_LIVES,
  WALL_PASS_MS,
  MAX_BOMBS,
  MAX_POWER,
  MAX_SPEED,
  SPEED_UP_DELTA,
  PowerUpType,
} from "@bomberpump/shared";

export type SendFn = (bytes: Uint8Array) => void;

export class Player {
  readonly id: number;
  name: string;
  skin: number; // effective skin shown in-match (deduped so it's unique per room)
  preferredSkin: number; // the skin the player actually picked
  isBot: boolean;
  wallet: string | null = null; // verified Solana address, for ranked stats

  // Position in cell coordinates (center of a cell is integer + 0.5).
  x: number;
  y: number;
  dir: Direction = Direction.NONE; // current movement direction (managed by `advance`)
  intent: Direction = Direction.NONE; // held input from the client/bot

  bombsMax: number = START_BOMBS;
  bombsActive: number = 0;
  power: number = START_POWER;
  speed: number = START_SPEED;
  kick: boolean = false;
  wallPass: boolean = false; // recomputed each tick from wallPassUntilMs
  wallPassUntilMs: number = 0;

  lives: number = START_LIVES;
  invulnUntilMs: number = 0;
  respawnAtMs: number = 0; // sandbox bot respawn: wall-clock time to revive (0 = none)
  frags: number = 0;
  deaths: number = 0;
  alive: boolean = true;
  connected: boolean = true;
  disconnectedAtMs: number = 0; // set when the socket drops; grace before removal
  ready: boolean = false; // lobby ready-up state
  wins: number = 0; // matches won in this room's series
  lastInputSeq: number = 0;
  lastMoveAtMs: number = 0; // for idle-kick detection
  lastEmoteAtMs: number = 0; // for emote rate-limit (anti-spam)
  lastChatAtMs: number = 0; // for chat rate-limit (anti-spam)
  /** Tick-stamped input buffer for rollback: server tick -> intended direction. */
  inputs: Map<number, Direction> = new Map();

  send: SendFn;

  constructor(
    id: number,
    name: string,
    skin: number,
    spawnX: number,
    spawnY: number,
    send: SendFn,
    isBot = false,
  ) {
    this.id = id;
    this.name = name;
    this.skin = skin;
    this.preferredSkin = skin;
    this.x = spawnX + 0.5;
    this.y = spawnY + 0.5;
    this.send = send;
    this.isBot = isBot;
  }

  /** Reset per-match state before a (re)start. */
  resetForMatch(spawnX: number, spawnY: number): void {
    this.x = spawnX + 0.5;
    this.y = spawnY + 0.5;
    this.dir = Direction.NONE;
    this.intent = Direction.NONE;
    this.inputs.clear();
    this.bombsMax = START_BOMBS;
    this.bombsActive = 0;
    this.power = START_POWER;
    this.speed = START_SPEED;
    this.kick = false;
    this.wallPass = false;
    this.wallPassUntilMs = 0;
    this.lives = START_LIVES;
    this.invulnUntilMs = 0;
    this.respawnAtMs = 0;
    this.frags = 0;
    this.deaths = 0;
    this.alive = true;
  }

  get cellX(): number {
    return Math.floor(this.x);
  }

  get cellY(): number {
    return Math.floor(this.y);
  }

  applyPowerup(pu: PowerUpType, now = Date.now()): void {
    switch (pu) {
      case PowerUpType.BOMB_UP:
        this.bombsMax = Math.min(MAX_BOMBS, this.bombsMax + 1);
        break;
      case PowerUpType.FIRE_UP:
        this.power = Math.min(MAX_POWER, this.power + 1);
        break;
      case PowerUpType.SPEED_UP:
        this.speed = Math.min(MAX_SPEED, this.speed + SPEED_UP_DELTA);
        break;
      case PowerUpType.KICK:
        this.kick = true;
        break;
      case PowerUpType.WALL_PASS:
        this.wallPassUntilMs = now + WALL_PASS_MS; // temporary
        break;
      case PowerUpType.HEALTH:
        this.lives = Math.min(START_LIVES, this.lives + 1); // rare heal, capped
        break;
    }
  }
}
