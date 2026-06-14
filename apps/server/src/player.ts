import {
  Direction,
  START_BOMBS,
  START_POWER,
  START_SPEED,
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
  isBot: boolean;

  // Position in cell coordinates (center of a cell is integer + 0.5).
  x: number;
  y: number;
  dir: Direction = Direction.NONE;

  bombsMax: number = START_BOMBS;
  bombsActive: number = 0;
  power: number = START_POWER;
  speed: number = START_SPEED;
  kick: boolean = false;

  alive: boolean = true;
  lastInputSeq: number = 0;
  lastMoveAtMs: number = 0; // for idle-kick detection

  /** Transport. Bots use a no-op. */
  send: SendFn;

  constructor(id: number, name: string, isBot: boolean, spawnX: number, spawnY: number, send: SendFn) {
    this.id = id;
    this.name = name;
    this.isBot = isBot;
    this.x = spawnX + 0.5;
    this.y = spawnY + 0.5;
    this.send = send;
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
    }
  }
}
