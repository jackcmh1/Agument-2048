import { describe, expect, it } from "vitest";
import { applyAction, createGame } from "./engine";
import { augmentStatus } from "./augmentStatus";

describe("augment status", () => {
  it("counts actual spawns and preserves the upcoming trigger on cancelled spawns", () => {
    const s = createGame(123);
    s.owned = ["A002", "A003", "A004"];
    s.board = [2, 2, 4, 4, ...Array(12).fill(0)];
    s.spawned = 3;
    expect(augmentStatus(s, "A003").imminent).toBe(false);
    s.spawned = 4;
    const cancelled = applyAction(s, { type: "move", direction: "left" });
    for (const id of ["A002", "A003"] as const) {
      expect(augmentStatus(cancelled, id).imminent).toBe(true);
      expect(augmentStatus(cancelled, id).text).toContain("다음 생성");
    }
    s.owned = ["A003"];
    const spawned = applyAction(s, { type: "move", direction: "left" });
    expect(augmentStatus(spawned, "A003").imminent).toBe(false);
    expect(augmentStatus(spawned, "A003").text).toContain("5회 생성 후");
  });

  it("distinguishes passive cooldown expiry from activation on the expiry move", () => {
    const s = createGame(123);
    s.owned = ["A004", "A006"];
    s.board = [2, 2, 4, 4, ...Array(12).fill(0)];
    s.cool = { A004: 1, A006: 1 };
    expect(augmentStatus(s, "A004")).toMatchObject({ imminent: true });
    expect(augmentStatus(s, "A004").text).toBe("대기 1이동");
    expect(augmentStatus(s, "A006").text).toContain("다음 유효한 이동 후 사용 가능");
    const n = applyAction(s, { type: "move", direction: "left" });
    expect(n.stats.A004).toBeUndefined();
    expect(augmentStatus(n, "A004")).toMatchObject({ imminent: false });
    expect(augmentStatus(n, "A004").text).toBe("대기 0이동");
    expect(augmentStatus(n, "A006").text).toBe("사용 가능");
  });

  it("keeps merge progress separate from queued removals", () => {
    const s = createGame(123);
    s.small = 2;
    s.pendingClean = 1;
    expect(augmentStatus(s, "A005")).toMatchObject({ imminent: false });
    expect(augmentStatus(s, "A005").text).toContain("2+2 합성 1회 남음 · 제거 대기 1회");
  });
});
