import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://caugkxqckrfoxgbmneis.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhdWdreHFja3Jmb3hnYm1uZWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMjE2MjgsImV4cCI6MjA5ODg5NzYyOH0.gU-ykcW9oXnQUr0INssG57xHsC0ziVeSVHjnaJBK2N0';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  db: { schema: 'finance' }
});

// Repair script targeting CD119 specifically
// Original Date: 2026-04-13 -> Correct Original Date: 2023-10-05
async function runRepair() {
  const targetLoanId = '58ed35ca-f37e-4069-b9d5-2acda243645e';
  const expectedOldDate = '2026-04-13';
  const expectedNewDate = '2023-10-05';

  console.log('=== CD119 REPAIR CONTEXT ===');
  console.log(`Checking loan ID: ${targetLoanId}`);

  // Fetch current state
  const { data: loan, error: fetchErr } = await supabase
    .from('loans')
    .select('id, loan_id, date, status, amount')
    .eq('id', targetLoanId)
    .single();

  if (fetchErr || !loan) {
    console.error('Error fetching target loan state:', fetchErr);
    return;
  }

  console.log(`Current DB Date: ${loan.date} | Expected Old Date: ${expectedOldDate}`);

  if (loan.date !== expectedOldDate) {
    console.error(`Precondition Failed: Current date ${loan.date} does not match expected old date ${expectedOldDate}. Aborting.`);
    return;
  }

  console.log('Precondition PASS. Preparation for mutation verified.');
  console.log('Executing repair...');

  const { data: updatedLoan, error: updateErr } = await supabase
    .from('loans')
    .update({ date: expectedNewDate })
    .eq('id', targetLoanId)
    .select()
    .single();

  if (updateErr) {
    console.error('Mutation Error:', updateErr);
    return;
  }

  console.log('Mutation COMPLETE.');
  console.log(`Updated Date: ${updatedLoan.date}`);
  console.log('To synchronize ledger balances, run the FULL_RECALCULATE operation for this loan.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  runRepair().catch(console.error);
}
