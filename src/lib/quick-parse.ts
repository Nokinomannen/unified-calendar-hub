// Deterministic natural-language parser for the Quick Add bar.
// Handles the common English/Swedish shapes without any network call.

export type QuickParseResult = {
  title: string;
  start: Date;
  end: Date;
  calendarHint: string | null;
  confident: boolean;
};

const WEEKDAYS: Record<string, number> = {
  monday: 1, mon: 1, måndag: 1, mandag: 1, mån: 1,
  tuesday: 2, tue: 2, tues: 2, tisdag: 2, tis: 2,
  wednesday: 3, wed: 3, onsdag: 3, ons: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, torsdag: 4, tor: 4,
  friday: 5, fri: 5, fredag: 5, fre: 5,
  saturday: 6, sat: 6, lördag: 6, lordag: 6, lör: 6,
  sunday: 0, sun: 0, söndag: 0, sondag: 0, sön: 0,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, januari: 0,
  feb: 1, february: 1, februari: 1,
  mar: 2, march: 2, mars: 2,
  apr: 3, april: 3,
  may: 4, maj: 4,
  jun: 5, june: 5, juni: 5,
  jul: 6, july: 6, juli: 6,
  aug: 7, august: 7, augusti: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, okt: 9, oktober: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function atMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function stripAll(text: string, matches: string[]) {
  let out = text;
  for (const m of matches) {
    if (!m) continue;
    out = out.replace(m, " ");
  }
  return out;
}

/**
 * Parse a free-text line into a draft event. Never throws — an unparseable
 * line still returns a sane default (today, next full hour, 1h) with
 * `confident: false` so the UI can offer the AI assistant instead.
 */
export function quickParse(input: string, now: Date = new Date()): QuickParseResult {
  const raw = input.trim();
  let rest = ` ${raw} `;
  const consumed: string[] = [];
  let sawDate = false;
  let sawTime = false;

  // --- calendar hint: @name or #name (last token wins) ---
  let calendarHint: string | null = null;
  const hint = rest.match(/[@#]([\p{L}\d-]+)/u);
  if (hint) {
    calendarHint = hint[1];
    consumed.push(hint[0]);
  }

  // --- date ---
  let day = atMidnight(now);

  const rel = rest.match(/\b(today|idag|tomorrow|imorgon|imorron|i morgon|overmorgon|övermorgon|day after tomorrow)\b/iu);
  const explicitDmy = rest.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
  const dayMonth = rest.match(/\b(\d{1,2})(?:st|nd|rd|th|:e)?\s+([\p{L}]{3,9})\b/u);
  const monthDay = rest.match(/\b([\p{L}]{3,9})\s+(\d{1,2})(?:st|nd|rd|th|:e)?\b/u);
  const weekday = rest.match(/\b(next\s+|nästa\s+)?([\p{L}]{3,9})\b/giu);

  if (rel) {
    const w = rel[1].toLowerCase();
    if (w.startsWith("tom") || w.startsWith("imor") || w.startsWith("i mor")) day = addDays(day, 1);
    else if (w.includes("morgon") || w.includes("after")) day = addDays(day, 2);
    consumed.push(rel[0]);
    sawDate = true;
  } else if (explicitDmy) {
    const d = Number(explicitDmy[1]);
    const m = Number(explicitDmy[2]) - 1;
    let y = explicitDmy[3] ? Number(explicitDmy[3]) : now.getFullYear();
    if (y < 100) y += 2000;
    const cand = new Date(y, m, d);
    if (!Number.isNaN(cand.getTime())) {
      day = !explicitDmy[3] && cand < atMidnight(now) ? new Date(y + 1, m, d) : cand;
      consumed.push(explicitDmy[0]);
      sawDate = true;
    }
  } else if (dayMonth && MONTHS[dayMonth[2].toLowerCase()] !== undefined) {
    const m = MONTHS[dayMonth[2].toLowerCase()];
    const d = Number(dayMonth[1]);
    let cand = new Date(now.getFullYear(), m, d);
    if (cand < atMidnight(now)) cand = new Date(now.getFullYear() + 1, m, d);
    day = cand;
    consumed.push(dayMonth[0]);
    sawDate = true;
  } else if (monthDay && MONTHS[monthDay[1].toLowerCase()] !== undefined) {
    const m = MONTHS[monthDay[1].toLowerCase()];
    const d = Number(monthDay[2]);
    let cand = new Date(now.getFullYear(), m, d);
    if (cand < atMidnight(now)) cand = new Date(now.getFullYear() + 1, m, d);
    day = cand;
    consumed.push(monthDay[0]);
    sawDate = true;
  } else if (weekday) {
    for (const token of weekday) {
      const t = token.trim().toLowerCase();
      const isNext = t.startsWith("next") || t.startsWith("nästa");
      const name = t.replace(/^(next|nästa)\s+/, "");
      const target = WEEKDAYS[name];
      if (target === undefined) continue;
      let delta = (target - day.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      if (isNext && delta < 7) delta += 7;
      day = addDays(day, delta);
      consumed.push(token);
      sawDate = true;
      break;
    }
  }

  // --- time range "13-15" / "13:00-15:30" ---
  let startH = 9;
  let startM = 0;
  let durMin = 60;

  const range = rest.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|—|till|to)\s*(\d{1,2})(?:[:.](\d{2}))?\b/);
  const single = rest.match(/\b(?:at|kl|kl\.|klockan)?\s*(\d{1,2})[:.](\d{2})\b/);
  const bareHour = rest.match(/\b(?:at|kl|kl\.|klockan)\s*(\d{1,2})\b/i);
  const dur = rest.match(/\b(?:for|i|under)?\s*(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|tim|timmar|timme|min|mins|minutes?|minuter)\b/i);

  if (range && Number(range[1]) < 24 && Number(range[3]) < 24) {
    startH = Number(range[1]);
    startM = Number(range[2] ?? 0);
    const endH = Number(range[3]);
    const endM = Number(range[4] ?? 0);
    durMin = Math.max(15, endH * 60 + endM - (startH * 60 + startM));
    consumed.push(range[0]);
    sawTime = true;
  } else if (single && Number(single[1]) < 24) {
    startH = Number(single[1]);
    startM = Number(single[2]);
    consumed.push(single[0]);
    sawTime = true;
  } else if (bareHour && Number(bareHour[1]) < 24) {
    startH = Number(bareHour[1]);
    startM = 0;
    consumed.push(bareHour[0]);
    sawTime = true;
  } else {
    const next = new Date(now.getTime() + 60 * 60_000);
    startH = next.getHours();
    startM = 0;
  }

  if (dur && !range) {
    const n = Number(dur[1].replace(",", "."));
    durMin = /^m/i.test(dur[2]) ? n : n * 60;
    consumed.push(dur[0]);
  } else if (dur && range) {
    consumed.push(dur[0]);
  }

  // --- title = whatever is left ---
  rest = stripAll(rest, consumed);
  const title = rest
    .replace(/\b(on|at|the|kl|kl\.|klockan|for|i|under|till|to|från|from)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startH, startM, 0, 0);
  const end = new Date(start.getTime() + durMin * 60_000);

  return {
    title: title || "Untitled",
    start,
    end,
    calendarHint,
    confident: Boolean(title) && (sawDate || sawTime),
  };
}

function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
