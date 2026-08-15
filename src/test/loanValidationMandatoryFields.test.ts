import { describe, it, expect } from 'vitest';
import { validateFinanceForm, ValidationField } from '../utils/financeValidation';

describe('New Loan Mandatory Fields Validation', () => {
  it('should flag errors when mandatory fields are missing/empty', () => {
    const fields: ValidationField[] = [
      { name: 'selectedPartnerId', label: 'Assigned Partner', value: '', required: true },
      { name: 'g1SelectedId', label: 'Guarantor 1', value: '', required: true },
      { name: 'docCharges', label: 'Document Charges', value: '', required: true },
      { name: 'particulars', label: 'Particulars', value: '   ', required: true },
    ];

    const { isValid, errors } = validateFinanceForm(fields);
    expect(isValid).toBe(false);
    expect(errors.selectedPartnerId).toBe(true);
    expect(errors.g1SelectedId).toBe(true);
    expect(errors.docCharges).toBe(true);
    expect(errors.particulars).toBe(true);
  });

  it('should allow valid values including 0 for doc charges', () => {
    const fields: ValidationField[] = [
      { name: 'selectedPartnerId', label: 'Assigned Partner', value: 'partner-uuid-1', required: true },
      { name: 'g1SelectedId', label: 'Guarantor 1', value: 'cust-uuid-g1', required: true },
      { name: 'docCharges', label: 'Document Charges', value: '0', required: true },
      { name: 'particulars', label: 'Particulars', value: 'Hand loan against promissory note', required: true },
    ];

    const { isValid, errors } = validateFinanceForm(fields);
    expect(isValid).toBe(true);
    expect(errors.selectedPartnerId).toBeUndefined();
    expect(errors.g1SelectedId).toBeUndefined();
    expect(errors.docCharges).toBeUndefined();
    expect(errors.particulars).toBeUndefined();
  });

  it('should allow numeric 0 for doc charges', () => {
    const fields: ValidationField[] = [
      { name: 'selectedPartnerId', label: 'Assigned Partner', value: 'partner-uuid-1', required: true },
      { name: 'g1SelectedId', label: 'Guarantor 1', value: 'cust-uuid-g1', required: true },
      { name: 'docCharges', label: 'Document Charges', value: 0, required: true },
      { name: 'particulars', label: 'Particulars', value: 'Hand loan', required: true },
    ];

    const { isValid, errors } = validateFinanceForm(fields);
    expect(isValid).toBe(true);
  });
});
