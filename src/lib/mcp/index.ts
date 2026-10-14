import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCalendars from "./tools/list-calendars";
import listEvents from "./tools/list-events";
import searchEvents from "./tools/search-events";
import createEvent from "./tools/create-event";
import deleteEvent from "./tools/delete-event";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "unified-calendar-hub",
  title: "Unified Calendar Hub",
  version: "0.1.0",
  instructions:
    "Personal calendar tools. Times are ISO 8601 and stored in UTC; the user is in Europe/Stockholm. Use list_calendars before creating events in a specific calendar, and confirm with the user before deleting.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCalendars, listEvents, searchEvents, createEvent, deleteEvent],
});
