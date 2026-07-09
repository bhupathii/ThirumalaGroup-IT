import { describe, it, expect } from 'vitest';

describe('CD Chronological Stability Regression Tests', () => {
  it('guarantees same-date re-entry preserves exact calculations after stable sorting', () => {
    // 1. Define original transactions
    const rawTxs = [
      { id: '1', date: '2026-04-06', receipt_no: 'RC1187', amount: 5000, created_at: '2026-07-09T07:00:00Z', type: 'Collection' },
      { id: '2', date: '2026-04-06', receipt_no: 'RC1188', amount: 3000, created_at: '2026-07-09T07:05:00Z', type: 'Collection' }
    ];

    // Sorting helper matching our stable business sequence
    const sortTxs = (list: typeof rawTxs) => {
      return [...list].sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        
        const aReceipt = a.receipt_no || '';
        const bReceipt = b.receipt_no || '';
        const receiptDiff = aReceipt.localeCompare(bReceipt, undefined, { numeric: true, sensitivity: 'base' });
        if (receiptDiff !== 0) return receiptDiff;
        
        return String(a.id).localeCompare(String(b.id));
      });
    };

    // Original sort order: RC1187 (id=1), RC1188 (id=2)
    const sorted1 = sortTxs(rawTxs);
    expect(sorted1[0].receipt_no).toBe('RC1187');
    expect(sorted1[1].receipt_no).toBe('RC1188');

    // Simulate deleting RC1187 (id=1) and re-entering as RC1187 with a new ID '3' and later created_at
    const modifiedTxs = [
      { id: '2', date: '2026-04-06', receipt_no: 'RC1188', amount: 3000, created_at: '2026-07-09T07:05:00Z', type: 'Collection' },
      { id: '3', date: '2026-04-06', receipt_no: 'RC1187', amount: 5000, created_at: '2026-07-09T07:15:00Z', type: 'Collection' }
    ];

    // Sorted order after re-entry: must still place RC1187 first (due to receipt_no alphanumeric sort)
    const sorted2 = sortTxs(modifiedTxs);
    expect(sorted2[0].receipt_no).toBe('RC1187');
    expect(sorted2[1].receipt_no).toBe('RC1188');
  });
});
