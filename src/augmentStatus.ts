import { nextValue, type Id, type State } from "./engine";

export function augmentStatus(s: State, id: Id) {
  const wait = s.cool[id] || 0;
  if (["B01", "B02", "M01", "R03"].includes(id)) {
    const active = id === "B01" || id === "B02";
    return {
      imminent: wait === 1,
      text: wait
        ? `대기 ${wait}이동 · ${wait === 1 ? "다음 유효한 이동 후" : `${wait}회 유효한 이동 후`} ${active ? "사용 가능" : "대기 해제 (이후 조건 충족 시 발동)"}`
        : active
          ? "사용 가능"
          : `조건부 발동 · ${id === "M01" ? "한 이동에서 2쌍 이상 합성 시" : "이동 전 빈칸 2개 이하에서 합성 시"}`,
    };
  }
  if (id === "G02" || id === "G03") {
    const remaining = 5 - (s.spawned % 5);
    return {
      imminent: remaining === 1,
      text: `${remaining}회 생성 후 발동${remaining === 1 ? " · 다음 생성" : ""} · ${id === "G02" ? (s.phase === "spawn" ? "지금 생성 위치 선택 중" : "빈칸 후보 2곳 이상일 때 위치 선택") : "4 생성"}`,
    };
  }
  if (id === "M02") {
    return {
      imminent: false,
      text: `2+2 합성 ${3 - s.small}회 남음 · 제거 대기 ${s.pendingClean}회${s.pendingClean ? " (제거 가능한 타일이 있는 이동에서 처리)" : ""}`,
    };
  }
  return { imminent: false, text: `상시 적용 · 다음 타일 ${nextValue(s)}` };
}
