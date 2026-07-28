import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAudit() {
  console.log('--- STARTING LOAN PARTNER DATABASE FORENSIC AUDIT ---');

  // Fetch all partners
  const { data: partners, error: pErr } = await supabase.schema('finance').from('partners').select('*');
  if (pErr) {
    console.error('Error fetching partners:', pErr);
    return;
  }
  const validPartnerIds = new Set(partners.map(p => String(p.id)));
  const partnerMap = new Map();
  partners.forEach(p => partnerMap.set(String(p.id), p.name));

  // Fetch all loans
  const { data: loans, error: lErr } = await supabase.schema('finance').from('loans').select('*');
  if (lErr) {
    console.error('Error fetching loans:', lErr);
    return;
  }

  const totalLoans = loans.length;
  let loansWithPartnerAssigned = 0;
  let loansWithoutPartner = 0;
  let loansWithInvalidPartnerId = 0;
  let loansReferencingDeletedPartner = 0;
  let loansWithNullPartnerId = 0;
  let loansWithEmptyStringPartnerId = 0;

  const partnerStats = new Map();
  partners.forEach(p => {
    partnerStats.set(String(p.id), { name: p.name, count: 0, principal: 0 });
  });
  partnerStats.set('UNASSIGNED', { name: 'UNASSIGNED / NULL', count: 0, principal: 0 });

  for (const l of loans) {
    const pid = l.partner_id;
    const pidStr = pid === null || pid === undefined ? null : String(pid).trim();

    if (pid === null) {
      loansWithNullPartnerId++;
      loansWithoutPartner++;
      const u = partnerStats.get('UNASSIGNED');
      u.count++;
      u.principal += Number(l.amount || 0);
    } else if (pidStr === '') {
      loansWithEmptyStringPartnerId++;
      loansWithoutPartner++;
      const u = partnerStats.get('UNASSIGNED');
      u.count++;
      u.principal += Number(l.amount || 0);
    } else if (pidStr && validPartnerIds.has(pidStr)) {
      loansWithPartnerAssigned++;
      const stats = partnerStats.get(pidStr);
      if (stats) {
        stats.count++;
        stats.principal += Number(l.amount || 0);
      }
    } else {
      loansWithInvalidPartnerId++;
      loansReferencingDeletedPartner++;
      loansWithoutPartner++;
    }
  }

  console.log('\n--- SAMPLE LOAN PARTNER FIELDS ---');
  loans.slice(0, 10).forEach(l => {
    console.log(`Loan ID: ${l.loan_id} | partner_id: "${l.partner_id}" | partner_name: "${l.partner_name}"`);
  });
  console.log('Total Loans:', totalLoans);
  console.log('Loans with Partner Assigned:', loansWithPartnerAssigned);
  console.log('Loans without Partner:', loansWithoutPartner);
  console.log('Loans with Invalid Partner ID:', loansWithInvalidPartnerId);
  console.log('Loans referencing deleted partner:', loansReferencingDeletedPartner);
  console.log('Loans with NULL partner_id:', loansWithNullPartnerId);
  console.log('Loans with empty string partner_id:', loansWithEmptyStringPartnerId);

  console.log('\n--- PARTNER-WISE BREAKDOWN ---');
  for (const [id, stats] of partnerStats.entries()) {
    console.log(`- ${stats.name} (ID: ${id}): ${stats.count} Loans | Principal: ₹${stats.principal.toLocaleString('en-IN')}`);
  }
}

runAudit().catch(console.error);
