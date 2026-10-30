import { describe, it, expect } from "vitest";
import { applyAction, createGame, goals } from "./engine";
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
  it("starts with two top-left 1024s and charged duplication and swap abilities", () => {
    const s = gameSession("?test").newGame();
    expect(s.board.slice(0, 4)).toEqual([1024, 1024, 0, 0]);
    expect(s.board).toHaveLength(16);
    expect(s.owned).toEqual(["A009", "A010", "A011", "A012", "A013", "A014", "A015"]);
    expect(s.cool).toEqual({ A009: 0, A010: 0, A011: 0, A014: 0, A015: 0 });
    expect(s.reached).toEqual(goals);
    expect(s.phase).toBe("play");
    expect(applyAction(s, { type: "ability", id: "A009" }).target).toBe("A009");
    expect(applyAction(s, { type: "ability", id: "A010" }).target).toBe("A010");
    // Existing high tiles must not immediately cause a stack of milestone drafts.
    expect(applyAction(applyAction(s, { type: "ability", id: "A009" }), { type: "cancel" }).phase).toBe("play");
    expect(applyAction(s, { type: "move", direction: "left" }).phase).toBe("won");
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
