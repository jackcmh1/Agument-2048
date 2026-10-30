export type ActiveId = "A006" | "A007" | "A009" | "A010" | "A011" | "A014";
export type Id = "A001" | "A002" | "A003" | "A012" | "A013" | "A004" | "A005" | ActiveId | "A008";
export function isActive(id: Id): id is ActiveId {
  return id === "A006" || id === "A007" || id === "A009" || id === "A010" || id === "A011" || id === "A014";
}
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
  A001: {
    name: "생성 예고",
    rarity: "common",
    description: "다음에 생성될 숫자를 미리 확인합니다.",
  },
  A002: {
    name: "선택받은 탄생",
    rarity: "rare",
    description: "매 5번째 생성은 빈칸 후보 두 곳 중 위치를 선택합니다.",
  },
  A003: {
    name: "고급 생산 라인",
    rarity: "common",
    description: "매 5번째 생성 숫자가 반드시 4가 됩니다.",
  },
  A012: {
    name: "작은 수의 법칙",
    rarity: "common",
    description: "일반 생성 숫자가 항상 2가 됩니다. 고급 생산 라인의 매 5번째 4 생성은 유지됩니다.",
  },
  A013: {
    name: "쌍둥이 탄생",
    rarity: "uncommon",
    description: "매 16번째 일반 생성에서 같은 숫자를 하나 더 생성합니다. 빈칸이 부족하면 하나만 생성합니다.",
  },
  A004: {
    name: "연쇄 반응",
    rarity: "rare",
    description:
      "한 이동에서 2쌍 이상 합성하면 생성을 취소합니다. 이후 4이동 대기.",
  },
  A005: {
    name: "정리의 달인",
    rarity: "common",
    description:
      "2+2 합성 3회마다 작은 타일을 제거합니다. 방금 합성된 타일은 보호됩니다.",
  },
  A006: {
    name: "긴급 정리",
    rarity: "common",
    description: "2 또는 4 타일 하나를 터치해 제거합니다. 사용 후 15이동 충전.",
  },
  A007: {
    name: "차원 교환",
    rarity: "rare",
    description: "인접한 두 행을 교환합니다. 사용 후 12이동 충전.",
  },
  A009: {
    name: "타일 복제",
    rarity: "rare",
    description: "숫자 타일을 선택한 뒤 빈칸을 선택해 복사합니다. 사용 후 60이동 충전.",
  },
  A010: {
    name: "타일 교환",
    rarity: "uncommon",
    description: "서로 다른 숫자 타일 두 개를 선택해 위치를 바꿉니다. 사용 후 40이동 충전.",
  },
  A011: {
    name: "성장 촉진",
    rarity: "uncommon",
    description: "선택한 2·4·8 타일 하나를 두 배로 키웁니다. 사용 후 25이동 충전.",
  },
  A014: {
    name: "기사의 여정",
    rarity: "rare",
    description: "나이트 거리(가로 2·세로 1칸 또는 가로 1·세로 2칸)의 같은 숫자 두 개를 합칩니다. 두 번째 위치에 합성되며 사용 후 40이동 충전.",
  },
  A008: {
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
  target: ActiveId | null;
  copySource: number | null;
  swapSource: number | null;
  knightSource: number | null;
  log: string[];
  stats: Record<string, number>;
};
export type Action =
  | { type: "move"; direction: Direction }
  | { type: "pick"; id: Id }
  | { type: "spawn"; index: number }
  | { type: "ability"; id: ActiveId }
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
  return s.owned.includes("A003") && (s.spawned + 1) % 5 === 0 ? 4 : s.owned.includes("A012") ? 2 : s.next;
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
    (s.owned.includes("A006") &&
      !s.cool.A006 &&
      s.board.some((v) => v === 2 || v === 4)) ||
    (s.owned.includes("A007") &&
      !s.cool.A007 &&
      [0, 1, 2].some((r) =>
        s.board
          .slice(r * 4, r * 4 + 4)
          .some((v, i) => v !== s.board[(r + 1) * 4 + i]),
      )) ||
    (s.owned.includes("A009") && !s.cool.A009 && canDuplicate(s)) ||
    (s.owned.includes("A010") && !s.cool.A010 && canSwapTiles(s)) ||
    (s.owned.includes("A011") && !s.cool.A011 && canGrow(s)) ||
    (s.owned.includes("A014") && !s.cool.A014 && canKnightMerge(s))
  );
}
export function canDuplicate(s: State) {
  return s.board.includes(0) && s.board.some((v) => v > 0);
}
export function canSwapTiles(s: State) {
  return new Set(s.board.filter((v) => v > 0)).size >= 2;
}
export function canGrow(s: State) {
  return s.board.some((v) => [2, 4, 8].includes(v));
}
export function knightTargets(s: State, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= 16 || !s.board[index]) return [];
  const row = Math.floor(index / 4), col = index % 4;
  return s.board.flatMap((value, i) => {
    const dr = Math.abs(Math.floor(i / 4) - row), dc = Math.abs(i % 4 - col);
    return value === s.board[index] && ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) ? [i] : [];
  });
}
export function canKnightMerge(s: State) {
  return s.board.some((_, i) => knightTargets(s, i).length > 0);
}
function cleanSmallTiles(s: State, small: number, merged: number[]) {
  if (s.owned.includes("A005")) {
    s.small += small;
    s.pendingClean += Math.floor(s.small / 3);
    s.small %= 3;
    while (s.pendingClean) {
      const candidates = s.board
        .flatMap((v, i) =>
          [2, 4].includes(v) && !merged.includes(i) ? [i] : [],
        )
        .sort((a, b) => s.board[a] - s.board[b] || a - b);
      if (!candidates.length) break;
      s.board[candidates[0]] = 0;
      s.pendingClean--;
      fire(s, "A005", "정리의 달인 — 작은 타일 제거");
    }
  }
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
  if (s.owned.includes("A003") && (s.spawned + 1) % 5 === 0)
    fire(s, "A003", "고급 생산 라인 — 4 생성");
  const value = nextValue(s);
  s.board[index] = value;
  s.spawned++;
  if (s.owned.includes("A013") && s.spawned % 16 === 0) {
    const spaces = empty(s.board);
    if (spaces.length) {
      s.board[sample(s, spaces)] = value;
      fire(s, "A013", `쌍둥이 탄생 — ${value} 추가 생성`);
    } else note(s, "쌍둥이 탄생 — 빈칸 부족으로 하나만 생성");
  }
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
    copySource: null,
    swapSource: null,
    knightSource: null,
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
    s.copySource = null;
    s.swapSource = null;
    s.knightSource = null;
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
    if (action.id === "A009" && !canDuplicate(s)) return state;
    if (action.id === "A010" && !canSwapTiles(s)) return state;
    if (action.id === "A011" && !canGrow(s)) return state;
    if (action.id === "A014" && !canKnightMerge(s)) return state;
    s.target = s.target === action.id ? null : action.id;
    s.copySource = null;
    s.swapSource = null;
    s.knightSource = null;
    return s;
  }
  if (action.type === "target" && s.target) {
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i > 15) return state;
    if (s.target === "A006") {
      if (![2, 4].includes(s.board[i])) return state;
      s.board[i] = 0;
      s.cool.A006 = 15;
      fire(s, "A006", "긴급 정리 — 타일 제거");
    } else if (s.target === "A014") {
      if (s.knightSource == null) {
        if (!knightTargets(s, i).length) return state;
        s.knightSource = i;
        return s;
      }
      if (s.knightSource === i) {
        s.knightSource = null;
        return s;
      }
      if (!knightTargets(s, s.knightSource).includes(i)) return state;
      s.board[i] *= 2;
      s.board[s.knightSource] = 0;
      s.score += s.board[i];
      s.cool.A014 = 40;
      fire(s, "A014", `기사의 여정 — ${s.board[i]} 합성`);
      cleanSmallTiles(s, s.board[i] === 4 ? 1 : 0, [i]);
    } else if (s.target === "A011") {
      if (![2, 4, 8].includes(s.board[i])) return state;
      s.board[i] *= 2;
      s.cool.A011 = 25;
      fire(s, "A011", `성장 촉진 — ${s.board[i]}로 성장`);
    } else if (s.target === "A010") {
      if (!s.board[i]) return state;
      if (s.swapSource == null) {
        s.swapSource = i;
        return s;
      }
      if (i === s.swapSource) {
        s.swapSource = null;
        return s;
      }
      if (!s.board[s.swapSource] || s.board[i] === s.board[s.swapSource]) return state;
      [s.board[i], s.board[s.swapSource]] = [s.board[s.swapSource], s.board[i]];
      s.cool.A010 = 40;
      fire(s, "A010", "타일 교환 — 두 타일 위치 교환");
    } else if (s.target === "A009") {
      if (s.board[i] > 0) {
        s.copySource = i;
        return s;
      }
      if (s.copySource == null || !s.board[s.copySource]) return state;
      s.board[i] = s.board[s.copySource];
      s.cool.A009 = 60;
      fire(s, "A009", `타일 복제 — ${s.board[i]} 복사`);
    } else {
      const r = Math.floor(i / 4);
      if (r >= 3) return state;
      for (let c = 0; c < 4; c++)
        [s.board[r * 4 + c], s.board[(r + 1) * 4 + c]] = [
          s.board[(r + 1) * 4 + c],
          s.board[r * 4 + c],
        ];
      s.cool.A007 = 12;
      fire(s, "A007", `${r + 1}·${r + 2}행 교환`);
    }
    s.target = null;
    s.copySource = null;
    s.swapSource = null;
    s.knightSource = null;
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
  cleanSmallTiles(s, m.small, m.merged);
  let cancel = false;
  if (s.owned.includes("A004") && !ready.A004 && m.merged.length >= 2) {
    cancel = true;
    s.cool.A004 = 4;
    fire(s, "A004", "연쇄 반응 — 생성 취소");
  }
  if (
    s.owned.includes("A008") &&
    !ready.A008 &&
    beforeEmpty <= 2 &&
    m.merged.length
  ) {
    cancel = true;
    s.cool.A008 = 8;
    fire(s, "A008", "벼랑 끝의 보상 — 생성 취소");
  }
  if (cancel) {
    finish(s);
    return s;
  }
  const spaces = empty(s.board);
  if (
    s.owned.includes("A002") &&
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
    fire(s, "A002", "생성 위치를 선택하세요");
    return s;
  }
  if (spaces.length) spawn(s, sample(s, spaces));
  else finish(s);
  return s;
}
