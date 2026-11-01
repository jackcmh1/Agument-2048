import { describe, it, expect } from "vitest";
import { applyAction, createGame, goals, nextValue, chosenBirthRemaining } from "./engine";
import { gameSession } from "./gameSession";

describe("test game session", () => {
  it("keeps the normal URL and save key unchanged", () => {
    const normal = gameSession("");
    expect(normal.testMode).toBe(false);
    expect(normal.storageKey).toBe("augmented2048-v1");
    expect(normal.newGame(123)).toEqual(createGame(123));
    expect(gameSession("?latest=test").testMode).toBe(false);
    expect(gameSession("?test").storageKey).not.toBe(normal.storageKey);
  });
  it("tests A002 from acquisition separately from A003's global fifth-spawn rule", () => {
    const s = gameSession("?test").newGame();
    expect(s.board.slice(0, 4)).toEqual([1024, 1024, 0, 0]);
    expect(s.board).toHaveLength(16);
    expect(s.owned).toEqual(["A001", "A002", "A003"]);
    expect(s.cool).toEqual({});
    expect(s.spawned).toBe(4);
    expect(nextValue(s)).toBe(4);
    expect(s.reached).toEqual(goals);
    expect(s.phase).toBe("play");
    let moved = applyAction(s, { type: "move", direction: "left" });
    expect(moved.phase).toBe("play");
    expect(moved.spawned).toBe(5);
    expect(moved.stats.A003).toBe(1);
    expect(moved.stats.A002).toBeUndefined();
    expect(moved.board).toContain(2048);
    expect(chosenBirthRemaining(moved)).toBe(4);
    for (let i = 0; i < 3; i++) {
      moved.board = [2,2,...Array(14).fill(0)];
      moved = applyAction(moved, { type: "move", direction: "left" });
      expect(moved.phase).toBe("play");
    }
    moved.board = [2,2,...Array(14).fill(0)];
    const expected = nextValue(moved);
    const choice = applyAction(moved, { type: "move", direction: "left" });
    expect(choice.phase).toBe("spawn");
    expect(choice.choices).toHaveLength(2);
    const index = choice.choices[0];
    const placed = applyAction(choice, { type: "spawn", index });
    expect(placed.board[index]).toBe(expected);
    expect(placed.spawned).toBe(9);
    expect(placed.stats).toMatchObject({ A002: 1, A003: 1 });
    expect(placed.phase).toBe("play");
  });
  it("restores a fresh identical fixture after play, victory or arbitrary mutations", () => {
    const session = gameSession("?test");
    const initial = session.newGame();
    const changed = applyAction(initial, { type: "move", direction: "left" });
    changed.owned.length = 0;
    changed.cool.A009 = 60;
    const reset = session.newGame();
    expect(reset).toEqual(initial);
    expect(reset.board).not.toBe(initial.board);
    expect(reset.cool).not.toBe(initial.cool);
    expect(gameSession("?test=1").newGame()).toEqual(initial);
  });
});
