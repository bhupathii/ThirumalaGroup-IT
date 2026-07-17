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
  sourceType: 'CD_LEDGER' | 'CAPITAL_ENTRY' | 'DAY_BOOK_ENTRY';
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
      
      if (cleanHead === 'CAPITAL') return 'BALANCE_SHEET';
      if (cleanHead.includes('PRINCIPAL') || cleanHead === 'CD PRINCIPAL' || cleanHead === 'HP PRINCIPAL' || cleanHead === 'STBD PRINCIPAL' || cleanHead === 'TBD PRINCIPAL') {
        return 'BALANCE_SHEET';
      }
      
      if (
        cleanHead.includes('INTEREST') || 
        cleanHead.includes('COMMISSION') || 
        cleanHead.includes('DOCUMENT CHARGES') || 
        cleanHead.includes('PENALTY') ||
        cleanHead === 'CD PENALTY' || 
        cleanHead === 'HP PENALTY' || 
        cleanHead === 'STBD PENALTY' ||
        cleanHead === 'TBD PENALTY'
      ) {
        return 'PROFIT_AND_LOSS';
      }

      const acc = accountsMap.get(cleanHead.toUpperCase()) || accountsMap.get(headName.toUpperCase());
      if (acc?.report_classification) {
        return acc.report_classification;
      }
      return 'UNCLASSIFIED';
    };

    // 2. Fetch CD Ledger Entries
    const { data: cdEntries, error: cdError } = await supabase
      .from('finance_cd_ledger_entries')
      .select('*, loan:finance_loans(loan_id), customer:finance_customers(name)')
      .neq('account_name', 'CD Amount Paid')
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate);

    if (cdError) console.error('Error fetching CD ledger entries for Daily Report:', cdError);
    console.log(`[DAILY REPORT DEBUG] CD raw rows fetched: ${cdEntries?.length || 0}`);

    // 3. Fetch Capital Entries
    const { data: capEntries, error: capError } = await supabase
      .from('finance_capital_entries')
      .select('*, partner:finance_partners(*)')
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate);

    if (capError) console.error('Error fetching capital entries for Daily Report:', capError);
    console.log(`[DAILY REPORT DEBUG] Capital raw rows fetched: ${capEntries?.length || 0}`);

    // 4. Fetch Day Book Entries (cashbook entries) - only APPROVED ones
    const { data: bookData } = await supabase
      .from('finance_books')
      .select('id')
      .eq('book_code', financeMode === 'ITR' ? 'ITR-LEGACY' : 'REG-LEGACY')
      .maybeSingle();

    let cbQuery = supabase
      .from('finance_cashbook_entries')
      .select('*')
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate);

    if (bookData?.id) {
      cbQuery = cbQuery.eq('book_id', bookData.id);
    }

    const { data: cbEntries, error: cbError } = await cbQuery;

    if (cbError) console.error('Error fetching cashbook entries for Daily Report:', cbError);
    console.log(`[DAILY REPORT DEBUG] Cashbook raw rows fetched: ${cbEntries?.length || 0}`);

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
          category: 'CD'
        });
      });
    }

    // Process Capital entries
    if (capEntries) {
      capEntries.forEach((cap: any) => {
        normalizedList.push({
          id: `CAPITAL_ENTRY:${cap.id}`,
          sourceType: 'CAPITAL_ENTRY',
          sourceRecordId: cap.id,
          transactionDate: cap.entry_date,
          headOfAccount: 'CAPITAL',
          particulars: cap.particulars || 'Capital Entry',
          accountOrLoanNo: cap.partner?.name || cap.partner_name || 'Partner',
          debit: Number(cap.debit) || 0,
          credit: Number(cap.credit) || 0,
          userName: cap.created_by || 'Staff',
          entryTime: cap.created_at,
          createdAt: cap.created_at,
          reportClassification: getClassification('CAPITAL'),
          partnerId: cap.partner_id || null,
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
      const { data: cdData } = await supabase
        .from('finance_cd_ledger_entries')
        .select('entry_date')
        .neq('account_name', 'CD Amount Paid')
        .gte('entry_date', startStr)
        .lte('entry_date', endFormatted);

      const { data: capData } = await supabase
        .from('finance_capital_entries')
        .select('entry_date')
        .gte('entry_date', startStr)
        .lte('entry_date', endFormatted);

      const { data: bookData } = await supabase
        .from('finance_books')
        .select('id')
        .eq('book_code', financeMode === 'ITR' ? 'ITR-LEGACY' : 'REG-LEGACY')
        .maybeSingle();

      let cbData: any[] = [];
      if (bookData?.id) {
        const { data: fetchedCb } = await supabase
          .from('finance_cashbook_entries')
          .select('entry_date')
          .eq('book_id', bookData.id)
          .gte('entry_date', startStr)
          .lte('entry_date', endFormatted);
        cbData = fetchedCb || [];
      }

      const datesSet = new Set<string>();
      
      const addDate = (d: any) => {
        if (typeof d === 'string') {
          const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
          if (match) {
            datesSet.add(match[1]);
          }
        }
      };

      cdData?.forEach(r => addDate(r.entry_date));
      capData?.forEach(r => addDate(r.entry_date));
      cbData?.forEach(r => addDate(r.entry_date));

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
    const compOp = isPrev ? 'lt' : 'gt';
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
      const { data: cdData } = await supabase
        .from('finance_cd_ledger_entries')
        .select('entry_date')
        .neq('account_name', 'CD Amount Paid')
        .order('entry_date', { ascending: true })
        .limit(1);

      const { data: capData } = await supabase
        .from('finance_capital_entries')
        .select('entry_date')
        .order('entry_date', { ascending: true })
        .limit(1);

      const { data: cbData } = await supabase
        .from('finance_cashbook_entries')
        .select('entry_date')
        .order('entry_date', { ascending: true })
        .limit(1);

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

      if (dates.length === 0) return '2020-01-01'; // safety fallback
      dates.sort();
      return dates[0];
    } catch (e) {
      console.error('Error getting oldest transaction date:', e);
      return '2020-01-01';
    }
  }
};
