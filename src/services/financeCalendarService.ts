import { supabase } from '../lib/supabaseDatabase';
import { dailyFinancialTransactionService } from './dailyFinancialTransactionService';

export type FinanceModuleKey =
  | 'DAY_BOOK'
  | 'CASH_BOOK'
  | 'CD_LEDGER'
  | 'HP_LEDGER'
  | 'STBD_LEDGER'
  | 'TBD_LEDGER'
  | 'GENERAL_LEDGER'
  | 'DETAILED_LEDGER'
  | 'DUES_LIST'
  | 'CALL_HISTORY'
  | 'PAYMENT_FOLLOWUP'
  | 'TRANSACTION_APPROVAL'
  | 'EDIT_DELETE_LOGS'
  | 'PARTNER_PERFORMANCE'
  | 'BUSINESS_DETAILS'
  | 'PROFIT_LOSS'
  | 'FINAL_STATEMENT';

// Simple in-memory cache per module + year + month
const eventCache = new Map<string, Set<string>>();

export const getFinanceModuleEventDates = async (
  moduleKey: FinanceModuleKey,
  year: number,
  month: number
): Promise<Set<string>> => {
  const monthStr = String(month).padStart(2, '0');
  const cacheKey = `${moduleKey}_${year}_${monthStr}`;
  
  if (eventCache.has(cacheKey)) {
    return eventCache.get(cacheKey)!;
  }

  const startDate = `${year}-${monthStr}-01`;
  const lastDayNum = new Date(year, month, 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDayNum).padStart(2, '0')}`;

  const dates = new Set<string>();

  const extractAndAddDate = (val: any) => {
    if (!val) return;
    if (typeof val === 'string') {
      const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) {
        dates.add(match[1]);
      }
    } else if (val instanceof Date) {
      dates.add(val.toISOString().split('T')[0]);
    }
  };

  try {
    switch (moduleKey) {
      case 'DAY_BOOK':
      case 'CASH_BOOK': {
        const activeDates = await dailyFinancialTransactionService.getDailyReportActivityDates({
          month,
          year,
          financeMode: 'REGULAR'
        });
        activeDates.forEach(r => extractAndAddDate(r.c_date));
        break;
      }

      case 'CD_LEDGER':
      case 'HP_LEDGER':
      case 'STBD_LEDGER':
      case 'TBD_LEDGER': {
        const financeTypeMap: Record<string, string> = {
          CD_LEDGER: 'CD',
          HP_LEDGER: 'HP',
          STBD_LEDGER: 'STBD',
          TBD_LEDGER: 'TBD'
        };
        const fType = financeTypeMap[moduleKey] || 'CD';

        // 1. Loans start dates
        const { data: loanData } = await supabase
          .from('finance_loans')
          .select('start_date')
          .eq('finance_type', fType)
          .gte('start_date', startDate)
          .lte('start_date', endDate);
        (loanData || []).forEach(row => extractAndAddDate(row.start_date));

        // 2. Transaction review dates
        const { data: revData } = await supabase
          .from('finance_transaction_reviews')
          .select('transaction_date')
          .eq('finance_type', fType)
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);
        (revData || []).forEach(row => extractAndAddDate(row.transaction_date));
        break;
      }

      case 'GENERAL_LEDGER': {
        const { data: cbData } = await supabase
          .from('finance_cashbook_entries')
          .select('entry_date')
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);
        (cbData || []).forEach(row => extractAndAddDate(row.entry_date));

        const { data: revData } = await supabase
          .from('finance_transaction_reviews')
          .select('transaction_date')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);
        (revData || []).forEach(row => extractAndAddDate(row.transaction_date));
        break;
      }

      case 'DETAILED_LEDGER': {
        const { data: revData } = await supabase
          .from('finance_transaction_reviews')
          .select('transaction_date')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);
        (revData || []).forEach(row => extractAndAddDate(row.transaction_date));
        break;
      }

      case 'DUES_LIST': {
        // Only actual loan installment due dates
        const { data: loanData } = await supabase
          .from('finance_loans')
          .select('due_date, next_due_date')
          .or(`due_date.gte.${startDate},next_due_date.gte.${startDate}`)
          .or(`due_date.lte.${endDate},next_due_date.lte.${endDate}`);

        (loanData || []).forEach(row => {
          extractAndAddDate(row.due_date);
          extractAndAddDate(row.next_due_date);
        });
        break;
      }

      case 'CALL_HISTORY': {
        const { data } = await supabase
          .from('finance_call_history')
          .select('call_date, created_at')
          .gte('call_date', startDate)
          .lte('call_date', endDate);
        (data || []).forEach(row => {
          extractAndAddDate(row.call_date);
          extractAndAddDate(row.created_at);
        });
        break;
      }

      case 'PAYMENT_FOLLOWUP': {
        const { data } = await supabase
          .from('finance_payment_followups')
          .select('scheduled_date, next_followup_date')
          .gte('scheduled_date', startDate)
          .lte('scheduled_date', endDate);
        (data || []).forEach(row => {
          extractAndAddDate(row.scheduled_date);
          extractAndAddDate(row.next_followup_date);
        });
        break;
      }

      case 'TRANSACTION_APPROVAL': {
        const { data } = await supabase
          .from('finance_transaction_reviews')
          .select('transaction_date, created_at')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);
        (data || []).forEach(row => {
          extractAndAddDate(row.transaction_date);
          extractAndAddDate(row.created_at);
        });
        break;
      }

      case 'EDIT_DELETE_LOGS': {
        const { data } = await supabase
          .from('finance_audit_logs')
          .select('created_at')
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        (data || []).forEach(row => extractAndAddDate(row.created_at));
        break;
      }

      case 'PARTNER_PERFORMANCE': {
        const { data } = await supabase
          .from('finance_partner_transactions')
          .select('entry_date')
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);
        (data || []).forEach(row => extractAndAddDate(row.entry_date));
        break;
      }

      case 'BUSINESS_DETAILS': {
        const { data } = await supabase
          .from('finance_cashbook_entries')
          .select('entry_date')
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);
        (data || []).forEach(row => extractAndAddDate(row.entry_date));
        break;
      }

      case 'PROFIT_LOSS':
      case 'FINAL_STATEMENT': {
        // Only approved / posted accounting entries
        const { data } = await supabase
          .from('finance_cashbook_entries')
          .select('entry_date')
          .eq('status', 'APPROVED')
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);
        (data || []).forEach(row => extractAndAddDate(row.entry_date));
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Error fetching event dates for ${moduleKey}:`, err);
  }

  eventCache.set(cacheKey, dates);
  return dates;
};

export const clearFinanceCalendarCache = () => {
  eventCache.clear();
};

export const getAdjacentTransactionDate = async (
  currentDate: string,
  direction: 'prev' | 'next',
  financeMode: 'REGULAR' | 'ITR' = 'REGULAR'
): Promise<string | null> => {
  return dailyFinancialTransactionService.getNearestTransactionDate({
    currentDate,
    direction,
    financeMode
  });
};

