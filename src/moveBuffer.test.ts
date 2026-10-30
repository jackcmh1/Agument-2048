import { describe, expect, it } from "vitest";
import { applyAction, createGame, type Direction } from "./engine";
import { MoveBuffer } from "./moveBuffer";

describe("movement buffering", () => {
  it("preserves consecutive inputs in order and produces the same run as separate moves", () => {
    const buffer = new MoveBuffer();
    const inputs: Direction[] = ["right", "down", "left"];
    inputs.forEach((direction) => buffer.push(direction));
    let buffered = createGame(123);
    const expected = inputs.reduce((s, direction) => applyAction(s, { type: "move", direction }), buffered);
    const received: Direction[] = [];
    let direction;
    while ((direction = buffer.take(true))) {
      received.push(direction);
      buffered = applyAction(buffered, { type: "move", direction });
    }
    expect(received).toEqual(inputs);
    expect(buffered).toEqual(expected);
  });
  it("does not strand later inputs behind a move that cannot change the board", () => {
    const buffer = new MoveBuffer();
    const s = createGame(123);
    s.board = [2, ...Array(15).fill(0)];
    buffer.push("left");
    buffer.push("down");
    expect(applyAction(s, { type: "move", direction: buffer.take(true)! })).toBe(s);
    expect(applyAction(s, { type: "move", direction: buffer.take(true)! }).turn).toBe(1);
  });
  it("discards inputs on a draft transition so they cannot move after picking an augment", () => {
    const buffer = new MoveBuffer();
    const s = createGame(123);
    s.board = [16, 16, ...Array(14).fill(0)];
    const draft = applyAction(s, { type: "move", direction: "left" });
    buffer.push("right");
    buffer.push("down");
    expect(draft.phase).toBe("draft");
    expect(buffer.take(draft.phase === "play")).toBeUndefined();
    const picked = applyAction(draft, { type: "pick", id: draft.draft[0] });
    expect(picked.phase).toBe("play");
    expect(buffer.take(true)).toBeUndefined();
  });
  it("bounds held-key backlog and clears it on reset, modal or focus changes", () => {
    const buffer = new MoveBuffer();
    for (let i = 0; i < 100; i++) buffer.push("left");
    let count = 0;
    while (buffer.take(true)) count++;
    expect(count).toBe(4);
    buffer.push("right");
    buffer.clear();
    expect(buffer.take(true)).toBeUndefined();
  });
});
