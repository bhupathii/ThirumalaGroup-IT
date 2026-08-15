import { describe, it, expect } from 'vitest';

export interface CustomerRow {
  id: string;
  customer_id: number;
  name: string;
  phone_1: string | null;
  phone_2: string | null;
  village: string | null;
  present_village: string | null;
  aadhaar_village: string | null;
  mandal: string | null;
  present_mandal: string | null;
  aadhaar_mandal: string | null;
  district: string | null;
  present_district: string | null;
  aadhaar_district: string | null;
}

export const formatCustomerIdDisplay = (id: number | null | undefined): string => {
  return id !== null && id !== undefined ? String(id) : '—';
};

export const getDisplayVillage = (cust: Partial<CustomerRow>): string => {
  return (cust.present_village || cust.village || cust.aadhaar_village || '').trim() || '—';
};

export const getDisplayMandal = (cust: Partial<CustomerRow>): string => {
  return (cust.present_mandal || cust.mandal || cust.aadhaar_mandal || '').trim() || '—';
};

export const getDisplayDistrict = (cust: Partial<CustomerRow>): string => {
  return (cust.present_district || cust.district || cust.aadhaar_district || '').trim() || '—';
};

export const sortCustomersByCustomerIdAsc = (customers: CustomerRow[]): CustomerRow[] => {
  return [...customers].sort((a, b) => {
    const idA = a.customer_id ?? Infinity;
    const idB = b.customer_id ?? Infinity;
    return idA - idB;
  });
};

describe('Customers Table Display and Sorting Tests', () => {
  it('formats customer ID without # prefix and handles null/undefined gracefully', () => {
    expect(formatCustomerIdDisplay(234)).toBe('234');
    expect(formatCustomerIdDisplay(1)).toBe('1');
    expect(formatCustomerIdDisplay(null)).toBe('—');
    expect(formatCustomerIdDisplay(undefined)).toBe('—');
  });

  it('sorts customer records in ascending numerical order by customer_id', () => {
    const sampleList: CustomerRow[] = [
      { id: '1', customer_id: 236, name: 'C', phone_1: null, phone_2: null, village: null, present_village: null, aadhaar_village: null, mandal: null, present_mandal: null, aadhaar_mandal: null, district: null, present_district: null, aadhaar_district: null },
      { id: '2', customer_id: 235, name: 'B', phone_1: null, phone_2: null, village: null, present_village: null, aadhaar_village: null, mandal: null, present_mandal: null, aadhaar_mandal: null, district: null, present_district: null, aadhaar_district: null },
      { id: '3', customer_id: 234, name: 'A', phone_1: null, phone_2: null, village: null, present_village: null, aadhaar_village: null, mandal: null, present_mandal: null, aadhaar_mandal: null, district: null, present_district: null, aadhaar_district: null },
    ];

    const sorted = sortCustomersByCustomerIdAsc(sampleList);
    expect(sorted.map(c => c.customer_id)).toEqual([234, 235, 236]);
  });

  it('correctly resolves Mandal from present_mandal, mandal, or aadhaar_mandal', () => {
    expect(getDisplayMandal({ mandal: 'Medchal' })).toBe('Medchal');
    expect(getDisplayMandal({ present_mandal: 'Quthbullapur', mandal: null })).toBe('Quthbullapur');
    expect(getDisplayMandal({ aadhaar_mandal: 'Ghatkesar', mandal: '', present_mandal: '' })).toBe('Ghatkesar');
    expect(getDisplayMandal({})).toBe('—');
  });

  it('correctly resolves District from present_district, district, or aadhaar_district', () => {
    expect(getDisplayDistrict({ district: 'Rangareddy' })).toBe('Rangareddy');
    expect(getDisplayDistrict({ present_district: 'Hyderabad', district: null })).toBe('Hyderabad');
    expect(getDisplayDistrict({ aadhaar_district: 'Medchal-Malkajgiri' })).toBe('Medchal-Malkajgiri');
    expect(getDisplayDistrict({})).toBe('—');
  });

  it('correctly resolves Village from present_village, village, or aadhaar_village', () => {
    expect(getDisplayVillage({ village: 'Kompally' })).toBe('Kompally');
    expect(getDisplayVillage({ present_village: 'Bachupally' })).toBe('Bachupally');
    expect(getDisplayVillage({ aadhaar_village: 'Alwal' })).toBe('Alwal');
    expect(getDisplayVillage({})).toBe('—');
  });
});
