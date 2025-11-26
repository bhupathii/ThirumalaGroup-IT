/**
 * Utility function to get display label for payment mode values
 * Maps database values to display labels:
 * - "Online" → "Double"
 * - "Bank Transfer" → "Bank"
 * - Other values remain unchanged
 */
export const getPaymentModeLabel = (mode: string | null | undefined): string => {
  if (!mode) return '';
  const modeStr = String(mode).trim();
  if (modeStr === 'Online') return 'Double';
  if (modeStr === 'Bank Transfer') return 'Bank';
  return modeStr;
};

/**
 * Get payment mode options for dropdowns
 * Returns options with display labels mapped correctly
 */
export const getPaymentModeOptions = (includeEmpty: boolean = true) => {
  const options = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank Transfer', label: 'Bank' },
    { value: 'Online', label: 'Double' }
  ];
  
  if (includeEmpty) {
    return [{ value: '', label: 'Select payment mode...' }, ...options];
  }
  return options;
};

