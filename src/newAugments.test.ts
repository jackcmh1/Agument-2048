import { describe, expect, it } from "vitest";
import { applyAction, createGame, goals, nextValue, recoverable, type Id, type State } from "./engine";
import { augmentStatus, compactAugmentStatus } from "./augmentStatus";

function setup(owned: Id[], board = [2, 2]) {
  const s = createGame(123);
  s.owned = owned;
  s.board = [...board, ...Array(16 - board.length).fill(0)];
  s.reached = [...goals];
  return s;
}
const move = (s: State) => applyAction(s, { type: "move", direction: "left" });
describe("growth promotion", () => {
  it.each([2, 4, 8])("grows %i without moving, merging, scoring or spawning", (value) => {
    const s = setup(["B05"], [value]);
    const n = applyAction(applyAction(s, { type: "ability", id: "B05" }), { type: "target", index: 0 });
    expect(n.board[0]).toBe(value * 2);
    expect(n.cool.B05).toBe(25);
    expect(n.target).toBeNull();
    expect(n.stats.B05).toBe(1);
    for (const k of ["turn", "score", "spawned", "seed", "small", "pendingClean"] as const)
      expect(n[k]).toBe(s[k]);
  });
  it("rejects ineligible targets, cancels free, and recharges only on valid moves", () => {
    const s = setup(["B05"], [16, 2]);
    const armed = applyAction(s, { type: "ability", id: "B05" });
    for (const index of [0, 2, -1, 16]) expect(applyAction(armed, { type: "target", index })).toBe(armed);
    expect(applyAction(armed, { type: "cancel" }).cool.B05).toBeUndefined();
    let n = applyAction(armed, { type: "target", index: 1 });
    for (let remaining = 24; remaining >= 0; remaining--) {
      n.board = setup([], [2]).board;
      expect(move(n)).toBe(n);
      n.board = setup([], [2, 2]).board;
      n = move(n);
      expect(n.cool.B05).toBe(remaining);
      if (remaining) expect(applyAction(n, { type: "ability", id: "B05" })).toBe(n);
    }
    const noTargets = setup(["B05"], [16, 32]);
    expect(applyAction(noTargets, { type: "ability", id: "B05" })).toBe(noTargets);
    expect(compactAugmentStatus(noTargets, "B05")).toContain("타일 필요");
    const stuck = setup(["B05"], [2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2]);
    expect(recoverable(stuck)).toBe(true);
    stuck.cool.B05 = 1;
    expect(recoverable(stuck)).toBe(false);
  });
});
describe("small number law", () => {
  it("overrides a stored next 4 immediately while preserving G03's fifth spawn", () => {
    const s = setup(["G04"]);
    s.next = 4;
    expect(nextValue(s)).toBe(2);
    expect(move(s).board.reduce((a, b) => a + b, 0)).toBe(6);
    s.owned.push("G03");
    s.spawned = 4;
    expect(nextValue(s)).toBe(4);
    const n = move(s);
    expect(n.stats.G03).toBe(1);
    expect(nextValue(n)).toBe(2);
  });
});
describe("twin birth", () => {
  it("adds exactly one same-number tile on the sixteenth event, counting the pair once", () => {
    let s = setup(["G04", "G05"]);
    for (let i = 1; i <= 17; i++) {
      s.board = setup([], [2, 2]).board;
      s = move(s);
      expect(s.spawned).toBe(i);
      expect(s.board.reduce((a, b) => a + b, 0)).toBe(i === 16 ? 8 : 6);
    }
    expect(s.stats.G05).toBe(1);
    expect(augmentStatus({ ...s, spawned: 15 }, "G05").imminent).toBe(true);
    expect(compactAugmentStatus(s, "G05")).toBe("생성 15회 남음");
  });
  it("combines with chosen birth and G03 by copying the actual generated 4", () => {
    const s = setup(["G02", "G03", "G04", "G05"]);
    s.spawned = 79;
    const choice = move(s);
    expect(choice.phase).toBe("spawn");
    expect(choice.spawned).toBe(79);
    const n = applyAction(choice, { type: "spawn", index: choice.choices[0] });
    expect(n.spawned).toBe(80);
    expect(n.board.filter((v) => v === 4)).toHaveLength(3);
    expect(n.stats).toMatchObject({ G02: 1, G03: 1, G05: 1 });
  });
  it("falls back to a single tile when only one cell is available", () => {
    const s = setup(["G04", "G05"], [0,2,4,8,16,32,64,128,256,512,1024,2,4,8,16,32]);
    s.spawned = 15;
    const n = move(s);
    expect(n.board.filter(Boolean)).toHaveLength(16);
    expect(n.board.reduce((a,b) => a+b,0)).toBe(s.board.reduce((a,b) => a+b,0)+2);
    expect(n.spawned).toBe(16);
    expect(n.stats.G05).toBeUndefined();
  });
  it("waits through cancelled spawns and is not advanced by duplication", () => {
    const s = setup(["M01", "G05", "B03"], [2,2,4,4]);
    s.spawned = 15;
    const cancelled = move(s);
    expect(cancelled.spawned).toBe(15);
    expect(cancelled.stats.G05).toBeUndefined();
    const armed = applyAction(cancelled, { type: "ability", id: "B03" });
    const copied = applyAction(applyAction(armed, { type: "target", index: 0 }), { type: "target", index: 15 });
    expect(copied.spawned).toBe(15);
    expect(copied.stats.G05).toBeUndefined();
  });
});
