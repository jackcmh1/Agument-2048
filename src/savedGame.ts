import { cards, isActive, type Id, type State } from "./engine";

export const legacyIds: Record<string, Id> = {
  G01: "A001", G02: "A002", G03: "A003", M01: "A004", M02: "A005",
  B01: "A006", B02: "A007", R03: "A008", B03: "A009", B04: "A010",
  B05: "A011", G04: "A012", G05: "A013", B06: "A014",
};
function convertId(value: string): Id {
  const id = legacyIds[value] ?? value;
  if (!Object.hasOwn(cards, id)) throw new Error("Unknown augment ID");
  return id as Id;
}

export function restoreSavedGame(serialized: string | null): State | null {
  try {
    const saved = JSON.parse(serialized || "null");
    if (![1, 2].includes(saved?.version) || saved?.state?.board?.length !== 16) return null;
    const s = saved.state;
    const owned = [...new Set((s.owned as string[]).map(convertId))];
    const draft = [...new Set((s.draft as string[]).map(convertId))];
    const target = s.target == null ? null : convertId(s.target);
    if (target != null && !isActive(target)) return null;
    const cool: Record<string, number> = {};
    for (const [id, turns] of Object.entries(s.cool as Record<string, number>)) {
      const converted = convertId(id);
      // Prefer a canonical entry if a save contains both forms of the same ID.
      if (id === converted || cool[converted] === undefined) cool[converted] = turns;
    }
    const stats: Record<string, number> = {};
    for (const [key, count] of Object.entries(s.stats as Record<string, number>)) {
      const converted = key.replace(/^(?:(offered|picked):)?([A-Z]\d+)$/, (_, prefix, id) =>
        `${prefix ? `${prefix}:` : ""}${legacyIds[id] ?? id}`,
      );
      stats[converted] = (stats[converted] || 0) + count;
    }
    return {
      continued: false, copySource: null, swapSource: null, knightSource: null,
      undoCharges: 0, undoRecharge: 0, history: [],
      ...s, owned, draft, target, cool, stats,
    };
  } catch {
    return null;
  }
}
