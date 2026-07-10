import { supabase } from '../lib/supabaseDatabase';

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
      if (headName === 'CAPITAL') return 'BALANCE_SHEET';
      if (headName === 'CD PRINCIPAL') return 'BALANCE_SHEET';
      if (headName === 'CD INTEREST' || headName === 'CD DOCUMENT CHARGES' || headName === 'CD PENALTY') {
        return 'PROFIT_AND_LOSS';
      }
      const acc = accountsMap.get(headName.toUpperCase());
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
      .eq('status', 'APPROVED')
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

        normalizedList.push({
          id: `CD_LEDGER:${entry.id}`,
          sourceType: 'CD_LEDGER',
          sourceRecordId: entry.id,
          transactionDate: entry.entry_date,
          headOfAccount: head,
          particulars: entry.particulars || '',
          receiptOrVoucherNo: entry.receipt_no || null,
          accountOrLoanNo: entry.loan?.loan_id || 'CD',
          debit: Number(entry.debit) || 0,
          credit: Number(entry.credit) || 0,
          userName: entry.user_name || 'Staff',
          entryTime: entry.created_at,
          createdAt: entry.created_at,
          reportClassification: getClassification(head),
          customerName: entry.customer?.name || null
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
          reportClassification: getClassification('CAPITAL')
        });
      });
    }

    // Process Day Book entries
    if (cbEntries) {
      cbEntries.forEach((cb: any) => {
        normalizedList.push({
          id: `DAY_BOOK_ENTRY:${cb.id}`,
          sourceType: 'DAY_BOOK_ENTRY',
          sourceRecordId: cb.id,
          transactionDate: cb.entry_date,
          headOfAccount: cb.head_of_account,
          particulars: cb.particulars || '',
          accountOrLoanNo: cb.account_number || '—',
          debit: Number(cb.debit) || 0,
          credit: Number(cb.credit) || 0,
          userName: cb.created_by || 'Staff',
          entryTime: cb.created_at,
          createdAt: cb.created_at,
          reportClassification: getClassification(cb.head_of_account)
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
          .eq('status', 'APPROVED')
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
  }
};
