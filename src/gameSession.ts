import { createGame, goals } from "./engine";

export function gameSession(search: string) {
  const testMode = new URLSearchParams(search).has("test");
  return {
    testMode,
    storageKey: testMode ? "augmented2048-test-v1" : "augmented2048-v1",
    newGame(seed?: number) {
      if (!testMode) return createGame(seed);
      const s = createGame(2048);
      s.board = [1024, 1024, 0, 0, 2, 4, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0];
      s.owned = ["A009", "A010", "A011", "A012", "A013", "A014", "A015", "A016"];
      s.cool = { A009: 0, A010: 0, A011: 0, A014: 0, A015: 0, A016: 0 };
      s.undoCharges = 2;
      s.reached = [...goals];
      s.log = ["테스트 모드 — 타일 복제·타일 교환과 기사의 여정 등 테스트 증강 준비 완료. 새 게임으로 초기 설정을 복원합니다."];
      return s;
    },
  };
}
