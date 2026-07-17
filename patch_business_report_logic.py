import re

with open('src/pages/finance/BusinessReport.tsx', 'r') as f:
    content = f.read()

# Add sortNumerically import
if 'sortNumerically' not in content:
    content = content.replace("import { getLocalBusinessDateISO } from '../../utils/dateUtils';", "import { getLocalBusinessDateISO } from '../../utils/dateUtils';\nimport { sortNumerically } from '../../lib/financialCalculations';")

# 1. Add summary state
summary_state = """  const [summary, setSummary] = useState({
    capitalInvested: 0,
    totalLoans: 0,
    activeLoans: 0,
    closedLoans: 0,
    principalOutstanding: 0,
    interestReceived: 0,
    penaltyReceived: 0,
    pendingInterest: 0,
    pendingPenalty: 0,
    totalDue: 0,
  });"""

content = content.replace("const [partnerBusiness, setPartnerBusiness] = useState<PartnerBusinessRow[]>(", summary_state + "\n\n  const [partnerBusiness, setPartnerBusiness] = useState<PartnerBusinessRow[]>(")

# 2. Update fetchBusinessData to calculate summary items
# Right before setPartnerBusiness(pbList);
summary_calc = """      let cap = 0, tot = 0, act = 0, clo = 0, pOut = 0, iRec = 0, pRec = 0;
      pbList.forEach(r => {
        tot++;
        cap += r.loanAmount;
        pOut += r.balance;
        if (r.status === 'Active') act++;
        if (r.status === 'Closed') clo++;
      });
      
      // Calculate Interest & Penalty Received from rawTxs for the filtered loans
      rawTxs.forEach(t => {
        if (t.type === 'Collection' && pbList.find(l => l.id === t.loan_id)) {
           // Wait, we need to know how much was interest and penalty
           // For simplicity, let's assume we can fetch it, but wait...
        }
      });
"""
# Wait, I'll calculate iRec and pRec properly. 
# `rawTxs` has `interest_amount` and `penalty_amount` or I can get it from `finance_dues`.
# Actually, the user's previous `BusinessReport.tsx` had this. 
