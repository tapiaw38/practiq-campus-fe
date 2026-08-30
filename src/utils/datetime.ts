/**
 * Date formatting for the campus UI.
 *
 * Several screens called `toLocaleDateString()` / `toLocaleString()` with no
 * locale, so they rendered in whatever the browser was set to — "8/29/2026,
 * 10:38:44 AM" next to the "29 ago 2026" the rest of the app prints. Every
 * user-facing date goes through here so the app reads the same everywhere.
 */
export const CAMPUS_LOCALE = "es-AR";

/** 29/8/2026 */
export function formatDate(value: string | number | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(CAMPUS_LOCALE);
}

/** 29 ago 2026, 22:38 */
export function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString(CAMPUS_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Spanish month and weekday names come back lowercase, and `text-transform:
 * capitalize` turned every word into a capital — "Agosto De 2026". Only the
 * first letter should change.
 */
export function capitalizeFirst(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
