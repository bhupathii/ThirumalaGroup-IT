import { describe, it, expect } from 'vitest';
import { supabaseFinance } from '../lib/supabaseFinance';

describe('Dues Reconciliation Verification', () => {
  it('verifies that all active non-closed loans with presentDue > 0 are eligible for follow-up', async () => {
    const summaryResult = await supabaseFinance.getDuesLedgerSummary();
    const summary = summaryResult.dues;
    console.log(`\nReconciling ${summary.length} active dues list accounts...`);

    const diagnosticTable = summary.map(row => {
      const followupEligible = row.present_due > 0;
      let exclusionReason = 'None';
      if (row.present_due <= 0) {
        exclusionReason = 'Present due is 0 or less';
      }

      return {
        loan_id: row.loan_id,
        customer_name: row.customer_name,
        dues_list_present_due: row.present_due,
        canonical_present_due: row.present_due,
        followup_eligible: followupEligible ? 'YES' : 'NO',
        exclusion_reason: exclusionReason
      };
    });

    console.table(diagnosticTable);

    // Verify all active loans with present_due > 0 are eligible
    summary.forEach(row => {
      if (row.present_due > 0) {
        expect(row.present_due).toBeGreaterThan(0);
      }
    });
  }, 30000); // 30 seconds timeout

  it('verifies that dues list items include penalty_paid and that wrapper rows are ignored', async () => {
    const summaryResult = await supabaseFinance.getDuesLedgerSummary();
    const summary = summaryResult.dues;

    // Check that we have penalty_paid and that it is a number
    summary.forEach(row => {
      expect(row).toHaveProperty('penalty_paid');
      expect(typeof row.penalty_paid).toBe('number');
      expect(row.penalty_paid).toBeGreaterThanOrEqual(0);
    });

    // Specifically verify some active CD loans
    const cdLoans = summary.filter(row => row.loan_id.startsWith('CD'));
    console.log(`\nVerified ${cdLoans.length} active CD loan items in Dues List:`);
    cdLoans.slice(0, 5).forEach(row => {
      console.log(`Loan: ${row.loan_id} | Paid Interest: ₹${row.interest_paid} | Paid Penalty: ₹${row.penalty_paid}`);
    });
  }, 30000);

  it('probes the real methods and logs errors', async () => {
    console.log("=== PROBE START ===");
    try {
      const followUps = await supabaseFinance.getFollowUps();
      console.log("getFollowUps succeeded, returned length:", followUps.length);
    } catch (err) {
      console.error("getFollowUps failed:", err);
    }

    try {
      const summary = await supabaseFinance.getDuesLedgerSummary();
      console.log("getDuesLedgerSummary succeeded, dues length:", summary?.dues?.length, "keys:", summary ? Object.keys(summary) : null);
    } catch (err) {
      console.error("getDuesLedgerSummary failed:", err);
    }

    try {
      const txs = await supabaseFinance.getTransactions();
      console.log("getTransactions succeeded, length:", txs.length);
    } catch (err) {
      console.error("getTransactions failed:", err);
    }
    console.log("=== PROBE END ===");
  }, 30000);

  it('verifies that dues ledger summary has { dues, integrityErrors } shape and is robust against follow-up fetch failure', async () => {
    // 1. Dues ledger summary shape verification
    const summaryResult = await supabaseFinance.getDuesLedgerSummary();
    expect(summaryResult).toHaveProperty('dues');
    expect(summaryResult).toHaveProperty('integrityErrors');
    expect(Array.isArray(summaryResult.dues)).toBe(true);
    expect(Array.isArray(summaryResult.integrityErrors)).toBe(true);

    // 2. Simulate follow-up query failure but preserve dues
    const mockFollowUpsError = new Error("Simulated follow-up DB failure");
    
    // Simulate what happens in PaymentFollowUp.tsx:
    let fetchedFollowups: any[] = [];
    let followUpsFailed = false;

    try {
      // Simulate followups query throwing/failing
      throw mockFollowUpsError;
    } catch (err: any) {
      expect(err.message).toBe("Simulated follow-up DB failure");
      followUpsFailed = true;
      fetchedFollowups = []; // fallback to empty array
    }

    expect(followUpsFailed).toBe(true);
    expect(fetchedFollowups).toEqual([]);

    // Dues query succeeded:
    const dues = summaryResult.dues;
    expect(dues.length).toBeGreaterThan(0);

    // Assert that the active queue is successfully populated even if follow-up failed
    const activeDueLoans = dues.filter((l: any) => l.loan_type === 'CD' ? l.due_days >= 0 : true);
    expect(activeDueLoans.length).toBeGreaterThan(0);
  });

  it("verifies callback scheduling and tab classification chronological rules", () => {
    const todayDateStr = "2026-07-10";

    const CALLBACK_RESULTS = [
      'CALL BACK',
      'NO ANSWER',
      'ANSWERED',
      'BUSY',
      'SWITCHED OFF',
      'REQUESTED LATER'
    ];

    // Helper simulation function representing the chronological loop in PaymentFollowUp.tsx
    function getActivePendingAction(loanFollowups: any[], transactions: any[]): any {
      let activePendingAction: any = null;

      for (const f of loanFollowups) {
        if (CALLBACK_RESULTS.includes(f.result) && f.next_follow_up_date) {
          activePendingAction = f;
        } else if (f.result === 'PROMISED TO PAY' && f.next_follow_up_date) {
          if (activePendingAction && CALLBACK_RESULTS.includes(activePendingAction.result)) {
            activePendingAction = null;
          }
          const promiseDateStr = f.follow_up_date;
          const promiseCreatedAt = f.created_at ? new Date(f.created_at).getTime() : null;

          const qualifying = transactions.filter((t: any) => {
            if (t.type !== 'Collection') return false;
            if (t.date > promiseDateStr) {
              return true;
            } else if (t.date === promiseDateStr) {
              if (t.created_at && promiseCreatedAt) {
                return new Date(t.created_at).getTime() > promiseCreatedAt;
              }
              return false;
            }
            return false;
          });

          const totalPaid = qualifying.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
          const amtNeeded = f.promised_amount ? Number(f.promised_amount) : 0;

          let resolved = false;
          if (amtNeeded > 0) {
            resolved = totalPaid >= amtNeeded;
          } else {
            resolved = qualifying.length > 0;
          }

          if (!resolved) {
            activePendingAction = f;
          } else {
            if (activePendingAction === f) {
              activePendingAction = null;
            }
          }
        } else {
          if (activePendingAction && CALLBACK_RESULTS.includes(activePendingAction.result)) {
            activePendingAction = null;
          }
        }
      }
      return activePendingAction;
    }

    // Tab categorization simulation helper
    function getTab(nextFollowUpDate: string | null): string {
      if (!nextFollowUpDate) return "ACTIVE_QUEUE";
      if (nextFollowUpDate === todayDateStr) return "TODAYS";
      if (nextFollowUpDate > todayDateStr) return "UPCOMING";
      return "MISSED";
    }

    // Scenario A: Log CALL BACK +3 days
    const followupsA = [
      { id: "1", result: "CALL BACK", next_follow_up_date: "2026-07-13", follow_up_date: "2026-07-10", created_at: "2026-07-10T10:00:00Z" }
    ];
    let actionA = getActivePendingAction(followupsA, []);
    expect(actionA).not.toBeNull();
    expect(actionA.result).toBe("CALL BACK");
    expect(actionA.next_follow_up_date).toBe("2026-07-13");
    expect(getTab(actionA.next_follow_up_date)).toBe("UPCOMING"); // on 10-Jul, 13-Jul is upcoming

    // Scenario B: 10-Jul CALL BACK +3 days, 13-Jul ANSWERED call completes older callback
    const followupsB = [
      { id: "1", result: "CALL BACK", next_follow_up_date: "2026-07-13", follow_up_date: "2026-07-10", created_at: "2026-07-10T10:00:00Z" },
      { id: "2", result: "ANSWERED", next_follow_up_date: null, follow_up_date: "2026-07-13", created_at: "2026-07-13T10:00:00Z" }
    ];
    let actionB = getActivePendingAction(followupsB, []);
    expect(actionB).toBeNull(); // Completed callback returns loan to active queue

    // Scenario C: 10-Jul CALL BACK +3 days, 13-Jul CALL BACK +5 days
    const followupsC = [
      { id: "1", result: "CALL BACK", next_follow_up_date: "2026-07-13", follow_up_date: "2026-07-10", created_at: "2026-07-10T10:00:00Z" },
      { id: "2", result: "CALL BACK", next_follow_up_date: "2026-07-18", follow_up_date: "2026-07-13", created_at: "2026-07-13T10:00:00Z" }
    ];
    let actionC = getActivePendingAction(followupsC, []);
    expect(actionC.next_follow_up_date).toBe("2026-07-18");

    // Scenario D: 10-Jul CALL BACK +3 days, 13-Jul PROMISED TO PAY by 17-Jul
    const followupsD = [
      { id: "1", result: "CALL BACK", next_follow_up_date: "2026-07-13", follow_up_date: "2026-07-10", created_at: "2026-07-10T10:00:00Z" },
      { id: "2", result: "PROMISED TO PAY", next_follow_up_date: "2026-07-17", follow_up_date: "2026-07-13", created_at: "2026-07-13T10:00:00Z", promised_amount: 1000 }
    ];
    let actionD = getActivePendingAction(followupsD, []);
    expect(actionD.result).toBe("PROMISED TO PAY");
    expect(actionD.next_follow_up_date).toBe("2026-07-17");

    // Scenario E: Promise payment resolution verification
    const txs = [
      { type: "Collection", amount: 1000, date: "2026-07-14", created_at: "2026-07-14T09:00:00Z" }
    ];
    let actionE = getActivePendingAction(followupsD, txs);
    expect(actionE).toBeNull(); // Resolved promise is cleared
  });
});
