import { supabase } from '../lib/supabaseDatabase';

export const normalizeHeadOfAccount = (name: string): string => {
  const clean = (name || '').trim().toUpperCase();
  if (clean === 'CD COMMISSION A/C' || clean === 'CD COMMISSION' || clean === 'CD INTEREST' || clean === 'CD INTEREST A/C') {
    return 'CD INTEREST';
  }
  if (clean === 'HP COMMISSION A/C' || clean === 'HP COMMISSION' || clean === 'HP INTEREST' || clean === 'HP INTEREST A/C') {
    return 'HP INTEREST';
  }
  if (clean === 'STBD COMMISSION A/C' || clean === 'STBD COMMISSION' || clean === 'STBD INTEREST' || clean === 'STBD INTEREST A/C') {
    return 'STBD INTEREST';
  }
  if (clean === 'COMMISSION A/C' || clean === 'COMMISSION') {
    return 'TBD INTEREST';
  }
  if (clean === 'CD A/C' || clean === 'CD PRINCIPAL') {
    return 'CD PRINCIPAL';
  }
  if (clean === 'HP A/C' || clean === 'HP PRINCIPAL') {
    return 'HP PRINCIPAL';
  }
  if (clean === 'STBD A/C' || clean === 'STBD PRINCIPAL') {
    return 'STBD PRINCIPAL';
  }
  if (clean === 'TBD A/C' || clean === 'TBD PRINCIPAL') {
    return 'TBD PRINCIPAL';
  }
  if (clean === 'CD DOCUMENT CHARGES A/C' || clean === 'CD DOCUMENT CHARGES') {
    return 'CD DOCUMENT CHARGES';
  }
  if (clean === 'PENALTY A/C' || clean === 'CD PENALTY' || clean === 'PENALTY CD A/C') {
    return 'CD PENALTY';
  }
  if (clean === 'HP PENALTY A/C' || clean === 'HP PENALTY') {
    return 'HP PENALTY';
  }
  if (clean === 'STBD PENALTY A/C' || clean === 'STBD PENALTY') {
    return 'STBD PENALTY';
  }
  return clean;
};

export interface DailyFinancialTransaction {
  id: string;
  sourceType: 'CD_LEDGER' | 'CAPITAL_ENTRY' | 'DAY_BOOK_ENTRY' | 'LOAN_TRANSACTION';
  sourceRecordId: string;
  transactionDate: string;
  headOfAccountId?: string | null;
  headOfAccount: string;
  particulars: string;
  receiptOrVoucherNo?: string | null;
  accountOrLoanNo?: string | null;
  debit: number;
  credit: number;
  userId?: string | null;
  userName?: string | null;
  entryTime?: string | null;
  createdAt?: string | null;
  reportClassification: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS' | 'UNCLASSIFIED';
  customerName?: string | null;
  partnerId?: string | null;
  category?: string | null;
  loanCategory?: string | null;
  partnerName?: string | null;
}

export const dailyFinancialTransactionService = {
  async getDailyFinancialTransactions(params: {
    fromDate: string;
    toDate: string;
    financeMode: 'REGULAR' | 'ITR';
  }): Promise<DailyFinancialTransaction[]> {
    const { fromDate, toDate, financeMode } = params;

    console.log(`[DAILY REPORT DEBUG] Fetching for ${fromDate} to ${toDate}, mode: ${financeMode}`);

    // 1. Fetch Head of Accounts for classification mapping
    const { data: accountsData } = await supabase
      .from('finance_cashbook_accounts')
      .select('*');

    const accountsMap = new Map<string, any>();
    if (accountsData) {
      accountsData.forEach(acc => {
        accountsMap.set(acc.account_name.toUpperCase(), acc);
      });
    }

    const getClassification = (headName: string): 'BALANCE_SHEET' | 'PROFIT_AND_LOSS' | 'UNCLASSIFIED' => {
      const cleanHead = normalizeHeadOfAccount(headName);
      const upper = cleanHead.toUpperCase();
      
      if (upper === 'CAPITAL' || upper.startsWith('CAPITAL')) return 'BALANCE_SHEET';
      if (
        upper.includes('PRINCIPAL') || 
        upper === 'CD PRINCIPAL' || 
        upper === 'HP PRINCIPAL' || 
        upper === 'STBD PRINCIPAL' || 
        upper === 'TBD PRINCIPAL' ||
        upper.startsWith('BANK') ||
        upper.endsWith('BANK')
      ) {
        return 'BALANCE_SHEET';
      }
      
      if (
        upper.includes('INTEREST') || 
        upper.includes('COMMISSION') || 
        upper.includes('DOCUMENT CHARGES') || 
        upper.includes('PENALTY') ||
        upper.includes('SALARY') ||
        upper.includes('RENT') ||
        upper.includes('ELECTRICITY') ||
        upper.includes('STATIONERY') ||
        upper.includes('PRINTING') ||
        upper.includes('FUEL') ||
        upper.includes('TEA') ||
        upper.includes('EXPENSE') ||
        upper.includes('REPAIR') ||
        upper.includes('MAINTENANCE') ||
        upper.includes('DISCOUNT') ||
        upper.includes('CHARGES')
      ) {
        return 'PROFIT_AND_LOSS';
      }

      const acc = accountsMap.get(upper) || accountsMap.get(headName.toUpperCase());
      if (acc?.report_classification) {
        return acc.report_classification;
      }
      return 'PROFIT_AND_LOSS';
    };

    // Helper for fetching all pages to avoid Supabase default 1000-row limit truncation
    const fetchAllPages = async (queryFactory: (from: number, to: number) => any): Promise<any[]> => {
      let allRows: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await queryFactory(from, to);
        if (error) {
          console.error('Error in fetchAllPages:', error);
          break;
        }
        if (data && data.length > 0) {
          allRows.push(...data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      return allRows;
    };

    // 2. Fetch CD Ledger Entries (Paginated)
    const cdEntries = await fetchAllPages((from, to) =>
      supabase
        .from('finance_cd_ledger_entries')
        .select('*, loan:finance_loans(loan_id, loan_category, partner_name), customer:finance_customers(name)')
        .neq('account_name', 'CD Amount Paid')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .range(from, to)
    );

    // Track CD receipt numbers to deduplicate loan_transactions
    const cdReceiptSet = new Set<string>();
    cdEntries.forEach(e => {
      if (e.receipt_no) cdReceiptSet.add(e.receipt_no);
    });

    console.log(`[DAILY REPORT DEBUG] CD raw rows fetched: ${cdEntries.length}`);

    // 3. Fetch Loan Transactions (Paginated - for non-CD or non-overlapping transactions)
    const ltEntries = await fetchAllPages((from, to) =>
      supabase
        .from('finance_transactions')
        .select('*, loan:finance_loans(loan_id, loan_category, customer:finance_customers(name))')
        .gte('date', fromDate)
        .lte('date', toDate)
        .range(from, to)
    );

    console.log(`[DAILY REPORT DEBUG] Loan transactions raw rows fetched: ${ltEntries.length}`);

    // 4. Fetch Capital Entries (Paginated)
    const capEntries = await fetchAllPages((from, to) =>
      supabase
        .from('finance_capital_entries')
        .select('*, partner:finance_partners(*)')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .range(from, to)
    );

    console.log(`[DAILY REPORT DEBUG] Capital raw rows fetched: ${capEntries.length}`);

    // 5. Fetch Day Book Entries (cashbook entries - Paginated)
    const { data: bookData } = await supabase
      .from('finance_books')
      .select('id')
      .eq('book_code', financeMode === 'ITR' ? 'ITR-LEGACY' : 'REG-LEGACY')
      .maybeSingle();

    const cbEntries = await fetchAllPages((from, to) => {
      let cbQuery = supabase
        .from('finance_cashbook_entries')
        .select('*')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate);

      if (bookData?.id) {
        cbQuery = cbQuery.or(`book_id.eq.${bookData.id},book_id.is.null`);
      }

      return cbQuery.range(from, to);
    });

    console.log(`[DAILY REPORT DEBUG] Cashbook raw rows fetched: ${cbEntries.length}`);

    const normalizedList: DailyFinancialTransaction[] = [];

    // Process CD ledger entries
    if (cdEntries) {
      cdEntries.forEach((entry: any) => {
        let head = entry.account_name || 'CD A/C';
        if (head === 'CD COMMISSION A/C') head = 'CD INTEREST';
        else if (head === 'CD A/C') head = 'CD PRINCIPAL';
        else if (head === 'CD DOCUMENT CHARGES A/C') head = 'CD DOCUMENT CHARGES';
        else if (head === 'PENALTY A/C') head = 'CD PENALTY';

        const normHead = normalizeHeadOfAccount(head);

        normalizedList.push({
          id: `CD_LEDGER:${entry.id}`,
          sourceType: 'CD_LEDGER',
          sourceRecordId: entry.id,
          transactionDate: entry.entry_date,
          headOfAccount: normHead,
          particulars: entry.particulars || '',
          receiptOrVoucherNo: entry.receipt_no || null,
          accountOrLoanNo: entry.loan?.loan_id || 'CD',
          debit: Number(entry.debit) || 0,
          credit: Number(entry.credit) || 0,
          userName: entry.user_name || 'Staff',
          entryTime: entry.created_at,
          createdAt: entry.created_at,
          reportClassification: getClassification(normHead),
          customerName: entry.customer?.name || null,
          partnerName: entry.loan?.partner_name || null,
          category: 'CD',
          loanCategory: entry.loan?.loan_category || 'CD'
        });
      });
    }

    // Process Loan transactions (excluding rows already represented in CD ledger entries)
    if (ltEntries) {
      ltEntries.forEach((lt: any) => {
        // Skip if this receipt number was already processed in cdEntries
        if (lt.receipt_no && cdReceiptSet.has(lt.receipt_no)) {
          return;
        }

        const lCat = lt.loan?.loan_category || 'LOAN';
        const isDisb = lt.type === 'Disbursement';
        const amt = Number(lt.amount) || 0;
        const head = isDisb ? `${lCat} DISBURSEMENT` : `${lCat} COLLECTION`;
        const normHead = normalizeHeadOfAccount(head);

        normalizedList.push({
          id: `LOAN_TRANSACTION:${lt.id}`,
          sourceType: 'LOAN_TRANSACTION',
          sourceRecordId: lt.id,
          transactionDate: lt.date,
          headOfAccount: normHead,
          particulars: lt.remarks || `${isDisb ? 'Loan Disbursed' : 'Loan Collection'} - ${lt.loan?.loan_id || ''}`,
          receiptOrVoucherNo: lt.receipt_no || null,
          accountOrLoanNo: lt.loan?.loan_id || 'LOAN',
          debit: isDisb ? amt : 0,
          credit: isDisb ? 0 : amt,
          userName: lt.collected_by || 'Staff',
          entryTime: lt.created_at,
          createdAt: lt.created_at,
          reportClassification: getClassification(normHead),
          customerName: lt.loan?.customer?.name || null,
          category: lCat,
          loanCategory: lCat
        });
      });
    }

    // Process Capital entries
    if (capEntries) {
      capEntries.forEach((cap: any) => {
        const pName = cap.partner?.name || cap.partner_name || 'Partner';
        normalizedList.push({
          id: `CAPITAL_ENTRY:${cap.id}`,
          sourceType: 'CAPITAL_ENTRY',
          sourceRecordId: cap.id,
          transactionDate: cap.entry_date,
          headOfAccount: 'CAPITAL',
          particulars: cap.particulars || 'Capital Entry',
          receiptOrVoucherNo: null,
          accountOrLoanNo: pName,
          debit: Number(cap.debit) || 0,
          credit: Number(cap.credit) || 0,
          userName: cap.created_by || 'Staff',
          entryTime: cap.created_at,
          createdAt: cap.created_at,
          reportClassification: getClassification('CAPITAL'),
          partnerId: cap.partner_id || null,
          partnerName: pName,
          category: 'CAPITAL'
        });
      });
    }

    // Process Day Book entries
    if (cbEntries) {
      cbEntries.forEach((cb: any) => {
        const head = cb.head_of_account;
        const normHead = normalizeHeadOfAccount(head);
        
        let cat: string = 'OTHER';
        const acc = accountsMap.get(normHead.toUpperCase()) || accountsMap.get(head.toUpperCase());
        if (acc?.category) {
          cat = acc.category;
        } else {
          if (normHead.toUpperCase().includes('BANK')) cat = 'BANK';
          else if (normHead.toUpperCase().includes('SALARY')) cat = 'SALARY';
          else if (getClassification(normHead) === 'PROFIT_AND_LOSS' && Number(cb.debit) > 0) cat = 'EXPENSE';
        }

        normalizedList.push({
          id: `DAY_BOOK_ENTRY:${cb.id}`,
          sourceType: 'DAY_BOOK_ENTRY',
          sourceRecordId: cb.id,
          transactionDate: cb.entry_date,
          headOfAccount: normHead,
          particulars: cb.particulars || '',
          receiptOrVoucherNo: null,
          accountOrLoanNo: cb.account_number || '—',
          debit: Number(cb.debit) || 0,
          credit: Number(cb.credit) || 0,
          userName: cb.created_by || 'Staff',
          entryTime: cb.created_at,
          createdAt: cb.created_at,
          reportClassification: getClassification(normHead),
          category: cat
        });
      });
    }

    // Deduplicate by stable ID (sourceType + sourceRecordId)
    const uniqueMap = new Map<string, DailyFinancialTransaction>();
    normalizedList.forEach(item => {
      uniqueMap.set(item.id, item);
    });

    const result = Array.from(uniqueMap.values()).sort((a, b) => {
      if (a.transactionDate !== b.transactionDate) {
        return a.transactionDate.localeCompare(b.transactionDate);
      }
      const aTime = a.entryTime || '';
      const bTime = b.entryTime || '';
      if (aTime !== bTime) {
        return aTime.localeCompare(bTime);
      }
      return a.id.localeCompare(b.id);
    });

    console.log(`[DAILY REPORT DEBUG] Mapped & Deduplicated final rows: ${result.length}`);
    return result;
  },

  async getDailyReportActivityDates(params: {
    month: number;
    year: number;
    financeMode: 'REGULAR' | 'ITR';
  }): Promise<{ c_date: string }[]> {
    const { month, year, financeMode } = params;
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endFormatted = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const monthTransactions = await this.getDailyFinancialTransactions({
        fromDate: startStr,
        toDate: endFormatted,
        financeMode
      });

      const datesSet = new Set<string>();
      monthTransactions.forEach(tx => {
        if (tx.transactionDate) {
          datesSet.add(tx.transactionDate);
        }
      });

      return Array.from(datesSet).map(d => ({ c_date: d }));
    } catch (error) {
      console.error('Error fetching daily report activity dates:', error);
      return [];
    }
  },

  async getNearestTransactionDate(params: {
    currentDate: string;
    direction: 'prev' | 'next';
    financeMode: 'REGULAR' | 'ITR';
  }): Promise<string | null> {
    const { currentDate, direction, financeMode } = params;
    const isPrev = direction === 'prev';
    const orderOptions = { ascending: !isPrev };

    try {
      // 1. Fetch nearest from CD ledger entries
      let cdQuery = supabase
        .from('finance_cd_ledger_entries')
        .select('entry_date')
        .neq('account_name', 'CD Amount Paid');
      if (isPrev) {
        cdQuery = cdQuery.lt('entry_date', currentDate);
      } else {
        cdQuery = cdQuery.gt('entry_date', currentDate);
      }
      const { data: cdData } = await cdQuery
        .order('entry_date', orderOptions)
        .limit(1);

      // 2. Fetch nearest from Capital entries
      let capQuery = supabase
        .from('finance_capital_entries')
        .select('entry_date');
      if (isPrev) {
        capQuery = capQuery.lt('entry_date', currentDate);
      } else {
        capQuery = capQuery.gt('entry_date', currentDate);
      }
      const { data: capData } = await capQuery
        .order('entry_date', orderOptions)
        .limit(1);

      // 3. Fetch nearest from Cashbook entries
      const { data: bookData } = await supabase
        .from('finance_books')
        .select('id')
        .eq('book_code', financeMode === 'ITR' ? 'ITR-LEGACY' : 'REG-LEGACY')
        .maybeSingle();

      let cbData: any[] = [];
      if (bookData?.id) {
        let cbQuery = supabase
          .from('finance_cashbook_entries')
          .select('entry_date')
          .eq('book_id', bookData.id);
        if (isPrev) {
          cbQuery = cbQuery.lt('entry_date', currentDate);
        } else {
          cbQuery = cbQuery.gt('entry_date', currentDate);
        }
        const { data: fetchedCb } = await cbQuery
          .order('entry_date', orderOptions)
          .limit(1);
        cbData = fetchedCb || [];
      }

      const dates: string[] = [];
      const extractDate = (val: any) => {
        if (typeof val === 'string') {
          const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
          if (match) dates.push(match[1]);
        }
      };

      if (cdData?.[0]) extractDate(cdData[0].entry_date);
      if (capData?.[0]) extractDate(capData[0].entry_date);
      if (cbData?.[0]) extractDate(cbData[0].entry_date);

      if (dates.length === 0) return null;

      // Sort dates
      dates.sort();
      if (isPrev) {
        // Nearest previous date is the largest of dates < currentDate
        return dates[dates.length - 1];
      } else {
        // Nearest future date is the smallest of dates > currentDate
        return dates[0];
      }
    } catch (err) {
      console.error('Error fetching nearest transaction date:', err);
      return null;
    }
  },

  async getOldestTransactionDate(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('finance_loans')
        .select('date')
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching oldest loan date:', error);
        return '2020-01-01';
      }

      return (data as any)?.date ? (data as any).date.split('T')[0] : '2020-01-01';
    } catch (e) {
      console.error('Error getting oldest transaction date:', e);
      return '2020-01-01';
    }
  }
};
