import React, { useEffect, useReducer, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  applyAction,
  createGame,
  cards,
  goals,
  nextValue,
  type Action,
  type Direction,
  type State,
} from "./engine";
import "./style.css";
const KEY = "augmented2048-v1";
function load(): State {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v?.version === 1 && v.state?.board?.length === 16) return v.state;
  } catch {}
  return createGame();
}
function App() {
  const [s, dispatch] = useReducer(
    (s: State, a: Action | { type: "reset"; seed?: number }) =>
      a.type === "reset" ? createGame(a.seed) : applyAction(s, a),
    undefined,
    load,
  );
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, state: s }));
  }, [s]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
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
        <button className="secondary" onClick={reset}>
          새 게임 ↗
        </button>
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
            className="board"
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
                if (el) {
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
                className={`tile v${v} ${s.choices.includes(i) ? "candidate" : ""} ${s.target === "B01" && [2, 4].includes(v) ? "candidate" : ""} ${s.target === "B02" && i < 12 ? "row-target" : ""}`}
                onClick={(e) => {
                  if (e.detail === 0)
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
          </div>
          <div className="instruction" role="status">
            {s.phase === "spawn"
              ? "빛나는 빈칸 중 생성 위치를 선택하세요."
              : s.target === "B01"
                ? "제거할 2 또는 4 타일을 선택하세요."
                : s.target === "B02"
                  ? "교환할 두 행 중 위쪽 행을 선택하세요."
                  : "방향키 / WASD · 모바일에서는 스와이프"}
            {s.target && (
              <button onClick={() => dispatch({ type: "cancel" })}>취소</button>
            )}
          </div>
          <div className="direction-pad" aria-label="방향 조작">
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
              차원 교환은 선택한 행과 바로 아래 행을 바꿉니다. 충전과 재사용
              대기는 유효한 이동에서만 진행됩니다.
            </p>
          </details>
        </section>
        <aside>
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
            <article className="owned" key={id}>
              <div className="card-label">
                {id} · {cards[id].rare ? "희귀" : "일반"}
              </div>
              <h3>{cards[id].name}</h3>
              <p>{cards[id].description}</p>
              {["B01", "B02"].includes(id) ? (
                <button
                  disabled={!!s.cool[id] || s.phase !== "play" || !!s.target}
                  onClick={() =>
                    dispatch({ type: "ability", id: id as "B01" | "B02" })
                  }
                >
                  {s.cool[id] ? `${s.cool[id]} 이동 후 충전` : "능력 사용 ↗"}
                </button>
              ) : (
                s.cool[id] > 0 && (
                  <small>{s.cool[id]} 이동 후 재발동 가능</small>
                )
              )}
              {id === "M02" && (
                <small>
                  합성 {s.small}/3 · 대기 {s.pendingClean}회
                </small>
              )}
            </article>
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
      {s.phase === "draft" && (
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
                  key={id}
                  onClick={() => dispatch({ type: "pick", id })}
                >
                  <span className="card-label">
                    {id} · {cards[id].rare ? "희귀" : "일반"}
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
      {(s.phase === "won" || s.phase === "lost") && (
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
            <button onClick={() => dispatch({ type: "reset" })}>
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
