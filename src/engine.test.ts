import { describe, it, expect } from "vitest";
import {
  createGame,
  applyAction,
  movement,
  nextValue,
  canMove,
  canDuplicate,
  recoverable,
  type State,
  type Id,
  type Direction,
} from "./engine";
function setup(board: number[], owned: Id[] = []): State {
  const s = createGame(123);
  s.board = [...board, ...Array(16 - board.length).fill(0)];
  s.owned = owned;
  s.reached = [32, 64, 128, 256, 512, 1024];
  return s;
}
const move = (s: State, d: Direction = "left") =>
  applyAction(s, { type: "move", direction: d });
describe("tile duplication", () => {
  const select = (s: State, index: number) => applyAction(s, { type: "target", index });
  it("copies any selected value into an empty cell without a move or normal spawn", () => {
    const s = setup([1024, 2], ["B03"]);
    const armed = applyAction(s, { type: "ability", id: "B03" });
    expect(select(armed, 2)).toBe(armed);
    const source = select(armed, 0);
    expect(source.copySource).toBe(0);
    expect(source.cool.B03).toBeUndefined();
    expect(move(source)).toBe(source);
    const copied = select(source, 15);
    expect(copied.board[0]).toBe(1024);
    expect(copied.board[15]).toBe(1024);
    expect(copied.cool.B03).toBe(30);
    expect(copied.stats.B03).toBe(1);
    expect(copied.target).toBeNull();
    expect(copied.copySource).toBeNull();
    for (const key of ["score", "turn", "spawned", "seed", "next", "small"] as const)
      expect(copied[key]).toBe(s[key]);
  });
  it("changes source without overwriting occupied cells and supports cancelling either step", () => {
    const s = setup([128, 256], ["B03"]);
    const armed = applyAction(s, { type: "ability", id: "B03" });
    const selected = select(select(armed, 0), 1);
    expect(selected.board).toEqual(s.board);
    expect(selected.copySource).toBe(1);
    expect(select(selected, 2).board[2]).toBe(256);
    for (const state of [armed, selected]) {
      const cancelled = applyAction(state, { type: "cancel" });
      expect(cancelled.board).toEqual(s.board);
      expect(cancelled.target).toBeNull();
      expect(cancelled.copySource).toBeNull();
      expect(cancelled.cool.B03).toBeUndefined();
      expect(applyAction(state, { type: "ability", id: "B03" }).target).toBeNull();
    }
    for (const index of [-1, 16, 0.5]) expect(select(selected, index)).toBe(selected);
  });
  it("requires an owned ready ability, a number and an empty cell", () => {
    const missing = setup([2]);
    expect(applyAction(missing, { type: "ability", id: "B03" })).toBe(missing);
    const cooling = setup([2], ["B03"]);
    cooling.cool.B03 = 1;
    expect(applyAction(cooling, { type: "ability", id: "B03" })).toBe(cooling);
    const full = setup([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], ["B03"]);
    expect(canDuplicate(full)).toBe(false);
    expect(recoverable(full)).toBe(false);
    expect(applyAction(full, { type: "ability", id: "B03" })).toBe(full);
    expect(canDuplicate(setup([], ["B03"]))).toBe(false);
  });
  it("recharges only after thirty valid moves", () => {
    let s = setup([2], ["B03"]);
    s.cool.B03 = 30;
    expect(move(s)).toBe(s);
    for (let remaining = 29; remaining >= 0; remaining--) {
      s.board = setup([2, 2]).board;
      s = move(s);
      expect(s.cool.B03).toBe(remaining);
      if (remaining) expect(applyAction(s, { type: "ability", id: "B03" })).toBe(s);
    }
    expect(applyAction(s, { type: "ability", id: "B03" }).target).toBe("B03");
  });
});
describe("basic movement", () => {
  it.each([
    [
      [2, 2, 2, 2],
      [4, 4, 0, 0],
    ],
    [
      [4, 4, 8, 0],
      [8, 8, 0, 0],
    ],
    [
      [2, 2, 4, 4],
      [4, 8, 0, 0],
    ],
  ])("merges each tile only once: %j", (a, b) =>
    expect(movement(setup(a).board, "left").board.slice(0, 4)).toEqual(b),
  );
  it("does not consume a turn or RNG on invalid moves", () => {
    const s = setup([2]);
    expect(move(s)).toBe(s);
  });
  it("supports all directions", () => {
    expect(movement(setup([2, 2]).board, "right").board.slice(0, 4)).toEqual([
      0, 0, 0, 4,
    ]);
    expect(movement(setup([2, 0, 0, 0, 2]).board, "up").board[0]).toBe(4);
    expect(movement(setup([2, 0, 0, 0, 2]).board, "down").board[12]).toBe(4);
  });
});
describe("draft and game flow", () => {
  it("awards a unique draft at first 32 and blocks movement", () => {
    const s = setup([16, 16]);
    s.reached = [];
    const n = move(s);
    expect(n.phase).toBe("draft");
    expect(new Set(n.draft).size).toBe(3);
    expect(move(n)).toBe(n);
    const p = applyAction(n, { type: "pick", id: n.draft[0] });
    expect(p.owned).toHaveLength(1);
    expect(p.phase).toBe("play");
  });
  it("does not award the same goal twice or offer owned cards", () => {
    const s = setup([16, 16]);
    expect(move(s).phase).toBe("play");
    s.reached = [];
    s.owned = ["G01"];
    expect(move(s).draft).not.toContain("G01");
  });
  it("wins on 2048", () => expect(move(setup([1024, 1024])).phase).toBe("won"));
  it("replays deterministically", () => {
    let a = createGame(45),
      b = createGame(45);
    for (let i = 0; i < 100; i++) {
      const d = (["left", "up", "right", "down"] as Direction[])[i % 4];
      a = move(a, d);
      b = move(b, d);
      if (a.phase === "draft") {
        a = applyAction(a, { type: "pick", id: a.draft[0] });
        b = applyAction(b, { type: "pick", id: b.draft[0] });
      }
      if (a.phase === "spawn") {
        a = applyAction(a, { type: "spawn", index: a.choices[0] });
        b = applyAction(b, { type: "spawn", index: b.choices[0] });
      }
    }
    expect(a).toEqual(b);
  });
});
describe("augments", () => {
  it("M01 cancels spawn and respects four subsequent valid moves", () => {
    let s = move(setup([2, 2, 4, 4], ["M01"]));
    expect(s.spawned).toBe(0);
    expect(s.cool.M01).toBe(4);
    for (let i = 0; i < 4; i++) {
      s.board = setup([2, 2, 4, 4]).board;
      s = move(s);
      expect(s.spawned).toBe(i + 1);
    }
    s.board = setup([2, 2, 4, 4]).board;
    expect(move(s).spawned).toBe(4);
  });
  it("M01 and R03 both activate but cancel only one spawn", () => {
    const s = move(
      setup(
        [2, 2, 4, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 4, 8, 16, 0],
        ["M01", "R03"],
      ),
    );
    expect(s.spawned).toBe(0);
    expect(s.cool).toMatchObject({ M01: 4, R03: 8 });
    expect(s.stats).toMatchObject({ M01: 1, R03: 1 });
  });
  it("G02 and G03 combine and preview is exact", () => {
    const s = setup([2, 2], ["G01", "G02", "G03"]);
    s.spawned = 4;
    const n = move(s);
    expect(n.phase).toBe("spawn");
    expect(nextValue(n)).toBe(4);
    expect(n.choices).toHaveLength(2);
    expect(move(n)).toBe(n);
    const p = applyAction(n, { type: "spawn", index: n.choices[0] });
    expect(p.board[n.choices[0]]).toBe(4);
    expect(p.spawned).toBe(5);
  });
  it("M02 excludes freshly merged tiles and retains a pending removal", () => {
    const s = setup([2, 2], ["M02"]);
    s.small = 2;
    const n = move(s);
    expect(n.pendingClean).toBe(1);
    expect(n.board[0]).toBe(4);
    n.board = setup([8, 0, 2]).board;
    const p = move(n);
    expect(p.pendingClean).toBe(0);
    expect(p.stats.M02).toBe(1);
  });
  it("B01 removes one tile without consuming a turn", () => {
    const s = setup([2, 4], ["B01"]);
    const n = applyAction(applyAction(s, { type: "ability", id: "B01" }), {
      type: "target",
      index: 0,
    });
    expect(n.board[0]).toBe(0);
    expect(n.turn).toBe(0);
    expect(n.spawned).toBe(0);
    expect(n.cool.B01).toBe(15);
    expect(applyAction(n, { type: "ability", id: "B01" }).target).toBeNull();
  });
  it("B02 swaps rows without merging or spawning", () => {
    const s = setup([2, 2, 4, 4, 8, 8, 16, 16], ["B02"]);
    const n = applyAction(applyAction(s, { type: "ability", id: "B02" }), {
      type: "target",
      index: 0,
    });
    expect(n.board.slice(0, 8)).toEqual([8, 8, 16, 16, 2, 2, 4, 4]);
    expect(n.score).toBe(0);
    expect(n.turn).toBe(0);
    expect(n.spawned).toBe(0);
    expect(n.cool.B02).toBe(12);
  });
  it("allows recovery on a stuck board and loses without recovery", () => {
    const board = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(canMove(board)).toBe(false);
    const s = setup(board, ["B01"]);
    s.phase = "draft";
    s.draft = ["G01"];
    expect(applyAction(s, { type: "pick", id: "G01" }).phase).toBe("play");
    const t = setup(board);
    t.phase = "draft";
    t.draft = ["G01"];
    expect(applyAction(t, { type: "pick", id: "G01" }).phase).toBe("lost");
  });
  it("does not overwrite tiles during a long run", () => {
    let s = createGame(900);
    for (let i = 0; i < 500 && s.phase !== "lost" && s.phase !== "won"; i++) {
      if (s.phase === "draft")
        s = applyAction(s, { type: "pick", id: s.draft[0] });
      else if (s.phase === "spawn")
        s = applyAction(s, { type: "spawn", index: s.choices[0] });
      else {
        const direction = (["left", "up", "right", "down"] as Direction[]).find(
          (d) => movement(s.board, d).changed,
        );
        if (!direction) break;
        const before = s.board.reduce((a, b) => a + b, 0);
        const n = move(s, direction);
        if (!s.owned.includes("M02"))
          expect(n.board.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(
            before,
          );
        s = n;
      }
      expect(s.board).toHaveLength(16);
      expect(
        s.board.every((v) => v === 0 || Number.isInteger(Math.log2(v))),
      ).toBe(true);
    }
  });
});

describe("animation trajectories", () => {
  it("tracks both source tiles into each merge without chaining", () => {
    const result = movement(setup([2, 2, 2, 2]).board, "left");
    expect(result.trajectories).toEqual([
      { from: 0, to: 0, value: 2 },
      { from: 1, to: 0, value: 2 },
      { from: 2, to: 1, value: 2 },
      { from: 3, to: 1, value: 2 },
    ]);
  });
  it("tracks vertical and reverse slides to their real destination", () => {
    expect(movement(setup([2, 0, 4]).board, "right").trajectories).toEqual([
      { from: 2, to: 3, value: 4 },
      { from: 0, to: 2, value: 2 },
    ]);
    expect(movement(setup([2, 0, 0, 0, 2]).board, "down").trajectories).toEqual(
      [
        { from: 4, to: 12, value: 2 },
        { from: 0, to: 12, value: 2 },
      ],
    );
  });
});

describe("active ability cancellation", () => {
  it.each(["B01", "B02"] as const)(
    "%s toggles off without consuming charge or a turn",
    (id) => {
      const state = setup([2, 4, 8], [id]);
      const selected = applyAction(state, { type: "ability", id });
      expect(selected.target).toBe(id);
      const cancelled = applyAction(selected, { type: "ability", id });
      expect(cancelled).toEqual(state);
      expect(applyAction(cancelled, { type: "target", index: 0 })).toEqual(
        state,
      );
      expect(applyAction(cancelled, { type: "ability", id }).target).toBe(id);
    },
  );
});

describe("continue after victory", () => {
  it("preserves the run and does not show victory again at 4096", () => {
    const won = move(setup([1024, 1024], ["G01", "B01"]));
    expect(won.phase).toBe("won");
    const continued = applyAction(won, { type: "continue" });
    expect(continued.phase).toBe("play");
    expect(continued.continued).toBe(true);
    for (const key of [
      "board",
      "score",
      "turn",
      "spawned",
      "owned",
      "cool",
      "seed",
      "next",
      "stats",
    ] as const)
      expect(continued[key]).toEqual(won[key]);
    continued.board = setup([2048, 2048]).board;
    const next = move(continued);
    expect(next.board).toContain(4096);
    expect(next.phase).toBe("play");
    expect(next.score).toBe(won.score + 4096);
  });
  it("ignores continuation outside victory and resets on a fresh run", () => {
    const state = setup([2]);
    expect(applyAction(state, { type: "continue" })).toBe(state);
    expect(createGame(123).continued).toBe(false);
  });
  it("still detects loss in an endless run", () => {
    const state = setup([4096, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]);
    state.phase = "won";
    expect(applyAction(state, { type: "continue" }).phase).toBe("lost");
  });
});
