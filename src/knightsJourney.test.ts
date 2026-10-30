import { describe, expect, it } from "vitest";
import { createGame, goals, applyAction, knightTargets, canKnightMerge, canMove, recoverable, type State } from "./engine";

function setup(value = 2) {
  const s = createGame(123);
  s.board = Array(16).fill(0);
  s.board[0] = s.board[6] = value;
  s.owned = ["B06"];
  s.reached = [...goals];
  return s;
}
const arm = (s: State) => applyAction(s, { type: "ability", id: "B06" });
const select = (s: State, index: number) => applyAction(s, { type: "target", index });
describe("knights journey", () => {
  it("respects two-dimensional knight geometry without wrapping at board edges", () => {
    const s = setup();
    s.board.fill(2);
    expect(knightTargets(s, 0)).toEqual([6, 9]);
    expect(knightTargets(s, 3)).toEqual([5, 10]);
    expect(knightTargets(s, 6)).toEqual([0, 8, 13, 15]);
    expect(knightTargets(s, 15)).toEqual([6, 9]);
    for (const index of [-1, 16, 0.5]) expect(knightTargets(s, index)).toEqual([]);
    s.board[6] = 4;
    expect(knightTargets(s, 0)).toEqual([9]);
  });
  it("merges into the second cell, awards points, and preserves move/spawn/RNG counters", () => {
    const s = setup(128);
    const first = select(arm(s), 0);
    expect(first.knightSource).toBe(0);
    expect(applyAction(first, { type: "move", direction: "right" })).toBe(first);
    const n = select(first, 6);
    expect(n.board[0]).toBe(0);
    expect(n.board[6]).toBe(256);
    expect(n.score).toBe(256);
    expect(n.cool.B06).toBe(40);
    expect(n.stats.B06).toBe(1);
    expect(n.target).toBeNull();
    expect(n.knightSource).toBeNull();
    for (const key of ["turn", "spawned", "seed", "next"] as const) expect(n[key]).toBe(s[key]);
    expect(select(select(arm(s), 6), 0).board[0]).toBe(256);
  });
  it("rejects invalid targets and allows selection reset, cancellation and save/resume", () => {
    const s = setup();
    s.board[1] = 2;
    s.board[9] = 4;
    const armed = arm(s);
    expect(select(armed, 1)).toBe(armed);
    const first = select(armed, 0);
    for (const index of [-1, 16, 0.5, 1, 2, 9]) expect(select(first, index)).toBe(first);
    expect(select(first, 0).knightSource).toBeNull();
    for (const state of [armed, first]) {
      const cancelled = applyAction(state, { type: "cancel" });
      expect(cancelled.target).toBeNull();
      expect(cancelled.knightSource).toBeNull();
      expect(cancelled.board).toEqual(s.board);
      expect(cancelled.cool.B06).toBeUndefined();
      expect(arm(state).knightSource).toBeNull();
    }
    expect(select(JSON.parse(JSON.stringify(first)), 6).board[6]).toBe(4);
    const noPair = setup(); noPair.board[6] = 4;
    expect(canKnightMerge(noPair)).toBe(false);
    expect(arm(noPair)).toBe(noPair);
    const unowned = setup(); unowned.owned = [];
    expect(arm(unowned)).toBe(unowned);
  });
  it("feeds 2+2 into M02 while protecting the newly merged tile", () => {
    const s = setup(); s.owned.push("M02"); s.small = 2; s.board[15] = 2;
    const n = select(select(arm(s), 0), 6);
    expect(n.board[6]).toBe(4);
    expect(n.board[15]).toBe(0);
    expect(n.small).toBe(0);
    expect(n.pendingClean).toBe(0);
    expect(n.stats.M02).toBe(1);
  });
  it("handles milestones and victory after the ability merge", () => {
    const s = setup(16); s.reached = [];
    expect(select(select(arm(s), 0), 6).phase).toBe("draft");
    const won = select(select(arm(setup(1024)), 0), 6);
    expect(won.phase).toBe("won");
    expect(won.board[6]).toBe(2048);
  });
  it("can recover a blocked full board only when ready and recharges on forty valid moves", () => {
    let s = setup();
    s.board = [2,4,8,16,32,64,2,128,256,512,1024,4,8,16,32,64];
    expect(canMove(s.board)).toBe(false);
    expect(recoverable(s)).toBe(true);
    s = select(select(arm(s), 0), 6);
    expect(canMove(s.board)).toBe(true);
    for (let remaining = 39; remaining >= 0; remaining--) {
      s.board = [2, ...Array(15).fill(0)];
      expect(applyAction(s, { type: "move", direction: "left" })).toBe(s);
      s.board = [2,2,...Array(14).fill(0)];
      s = applyAction(s, { type: "move", direction: "left" });
      expect(s.cool.B06).toBe(remaining);
      if (remaining) expect(arm(s)).toBe(s);
    }
    s.board = setup().board;
    expect(arm(s).target).toBe("B06");
  });
});
