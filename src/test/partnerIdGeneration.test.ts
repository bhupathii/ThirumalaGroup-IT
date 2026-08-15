import { describe, it, expect } from 'vitest';
import { generateNextPartnerId } from '../pages/finance/NewPartner';

describe('Partner ID Generation Tests', () => {
  it('generates P01 when no partners exist in the database', () => {
    expect(generateNextPartnerId([])).toBe('P01');
  });

  it('generates P04 when P01, P02, P03 exist', () => {
    const existing = [
      { partner_code: 'P01', partner_id: 1 },
      { partner_code: 'P02', partner_id: 2 },
      { partner_code: 'P03', partner_id: 3 },
    ];
    expect(generateNextPartnerId(existing)).toBe('P04');
  });

  it('generates P4 when unpadded P1, P2, P3 exist', () => {
    const existing = [
      { partner_code: 'P1', partner_id: 1 },
      { partner_code: 'P2', partner_id: 2 },
      { partner_code: 'P3', partner_id: 3 },
    ];
    expect(generateNextPartnerId(existing)).toBe('P4');
  });

  it('finds the highest sequential ID regardless of list ordering or gaps', () => {
    const existing = [
      { partner_code: 'P02' },
      { partner_code: 'P07' },
      { partner_code: 'P01' },
      { partner_code: 'P03' },
    ];
    expect(generateNextPartnerId(existing)).toBe('P08');
  });

  it('correctly parses numerical partner_id when partner_code is missing or null', () => {
    const existing = [
      { partner_id: 1, partner_code: null },
      { partner_id: 2, partner_code: null },
      { partner_id: 5, partner_code: null },
    ];
    expect(generateNextPartnerId(existing)).toBe('P06');
  });

  it('transitions from P09 to P10 correctly', () => {
    const existing = [
      { partner_code: 'P08' },
      { partner_code: 'P09' },
    ];
    expect(generateNextPartnerId(existing)).toBe('P10');
  });
});
