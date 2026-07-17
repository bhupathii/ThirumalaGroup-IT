import { sortNumerically } from '../../lib/financialCalculations';
import React, { useEffect, useState, useMemo } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceEditedLog, FinanceDeletedLog } from '../../lib/supabaseFinance';
import { Trash2, Edit2, Search, Calendar, Database, X, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { exportToExcel } from '../../utils/excel';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

export const ignoredKeys = new Set([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'customer_id',
  'fingerprint_url',
  'fingerprint_template',
  'fingerprint_added',
  'customer_fingerprint_template',
  'customer_fingerprint_image_url',
  'customer_fingerprint_added',
  'surety_fingerprint_template',
  'surety_fingerprint_image_url',
  'surety_fingerprint_added',
  'photo_url',
  'customer_photo_url',
  'surety_photo_url',
  'fingerprint_status',
  'fingerprint_id',
]);

export const keyLabelMap: Record<string, string> = {
  id: 'ID',
  created_at: 'CREATED AT',
  updated_at: 'UPDATED AT',
  deleted_at: 'DELETED AT',
  notes: 'NOTES',
  remarks: 'REMARKS',
  status: 'STATUS',
  name: 'NAME',
  phone: 'PHONE',
  phone_1: 'PHONE 1',
  phone_2: 'PHONE 2',
  phone2: 'PHONE 2',
  address: 'ADDRESS',
  aadhaar: 'AADHAAR NUMBER',
  father_name: 'FATHER/HUSBAND NAME',
  father_husband_name: 'FATHER/HUSBAND NAME',
  village: 'VILLAGE',
  mandal: 'MANDAL',
  district: 'DISTRICT',
  state: 'STATE',
  pincode: 'PINCODE',
  landmark: 'LANDMARK',

  loan_id: 'LOAN NUMBER',
  customer_id: 'CUSTOMER ID',
  date: 'LOAN DATE',
  amount: 'LOAN AMOUNT',
  interest_rate: 'INTEREST RATE (%)',
  duration_months: 'PERIOD (MONTHS)',
  period_days: 'PERIOD (DAYS)',
  due_type: 'DUE TYPE',
  due_amount: 'DUE AMOUNT',
  surety_name: 'SURETY NAME',
  surety_phone: 'SURETY PHONE',
  surety_aadhaar: 'SURETY AADHAAR',
  surety_relation: 'SURETY RELATION',
  surety_aadhaar_address: 'SURETY AADHAAR ADDRESS',
  surety_present_address: 'SURETY PRESENT ADDRESS',
  loan_category: 'LOAN CATEGORY',
  npa_closed: 'NPA CLOSED',
  document_charges: 'DOCUMENT CHARGES',
  penalty_percent: 'PENALTY RATE (%)',
  guarantor_1_id: 'GUARANTOR 1 ID',
  guarantor_2_id: 'GUARANTOR 2 ID',

  gps_latitude: 'GPS LATITUDE',
  gps_longitude: 'GPS LONGITUDE',
  google_maps_link: 'GOOGLE MAPS LINK',
  collateral_image: 'COLLATERAL IMAGE',
  collateral_address: 'COLLATERAL ADDRESS',
  particulars: 'ITEM DETAILS / PARTICULARS',
  extraDetails: 'EXTRA DETAILS',

  guarantor_id: 'GUARANTOR ID',
  permanent_address: 'PERMANENT ADDRESS',
  current_address: 'CURRENT ADDRESS',
  fingerprint_id: 'FINGERPRINT ID',
  fingerprint_added: 'FINGERPRINT ADDED',
  fingerprint_status: 'FINGERPRINT STATUS',
};

export const mapFieldLabel = (field: string): string => {
  if (keyLabelMap[field]) return keyLabelMap[field];
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(/\s+/)
    .map(word => word.toUpperCase())
    .join(' ');
};

export const formatDateHuman = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`;
};

export const formatLogValue = (field: string, val: any): string => {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'YES' : 'NO';
  if (typeof val === 'object') {
    try {
      return Object.entries(val)
        .map(([k, v]) => `${mapFieldLabel(k)}: ${formatLogValue(k, v)}`)
        .join('\n');
    } catch {
      return JSON.stringify(val);
    }
  }

  const fieldLower = field.toLowerCase();
  const numVal = Number(val);
  
  if (!isNaN(numVal) && typeof val !== 'string') {
    if (fieldLower.includes('rate') || fieldLower.includes('percent') || fieldLower.includes('interest')) {
      return `${numVal}%`;
    }
    if (fieldLower.includes('amount') || fieldLower.includes('charge') || fieldLower.includes('fee') || fieldLower.includes('balance') || fieldLower === 'debit' || fieldLower === 'credit' || fieldLower.includes('liability')) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(numVal);
    }
  } else if (typeof val === 'string') {
    const parsedNum = Number(val);
    if (!isNaN(parsedNum) && val.trim() !== '') {
      if (fieldLower.includes('amount') || fieldLower.includes('charge') || fieldLower.includes('fee') || fieldLower.includes('balance') || fieldLower.includes('liability')) {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 2,
        }).format(parsedNum);
      }
      if (fieldLower.includes('rate') || fieldLower.includes('percent')) {
        return `${parsedNum}%`;
      }
    }
  }

  return String(val);
};

export const mapTableName = (table: string): string => {
  switch (table) {
    case 'finance_loans':
      return 'LOANS';
    case 'finance_customers':
      return 'CUSTOMERS';
    case 'finance_loans_collateral':
      return 'COLLATERAL';
    case 'finance_guarantors':
      return 'GUARANTORS';
    case 'finance_partners':
      return 'PARTNERS';
    case 'finance_capital_entries':
      return 'CAPITAL ENTRIES';
    case 'finance_cashbook_entries':
      return 'CASHBOOK ENTRIES';
    default:
      return table.toUpperCase();
  }
};

export interface FlattenedLog {
  id: string;
  logId: string;
  edited_at: string;
  edited_by: string;
  table_name: string;
  record_id: string;
  field: string;
  oldValue: any;
  newValue: any;
  source: string;
  loanNo: string;
  customer: string;
  rawLog: FinanceEditedLog;
}

export const flattenLog = (log: FinanceEditedLog): FlattenedLog[] => {
  const oldVals = log.old_values || {};
  const newVals = log.new_values || {};

  // Check if it is the structured single-field audit log format
  if (typeof newVals === 'object' && newVals !== null && 'field_name' in newVals) {
    const field = newVals.field_name;
    const oldValue = 'value' in oldVals ? oldVals.value : (oldVals[field] !== undefined ? oldVals[field] : null);
    const newValue = newVals.value !== undefined ? newVals.value : (newVals[field] !== undefined ? newVals[field] : null);
    const source = newVals.source || 'EDIT LOAN';
    const loanNo = newVals.loan_number || oldVals.loan_number || '';
    const customer = newVals.customer_name || oldVals.customer_name || '';

    return [{
      id: `${log.id}-${field}`,
      logId: log.id,
      edited_at: log.edited_at,
      edited_by: log.edited_by,
      table_name: log.table_name,
      record_id: log.record_id,
      field,
      oldValue,
      newValue,
      source,
      loanNo,
      customer,
      rawLog: log,
    }];
  }

  // Otherwise, generic JSON object format
  const flattened: FlattenedLog[] = [];
  const allKeys = Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)]));

  for (const key of allKeys) {
    if (ignoredKeys.has(key)) continue;

    const oldV = oldVals[key];
    const newV = newVals[key];

    const oldStr = typeof oldV === 'object' && oldV !== null ? JSON.stringify(oldV) : String(oldV);
    const newStr = typeof newV === 'object' && newV !== null ? JSON.stringify(newV) : String(newV);

    if (oldV !== newV && oldStr !== newStr) {
      let loanNo = '';
      if (log.table_name === 'finance_loans') {
        loanNo = oldVals.loan_id || newVals.loan_id || '';
      }

      let customer = '';
      if (log.table_name === 'finance_customers') {
        customer = oldVals.name || newVals.name || '';
      } else if (log.table_name === 'finance_guarantors') {
        customer = oldVals.name || newVals.name || '';
      }

      flattened.push({
        id: `${log.id}-${key}`,
        logId: log.id,
        edited_at: log.edited_at,
        edited_by: log.edited_by,
        table_name: log.table_name,
        record_id: log.record_id,
        field: key,
        oldValue: oldV,
        newValue: newV,
        source: 'SYSTEM',
        loanNo,
        customer,
        rawLog: log,
      });
    }
  }

  return flattened;
};

const EditedDeletedLogs: React.FC = () => {
  const { user } = useAuth();
  const [logType, setLogType] = useState<'edited' | 'deleted'>('edited');
  const [editedLogs, setEditedLogs] = useState<FinanceEditedLog[]>([]);
  const [deletedLogs, setDeletedLogs] = useState<FinanceDeletedLog[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTableType, setFilterTableType] = useState('all');
  const [filterOperator, setFilterOperator] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modal state for side-by-side viewing
  const [selectedLogForModal, setSelectedLogForModal] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const el = await supabaseFinance.getEditedLogs();
      setEditedLogs(el);

      const dl = await supabaseFinance.getDeletedLogs();
      setDeletedLogs(dl);

      const l = await supabaseFinance.getLoans();
      setLoans(l);

      const c = await supabaseFinance.getCustomers();
      setCustomers(c);
    } catch (err) {
      console.error(err);
      toast.error('FAILED TO LOAD LOGS REGISTRY');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (log: FinanceDeletedLog) => {
    if (!window.confirm(`ARE YOU SURE YOU WANT TO RESTORE THIS DELETED RECORD BACK TO ${log.table_name.toUpperCase()}?`)) return;
    setRestoring(log.id);
    try {
      const staffName = user?.username || 'STAFF';
      const success = await supabaseFinance.restoreDeletedRecord(log.id, log.table_name, log.old_values, staffName);
      if (success) {
        toast.success('RECORD SUCCESSFULLY RESTORED!');
        fetchLogs();
      } else {
        toast.error('FAILED TO RESTORE RECORD');
      }
    } catch (err) {
      console.error(err);
      toast.error('RESTORATION ERROR');
    } finally {
      setRestoring(null);
    }
  };

  // Cleaned up old expansion toggles

  // Lookup maps
  const customerMap = useMemo(() => {
    const map: Record<string, string> = {};
    customers.forEach(c => {
      map[c.id] = c.name;
    });
    return map;
  }, [customers]);

  const loanMap = useMemo(() => {
    const map: Record<string, any> = {};
    loans.forEach(l => {
      map[l.id] = l;
    });
    return map;
  }, [loans]);

  const guarantorLoanMap = useMemo(() => {
    const map: Record<string, any> = {};
    loans.forEach(l => {
      if (l.guarantor_1_id) map[l.guarantor_1_id] = l;
      if (l.guarantor_2_id) map[l.guarantor_2_id] = l;
    });
    return map;
  }, [loans]);

  // Resolved Edited logs
  const resolvedFlattenedLogs = useMemo(() => {
    const result: (FlattenedLog & { displayLoanNo: string; displayCustomer: string })[] = [];
    
    editedLogs.forEach(log => {
      const flattened = flattenLog(log);
      flattened.forEach(item => {
        let displayLoanNo = item.loanNo || '';
        let displayCustomer = item.customer || '';

        const oldVals = item.rawLog.old_values || {};
        const newVals = item.rawLog.new_values || {};

        if (!displayLoanNo) {
          if (item.table_name === 'finance_loans') {
            const lObj = loanMap[item.record_id];
            displayLoanNo = lObj?.loan_id || oldVals.loan_id || newVals.loan_id || '';
          } else if (item.table_name === 'finance_loans_collateral') {
            const lObj = loanMap[item.record_id];
            displayLoanNo = lObj?.loan_id || '';
          } else if (item.table_name === 'finance_guarantors') {
            const lObj = guarantorLoanMap[item.record_id];
            displayLoanNo = lObj?.loan_id || '';
          } else if (item.table_name === 'finance_customers') {
            const matchedLoan = loans.find(l => l.customer_id === item.record_id);
            displayLoanNo = matchedLoan?.loan_id || '';
          }
        }

        if (!displayCustomer) {
          if (item.table_name === 'finance_loans') {
            const lObj = loanMap[item.record_id];
            displayCustomer = lObj?.customer?.name || customerMap[oldVals.customer_id] || customerMap[newVals.customer_id] || '';
          } else if (item.table_name === 'finance_loans_collateral') {
            const lObj = loanMap[item.record_id];
            displayCustomer = lObj?.customer?.name || '';
          } else if (item.table_name === 'finance_customers') {
            displayCustomer = oldVals.name || newVals.name || customerMap[item.record_id] || '';
          } else if (item.table_name === 'finance_guarantors') {
            const lObj = guarantorLoanMap[item.record_id];
            displayCustomer = lObj?.customer?.name || '';
          }
        }

        result.push({
          ...item,
          displayLoanNo: displayLoanNo || '-',
          displayCustomer: displayCustomer || '-',
        });
      });
    });

    return result;
  }, [editedLogs, loans, customers, customerMap, loanMap, guarantorLoanMap]);

  // Unique operators list
  const uniqueOperators = useMemo(() => {
    const ops = new Set<string>();
    editedLogs.forEach(log => {
      if (log.edited_by) ops.add(log.edited_by);
    });
    deletedLogs.forEach(log => {
      if (log.deleted_by) ops.add(log.deleted_by);
    });
    return Array.from(ops).sort();
  }, [editedLogs, deletedLogs]);

  // Filtered edited logs
  const filteredLogs = useMemo(() => {
    return resolvedFlattenedLogs.filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchLoan = item.displayLoanNo.toLowerCase().includes(q);
        const matchCustomer = item.displayCustomer.toLowerCase().includes(q);
        const matchOperator = item.edited_by.toLowerCase().includes(q);
        const matchField = item.field.toLowerCase().includes(q);
        if (!matchLoan && !matchCustomer && !matchOperator && !matchField) {
          return false;
        }
      }

      if (filterTableType !== 'all' && item.table_name !== filterTableType) {
        return false;
      }

      if (filterOperator !== 'all' && item.edited_by !== filterOperator) {
        return false;
      }

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        const itemDate = new Date(item.edited_at);
        if (itemDate < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        const itemDate = new Date(item.edited_at);
        if (itemDate > end) return false;
      }

      return true;
    });
  }, [resolvedFlattenedLogs, searchQuery, filterTableType, filterOperator, filterStartDate, filterEndDate]);

  // Helper for deleted log summary
  const getDeletedLogSummary = (log: FinanceDeletedLog): string => {
    const vals = log.old_values || {};
    switch (log.table_name) {
      case 'finance_loans': {
        const custName = customerMap[vals.customer_id] || '';
        return `LOAN NUMBER: ${vals.loan_id || '-'} ${custName ? `(${custName})` : ''}`;
      }
      case 'finance_customers':
        return `CUSTOMER: ${vals.name || '-'}`;
      case 'finance_guarantors':
        return `GUARANTOR: ${vals.name || '-'}`;
      case 'finance_loans_collateral':
        return `COLLATERAL FOR LOAN UUID: ${vals.loan_id || '-'}`;
      default:
        return `RECORD ID: ${log.record_id}`;
    }
  };

  // Filtered deleted logs
  const filteredDeletedLogs = useMemo(() => {
    return deletedLogs.filter(log => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const summary = getDeletedLogSummary(log).toLowerCase();
        const operator = (log.deleted_by || '').toLowerCase();
        const tableName = mapTableName(log.table_name).toLowerCase();
        if (!summary.includes(q) && !operator.includes(q) && !tableName.includes(q)) {
          return false;
        }
      }

      if (filterTableType !== 'all' && log.table_name !== filterTableType) {
        return false;
      }

      if (filterOperator !== 'all' && log.deleted_by !== filterOperator) {
        return false;
      }

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        const itemDate = new Date(log.deleted_at);
        if (itemDate < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(log.deleted_at);
        end.setHours(23, 59, 59, 999);
        const itemDate = new Date(log.deleted_at);
        if (itemDate > end) return false;
      }

      return true;
    });
  }, [deletedLogs, searchQuery, filterTableType, filterOperator, filterStartDate, filterEndDate, customerMap]);

  // Format value rendering cell with coloring (old is red, new is green)
  const renderFormattedValue = (field: string, val: any, isNew: boolean) => {
    const formatted = formatLogValue(field, val);
    const colorClass = isNew 
      ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
      : 'text-rose-700 bg-rose-50 border-rose-100';
    
    if (formatted.length > 50) {
      return (
        <div className={`p-2 rounded text-xs border max-h-24 overflow-y-auto whitespace-pre-wrap ${colorClass}`}>
          {formatted}
        </div>
      );
    }
    
    return (
      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
        {formatted}
      </span>
    );
  };

  // Render a clean readable card from a log change
  const renderReadableCard = (field: string, oldVal: any, newVal: any, changedBy: string, changedOn: string) => {
    return (
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm max-w-sm space-y-3 font-sans">
        <div>
          <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">FIELD:</div>
          <div className="text-sm font-bold text-slate-950 uppercase">{mapFieldLabel(field)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">OLD VALUE:</div>
            <div className="text-sm font-semibold text-rose-700">{formatLogValue(field, oldVal)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">NEW VALUE:</div>
            <div className="text-sm font-semibold text-emerald-700">{formatLogValue(field, newVal)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
          <div>
            <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">CHANGED BY:</div>
            <div className="text-xs font-semibold text-slate-950 uppercase">{changedBy}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">CHANGED ON:</div>
            <div className="text-[11px] font-semibold text-slate-600">{formatDateHuman(changedOn)}</div>
          </div>
        </div>
      </div>
    );
  };

  // Render a grid of cards for a deleted record
  const renderDeletedRecordCards = (log: FinanceDeletedLog) => {
    const vals = log.old_values || {};
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(vals)
          .filter(([key]) => !ignoredKeys.has(key))
          .map(([key, val]) => (
            <div key={key} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-2 font-sans">
              <div>
                <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">FIELD:</div>
                <div className="text-xs font-bold text-slate-950 uppercase">{mapFieldLabel(key)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">DELETED VALUE:</div>
                <div className="text-xs font-semibold text-rose-700">{formatLogValue(key, val)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                <div>
                  <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">DELETED BY:</div>
                  <div className="text-[11px] font-semibold text-slate-955 uppercase">{log.deleted_by}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">DELETED ON:</div>
                  <div className="text-[11px] font-semibold text-slate-600">{formatDateHuman(log.deleted_at)}</div>
                </div>
              </div>
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="finance-h1 font-bold uppercase text-slate-900">AUDIT LOGS REGISTRY</h1>
          <p className="finance-small-label uppercase text-slate-900 font-bold">REVIEW FULL AUDIT HISTORIES OF EDITED OR DELETED FINANCE ENTRIES</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
            Print
          </Button>
          <Button onClick={() => {
            if (logType === 'edited') {
              const data = filteredLogs.map(item => ({
                Timestamp: formatDateHuman(item.edited_at),
                Operator: item.edited_by,
                Table: mapTableName(item.table_name),
                'Loan No': item.displayLoanNo,
                Customer: item.displayCustomer,
                Field: mapFieldLabel(item.field),
                'Old Value': formatLogValue(item.field, item.oldValue),
                'New Value': formatLogValue(item.field, item.newValue),
                Source: item.source
              }));
              exportToExcel(data, `Edited_Logs_${new Date().toISOString().split('T')[0]}`);
            } else {
              const data = filteredDeletedLogs.map(log => ({
                Timestamp: formatDateHuman(log.deleted_at),
                Operator: log.deleted_by,
                Table: mapTableName(log.table_name),
                Details: getDeletedLogSummary(log)
              }));
              exportToExcel(data, `Deleted_Logs_${new Date().toISOString().split('T')[0]}`);
            }
            toast.success('Excel Logs Exported!');
          }} variant="secondary" size="sm" icon={Download}>
            Excel
          </Button>
        </div>
      </div>

      {/* Log Type toggle */}
      <div className="flex gap-2 mb-2 max-w-xs">
        <button
          onClick={() => setLogType('edited')}
          className={`flex-1 py-2 px-4 rounded-lg border transition-all flex justify-center items-center gap-2 ${ logType === 'edited' ? 'bg-green-100 text-green-700 border-green-300 shadow-sm font-semibold' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' }`}
        >
          <Edit2 className="w-4 h-4" />
          EDITED LOGS
        </button>
        <button
          onClick={() => setLogType('deleted')}
          className={`flex-1 py-2 px-4 rounded-lg border transition-all flex justify-center items-center gap-2 ${ logType === 'deleted' ? 'bg-red-100 text-red-700 border-red-300 shadow-sm font-semibold' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' }`}
        >
          <Trash2 className="w-4 h-4" />
          DELETED LOGS
        </button>
      </div>

      {/* Premium Filter Panel */}
      {!loading && (
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="SEARCH BY LOAN NO, CUSTOMER, OPERATOR, OR FIELD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all uppercase"
              />
            </div>

            {/* Table Type Selector */}
            <div className="w-full md:w-48">
              <select
                value={filterTableType}
                onChange={(e) => setFilterTableType(e.target.value)}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all uppercase"
              >
                <option value="all">ALL TABLES</option>
                <option value="finance_loans">LOANS</option>
                <option value="finance_customers">CUSTOMERS</option>
                <option value="finance_loans_collateral">COLLATERAL</option>
                <option value="finance_guarantors">GUARANTORS</option>
              </select>
            </div>

            {/* Operator Selector */}
            <div className="w-full md:w-48">
              <select
                value={filterOperator}
                onChange={(e) => setFilterOperator(e.target.value)}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all uppercase"
              >
                <option value="all">ALL OPERATORS</option>
                {uniqueOperators.map(op => (
                  <option key={op} value={op}>{op.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range & Clear Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2 border-t border-slate-50">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">DATE RANGE:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="py-1 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <span className="text-gray-400 text-xs uppercase">TO</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="py-1 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {(searchQuery || filterTableType !== 'all' || filterOperator !== 'all' || filterStartDate || filterEndDate) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterTableType('all');
                  setFilterOperator('all');
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors sm:ml-auto uppercase"
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : logType === 'edited' ? (
        /* Edited Logs View */
        <Card title="EDITED RECORDS LOGS" subtitle="TRACKING UPDATES TO PARTNER, LOAN AND CUSTOMER CARDS" className="shadow-md">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 uppercase font-bold text-sm">NO EDIT LOGS MATCH THE FILTERS</div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">TIMESTAMP</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">OPERATOR</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">TABLE</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">LOAN NO</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">CUSTOMER</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">FIELD CHANGED</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">OLD VALUE</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">NEW VALUE</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">SOURCE</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                    {filteredLogs.map((item) => {
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                            {formatDateHuman(item.edited_at)}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-900 font-medium">
                            {item.edited_by.toUpperCase()}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 font-mono">
                            {mapTableName(item.table_name)}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-700 font-mono font-medium">
                            {item.displayLoanNo}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-900 font-semibold">
                            {item.displayCustomer}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-700 font-medium uppercase">
                            {mapFieldLabel(item.field)}
                          </td>
                          <td className="px-4 py-3.5">
                            {renderFormattedValue(item.field, item.oldValue, false)}
                          </td>
                          <td className="px-4 py-3.5">
                            {renderFormattedValue(item.field, item.newValue, true)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                              {item.source}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedLogForModal(item)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors uppercase"
                            >
                              <Database className="w-3.5 h-3.5" />
                              VIEW DETAILS
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        /* Deleted Logs View */
        <Card title="DELETED RECORDS LOGS" subtitle="TRACKING REMOVED ENTRIES FROM THE FINANCE TABLES" className="shadow-md">
          {filteredDeletedLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 uppercase font-bold text-sm">NO DELETION LOGS MATCH THE FILTERS</div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">TIMESTAMP</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">OPERATOR</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">TABLE</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-900 uppercase tracking-wider">DETAILS</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-900 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredDeletedLogs.map((log) => {
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                          {formatDateHuman(log.deleted_at)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-900 font-medium">
                          {log.deleted_by.toUpperCase()}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 font-mono">
                          {mapTableName(log.table_name)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-700 font-semibold">
                          {getDeletedLogSummary(log)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right flex items-center justify-end gap-3">
                          <button
                            onClick={() => setSelectedLogForModal({
                              table_name: log.table_name,
                              edited_by: log.deleted_by,
                              field: 'Snapshot',
                              oldValue: log.old_values,
                              newValue: null
                            })}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors uppercase"
                          >
                            <Database className="w-3.5 h-3.5" />
                            VIEW DETAILS
                          </button>
                          <Button
                            onClick={() => handleRestore(log)}
                            variant="success"
                            size="sm"
                            disabled={restoring === log.id}
                            className="font-bold uppercase"
                          >
                            {restoring === log.id ? 'RESTORING...' : 'RESTORE'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {/* Side-by-Side Audit Modal */}
      {selectedLogForModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-150 max-w-[80vw] w-11/12 md:w-[65vw] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#0b1329] text-white p-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Side-by-Side Record Audit</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                  Table: {mapTableName(selectedLogForModal.table_name)} — Operator: {(selectedLogForModal.edited_by || selectedLogForModal.deleted_by || '').toUpperCase()}
                </p>
              </div>
              <button onClick={() => setSelectedLogForModal(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Before (Old Value) Column */}
                <div className="bg-red-50/60 border border-red-200 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-black text-red-800 border-b border-red-200 pb-1.5 uppercase">Before (Old Value / Removed)</div>
                  <pre className="text-xs font-mono text-red-700 whitespace-pre-wrap leading-relaxed">
                    {formatLogValue(selectedLogForModal.field, selectedLogForModal.oldValue)}
                  </pre>
                </div>
                
                {/* After (New Value) Column */}
                <div className="bg-emerald-50/60 border border-emerald-250 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-black text-emerald-800 border-b border-emerald-250 pb-1.5 uppercase">After (New Value / Added)</div>
                  <pre className="text-xs font-mono text-emerald-800 whitespace-pre-wrap leading-relaxed">
                    {selectedLogForModal.newValue !== null 
                      ? formatLogValue(selectedLogForModal.field, selectedLogForModal.newValue)
                      : 'RECORD DELETED'}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 px-4 py-3 sm:px-6 border-t border-slate-150 flex justify-end shrink-0">
              <button onClick={() => setSelectedLogForModal(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase transition-colors shadow-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Print Preview */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Audit Logs Report"
        documentTitle={`AUDIT LOGS REPORT`}
      >
        <div className="space-y-6 mt-6 text-[10px]">
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-4">
            <div>
              <p className="text-[12px] uppercase text-slate-700 font-bold">Audit Logs Registry</p>
            </div>
          </div>

          {logType === 'edited' ? (
            <table className="w-full border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[9px]">
                  <th className="p-2 text-left border-r border-slate-300">Timestamp</th>
                  <th className="p-2 text-left border-r border-slate-300">Operator</th>
                  <th className="p-2 text-left border-r border-slate-300">Table</th>
                  <th className="p-2 text-left border-r border-slate-300">Loan No</th>
                  <th className="p-2 text-left border-r border-slate-300">Customer</th>
                  <th className="p-2 text-left border-r border-slate-300">Field</th>
                  <th className="p-2 text-left border-r border-slate-300">Old Value</th>
                  <th className="p-2 text-left">New Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-300">{formatDateHuman(item.edited_at)}</td>
                    <td className="p-2 border-r border-slate-300">{item.edited_by}</td>
                    <td className="p-2 border-r border-slate-300">{mapTableName(item.table_name)}</td>
                    <td className="p-2 border-r border-slate-300">{item.displayLoanNo}</td>
                    <td className="p-2 border-r border-slate-300">{item.displayCustomer}</td>
                    <td className="p-2 border-r border-slate-300">{mapFieldLabel(item.field)}</td>
                    <td className="p-2 border-r border-slate-300">{formatLogValue(item.field, item.oldValue)}</td>
                    <td className="p-2">{formatLogValue(item.field, item.newValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[9px]">
                  <th className="p-2 text-left border-r border-slate-300">Timestamp</th>
                  <th className="p-2 text-left border-r border-slate-300">Operator</th>
                  <th className="p-2 text-left border-r border-slate-300">Table</th>
                  <th className="p-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeletedLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-300">{formatDateHuman(log.deleted_at)}</td>
                    <td className="p-2 border-r border-slate-300">{log.deleted_by}</td>
                    <td className="p-2 border-r border-slate-300">{mapTableName(log.table_name)}</td>
                    <td className="p-2">{getDeletedLogSummary(log)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default EditedDeletedLogs;
