import { describe, expect, it } from "vitest";
import { applyAction, canUndo, createGame, goals, type State } from "./engine";
import { restoreSavedGame } from "./savedGame";
import { augmentStatus, compactAugmentStatus } from "./augmentStatus";

function setup() {
  const s = createGame(123);
  s.board = [2, 2, ...Array(14).fill(0)];
  s.owned = ["A015"];
  s.undoCharges = 2;
  s.reached = [...goals];
  return s;
}
const undo = (s: State) => applyAction(s, { type: "ability", id: "A015" });
const right = (s: State) => applyAction(s, { type: "move", direction: "right" });
describe("charged undo", () => {
  it("restores two successive moves in order and spends charges outside the restored state", () => {
    const start = setup();
    const first = right(start);
    const second = applyAction(first, { type: "move", direction: "down" });
    expect(second.turn).toBe(2);
    const backOne = undo(second), backTwo = undo(backOne);
    for (const [actual, expected] of [[backOne, first], [backTwo, start]]) {
      for (const key of ["board", "turn", "score", "seed", "next", "spawned", "cool", "small", "pendingClean", "reached", "owned"] as const)
        expect(actual[key]).toEqual(expected[key]);
    }
    expect(backOne.undoCharges).toBe(1);
    expect(backTwo.undoCharges).toBe(0);
    expect(backTwo.undoRecharge).toBe(50);
    expect(backTwo.history).toHaveLength(0);
    expect(backTwo.stats.A015).toBe(2);
    expect(undo(backTwo)).toBe(backTwo);
    expect(start.board[0]).toBe(2);
  });
  it("restores the same RNG result on replay without restoring the consumed charge", () => {
    const start = setup(), moved = right(start);
    const replay = right(undo(moved));
    expect(replay.board).toEqual(moved.board);
    expect(replay.seed).toBe(moved.seed);
    expect(replay.undoCharges).toBe(1);
    expect(replay.undoRecharge).toBe(49);
  });
  it("recharges one stored use every fifty valid moves, up to two, without recursive history", () => {
    let s = undo(right(setup()));
    s.undoCharges = 0;
    for (let count = 1; count <= 105; count++) {
      s.board = [2, ...Array(15).fill(0)];
      expect(applyAction(s, { type: "move", direction: "left" })).toBe(s);
      s.board = [2, 2, ...Array(14).fill(0)];
      s = right(s);
      expect(s.undoCharges).toBe(Math.min(2, Math.floor(count / 50)));
      expect(s.history.length).toBeLessThanOrEqual(2);
      expect(s.history.every((snapshot) => !("history" in snapshot) && !("undoCharges" in snapshot))).toBe(true);
      if (count === 49) expect(augmentStatus(s, "A015").imminent).toBe(true);
    }
    expect(s.undoRecharge).toBe(0);
    expect(undo(s).undoCharges).toBe(1);
    expect(undo(s).undoRecharge).toBe(50);
  });
  it("clears history only when another ability actually completes, not on target selection or cancel", () => {
    const start = setup(); start.owned.push("A006");
    const moved = right(start);
    const armed = applyAction(moved, { type: "ability", id: "A006" });
    expect(canUndo(armed)).toBe(false);
    const cancelled = applyAction(armed, { type: "cancel" });
    expect(canUndo(cancelled)).toBe(true);
    const target = armed.board.findIndex((v) => v === 2 || v === 4);
    const used = applyAction(armed, { type: "target", index: target });
    expect(used.history).toHaveLength(0);
    expect(used.undoCharges).toBe(2);
    expect(undo(used)).toBe(used);
  });
  it("starts with two charges on acquisition and prevents undoing reward choices", () => {
    const s = createGame(123); s.phase = "draft"; s.draft = ["A015"]; s.reached = [...goals];
    const picked = applyAction(s, { type: "pick", id: "A015" });
    expect(picked.undoCharges).toBe(2);
    expect(canUndo(picked)).toBe(false);
    const moved = right(setup()); moved.phase = "draft"; moved.draft = ["A001"];
    expect(undo(moved)).toBe(moved);
    const rewarded = applyAction(moved, { type: "pick", id: "A001" });
    expect(rewarded.history).toHaveLength(0);
  });
  it("undoes a victory or defeat and survives saving and reloading", () => {
    const s = setup(); s.board = [1024,1024,...Array(14).fill(0)];
    const won = right(s);
    expect(won.phase).toBe("won");
    const restored = restoreSavedGame(JSON.stringify({ version: 2, state: won }))!;
    expect(canUndo(restored)).toBe(true);
    expect(undo(restored).board).toEqual(s.board);
    expect(undo(restored).phase).toBe("play");
    restored.phase = "lost";
    expect(undo(restored).phase).toBe("play");
  });
  it("treats both tiles in a chosen twin spawn as one reversible move", () => {
    const s = setup(); s.owned.push("A002", "A013"); s.spawned = 79;
    const pending = right(s);
    expect(pending.phase).toBe("spawn");
    expect(undo(pending)).toBe(pending);
    const spawned = applyAction(pending, { type: "spawn", index: pending.choices[0] });
    expect(spawned.history).toHaveLength(1);
    expect(undo(spawned).board).toEqual(s.board);
    expect(undo(spawned).spawned).toBe(79);
  });
  it("keeps undo available after continuing and preserves the endless-play choice", () => {
    const s = setup(); s.board = [1024,1024,...Array(14).fill(0)];
    const continued = applyAction(right(s), { type: "continue" });
    expect(continued.phase).toBe("play");
    expect(canUndo(continued)).toBe(true);
    const undone = undo(continued);
    expect(undone.board).toEqual(s.board);
    expect(undone.continued).toBe(true);
    expect(undone.undoCharges).toBe(1);
    expect(right(undone).phase).toBe("play");
  });
  it("does not grant charges or history to legacy saves and reports stored charges compactly", () => {
    const s = setup(); const old = { ...s } as Partial<State>;
    delete old.history; delete old.undoCharges; delete old.undoRecharge;
    const restored = restoreSavedGame(JSON.stringify({ version: 2, state: old }))!;
    expect(restored.history).toEqual([]);
    expect(restored.undoCharges).toBe(0);
    expect(compactAugmentStatus(s, "A015")).toContain("2/2회");
    expect(canUndo(s)).toBe(false);
  });
});
