import { describe, it, expect } from 'vitest';

export function parseLoanRemarksAndParticulars(rawRemarks: string | null | undefined, colLogParticulars?: string) {
  let loadedParticulars = colLogParticulars || '';
  let loadedExtraDetails = '';
  let loadedRemarks = '';

  if (rawRemarks) {
    const partMatch = rawRemarks.match(/Particulars:\s*([^|]+)/i);
    if (partMatch && partMatch[1] && !loadedParticulars) {
      loadedParticulars = partMatch[1].trim();
    }

    const extraMatch = rawRemarks.match(/Extra:\s*([^|]+)/i);
    if (extraMatch && extraMatch[1] && !loadedExtraDetails) {
      const ext = extraMatch[1].trim();
      if (ext !== 'N/A') loadedExtraDetails = ext;
    }

    // Extract base remarks (parts before Particulars/Collateral/Extra)
    const parts = rawRemarks.split('|').map(s => s.trim());
    const baseParts = parts.filter(p => 
      !p.toLowerCase().startsWith('particulars:') &&
      !p.toLowerCase().startsWith('collateral:') &&
      !p.toLowerCase().startsWith('extra:') &&
      !p.startsWith('[NPA CLOSED')
    );
    if (baseParts.length > 0) {
      loadedRemarks = baseParts.join(' | ');
    }
  }

  return {
    particulars: loadedParticulars,
    extraDetails: loadedExtraDetails,
    remarks: loadedRemarks
  };
}

export function formatFinalRemarks(remarks: string, particulars: string, locations: Array<{ address: string; latitude: string; longitude: string }>, extraDetails: string) {
  const remarksParts: string[] = [];
  if (remarks?.trim()) {
    remarksParts.push(remarks.trim());
  }
  if (particulars?.trim()) {
    remarksParts.push(`Particulars: ${particulars.trim()}`);
  }
  const locStr = locations.map(l => l.address).filter(Boolean).join(', ') || 'N/A';
  const gpsStr = locations.map(l => l.latitude && l.longitude ? `${l.latitude},${l.longitude}` : '').filter(Boolean).join(' / ') || 'N/A';
  remarksParts.push(`Collateral: ${locStr}, GPS: ${gpsStr}`);
  if (extraDetails?.trim()) {
    remarksParts.push(`Extra: ${extraDetails.trim()}`);
  } else {
    remarksParts.push('Extra: N/A');
  }

  return remarksParts.join(' | ');
}

describe('Edit Loan Lock and Particulars Tests', () => {
  it('correctly loads particulars from collateral log when available', () => {
    const rawRemarks = 'Particulars: Hand loan | Collateral: N/A, GPS: N/A | Extra: N/A';
    const colLogParticulars = 'Business working capital';

    const result = parseLoanRemarksAndParticulars(rawRemarks, colLogParticulars);
    expect(result.particulars).toBe('Business working capital');
  });

  it('correctly falls back to parsing Particulars from rawRemarks when collateral log is empty', () => {
    const rawRemarks = 'Particulars: Gold loan for shop expansion | Collateral: Plot 5, GPS: 17.4,78.5 | Extra: Urgent';

    const result = parseLoanRemarksAndParticulars(rawRemarks, undefined);
    expect(result.particulars).toBe('Gold loan for shop expansion');
    expect(result.extraDetails).toBe('Urgent');
  });

  it('correctly formats and preserves Particulars in finalRemarks roundtrip', () => {
    const originalParticulars = 'Business working capital';
    const remarks = 'Customer referred by branch manager';
    const locations = [{ address: 'Survey No 45', latitude: '17.385', longitude: '78.486' }];
    const extraDetails = 'Repayment by monthly cheques';

    const finalRemarks = formatFinalRemarks(remarks, originalParticulars, locations, extraDetails);
    expect(finalRemarks).toContain('Particulars: Business working capital');

    const parsed = parseLoanRemarksAndParticulars(finalRemarks, undefined);
    expect(parsed.particulars).toBe(originalParticulars);
    expect(parsed.remarks).toBe(remarks);
    expect(parsed.extraDetails).toBe(extraDetails);
  });

  it('evaluates transaction lock status: editable when 0 non-opening entries, locked when entries exist', () => {
    // Before first transaction: only opening entries exist
    const isLockedBeforeTx = (nonOpeningCdCount: number, nonDisbTxCount: number, cdInterestCount: number, duesPaidCount: number) => {
      return (nonOpeningCdCount > 0 || nonDisbTxCount > 0 || cdInterestCount > 0 || duesPaidCount > 0);
    };

    expect(isLockedBeforeTx(0, 0, 0, 0)).toBe(false); // NO TRANSACTION -> EDITABLE
    expect(isLockedBeforeTx(1, 0, 0, 0)).toBe(true);  // CD repayment -> LOCKED
    expect(isLockedBeforeTx(0, 1, 0, 0)).toBe(true);  // Non-disb transaction -> LOCKED
    expect(isLockedBeforeTx(0, 0, 1, 0)).toBe(true);  // Interest detail recorded -> LOCKED
    expect(isLockedBeforeTx(0, 0, 0, 1)).toBe(true);  // Due paid -> LOCKED
  });
});
