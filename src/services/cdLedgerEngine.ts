/**
 * CD LEDGER BUSINESS ENGINE — ONE AUTHORITATIVE SOURCE OF TRUTH
 * 
 * Rebuilt from scratch with exact parity to the original Microsoft Access behavior.
 */

export interface CDContract {
  id: string;
  loanId: string;
  customer_id: string;
  originalLoanDate: string; // YYYY-MM-DD
  originalPrincipal: number;
  interestRate: number; // % per period
  penaltyRate: number; // % per period
  periodDays: number; // e.g. 30
  graceDays: number; // e.g. 5
  status: string;
}

export interface CDEvent {
  id: string;
  entryDate: string; // YYYY-MM-DD
  accountName: string;
  credit: number;
  debit: number;
  receiptNo: string | null;
  particulars: string;
  entryType: string;
}

export interface CDInterestDetailEvent {
  id: string;
  entryDate: string; // YYYY-MM-DD
  credit: number;
  receiptNo: string | null;
  particulars: string;
  renewedDays: number;
  renewedTillDate: string | null;
  rowType: string;
}

export interface CDAccountPosition {
  principalBalance: number;
  originalLoanDate: string;
  periodDays: number;
  baseDueDate: string;
  totalRenewedDays: number;
  contractualPositionDate: string;
  currentDueDate: string;
  fractionalCarry: number;
  displayDueDays: number;
  exactDueDays: number;
  dailyInterest: number;
  dailyPenalty: number;
  accruedInterest: number;
  accruedPenalty: number;
  todayDue: number;
  renewalAmount: number;
  totalToRegularize: number;
  totalForClose: number;
  lastPaymentDate: string | null;
}

export interface CDPaymentSplit {
  totalPaid: number;
  penaltyPaid: number;
  interestPaid: number;
  principalPaid: number;
  renewedDays: number;
}

// ============================================================================
// CENTRALIZED ROUNDING HELPERS
// ============================================================================

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundCDMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundRenewedDays(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateDisplayDays(exactDays: number): number {
  const floor = Math.floor(exactDays);
  const frac = exactDays - floor;
  // If fractional part is 0.5 or more, round up to next day
  if (Number(frac.toFixed(4)) >= 0.5) {
    return floor + 1;
  }
  return floor;
}

/**
 * Banker's Rounding (round-half-to-even) to whole numbers.
 * Matches MS Access VBA Int() / Round() behaviour.
 */
export function roundRupee(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

// ============================================================================
// DATE CALCULATION HELPERS
// ============================================================================

export function parseDateParts(d: string | Date | number): { year: number; month: number; day: number } {
  if (d instanceof Date) {
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  }
  if (typeof d === 'number') {
    const date = new Date(d);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
  if (typeof d === 'string') {
    const isoPart = d.split('T')[0];
    const parts = isoPart.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
        return { year: y, month: m, day };
      }
    }
    const date = new Date(d);
    // If it parsed as UTC midnight
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) {
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
      };
    }
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
  const date = new Date();
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function getCalendarMidnightUTC(d: string | Date | number): number {
  const { year, month, day } = parseDateParts(d);
  return Date.UTC(year, month - 1, day);
}

export function dateOrdinal(d: string | Date | number): number {
  return Math.round(getCalendarMidnightUTC(d) / (24 * 60 * 60 * 1000));
}

export function ordinalToDateStr(ordinal: number): string {
  const date = new Date(Math.round(ordinal) * 24 * 60 * 60 * 1000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function differenceInCalendarDays(d1: string | Date | number, d2: string | Date | number): number {
  const utc1 = getCalendarMidnightUTC(d1);
  const utc2 = getCalendarMidnightUTC(d2);
  return Math.round((utc1 - utc2) / (24 * 60 * 60 * 1000));
}

export function addCalendarDays(d: string | Date | number, days: number): string {
  const { year, month, day } = parseDateParts(d);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ============================================================================
// ENGINE IMPLEMENTATION
// ============================================================================

export function buildCDContract(loan: any): CDContract {
  if (!loan) {
    throw new Error('CD_ENGINE_ERROR: Loan record is required to build CDContract.');
  }
  return {
    id: loan.id,
    loanId: loan.loan_id || '',
    customer_id: loan.customer_id || '',
    originalLoanDate: (loan.date || '').split('T')[0],
    originalPrincipal: Number(loan.amount) || 0,
    interestRate: Number(loan.interest_rate) || 3,
    penaltyRate: loan.penalty_percent !== undefined && loan.penalty_percent !== null ? Number(loan.penalty_percent) : 0.75,
    periodDays: loan.period_days && Number(loan.period_days) > 0 ? Number(loan.period_days) : 30,
    graceDays: loan.grace_days !== undefined && loan.grace_days !== null ? Number(loan.grace_days) : 5,
    status: loan.status || 'Active',
  };
}

export function getCDHistoricalEvents(
  ledgerEntries: any[],
  interestDetails: any[]
): { ledgerEvents: CDEvent[]; interestEvents: CDInterestDetailEvent[] } {
  const ledgerEvents: CDEvent[] = (ledgerEntries || []).map(e => ({
    id: e.id,
    entryDate: (e.entry_date || '').split('T')[0],
    accountName: e.account_name || '',
    credit: Number(e.credit) || 0,
    debit: Number(e.debit) || 0,
    receiptNo: e.receipt_no || null,
    particulars: e.particulars || '',
    entryType: e.entry_type || '',
  }));

  const interestEvents: CDInterestDetailEvent[] = (interestDetails || []).map(d => ({
    id: d.id,
    entryDate: (d.entry_date || '').split('T')[0],
    credit: Number(d.credit) || 0,
    receiptNo: d.receipt_no || null,
    particulars: d.particulars || '',
    renewedDays: Number(d.renewed_days) || 0,
    renewedTillDate: d.renewed_till_date ? (d.renewed_till_date || '').split('T')[0] : null,
    rowType: d.row_type || '',
  }));

  return { ledgerEvents, interestEvents };
}

export function getCDPrincipalBalance(contract: CDContract, ledgerEvents: CDEvent[]): number {
  // Find original loan disbursement amount first
  const disb = ledgerEvents.find(e => e.entryType === 'original_loan' || e.entryType === 'Disbursement');
  const originalPrincipal = disb ? disb.debit : contract.originalPrincipal;
  
  // Principal balance = originalPrincipal - sum of principal_payment credit allocations
  const principalPaid = ledgerEvents
    .filter(e => e.entryType === 'principal_payment')
    .reduce((sum, e) => sum + e.credit, 0);

  return Number(Math.max(0, originalPrincipal - principalPaid).toFixed(2));
}

export function getCDTotalRenewedDays(interestEvents: CDInterestDetailEvent[]): number {
  // Mode A & B check:
  // Pre-stored: row has credit = 0 AND renewed_days > 0
  // Derived (for legacy): row has credit > 0.
  // Note: we sum the pre-stored renewed_days from the credit = 0 note rows.
  // This is the authoritative renewed_days history.
  return interestEvents
    .filter(d => d.credit === 0 && d.renewedDays > 0)
    .reduce((sum, d) => sum + d.renewedDays, 0);
}

export function getCDContractualPosition(
  contract: CDContract,
  _ledgerEvents: CDEvent[],
  interestEvents: CDInterestDetailEvent[]
): {
  baseDueDate: string;
  exactRenewedDays: number;
  contractualPositionDate: string;
  currentDueDate: string;
  fractionalCarry: number;
} {
  // baseDueDate = originalLoanDate + periodDays - 1 (inclusive cycle rule)
  const baseDueDate = addCalendarDays(contract.originalLoanDate, contract.periodDays - 1);
  const baseOrdinal = dateOrdinal(baseDueDate);

  // Daily interest rate based on original principal
  const dailyInterest = roundMoney((contract.originalPrincipal * (contract.interestRate / 100)) / contract.periodDays);

  // Group interestEvents by receiptNo (treating null/undefined as unique separate keys)
  const groups: { [key: string]: CDInterestDetailEvent[] } = {};
  const nullReceiptEvents: CDInterestDetailEvent[] = [];

  for (const row of interestEvents) {
    if (row.entryDate === contract.originalLoanDate) continue; // skip opening day commission
    if (!row.receiptNo) {
      nullReceiptEvents.push(row);
    } else {
      if (!groups[row.receiptNo]) {
        groups[row.receiptNo] = [];
      }
      groups[row.receiptNo].push(row);
    }
  }

  let exactRenewedDays = 0;

  // Helper to process a group of events for a single receipt/event identity
  const processGroup = (rows: CDInterestDetailEvent[]) => {
    // 1. Check if authoritative renewedDays exists in the group
    const renewalRows = rows.filter(row => (row.rowType === 'Renewal' || row.credit === 0) && row.renewedDays > 0);
    if (renewalRows.length > 0) {
      // Sum the explicit renewedDays
      const sumExplicit = renewalRows.reduce((sum, r) => sum + r.renewedDays, 0);
      return sumExplicit;
    }

    // 2. Else derive from interest payment row credits
    const interestPaid = rows
      .filter(row => row.rowType === 'interest_payment' || row.credit > 0)
      .reduce((sum, r) => sum + r.credit, 0);

    if (interestPaid > 0 && dailyInterest > 0) {
      return roundRenewedDays(interestPaid / dailyInterest);
    }

    return 0;
  };

  // Process grouped receipts
  for (const receiptNo of Object.keys(groups)) {
    exactRenewedDays += processGroup(groups[receiptNo]);
  }

  // Process null receipt events individually
  for (const row of nullReceiptEvents) {
    exactRenewedDays += processGroup([row]);
  }

  // Exact contractual position ordinal
  const currentPositionExact = baseOrdinal + exactRenewedDays;
  const wholePart = Math.floor(currentPositionExact);
  const fractionalCarry = roundRenewedDays(currentPositionExact - wholePart);
  const contractualPositionDate = ordinalToDateStr(wholePart);
  const displayDueDate = ordinalToDateStr(baseOrdinal + Math.ceil(exactRenewedDays));

  return {
    baseDueDate,
    exactRenewedDays: roundRenewedDays(exactRenewedDays),
    contractualPositionDate,
    currentDueDate: displayDueDate,
    fractionalCarry,
  };
}

export function getCDAccountPosition(
  loan: any,
  ledgerEntries: any[],
  interestDetails: any[],
  asOfDate: string
): CDAccountPosition {
  const contract = buildCDContract(loan);
  const { ledgerEvents, interestEvents } = getCDHistoricalEvents(ledgerEntries, interestDetails);

  // Fallback to Disbursement/original_loan entry_date if loan.date was mutated in the database
  const disbEntry = ledgerEvents.find(e => e.entryType === 'original_loan' || e.entryType === 'Disbursement');
  if (disbEntry) {
    contract.originalLoanDate = disbEntry.entryDate;
  }

  // Data chronology integrity check:
  // Loan date must not be after the earliest payment date.
  const monetaryPayments = ledgerEvents
    .filter(e => e.entryType === 'amount_paid' || e.credit > 0)
    .sort((a, b) => dateOrdinal(a.entryDate) - dateOrdinal(b.entryDate));
  if (monetaryPayments.length > 0) {
    const earliestPaymentDate = monetaryPayments[0].entryDate;
    if (contract.originalLoanDate > earliestPaymentDate) {
      const err = new Error(`CD_DATA_INTEGRITY_ERROR: Loan ${contract.loanId} has loan_date ${contract.originalLoanDate} after earliest monetary payment ${earliestPaymentDate}.`);
      (err as any).code = 'CD_DATA_INTEGRITY_ERROR';
      throw err;
    }
  }

  const principalBalance = getCDPrincipalBalance(contract, ledgerEvents);
  const { baseDueDate, exactRenewedDays, contractualPositionDate, currentDueDate, fractionalCarry } = getCDContractualPosition(contract, ledgerEvents, interestEvents);

  // Elapsed days from baseDueDate to asOfDate
  const elapsedDays = differenceInCalendarDays(asOfDate, baseDueDate);

  // exactDueDays = elapsedDays - exactRenewedDays
  const exactDueDays = roundRenewedDays(elapsedDays - exactRenewedDays);

  // Negative due days means paid into the future
  const isPaidAhead = exactDueDays <= 0;

  // Daily Rates
  const dailyInterest = roundMoney((principalBalance * (contract.interestRate / 100)) / contract.periodDays);
  const dailyPenalty = roundMoney((principalBalance * (contract.penaltyRate / 100)) / contract.periodDays);

  // Accrued interest & penalty
  const accruedInterest = isPaidAhead ? 0 : roundMoney(exactDueDays * dailyInterest);
  
  // Penalty Grace Rule: 5 day grace threshold
  const isWithinGrace = exactDueDays <= contract.graceDays;
  const accruedPenalty = (isPaidAhead || isWithinGrace) ? 0 : roundMoney(exactDueDays * dailyPenalty);

  const todayDue = roundMoney(accruedInterest + accruedPenalty);

  // standardRenewalAmount = 1 full period of interest
  const renewalAmount = roundMoney(principalBalance * (contract.interestRate / 100) * (contract.periodDays / 30));

  const totalToRegularize = isPaidAhead ? 0 : roundMoney(todayDue + renewalAmount);
  const totalForClose = roundMoney(principalBalance + todayDue);

  // displayDueDays: floor of exactDueDays
  const displayDueDays = isPaidAhead ? 0 : Math.floor(exactDueDays);

  // Last real customer payment date
  const paymentEntries = ledgerEvents
    .filter(e => e.entryType === 'amount_paid' && e.credit > 0)
    .sort((a, b) => dateOrdinal(b.entryDate) - dateOrdinal(a.entryDate));
  
  const lastPaymentDate = paymentEntries.length > 0 ? paymentEntries[0].entryDate : null;

  return {
    principalBalance,
    originalLoanDate: contract.originalLoanDate,
    periodDays: contract.periodDays,
    baseDueDate,
    totalRenewedDays: exactRenewedDays,
    contractualPositionDate,
    currentDueDate,
    fractionalCarry,
    displayDueDays,
    exactDueDays,
    dailyInterest,
    dailyPenalty,
    accruedInterest,
    accruedPenalty,
    todayDue,
    renewalAmount,
    totalToRegularize,
    totalForClose,
    lastPaymentDate,
  };
}

export function allocateCDPayment(
  position: CDAccountPosition,
  paymentAmount: number,
  actionType: 'Renew' | 'Partial' | 'Close',
  _periodDays: number
): CDPaymentSplit {
  const pAmt = roundMoney(paymentAmount);
  const penDue = position.accruedPenalty;
  const intDue = position.accruedInterest;
  const prin = position.principalBalance;
  
  const totalDues = roundMoney(penDue + intDue);
  const isClosing = actionType === 'Close' || pAmt >= roundMoney(totalDues + prin);

  let penaltyPaid = 0;
  let interestPaid = 0;
  let principalPaid = 0;
  let renewedDays = 0;

  if (isClosing) {
    penaltyPaid = roundCDMoney(penDue);
    interestPaid = roundCDMoney(intDue);
    principalPaid = roundMoney(Math.max(0, pAmt - penaltyPaid - interestPaid));
    renewedDays = 0;
  } else if (pAmt >= totalDues && actionType === 'Partial') {
    // Partial payment that completely clears all outstanding dues
    penaltyPaid = roundCDMoney(penDue);
    interestPaid = roundCDMoney(intDue);
    principalPaid = roundMoney(Math.max(0, pAmt - penaltyPaid - interestPaid));
    // Since outstanding interest is cleared, we caught up to the as-of position
    renewedDays = position.exactDueDays;
  } else {
    // Underpaying Partial payment or Renew action: 80/20 split allocation
    // Apply 20% to penalty, capped at penalty due, remainder to interest
    const penaltyBucket = roundCDMoney(pAmt * 0.20);
    const interestBucket = roundMoney(pAmt - penaltyBucket);

    if (penDue > 0) {
      if (penDue < penaltyBucket) {
        penaltyPaid = roundCDMoney(penDue);
        interestPaid = roundMoney(pAmt - penaltyPaid);
      } else {
        penaltyPaid = penaltyBucket;
        interestPaid = interestBucket;
      }
    } else {
      penaltyPaid = 0;
      interestPaid = pAmt;
    }
    principalPaid = 0;

    // renewedDays = interestPaid / dailyInterest
    if (position.dailyInterest > 0) {
      renewedDays = roundRenewedDays(interestPaid / position.dailyInterest);
    }
  }

  // Double check rounding invariant: totalPaid = pen + int + prin
  const totalAllocated = roundMoney(penaltyPaid + interestPaid + principalPaid);
  if (Math.abs(totalAllocated - pAmt) > 0.01) {
    // Adjust interestPaid slightly to match paymentAmount exactly
    interestPaid = roundMoney(pAmt - penaltyPaid - principalPaid);
  }

  return {
    totalPaid: pAmt,
    penaltyPaid,
    interestPaid,
    principalPaid,
    renewedDays,
  };
}

export function validateCDReceipt(events: { ledgerEvents: CDEvent[] }, receiptNo: string): {
  success: boolean;
  cashAmount: number;
  allocationAmount: number;
  difference: number;
} {
  const receiptEntries = events.ledgerEvents.filter(e => e.receiptNo === receiptNo);
  
  const cashEntry = receiptEntries.find(e => e.entryType === 'amount_paid');
  const cashAmount = cashEntry ? cashEntry.credit : 0;

  const allocations = receiptEntries.filter(e => 
    e.entryType === 'penalty_payment' || 
    e.entryType === 'interest_payment' || 
    e.entryType === 'principal_payment'
  );
  const allocationAmount = allocations.reduce((sum, e) => sum + e.credit, 0);
  
  const difference = roundMoney(cashAmount - allocationAmount);
  const success = Math.abs(difference) <= 0.01;

  return {
    success,
    cashAmount,
    allocationAmount,
    difference,
  };
}
