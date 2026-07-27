import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/UI/Input';
import { FinanceSmartCalendar } from '../../components/finance/FinanceSmartCalendar';
import { supabaseFinance, FinanceCashbookAccount, FinanceCashbookEntry } from '../../lib/supabaseFinance';
import { 
  ArrowLeft, 
  RotateCcw, 
  Save, 
  Plus, 
  Printer, 
  Trash2, 
  Edit2, 
  Search, 
  Info,
  Check,
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  Clock,
  BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { validateFinanceForm, ValidationField } from '../../utils/financeValidation';
import { useAuth } from '../../contexts/AuthContext';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { getLocalBusinessDateISO } from '../../utils/dateUtils';

const CashBook: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Database Data States
  const [accounts, setAccounts] = useState<FinanceCashbookAccount[]>([]);
  const [entries, setEntries] = useState<FinanceCashbookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(() => getLocalBusinessDateISO());
  const [accountNumber, setAccountNumber] = useState('');
  const [headOfAccount, setHeadOfAccount] = useState('');
  const [particulars, setParticulars] = useState('');
  const [credit, setCredit] = useState('');
  const [debit, setDebit] = useState('');
  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const entryDateRef = React.useRef<HTMLInputElement>(null);
  const headOfAccountRef = React.useRef<HTMLSelectElement>(null);
  const particularsRef = React.useRef<HTMLInputElement>(null);
  const creditRef = React.useRef<HTMLInputElement>(null);
  const debitRef = React.useRef<HTMLInputElement>(null);
  const newAccountNameRef = React.useRef<HTMLInputElement>(null);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');
  const [headFilter, setHeadFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(() => new Date().getMonth() + 1);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Modal / Dialog Popups States
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCategory, setNewAccountCategory] = useState<string>('');
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState('');
  const [editAccountCategory, setEditAccountCategory] = useState('');
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [financeMode] = useState<'REGULAR' | 'ITR'>(() => {
    const prev = sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode');
    return prev === 'itr' ? 'ITR' : 'REGULAR';
  });

  useEffect(() => {
    fetchData();
  }, [financeMode, filterYear, filterMonth, refreshCounter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const bookId = await supabaseFinance.getLegacyBookId(financeMode);
      const fetchedAccounts = await supabaseFinance.getCashbookAccounts();
      
      const startDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`;
      const lastDayNum = new Date(filterYear, filterMonth, 0).getDate();
      const endDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      
      const fetchedEntries = await supabaseFinance.getCashbookEntries(bookId, startDate, endDate);
      setAccounts(fetchedAccounts);
      setEntries(fetchedEntries);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load Day Book data');
    } finally {
      setLoading(false);
    }
  };

  const customEventProvider = async (year: number, month: number) => {
    const bookId = await supabaseFinance.getLegacyBookId(financeMode);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

    const monthEntries = await supabaseFinance.getCashbookEntries(bookId, startDate, endDate);
    
    const dots = new Set<string>();
    monthEntries.forEach(e => {
      dots.add(e.entry_date.split('T')[0]);
    });
    return dots;
  };

  // Mutually Exclusive Credit / Debit behavior:
  const handleCreditChange = (val: string) => {
    setCredit(val);
    if (val !== '') {
      setDebit('');
    }
  };

  const handleDebitChange = (val: string) => {
    setDebit(val);
    if (val !== '') {
      setCredit('');
    }
  };

  const handleAccountChange = (accId: string) => {
    setHeadOfAccount(accId);
    const selectedAcc = accounts.find(a => a.id === accId);
    if (selectedAcc && selectedAcc.account_number) {
      setAccountNumber(selectedAcc.account_number);
    } else {
      setAccountNumber('');
    }
  };

  // Form Reset / Clear
  const handleReset = (confirm = true) => {
    if (confirm && editId && !window.confirm('Cancel editing current entry?')) return;
    if (confirm && !editId && (particulars || credit || debit || headOfAccount) && !window.confirm('Clear all form fields?')) return;
    setEntryDate(getLocalBusinessDateISO());
    setHeadOfAccount('');
    setAccountNumber('');
    setParticulars('');
    setCredit('');
    setDebit('');
    setEditId(null);
    setErrors({});
  };

  // Save Entry (Create / Update)
  const handleSaveEntry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const creditVal = Number(credit) || 0;
    const debitVal = Number(debit) || 0;

    const fields: ValidationField[] = [
      { name: 'entryDate', label: 'Date', value: entryDate, required: true, ref: entryDateRef },
      { name: 'headOfAccount', label: 'Head of A/C', value: headOfAccount, required: true, ref: headOfAccountRef as any },
      { name: 'particulars', label: 'Particulars', value: particulars, required: true, ref: particularsRef as any },
      { 
        name: 'amount_xor', 
        label: 'Credit or Debit', 
        value: 'checked', 
        required: true, 
        customValidation: () => (creditVal > 0 && debitVal > 0) 
          ? 'Cannot enter both Credit and Debit' 
          : (creditVal > 0 || debitVal > 0) 
            ? null 
            : 'Please enter either Credit or Debit amount greater than 0'
      }
    ];

    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;

    setSaving(true);
    const staffName = user?.username || 'Staff';
    const selectedAccName = accounts.find(a => a.id === headOfAccount)?.account_name || headOfAccount;

    try {
      const regBookId = await supabaseFinance.getLegacyBookId('REGULAR');
      const itrBookId = await supabaseFinance.getLegacyBookId('ITR');
      const bookId = financeMode === 'ITR' ? itrBookId : regBookId;

      const payload = {
        entry_date: entryDate,
        account_number: accountNumber.trim() || null,
        head_of_account: selectedAccName,
        particulars: particulars.trim(),
        credit: creditVal,
        debit: debitVal,
        created_by: staffName,
        status: 'PENDING',
        book_id: bookId
      };

      let result;
      if (editId) {
        result = await supabaseFinance.updateCashbookEntry(editId, payload, staffName);
      } else {
        result = await supabaseFinance.createCashbookEntry(payload, true);
      }

      if (result) {
        toast.success(editId ? 'Entry updated successfully' : 'Entry saved successfully');
        handleReset(false);
        // Refresh data immediately without page reload
        setRefreshCounter(prev => prev + 1);

        // Keep operator ready for next entry in under 10s
        if (particularsRef.current) {
          particularsRef.current.focus();
        }
      } else {
        toast.error('Failed to save Day Book entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred while saving entry');
    } finally {
      setSaving(false);
    }
  };

  // Edit action
  const handleEditClick = (entry: FinanceCashbookEntry) => {
    setEditId(entry.id);
    setEntryDate(entry.entry_date.split('T')[0]);
    setAccountNumber(entry.account_number || '');
    setParticulars(entry.particulars);
    setCredit(entry.credit > 0 ? String(entry.credit) : '');
    setDebit(entry.debit > 0 ? String(entry.debit) : '');
    setErrors({});

    // Resolve head of account name back to ID if possible
    const match = accounts.find(a => a.account_name === entry.head_of_account);
    if (match) {
      setHeadOfAccount(match.id);
    } else {
      setHeadOfAccount(entry.head_of_account);
    }

    if (particularsRef.current) particularsRef.current.focus();
  };

  // Delete Action
  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this Day Book entry?')) return;

    try {
      const staffName = user?.username || 'Staff';
      await supabaseFinance.deleteCashbookEntry(id, staffName);
      toast.success('Entry deleted successfully');
      setRefreshCounter(prev => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete entry');
    }
  };

  // Approve Action
  const handleApproveClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to approve this Day Book Entry?')) return;

    try {
      const staffName = user?.username || 'Staff';
      const result = await supabaseFinance.approveCashbookEntry(id, staffName);
      if (result) {
        toast.success('Day Book Entry approved successfully');
        setRefreshCounter(prev => prev + 1);
      } else {
        toast.error('Failed to approve entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error approving entry');
    }
  };

  // Add New Account Modal Submit
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fields: ValidationField[] = [
      { name: 'newAccountName', label: 'Account Name', value: newAccountName, required: true, ref: newAccountNameRef }
    ];

    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;

    const normalizedNewName = newAccountName.trim().toUpperCase().replace(/\s+/g, ' ');
    const isDuplicate = accounts.some(acc => acc.account_name.trim().toUpperCase().replace(/\s+/g, ' ') === normalizedNewName);
    if (isDuplicate) {
      toast.error('An account with this name already exists.');
      return;
    }

    if (!newAccountCategory) {
      toast.error('Please select a Category.');
      return;
    }

    setSavingAccount(true);
    try {
      const payload = {
        account_name: newAccountName.trim(),
        account_number: null,
        report_classification: newAccountCategory as 'BALANCE_SHEET' | 'PROFIT_AND_LOSS',
        report_section: newAccountCategory as 'BALANCE_SHEET' | 'PROFIT_AND_LOSS',
        category: newAccountCategory
      };

      const result = await supabaseFinance.createCashbookAccount(payload);
      if (result) {
        toast.success(`Account "${newAccountName.trim()}" created`);
        setNewAccountName('');
        setNewAccountCategory('');
        setShowAccountModal(false);

        const fetchedAccounts = await supabaseFinance.getCashbookAccounts();
        setAccounts(fetchedAccounts);

        setHeadOfAccount(result.id);
        setAccountNumber('');
      } else {
        toast.error('Failed to create account. Name might already exist.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred while creating account');
    } finally {
      setSavingAccount(false);
    }
  };

  // Edit/Classify existing account submit
  const handleEditAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccId) return;

    if (!editAccountCategory) {
      toast.error('Please select a Category.');
      return;
    }

    setSavingAccount(true);
    try {
      const payload = {
        account_name: editAccountName.trim(),
        account_number: null,
        report_classification: editAccountCategory as 'BALANCE_SHEET' | 'PROFIT_AND_LOSS',
        report_section: editAccountCategory as 'BALANCE_SHEET' | 'PROFIT_AND_LOSS',
        category: editAccountCategory
      };

      const result = await supabaseFinance.updateCashbookAccount(editingAccId, payload);
      if (result.success) {
        toast.success(`Account "${editAccountName.trim()}" updated`);
        setEditingAccId(null);
        setEditAccountName('');
        setEditAccountCategory('');
        const fetchedAccounts = await supabaseFinance.getCashbookAccounts();
        setAccounts(fetchedAccounts);
      } else {
        toast.error(result.error || 'Failed to update account details');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred while updating account');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (account: FinanceCashbookAccount) => {
    if (!window.confirm(`Are you sure you want to delete the Head of Account: "${account.account_name}"?`)) {
      return;
    }

    try {
      const result = await supabaseFinance.deleteCashbookAccount(account.id);
      if (result.success) {
        toast.success(`Head of Account "${account.account_name}" deleted successfully.`);
        const fetchedAccounts = await supabaseFinance.getCashbookAccounts();
        setAccounts(fetchedAccounts);
        if (headOfAccount === account.id) {
          setHeadOfAccount('');
          setAccountNumber('');
        }
      } else {
        toast.error(result.error || 'Failed to delete account');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred while deleting Head of Account');
    }
  };

  // Sorting and Filtering logic
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Filter search query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(e => {
        const headStr = (e.head_of_account || '').toLowerCase();
        const partStr = (e.particulars || '').toLowerCase();
        const dateStr = (e.entry_date || '');
        const formattedDate = dateStr.split('-').reverse().join('/');
        const accNumStr = (e.account_number || '').toLowerCase();
        const creditStr = String(e.credit || '');
        const debitStr = String(e.debit || '');

        return (
          headStr.includes(query) ||
          partStr.includes(query) ||
          dateStr.includes(query) ||
          formattedDate.includes(query) ||
          accNumStr.includes(query) ||
          creditStr.includes(query) ||
          debitStr.includes(query)
        );
      });
    }

    // Filter status
    if (statusFilter !== 'ALL') {
      result = result.filter(e => (e.status || 'PENDING') === statusFilter);
    }

    // Filter Head of Account
    if (headFilter !== 'ALL') {
      result = result.filter(e => e.head_of_account === headFilter || e.head_of_account === accounts.find(a => a.id === headFilter)?.account_name);
    }

    // Filter Date
    if (dateFilter) {
      result = result.filter(e => e.entry_date.split('T')[0] === dateFilter);
    }

    // Sort order
    result.sort((a, b) => {
      const timeA = new Date(a.entry_date).getTime();
      const timeB = new Date(b.entry_date).getTime();
      if (sortOrder === 'asc') {
        return timeA - timeB;
      }
      return timeB - timeA;
    });

    return result;
  }, [entries, searchQuery, statusFilter, headFilter, dateFilter, sortOrder, accounts]);

  // Compute running balance for displayed entries
  const runningBalancesMap = useMemo(() => {
    const map = new Map<string, number>();
    // Sort entries chronologically (oldest first) to accumulate running balance
    const sortedAsc = [...filteredEntries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    let cumulative = 0;
    sortedAsc.forEach(e => {
      cumulative += (Number(e.credit) || 0) - (Number(e.debit) || 0);
      map.set(e.id, cumulative);
    });
    return map;
  }, [filteredEntries]);

  // Summaries calculation
  const summaries = useMemo(() => {
    let totalCredits = 0;
    let totalDebits = 0;

    filteredEntries.forEach(e => {
      totalCredits += Number(e.credit) || 0;
      totalDebits += Number(e.debit) || 0;
    });

    const todayIso = getLocalBusinessDateISO();
    const todayEntriesCount = entries.filter(e => e.entry_date.split('T')[0] === todayIso).length;

    // Latest entry timestamp
    let lastEntryFormatted = '—';
    if (entries.length > 0) {
      const sortedByTime = [...entries].sort((a, b) => {
        const tA = new Date(a.created_at || a.entry_date).getTime();
        const tB = new Date(b.created_at || b.entry_date).getTime();
        return tB - tA;
      });
      const latest = sortedByTime[0];
      if (latest && latest.created_at) {
        const d = new Date(latest.created_at);
        lastEntryFormatted = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase();
      } else if (latest) {
        lastEntryFormatted = latest.entry_date.split('T')[0];
      }
    }

    return {
      totalCredits,
      totalDebits,
      net: totalCredits - totalDebits,
      todayEntriesCount,
      lastEntryTime: lastEntryFormatted
    };
  }, [filteredEntries, entries]);

  return (
    <>
      <div className="w-full p-4 space-y-3 select-none bg-slate-50/50 min-h-screen">
        
        {/* Top Header Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col justify-center">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <span>DASHBOARD</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 font-bold">DAY BOOK ENTRY</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2 leading-none">
              <BookOpen className="w-6 h-6 text-slate-700" />
              DAY BOOK ENTRY
            </h1>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => navigate('/finance')}
              className="inline-flex items-center justify-center h-9 px-4 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-xs font-bold uppercase shadow-sm cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              BACK
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center justify-center h-9 px-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-xs font-bold uppercase shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              PRINT
            </button>
          </div>
        </div>

        {/* 1. ENTRY FORM CARD (Single Horizontal Card) */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${editId ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              {editId ? 'EDIT DAY BOOK ENTRY' : 'NEW DAY BOOK ENTRY'}
            </span>
            {editId && (
              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded uppercase">
                Editing Mode Active
              </span>
            )}
          </div>

          <form onSubmit={handleSaveEntry} className="flex flex-col gap-4">
            
            {/* ROW 1: 4-Column Grid for Primary Fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              
              {/* Date */}
              <div className="w-full">
                <FinanceSmartCalendar
                  value={entryDate}
                  onChange={(val) => { setEntryDate(val); setErrors(p => ({...p, entryDate: false})); }}
                  eventProvider={customEventProvider}
                  refreshTrigger={refreshCounter}
                  label="DATE"
                  required
                  error={errors.entryDate}
                  compact={true}
                />
              </div>

              {/* Head of A/C + Inline Action Buttons */}
              <div className="w-full">
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">
                  HEAD OF A/C <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <select
                      value={headOfAccount}
                      onChange={(e) => { handleAccountChange(e.target.value); setErrors(p => ({...p, headOfAccount: false})); }}
                      ref={headOfAccountRef}
                      required
                      className={`w-full bg-white border rounded-lg pl-3 pr-8 h-[42px] text-xs font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm truncate appearance-none cursor-pointer ${
                        errors.headOfAccount ? 'border-red-500 bg-red-50' : 'border-slate-200'
                      }`}
                    >
                      <option value="">SELECT HEAD...</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAccountModal(true)}
                    title="Create New Account Head"
                    className="h-[42px] px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 text-[11px] font-bold uppercase transition-colors shrink-0 flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>NEW</span>
                  </button>
                </div>
              </div>

              {/* Credit */}
              <div className="w-full">
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">
                  CREDIT (IN CR)
                </label>
                <input
                  type="number"
                  ref={creditRef}
                  value={credit}
                  onChange={(e) => { handleCreditChange(e.target.value); setErrors(p => ({...p, credit: false})); }}
                  placeholder="0.00"
                  disabled={debit !== ''}
                  className={`w-full bg-white border rounded-lg px-3 h-[42px] text-sm font-mono font-bold text-emerald-700 text-right focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-sm placeholder:text-slate-300 placeholder:font-medium ${
                    debit !== '' ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'border-slate-200'
                  }`}
                />
              </div>

              {/* Debit */}
              <div className="w-full">
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">
                  DEBIT (IN DR)
                </label>
                <input
                  type="number"
                  ref={debitRef}
                  value={debit}
                  onChange={(e) => { handleDebitChange(e.target.value); setErrors(p => ({...p, debit: false})); }}
                  placeholder="0.00"
                  disabled={credit !== ''}
                  className={`w-full bg-white border rounded-lg px-3 h-[42px] text-sm font-mono font-bold text-rose-700 text-right focus:outline-none focus:ring-2 focus:ring-rose-600 shadow-sm placeholder:text-slate-300 placeholder:font-medium ${
                    credit !== '' ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'border-slate-200'
                  }`}
                />
              </div>
            </div>

            {/* ROW 2: Particulars & Buttons */}
            <div className="flex flex-col md:flex-row items-end gap-4 w-full">
              
              {/* Particulars */}
              <div className="flex-1 w-full">
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">
                  PARTICULARS <span className="text-red-500">*</span>
                </label>
                <textarea
                  ref={particularsRef as any}
                  value={particulars}
                  onChange={(e) => { setParticulars(e.target.value); setErrors(p => ({...p, particulars: false})); }}
                  placeholder="ENTER TRANSACTION PARTICULARS OR REMARKS..."
                  required
                  className={`w-full bg-white border rounded-lg px-3 py-3 h-[48px] text-xs font-bold text-slate-900 uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm resize-none ${
                    errors.particulars ? 'border-red-500 bg-red-50' : 'border-slate-200'
                  }`}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleReset(true)}
                  className="h-[48px] px-5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-xs font-bold uppercase shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  {editId ? 'CANCEL' : 'CLEAR'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-[48px] px-6 bg-slate-900 text-white border border-slate-900 rounded-lg hover:bg-slate-800 transition-colors text-xs font-bold uppercase shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'SAVING...' : editId ? 'UPDATE' : 'SAVE ENTRY'}
                </button>
              </div>

            </div>
          </form>
        </div>

        {/* 2. SUMMARY CARDS (5 Equal Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Total Credits */}
          <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm flex flex-col justify-between h-[80px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Total Credits</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black font-mono text-emerald-700 tracking-tight leading-tight">
              ₹ {summaries.totalCredits.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Card 2: Total Debits */}
          <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm flex flex-col justify-between h-[80px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Total Debits</span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black font-mono text-rose-700 tracking-tight leading-tight">
              ₹ {summaries.totalDebits.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Card 3: Net Balance */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between h-[80px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Net Balance</span>
              <Scale className="w-4 h-4 text-slate-400" />
            </div>
            <div className={`text-xl font-black font-mono tracking-tight leading-tight ${summaries.net >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
              ₹ {summaries.net.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Card 4: Today's Entries */}
          <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-sm flex flex-col justify-between h-[80px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Today's Entries</span>
              <Calendar className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-black font-mono text-indigo-900 tracking-tight leading-tight">
              {summaries.todayEntriesCount} <span className="text-xs font-bold text-indigo-600">ENTRIES</span>
            </div>
          </div>

          {/* Card 5: Last Entry Time */}
          <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm flex flex-col justify-between h-[80px] col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Last Entry Time</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-base font-black font-mono text-amber-900 tracking-tight leading-tight truncate">
              {summaries.lastEntryTime}
            </div>
          </div>

        </div>

        {/* 3. FILTER BAR (Single Compact Row Above Table) */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Left Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 w-full">
            
            {/* Search */}
            <div className="relative flex-1 w-full min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH PARTICULARS, HEAD, VOUCHER..."
                className="w-full h-[36px] pl-9 pr-3 border border-slate-200 rounded-lg text-xs font-bold uppercase text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-[36px] w-full sm:w-[140px] shrink-0 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm cursor-pointer"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
            </select>

            {/* Head Filter */}
            <select
              value={headFilter}
              onChange={(e) => setHeadFilter(e.target.value)}
              className="h-[36px] w-full sm:w-[160px] shrink-0 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm cursor-pointer truncate"
            >
              <option value="ALL">ALL HEADS</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name.toUpperCase()}
                </option>
              ))}
            </select>

            {/* Date Filter */}
            <div className="w-full sm:w-[160px] shrink-0">
              <FinanceSmartCalendar
                value={dateFilter}
                onChange={(val) => setDateFilter(val)}
                onMonthChange={(y, m) => { setFilterYear(y); setFilterMonth(m); }}
                eventProvider={customEventProvider}
                refreshTrigger={refreshCounter}
                placeholder="FILTER DATE"
                allowClear
                compact={true}
              />
            </div>

          </div>

          {/* Right Controls (Sort & Refresh) */}
          <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="h-[36px] flex-1 md:flex-none bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold uppercase text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm cursor-pointer"
            >
              <option value="desc">NEWEST FIRST</option>
              <option value="asc">OLDEST FIRST</option>
            </select>

            <button
              onClick={fetchData}
              title="Refresh Entries"
              className="h-[36px] px-4 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold uppercase shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>REFRESH</span>
            </button>
          </div>

        </div>

        {/* 4. RECENT ENTRIES TABLE (Full Width) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full">
          <div className="px-3.5 py-2.5 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                RECENT TRANSACTION ENTRIES
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-200/60 px-2 py-0.5 rounded-full">
                {filteredEntries.length} OF {entries.length} RECORDS
              </span>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4 w-[100px]">DATE</th>
                  <th className="py-3 px-4 w-[100px]">VOUCHER</th>
                  <th className="py-3 px-4 w-[160px]">HEAD OF A/C</th>
                  <th className="py-3 px-4 min-w-[220px]">PARTICULARS</th>
                  <th className="py-3 px-4 text-right w-[120px]">CREDIT</th>
                  <th className="py-3 px-4 text-right w-[120px]">DEBIT</th>
                  <th className="py-3 px-4 text-right w-[130px]">BALANCE</th>
                  <th className="py-3 px-4 w-[110px]">OPERATOR</th>
                  <th className="py-3 px-4 text-center w-[100px]">STATUS</th>
                  <th className="py-3 px-4 text-right w-[110px]">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-slate-900"></div>
                        <span className="text-xs font-bold uppercase tracking-wider">Loading Day Book entries...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <Info className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-black uppercase text-slate-800 tracking-wider">No Transaction Entries Found</span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase">
                          Enter a transaction above or adjust filters to view data.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((e) => {
                    const runningBal = runningBalancesMap.get(e.id) || 0;
                    const voucherNo = `#DB-${(entries.length - entries.findIndex(item => item.id === e.id)).toString().padStart(3, '0')}`;
                    return (
                      <tr 
                        key={e.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${editId === e.id ? 'bg-amber-50/50' : ''}`}
                      >
                        {/* Date */}
                        <td className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap">
                          {e.entry_date.split('T')[0].split('-').reverse().join('/')}
                        </td>

                        {/* Voucher */}
                        <td className="py-2 px-3 font-mono font-bold text-slate-500 whitespace-nowrap text-[11px]">
                          {voucherNo}
                        </td>

                        {/* Head */}
                        <td className="py-2 px-3 text-slate-900 font-bold uppercase truncate max-w-[150px]">
                          {e.head_of_account}
                        </td>

                        {/* Particulars */}
                        <td className="py-2 px-3 text-slate-800 font-medium break-words max-w-[320px] uppercase">
                          {e.particulars}
                        </td>

                        {/* Credit */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                          {e.credit > 0 ? `₹ ${e.credit.toLocaleString('en-IN')}` : '—'}
                        </td>

                        {/* Debit */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                          {e.debit > 0 ? `₹ ${e.debit.toLocaleString('en-IN')}` : '—'}
                        </td>

                        {/* Balance */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          ₹ {runningBal.toLocaleString('en-IN')}
                        </td>

                        {/* Operator */}
                        <td className="py-2 px-3 text-slate-600 font-medium uppercase truncate max-w-[90px]">
                          {e.created_by || 'Staff'}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
                            (e.status || 'PENDING') === 'APPROVED' 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {e.status || 'PENDING'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            {user?.is_admin && (e.status || 'PENDING') !== 'APPROVED' && (
                              <button
                                onClick={() => handleApproveClick(e.id)}
                                title="Approve Entry"
                                className="p-1 text-green-700 bg-green-50 hover:bg-green-100 rounded border border-green-200 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditClick(e)}
                              title="Edit Entry"
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(e.id)}
                              title="Delete Entry"
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-slate-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL: Add New Account Popup */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-slate-900 font-black text-xs uppercase tracking-wider">CREATE NEW ACCOUNT</h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccountSubmit} className="p-5 space-y-3">
              <Input
                label="ACCOUNT NAME"
                ref={newAccountNameRef} 
                error={errors.newAccountName} 
                value={newAccountName} 
                onChange={(val) => { setNewAccountName(val); setErrors(p => ({...p, newAccountName: false})); }}
                placeholder="e.g. RENT, SALARY, OFFICE EXPENSE"
                required
              />

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">CATEGORY *</label>
                <select
                  value={newAccountCategory}
                  onChange={(e) => setNewAccountCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-xs font-bold text-slate-900 uppercase focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-xs"
                  required
                >
                  <option value="">SELECT CATEGORY</option>
                  <option value="BALANCE_SHEET">BALANCE SHEET</option>
                  <option value="PROFIT_AND_LOSS">PROFIT &amp; LOSS</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold uppercase shadow-xs cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 text-xs font-bold uppercase shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingAccount ? 'SAVING...' : 'CREATE ACCOUNT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manage Head of Accounts Directory */}
      {showDirectoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-2xl w-full overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-slate-900 font-black text-xs uppercase tracking-wider">HEAD OF ACCOUNTS DIRECTORY</h3>
              <button
                onClick={() => { setShowDirectoryModal(false); setEditingAccId(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <input
                type="text"
                value={directorySearchQuery}
                onChange={(e) => setDirectorySearchQuery(e.target.value)}
                placeholder="Search accounts by name..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 h-9 text-xs font-bold uppercase text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-xs"
              />

              {editingAccId && (
                <form onSubmit={handleEditAccountSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                  <h4 className="text-xs font-black text-slate-900 uppercase">Edit Account</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <Input
                      label="ACCOUNT NAME"
                      value={editAccountName}
                      onChange={setEditAccountName}
                      required
                      uppercase
                    />
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">CATEGORY *</label>
                      <select
                        value={editAccountCategory}
                        onChange={(e) => setEditAccountCategory(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-xs font-bold text-slate-900 uppercase focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-xs"
                        required
                      >
                        <option value="">SELECT CATEGORY</option>
                        <option value="BALANCE_SHEET">BALANCE SHEET</option>
                        <option value="PROFIT_AND_LOSS">PROFIT &amp; LOSS</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditingAccId(null)}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingAccount}
                      className="px-4 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                    >
                      {savingAccount ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-y-auto max-h-[40vh] border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-black">
                      <th className="px-3.5 py-2">Account Name</th>
                      <th className="px-3.5 py-2">Report Category</th>
                      <th className="px-3.5 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-medium text-slate-800">
                    {accounts
                      .filter(acc => acc.account_name.toLowerCase().includes(directorySearchQuery.toLowerCase()))
                      .map(acc => (
                        <tr key={acc.id} className="hover:bg-slate-50">
                          <td className="px-3.5 py-2 font-bold uppercase">{acc.account_name}</td>
                          <td className="px-3.5 py-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                              {acc.report_classification === 'BALANCE_SHEET' ? 'BALANCE SHEET' : 'PROFIT & LOSS'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-right flex gap-3 justify-end items-center">
                            <button
                              onClick={() => {
                                setEditingAccId(acc.id);
                                setEditAccountName(acc.account_name);
                                setEditAccountCategory(acc.report_classification || 'PROFIT_AND_LOSS');
                              }}
                              className="text-blue-600 hover:text-blue-800 font-bold uppercase cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc)}
                              className="text-red-600 hover:text-red-800 font-bold uppercase cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-2.5 bg-slate-50 border-t flex justify-end">
              <button
                onClick={() => { setShowDirectoryModal(false); setEditingAccId(null); }}
                className="px-3.5 py-1.5 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 text-xs font-bold uppercase cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Print Preview Panel */}
      <FinancePrintPreview
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Print Preview (Cash Day-Book)"
        documentTitle="CASH DAY-BOOK STATEMENT"
      >
        <div className="font-sans text-xs">
          <div className="grid grid-cols-2 gap-4 py-3 text-xs uppercase font-bold text-slate-700">
            <div>
              <span className="text-slate-500">FILTER QUERY:</span> {searchQuery.toUpperCase() || 'ALL RECORDS'}
            </div>
            <div className="text-right">
              <span className="text-slate-500">TOTAL ENTRIES:</span> {filteredEntries.length}
            </div>
          </div>

          <table className="min-w-full divide-y-2 divide-slate-900 border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800 uppercase font-black">
                <th className="border border-slate-900 px-2 py-1.5 text-left">Date</th>
                <th className="border border-slate-900 px-2 py-1.5 text-left">Head of A/C</th>
                <th className="border border-slate-900 px-2 py-1.5 text-left">Acc No</th>
                <th className="border border-slate-900 px-2 py-1.5 text-left">Particulars</th>
                <th className="border border-slate-900 px-2 py-1.5 text-right">Credit (Cr)</th>
                <th className="border border-slate-900 px-2 py-1.5 text-right">Debit (Dr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-slate-400 uppercase">
                    No transactions recorded.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(e => (
                  <tr key={e.id} className="text-slate-900 font-medium">
                    <td className="border border-slate-900 px-2 py-1.5 whitespace-nowrap">
                      {e.entry_date.split('T')[0].split('-').reverse().join('/')}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 uppercase font-bold">
                      {e.head_of_account.toUpperCase()}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 font-mono">
                      {e.account_number || '—'}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 max-w-[250px] break-words uppercase">
                      {e.particulars.toUpperCase()}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">
                      {e.credit > 0 ? `₹ ${e.credit.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">
                      {e.debit > 0 ? `₹ ${e.debit.toLocaleString('en-IN')}` : '—'}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold">
                <td colSpan={4} className="border border-slate-900 px-2 py-1.5 text-right">TOTAL CASH FLOW:</td>
                <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">₹ {summaries.totalCredits.toLocaleString('en-IN')}</td>
                <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">₹ {summaries.totalDebits.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="bg-slate-200 font-black">
                <td colSpan={4} className="border border-slate-900 px-2 py-1.5 text-right">NET BALANCE:</td>
                <td colSpan={2} className="border border-slate-900 px-2 py-1.5 text-center font-mono text-sm">
                  ₹ {summaries.net.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between items-center mt-16 pt-6 border-t border-slate-300 uppercase font-bold text-xs">
            <div>
              <p>CASHIER SIGNATURE</p>
              <p className="text-slate-400 mt-6 text-[10px]">AUTHORIZED SIGNATORY</p>
            </div>
            <div className="text-right">
              <p>VERIFIED BY MANAGER</p>
              <p className="text-slate-400 mt-6 text-[10px]">PARTNER AUDIT SIGN</p>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </>
  );
};

export default CashBook;
