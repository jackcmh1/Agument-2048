import { describe, expect, it } from "vitest";
import { applyAction, canGlobalGrowth, createGame, goals, type State } from "./engine";
import { restoreSavedGame } from "./savedGame";
import { compactAugmentStatus } from "./augmentStatus";

function setup(board = [2, 4, 8]) {
  const s = createGame(123);
  s.board = [...board, ...Array(16 - board.length).fill(0)];
  s.owned = ["A016"];
  s.reached = [...goals];
  return s;
}
const use = (s: State) => applyAction(s, { type: "ability", id: "A016" });
describe("one-shot global growth", () => {
  it("doubles existing tiles then spawns the next tile without points or a movement charge tick", () => {
    const s = setup(); s.next = 4; s.cool.A009 = 10;
    const n = use(s);
    expect(n.board.slice(0, 3)).toEqual([4,8,16]);
    expect(n.board.slice(3).filter(Boolean)).toEqual([4]);
    expect(n.spawned).toBe(1);
    expect(n.turn).toBe(0);
    expect(n.score).toBe(0);
    expect(n.cool.A009).toBe(10);
    expect(n.small).toBe(0);
    expect(n.stats.A016).toBe(1);
    expect(n.owned).toContain("A016");
    expect(canGlobalGrowth(n)).toBe(false);
    expect(use(n)).toBe(n);
    expect(compactAugmentStatus(n, "A016")).toBe("소모됨");
  });
  it("stays consumed through save/reload and undo of later moves", () => {
    const s = setup(); s.owned.push("A015"); s.undoCharges = 2;
    const moved = applyAction(s, { type: "move", direction: "right" });
    expect(moved.history).toHaveLength(1);
    const used = use(moved);
    expect(used.history).toEqual([]);
    const later = applyAction(used, { type: "move", direction: "down" });
    const undone = applyAction(later, { type: "ability", id: "A015" });
    expect(undone.board).toEqual(used.board);
    expect(undone.stats.A016).toBe(1);
    expect(use(undone)).toBe(undone);
    const restored = restoreSavedGame(JSON.stringify({ version: 2, state: undone }))!;
    expect(use(restored)).toBe(restored);
  });
  it("skips spawning on a full board and can produce victory", () => {
    const s = setup([1024,2,4,8,16,32,64,128,256,512,2,4,8,16,32,64]);
    const n = use(s);
    expect(n.board).toEqual(s.board.map((v) => v*2));
    expect(n.spawned).toBe(0);
    expect(n.seed).toBe(s.seed);
    expect(n.phase).toBe("won");
    expect(n.stats.A016).toBe(1);
  });
  it("finishes the next spawn before evaluating victory or milestone rewards", () => {
    const s = setup([1024]);
    const n = use(s);
    expect(n.phase).toBe("won");
    expect(n.spawned).toBe(1);
    const milestone = setup([16]); milestone.reached = [];
    const draft = use(milestone);
    expect(draft.phase).toBe("draft");
    expect(draft.reached).toEqual([32]);
    expect(draft.draft).not.toContain("A016");
  });
  it("honors chosen-birth position and guaranteed 4 while remaining consumed during the selection", () => {
    const s = setup(); s.owned.push("A002", "A003", "A012"); s.spawned = 4;
    const pending = use(s);
    expect(pending.phase).toBe("spawn");
    expect(pending.board.slice(0,3)).toEqual([4,8,16]);
    expect(pending.stats.A016).toBe(1);
    expect(use(pending)).toBe(pending);
    const n = applyAction(pending, { type: "spawn", index: pending.choices[0] });
    expect(n.board[pending.choices[0]]).toBe(4);
    expect(n.spawned).toBe(5);
    expect(n.stats.A016).toBe(1);
  });
  it("uses ordinary spawn rules including small-number law and sixteenth twins", () => {
    const s = setup(); s.owned.push("A012", "A013"); s.next = 4; s.spawned = 15;
    const n = use(s);
    expect(n.board.slice(0,3)).toEqual([4,8,16]);
    expect(n.board.slice(3).filter(Boolean)).toEqual([2,2]);
    expect(n.spawned).toBe(16);
    expect(n.stats.A013).toBe(1);
  });
  it("requires ownership, a nonempty board, no active target and normal play", () => {
    const missing = setup(); missing.owned = [];
    expect(use(missing)).toBe(missing);
    const empty = setup([]); expect(use(empty)).toBe(empty);
    const targeted = setup(); targeted.target = "A009";
    expect(use(targeted)).toBe(targeted);
    for (const phase of ["draft", "spawn", "won", "lost"] as const) {
      const s = setup(); s.phase = phase;
      expect(use(s)).toBe(s);
    }
  });
});
