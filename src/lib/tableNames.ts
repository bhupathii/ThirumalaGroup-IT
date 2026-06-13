/**
 * Helper functions to get table names based on current mode (regular or ITR)
 * Reads mode from localStorage to work outside React context
 */

type TableMode = 'regular' | 'itr';

/**
 * Get current table mode from localStorage
 */
export const getTableMode = (): TableMode => {
  const saved = sessionStorage.getItem('table_mode') || localStorage.getItem('table_mode');
  return (saved === 'itr' ? 'itr' : 'regular') as TableMode;
};

/**
 * Get table name based on current mode
 * @param baseName - Base table name (e.g., 'cash_book')
 * @param mode - Optional mode override, otherwise reads from localStorage
 * @returns Table name with suffix if in ITR mode (e.g., 'cash_book_itr')
 */
export const getTableName = (baseName: string, mode?: TableMode): string => {
  const currentMode = mode || getTableMode();
  
  // Tables that should have ITR versions
  const itrTables = [
    'cash_book',
    'edit_cash_book',
    'original_cash_book',
    'deleted_cash_book',
    'company_main_accounts',
    'company_main_sub_acc',
    'companies',  // Added: companies now has ITR version
    'balance_sheet',
    'ledger',
    'bank_guarantees',
    'vehicles',
    'drivers',
  ];
  
  // If table should have ITR version and we're in ITR mode, add suffix
  if (itrTables.includes(baseName) && currentMode === 'itr') {
    return `${baseName}_itr`;
  }
  
  return baseName;
};

/**
 * Get multiple table names at once
 */
export const getTableNames = (baseNames: string[], mode?: TableMode): Record<string, string> => {
  const result: Record<string, string> = {};
  baseNames.forEach(name => {
    result[name] = getTableName(name, mode);
  });
  return result;
};

