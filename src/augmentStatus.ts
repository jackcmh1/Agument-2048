import { nextValue, type Id, type State } from "./engine";

export function compactAugmentStatus(s: State, id: Id) {
  if (id === "G01") return `다음 타일 ${nextValue(s)}`;
  if (id === "G02" || id === "G03") {
    const remaining = 5 - s.spawned % 5;
    return remaining === 1 ? "다음 생성에 발동" : `생성 ${remaining}회 남음`;
  }
  if (id === "M02") return `합성 ${3 - s.small}회 · 제거 대기 ${s.pendingClean}회`;
  if (id === "M01" || id === "R03") return `대기 ${s.cool[id] || 0}이동`;
  if (s.target === id) return "사용 취소";
  if (s.cool[id]) return `충전 ${s.cool[id]}이동 남음`;
  return s.phase === "play" && !s.target ? "사용하기 ↗" : "사용 대기";
}

export function augmentStatus(s: State, id: Id) {
  const wait = s.cool[id] || 0;
  if (id === "M01" || id === "R03") {
    return { imminent: wait === 1, text: `대기 ${wait}이동` };
  }
  if (id === "B01" || id === "B02") {
    return {
      imminent: wait === 1,
      text: wait
        ? `대기 ${wait}이동 · ${wait === 1 ? "다음 유효한 이동 후" : `${wait}회 유효한 이동 후`} 사용 가능`
        : "사용 가능",
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
