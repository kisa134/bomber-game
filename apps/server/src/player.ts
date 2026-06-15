import {
  Direction,
  START_BOMBS,
  START_POWER,
  START_SPEED,
  START_LIVES,
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
  skin: number;
  isBot: boolean;
  wallet: string | null = null; // verified Solana address, for ranked stats

  // Position in cell coordinates (center of a cell is integer + 0.5).
  x: number;
  y: number;
  dir: Direction = Direction.NONE;

  bombsMax: number = START_BOMBS;
  bombsActive: number = 0;
  power: number = START_POWER;
  speed: number = START_SPEED;
  kick: boolean = false;
  wallPass: boolean = false;

  lives: number = START_LIVES;
  invulnUntilMs: number = 0;
  frags: number = 0;
  deaths: number = 0;
  alive: boolean = true;
  lastInputSeq: number = 0;
  lastMoveAtMs: number = 0; // for idle-kick detection

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
    this.bombsMax = START_BOMBS;
    this.bombsActive = 0;
    this.power = START_POWER;
    this.speed = START_SPEED;
    this.kick = false;
    this.wallPass = false;
    this.lives = START_LIVES;
    this.invulnUntilMs = 0;
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

  applyPowerup(pu: PowerUpType): void {
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
        this.wallPass = true;
        break;
    }
  }
}
