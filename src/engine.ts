export type Id = "G01" | "G02" | "G03" | "M01" | "M02" | "B01" | "B02" | "R03";
export const rarities = {
  common: { label: "일반" },
  uncommon: { label: "고급" },
  rare: { label: "희귀" },
} as const;
export type Rarity = keyof typeof rarities;
export type Direction = "left" | "right" | "up" | "down";
export const goals = [32, 64, 128, 256, 512, 1024];
export const cards: Record<
  Id,
  { name: string; rarity: Rarity; description: string }
> = {
  G01: {
    name: "생성 예고",
    rarity: "common",
    description: "다음에 생성될 숫자를 미리 확인합니다.",
  },
  G02: {
    name: "선택받은 탄생",
    rarity: "rare",
    description: "매 5번째 생성은 빈칸 후보 두 곳 중 위치를 선택합니다.",
  },
  G03: {
    name: "고급 생산 라인",
    rarity: "common",
    description: "매 5번째 생성 숫자가 반드시 4가 됩니다.",
  },
  M01: {
    name: "연쇄 반응",
    rarity: "rare",
    description:
      "한 이동에서 2쌍 이상 합성하면 생성을 취소합니다. 이후 4이동 대기.",
  },
  M02: {
    name: "정리의 달인",
    rarity: "common",
    description:
      "2+2 합성 3회마다 작은 타일을 제거합니다. 방금 합성된 타일은 보호됩니다.",
  },
  B01: {
    name: "긴급 정리",
    rarity: "common",
    description: "2 또는 4 타일 하나를 터치해 제거합니다. 사용 후 15이동 충전.",
  },
  B02: {
    name: "차원 교환",
    rarity: "rare",
    description: "인접한 두 행을 교환합니다. 사용 후 12이동 충전.",
  },
  R03: {
    name: "벼랑 끝의 보상",
    rarity: "rare",
    description:
      "빈칸 2개 이하에서 합성하면 생성을 취소합니다. 이후 8이동 대기.",
  },
};
export type State = {
  continued: boolean;
  board: number[];
  score: number;
  turn: number;
  spawned: number;
  seed: number;
  initialSeed: number;
  next: number;
  owned: Id[];
  cool: Record<string, number>;
  small: number;
  pendingClean: number;
  reached: number[];
  draft: Id[];
  choices: number[];
  phase: "play" | "draft" | "spawn" | "won" | "lost";
  target: "B01" | "B02" | null;
  log: string[];
  stats: Record<string, number>;
};
export type Action =
  | { type: "move"; direction: Direction }
  | { type: "pick"; id: Id }
  | { type: "spawn"; index: number }
  | { type: "ability"; id: "B01" | "B02" }
  | { type: "target"; index: number }
  | { type: "cancel" }
  | { type: "continue" };
function random(s: State) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function sample(s: State, a: number[]) {
  return a[Math.floor(random(s) * a.length)];
}
const empty = (b: number[]) => b.flatMap((v, i) => (v === 0 ? [i] : []));
function note(s: State, t: string) {
  s.log = [t, ...s.log].slice(0, 30);
}
function fire(s: State, id: Id, t: string) {
  s.stats[id] = (s.stats[id] || 0) + 1;
  note(s, t);
}
export function nextValue(s: State) {
  return s.owned.includes("G03") && (s.spawned + 1) % 5 === 0 ? 4 : s.next;
}
export function movement(board: number[], direction: Direction) {
  const out = [...board],
    merged: number[] = [],
    trajectories: { from: number; to: number; value: number }[] = [];
  let score = 0,
    small = 0;
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, i) =>
      direction === "left"
        ? line * 4 + i
        : direction === "right"
          ? line * 4 + 3 - i
          : direction === "up"
            ? i * 4 + line
            : (3 - i) * 4 + line,
    );
    const sources = indices.filter((i) => board[i] !== 0);
    const values = sources.map((i) => board[i]),
      result: number[] = [];
    for (let j = 0; j < values.length; j++) {
      if (values[j] === values[j + 1]) {
        trajectories.push(
          { from: sources[j], to: indices[result.length], value: values[j] },
          {
            from: sources[j + 1],
            to: indices[result.length],
            value: values[j + 1],
          },
        );
        const v = values[j] * 2;
        merged.push(indices[result.length]);
        result.push(v);
        score += v;
        if (v === 4) small++;
        j++;
      } else {
        trajectories.push({
          from: sources[j],
          to: indices[result.length],
          value: values[j],
        });
        result.push(values[j]);
      }
    }
    indices.forEach((idx, i) => (out[idx] = result[i] || 0));
  }
  return {
    board: out,
    trajectories,
    merged,
    score,
    small,
    changed: out.some((v, i) => v !== board[i]),
  };
}
export function canMove(b: number[]) {
  return (["left", "right", "up", "down"] as Direction[]).some(
    (d) => movement(b, d).changed,
  );
}
export function recoverable(s: State) {
  return (
    (s.owned.includes("B01") &&
      !s.cool.B01 &&
      s.board.some((v) => v === 2 || v === 4)) ||
    (s.owned.includes("B02") &&
      !s.cool.B02 &&
      [0, 1, 2].some((r) =>
        s.board
          .slice(r * 4, r * 4 + 4)
          .some((v, i) => v !== s.board[(r + 1) * 4 + i]),
      ))
  );
}
function finish(s: State) {
  if (!s.continued && s.board.some((v) => v >= 2048)) {
    s.phase = "won";
    return;
  }
  const pending = goals.filter(
    (g) => !s.reached.includes(g) && Math.max(...s.board) >= g,
  );
  if (pending.length) {
    const g = pending[0];
    s.reached.push(g);
    const pool = (Object.keys(cards) as Id[]).filter(
      (id) => !s.owned.includes(id),
    );
    s.draft = [];
    while (pool.length && s.draft.length < 3) {
      const n = Math.floor(random(s) * pool.length);
      const id = pool.splice(n, 1)[0];
      s.draft.push(id);
      s.stats[`offered:${id}`] = (s.stats[`offered:${id}`] || 0) + 1;
    }
    s.phase = "draft";
    note(s, `${g} 달성! 증강을 선택하세요.`);
    return;
  }
  s.phase = canMove(s.board) || recoverable(s) ? "play" : "lost";
}
function spawn(s: State, index: number) {
  if (s.owned.includes("G03") && (s.spawned + 1) % 5 === 0)
    fire(s, "G03", "고급 생산 라인 — 4 생성");
  s.board[index] = nextValue(s);
  s.spawned++;
  s.next = random(s) < 0.9 ? 2 : 4;
  s.choices = [];
  finish(s);
}
export function createGame(seed = Date.now() >>> 0): State {
  const s: State = {
    continued: false,
    board: Array(16).fill(0),
    score: 0,
    turn: 0,
    spawned: 0,
    seed: seed >>> 0,
    initialSeed: seed >>> 0,
    next: 2,
    owned: [],
    cool: {},
    small: 0,
    pendingClean: 0,
    reached: [],
    draft: [],
    choices: [],
    phase: "play",
    target: null,
    log: ["새로운 빌드를 시작하세요."],
    stats: {},
  };
  for (let i = 0; i < 2; i++) {
    const n = sample(s, empty(s.board));
    s.board[n] = random(s) < 0.9 ? 2 : 4;
  }
  s.next = random(s) < 0.9 ? 2 : 4;
  return s;
}
export function applyAction(state: State, action: Action): State {
  const s: State = structuredClone(state);
  if (action.type === "continue") {
    if (s.phase !== "won") return state;
    s.continued = true;
    note(s, "계속 도전 — 4096 이상의 타일을 향해!");
    finish(s);
    return s;
  }
  if (action.type === "cancel") {
    s.target = null;
    return s;
  }
  if (
    action.type === "pick" &&
    s.phase === "draft" &&
    s.draft.includes(action.id)
  ) {
    s.owned.push(action.id);
    s.stats[`picked:${action.id}`] = (s.stats[`picked:${action.id}`] || 0) + 1;
    s.cool[action.id] = 0;
    s.draft = [];
    note(s, `${cards[action.id].name} 획득`);
    finish(s);
    return s;
  }
  if (
    action.type === "spawn" &&
    s.phase === "spawn" &&
    s.choices.includes(action.index)
  ) {
    spawn(s, action.index);
    return s;
  }
  if (s.phase !== "play") return state;
  if (
    action.type === "ability" &&
    s.owned.includes(action.id) &&
    !s.cool[action.id]
  ) {
    s.target = s.target === action.id ? null : action.id;
    return s;
  }
  if (action.type === "target" && s.target) {
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i > 15) return state;
    if (s.target === "B01") {
      if (![2, 4].includes(s.board[i])) return state;
      s.board[i] = 0;
      s.cool.B01 = 15;
      fire(s, "B01", "긴급 정리 — 타일 제거");
    } else {
      const r = Math.floor(i / 4);
      if (r >= 3) return state;
      for (let c = 0; c < 4; c++)
        [s.board[r * 4 + c], s.board[(r + 1) * 4 + c]] = [
          s.board[(r + 1) * 4 + c],
          s.board[r * 4 + c],
        ];
      s.cool.B02 = 12;
      fire(s, "B02", `${r + 1}·${r + 2}행 교환`);
    }
    s.target = null;
    finish(s);
    return s;
  }
  if (action.type !== "move" || s.target) return state;
  const m = movement(s.board, action.direction);
  if (!m.changed) return state;
  const beforeEmpty = empty(s.board).length;
  s.board = m.board;
  s.score += m.score;
  s.turn++;
  const ready = { ...s.cool };
  for (const id of Object.keys(s.cool))
    if (s.cool[id] > 0) {
      s.cool[id]--;
      if (!s.cool[id]) note(s, `${cards[id as Id].name} 준비 완료`);
    }
  if (s.owned.includes("M02")) {
    s.small += m.small;
    s.pendingClean += Math.floor(s.small / 3);
    s.small %= 3;
    while (s.pendingClean) {
      const candidates = s.board
        .flatMap((v, i) =>
          [2, 4].includes(v) && !m.merged.includes(i) ? [i] : [],
        )
        .sort((a, b) => s.board[a] - s.board[b] || a - b);
      if (!candidates.length) break;
      s.board[candidates[0]] = 0;
      s.pendingClean--;
      fire(s, "M02", "정리의 달인 — 작은 타일 제거");
    }
  }
  let cancel = false;
  if (s.owned.includes("M01") && !ready.M01 && m.merged.length >= 2) {
    cancel = true;
    s.cool.M01 = 4;
    fire(s, "M01", "연쇄 반응 — 생성 취소");
  }
  if (
    s.owned.includes("R03") &&
    !ready.R03 &&
    beforeEmpty <= 2 &&
    m.merged.length
  ) {
    cancel = true;
    s.cool.R03 = 8;
    fire(s, "R03", "벼랑 끝의 보상 — 생성 취소");
  }
  if (cancel) {
    finish(s);
    return s;
  }
  const spaces = empty(s.board);
  if (
    s.owned.includes("G02") &&
    (s.spawned + 1) % 5 === 0 &&
    spaces.length > 1
  ) {
    const a = sample(s, spaces),
      b = sample(
        s,
        spaces.filter((i) => i !== a),
      );
    s.choices = [a, b];
    s.phase = "spawn";
    fire(s, "G02", "생성 위치를 선택하세요");
    return s;
  }
  if (spaces.length) spawn(s, sample(s, spaces));
  else finish(s);
  return s;
}
