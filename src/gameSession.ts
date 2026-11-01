import { createGame, goals } from "./engine";

export function gameSession(search: string) {
  const testMode = new URLSearchParams(search).has("test");
  return {
    testMode,
    storageKey: testMode ? "augmented2048-test-a001-a003-v1" : "augmented2048-v1",
    newGame(seed?: number) {
      if (!testMode) return createGame(seed);
      const s = createGame(2048);
      s.board = [1024, 1024, 0, 0, 2, 4, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0];
      s.owned = ["A001", "A002", "A003"];
      s.cool = {};
      s.spawned = 4;
      s.chosenBirthStart = 4;
      s.continued = true;
      s.reached = [...goals];
      s.log = ["A001~A003 테스트 — A002는 획득 시점부터 5회 생성 후 발동합니다. 다음 생성은 A003으로 4가 됩니다."];
      return s;
    },
  };
}
