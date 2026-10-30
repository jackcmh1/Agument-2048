import React, {
  useEffect,
  useReducer,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import { createRoot } from "react-dom/client";
import {
  applyAction,
  createGame,
  cards,
  rarities,
  goals,
  nextValue,
  movement,
  type Action,
  type Direction,
  type State,
  type Id,
} from "./engine";
import "./style.css";
import { AugmentHelp } from "./AugmentHelp";
import { augmentStatus, compactAugmentStatus } from "./augmentStatus";
const KEY = "augmented2048-v1";
function load(): State {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v?.version === 1 && v.state?.board?.length === 16)
      return { continued: false, ...v.state };
  } catch {}
  return createGame();
}
function App() {
  const codexRef = useRef<HTMLDialogElement>(null);
  const [s, rawDispatch] = useReducer(
    (s: State, a: Action | { type: "reset"; seed?: number }) =>
      a.type === "reset" ? createGame(a.seed) : applyAction(s, a),
    undefined,
    load,
  );
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("augmented2048-theme") === "dark" ? "dark" : "light",
  );
  const [motionPreference, setMotionPreference] = useState(() => {
    const saved = localStorage.getItem("augmented2048-motion");
    return saved === "on" || saved === "off" || saved === "auto" ? saved : "on";
  });
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const motionEnabled =
    motionPreference === "on" ||
    (motionPreference === "auto" && !systemReducedMotion);
  const motionEnabledRef = useRef(motionEnabled);
  motionEnabledRef.current = motionEnabled;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = motionEnabled ? "on" : "off";
    localStorage.setItem("augmented2048-motion", motionPreference);
  }, [motionEnabled, motionPreference]);
  const [motion, setMotion] = useState<
    { from: number; to: number; value: number }[]
  >([]);
  const [merged, setMerged] = useState<number[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(s);
  const busy = useRef(false);
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  stateRef.current = s;
  const dispatch = useCallback(
    (action: Action | { type: "reset"; seed?: number }) => {
      if (busy.current) return;
      const current = stateRef.current;
      if (
        action.type === "move" &&
        current.phase === "play" &&
        !current.target &&
        motionEnabledRef.current
      ) {
        const result = movement(current.board, action.direction);
        if (result.changed) {
          busy.current = true;
          setMerged([]);
          setMotion(
            result.trajectories.filter(
              (tile) =>
                tile.from !== tile.to || result.merged.includes(tile.to),
            ),
          );
          motionTimer.current = setTimeout(() => {
            setMotion([]);
            setMerged(result.merged);
            busy.current = false;
          }, 150);
        }
      } else setMerged([]);
      rawDispatch(action);
    },
    [],
  );
  useEffect(
    () => () => {
      if (motionTimer.current) clearTimeout(motionTimer.current);
    },
    [],
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("augmented2048-theme", theme);
  }, [theme]);
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || !motion.length) return;
    const rect = board.getBoundingClientRect();
    const cells = board.querySelectorAll<HTMLElement>("[data-index]");
    const animations = motion.map((tile, i) => {
      const el = board.querySelector<HTMLElement>(`[data-flight="${i}"]`)!;
      const from = cells[tile.from].getBoundingClientRect();
      const to = cells[tile.to].getBoundingClientRect();
      Object.assign(el.style, {
        left: `${from.left - rect.left - board.clientLeft}px`,
        top: `${from.top - rect.top - board.clientTop}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
      });
      return el.animate(
        [
          { transform: "translate(0,0)" },
          {
            transform: `translate(${to.left - from.left}px,${to.top - from.top}px)`,
          },
        ],
        { duration: 140, easing: "ease-in-out", fill: "forwards" },
      );
    });
    return () => animations.forEach((a) => a.cancel());
  }, [motion]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, state: s }));
  }, [s]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (codexRef.current?.open) return;
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      const d: Record<string, Direction> = {
        ArrowLeft: "left",
        a: "left",
        ArrowRight: "right",
        d: "right",
        ArrowUp: "up",
        w: "up",
        ArrowDown: "down",
        s: "down",
      };
      if (d[e.key]) {
        e.preventDefault();
        dispatch({ type: "move", direction: d[e.key] });
      }
      if (e.key === "Escape") dispatch({ type: "cancel" });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const max = Math.max(...s.board),
    goal = goals.find((g) => !s.reached.includes(g));
  function reset() {
    if (window.confirm("현재 게임을 종료하고 새로 시작할까요?"))
      dispatch({ type: "reset" });
  }
  function download() {
    const blob = new Blob([JSON.stringify(s, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `augmented-2048-${s.initialSeed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main>
      <header>
        <div>
          <div className="eyebrow">BUILD YOUR OWN STRATEGY</div>
          <h1>
            증강 <span>2048</span>
            <sup>v0.1</sup>
          </h1>
          <p>익숙한 퍼즐, 매번 다른 가능성.</p>
        </div>
        <div className="header-actions">
          <button
            className="secondary theme-toggle"
            aria-label={
              theme === "light" ? "다크 모드로 전환" : "일반 모드로 전환"
            }
            aria-pressed={theme === "dark"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "☾ 다크 모드" : "☀ 일반 모드"}
          </button>
          <button className="secondary" onClick={reset}>
            새 게임 ↗
          </button>
          <button className="secondary" onClick={() => codexRef.current?.showModal()}>
            증강 도감
          </button>
        </div>
      </header>
      <div className="layout">
        <section className="play-area">
          <div className="hud">
            <div>
              <small>점수</small>
              <strong>{s.score.toLocaleString()}</strong>
            </div>
            <div>
              <small>최고 타일</small>
              <strong>{max}</strong>
            </div>
            <div>
              <small>다음 증강</small>
              <strong>{goal || "완성"}</strong>
            </div>
          </div>
          <div className="board-meta">
            <span>{s.turn} MOVES</span>
            <span>
              {s.owned.includes("G01")
                ? `다음 타일 ${nextValue(s)}`
                : "32를 만들어 첫 증강을 만나세요"}
            </span>
          </div>
          <div
            ref={boardRef}
            className={`board ${motion.length ? "is-moving" : ""}`}
            aria-label="2048 게임 보드"
            onPointerDown={(e) => {
              touch.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerCancel={() => (touch.current = null)}
            onPointerUp={(e) => {
              const p = touch.current;
              touch.current = null;
              if (!p) return;
              const dx = e.clientX - p.x,
                dy = e.clientY - p.y;
              if (Math.max(Math.abs(dx), Math.abs(dy)) >= 28) {
                dispatch({
                  type: "move",
                  direction:
                    Math.abs(dx) > Math.abs(dy)
                      ? dx > 0
                        ? "right"
                        : "left"
                      : dy > 0
                        ? "down"
                        : "up",
                });
              } else {
                const el = document
                  .elementFromPoint(e.clientX, e.clientY)
                  ?.closest("[data-index]") as HTMLElement | null;
                if (el && s.target !== "B02") {
                  const i = Number(el.dataset.index);
                  dispatch(
                    s.phase === "spawn"
                      ? { type: "spawn", index: i }
                      : { type: "target", index: i },
                  );
                }
              }
            }}
          >
            {s.board.map((v, i) => (
              <button
                key={i}
                data-index={i}
                aria-label={`${Math.floor(i / 4) + 1}행 ${(i % 4) + 1}열 ${v || "빈칸"}`}
                className={`tile v${v} ${v >= 4096 ? "high-value" : ""} ${motion.some((tile) => tile.to === i) ? "motion-hidden" : ""} ${merged.includes(i) ? "merged" : ""} ${s.choices.includes(i) ? "candidate" : ""} ${s.target === "B01" && [2, 4].includes(v) ? "candidate" : ""}`}
                onClick={(e) => {
                  if (e.detail === 0 && s.target !== "B02")
                    dispatch(
                      s.phase === "spawn"
                        ? { type: "spawn", index: i }
                        : { type: "target", index: i },
                    );
                }}
              >
                {v || (s.choices.includes(i) ? `+${nextValue(s)}` : "")}
              </button>
            ))}
            {s.target === "B02" && (
              <div className="row-swap-overlay">
                {[1, 2, 3].map((row) => (
                  <button
                    key={row}
                    className="row-swap-control"
                    style={{ gridRow: row }}
                    aria-label={`${row}행과 ${row + 1}행 교환`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={() => dispatch({ type: "target", index: (row - 1) * 4 })}
                  >
                    <span aria-hidden="true">↕</span> {row}·{row + 1}행 교환
                  </button>
                ))}
              </div>
            )}
            {motion.map((tile, i) => (
              <div
                aria-hidden="true"
                data-flight={i}
                key={i}
                className={`tile flying v${tile.value} ${tile.value >= 4096 ? "high-value" : ""}`}
              >
                {tile.value}
              </div>
            ))}
          </div>
          <section className="augment-toolbar" aria-label="보유 증강 및 능력">
            <div className="section-title">
              <h2>
                보유 증강 <span>{s.owned.length}</span>
              </h2>
              <button
                className="text-button"
                onClick={() =>
                  document.getElementById("augment-list")?.scrollIntoView({
                    behavior: window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches
                      ? "instant"
                      : "smooth",
                    block: "start",
                  })
                }
              >
                전체 효과 보기 ↓
              </button>
            </div>
            {!s.owned.length && (
              <p className="muted">32 달성 시 첫 증강을 선택합니다.</p>
            )}
            <div className="augment-shortcuts">
              {s.owned.map((id) => (
                <AugmentHelp key={id} description={cards[id].description}>
                {["B01", "B02"].includes(id) ? (
                  <button
                    key={id}
                    data-imminent={augmentStatus(s, id).imminent || undefined}
                    data-rarity={cards[id].rarity}
                    aria-disabled={
                      !!s.cool[id] ||
                      s.phase !== "play" ||
                      (!!s.target && s.target !== id) ||
                      !!motion.length
                    }
                    aria-pressed={s.target === id}
                    onClick={(e) => {
                      if (e.currentTarget.getAttribute("aria-disabled") === "true") return;
                      dispatch({ type: "ability", id: id as "B01" | "B02" });
                    }}
                  >
                    <strong>{cards[id].name}</strong>
                    <span className="rarity-label">
                      {rarities[cards[id].rarity].label} · 사용형
                    </span>
                    <small className="augment-status">{compactAugmentStatus(s, id)}</small>
                  </button>
                ) : (
                  <span
                    key={id}
                    className="passive-chip"
                    data-imminent={augmentStatus(s, id).imminent || undefined}
                    data-rarity={cards[id].rarity}
                    tabIndex={0}
                  >
                    {cards[id].name}
                    <small className="rarity-label">
                      {rarities[cards[id].rarity].label} · 패시브
                    </small>
                    <small className="augment-status">{compactAugmentStatus(s, id)}</small>
                  </span>
                )}
                </AugmentHelp>
              ))}
            </div>
          </section>
          <div className="instruction" role="status">
            {s.phase === "spawn"
              ? "빛나는 빈칸 중 생성 위치를 선택하세요."
              : s.target === "B01"
                ? "제거할 2 또는 4 타일을 선택하세요."
                : s.target === "B02"
                  ? "교환할 두 행 사이의 ↕ 버튼을 누르세요."
                  : "방향키 / WASD · 모바일에서는 스와이프"}
            {s.target && (
              <button onClick={() => dispatch({ type: "cancel" })}>취소</button>
            )}
          </div>
          <div className="motion-settings">
            <label htmlFor="motion-preference">애니메이션</label>
            <select
              id="motion-preference"
              value={motionPreference}
              onChange={(e) => setMotionPreference(e.target.value)}
            >
              <option value="auto">기기 설정 따름</option>
              <option value="on">켜기</option>
              <option value="off">끄기</option>
            </select>
            <small role="status">
              {motionEnabled
                ? "이동·합성 효과 켜짐"
                : motionPreference === "auto"
                  ? "기기의 동작 줄이기 설정으로 꺼짐"
                  : "효과 꺼짐"}
            </small>
          </div>
          <div className="direction-pad" aria-label="방향 조작" hidden>
            {(["left", "up", "down", "right"] as Direction[]).map((d, i) => (
              <button
                key={d}
                aria-label={d}
                onClick={() => dispatch({ type: "move", direction: d })}
              >
                {["←", "↑", "↓", "→"][i]}
              </button>
            ))}
          </div>
          <details>
            <summary>플레이 방법</summary>
            <p>
              같은 숫자를 합쳐 2048을 만드세요. 32부터 1024까지 새로운 목표를
              달성하면 증강을 선택합니다. 능력 사용은 이동 횟수를 소모하지
              않습니다. 진행 상황은 이 브라우저에 자동 저장됩니다.
            </p>
            <p>
              차원 교환은 두 행 사이의 ↕ 버튼을 눌러 위아래 행을 바꿉니다. 충전과 재사용
              대기는 유효한 이동에서만 진행됩니다.
            </p>
          </details>
        </section>
        <aside id="augment-list" tabIndex={-1}>
          <div className="section-title">
            <h2>나의 증강</h2>
            <span>{s.owned.length} / 6</span>
          </div>
          <p className="muted">선택이 쌓이면, 전략이 됩니다.</p>
          {!s.owned.length && (
            <div className="empty">
              <span>✧</span>
              <h3>첫 번째 가능성</h3>
              <p>
                32 타일을 완성하면
                <br />세 가지 증강 중 하나를 선택합니다.
              </p>
            </div>
          )}
          {s.owned.map((id) => (
            <AugmentHelp key={id} description={cards[id].description}>
            <article tabIndex={0} className="owned" key={id} data-rarity={cards[id].rarity}
              data-imminent={augmentStatus(s, id).imminent || undefined}>
              <div className="card-label">
                {id} · {rarities[cards[id].rarity].label}
              </div>
              <h3>{cards[id].name}</h3>
              <p>{cards[id].description}</p>
              <small className="augment-status">{augmentStatus(s, id).text}</small>
              {["B01", "B02"].includes(id) ? (
                <button
                  aria-disabled={
                    !!s.cool[id] ||
                    s.phase !== "play" ||
                    (!!s.target && s.target !== id)
                  }
                  aria-pressed={s.target === id}
                  onClick={(e) => {
                    if (e.currentTarget.getAttribute("aria-disabled") === "true") return;
                    dispatch({ type: "ability", id: id as "B01" | "B02" });
                    boardRef.current?.scrollIntoView({
                      block: "center",
                      behavior: "instant",
                    });
                  }}
                >
                  {s.target === id
                    ? "사용 취소"
                    : s.cool[id]
                      ? `${s.cool[id]} 이동 후 충전`
                      : "능력 사용 ↗"}
                </button>
              ) : null}
            </article>
            </AugmentHelp>
          ))}
          <div className="section-title log-title">
            <h2>런 기록</h2>
            <button className="text-button" onClick={download}>
              내보내기 ↓
            </button>
          </div>
          <ul className="log" aria-live="polite">
            {s.log.slice(0, 5).map((l, i) => (
              <li key={`${i}-${l}`}>{l}</li>
            ))}
          </ul>
          <small className="seed">
            SEED {s.initialSeed} · 생성 {s.spawned}회
          </small>
        </aside>
      </div>
      <footer>
        AUGMENTED 2048 <span>하나의 선택이 다음 수를 바꿉니다.</span>
      </footer>
      <dialog
        ref={codexRef}
        className="augment-codex"
        aria-labelledby="codex-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
              e.currentTarget.close();
          }
        }}
      >
        <div className="section-title">
          <h2 id="codex-title">증강 도감</h2>
          <button className="secondary" onClick={() => codexRef.current?.close()} autoFocus>
            닫기 ×
          </button>
        </div>
        <p className="muted">전체 {Object.keys(cards).length}종 · 등급과 효과를 확인하세요.</p>
        <div className="codex-grid">
          {(Object.keys(cards) as Id[]).map((id) => (
            <article className="owned" key={id} data-rarity={cards[id].rarity}>
              <div className="card-label">
                {id} · {rarities[cards[id].rarity].label} · {["B01", "B02"].includes(id) ? "사용형" : "패시브"}
              </div>
              <h3>{cards[id].name}</h3>
              <p>{cards[id].description}</p>
            </article>
          ))}
        </div>
      </dialog>
      {s.phase === "draft" && !motion.length && (
        <div className="overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-title"
            className="modal"
          >
            <div className="eyebrow">A NEW POSSIBILITY</div>
            <h2 id="draft-title">다음 전략을 선택하세요</h2>
            <p>{s.reached.at(-1)} 달성 · 이번 게임에 영구 적용됩니다.</p>
            <div className="draft-grid">
              {s.draft.map((id) => (
                <button
                  className="draft-card"
                  data-rarity={cards[id].rarity}
                  key={id}
                  onClick={() => dispatch({ type: "pick", id })}
                >
                  <span className="card-label">
                    {id} · {rarities[cards[id].rarity].label}
                  </span>
                  <h3>{cards[id].name}</h3>
                  <p>{cards[id].description}</p>
                  <strong>선택하기 ↗</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {(s.phase === "won" || s.phase === "lost") && !motion.length && (
        <div className="overlay">
          <section
            className="modal result"
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-title"
          >
            <div className="eyebrow">
              {s.phase === "won" ? "2048 ACHIEVED" : "RUN COMPLETE"}
            </div>
            <h2 id="result-title">
              {s.phase === "won"
                ? "가능성을 완성했습니다."
                : "다음 빌드를 만나볼까요?"}
            </h2>
            <p>
              점수 {s.score.toLocaleString()} · 최고 타일 {max} · {s.turn} 이동
            </p>
            {s.phase === "won" && (
              <button onClick={() => dispatch({ type: "continue" })}>
                이어서 하기
              </button>
            )}
            <button
              className="secondary"
              onClick={() => dispatch({ type: "reset" })}
            >
              새로운 런 시작
            </button>
            <button className="secondary" onClick={download}>
              런 기록 저장
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
