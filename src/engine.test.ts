import { describe, it, expect } from "vitest";
import {
  createGame,
  applyAction,
  movement,
  nextValue,
  canMove,
  canDuplicate,
  canSwapTiles,
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
describe("tile swap", () => {
  const select = (s: State, index: number) => applyAction(s, { type: "target", index });
  it("swaps distant numbered tiles without spawning, scoring or consuming a move", () => {
    const s = setup([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1024], ["A010"]);
    const armed = applyAction(s, { type: "ability", id: "A010" });
    const first = select(armed, 0);
    expect(first.swapSource).toBe(0);
    expect(move(first)).toBe(first);
    const n = select(first, 15);
    expect(n.board[0]).toBe(1024);
    expect(n.board[15]).toBe(2);
    expect(n.cool.A010).toBe(40);
    expect(n.stats.A010).toBe(1);
    expect(n.target).toBeNull();
    expect(n.swapSource).toBeNull();
    for (const key of ["turn", "spawned", "score", "seed", "next", "small"] as const)
      expect(n[key]).toBe(s[key]);
  });
  it("rejects empty/equal targets and supports deselection, cancellation and saved selection", () => {
    const s = setup([2, 2, 4], ["A010"]);
    const armed = applyAction(s, { type: "ability", id: "A010" });
    expect(select(armed, 3)).toBe(armed);
    const first = select(armed, 0);
    for (const i of [1, 3, -1, 16, 0.5]) expect(select(first, i)).toBe(first);
    expect(select(first, 0).swapSource).toBeNull();
    for (const state of [armed, first]) {
      const cancelled = applyAction(state, { type: "cancel" });
      expect(cancelled.swapSource).toBeNull();
      expect(cancelled.target).toBeNull();
      expect(cancelled.board).toEqual(s.board);
      expect(cancelled.cool.A010).toBeUndefined();
      expect(applyAction(state, { type: "ability", id: "A010" }).swapSource).toBeNull();
    }
    expect(select(JSON.parse(JSON.stringify(first)), 2).board.slice(0, 3)).toEqual([4, 2, 2]);
    expect(canSwapTiles(setup([2, 2]))).toBe(false);
    const missing = setup([2, 4]);
    expect(applyAction(missing, { type: "ability", id: "A010" })).toBe(missing);
  });
  it("keeps a stuck full board recoverable only while charged", () => {
    const s = setup([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], ["A010"]);
    expect(canMove(s.board)).toBe(false);
    expect(recoverable(s)).toBe(true);
    const n = select(select(applyAction(s, { type: "ability", id: "A010" }), 0), 1);
    expect(n.phase).toBe("play");
    expect(canMove(n.board)).toBe(true);
    s.cool.A010 = 1;
    expect(recoverable(s)).toBe(false);
    expect(applyAction(s, { type: "ability", id: "A010" })).toBe(s);
  });
  it("recharges after forty valid moves, with invalid moves preserving the counter", () => {
    let s = setup([2], ["A010"]);
    s.cool.A010 = 40;
    expect(move(s)).toBe(s);
    for (let remaining = 39; remaining >= 0; remaining--) {
      s.board = setup([2, 2, 8]).board;
      s = move(s);
      expect(s.cool.A010).toBe(remaining);
      if (remaining) expect(applyAction(s, { type: "ability", id: "A010" })).toBe(s);
    }
    expect(applyAction(s, { type: "ability", id: "A010" }).target).toBe("A010");
  });
});
describe("tile duplication", () => {
  const select = (s: State, index: number) => applyAction(s, { type: "target", index });
  it("copies any selected value into an empty cell without a move or normal spawn", () => {
    const s = setup([1024, 2], ["A009"]);
    const armed = applyAction(s, { type: "ability", id: "A009" });
    expect(select(armed, 2)).toBe(armed);
    const source = select(armed, 0);
    expect(source.copySource).toBe(0);
    expect(source.cool.A009).toBeUndefined();
    expect(move(source)).toBe(source);
    const copied = select(source, 15);
    expect(copied.board[0]).toBe(1024);
    expect(copied.board[15]).toBe(1024);
    expect(copied.cool.A009).toBe(60);
    expect(copied.stats.A009).toBe(1);
    expect(copied.target).toBeNull();
    expect(copied.copySource).toBeNull();
    for (const key of ["score", "turn", "spawned", "seed", "next", "small"] as const)
      expect(copied[key]).toBe(s[key]);
  });
  it("changes source without overwriting occupied cells and supports cancelling either step", () => {
    const s = setup([128, 256], ["A009"]);
    const armed = applyAction(s, { type: "ability", id: "A009" });
    const selected = select(select(armed, 0), 1);
    expect(selected.board).toEqual(s.board);
    expect(selected.copySource).toBe(1);
    expect(select(selected, 2).board[2]).toBe(256);
    for (const state of [armed, selected]) {
      const cancelled = applyAction(state, { type: "cancel" });
      expect(cancelled.board).toEqual(s.board);
      expect(cancelled.target).toBeNull();
      expect(cancelled.copySource).toBeNull();
      expect(cancelled.cool.A009).toBeUndefined();
      expect(applyAction(state, { type: "ability", id: "A009" }).target).toBeNull();
    }
    for (const index of [-1, 16, 0.5]) expect(select(selected, index)).toBe(selected);
  });
  it("requires an owned ready ability, a number and an empty cell", () => {
    const missing = setup([2]);
    expect(applyAction(missing, { type: "ability", id: "A009" })).toBe(missing);
    const cooling = setup([2], ["A009"]);
    cooling.cool.A009 = 1;
    expect(applyAction(cooling, { type: "ability", id: "A009" })).toBe(cooling);
    const full = setup([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], ["A009"]);
    expect(canDuplicate(full)).toBe(false);
    expect(recoverable(full)).toBe(false);
    expect(applyAction(full, { type: "ability", id: "A009" })).toBe(full);
    expect(canDuplicate(setup([], ["A009"]))).toBe(false);
  });
  it("recharges only after sixty valid moves", () => {
    let s = setup([2], ["A009"]);
    s.cool.A009 = 60;
    expect(move(s)).toBe(s);
    for (let remaining = 59; remaining >= 0; remaining--) {
      s.board = setup([2, 2]).board;
      s = move(s);
      expect(s.cool.A009).toBe(remaining);
      if (remaining) expect(applyAction(s, { type: "ability", id: "A009" })).toBe(s);
    }
    expect(applyAction(s, { type: "ability", id: "A009" }).target).toBe("A009");
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
    s.owned = ["A001"];
    expect(move(s).draft).not.toContain("A001");
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
  it("A004 cancels spawn and respects four subsequent valid moves", () => {
    let s = move(setup([2, 2, 4, 4], ["A004"]));
    expect(s.spawned).toBe(0);
    expect(s.cool.A004).toBe(4);
    for (let i = 0; i < 4; i++) {
      s.board = setup([2, 2, 4, 4]).board;
      s = move(s);
      expect(s.spawned).toBe(i + 1);
    }
    s.board = setup([2, 2, 4, 4]).board;
    expect(move(s).spawned).toBe(4);
  });
  it("A004 and A008 both activate but cancel only one spawn", () => {
    const s = move(
      setup(
        [2, 2, 4, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 4, 8, 16, 0],
        ["A004", "A008"],
      ),
    );
    expect(s.spawned).toBe(0);
    expect(s.cool).toMatchObject({ A004: 4, A008: 8 });
    expect(s.stats).toMatchObject({ A004: 1, A008: 1 });
  });
  it("A002 and A003 combine and preview is exact", () => {
    const s = setup([2, 2], ["A001", "A002", "A003"]);
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
  it("A005 excludes freshly merged tiles and retains a pending removal", () => {
    const s = setup([2, 2], ["A005"]);
    s.small = 2;
    const n = move(s);
    expect(n.pendingClean).toBe(1);
    expect(n.board[0]).toBe(4);
    n.board = setup([8, 0, 2]).board;
    const p = move(n);
    expect(p.pendingClean).toBe(0);
    expect(p.stats.A005).toBe(1);
  });
  it("A006 removes one tile without consuming a turn", () => {
    const s = setup([2, 4], ["A006"]);
    const n = applyAction(applyAction(s, { type: "ability", id: "A006" }), {
      type: "target",
      index: 0,
    });
    expect(n.board[0]).toBe(0);
    expect(n.turn).toBe(0);
    expect(n.spawned).toBe(0);
    expect(n.cool.A006).toBe(15);
    expect(applyAction(n, { type: "ability", id: "A006" }).target).toBeNull();
  });
  it("A007 swaps rows without merging or spawning", () => {
    const s = setup([2, 2, 4, 4, 8, 8, 16, 16], ["A007"]);
    const n = applyAction(applyAction(s, { type: "ability", id: "A007" }), {
      type: "target",
      index: 0,
    });
    expect(n.board.slice(0, 8)).toEqual([8, 8, 16, 16, 2, 2, 4, 4]);
    expect(n.score).toBe(0);
    expect(n.turn).toBe(0);
    expect(n.spawned).toBe(0);
    expect(n.cool.A007).toBe(12);
  });
  it("allows recovery on a stuck board and loses without recovery", () => {
    const board = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(canMove(board)).toBe(false);
    const s = setup(board, ["A006"]);
    s.phase = "draft";
    s.draft = ["A001"];
    expect(applyAction(s, { type: "pick", id: "A001" }).phase).toBe("play");
    const t = setup(board);
    t.phase = "draft";
    t.draft = ["A001"];
    expect(applyAction(t, { type: "pick", id: "A001" }).phase).toBe("lost");
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
        if (!s.owned.includes("A005"))
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
  it.each(["A006", "A007"] as const)(
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
    const won = move(setup([1024, 1024], ["A001", "A006"]));
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
