import { createGame, goals } from "./engine";

export function gameSession(search: string) {
  const testMode = new URLSearchParams(search).has("test");
  return {
    testMode,
    storageKey: testMode ? "augmented2048-test-v1" : "augmented2048-v1",
    newGame(seed?: number) {
      if (!testMode) return createGame(seed);
      const s = createGame(2048);
      s.board = [1024, 1024, 0, 0, 2, 4, ...Array(10).fill(0)];
      s.owned = ["B03", "B04", "B05", "G04", "G05"];
      s.cool = { B03: 0, B04: 0, B05: 0 };
      s.reached = [...goals];
      s.log = ["테스트 모드 — 타일 복제·타일 교환과 신규 증강 3종 준비 완료. 새 게임으로 초기 설정을 복원합니다."];
      return s;
    },
  };
}
