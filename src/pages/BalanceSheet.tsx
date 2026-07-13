import React, { useState, useEffect } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import SearchableSelect from '../components/UI/SearchableSelect';
import { supabaseDB, BalanceSheetAccount } from '../lib/supabaseDatabase';
import { useTableMode } from '../contexts/TableModeContext';
import toast from 'react-hot-toast';
import ModeLabel from '../components/UI/ModeLabel';
import { format, parseISO } from 'date-fns';
import CustomCalendar from '../components/UI/CustomCalendar';
import { Calendar, AlertTriangle } from 'lucide-react';
import { getSharedPrintStyles } from '../utils/print';
import { useBook } from '../contexts/BookContext';

interface BalanceSheetFilters {
  companyName: string;
  betweenDates: boolean;
  fromDate: string;
  toDate: string;
  plYesNo: string;
  bothYesNo: string;
}

// BalanceSheetAccount interface is now imported from supabaseDatabase

const BalanceSheet: React.FC = () => {
  const { mode: tableMode } = useTableMode();
  const { currentBook, reportFilter } = useBook();

  const [filters, setFilters] = useState<BalanceSheetFilters>({
    companyName: '',
    betweenDates: true,
    fromDate: '2025-10-03',
    toDate: format(new Date(), 'yyyy-MM-dd'),
    plYesNo: '',
    bothYesNo: '',
  });

  const [balanceSheetData, setBalanceSheetData] = useState<
    BalanceSheetAccount[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [usingOptimizedAPI, setUsingOptimizedAPI] = useState(true);
  
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');

  // Sync formatted text inputs with filter date values
  useEffect(() => {
    try {
      setFromDateInput(filters.fromDate ? format(new Date(filters.fromDate), 'dd/MM/yyyy') : '');
    } catch (e) {
      console.error('Error formatting fromDate:', e);
    }
  }, [filters.fromDate]);

  useEffect(() => {
    try {
      setToDateInput(filters.toDate ? format(new Date(filters.toDate), 'dd/MM/yyyy') : '');
    } catch (e) {
      console.error('Error formatting toDate:', e);
    }
  }, [filters.toDate]);
  
  // State for P&L selection and custom content
  const [selectedAccountsForPL, setSelectedAccountsForPL] = useState<Set<string>>(new Set());
  const [customRows, setCustomRows] = useState<BalanceSheetAccount[]>([]);
  const [newRowData, setNewRowData] = useState({
    accountName: '',
    credit: '',
    debit: '',
    balance: '',
    result: 'CREDIT',
    plYesNo: 'NO',
    bothYesNo: 'NO',
  });

  // Dropdown data
  const [companies, setCompanies] = useState<
    { value: string; label: string }[]
  >([]);



  useEffect(() => {
    loadDropdownData();
    generateBalanceSheet();
  }, [tableMode, currentBook?.id]);

  useEffect(() => {
    generateBalanceSheet();
  }, [filters, reportFilter]);

  const loadDropdownData = async () => {
    try {
      // Load companies
      const companies = await supabaseDB.getCompanies();
      const companiesData = companies.map(company => ({
        value: company.company_name,
        label: company.company_name,
      }));
      setCompanies([{ value: '', label: 'All Companies' }, ...companiesData]);
    } catch (error) {
      console.error('Error loading companies:', error);
      toast.error('Failed to load companies');
    }
  };

  const generateBalanceSheet = async () => {
    setLoading(true);
    try {
      console.log('🚀 Generating optimized balance sheet...');
      
      // Use the new optimized API endpoint
      const result = await supabaseDB.getOptimizedBalanceSheet({
        companyName: filters.companyName || undefined,
        fromDate: filters.betweenDates ? filters.fromDate : undefined,
        toDate: filters.betweenDates ? filters.toDate : undefined,
        plYesNo: filters.plYesNo || undefined,
        bothYesNo: filters.bothYesNo || undefined,
        betweenDates: filters.betweenDates,
        reportFilter: reportFilter
      });

      setBalanceSheetData(result.balanceSheetData);

      console.log(`✅ Optimized balance sheet generated: ${result.balanceSheetData.length} accounts from ${result.recordCount} transactions${result.cached ? ' (served from cache)' : ''}`);
      
      const message = result.cached 
        ? `Balance sheet loaded from cache (${result.balanceSheetData.length} accounts)`
        : `Balance sheet generated with ${result.balanceSheetData.length} accounts from ${result.recordCount} transactions`;
      
      toast.success(message);
      setUsingOptimizedAPI(true);
    } catch (error) {
      console.error('❌ Error generating balance sheet:', error);
      toast.error('Failed to generate balance sheet: ' + (error instanceof Error ? error.message : 'Unknown error'));
      
      // Fallback to old method if API fails
      console.log('🔄 Falling back to client-side processing...');
      await generateBalanceSheetFallback();
    } finally {
      setLoading(false);
    }
  };

  // Fallback method using the old client-side approach
  const generateBalanceSheetFallback = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get filtered entries - use getAllCashBookEntries to get all 67k records
      const [entries, accountsList] = await Promise.all([
        supabaseDB.getAllCashBookEntries(),
        supabaseDB.getAccounts()
      ]);

      const accountCategoryMap = new Map<string, string>();
      accountsList.forEach(a => {
        if (a.acc_name) {
          accountCategoryMap.set(a.acc_name.toUpperCase(), a.report_category || 'BALANCE_SHEET');
        }
      });

      // Apply date filter
      let filteredEntries = entries;
      if (filters.betweenDates) {
        filteredEntries = filteredEntries.filter(entry => {
          const entryDate = new Date(entry.c_date);
          const fromDate = new Date(filters.fromDate);
          const toDate = new Date(filters.toDate);
          return entryDate >= fromDate && entryDate <= toDate;
        });
      }

      // Apply company filter
      if (filters.companyName) {
        filteredEntries = filteredEntries.filter(
          entry => entry.company_name === filters.companyName
        );
      }

      // Group by account name and calculate balances
      const accountMap = new Map<string, BalanceSheetAccount>();

      filteredEntries.forEach(entry => {
        const dbCategory = entry.report_category || accountCategoryMap.get(entry.acc_name.toUpperCase());
        const isPlFallback = getAccountPLStatus(entry.acc_name) === 'YES';
        const finalCategory = dbCategory || (isPlFallback ? 'PROFIT_LOSS' : 'BALANCE_SHEET');

        // Apply Report filter from context (All, Balance Sheet, Profit & Loss)
        if (reportFilter === 'BALANCE_SHEET' && finalCategory !== 'BALANCE_SHEET') return;
        if (reportFilter === 'PROFIT_LOSS' && finalCategory !== 'PROFIT_LOSS') return;

        if (!accountMap.has(entry.acc_name)) {
          accountMap.set(entry.acc_name, {
            accountName: entry.acc_name,
            credit: 0,
            debit: 0,
            balance: 0,
            plYesNo: finalCategory === 'PROFIT_LOSS' ? 'YES' : 'NO',
            bothYesNo: getAccountBothStatus(entry.acc_name),
            result: '',
          });
        }

        const account = accountMap.get(entry.acc_name)!;
        account.credit += entry.credit;
        account.debit += entry.debit;
        account.balance = account.credit - account.debit;
        account.result = account.balance >= 0 ? 'CREDIT' : 'DEBIT';
      });

      let balanceSheetAccounts = Array.from(accountMap.values());

      // Apply P&L filter
      if (filters.plYesNo) {
        balanceSheetAccounts = balanceSheetAccounts.filter(
          acc => acc.plYesNo === filters.plYesNo
        );
      }

      // Apply Both filter
      if (filters.bothYesNo) {
        balanceSheetAccounts = balanceSheetAccounts.filter(
          acc => acc.bothYesNo === filters.bothYesNo
        );
      }

      // Sort by account name
      balanceSheetAccounts.sort((a, b) =>
        a.accountName.localeCompare(b.accountName)
      );

      setBalanceSheetData(balanceSheetAccounts);

      console.log(`✅ Fallback balance sheet generated: ${balanceSheetAccounts.length} accounts`);
      toast.success(`Balance sheet generated (fallback method) with ${balanceSheetAccounts.length} accounts`);
      setUsingOptimizedAPI(false);
    } catch (error) {
      console.error('❌ Error in fallback balance sheet generation:', error);
      toast.error('Failed to generate balance sheet (fallback method)');
    }
  };

  const getAccountPLStatus = (accountName: string): string => {
    // Determine if account should be included in P&L
    const plAccounts = ['SALES', 'PURCHASE', 'EXPENSE', 'INCOME', 'REVENUE'];
    const isPlAccount = plAccounts.some(type =>
      accountName.toUpperCase().includes(type)
    );
    return isPlAccount ? 'YES' : 'NO';
  };

  const getAccountBothStatus = (accountName: string): string => {
    // Determine if account appears in both balance sheet and P&L
    const bothAccounts = ['CAPITAL', 'DRAWINGS', 'RESERVES'];
    const isBothAccount = bothAccounts.some(type =>
      accountName.toUpperCase().includes(type)
    );
    return isBothAccount ? 'BOTH' : 'NO';
  };

  const handleFilterChange = (field: keyof BalanceSheetFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePLSelectionChange = (accountName: string, isSelected: boolean) => {
    setSelectedAccountsForPL(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(accountName);
      } else {
        newSet.delete(accountName);
      }
      return newSet;
    });
  };

  const handleNewRowDataChange = (field: string, value: string | number) => {
    setNewRowData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const addCustomRow = () => {
    if (currentBook?.is_locked) {
      toast.error('This book is locked. Cannot add custom rows.');
      return;
    }

    if (!newRowData.accountName.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    const customRow: BalanceSheetAccount = {
      accountName: newRowData.accountName.trim(),
      credit: parseFloat(newRowData.credit.toString()) || 0,
      debit: parseFloat(newRowData.debit.toString()) || 0,
      balance: parseFloat(newRowData.balance.toString()) || 0,
      result: newRowData.result,
      plYesNo: newRowData.plYesNo,
      bothYesNo: newRowData.bothYesNo,
    };

    setCustomRows(prev => [...prev, customRow]);
    
    // Reset form
    setNewRowData({
      accountName: '',
      credit: '',
      debit: '',
      balance: '',
      result: 'CREDIT',
      plYesNo: 'NO',
      bothYesNo: 'NO',
    });
    
    toast.success('Custom row added successfully!');
  };

  const refreshData = () => {
    generateBalanceSheet();
    toast.success('Balance sheet refreshed successfully!');
  };

  const resetFilters = () => {
    setFilters({
      companyName: '',
      betweenDates: true,
      fromDate: '2025-10-03',
      toDate: format(new Date(), 'yyyy-MM-dd'),
      plYesNo: '',
      bothYesNo: '',
    });
    toast.success('Filters reset');
  };

  const printReport = () => {
    const allAccounts = [...balanceSheetData, ...customRows];
    let printContent = '';
    const dateRangeStr = filters.betweenDates 
      ? `${format(parseISO(filters.fromDate), 'dd/MM/yyyy')} to ${format(parseISO(filters.toDate), 'dd/MM/yyyy')}`
      : 'All Time';

    if (reportFilter === 'BALANCE_SHEET') {
      const bsAccounts = allAccounts.filter(acc => acc.plYesNo === 'NO');
      const totals = {
        totalCredit: bsAccounts.reduce((sum, acc) => sum + acc.credit, 0),
        totalDebit: bsAccounts.reduce((sum, acc) => sum + acc.debit, 0),
        balance: bsAccounts.reduce((sum, acc) => sum + acc.balance, 0),
      };

      printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Balance Sheet Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 15px; background-color: white; font-size: 12px; line-height: 1.2; }
              .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
              .header h2 { margin: 3px 0; font-size: 12px; }
              .header h3 { margin: 2px 0; font-size: 14px; }
              .header p { margin: 2px 0; font-size: 11px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
              th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
              th { background-color: #f0f0f0; font-weight: bold; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .totals { background-color: #f0f0f0; font-weight: bold; }
              .footer { margin-top: 15px; text-align: center; font-size: 10px; border-top: 1px solid #000; padding-top: 5px; }
              @media print { @page { size: portrait; margin: 8mm; } body { margin: 0; padding: 10px; } }
              ${getSharedPrintStyles({ isLandscape: false })}
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Balance Sheet Report</h1>
              <h2>Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}</h2>
              <h3>Company: ${filters.companyName || 'All Companies'}</h3>
              <p>Period: ${dateRangeStr}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th class="col-account">Account Name</th>
                  <th class="col-credit text-right">Credit</th>
                  <th class="col-debit text-right">Debit</th>
                  <th class="col-balance text-right">Balance</th>
                  <th class="col-status text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                ${bsAccounts.map(acc => `
                  <tr>
                    <td class="col-account">${acc.accountName}</td>
                    <td class="col-credit text-right text-green">${acc.credit > 0 ? `${acc.credit.toLocaleString()}` : '-'}</td>
                    <td class="col-debit text-right text-red">${acc.debit > 0 ? `${acc.debit.toLocaleString()}` : '-'}</td>
                    <td class="col-balance text-right">${acc.balance > 0 ? `${acc.balance.toLocaleString()}` : '-'}</td>
                    <td class="col-status text-center">${acc.result}</td>
                  </tr>
                `).join('')}
                <tr class="totals">
                  <td class="col-account"><strong>TOTALS</strong></td>
                  <td class="col-credit text-right text-green"><strong>${totals.totalCredit.toLocaleString()}</strong></td>
                  <td class="col-debit text-right text-red"><strong>${totals.totalDebit.toLocaleString()}</strong></td>
                  <td class="col-balance text-right"><strong>${totals.balance.toLocaleString()}</strong></td>
                  <td class="col-status text-center"><strong>${totals.balance >= 0 ? 'CREDIT' : 'DEBIT'}</strong></td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <p>Generated by Thirumala Group Business Management System</p>
            </div>
          </body>
        </html>
      `;
    } else if (reportFilter === 'PROFIT_LOSS') {
      const plAccounts = allAccounts.filter(acc => acc.plYesNo === 'YES');
      const totals = {
        totalCredit: plAccounts.reduce((sum, acc) => sum + acc.credit, 0),
        totalDebit: plAccounts.reduce((sum, acc) => sum + acc.debit, 0),
        balance: plAccounts.reduce((sum, acc) => sum + acc.balance, 0),
      };

      printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Profit & Loss Statement</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 15px; background-color: white; font-size: 12px; line-height: 1.2; }
              .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
              .header h2 { margin: 3px 0; font-size: 12px; }
              .header h3 { margin: 2px 0; font-size: 14px; }
              .header p { margin: 2px 0; font-size: 11px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
              th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
              th { background-color: #f0f0f0; font-weight: bold; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .totals { background-color: #f0f0f0; font-weight: bold; }
              .footer { margin-top: 15px; text-align: center; font-size: 10px; border-top: 1px solid #000; padding-top: 5px; }
              @media print { @page { size: portrait; margin: 8mm; } body { margin: 0; padding: 10px; } }
              ${getSharedPrintStyles({ isLandscape: false })}
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Profit & Loss Statement</h1>
              <h2>Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}</h2>
              <h3>Company: ${filters.companyName || 'All Companies'}</h3>
              <p>Period: ${dateRangeStr}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th class="col-account">Account Name</th>
                  <th class="col-credit text-right">Credit</th>
                  <th class="col-debit text-right">Debit</th>
                  <th class="col-balance text-right">Balance</th>
                  <th class="col-status text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                ${plAccounts.map(acc => `
                  <tr>
                    <td class="col-account">${acc.accountName}</td>
                    <td class="col-credit text-right text-green">${acc.credit > 0 ? `${acc.credit.toLocaleString()}` : '-'}</td>
                    <td class="col-debit text-right text-red">${acc.debit > 0 ? `${acc.debit.toLocaleString()}` : '-'}</td>
                    <td class="col-balance text-right">${acc.balance > 0 ? `${acc.balance.toLocaleString()}` : '-'}</td>
                    <td class="col-status text-center">${acc.result}</td>
                  </tr>
                `).join('')}
                <tr class="totals">
                  <td class="col-account"><strong>TOTALS</strong></td>
                  <td class="col-credit text-right text-green"><strong>${totals.totalCredit.toLocaleString()}</strong></td>
                  <td class="col-debit text-right text-red"><strong>${totals.totalDebit.toLocaleString()}</strong></td>
                  <td class="col-balance text-right"><strong>${totals.balance.toLocaleString()}</strong></td>
                  <td class="col-status text-center"><strong>${totals.balance >= 0 ? 'CREDIT' : 'DEBIT'}</strong></td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <p>Generated by Thirumala Group Business Management System</p>
            </div>
          </body>
        </html>
      `;
    } else {
      const plAccounts = allAccounts.filter(acc => acc.plYesNo === 'YES');
      const bsAccounts = allAccounts.filter(acc => acc.plYesNo === 'NO');

      const plTotals = {
        totalCredit: plAccounts.reduce((sum, acc) => sum + acc.credit, 0),
        totalDebit: plAccounts.reduce((sum, acc) => sum + acc.debit, 0),
        balance: plAccounts.reduce((sum, acc) => sum + acc.balance, 0),
      };

      const bsTotals = {
        totalCredit: bsAccounts.reduce((sum, acc) => sum + acc.credit, 0),
        totalDebit: bsAccounts.reduce((sum, acc) => sum + acc.debit, 0),
        balance: bsAccounts.reduce((sum, acc) => sum + acc.balance, 0),
      };

      printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Balance Sheet & Profit & Loss Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 15px; background-color: white; font-size: 12px; line-height: 1.2; }
              .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
              .header h2 { margin: 3px 0; font-size: 12px; }
              .header h3 { margin: 2px 0; font-size: 14px; }
              .header p { margin: 2px 0; font-size: 11px; }
              .section { margin-bottom: 15px; }
              .section h3 { background-color: #f0f0f0; color: #000; padding: 5px 8px; margin: 0 auto 8px auto; font-size: 14px; font-weight: bold; border: 1px solid #000; text-align: center; width: fit-content; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
              th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
              th { background-color: #f0f0f0; font-weight: bold; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .totals { background-color: #f0f0f0; font-weight: bold; }
              .footer { margin-top: 15px; text-align: center; font-size: 10px; border-top: 1px solid #000; padding-top: 5px; }
              @media print { @page { size: portrait; margin: 8mm; } body { margin: 0; padding: 10px; } .section { page-break-inside: avoid; } }
              ${getSharedPrintStyles({ isLandscape: false })}
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Trial Balance Sheet & Profit & Loss Report</h1>
              <h2>Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}</h2>
              <h3>Company: ${filters.companyName || 'All Companies'}</h3>
              <p>Period: ${dateRangeStr}</p>
            </div>

            <div class="section">
              <h3>PROFIT & LOSS</h3>
              <table>
                <thead>
                  <tr>
                    <th class="col-account">Account Name</th>
                    <th class="col-credit text-right">Credit</th>
                    <th class="col-debit text-right">Debit</th>
                    <th class="col-balance text-right">Balance</th>
                    <th class="col-status text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  ${plAccounts.map(acc => `
                    <tr>
                      <td class="col-account">${acc.accountName}</td>
                      <td class="col-credit text-right text-green">${acc.credit > 0 ? `${acc.credit.toLocaleString()}` : '-'}</td>
                      <td class="col-debit text-right text-red">${acc.debit > 0 ? `${acc.debit.toLocaleString()}` : '-'}</td>
                      <td class="col-balance text-right">${acc.balance > 0 ? `${acc.balance.toLocaleString()}` : '-'}</td>
                      <td class="col-status text-center">${acc.result}</td>
                    </tr>
                  `).join('')}
                  <tr class="totals">
                    <td class="col-account"><strong>P&L TOTALS</strong></td>
                    <td class="col-credit text-right text-green"><strong>${plTotals.totalCredit.toLocaleString()}</strong></td>
                    <td class="col-debit text-right text-red"><strong>${plTotals.totalDebit.toLocaleString()}</strong></td>
                    <td class="col-balance text-right"><strong>${plTotals.balance.toLocaleString()}</strong></td>
                    <td class="col-status text-center"><strong>${plTotals.balance >= 0 ? 'CREDIT' : 'DEBIT'}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="section">
              <h3>BALANCE SHEET</h3>
              <table>
                <thead>
                  <tr>
                    <th class="col-account">Account Name</th>
                    <th class="col-credit text-right">Credit</th>
                    <th class="col-debit text-right">Debit</th>
                    <th class="col-balance text-right">Balance</th>
                    <th class="col-status text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  ${bsAccounts.map(acc => `
                    <tr>
                      <td class="col-account">${acc.accountName}</td>
                      <td class="col-credit text-right text-green">${acc.credit > 0 ? `${acc.credit.toLocaleString()}` : '-'}</td>
                      <td class="col-debit text-right text-red">${acc.debit > 0 ? `${acc.debit.toLocaleString()}` : '-'}</td>
                      <td class="col-balance text-right">${acc.balance > 0 ? `${acc.balance.toLocaleString()}` : '-'}</td>
                      <td class="col-status text-center">${acc.result}</td>
                    </tr>
                  `).join('')}
                  <tr class="totals">
                    <td class="col-account"><strong>BALANCE SHEET TOTALS</strong></td>
                    <td class="col-credit text-right text-green"><strong>${bsTotals.totalCredit.toLocaleString()}</strong></td>
                    <td class="col-debit text-right text-red"><strong>${bsTotals.totalDebit.toLocaleString()}</strong></td>
                    <td class="col-balance text-right"><strong>${bsTotals.balance.toLocaleString()}</strong></td>
                    <td class="col-status text-center"><strong>${bsTotals.balance >= 0 ? 'CREDIT' : 'DEBIT'}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="footer">
              <p>Generated by Thirumala Group Business Management System</p>
            </div>
          </body>
        </html>
      `;
    }

    const previewWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (previewWindow) {
      previewWindow.document.write(printContent);
      previewWindow.document.close();
      previewWindow.focus();
      
      const printButton = `
        <div style="position: fixed; top: 20px; right: 20px; z-index: 9999; background: rgba(255,255,255,0.9); padding: 10px; border-radius: 8px; border: 1px solid #ccc; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" class="no-print">
          <button onclick="window.print()" style="
            background-color: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          ">🖨️ Print Report</button>
          <button onclick="window.close()" style="
            background-color: #6b7280;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            margin-left: 10px;
          ">❌ Close</button>
        </div>
      `;
      previewWindow.document.body.insertAdjacentHTML('afterbegin', printButton);
    }
    toast.success('Report preview opened! Use the Print button in the preview window to print.');
  };

  return (
    <div className='min-h-screen flex flex-col'>
      <div className='max-w-6xl w-full mx-auto space-y-6'>
        {/* Locked Book Banner */}
        {currentBook?.is_locked && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-sm flex items-center gap-3 no-print">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-red-800">This Book Is Locked (Read Only)</h3>
              <p className="text-xs text-red-700">Writing, editing, and deletion operations are disabled for this accounting period.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className='flex items-center justify-between'>
          <div>
            <div className='flex items-center gap-3 mb-1'>
              <h1 className='text-3xl font-bold text-gray-900 flex items-center gap-2.5'>
                Balance Sheet
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  currentBook?.is_locked 
                    ? 'bg-red-100 text-red-700' 
                    : tableMode === 'itr' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-blue-100 text-blue-700'
                }`}>
                  {tableMode === 'itr' ? 'ITR Mode' : 'Regular Mode'} | {currentBook?.book_code || 'No Book'}
                </span>
              </h1>
              <ModeLabel />
            </div>
            <p className='text-gray-600'>
              Generate balance sheet reports with account-wise breakdown
            </p>
          </div>
        </div>
        
        {/* Performance Status Indicator */}
        <div className={`p-3 rounded-lg border ${usingOptimizedAPI ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className='flex items-center gap-2'>
            <div className={`w-3 h-3 rounded-full ${usingOptimizedAPI ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className={`text-sm font-medium ${usingOptimizedAPI ? 'text-green-800' : 'text-yellow-800'}`}>
              {usingOptimizedAPI ? '🚀 Using Optimized Server-Side API' : '⚠️ Using Fallback Client-Side Processing'}
            </span>
            {usingOptimizedAPI && (
              <span className='text-xs text-green-600'>
                (Faster loading with server-side aggregation & caching)
              </span>
            )}
          </div>
        </div>
        {/* Responsive filter bar */}
        <div className='flex flex-col md:flex-row gap-4 items-end'>
          <div className='flex-1 w-full relative'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              From Date
            </label>
            <input
              type='text'
              placeholder='DD/MM/YYYY'
              value={fromDateInput}
              onChange={(e) => {
                setFromDateInput(e.target.value);
                const match = e.target.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                if (match) {
                  const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
                  handleFilterChange('fromDate', isoDate);
                }
              }}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold'
              style={{ fontWeight: 'bold', fontSize: '14px' }}
            />
            <button
              type='button'
              tabIndex={-1}
              onClick={() => setShowFromCalendar(!showFromCalendar)}
              className='absolute right-2 top-7 p-1 hover:bg-gray-100 rounded'
            >
              <Calendar className='w-4 h-4 text-gray-500' />
            </button>
            {showFromCalendar && (
              <CustomCalendar
                onDateSelect={(date) => {
                  handleFilterChange('fromDate', date);
                  setFromDateInput(format(new Date(date), 'dd/MM/yyyy'));
                  setShowFromCalendar(false);
                }}
                selectedDate={filters.fromDate}
                onClose={() => setShowFromCalendar(false)}
              />
            )}
          </div>
          <div className='flex-1 w-full relative'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              To Date
            </label>
            <input
              type='text'
              placeholder='DD/MM/YYYY'
              value={toDateInput}
              onChange={(e) => {
                setToDateInput(e.target.value);
                const match = e.target.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                if (match) {
                  const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
                  handleFilterChange('toDate', isoDate);
                }
              }}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold'
              style={{ fontWeight: 'bold', fontSize: '14px' }}
            />
            <button
              type='button'
              tabIndex={-1}
              onClick={() => setShowToCalendar(!showToCalendar)}
              className='absolute right-2 top-7 p-1 hover:bg-gray-100 rounded'
            >
              <Calendar className='w-4 h-4 text-gray-500' />
            </button>
            {showToCalendar && (
              <CustomCalendar
                onDateSelect={(date) => {
                  handleFilterChange('toDate', date);
                  setToDateInput(format(new Date(date), 'dd/MM/yyyy'));
                  setShowToCalendar(false);
                }}
                selectedDate={filters.toDate}
                onClose={() => setShowToCalendar(false)}
              />
            )}
          </div>
          <div className='flex-1 w-full'>
            <SearchableSelect
              label='Company'
              value={filters.companyName}
              onChange={value => handleFilterChange('companyName', value)}
              options={companies}
              placeholder='Select company...'
              className='w-full'
            />
          </div>
          <div className='flex flex-row gap-2 mt-2 md:mt-0'>
            <Button variant='secondary' onClick={refreshData}>
              Refresh
            </Button>
            <Button variant='primary' onClick={printReport}>
              Print
            </Button>
            <Button variant='secondary' onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>

        {/* Responsive table/card layout */}
        <Card className='overflow-x-auto p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'>
          {loading ? (
            <div className='text-center text-gray-500 py-8'>Loading...</div>
          ) : balanceSheetData.length === 0 ? (
            <div className='text-center text-gray-500 py-8'>
              No accounts found for these filters.
            </div>
          ) : (
            <table className='min-w-full text-sm'>
              <thead className='bg-blue-100'>
                <tr>
                  <th className='px-3 py-2 text-left'>Account Name</th>
                  <th className='px-3 py-2 text-right'>Credit</th>
                  <th className='px-3 py-2 text-right'>Debit</th>
                  <th className='px-3 py-2 text-right'>Balance</th>
                  <th className='px-3 py-2 text-center'>Result</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheetData.map((acc, idx) => (
                  <tr
                    key={acc.accountName}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}
                  >
                    <td className='px-3 py-2'>{acc.accountName}</td>
                    <td className='px-3 py-2 text-right text-green-700'>
                      {acc.credit > 0 ? `${acc.credit.toLocaleString()}` : '-'}
                    </td>
                    <td className='px-3 py-2 text-right text-red-700'>
                      {acc.debit > 0 ? `${acc.debit.toLocaleString()}` : '-'}
                    </td>
                    <td className='px-3 py-2 text-right font-semibold'>
                      {acc.balance > 0
                        ? `${acc.balance.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className='px-3 py-2 text-center font-bold'>
                      {acc.result}
                    </td>
                  </tr>
                ))}
                
                {/* Custom Rows */}
                {customRows.map((customRow, idx) => (
                  <tr key={`custom-${idx}`}>
                    <td className='px-3 py-2 font-semibold'>
                      {customRow.accountName}
                    </td>
                    <td className='px-3 py-2 text-right text-green-700'>
                      {customRow.credit > 0 ? `${customRow.credit.toLocaleString()}` : '-'}
                    </td>
                    <td className='px-3 py-2 text-right text-red-700'>
                      {customRow.debit > 0 ? `${customRow.debit.toLocaleString()}` : '-'}
                    </td>
                    <td className='px-3 py-2 text-right font-semibold'>
                      {customRow.balance > 0 ? `${customRow.balance.toLocaleString()}` : '-'}
                    </td>
                    <td className='px-3 py-2 text-center font-bold'>
                      {customRow.result}
                    </td>
                  </tr>
                ))}
                
                {/* Add Custom Row Button */}
                {/* Add Custom Row Form - Always Visible */}
                <tr className='bg-blue-50 border-2 border-blue-300'>
                  <td colSpan={5} className='px-3 py-2 text-center font-semibold text-blue-800'>
                    📝 Add Custom Row for Printing (Data not stored in database)
                  </td>
                </tr>
                <tr className='bg-blue-50 border-2 border-blue-300'>
                    <td className='px-3 py-2'>
                      <input
                        type='text'
                        value={newRowData.accountName}
                        onChange={(e) => handleNewRowDataChange('accountName', e.target.value)}
                        placeholder='Account Name'
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        disabled={currentBook?.is_locked}
                      />
                    </td>
                    <td className='px-3 py-2'>
                      <input
                        type='number'
                        value={newRowData.credit}
                        onChange={(e) => handleNewRowDataChange('credit', e.target.value)}
                        placeholder='Credit'
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        disabled={currentBook?.is_locked}
                      />
                    </td>
                    <td className='px-3 py-2'>
                      <input
                        type='number'
                        value={newRowData.debit}
                        onChange={(e) => handleNewRowDataChange('debit', e.target.value)}
                        placeholder='Debit'
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        disabled={currentBook?.is_locked}
                      />
                    </td>
                    <td className='px-3 py-2'>
                      <input
                        type='number'
                        value={newRowData.balance}
                        onChange={(e) => handleNewRowDataChange('balance', e.target.value)}
                        placeholder='Balance'
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        disabled={currentBook?.is_locked}
                      />
                    </td>
                    <td className='px-3 py-2'>
                      <select
                        value={newRowData.result}
                        onChange={(e) => handleNewRowDataChange('result', e.target.value)}
                        className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
                        disabled={currentBook?.is_locked}
                      >
                        <option value='CREDIT'>CREDIT</option>
                        <option value='DEBIT'>DEBIT</option>
                      </select>
                    </td>
                  </tr>
                
                {/* Add Row Button - Always Visible */}
                <tr className='bg-green-50 border-2 border-green-300'>
                  <td colSpan={5} className='px-3 py-2 text-center'>
                    <div className='flex gap-2 justify-center'>
                      <Button
                        variant='primary'
                        size='sm'
                        onClick={addCustomRow}
                        disabled={!newRowData.accountName.trim() || currentBook?.is_locked}
                      >
                        Add Row
                      </Button>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={() => {
                          setNewRowData({
                            accountName: '',
                            credit: '',
                            debit: '',
                            balance: '',
                            result: 'CREDIT',
                            plYesNo: 'NO',
                            bothYesNo: 'NO'
                          });
                        }}
                        disabled={currentBook?.is_locked}
                      >
                        Clear Form
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
};

export default BalanceSheet;
