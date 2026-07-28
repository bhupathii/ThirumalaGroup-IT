import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'finance' }
});

async function runAudit() {
  console.log('====================================================');
  console.log('FORENSIC P&L AUDIT - ACCOUNT HEADS & DATABASE SOURCE');
  console.log('====================================================\n');

  // 1. Fetch cashbook_accounts
  const { data: accounts, error: accErr } = await supabase
    .from('cashbook_accounts')
    .select('*');
  
  if (accErr) console.error('Error fetching cashbook accounts:', accErr);
  else {
    console.log(`Found ${accounts?.length || 0} Cashbook Accounts in master:`);
    accounts?.forEach(a => {
      console.log(` - Head: "${a.account_name}" | Class: ${a.report_classification || 'N/A'} | Category: ${a.category || 'N/A'} | Type: ${a.account_type || 'N/A'}`);
    });
  }

  console.log('\n----------------------------------------------------');
  console.log('2. DISTINCT HEADS IN CD LEDGER ENTRIES');
  console.log('----------------------------------------------------');
  const { data: cdEntries, error: cdErr } = await supabase
    .from('cd_ledger_entries')
    .select('account_name, entry_type, credit, debit');
  
  if (cdErr) console.error('Error fetching cd_ledger_entries:', cdErr);
  else {
    const cdHeadsMap = new Map();
    cdEntries?.forEach(e => {
      const name = e.account_name || 'UNNAMED';
      const stats = cdHeadsMap.get(name) || { count: 0, credit: 0, debit: 0 };
      stats.count++;
      stats.credit += Number(e.credit || 0);
      stats.debit += Number(e.debit || 0);
      cdHeadsMap.set(name, stats);
    });
    for (const [name, stats] of cdHeadsMap.entries()) {
      console.log(` - "${name}": Count=${stats.count}, Total Credit=${stats.credit.toLocaleString('en-IN')}, Total Debit=${stats.debit.toLocaleString('en-IN')}`);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log('3. DISTINCT HEADS IN CASHBOOK ENTRIES');
  console.log('----------------------------------------------------');
  const { data: cbEntries, error: cbErr } = await supabase
    .from('cashbook_entries')
    .select('head_of_account, credit, debit');

  if (cbErr) console.error('Error fetching cashbook_entries:', cbErr);
  else {
    const cbHeadsMap = new Map();
    cbEntries?.forEach(e => {
      const name = e.head_of_account || 'UNNAMED';
      const stats = cbHeadsMap.get(name) || { count: 0, credit: 0, debit: 0 };
      stats.count++;
      stats.credit += Number(e.credit || 0);
      stats.debit += Number(e.debit || 0);
      cbHeadsMap.set(name, stats);
    });
    for (const [name, stats] of cbHeadsMap.entries()) {
      console.log(` - "${name}": Count=${stats.count}, Total Credit=${stats.credit.toLocaleString('en-IN')}, Total Debit=${stats.debit.toLocaleString('en-IN')}`);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log('4. DISTINCT TYPES IN LOAN TRANSACTIONS');
  console.log('----------------------------------------------------');
  const { data: ltEntries, error: ltErr } = await supabase
    .from('loan_transactions')
    .select('type, amount');

  if (ltErr) console.error('Error fetching loan_transactions:', ltErr);
  else {
    const ltTypesMap = new Map();
    ltEntries?.forEach(e => {
      const type = e.type || 'UNNAMED';
      const stats = ltTypesMap.get(type) || { count: 0, total: 0 };
      stats.count++;
      stats.total += Number(e.amount || 0);
      ltTypesMap.set(type, stats);
    });
    for (const [type, stats] of ltTypesMap.entries()) {
      console.log(` - "${type}": Count=${stats.count}, Total Amount=${stats.total.toLocaleString('en-IN')}`);
    }
  }

  console.log('\n====================================================');
  console.log('AUDIT COMPLETE');
  console.log('====================================================');
}

runAudit().catch(console.error);
