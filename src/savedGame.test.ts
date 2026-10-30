import { describe, expect, it } from "vitest";
import { applyAction, cards, createGame, goals } from "./engine";
import { legacyIds, restoreSavedGame } from "./savedGame";

describe("unified augment ID migration", () => {
  it("preserves the agreed original IDs independently of rarity and object order", () => {
    const names = ["생성 예고", "선택받은 탄생", "고급 생산 라인", "연쇄 반응", "정리의 달인", "긴급 정리", "차원 교환", "벼랑 끝의 보상", "타일 복제", "타일 교환", "성장 촉진", "작은 수의 법칙", "쌍둥이 탄생", "기사의 여정"];
    expect(Object.keys(cards).sort().slice(0, 14).map((id) => cards[id as keyof typeof cards].name)).toEqual(names);
    expect(new Set(Object.values(legacyIds)).size).toBe(14);
  });
  it("converts owned/draft/cooldown/target and every statistics namespace without altering the run", () => {
    const state = {
      ...createGame(123),
      owned: Object.keys(legacyIds),
      draft: ["G02", "M01", "R03"],
      target: "B06",
      knightSource: 0,
      cool: { B03: 51, B04: 39, B06: 0, M01: 2, R03: 7 },
      stats: { G02: 5, "offered:G02": 3, "picked:M01": 1, other: 7 },
    };
    const migrated = restoreSavedGame(JSON.stringify({ version: 1, state }))!;
    expect(migrated.owned).toEqual(Object.values(legacyIds));
    expect(migrated.draft).toEqual(["A002", "A004", "A008"]);
    expect(migrated.target).toBe("A014");
    expect(migrated.cool).toEqual({ A009: 51, A010: 39, A014: 0, A004: 2, A008: 7 });
    expect(migrated.stats).toEqual({ A002: 5, "offered:A002": 3, "picked:A004": 1, other: 7 });
    for (const key of ["board", "score", "turn", "seed", "next", "spawned", "reached", "phase", "log", "knightSource"] as const)
      expect(migrated[key]).toEqual(state[key]);
    expect(state.owned).toContain("B06");
    expect(restoreSavedGame(JSON.stringify({ version: 2, state: migrated }))).toEqual(migrated);
  });
  it("resumes a partially selected legacy ability and legacy drafts using the new engine", () => {
    const state = {
      ...createGame(123), owned: ["B03"], target: "B03", copySource: 0,
      board: [128, ...Array(15).fill(0)], reached: [...goals],
    };
    const restored = restoreSavedGame(JSON.stringify({ version: 1, state }))!;
    const copied = applyAction(restored, { type: "target", index: 15 });
    expect(copied.board[15]).toBe(128);
    expect(copied.cool.A009).toBe(60);
    const draft = restoreSavedGame(JSON.stringify({ version: 1, state: { ...state, target: null, phase: "draft", draft: ["G01", "B06"] } }))!;
    expect(applyAction(draft, { type: "pick", id: "A014" }).owned).toEqual(["A009", "A014"]);
  });
  it("preserves modern saves and restores missing fields in older saves", () => {
    const modern = createGame(123);
    expect(restoreSavedGame(JSON.stringify({ version: 2, state: modern }))).toEqual(modern);
    const old = { ...modern } as Partial<typeof modern>;
    delete old.copySource; delete old.swapSource; delete old.knightSource; delete old.continued;
    expect(restoreSavedGame(JSON.stringify({ version: 1, state: old }))).toEqual(modern);
    expect(restoreSavedGame(null)).toBeNull();
    expect(restoreSavedGame("broken")).toBeNull();
    expect(restoreSavedGame(JSON.stringify({ version: 999, state: modern }))).toBeNull();
  });
  it("handles mixed-ID saves without duplicate ownership or losing statistics", () => {
    const state = {
      ...createGame(123), owned: ["B03", "A009"],
      cool: { A009: 12, B03: 20 }, stats: { B03: 2, A009: 3 },
    };
    const restored = restoreSavedGame(JSON.stringify({ version: 2, state }))!;
    expect(restored.owned).toEqual(["A009"]);
    expect(restored.cool).toEqual({ A009: 12 });
    expect(restored.stats).toEqual({ A009: 5 });
  });
});
