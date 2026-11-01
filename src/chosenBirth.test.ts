import { describe, expect, it } from "vitest";
import { applyAction, chosenBirthRemaining, createGame, goals, type State } from "./engine";
import { compactAugmentStatus } from "./augmentStatus";
import { restoreSavedGame } from "./savedGame";

function acquire(spawned: number) {
  const s = createGame(123);
  s.board = [2,2,...Array(14).fill(0)];
  s.spawned = spawned;
  s.reached = [...goals];
  s.phase = "draft";
  s.draft = ["A002"];
  return applyAction(s, { type: "pick", id: "A002" });
}
const move = (s: State) => applyAction(s, { type: "move", direction: "left" });
describe("chosen birth acquisition-based cycle", () => {
  it.each([0,1,4,9,24])("starts at five remaining even when acquired after %i spawns", (spawned) => {
    let s = acquire(spawned);
    expect(s.chosenBirthStart).toBe(spawned);
    expect(chosenBirthRemaining(s)).toBe(5);
    expect(compactAugmentStatus(s, "A002")).toBe("생성 5회 남음");
    for (let i = 1; i <= 10; i++) {
      s.board = [2,2,...Array(14).fill(0)];
      s = move(s);
      expect(s.phase).toBe(i % 5 === 0 ? "spawn" : "play");
      if (s.phase === "spawn") {
        expect(chosenBirthRemaining(s)).toBe(1);
        s = applyAction(s, { type: "spawn", index: s.choices[0] });
      }
      expect(s.spawned).toBe(spawned+i);
      expect(chosenBirthRemaining(s)).toBe(5-i%5);
    }
    expect(s.stats.A002).toBe(2);
  });
  it("does not count invalid moves or cancelled spawns, but counts A016's actual spawn", () => {
    const s = acquire(24); s.owned.push("A004", "A016");
    s.board = [2,...Array(15).fill(0)];
    expect(move(s)).toBe(s);
    s.board = [2,2,4,4,...Array(12).fill(0)];
    const cancelled = move(s);
    expect(cancelled.turn).toBe(1);
    expect(cancelled.spawned).toBe(24);
    expect(chosenBirthRemaining(cancelled)).toBe(5);
    const grown = applyAction(cancelled, { type: "ability", id: "A016" });
    expect(grown.turn).toBe(1);
    expect(chosenBirthRemaining(grown)).toBe(4);
  });
  it("preserves acquisition and cycle progress through save/reload and undo", () => {
    const s = acquire(9); s.owned.push("A015"); s.undoCharges = 2;
    const moved = move(s);
    const restored = restoreSavedGame(JSON.stringify({ version: 2, state: moved }))!;
    expect(chosenBirthRemaining(restored)).toBe(4);
    const undone = applyAction(restored, { type: "ability", id: "A015" });
    expect(undone.chosenBirthStart).toBe(9);
    expect(chosenBirthRemaining(undone)).toBe(5);
  });
  it("starts a fresh cycle in old saves without acquisition data and preserves pending choices", () => {
    const s = acquire(24);
    const old = { ...s } as Partial<State>; delete old.chosenBirthStart;
    const restored = restoreSavedGame(JSON.stringify({ version: 2, state: old }))!;
    expect(restored.chosenBirthStart).toBe(24);
    expect(chosenBirthRemaining(restored)).toBe(5);
    const before = acquire(0); before.spawned = 4;
    const choice = move(before);
    const oldChoice = { ...choice } as Partial<State>; delete oldChoice.chosenBirthStart;
    const pending = restoreSavedGame(JSON.stringify({ version: 2, state: oldChoice }))!;
    expect(pending.phase).toBe("spawn");
    expect(pending.choices).toEqual(choice.choices);
    const placed = applyAction(pending, { type: "spawn", index: pending.choices[0] });
    expect(chosenBirthRemaining(placed)).toBe(5);
  });
});
