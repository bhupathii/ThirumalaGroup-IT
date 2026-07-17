import re

with open('src/pages/finance/GeneralLedger.tsx', 'r') as f:
    content = f.read()

# Replace the fetch logic
old_fetch = """  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const data = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate: startDate,
        toDate: endDate,
        financeMode
      });
      setAllEntries(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load general ledger data');
    } finally {
      setLoading(false);
    }
  };"""

new_fetch = """  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      // Fetch ALL history up to endDate to compute proper opening balances
      const data = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate: '1970-01-01',
        toDate: endDate,
        financeMode
      });
      setAllEntries(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load general ledger data');
    } finally {
      setLoading(false);
    }
  };"""

content = content.replace(old_fetch, new_fetch)

# Replace summaryData logic to calculate Opening, Period, and Closing balances
old_summary = """  // Group and summarize by normalized Head of Account
  const summaryData = useMemo(() => {
    const map: Record<string, { debit: number; credit: number; count: number; classification: string }> = {};

    allEntries.forEach(entry => {
      const head = entry.headOfAccount || 'UNCLASSIFIED';
      if (!map[head]) {
        map[head] = { debit: 0, credit: 0, count: 0, classification: entry.reportClassification };
      }
      map[head].debit += entry.debit || 0;
      map[head].credit += entry.credit || 0;
      map[head].count += 1;
    });

    return Object.entries(map).map(([head, data]) => {
      const balance = data.credit - data.debit;
      return {
        head,
        debit: data.debit,
        credit: data.credit,
        balance,
        count: data.count,
        classification: data.classification
      };
    }).sort((a, b) => a.head.localeCompare(b.head));
  }, [allEntries]);"""

new_summary = """  // Group and summarize by normalized Head of Account
  const summaryData = useMemo(() => {
    const map: Record<string, { opDebit: number; opCredit: number; periodDebit: number; periodCredit: number; count: number; classification: string }> = {};

    allEntries.forEach(entry => {
      const head = entry.headOfAccount || 'UNCLASSIFIED';
      if (!map[head]) {
        map[head] = { opDebit: 0, opCredit: 0, periodDebit: 0, periodCredit: 0, count: 0, classification: entry.reportClassification };
      }
      
      if (entry.transactionDate < startDate) {
        map[head].opDebit += entry.debit || 0;
        map[head].opCredit += entry.credit || 0;
      } else {
        map[head].periodDebit += entry.debit || 0;
        map[head].periodCredit += entry.credit || 0;
        map[head].count += 1;
      }
    });

    return Object.entries(map).map(([head, data]) => {
      const openingBalance = data.opCredit - data.opDebit;
      const closingBalance = openingBalance + data.periodCredit - data.periodDebit;
      
      // Only include accounts that have a non-zero balance OR had activity in the period
      if (openingBalance === 0 && data.periodCredit === 0 && data.periodDebit === 0) {
        return null;
      }
      
      return {
        head,
        openingBalance,
        periodDebit: data.periodDebit,
        periodCredit: data.periodCredit,
        closingBalance,
        count: data.count,
        classification: data.classification
      };
    }).filter(Boolean) as Array<{ head: string; openingBalance: number; periodDebit: number; periodCredit: number; closingBalance: number; count: number; classification: string }>;
  }, [allEntries, startDate]);"""

content = content.replace(old_summary, new_summary)

# Update overallTotals
old_overall = """  // Totals for the entire general ledger
  const overallTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    summaryData.forEach(s => {
      debit += s.debit;
      credit += s.credit;
    });
    return { debit, credit, balance: credit - debit };
  }, [summaryData]);"""

new_overall = """  // Totals for the entire general ledger
  const overallTotals = useMemo(() => {
    let opBal = 0;
    let periodDebit = 0;
    let periodCredit = 0;
    let closeBal = 0;
    
    summaryData.forEach(s => {
      opBal += s.openingBalance;
      periodDebit += s.periodDebit;
      periodCredit += s.periodCredit;
      closeBal += s.closingBalance;
    });
    return { openingBalance: opBal, periodDebit, periodCredit, closingBalance: closeBal };
  }, [summaryData]);"""

content = content.replace(old_overall, new_overall)

# Update Drill down entries to use startDate
old_drill = """  // Filter entries for drill-down view modal
  const drillDownEntries = useMemo(() => {
    if (!selectedHead) return [];
    let list = allEntries.filter(e => e.headOfAccount === selectedHead);

    if (drillSearchQuery.trim()) {"""

new_drill = """  // Filter entries for drill-down view modal
  const drillDownEntries = useMemo(() => {
    if (!selectedHead) return [];
    // For drill-down, only show period entries
    let list = allEntries.filter(e => e.headOfAccount === selectedHead && e.transactionDate >= startDate);

    if (drillSearchQuery.trim()) {"""

content = content.replace(old_drill, new_drill)

with open('src/pages/finance/GeneralLedger.tsx', 'w') as f:
    f.write(content)
