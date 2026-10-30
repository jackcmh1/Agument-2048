import { canKnightMerge, canGrow, canSwapTiles, canDuplicate, isActive, nextValue, type Id, type State } from "./engine";

export function compactAugmentStatus(s: State, id: Id) {
  if (id === "G04") return "일반 생성 2 고정";
  if (id === "G05") {
    const remaining = 16 - s.spawned % 16;
    return remaining === 1 ? "다음 생성에 발동" : `생성 ${remaining}회 남음`;
  }
  if (id === "G01") return `다음 타일 ${nextValue(s)}`;
  if (id === "G02" || id === "G03") {
    const remaining = 5 - s.spawned % 5;
    return remaining === 1 ? "다음 생성에 발동" : `생성 ${remaining}회 남음`;
  }
  if (id === "M02") return `합성 ${3 - s.small}회 · 제거 대기 ${s.pendingClean}회`;
  if (id === "M01" || id === "R03") return `대기 ${s.cool[id] || 0}이동`;
  if (s.target === id) return "사용 취소";
  if (s.cool[id]) return `충전 ${s.cool[id]}이동 남음`;
  if (id === "B06" && !canKnightMerge(s)) return "나이트 거리의 같은 수 필요";
  if (id === "B05" && !canGrow(s)) return "2·4·8 타일 필요";
  if (id === "B04" && !canSwapTiles(s)) return "서로 다른 숫자 필요";
  if (id === "B03" && !canDuplicate(s)) return "숫자 타일·빈칸 필요";
  return s.phase === "play" && !s.target ? "사용하기 ↗" : "사용 대기";
}

export function augmentStatus(s: State, id: Id) {
  const wait = s.cool[id] || 0;
  if (id === "M01" || id === "R03") {
    return { imminent: wait === 1, text: `대기 ${wait}이동` };
  }
  if (id === "G04") return { imminent: false, text: "일반 생성 2 고정 · 고급 생산 라인의 4 생성은 유지" };
  if (id === "G05") {
    const remaining = 16 - s.spawned % 16;
    return { imminent: remaining === 1, text: `${remaining}회 생성 후 쌍둥이 탄생 · 빈칸이 있을 때 같은 숫자 추가` };
  }
  if (isActive(id)) {
    return {
      imminent: wait === 1,
      text: wait
        ? `대기 ${wait}이동 · ${wait === 1 ? "다음 유효한 이동 후" : `${wait}회 유효한 이동 후`} 사용 가능`
        : id === "B06" && !canKnightMerge(s) ? "나이트 거리의 같은 숫자 두 개가 필요합니다." : id === "B05" && !canGrow(s) ? "2·4·8 타일이 필요합니다." : id === "B04" && !canSwapTiles(s) ? "서로 다른 숫자 타일이 필요합니다." : id === "B03" && !canDuplicate(s) ? "숫자 타일과 빈칸이 필요합니다." : "사용 가능",
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
