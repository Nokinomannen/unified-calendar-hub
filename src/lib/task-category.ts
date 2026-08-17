/** Auto-sorting of Notion tasks into work contexts (Mannaz, A-hub, Personligt …). */

export type TaskCategory = {
  key: string;
  label: string;
  color: string;
};

export type CategorizableTask = {
  id: string;
  title: string;
  tags?: string[];
  dbId?: string;
};

/** Lowercase, strip diacritics and every non-alphanumeric char so "A-Hub" === "a hub" === "ahub". */
export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export const DEFAULT_ALIASES: Record<string, string[]> = {
  mannaz: ["mannaz", "praktik", "internship"],
  ahub: ["ahub", "a-hub", "hub"],
  skola: ["skola", "school", "kth", "plugg", "tenta", "kurs", "föreläsning"],
  dj: ["dj", "gig", "spelning", "set"],
  personligt: ["personligt", "personal", "privat", "hemma"],
};

/** Words that identify a category: its own label plus any user aliases. */
function aliasIndex(categories: TaskCategory[], aliases: Record<string, string[]>) {
  const index: { key: string; needle: string }[] = [];
  for (const cat of categories) {
    const words = new Set<string>([cat.label, cat.key, ...(aliases[cat.key] ?? []), ...(DEFAULT_ALIASES[cat.key] ?? [])]);
    for (const w of words) {
      const n = normalize(w);
      if (n.length >= 2) index.push({ key: cat.key, needle: n });
    }
  }
  // Longer needles win so "ahub" beats "hub".
  return index.sort((a, b) => b.needle.length - a.needle.length);
}

export type CategorizeContext = {
  categories: TaskCategory[];
  aliases: Record<string, string[]>;
  overrides: Record<string, string>;
  dbDefaults: Record<string, string>;
  fallbackKey: string;
};

export type CategoryAssignment = { key: string; source: "manual" | "notion" | "title" | "database" | "fallback" };

export function categorize(task: CategorizableTask, ctx: CategorizeContext): CategoryAssignment {
  const valid = new Set(ctx.categories.map((c) => c.key));

  const manual = ctx.overrides[task.id];
  if (manual && valid.has(manual)) return { key: manual, source: "manual" };

  const index = aliasIndex(ctx.categories, ctx.aliases);

  // 2. Notion signals — select/multi-select values and #tags in the title.
  const signals = [...(task.tags ?? []), ...(task.title.match(/#[\p{L}\p{N}_-]+/gu) ?? [])];
  for (const raw of signals) {
    const n = normalize(raw);
    if (!n) continue;
    const hit = index.find((i) => i.needle === n || n.includes(i.needle));
    if (hit) return { key: hit.key, source: "notion" };
  }

  // 3. Keywords in the title.
  const title = normalize(task.title);
  const hit = index.find((i) => title.includes(i.needle));
  if (hit) return { key: hit.key, source: "title" };

  // 4. Per-database default.
  const dbDefault = task.dbId ? ctx.dbDefaults[task.dbId] : undefined;
  if (dbDefault && valid.has(dbDefault)) return { key: dbDefault, source: "database" };

  return { key: ctx.fallbackKey, source: "fallback" };
}

const PERSONAL_RE = /^(personligt|personal|privat)$/;

/** Build the category list from the user's calendar sources, always including a personal fallback. */
export function buildCategories(
  calendars: { id: string; name: string; color: string; archived?: boolean | null }[],
): { categories: TaskCategory[]; fallbackKey: string } {
  const categories: TaskCategory[] = [];
  for (const c of calendars) {
    if (c.archived) continue;
    const key = normalize(c.name);
    if (!key || categories.some((x) => x.key === key)) continue;
    categories.push({ key, label: c.name, color: c.color });
  }

  let fallback = categories.find((c) => PERSONAL_RE.test(c.key));
  if (!fallback) {
    fallback = { key: "personligt", label: "Personligt", color: "#c05b86" };
    categories.push(fallback);
  }
  return { categories, fallbackKey: fallback.key };
}
