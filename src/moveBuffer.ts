import { type Direction } from "./engine";

// Bound the backlog so a held key cannot keep moving the board long after release.
export class MoveBuffer {
  private directions: Direction[] = [];
  push(direction: Direction) {
    if (this.directions.length < 4) this.directions.push(direction);
  }
  take(playable: boolean): Direction | undefined {
    if (!playable) this.clear();
    return this.directions.shift();
  }
  clear() { this.directions = []; }
}
