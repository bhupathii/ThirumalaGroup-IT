import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
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
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import FinancePrintPreview from '../../components/Finance/FinancePrintPreview';

const CashBook: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Database Data States
  const [accounts, setAccounts] = useState<FinanceCashbookAccount[]>([]);
  const [entries, setEntries] = useState<FinanceCashbookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [accountNumber, setAccountNumber] = useState('');
  const [headOfAccount, setHeadOfAccount] = useState('');
  const [particulars, setParticulars] = useState('');
  const [credit, setCredit] = useState('');
  const [debit, setDebit] = useState('');
  const [saving, setSaving] = useState(false);

  // Search & Sorting States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Modal / Dialog Popups States
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Print Preview Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fetchedAccounts = await supabaseFinance.getCashbookAccounts();
      const fetchedEntries = await supabaseFinance.getCashbookEntries();
      setAccounts(fetchedAccounts);
      setEntries(fetchedEntries);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load Cash Book data');
    } finally {
      setLoading(false);
    }
  };

  // Mutually Exclusive Credit / Debit behavior:
  // Typing in Credit sets Debit to empty and vice versa
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
    if (confirm && !window.confirm('Clear all form fields?')) return;
    setEntryDate(new Date().toISOString().split('T')[0]);
    setHeadOfAccount('');
    setAccountNumber('');
    setParticulars('');
    setCredit('');
    setDebit('');
    setEditId(null);
  };

  // Save Entry (Create / Update)
  const handleSaveEntry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!entryDate) {
      toast.error('Date is required');
      return;
    }
    if (!headOfAccount) {
      toast.error('Head of A/C is required');
      return;
    }
    if (!particulars.trim()) {
      toast.error('Particulars is required');
      return;
    }

    const creditVal = Number(credit) || 0;
    const debitVal = Number(debit) || 0;

    if (creditVal === 0 && debitVal === 0) {
      toast.error('Please enter either Credit or Debit amount greater than 0');
      return;
    }

    setSaving(true);
    const staffName = user?.username || 'Staff';
    const selectedAccName = accounts.find(a => a.id === headOfAccount)?.account_name || headOfAccount;

    const payload = {
      entry_date: entryDate,
      account_number: accountNumber.trim() || null,
      head_of_account: selectedAccName,
      particulars: particulars.trim(),
      credit: creditVal,
      debit: debitVal,
      created_by: staffName
    };

    try {
      let result;
      if (editId) {
        result = await supabaseFinance.updateCashbookEntry(editId, payload, staffName);
      } else {
        result = await supabaseFinance.createCashbookEntry(payload);
      }

      if (result) {
        toast.success(editId ? 'Entry updated successfully' : 'Entry saved successfully');
        handleReset(false);
        // Refresh data
        const fetchedEntries = await supabaseFinance.getCashbookEntries();
        setEntries(fetchedEntries);
      } else {
        toast.error('Failed to save cash book entry');
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
    setEntryDate(entry.entry_date);
    setAccountNumber(entry.account_number || '');
    setParticulars(entry.particulars);
    setCredit(entry.credit > 0 ? String(entry.credit) : '');
    setDebit(entry.debit > 0 ? String(entry.debit) : '');

    // Resolve head of account name back to ID if possible
    const match = accounts.find(a => a.account_name === entry.head_of_account);
    if (match) {
      setHeadOfAccount(match.id);
    } else {
      setHeadOfAccount(entry.head_of_account);
    }
    
    // Smooth scroll to form on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete Action
  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this cash book entry?')) return;
    const staffName = user?.username || 'Staff';
    try {
      const success = await supabaseFinance.deleteCashbookEntry(id, staffName);
      if (success) {
        toast.success('Entry deleted');
        const fetchedEntries = await supabaseFinance.getCashbookEntries();
        setEntries(fetchedEntries);
      } else {
        toast.error('Failed to delete entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred while deleting');
    }
  };

  // Delete All Action (authorized check)
  const handleDeleteAll = async () => {
    if (!user?.is_admin) {
      toast.error('Access Denied: Only authorized administrators can clear the Cash Book');
      return;
    }

    if (!window.confirm('⚠️ WARNING: This will permanently DELETE ALL entries from the Cash Book. This action is irreversible. Are you sure you want to proceed?')) {
      return;
    }
    
    const doubleCheck = window.prompt('To confirm deletion, type "DELETE ALL" in the box below:');
    if (doubleCheck !== 'DELETE ALL') {
      toast.error('Confirmation mismatch. Operation cancelled.');
      return;
    }

    const deleteToastId = toast.loading('Clearing all cash book entries...');
    const staffName = user?.username || 'Staff';
    try {
      const success = await supabaseFinance.deleteAllCashbookEntries(staffName);
      if (success) {
        toast.success('All cash book entries deleted successfully', { id: deleteToastId });
        fetchData();
      } else {
        toast.error('Failed to delete entries', { id: deleteToastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred while clearing Cash Book', { id: deleteToastId });
    }
  };

  // Add New Account Modal Submit
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      toast.error('Account Name is required');
      return;
    }

    setSavingAccount(true);
    try {
      const payload = {
        account_name: newAccountName.trim(),
        account_number: newAccountNumber.trim() || null
      };

      const result = await supabaseFinance.createCashbookAccount(payload);
      if (result) {
        toast.success(`Account "${newAccountName.trim()}" created`);
        setNewAccountName('');
        setNewAccountNumber('');
        setShowAccountModal(false);

        // Fetch updated accounts list
        const fetchedAccounts = await supabaseFinance.getCashbookAccounts();
        setAccounts(fetchedAccounts);

        // Pre-select the newly created account
        setHeadOfAccount(result.id);
        setAccountNumber(result.account_number || '');
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
        // format dd/MM/yyyy date string for search
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
  }, [entries, searchQuery, sortOrder]);

  // Summaries calculation (based on filtered list)
  const summaries = useMemo(() => {
    let totalCredits = 0;
    let totalDebits = 0;

    filteredEntries.forEach(e => {
      totalCredits += Number(e.credit) || 0;
      totalDebits += Number(e.debit) || 0;
    });

    return {
      totalCredits,
      totalDebits,
      net: totalCredits - totalDebits
    };
  }, [filteredEntries]);


  return (
    <>
    <div className={`space-y-6 p-6 max-w-7xl mx-auto select-none ${showPrintModal ? 'print:hidden' : ''}`}>
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <span>DASHBOARD</span>
            <span>/</span>
            <span className="text-slate-600">CASH BOOK</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">CASH BOOK</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
            DAY-BOOK ENTRIES · CREDIT / DEBIT POSTED TO GENERAL LEDGER
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={handleDeleteAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-red-600 text-white border border-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            DELETE ALL ENTRIES
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            PRINT
          </button>
        </div>
      </div>

      {/* Main Grid: Form on Left (5 cols) & Content on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-5 space-y-6">
          <Card
            title={
              <span className="text-xs font-black text-slate-900 tracking-wider uppercase">
                {editId ? 'EDIT ENTRY' : 'NEW ENTRY'}
              </span>
            }
            subtitle={
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                Every field except account number is required
              </span>
            }
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <form onSubmit={handleSaveEntry} className="space-y-4">
              
              {/* Date & Account Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="DATE"
                  type="date"
                  value={entryDate}
                  onChange={setEntryDate}
                  required
                  style={{ fontFamily: 'inherit' }}
                />
                <Input
                  label="ACCOUNT NUMBER"
                  value={accountNumber}
                  onChange={setAccountNumber}
                  placeholder="OPTIONAL"
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

              {/* Head of Account Select Dropdown */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  HEAD OF A/C <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={headOfAccount}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-850 focus:ring-1 focus:ring-slate-955 focus:outline-none h-10 shadow-sm"
                >
                  <option value="">SELECT...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name.toUpperCase()} {acc.account_number ? `(${acc.account_number})` : ''}
                    </option>
                  ))}
                </select>
                
                {/* + New Account trigger */}
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                >
                  <Plus className="w-3 h-3" />
                  + New Account
                </button>
              </div>

              {/* Particulars */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  PARTICULARS <span className="text-red-500 ml-0.5">*</span>
                </label>
                <textarea
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  placeholder="Enter details of the transaction"
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-855 focus:ring-1 focus:ring-slate-950 focus:outline-none h-24 shadow-sm"
                />
              </div>

              {/* Credit & Debit Mutual Exclusion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="CREDIT (₹)"
                  type="number"
                  value={credit}
                  onChange={handleCreditChange}
                  placeholder="0"
                  disabled={debit !== ''}
                  style={{ fontFamily: 'inherit' }}
                />
                <Input
                  label="DEBIT (₹)"
                  type="number"
                  value={debit}
                  onChange={handleDebitChange}
                  placeholder="0"
                  disabled={credit !== ''}
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'SAVING...' : editId ? 'UPDATE ENTRY' : 'SAVE ENTRY'}
                </button>
                <button
                  type="button"
                  onClick={() => handleReset(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {editId ? 'CANCEL' : 'RESET'}
                </button>
              </div>

            </form>
          </Card>
        </div>

        {/* Right Column: Summaries + Recent Entries list */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Summaries Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Total Credits */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-150">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">TOTAL CREDITS</span>
              <span className="text-xl font-bold text-emerald-700 block mt-1">
                ₹{summaries.totalCredits.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Total Debits */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-rose-150">
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">TOTAL DEBITS</span>
              <span className="text-xl font-bold text-rose-700 block mt-1">
                ₹{summaries.totalDebits.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Net Balance */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-250">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">NET</span>
              <span className={`text-xl font-bold block mt-1 ${summaries.net >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                ₹{summaries.net.toLocaleString('en-IN')}
              </span>
            </div>

          </div>

          {/* Recent Entries Card */}
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-slate-900 tracking-wider uppercase">
                  RECENT ENTRIES
                </span>
                
                {/* Sort Toggle */}
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] font-black text-slate-700 uppercase tracking-wider focus:outline-none shadow-sm cursor-pointer"
                >
                  <option value="desc">NEWEST FIRST</option>
                  <option value="asc">OLDEST FIRST</option>
                </select>
              </div>
            }
            subtitle={
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                Showing {filteredEntries.length} of {entries.length} records
              </span>
            }
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <div className="space-y-4">
              
              {/* Search Filter Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by head, particulars, date, account..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-950 shadow-sm"
                />
              </div>

              {/* Entries Table */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading cash book entries...</span>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl space-y-4 bg-slate-50/50">
                  <div className="p-3 bg-white rounded-full border border-slate-100 max-w-fit mx-auto shadow-sm">
                    <Info className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">NO ENTRIES</h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">
                      Post an entry from the form on the left.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-150 text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Head of A/C</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Acc No</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Particulars</th>
                        <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Credit</th>
                        <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Debit</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">By</th>
                        <th className="px-3 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredEntries.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50/20">
                          <td className="px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">
                            {e.entry_date.split('-').reverse().join('/')}
                          </td>
                          <td className="px-3 py-3 font-bold text-slate-900">
                            {e.head_of_account}
                          </td>
                          <td className="px-3 py-3 font-mono text-slate-600">
                            {e.account_number || '—'}
                          </td>
                          <td className="px-3 py-3 text-slate-700 max-w-[200px] break-words">
                            {e.particulars}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                            {e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-rose-600 whitespace-nowrap">
                            {e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-slate-500 font-semibold uppercase tracking-wide">
                            {e.created_by || 'Staff'}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleEditClick(e)}
                                title="Edit Entry"
                                className="p-1 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(e.id)}
                                title="Delete Entry"
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded border border-slate-200"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </Card>
        </div>

      </div>

      {/* MODAL: Add New Account Popup */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-lg border border-slate-150 max-w-md w-full overflow-hidden">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">CREATE NEW ACCOUNT</h3>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccountSubmit} className="p-6 space-y-4">
              <Input
                label="ACCOUNT NAME"
                value={newAccountName}
                onChange={setNewAccountName}
                placeholder="e.g. RENT, SALARY, OFFICE EXPENSE"
                required
                uppercase
                style={{ fontFamily: 'inherit' }}
              />
              <Input
                label="ACCOUNT NUMBER"
                value={newAccountNumber}
                onChange={setNewAccountNumber}
                placeholder="e.g. BANK ACC OR GENERAL LEDGER ID (OPTIONAL)"
                style={{ fontFamily: 'inherit' }}
              />

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingAccount ? 'SAVING...' : 'CREATE ACCOUNT'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: Print Preview Panel */}
    </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Print Preview (Cash Day-Book)"
        documentTitle="CASH DAY-BOOK STATEMENT"
      >
        <div className="font-sans text-xs">
          {/* Period details */}
          <div className="grid grid-cols-2 gap-4 py-4 text-xs font-bold uppercase tracking-wider">
            <div>
              <span className="text-slate-500">FILTER QUERY:</span> {searchQuery.toUpperCase() || 'ALL RECORDS'}
            </div>
            <div className="text-right">
              <span className="text-slate-500">TOTAL ENTRIES:</span> {filteredEntries.length}
            </div>
          </div>

          {/* Table */}
          <table className="min-w-full divide-y-2 divide-slate-900 text-xs border border-slate-900">
            <thead>
              <tr className="bg-slate-100 font-black uppercase text-slate-800">
                <th className="border border-slate-900 px-2 py-2 text-left">Date</th>
                <th className="border border-slate-900 px-2 py-2 text-left">Head of A/C</th>
                <th className="border border-slate-900 px-2 py-2 text-left">Acc No</th>
                <th className="border border-slate-900 px-2 py-2 text-left">Particulars</th>
                <th className="border border-slate-900 px-2 py-2 text-right">Credit (Cr)</th>
                <th className="border border-slate-900 px-2 py-2 text-right">Debit (Dr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-slate-400 font-bold uppercase">
                    No transactions recorded.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(e => (
                  <tr key={e.id} className="font-semibold text-slate-900">
                    <td className="border border-slate-900 px-2 py-2 whitespace-nowrap">
                      {e.entry_date.split('-').reverse().join('/')}
                    </td>
                    <td className="border border-slate-900 px-2 py-2 font-bold">
                      {e.head_of_account.toUpperCase()}
                    </td>
                    <td className="border border-slate-900 px-2 py-2 font-mono">
                      {e.account_number || '—'}
                    </td>
                    <td className="border border-slate-900 px-2 py-2 max-w-[250px] break-words">
                      {e.particulars.toUpperCase()}
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-bold">
                      {e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-bold">
                      {e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '—'}
                    </td>
                  </tr>
                ))
              )}
              {/* Totals Summary Row */}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                <td colSpan={4} className="border border-slate-900 px-2 py-2 text-right">TOTAL CASH FLOW:</td>
                <td className="border border-slate-900 px-2 py-2 text-right font-black">₹{summaries.totalCredits.toLocaleString('en-IN')}</td>
                <td className="border border-slate-900 px-2 py-2 text-right font-black">₹{summaries.totalDebits.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="bg-slate-200 font-bold">
                <td colSpan={4} className="border border-slate-900 px-2 py-2 text-right">NET BALANCE:</td>
                <td colSpan={2} className="border border-slate-900 px-2 py-2 text-center text-sm font-black">
                  ₹{summaries.net.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="flex justify-between items-center mt-20 pt-8 border-t border-slate-300 text-xs font-bold uppercase tracking-wider">
            <div>
              <p>CASHIER SIGNATURE</p>
              <p className="text-[10px] text-slate-400 mt-8">AUTHORIZED SIGNATORY</p>
            </div>
            <div className="text-right">
              <p>VERIFIED BY MANAGER</p>
              <p className="text-[10px] text-slate-400 mt-8">PARTNER AUDIT SIGN</p>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </>
  );
};

export default CashBook;
