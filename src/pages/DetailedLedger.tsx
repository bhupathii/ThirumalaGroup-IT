import React, { useState, useEffect, useRef, useMemo } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import SearchableSelect from '../components/UI/SearchableSelect';
import { supabaseDB } from '../lib/supabaseDatabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { TrendingUp, TrendingDown, Search, BarChart3, Plus, Database, RefreshCw, Calendar } from 'lucide-react';

interface DetailedLedgerFilters {
  fromDate: string;
  toDate: string;
  companyName: string;
  mainAccount: string;
  subAccount: string;
  staffwise: string;
  user: string;
  creditAmount: string; // keep as string for easy typing; parse on apply
  debitAmount: string;  // keep as string for easy typing; parse on apply
  betweenDates: boolean;
  paymentMode?: string;
}

interface LedgerEntry {
  id: string;
  sno: number;
  date: string;
  companyName: string;
  accountName: string;
  subAccount: string;
  particulars: string;
  credit: number;
  debit: number;
  saleQuantity: number;
  purchaseQuantity: number;
  staff: string;
  user: string;
  entryTime: string;
  approved: boolean;
  balance: number;
  runningBalance: number;
  payment_mode: string;
}

const DetailedLedger: React.FC = () => {
  const { user } = useAuth();

  const [filters, setFilters] = useState<DetailedLedgerFilters>({
    fromDate: '2016-10-31',
    toDate: format(new Date(), 'yyyy-MM-dd'),
    companyName: '',
    mainAccount: '',
    subAccount: '',
    staffwise: '',
    user: '',
    creditAmount: 0,
    debitAmount: 0,
    betweenDates: true,
  });

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination states
  const [pageSize] = useState(1000); // Show 1000 entries per page
  const [totalEntries, setTotalEntries] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, message: '' });

  // Re-load on dashboard-wide refresh events (emitted after New Entry save)
  useEffect(() => {
    const handler = () => {
      // Longer delay to ensure database has saved the entry
      setTimeout(() => {
        console.log('🔄 DetailedLedger: Refreshing after dashboard-refresh event');
        loadLedgerData();
      }, 500); // Increased delay to 500ms to ensure database save is complete
    };
    window.addEventListener('dashboard-refresh', handler);
    return () => window.removeEventListener('dashboard-refresh', handler);
  }, []);

  // Dropdown data
  const [companies, setCompanies] = useState<
    { value: string; label: string }[]
  >([]);
  const [accounts, setAccounts] = useState<{ value: string; label: string }[]>(
    []
  );
  const [subAccounts, setSubAccounts] = useState<
    { value: string; label: string }[]
  >([]);
  const [staffList, setStaffList] = useState<
    { value: string; label: string }[]
  >([]);
  const [userList, setUserList] = useState<
    { value: string; label: string }[]
  >([]);

  // Derived totals for top cards
  const totals = useMemo(() => {
    const totalCredit = filteredEntries.reduce((s, e) => s + (e.credit || 0), 0);
    const totalDebit = filteredEntries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalSaleQty = filteredEntries.reduce((s, e) => s + (e.saleQuantity || 0), 0);
    const totalPurchaseQty = filteredEntries.reduce((s, e) => s + (e.purchaseQuantity || 0), 0);
    return { totalCredit, totalDebit, balance: totalCredit - totalDebit, totalSaleQty, totalPurchaseQty };
  }, [filteredEntries]);

  // Local visible inputs for dd/MM/yyyy editing to prevent mm/dd flip
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');
  const fromPickerRef = useRef<HTMLInputElement>(null);
  const toPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setFromDateInput(filters.fromDate ? format(new Date(filters.fromDate), 'dd/MM/yyyy') : '');
      setToDateInput(filters.toDate ? format(new Date(filters.toDate), 'dd/MM/yyyy') : '');
    } catch {
      // ignore format errors
    }
  }, [filters.fromDate, filters.toDate]);

  // Summary data
  const [summary, setSummary] = useState({
    totalCredit: 0,
    totalDebit: 0,
    balance: 0,
    recordCount: 0,
    openingBalance: 0,
    closingBalance: 0,
  });

  useEffect(() => {
    loadDropdownData();
    loadLedgerData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [ledgerEntries, filters, searchTerm]);

  // Update staff and user lists from loaded entries to ensure dropdown values match actual data
  useEffect(() => {
    if (ledgerEntries.length > 0) {
      const distinctStaff = [...new Set(ledgerEntries.map(e => String(e.staff || '').trim()).filter(Boolean))].sort();
      const distinctUsers = [...new Set(ledgerEntries.map(e => String(e.user || '').trim()).filter(Boolean))].sort();
      
      const staffData = distinctStaff.map(staff => ({
        value: staff,
        label: staff,
      }));
      const userData = distinctUsers.map(user => ({
        value: user,
        label: user,
      }));
      
      // Update lists with actual values from entries
      setStaffList([{ value: '', label: 'All Staff' }, ...staffData]);
      setUserList([{ value: '', label: 'All Users' }, ...userData]);
    }
  }, [ledgerEntries]);

  // Filter accounts when company changes
  useEffect(() => {
    console.log('Company filter changed:', filters.companyName);
    if (filters.companyName) {
      console.log('Loading accounts for company:', filters.companyName);
      loadAccountsByCompany(filters.companyName);
      // Reset main account and sub account when company changes
      setFilters(prev => ({
        ...prev,
        mainAccount: '',
        subAccount: '',
      }));
    } else {
      console.log('No company selected - clearing accounts and sub-accounts');
      // If no company selected, clear accounts and sub-accounts
      setAccounts([{ value: '', label: 'Select a company first' }]);
      setSubAccounts([{ value: '', label: 'Select a company first' }]);
      // Reset main account and sub account when company is cleared
      setFilters(prev => ({
        ...prev,
        mainAccount: '',
        subAccount: '',
      }));
    }
  }, [filters.companyName]);

  // Filter sub accounts when main account changes
  useEffect(() => {
    if (filters.companyName && filters.mainAccount) {
      loadSubAccountsByAccount(filters.companyName, filters.mainAccount);
      // Reset sub account when main account changes
      setFilters(prev => ({
        ...prev,
        subAccount: '',
      }));
    } else if (filters.companyName) {
      // If company is selected but no main account, show all sub accounts for the company
      loadAllSubAccountsForCompany(filters.companyName);
    } else {
      // If no company selected, clear sub accounts
      setSubAccounts([{ value: '', label: 'Select a company first' }]);
    }
  }, [filters.companyName, filters.mainAccount]);

  const loadDropdownData = async () => {
    try {
      // Load companies
      const companies = await supabaseDB.getCompaniesWithData();
      const companiesData = companies.map(company => ({
        value: company.company_name,
        label: company.company_name,
      }));
      setCompanies([{ value: '', label: 'All Companies' }, ...companiesData]);

      // Initialize accounts and sub-accounts as empty - they will be loaded when company is selected
      setAccounts([{ value: '', label: 'Select a company first' }]);
      setSubAccounts([{ value: '', label: 'Select a company first' }]);

      // Load staff and users from actual cash_book entries
      try {
        // Get distinct staff and user values from cash_book
        const sampleEntries = await supabaseDB.getCashBookEntries(10000, 0); // Load sample to get distinct values
        const distinctStaff = [...new Set(sampleEntries.map(e => e.staff).filter(Boolean))].sort();
        const distinctUsers = [...new Set(sampleEntries.map(e => e.users || e.staff).filter(Boolean))].sort();
        
        const staffData = distinctStaff.map(staff => ({
          value: staff,
          label: staff,
        }));
        const userData = distinctUsers.map(user => ({
          value: user,
          label: user,
        }));
        
        setStaffList([{ value: '', label: 'All Staff' }, ...staffData]);
        setUserList([{ value: '', label: 'All Users' }, ...userData]);
      } catch (error) {
        console.error('Error loading staff/user from entries, falling back to users table:', error);
        // Fallback to users table if cash_book query fails
        const users = await supabaseDB.getUsers();
        const usersData = users
          .filter(u => u.is_active)
          .map(user => ({
            value: user.username,
            label: user.username,
          }));
        setStaffList([{ value: '', label: 'All Staff' }, ...usersData]);
        setUserList([{ value: '', label: 'All Users' }, ...usersData]);
      }
    } catch (error) {
      console.error('Error loading dropdown data:', error);
      toast.error('Failed to load dropdown data');
    }
  };

  // Debug function to check BVR/BVT company data
  const debugCompanyData = async () => {
    try {
      console.log('🔍 [DEBUG] Starting BVR/BVT company data debug...');
      await supabaseDB.debugCompanyAccountData();
      toast.success('Debug data logged to console. Check browser console for details.');
    } catch (error) {
      console.error('Error in debug:', error);
      toast.error('Debug failed. Check console for details.');
    }
  };

  const loadAllAccounts = async () => {
    try {
      // Use getDistinctAccountNames to get all account names from 67k cash_book records
      const allAccountNames = await supabaseDB.getDistinctAccountNames();
      const accountsData = allAccountNames.map((accountName: string) => ({
        value: accountName,
        label: accountName,
      }));
      setAccounts([{ value: '', label: 'All Accounts' }, ...accountsData]);
    } catch (error) {
      console.error('Error loading all accounts:', error);
      // Fallback to empty state
      setAccounts([{ value: '', label: 'Select a company first' }]);
    }
  };

  const loadAllSubAccounts = async () => {
    try {
      // Use getDistinctSubAccountNames to get all sub-account names from 67k cash_book records
      const allSubAccountNames = await supabaseDB.getDistinctSubAccountNames();
      const subAccountsData = allSubAccountNames.map((subAccountName: string) => ({
        value: subAccountName,
        label: subAccountName,
      }));
      setSubAccounts([
        { value: '', label: 'All Sub Accounts' },
        ...subAccountsData,
      ]);
    } catch (error) {
      console.error('Error loading all sub accounts:', error);
      // Fallback to empty state
      setSubAccounts([{ value: '', label: 'Select a company first' }]);
    }
  };

  const loadAccountsByCompany = async (companyName: string) => {
    try {
      console.log('🔍 [DetailedLedger] Fetching accounts for company:', companyName);
      const accounts = await supabaseDB.getDistinctAccountNamesByCompany(companyName);
      console.log('📊 [DetailedLedger] Fetched accounts:', accounts);
      console.log('📊 [DetailedLedger] Number of accounts found:', accounts.length);
      
      const accountsData = accounts.map((account: string) => ({
        value: account,
        label: account,
      }));
      
      console.log('📊 [DetailedLedger] Setting accounts dropdown with:', accountsData.length + 1, 'items');
      setAccounts([{ value: '', label: 'All Accounts' }, ...accountsData]);
    } catch (error) {
      console.error('Error loading accounts by company:', error);
      // Fallback to all accounts if there's an error
      await loadAllAccounts();
    }
  };

  const loadSubAccountsByAccount = async (
    companyName: string,
    accountName: string
  ) => {
    try {
      const subAccounts = await supabaseDB.getSubAccountsByAccountAndCompany(
        accountName,
        companyName
      );
      const subAccountsData = subAccounts.map((subAcc: string) => ({
        value: subAcc,
        label: subAcc,
      }));
      setSubAccounts([
        { value: '', label: 'All Sub Accounts' },
        ...subAccountsData,
      ]);
    } catch (error) {
      console.error('Error loading sub accounts by account:', error);
      // Fallback to all sub accounts for the company if there's an error
      await loadAllSubAccountsForCompany(companyName);
    }
  };

  const loadAllSubAccountsForCompany = async (companyName: string) => {
    try {
      // Use getDistinctSubAccountNamesByCompany to get all sub-account names for the company from 67k cash_book records
      const companySubAccountNames = await supabaseDB.getDistinctSubAccountNamesByCompany(companyName);
      const subAccountsData = companySubAccountNames.map((subAccountName: string) => ({
        value: subAccountName,
        label: subAccountName,
      }));
      setSubAccounts([
        { value: '', label: 'All Sub Accounts' },
        ...subAccountsData,
      ]);
    } catch (error) {
      console.error('Error loading sub accounts for company:', error);
      // Fallback to all sub accounts if there's an error
      await loadAllSubAccounts();
    }
  };

  const loadLedgerData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Loading initial ledger data...');
      
      // Load first page (1000 entries) for better performance
      const entries = await supabaseDB.getCashBookEntries(pageSize, 0);
      console.log('✅ Initial entries fetched:', entries.length);
      
      // Get total count for pagination info
      const totalCount = await supabaseDB.getCashBookEntriesCount();
      setTotalEntries(totalCount);

      // Convert to ledger format with running balance
      let runningBalance = 0;
      const ledgerData: LedgerEntry[] = entries.map((entry, index) => {
        const balance = entry.credit - entry.debit;
        runningBalance += balance;

        // Use the normalized payment_mode from getCashBookEntries directly
        // getCashBookEntries already normalizes payment_mode from database
        // Ensure we properly extract and display the payment_mode value
        let paymentMode = '';
        if (entry.payment_mode) {
          const pmStr = String(entry.payment_mode).trim();
          if (pmStr && pmStr !== 'null' && pmStr !== 'undefined' && pmStr !== '') {
            paymentMode = pmStr;
          }
        }
        
        // Debug: Log payment_mode for first few entries to verify values are present
        if (index < 5) {
          console.log(`📋 DetailedLedger Mapping Entry ${index + 1}:`, {
            id: entry.id,
            sno: entry.sno,
            payment_mode_from_entry: entry.payment_mode,
            payment_mode_type: typeof entry.payment_mode,
            payment_mode_final: paymentMode,
            company: entry.company_name
          });
        }

        return {
          id: entry.id,
          sno: entry.sno,
          date: entry.c_date,
          companyName: entry.company_name,
          accountName: entry.acc_name,
          subAccount: entry.sub_acc_name || '',
          particulars: entry.particulars,
          credit: entry.credit,
          debit: entry.debit,
          saleQuantity: entry.sale_qty || 0,
          purchaseQuantity: entry.purchase_qty || 0,
          staff: entry.staff,
          user: entry.users || entry.staff, // Use users field (logged-in user), fallback to staff if missing
          entryTime: entry.entry_time,
          approved: entry.approved,
          balance: balance,
          runningBalance: runningBalance,
          payment_mode: paymentMode, // Payment mode from NewEntry form (Cash/Bank Transfer/Online)
        };
      });

      setLedgerEntries(ledgerData);
      
      // Debug: Log summary of payment_mode values
      const entriesWithPaymentMode = ledgerData.filter(e => e.payment_mode && e.payment_mode.trim());
      console.log(`✅ DetailedLedger loaded: ${ledgerData.length} entries, ${entriesWithPaymentMode.length} have payment_mode values`);
      if (entriesWithPaymentMode.length > 0) {
        console.log('📊 Payment mode summary:', {
          Cash: entriesWithPaymentMode.filter(e => e.payment_mode === 'Cash').length,
          'Bank Transfer': entriesWithPaymentMode.filter(e => e.payment_mode === 'Bank Transfer').length,
          Online: entriesWithPaymentMode.filter(e => e.payment_mode === 'Online').length
        });
      }
      
      if (entries.length === 0) {
        toast.success('No entries found in database');
      } else {
        toast.success(`Loaded ${entries.length} entries (showing first ${pageSize} of ${totalCount})`);
      }
    } catch (error) {
      console.error('Error loading ledger data:', error);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreEntries = async () => {
    if (isLoadingMore || ledgerEntries.length >= totalEntries) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = Math.floor(ledgerEntries.length / pageSize) + 1;
      const offset = ledgerEntries.length;
      
      console.log(`🔄 Loading more entries - Page: ${nextPage}, Offset: ${offset}`);
      
      const moreEntries = await supabaseDB.getCashBookEntries(pageSize, offset);
      console.log(`✅ Loaded ${moreEntries.length} more entries`);
      
      // Convert to ledger format with running balance
      let runningBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].runningBalance : 0;
      const moreLedgerData: LedgerEntry[] = moreEntries.map((entry, index) => {
        const balance = entry.credit - entry.debit;
        runningBalance += balance;

        return {
          id: entry.id,
          sno: entry.sno,
          date: entry.c_date,
          companyName: entry.company_name,
          accountName: entry.acc_name,
          subAccount: entry.sub_acc_name || '',
          particulars: entry.particulars,
          credit: entry.credit,
          debit: entry.debit,
          saleQuantity: entry.sale_qty || 0,
          purchaseQuantity: entry.purchase_qty || 0,
          staff: entry.staff,
          user: entry.users || entry.staff,
          entryTime: entry.entry_time,
          approved: entry.approved,
          balance: balance,
          runningBalance: runningBalance,
          payment_mode: entry.payment_mode && String(entry.payment_mode).trim()
            ? String(entry.payment_mode).trim()
            : '',
        };
      });
      
      setLedgerEntries(prev => [...prev, ...moreLedgerData]);
      
      if (moreEntries.length === 0) {
        toast.success('No more entries to load');
      }
    } catch (error) {
      console.error('Error loading more entries:', error);
      toast.error('Failed to load more entries');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadAllEntries = async () => {
    try {
      setIsLoadingAll(true);
      setLoadingProgress({ current: 0, total: 0, message: 'Starting to load all entries...' });
      console.log('🔄 Loading ALL entries from database...');
      
      // First get the total count
      const totalCount = await supabaseDB.getCashBookEntriesCount();
      setLoadingProgress({ current: 0, total: totalCount, message: `Found ${totalCount} total records, starting to load...` });
      
      if (totalCount === 0) {
        toast.error('No records found in database');
        return;
      }
      
      // Load all entries using the pagination helper
      const allEntries = await supabaseDB.getAllCashBookEntries();
      console.log(`✅ Loaded ALL ${allEntries.length} entries`);
      
      // Convert to ledger format with running balance
      let runningBalance = 0;
      const ledgerData: LedgerEntry[] = allEntries.map((entry, index) => {
        const balance = entry.credit - entry.debit;
        runningBalance += balance;

        return {
          id: entry.id,
          sno: entry.sno,
          date: entry.c_date,
          companyName: entry.company_name,
          accountName: entry.acc_name,
          subAccount: entry.sub_acc_name || '',
          particulars: entry.particulars,
          credit: entry.credit,
          debit: entry.debit,
          staff: entry.staff,
          user: entry.users || entry.staff, // Use users field (logged-in user), fallback to staff if missing
          entryTime: entry.entry_time,
          approved: entry.approved,
          balance: balance,
          runningBalance: runningBalance,
          payment_mode: entry.payment_mode && String(entry.payment_mode).trim()
            ? String(entry.payment_mode).trim()
            : '',
          saleQuantity: entry.sale_qty || 0,
          purchaseQuantity: entry.purchase_qty || 0,
        };
      });
      
      setLedgerEntries(ledgerData);
      setTotalEntries(ledgerData.length);
      setLoadingProgress({ current: ledgerData.length, total: totalCount, message: 'Loading complete!' });
      
      toast.success(`Loaded ALL ${ledgerData.length} entries successfully`);
    } catch (error) {
      console.error('Error loading all entries:', error);
      toast.error('Failed to load all entries: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setLoadingProgress({ current: 0, total: 0, message: 'Loading failed' });
    } finally {
      setIsLoadingAll(false);
      // Clear progress after a delay
      setTimeout(() => {
        setLoadingProgress({ current: 0, total: 0, message: '' });
      }, 3000);
    }
  };

  const applyFilters = () => {
    let filtered = [...ledgerEntries];

    // Date range filter
    if (filters.betweenDates) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        const fromDate = new Date(filters.fromDate);
        const toDate = new Date(filters.toDate);
        return entryDate >= fromDate && entryDate <= toDate;
      });
    }

    // Company filter
    if (filters.companyName) {
      filtered = filtered.filter(
        entry => entry.companyName === filters.companyName
      );
    }

    // Main Account filter
    if (filters.mainAccount) {
      filtered = filtered.filter(
        entry => entry.accountName === filters.mainAccount
      );
    }

    // Sub Account filter
    if (filters.subAccount) {
      filtered = filtered.filter(
        entry => entry.subAccount === filters.subAccount
      );
    }

    // Staff filter
    if (filters.staffwise && filters.staffwise.trim() !== '') {
      const filterStaff = filters.staffwise.trim();
      const beforeCount = filtered.length;
      filtered = filtered.filter(entry => {
        const entryStaff = String(entry.staff || '').trim();
        return entryStaff === filterStaff;
      });
      console.log(`🔍 Staff filter "${filterStaff}": ${beforeCount} -> ${filtered.length} entries`);
    }

    // User filter
    if (filters.user && filters.user.trim() !== '') {
      const filterUser = filters.user.trim();
      const beforeCount = filtered.length;
      filtered = filtered.filter(entry => {
        const entryUser = String(entry.user || '').trim();
        return entryUser === filterUser;
      });
      console.log(`🔍 User filter "${filterUser}": ${beforeCount} -> ${filtered.length} entries`);
    }

    // Credit amount filter (exact match)
    if (filters.creditAmount && filters.creditAmount.trim() !== '') {
      const n = Number(filters.creditAmount);
      if (!Number.isNaN(n)) {
        filtered = filtered.filter(entry => Number(entry.credit) === n);
      }
    }

    // Debit amount filter (exact match)
    if (filters.debitAmount && filters.debitAmount.trim() !== '') {
      const n = Number(filters.debitAmount);
      if (!Number.isNaN(n)) {
        filtered = filtered.filter(entry => Number(entry.debit) === n);
      }
    }

    // Payment mode filter
    if (filters.paymentMode) {
      filtered = filtered.filter(entry => {
        const entryPaymentMode = entry.payment_mode || '';
        return entryPaymentMode === filters.paymentMode;
      });
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        entry =>
          entry.particulars.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.subAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.staff.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.credit.toString().includes(searchTerm) ||
          entry.debit.toString().includes(searchTerm)
      );
    }

    // Calculate summary
    const totalCredit = filtered.reduce((sum, entry) => sum + entry.credit, 0);
    const totalDebit = filtered.reduce((sum, entry) => sum + entry.debit, 0);
    const balance = totalCredit - totalDebit;

    setSummary({
      totalCredit,
      totalDebit,
      balance,
      recordCount: filtered.length,
      openingBalance: 0, // Calculate based on entries before date range
      closingBalance: balance,
    });

    setFilteredEntries(filtered);
  };

  const handleFilterChange = (
    field: keyof DetailedLedgerFilters,
    value: any
  ) => {
    console.log('Filter change:', field, value);
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value };

      // Reset dependent filters
      if (field === 'companyName') {
        newFilters.mainAccount = '';
        newFilters.subAccount = '';
        console.log('Reset main account and sub account');
      }
      if (field === 'mainAccount') {
        newFilters.subAccount = '';
        console.log('Reset sub account');
      }

      console.log('New filters:', newFilters);
      return newFilters;
    });
  };

  const getRecords = () => {
    applyFilters();
    toast.success(`Found ${filteredEntries.length} records`);
  };

  const loadFilteredData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading filtered data from server...');
      
      // Use server-side filtering for better performance with large datasets
      const filteredEntries = await supabaseDB.getAllFilteredCashBookEntries({
        companyName: filters.companyName || undefined,
        accountName: filters.mainAccount || undefined,
        subAccountName: filters.subAccount || undefined,
      });
      
      console.log(`📊 Filtered entries loaded: ${filteredEntries.length}`);
      
      // Convert to ledger format with running balance
      let runningBalance = 0;
      const ledgerData: LedgerEntry[] = filteredEntries.map((entry, index) => {
        const balance = entry.credit - entry.debit;
        runningBalance += balance;

        return {
          id: entry.id,
          sno: entry.sno,
          date: entry.c_date,
          companyName: entry.company_name,
          accountName: entry.acc_name,
          subAccount: entry.sub_acc_name || '',
          particulars: entry.particulars,
          credit: entry.credit,
          debit: entry.debit,
          staff: entry.staff,
          user: entry.users || entry.staff,
          entryTime: entry.entry_time,
          approved: entry.approved,
          balance: balance,
          runningBalance: runningBalance,
        };
      });
      
      setLedgerEntries(ledgerData);
      setTotalEntries(ledgerData.length);
      
      if (ledgerData.length === 0) {
        toast.success(`No entries found for the selected filters`);
      } else {
        toast.success(`Found ${ledgerData.length} entries matching your filters`);
      }
    } catch (error) {
      console.error('Error loading filtered data:', error);
      toast.error('Failed to load filtered data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      fromDate: '2016-10-31',
      toDate: format(new Date(), 'yyyy-MM-dd'),
      companyName: '',
      mainAccount: '',
      subAccount: '',
      staffwise: '',
      user: '',
      creditAmount: '',
      debitAmount: '',
      betweenDates: true,
      paymentMode: '',
    });
    setSearchTerm('');
    // Reset accounts and sub-accounts to initial state
    setAccounts([{ value: '', label: 'Select a company first' }]);
    setSubAccounts([{ value: '', label: 'Select a company first' }]);
    toast.success('Filters reset');
  };

  const printReport = () => {
    setShowPrintPreview(true);
  };

  const printAll = () => {
    // Print all records without filters
    const allEntries = ledgerEntries;
    console.log('Printing all records:', allEntries.length);
    toast.success(`Preparing to print ${allEntries.length} records`);
    setShowPrintPreview(true);
  };

  const exportToExcel = () => {
    const exportData = filteredEntries.map((entry, index) => ({
      'S.No': index + 1,
      Date: entry.date,
      Company: entry.companyName,
      'Main Account': entry.accountName,
      'Sub Account': entry.subAccount || '',
      Particulars: entry.particulars,
      Credit: entry.credit,
      Debit: entry.debit,
      Balance: entry.balance,
      Staff: entry.staff,
      'Payment Mode': entry.payment_mode || '',
      User: entry.user,
      'Entry Time': entry.entryTime,
      // Status removed per requirement
    }));

    // Create CSV content
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => `"${row[header as keyof typeof row]}"`).join(',')
      ),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detailed-ledger-${filters.fromDate}-to-${filters.toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Ledger exported successfully!');
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>Detailed Ledger</h1>
          <p className='text-gray-600'>
            Comprehensive ledger analysis with advanced filtering
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <Button
            variant='secondary'
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
          <Button variant='secondary' onClick={loadLedgerData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className='bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'>
          <div className='space-y-6'>
            {/* Date Range Section */}
            <div className='bg-white p-4 rounded-lg border border-gray-200'>
              <div className='flex items-center gap-2 mb-4'>
                <input
                  type='checkbox'
                  id='betweenDates'
                  checked={filters.betweenDates}
                  onChange={e =>
                    handleFilterChange('betweenDates', e.target.checked)
                  }
                  className='w-4 h-4 text-blue-600 rounded focus:ring-blue-500'
                />
                <label
                  htmlFor='betweenDates'
                  className='text-sm font-medium text-gray-700'
                >
                  Between Dates
                </label>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    From
                  </label>
                  <div className='relative'>
                    <input
                      type='text'
                      value={fromDateInput}
                      onChange={e => {
                        const v = e.target.value;
                        setFromDateInput(v);
                        const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        if (m) {
                          const [, dd, mm, yyyy] = m;
                          handleFilterChange('fromDate', `${yyyy}-${mm}-${dd}`);
                        }
                      }}
                      disabled={!filters.betweenDates}
                      placeholder='dd/MM/yyyy'
                      className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    />
                    <button
                      type='button'
                      onClick={() => {
                        const el = fromPickerRef.current as any;
                        if (el && typeof el.showPicker === 'function') {
                          el.showPicker();
                        } else {
                          fromPickerRef.current?.click();
                        }
                      }}
                      className='absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded'
                    >
                      <Calendar className='w-4 h-4 text-gray-500' />
                    </button>
                    <input
                      ref={fromPickerRef}
                      type='date'
                      value={filters.fromDate}
                      onChange={e => {
                        const iso = e.target.value;
                        handleFilterChange('fromDate', iso);
                        try { setFromDateInput(format(new Date(iso), 'dd/MM/yyyy')); } catch {}
                      }}
                      className='absolute left-0 top-0 w-0 h-0 opacity-0'
                    />
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    To
                  </label>
                  <div className='relative'>
                    <input
                      type='text'
                      value={toDateInput}
                      onChange={e => {
                        const v = e.target.value;
                        setToDateInput(v);
                        const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        if (m) {
                          const [, dd, mm, yyyy] = m;
                          handleFilterChange('toDate', `${yyyy}-${mm}-${dd}`);
                        }
                      }}
                      disabled={!filters.betweenDates}
                      placeholder='dd/MM/yyyy'
                      className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    />
                    <button
                      type='button'
                      onClick={() => {
                        const el = toPickerRef.current as any;
                        if (el && typeof el.showPicker === 'function') {
                          el.showPicker();
                        } else {
                          toPickerRef.current?.click();
                        }
                      }}
                      className='absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded'
                    >
                      <Calendar className='w-4 h-4 text-gray-500' />
                    </button>
                    <input
                      ref={toPickerRef}
                      type='date'
                      value={filters.toDate}
                      onChange={e => {
                        const iso = e.target.value;
                        handleFilterChange('toDate', iso);
                        try { setToDateInput(format(new Date(iso), 'dd/MM/yyyy')); } catch {}
                      }}
                      className='absolute left-0 top-0 w-0 h-0 opacity-0'
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Account Filters */}
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <SearchableSelect
                label='Company Name'
                value={filters.companyName}
                onChange={value => handleFilterChange('companyName', value)}
                options={companies}
                placeholder='Search company...'
              />

              <SearchableSelect
                label='Main Account'
                value={filters.mainAccount}
                onChange={value => handleFilterChange('mainAccount', value)}
                options={accounts}
                disabled={!filters.companyName}
                placeholder={
                  !filters.companyName
                    ? 'Select a company first'
                    : 'Search main account...'
                }
              />

              <SearchableSelect
                label='Sub Account'
                value={filters.subAccount}
                onChange={value => handleFilterChange('subAccount', value)}
                options={subAccounts}
                disabled={!filters.mainAccount}
                placeholder={
                  !filters.mainAccount
                    ? 'Select a main account first'
                    : 'Search sub account...'
                }
              />

              <SearchableSelect
                label='Staffwise'
                value={filters.staffwise}
                onChange={value => handleFilterChange('staffwise', value)}
                options={staffList}
                placeholder='Search staff...'
              />

              <SearchableSelect
                label='User'
                value={filters.user}
                onChange={value => handleFilterChange('user', value)}
                options={userList}
                placeholder='Search user...'
              />
            </div>

            {/* Filtering guidance removed as requested */}

            {/* Amount Filters + Payment Mode */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Credit Amount (Search)
                </label>
                <input
                  type='text'
                  inputMode='decimal'
                  value={filters.creditAmount || ''}
                  onChange={e => handleFilterChange('creditAmount', e.target.value)}
                  placeholder='Enter credit amount to search...'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Debit Amount (Search)
                </label>
                <input
                  type='text'
                  inputMode='decimal'
                  value={filters.debitAmount || ''}
                  onChange={e => handleFilterChange('debitAmount', e.target.value)}
                  placeholder='Enter debit amount to search...'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Payment Mode
                </label>
                <select
                  value={filters.paymentMode || ''}
                  onChange={e => handleFilterChange('paymentMode', e.target.value)}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>All</option>
                  <option value='Cash'>Cash</option>
                  <option value='Bank Transfer'>Bank Transfer</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='flex flex-wrap gap-3'>
              <Button
                onClick={getRecords}
                className='bg-green-600 hover:bg-green-700'
              >
                Get Record (Client-side)
              </Button>

              <Button
                onClick={loadFilteredData}
                className='bg-blue-600 hover:bg-blue-700'
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load Filtered Data (Server-side)'}
              </Button>

              <Button variant='secondary' onClick={resetFilters}>
                Reset
              </Button>

              <Button variant='secondary' onClick={() => setShowFilters(false)}>
                Close
              </Button>

              <Button variant='secondary' onClick={printReport}>
                Print
              </Button>

              <Button variant='secondary' onClick={printAll}>
                Print All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search Bar */}
      <Card className='bg-gray-50'>
        <div className='flex items-center gap-4'>
          <div className='relative flex-1'>
            <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' />
            <input
              type='text'
              placeholder='Search in ledger entries...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div className='text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border'>
            <strong>{filteredEntries.length}</strong> records found
            {totalEntries > 0 && (
              <span className='text-xs text-gray-500 ml-2'>
                (of {totalEntries} total)
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
        <Card className='bg-gradient-to-r from-green-500 to-green-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-green-100 text-sm font-medium'>Total Credit</p>
              <p className='text-2xl font-bold'>
                ₹{totals.totalCredit.toLocaleString()}
              </p>
            </div>
            <TrendingUp className='w-8 h-8 text-green-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-red-500 to-red-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-red-100 text-sm font-medium'>Total Debit</p>
              <p className='text-2xl font-bold'>
                ₹{totals.totalDebit.toLocaleString()}
              </p>
            </div>
            <TrendingDown className='w-8 h-8 text-red-200' />
          </div>
        </Card>

        <Card
          className={`bg-gradient-to-r ${
            totals.balance >= 0
              ? 'from-blue-500 to-blue-600'
              : 'from-orange-500 to-orange-600'
          } text-white`}
        >
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-blue-100 text-sm font-medium'>Balance</p>
              <p className='text-2xl font-bold'>
                ₹{Math.abs(totals.balance).toLocaleString()}
                {totals.balance >= 0 ? ' CR' : ' DR'}
              </p>
            </div>
            <BarChart3 className='w-8 h-8 text-blue-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-indigo-100 text-sm font-medium'>Total Sale Qty</p>
              <p className='text-2xl font-bold'>
                {totals.totalSaleQty.toLocaleString()}
              </p>
            </div>
            <BarChart3 className='w-8 h-8 text-indigo-200' />
          </div>
        </Card>
        <Card className='bg-gradient-to-r from-purple-500 to-purple-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-purple-100 text-sm font-medium'>Total Purchase Qty</p>
              <p className='text-2xl font-bold'>
                {totals.totalPurchaseQty.toLocaleString()}
              </p>
            </div>
            <BarChart3 className='w-8 h-8 text-purple-200' />
          </div>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card
        title='Detailed Ledger Entries'
        subtitle={`Showing ${filteredEntries.length} entries${totalEntries > 0 ? ` (of ${totalEntries} total)` : ''}`}
      >
        {loading ? (
          <div className='text-center py-8'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-2 text-gray-600'>Loading ledger data...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>
            No entries found matching your criteria.
          </div>
        ) : (
          <div className='w-full'>
            <table className='w-full text-xs table-fixed border-collapse'>
              <thead className='sticky top-0 bg-gray-50 z-10'>
                <tr className='border-b border-gray-200'>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[3%]'>
                    S.No
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[6%]'>
                    Date
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[11%]'>
                    Company
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[9%]'>
                    Account
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[10%]'>
                    Sub Account
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[8%]'>
                    Particulars
                  </th>
                  <th className='px-0.5 py-0.5 text-right font-medium text-gray-700 w-[6%]'>
                    Credit
                  </th>
                  <th className='px-0.5 py-0.5 text-right font-medium text-gray-700 w-[6%]'>
                    Debit
                  </th>
                  <th className='px-0.5 py-0.5 text-center font-medium text-gray-700 w-[5%]'>
                    Sale Qty
                  </th>
                  <th className='px-0.5 py-0.5 text-center font-medium text-gray-700 w-[6%]'>
                    Purchase Qty
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[9%]'>
                    Staff
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[7%]'>
                    Payment Mode
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[7%]'>
                    User
                  </th>
                  <th className='px-0.5 py-0.5 text-left font-medium text-gray-700 w-[8%]'>
                    Entry Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                    }`}
                  >
                    <td className='px-0.5 py-0.5 font-medium text-xs'>{index + 1}</td>
                    <td className='px-0.5 py-0.5 text-xs'>
                      {format(new Date(entry.date), 'dd/MM/yyyy')}
                    </td>
                    <td className='px-0.5 py-0.5 font-medium text-blue-600 text-xs truncate' title={entry.companyName}>
                      {entry.companyName}
                    </td>
                    <td className='px-0.5 py-0.5 text-xs truncate' title={entry.accountName}>
                      {entry.accountName}
                    </td>
                    <td className='px-0.5 py-0.5 text-xs truncate' title={entry.subAccount}>
                      {entry.subAccount || '-'}
                    </td>
                    <td className='px-0.5 py-0.5 text-xs truncate' title={entry.particulars}>
                      {entry.particulars}
                    </td>
                    <td className='px-0.5 py-0.5 text-right font-medium text-green-600 text-xs'>
                      {entry.credit > 0
                        ? `₹${entry.credit.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className='px-0.5 py-0.5 text-right font-medium text-red-600 text-xs'>
                      {entry.debit > 0
                        ? `₹${entry.debit.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className='px-0.5 py-0.5 text-center text-xs'>
                      {entry.saleQuantity > 0 ? entry.saleQuantity.toLocaleString() : '-'}
                    </td>
                    <td className='px-0.5 py-0.5 text-center text-xs'>
                      {entry.purchaseQuantity > 0 ? entry.purchaseQuantity.toLocaleString() : '-'}
                    </td>
                    <td className='px-0.5 py-0.5 text-xs truncate' title={entry.staff}>
                      {entry.staff}
                    </td>
                    <td className='px-0.5 py-0.5 text-xs truncate' title={entry.payment_mode || 'No payment mode'}>
                      {entry.payment_mode && String(entry.payment_mode).trim() ? String(entry.payment_mode).trim() : '-'}
                    </td>
                    <td className='px-0.5 py-0.5 text-xs truncate' title={entry.user}>
                      {entry.user}
                    </td>
                    <td className='px-0.5 py-0.5 text-xs'>
                      {format(new Date(entry.entryTime), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary Footer */}
            <div className='mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border'>
              <div className='bg-green-100 p-3 rounded-lg'>
                <div className='text-sm font-medium text-green-800'>
                  Total Credit:
                </div>
                <div className='text-lg font-bold text-green-900'>
                  ₹{totals.totalCredit.toLocaleString()}
                </div>
              </div>
              <div className='bg-red-100 p-3 rounded-lg'>
                <div className='text-sm font-medium text-red-800'>
                  Total Debit:
                </div>
                <div className='text-lg font-bold text-red-900'>
                  ₹{totals.totalDebit.toLocaleString()}
                </div>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  totals.balance >= 0 ? 'bg-blue-100' : 'bg-orange-100'
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    totals.balance >= 0 ? 'text-blue-800' : 'text-orange-800'
                  }`}
                >
                  Balance:
                </div>
                <div
                  className={`text-lg font-bold ${
                    totals.balance >= 0 ? 'text-blue-900' : 'text-orange-900'
                  }`}
                >
                  ₹{Math.abs(totals.balance).toLocaleString()}
                  {totals.balance >= 0 ? ' CR' : ' DR'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Progress Indicator */}
        {isLoadingAll && loadingProgress.total > 0 && (
          <div className='text-center py-4'>
            <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto'>
              <div className='text-sm text-blue-800 mb-2'>{loadingProgress.message}</div>
              <div className='w-full bg-blue-200 rounded-full h-2 mb-2'>
                <div 
                  className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                  style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className='text-xs text-blue-600'>
                {loadingProgress.current.toLocaleString()} / {loadingProgress.total.toLocaleString()} records
              </div>
            </div>
          </div>
        )}

        {/* Load More and Load All Buttons */}
        <div className='text-center py-4 space-x-4'>
          {ledgerEntries.length < totalEntries && (
            <Button
              onClick={loadMoreEntries}
              disabled={isLoadingMore || isLoadingAll}
              variant='secondary'
              icon={isLoadingMore ? RefreshCw : Plus}
              className='min-w-[200px]'
            >
              {isLoadingMore ? 'Loading...' : `Load More (${totalEntries - ledgerEntries.length} remaining)`}
            </Button>
          )}
          
          {ledgerEntries.length < totalEntries && (
            <Button
              onClick={loadAllEntries}
              disabled={isLoadingMore || isLoadingAll}
              variant='primary'
              icon={isLoadingAll ? RefreshCw : Database}
              className='min-w-[200px]'
            >
              {isLoadingAll ? 'Loading All...' : `Load All ${totalEntries} Records`}
            </Button>
          )}
        </div>
        
        {/* Pagination Info */}
        {totalEntries > 0 && (
          <div className='text-center text-sm text-gray-600 py-2'>
            Showing {ledgerEntries.length} of {totalEntries} entries
          </div>
        )}
      </Card>

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-6 no-print'>
                <h3 className='text-lg font-semibold'>
                  Print Preview - Detailed Ledger
                </h3>
                <div className='flex items-center gap-2'>
                  <Button size='sm' onClick={() => window.print()}>
                    Print
                  </Button>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => setShowPrintPreview(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>

              {/* Print Styles */}
              <style>{`
                @media print {
                  @page {
                    size: A4 landscape;
                    margin: 0.5cm;
                  }
                  * {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  body * {
                    visibility: hidden;
                  }
                  .print-content, .print-content * {
                    visibility: visible;
                  }
                  .print-content {
                    position: relative;
                    width: 100%;
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .print-page {
                    page-break-after: always;
                    break-after: page;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    margin: 0;
                    padding: 0;
                    display: block;
                    width: 100%;
                    min-height: 0;
                    overflow: visible;
                  }
                  .print-page:last-child {
                    page-break-after: auto;
                    break-after: auto;
                  }
                  .print-page-header {
                    page-break-after: avoid;
                    break-after: avoid;
                    margin-bottom: 8px;
                    padding-bottom: 5px;
                  }
                  .print-page-footer {
                    page-break-before: avoid;
                    break-before: avoid;
                    margin-top: 8px;
                    padding-top: 5px;
                  }
                  .print-table {
                    width: 100%;
                    font-size: 9px;
                    border-collapse: collapse;
                    table-layout: fixed;
                    margin: 0;
                    padding: 0;
                    page-break-inside: auto;
                    border-spacing: 0;
                  }
                  .print-table thead {
                    display: table-header-group;
                    page-break-after: avoid;
                    break-after: avoid;
                  }
                  .print-table tbody {
                    display: table-row-group;
                    page-break-inside: auto;
                  }
                  .print-table tr {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    page-break-after: auto;
                    break-after: auto;
                    height: auto;
                    min-height: 12px;
                    display: table-row;
                    border-collapse: collapse;
                  }
                  .print-table tbody tr {
                    border-top: 1px solid #000;
                    border-bottom: 1px solid #000;
                  }
                  .print-table th,
                  .print-table td {
                    padding: 4px 3px;
                    border-left: 1px solid #000;
                    border-right: 1px solid #000;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    line-height: 1.2;
                    vertical-align: top;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    display: table-cell;
                    position: relative;
                  }
                  .print-table th:first-child,
                  .print-table td:first-child {
                    border-left: 1px solid #000;
                  }
                  .print-table th:last-child,
                  .print-table td:last-child {
                    border-right: 1px solid #000;
                  }
                  .print-table th {
                    background-color: #e5e5e5 !important;
                    font-weight: bold;
                    font-size: 9px;
                    text-align: left;
                    position: relative;
                  }
                  .print-table .col-particulars {
                    word-break: break-word;
                    white-space: normal;
                    line-height: 1.3;
                  }
                  .print-table .col-company,
                  .print-table .col-account,
                  .print-table .col-subaccount,
                  .print-table .col-staff,
                  .print-table .col-user,
                  .print-table .col-payment {
                    white-space: normal;
                    word-break: break-word;
                  }
                  .print-table .col-sno { width: 3.5%; text-align: center; }
                  .print-table .col-date { width: 7%; }
                  .print-table .col-company { width: 9%; }
                  .print-table .col-account { width: 8%; }
                  .print-table .col-subaccount { width: 8%; }
                  .print-table .col-particulars { width: 18%; }
                  .print-table .col-credit { width: 7.5%; text-align: right; }
                  .print-table .col-debit { width: 7.5%; text-align: right; }
                  .print-table .col-saleqty { width: 5%; text-align: center; }
                  .print-table .col-purchaseqty { width: 5%; text-align: center; }
                  .print-table .col-staff { width: 7%; }
                  .print-table .col-payment { width: 8%; }
                  .print-table .col-user { width: 7%; }
                  .print-table .col-entrytime { width: 7.5%; }
                }
                @media screen {
                  .print-content {
                    display: block;
                  }
                  .print-table {
                    width: 100%;
                    font-size: 11px;
                  }
                  .print-page {
                    margin-bottom: 20px;
                    border: 1px dashed #ccc;
                    padding: 10px;
                  }
                }
              `}</style>

              {/* Print Content */}
              <div className='print-content print:block'>
                {/* Transactions Table - Split into pages of 20 rows */}
                {(() => {
                  const rowsPerPage = 20;
                  const totalPages = Math.ceil(filteredEntries.length / rowsPerPage);
                  const pages = [];
                  
                  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                    const startIndex = pageIndex * rowsPerPage;
                    const endIndex = Math.min(startIndex + rowsPerPage, filteredEntries.length);
                    const pageEntries = filteredEntries.slice(startIndex, endIndex);
                    const isLastPage = pageIndex === totalPages - 1;
                    
                    pages.push(
                      <div key={pageIndex} className={!isLastPage ? 'print-page' : ''}>
                        {/* Main Header - Only on first page */}
                        {pageIndex === 0 && (
                          <>
                            <div className='print-page-header' style={{ marginBottom: '10px', textAlign: 'center' }}>
                              <h1 style={{ fontSize: '20px', margin: '5px 0', fontWeight: 'bold' }}>
                                Thirumala Group
                              </h1>
                              <h2 style={{ fontSize: '16px', margin: '3px 0', fontWeight: '600' }}>
                                Detailed Ledger Report
                              </h2>
                              <p style={{ fontSize: '12px', margin: '3px 0' }}>
                                From {format(new Date(filters.fromDate), 'dd/MM/yyyy')} to {format(new Date(filters.toDate), 'dd/MM/yyyy')}
                              </p>
                              <div style={{ fontSize: '11px', marginTop: '5px' }}>
                                {filters.companyName && (
                                  <span style={{ marginRight: '15px' }}>
                                    Company: <strong>{filters.companyName}</strong>
                                  </span>
                                )}
                                {filters.mainAccount && (
                                  <span>
                                    Account: <strong>{filters.mainAccount}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Summary - Only on first page */}
                            <div className='print-page-header' style={{ marginBottom: '10px', fontSize: '11px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                <div style={{ textAlign: 'center', padding: '8px', border: '2px solid #666' }}>
                                  <div style={{ fontSize: '11px', marginBottom: '4px' }}>Total Credit</div>
                                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                    ₹{totals.totalCredit.toLocaleString()}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '8px', border: '2px solid #666' }}>
                                  <div style={{ fontSize: '11px', marginBottom: '4px' }}>Total Debit</div>
                                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                    ₹{totals.totalDebit.toLocaleString()}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '8px', border: '2px solid #666' }}>
                                  <div style={{ fontSize: '11px', marginBottom: '4px' }}>Balance</div>
                                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: totals.balance >= 0 ? '#059669' : '#dc2626' }}>
                                    ₹{Math.abs(totals.balance).toLocaleString()}
                                    {totals.balance >= 0 ? ' CR' : ' DR'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Additional Filter Info - Only on first page */}
                            {(filters.subAccount || filters.staffwise || filters.user || filters.paymentMode) && (
                              <div className='print-page-header' style={{ marginBottom: '8px', fontSize: '10px', padding: '5px', backgroundColor: '#f5f5f5' }}>
                                {filters.subAccount && <span style={{ marginRight: '15px' }}>Sub Account: <strong>{filters.subAccount}</strong></span>}
                                {filters.staffwise && <span style={{ marginRight: '15px' }}>Staff: <strong>{filters.staffwise}</strong></span>}
                                {filters.user && <span style={{ marginRight: '15px' }}>User: <strong>{filters.user}</strong></span>}
                                {filters.paymentMode && <span>Payment Mode: <strong>{filters.paymentMode}</strong></span>}
                              </div>
                            )}
                          </>
                        )}

                        {/* Page Header for continuation pages */}
                        {pageIndex > 0 && (
                          <div className='print-page-header' style={{ marginBottom: '8px', fontSize: '10px', textAlign: 'center', color: '#666' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>Thirumala Group - Detailed Ledger Report (Continued)</div>
                            <div>Page {pageIndex + 1} of {totalPages}</div>
                          </div>
                        )}
                        <table className='print-table'>
                          <thead>
                            <tr className='bg-gray-100'>
                              <th className='col-sno text-left'>S.No</th>
                              <th className='col-date text-left'>Date</th>
                              <th className='col-company text-left font-bold'>Company</th>
                              <th className='col-account text-left'>Account</th>
                              <th className='col-subaccount text-left'>Sub Account</th>
                              <th className='col-particulars text-left'>Particulars</th>
                              <th className='col-credit text-right'>Credit</th>
                              <th className='col-debit text-right'>Debit</th>
                              <th className='col-saleqty text-center'>Sale Qty</th>
                              <th className='col-purchaseqty text-center'>Purchase Qty</th>
                              <th className='col-staff text-left'>Staff</th>
                              <th className='col-payment text-left'>Payment Mode</th>
                              <th className='col-user text-left'>User</th>
                              <th className='col-entrytime text-left'>Entry Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageEntries.map((entry, localIndex) => {
                              const globalIndex = startIndex + localIndex;
                              return (
                                <tr key={entry.id}>
                                  <td className='col-sno'>{globalIndex + 1}</td>
                                  <td className='col-date'>{format(new Date(entry.date), 'dd/MM/yyyy')}</td>
                                  <td className='col-company font-bold'>{entry.companyName}</td>
                                  <td className='col-account'>{entry.accountName}</td>
                                  <td className='col-subaccount'>{entry.subAccount || '-'}</td>
                                  <td className='col-particulars' title={entry.particulars}>{entry.particulars}</td>
                                  <td className='col-credit text-right'>
                                    {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                                  </td>
                                  <td className='col-debit text-right'>
                                    {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                                  </td>
                                  <td className='col-saleqty text-center'>
                                    {entry.saleQuantity > 0 ? entry.saleQuantity.toLocaleString() : '-'}
                                  </td>
                                  <td className='col-purchaseqty text-center'>
                                    {entry.purchaseQuantity > 0 ? entry.purchaseQuantity.toLocaleString() : '-'}
                                  </td>
                                  <td className='col-staff'>{entry.staff}</td>
                                  <td className='col-payment'>
                                    {entry.payment_mode && String(entry.payment_mode).trim() ? String(entry.payment_mode).trim() : '-'}
                                  </td>
                                  <td className='col-user'>{entry.user}</td>
                                  <td className='col-entrytime'>{format(new Date(entry.entryTime), 'dd/MM/yyyy HH:mm')}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {/* Page Footer */}
                        <div className='print-page-footer' style={{ textAlign: 'center', fontSize: '9px', marginTop: '8px', color: '#666' }}>
                          Page {pageIndex + 1} of {totalPages}
                          {isLastPage && (
                            <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #ccc' }}>
                              Generated on {format(new Date(), 'dd/MM/yyyy HH:mm')} by {user?.username} | Total Records: {filteredEntries.length}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  return pages;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedLedger;
