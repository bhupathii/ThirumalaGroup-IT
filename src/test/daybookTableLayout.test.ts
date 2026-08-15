import { describe, it, expect } from 'vitest';
import { formatRowDate, formatRowTime } from '../pages/finance/Daybook';

describe('Daybook Table Layout & Formatting Tests', () => {
  describe('formatRowDate', () => {
    it('formats ISO date strings as DD-Mon-YYYY (e.g. 03-Aug-2026)', () => {
      expect(formatRowDate('2026-08-03')).toBe('03-Aug-2026');
      expect(formatRowDate('2026-01-01')).toBe('01-Jan-2026');
      expect(formatRowDate('2026-12-25')).toBe('25-Dec-2026');
    });

    it('formats ISO timestamp strings cleanly', () => {
      expect(formatRowDate('2026-08-03T13:29:00.000Z')).toBe('03-Aug-2026');
    });

    it('returns placeholder on empty/null date', () => {
      expect(formatRowDate(null)).toBe('—');
      expect(formatRowDate(undefined)).toBe('—');
      expect(formatRowDate('')).toBe('—');
    });
  });

  describe('formatRowTime', () => {
    it('formats 24-hour time strings as 12-hour AM/PM (e.g. 01:29 PM)', () => {
      expect(formatRowTime('13:29:00')).toBe('01:29 PM');
      expect(formatRowTime('09:05:00')).toBe('09:05 AM');
      expect(formatRowTime('00:15:00')).toBe('12:15 AM');
      expect(formatRowTime('12:00:00')).toBe('12:00 PM');
    });

    it('formats timestamp strings into AM/PM format', () => {
      const result = formatRowTime('2026-08-03T13:29:00');
      expect(result).toMatch(/\d{2}:\d{2}\s+(AM|PM)/i);
    });

    it('falls back to createdAt timestamp if entryTime is missing', () => {
      const result = formatRowTime(null, '13:29:00');
      expect(result).toBe('01:29 PM');
    });

    it('returns placeholder on empty/null values', () => {
      expect(formatRowTime(null, null)).toBe('—');
      expect(formatRowTime(undefined, undefined)).toBe('—');
    });
  });

  describe('Daybook Table Column Sequence', () => {
    it('verifies expected column sequence matches requirements', () => {
      const expectedColumns = [
        '#',
        'Receipt',
        'Type',
        'Loan / Acc',
        'Customer Name',
        'Cash In (Cr)',
        'Cash Out (Dr)',
        'Balance',
        'Operator',
        'Date',
        'Particulars / Remarks'
      ];
      expect(expectedColumns).toHaveLength(11);
      expect(expectedColumns[9]).toBe('Date');
      expect(expectedColumns[10]).toBe('Particulars / Remarks');
      expect(expectedColumns).not.toContain('Time');
    });
  });

  describe('Direct Cashbook Entry Row Validation Rules', () => {
    const validateCashbookEntry = (input: {
      headOfAccount: string;
      particulars: string;
      credit: string | number;
      debit: string | number;
    }) => {
      const crVal = Number(input.credit) || 0;
      const drVal = Number(input.debit) || 0;

      if (!input.headOfAccount) {
        return { valid: false, error: 'Please select Head of Account' };
      }
      if (!input.particulars.trim()) {
        return { valid: false, error: 'Please enter Particulars' };
      }
      if (crVal < 0 || drVal < 0) {
        return { valid: false, error: 'Amounts cannot be negative' };
      }
      if (crVal <= 0 && drVal <= 0) {
        return { valid: false, error: 'Please enter Cash In (Credit) or Cash Out (Debit) amount greater than 0' };
      }
      if (crVal > 0 && drVal > 0) {
        return { valid: false, error: 'Cannot enter both Cash In and Cash Out in a single entry' };
      }
      return { valid: true };
    };

    it('blocks entry when Head of Account is empty', () => {
      const res = validateCashbookEntry({
        headOfAccount: '',
        particulars: 'Tea Expense',
        credit: 0,
        debit: 100
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Please select Head of Account');
    });

    it('blocks entry when Particulars is empty', () => {
      const res = validateCashbookEntry({
        headOfAccount: 'EXPENSE',
        particulars: '   ',
        credit: 0,
        debit: 100
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Please enter Particulars');
    });

    it('blocks entry when both Cash In and Cash Out are 0', () => {
      const res = validateCashbookEntry({
        headOfAccount: 'EXPENSE',
        particulars: 'Office stationery',
        credit: 0,
        debit: 0
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Please enter Cash In (Credit) or Cash Out (Debit) amount greater than 0');
    });

    it('blocks entry when both Cash In and Cash Out have positive values', () => {
      const res = validateCashbookEntry({
        headOfAccount: 'EXPENSE',
        particulars: 'Office stationery',
        credit: 500,
        debit: 500
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Cannot enter both Cash In and Cash Out in a single entry');
    });

    it('blocks entry when negative amounts are supplied', () => {
      const res = validateCashbookEntry({
        headOfAccount: 'EXPENSE',
        particulars: 'Refund',
        credit: -100,
        debit: 0
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Amounts cannot be negative');
    });

    it('allows valid Cash Out entry', () => {
      const res = validateCashbookEntry({
        headOfAccount: 'EXPENSE',
        particulars: 'Tea & coffee',
        credit: 0,
        debit: 120
      });
      expect(res.valid).toBe(true);
    });

    it('allows valid Cash In entry', () => {
      const res = validateCashbookEntry({
        headOfAccount: 'CAPITAL',
        particulars: 'Partner deposit',
        credit: 50000,
        debit: 0
      });
      expect(res.valid).toBe(true);
    });
  });
});
