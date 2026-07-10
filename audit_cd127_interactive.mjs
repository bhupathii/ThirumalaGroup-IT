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
    
    // Find CD127 loan
    const { data: loans } = await supabase
      .from('finance_loans')
      .select('*')
      .eq('loan_id', 'CD127');
      
    if (!loans || loans.length === 0) {
      console.log("CD127 loan not found.");
      return;
    }
    
    const loan = loans[0];
    const loanId = loan.id;
    console.log("CD127 Loan ID:", loanId);

    // Fetch customer details
    const { data: customer } = await supabase
      .from('finance_customers')
      .select('name, phone')
      .eq('id', loan.customer_id)
      .single();
    console.log("Customer:", customer ? customer.name : "Unknown");

    // Fetch all follow-up events
    const { data: followups } = await supabase
      .from('finance_loan_payment_followups')
      .select('*')
      .eq('loan_id', loanId)
      .order('follow_up_date', { ascending: true })
      .order('created_at', { ascending: true });

    console.log("\n=== 1. FOLLOW-UP EVENTS ===");
    if (!followups || followups.length === 0) {
      console.log("No follow-up events found for CD127.");
    } else {
      followups.forEach(f => {
        console.log(`- Date: ${f.follow_up_date} | Created At: ${f.created_at} | Result: ${f.result} | Promise Date: ${f.next_follow_up_date} | Promised Amt: ${f.promised_amount ?? 'N/A'}`);
      });
    }

    // Fetch all Collection transactions
    const { data: txs } = await supabase
      .from('finance_loan_transactions')
      .select('*')
      .eq('loan_id', loanId)
      .eq('type', 'Collection')
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    console.log("\n=== 2. COLLECTION TRANSACTIONS ===");
    if (!txs || txs.length === 0) {
      console.log("No collection transactions found for CD127.");
    } else {
      txs.forEach(t => {
        console.log(`- Date: ${t.date} | Created At: ${t.created_at} | Receipt: ${t.receipt_no} | Amt: ₹${t.amount}`);
      });
    }

    // Resolve promises
    console.log("\n=== 3. PROMISE RESOLUTION AUDIT ===");
    const businessDate = '2026-07-10'; // Current business date
    
    if (followups && followups.length > 0) {
      // Find promise events
      const promises = followups.filter(f => f.result === 'PROMISED TO PAY');
      
      promises.forEach(p => {
        // Chronological window rules:
        // payment.date > p.follow_up_date OR (payment.date === p.follow_up_date AND payment.created_at > p.created_at)
        const qualifying = (txs || []).filter(t => {
          if (t.date > p.follow_up_date) return true;
          if (t.date === p.follow_up_date) {
            if (t.created_at && p.created_at) {
              return new Date(t.created_at).getTime() > new Date(p.created_at).getTime();
            }
            return false; // Do not resolve if timestamp is missing on same date
          }
          return false;
        });

        const totalPaid = qualifying.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const amtNeeded = p.promised_amount ? Number(p.promised_amount) : 0;
        
        let resolved = false;
        if (amtNeeded > 0) {
          resolved = totalPaid >= amtNeeded;
        } else {
          resolved = qualifying.length > 0;
        }

        let tab = 'ACTIVE_QUEUE';
        if (!resolved && p.next_follow_up_date) {
          if (p.next_follow_up_date === businessDate) tab = 'TODAYS';
          else if (p.next_follow_up_date > businessDate) tab = 'UPCOMING';
          else tab = 'MISSED';
        }

        console.log(`Promise Call on ${p.follow_up_date} (Promise Date: ${p.next_follow_up_date}):`);
        console.log(`  Promised Amount: ₹${amtNeeded || 'N/A'}`);
        console.log(`  Qualifying collections: ${qualifying.map(t => `${t.date} (₹${t.amount})`).join(', ') || 'None'}`);
        console.log(`  Qualifying cumulative: ₹${totalPaid}`);
        console.log(`  Resolved: ${resolved ? 'YES' : 'NO'}`);
        console.log(`  Derived Tab: ${resolved ? 'NONE' : tab}`);
        console.log(`  Exact Reason: ${
          resolved 
            ? `Cumulative payments ₹${totalPaid} >= promised ₹${amtNeeded || 0}`
            : `Cumulative payments ₹${totalPaid} < promised ₹${amtNeeded || 1} (No qualifying payment)`
        }`);
      });
    }

  } catch (e) {
    console.error(e);
  } finally {
    vite.close();
  }
}

audit();
