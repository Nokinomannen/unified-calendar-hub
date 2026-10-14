export const EVENT_FIELDS = "id,title,description,location,start_at,end_at,all_day,calendar_id,rrule";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  calendar_id: string;
  rrule: string | null;
};

export const toEventJson = (e: EventRow, calendarName?: string) => ({
  id: e.id,
  title: e.title,
  description: e.description,
  location: e.location,
  start_at: e.start_at,
  end_at: e.end_at,
  all_day: e.all_day,
  calendar_id: e.calendar_id,
  calendar: calendarName ?? null,
  recurring: !!e.rrule,
});

export const textError = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });
