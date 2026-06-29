export interface WorldUpdate {
  players: Array<{
    id: string;
    x: number;
    y: number;
    skinId: number;
    hp: number;
    maxHp: number;
    level: number;
  }>;
  entities: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
  }>;
  tick: number;
}

export class WorldSocket {
  private ws: WebSocket | null = null;
  onUpdate: ((update: WorldUpdate) => void) | null = null;
  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;

  connect(url: string): void {
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => this.onConnect?.();
      this.ws.onclose = () => this.onDisconnect?.();
      this.ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as WorldUpdate;
          this.onUpdate?.(data);
        } catch {
          // ignore invalid messages
        }
      };
    } catch {
      this.onDisconnect?.();
    }
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
