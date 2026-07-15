/**
 * Returns the current date in local browser timezone formatted as YYYY-MM-DD.
 * Avoids UTC timezone shifting issues.
 */
export function getLocalBusinessDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateStr(dateStr: string): boolean {
  if (!dateStr) return false;
  // If YYYY-MM-DD
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (y < 1000 || y > 9999) return false;
    if (m < 1 || m > 12) return false;
    const maxDays = new Date(y, m, 0).getDate();
    return d >= 1 && d <= maxDays;
  }
  // If DD/MM/YYYY
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (y < 1000 || y > 9999) return false;
    if (m < 1 || m > 12) return false;
    const maxDays = new Date(y, m, 0).getDate();
    return d >= 1 && d <= maxDays;
  }
  return false;
}
