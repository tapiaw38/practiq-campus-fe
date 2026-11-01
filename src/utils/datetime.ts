export const CAMPUS_LOCALE = "es-AR";

export function formatDate(value: string | number | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(CAMPUS_LOCALE);
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString(CAMPUS_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function capitalizeFirst(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
