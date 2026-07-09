import { createServer } from 'vite';

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

async function audit() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  try {
    const { supabase } = await vite.ssrLoadModule('/src/lib/supabaseDatabase.ts');
    
    console.log("=== 1. IDENTIFY CD127 ===");
    // Find customer & loan
    const { data: loans, error: loansErr } = await supabase
      .from('finance_loans')
      .select('*')
      .or('loan_id.ilike.%127%,loan_id.ilike.%CD127%');
      
    if (loansErr) console.error("Error fetching loans:", loansErr);
    console.log("Loans matched:", JSON.stringify(loans, null, 2));
    
    if (loans && loans.length > 0) {
      const loan = loans[0];
      const loanId = loan.id;
      
      // Let's get customer name
      if (loan.customer_id) {
        const { data: customer, error: custErr } = await supabase
          .from('finance_customers')
          .select('*')
          .eq('id', loan.customer_id)
          .single();
        if (custErr) console.error("Error fetching customer:", custErr);
        else console.log("Customer name:", customer.name);
      }
      
      console.log("\n=== 2. DUMP RAW TRANSACTION TIMELINE ===");
      const { data: txs, error: txsErr } = await supabase
        .from('finance_loan_transactions')
        .select('*')
        .eq('loan_id', loanId)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      
      if (txsErr) console.error("Error fetching transactions:", txsErr);
      else console.log("Transactions:", JSON.stringify(txs, null, 2));
      
      console.log("\n=== 3. DUMP CURRENT LEDGER STATE ===");
      const { data: ledger, error: ledgerErr } = await supabase
        .from('finance_cd_ledger_entries')
        .select('*')
        .eq('loan_id', loanId)
        .order('entry_date', { ascending: true })
        .order('id', { ascending: true });
        
      if (ledgerErr) console.error("Error fetching ledger entries:", ledgerErr);
      else console.log("Ledger entries count:", ledger.length);
      
      const { data: interest, error: interestErr } = await supabase
        .from('finance_cd_interest_details')
        .select('*')
        .eq('loan_id', loanId)
        .order('entry_date', { ascending: true })
        .order('id', { ascending: true });
        
      if (interestErr) console.error("Error fetching interest details:", interestErr);
      else console.log("Interest details count:", interest.length);
      
      console.log("Ledger rows:", JSON.stringify(ledger, null, 2));
      console.log("Interest rows:", JSON.stringify(interest, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    vite.close();
  }
}

audit();
