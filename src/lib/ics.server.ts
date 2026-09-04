/**
 * Server-only minimal ICS (iCalendar) parser.
 * Extracts VEVENTs with UID, SUMMARY, DTSTART, DTEND, LOCATION, DESCRIPTION,
 * RRULE and all-day flag. Times are converted to UTC ISO strings.
 */

export type IcsEvent = {
  uid: string;
  title: string;
  start: string; // UTC ISO
  end: string; // UTC ISO
  allDay: boolean;
  location: string | null;
  description: string | null;
  rrule: string | null;
};

const KNOWN_TZ: Record<string, string> = {
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Central Europe Standard Time": "Europe/Budapest",
  "GMT Standard Time": "Europe/London",
  "UTC": "UTC",
  "Europe/Stockholm": "Europe/Stockholm",
  "Europe/Copenhagen": "Europe/Copenhagen",
  "Europe/Oslo": "Europe/Oslo",
  "Europe/Berlin": "Europe/Berlin",
  "Europe/London": "Europe/London",
};

/** Convert "20260910T090000" in a named time zone to a UTC Date. */
function zonedToUtc(naive: string, tzid: string | null): Date {
  const y = +naive.slice(0, 4);
  const mo = +naive.slice(4, 6) - 1;
  const d = +naive.slice(6, 8);
  const h = +(naive.slice(9, 11) || "0");
  const mi = +(naive.slice(11, 13) || "0");
  const s = +(naive.slice(13, 15) || "0");
  const tz = tzid ? (KNOWN_TZ[tzid] ?? tzid) : "UTC";
  // Guess: interpret as UTC first, then measure the zone's offset at that
  // instant and shift. One iteration is enough for zones without sub-hour
  // transitions around the guessed time.
  let guess = Date.UTC(y, mo, d, h, mi, s);
  const offset = tzOffsetMs(tz, new Date(guess));
  guess = Date.UTC(y, mo, d, h, mi, s) - offset;
  // Refine once in case we landed across a DST boundary.
  const offset2 = tzOffsetMs(tz, new Date(guess));
  if (offset2 !== offset) guess = Date.UTC(y, mo, d, h, mi, s) - offset2;
  return new Date(guess);
}

function tzOffsetMs(tz: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(at);
    const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? "0");
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    return asUtc - at.getTime();
  } catch {
    return 0;
  }
}

function parseDateTime(raw: string, params: Record<string, string>): { date: Date; allDay: boolean } {
  const value = raw.trim();
  const tzid = params["TZID"] ?? null;
  if (params["VALUE"] === "DATE" || /^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4), mo = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
    return { date: zonedToUtc(`${value}T000000`, tzid ?? "UTC"), allDay: true };
  }
  if (value.endsWith("Z")) {
    return { date: new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`), allDay: false };
  }
  return { date: zonedToUtc(value, tzid), allDay: false };
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

export function parseIcs(text: string): IcsEvent[] {
  // Unfold continuation lines (line starting with space/tab).
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r\n|\n/);
  const events: IcsEvent[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur && cur["UID"] && cur["DTSTART"]) {
        const start = parseDateTime(cur["DTSTART"].value, cur["DTSTART"].params);
        let end: Date;
        let allDay = start.allDay;
        if (cur["DTEND"]) {
          const e = parseDateTime(cur["DTEND"].value, cur["DTEND"].params);
          end = e.date;
        } else {
          end = new Date(start.date.getTime() + (allDay ? 86400_000 : 3600_000));
        }
        events.push({
          uid: cur["UID"].value,
          title: unescapeText(cur["SUMMARY"]?.value ?? "(no title)"),
          start: start.date.toISOString(),
          end: end.toISOString(),
          allDay,
          location: cur["LOCATION"] ? unescapeText(cur["LOCATION"].value) : null,
          description: cur["DESCRIPTION"] ? unescapeText(cur["DESCRIPTION"].value) : null,
          rrule: cur["RRULE"] ? cur["RRULE"].value : null,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^([A-Z0-9-]+)((?:;[A-Z0-9-]+=[^:;]*)*):(.*)$/i);
    if (!m) continue;
    const name = m[1].toUpperCase();
    const params: Record<string, string> = {};
    for (const pm of m[2].matchAll(/;([A-Z0-9-]+)=([^:;]*)/gi)) {
      params[pm[1].toUpperCase()] = pm[2];
    }
    if (!cur[name]) cur[name] = { value: m[3], params };
  }
  return events;
}
