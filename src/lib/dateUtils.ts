/**
 * Format ISO date-time string into a human-readable local timestamp
 * e.g. "Today at 4:15 PM" or "Oct 29, 4:15 PM"
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const dateStr = d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return '';
  }
}

