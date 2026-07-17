import re

with open('src/pages/finance/DetailedLedger.tsx', 'r') as f:
    content = f.read()

# Update state variables
old_state = """  const [allRangeEntries, setAllRangeEntries] = useState<DailyFinancialTransaction[]>([]);"""
new_state = """  const [allRangeEntries, setAllRangeEntries] = useState<DailyFinancialTransaction[]>([]);
  const [allHistoryEntries, setAllHistoryEntries] = useState<DailyFinancialTransaction[]>([]);"""

content = content.replace(old_state, new_state)

# Update fetch logic
old_fetch = """      if (fromDate > '1970-01-01') {
        await dailyFinancialTransactionService.getDailyFinancialTransactions({
          fromDate: '1970-01-01',
          toDate: prevDateLimitStr,
          financeMode
        });
      }

      // 2. Fetch date range entries
      const rangeTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate,
        toDate,
        financeMode
      });

      // We will store all and calculate opening balance dynamically based on filters
      setAllRangeEntries(rangeTxs);"""

new_fetch = """      let historyTxs: DailyFinancialTransaction[] = [];
      if (fromDate > '1970-01-01') {
        historyTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
          fromDate: '1970-01-01',
          toDate: prevDateLimitStr,
          financeMode
        });
      }

      // 2. Fetch date range entries
      const rangeTxs = await dailyFinancialTransactionService.getDailyFinancialTransactions({
        fromDate,
        toDate,
        financeMode
      });

      setAllHistoryEntries(historyTxs);
      setAllRangeEntries(rangeTxs);"""

content = content.replace(old_fetch, new_fetch)

# Update uniqueHeads computation to look at BOTH history and range
old_unique = """  const uniqueHeads = useMemo(() => {
    const heads = new Set<string>();
    // Plus any heads from the actual entries in the current range
    allRangeEntries.forEach(t => {
      if (t.headOfAccount) heads.add(t.headOfAccount);
    });
    return Array.from(heads).sort();
  }, [allRangeEntries]);"""

new_unique = """  const uniqueHeads = useMemo(() => {
    const heads = new Set<string>();
    allHistoryEntries.forEach(t => {
      if (t.headOfAccount) heads.add(t.headOfAccount);
    });
    allRangeEntries.forEach(t => {
      if (t.headOfAccount) heads.add(t.headOfAccount);
    });
    return Array.from(heads).sort();
  }, [allHistoryEntries, allRangeEntries]);"""

content = content.replace(old_unique, new_unique)

# Update filteredEntries to calculate the TRUE opening balance based on the selected filters!
old_filtered = """    // Sort chronologically: Oldest first to build running balance
    const sorted = rangeList.sort((a, b) => {
      if (a.transactionDate !== b.transactionDate) {
        return a.transactionDate.localeCompare(b.transactionDate);
      }
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    // Compute running balance
    let currentBalance = 0; // Starts from 0
    return sorted.map(t => {
      currentBalance = currentBalance + (t.credit || 0) - (t.debit || 0);
      return {
        ...t,
        runningBalance: currentBalance
      };
    }).reverse(); // Show newest first in table
  }, [allRangeEntries, categoryFilter, selectedHead, searchQuery]);"""

new_filtered = """    // Sort chronologically: Oldest first to build running balance
    const sorted = rangeList.sort((a, b) => {
      if (a.transactionDate !== b.transactionDate) {
        return a.transactionDate.localeCompare(b.transactionDate);
      }
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    // Compute opening balance based on historical transactions matching the same filters!
    let currentBalance = 0;
    
    // Base history filtering MUST match the same selectedHead (categoryFilter usually applies too)
    let histList = allHistoryEntries;
    if (categoryFilter !== 'ALL') {
      histList = histList.filter(t => t.category === categoryFilter);
    }
    if (selectedHead !== 'ALL') {
      histList = histList.filter(t => t.headOfAccount === selectedHead);
    }
    // Search query is typically not applied to opening balance because search is just a text filter on the current view
    // Opening balance should represent the actual financial balance before this period.
    histList.forEach(t => {
      currentBalance = currentBalance + (t.credit || 0) - (t.debit || 0);
    });

    // Inject an opening balance synthetic row if needed? No, just start the running balance from it!
    const result = sorted.map(t => {
      currentBalance = currentBalance + (t.credit || 0) - (t.debit || 0);
      return {
        ...t,
        runningBalance: currentBalance
      };
    }).reverse(); // Show newest first in table
    
    return result;
  }, [allRangeEntries, allHistoryEntries, categoryFilter, selectedHead, searchQuery]);"""

content = content.replace(old_filtered, new_filtered)

with open('src/pages/finance/DetailedLedger.tsx', 'w') as f:
    f.write(content)
