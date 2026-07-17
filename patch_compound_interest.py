import re

with open('src/components/finance/CompoundInterestModal.tsx', 'r') as f:
    content = f.read()

old_calc = """  // Basic monthly compounding logic calculation
  const calculations = useMemo(() => {
    if (!loanDate || !principal) return [];
    
    // Sort entries by date
    const sortedEntries = [...entries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    
    // Payments map by YYYY-MM
    const paymentsByMonth: Record<string, number> = {};
    sortedEntries.forEach(entry => {
      // We consider credits as payments.
      if (entry.credit && Number(entry.credit) > 0) {
        const monthKey = entry.entry_date.substring(0, 7); // YYYY-MM
        paymentsByMonth[monthKey] = (paymentsByMonth[monthKey] || 0) + Number(entry.credit);
      }
    });

    const results = [];
    const startDate = new Date(loanDate);
    const endDate = new Date(); // Today
    
    let currentBalance = principal;
    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    let totalInterest = 0;

    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Calculate interest for this month
      const monthlyInterest = currentBalance * (interestRate / 100);
      totalInterest += monthlyInterest;
      
      // Add interest to balance
      currentBalance += monthlyInterest;
      
      // Subtract payments
      const paymentThisMonth = paymentsByMonth[monthKey] || 0;
      currentBalance -= paymentThisMonth;
      
      results.push({
        month: monthKey,
        startingBalance: currentBalance - monthlyInterest + paymentThisMonth,
        interestAdded: monthlyInterest,
        paymentReceived: paymentThisMonth,
        endingBalance: currentBalance
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return results;
  }, [principal, interestRate, loanDate, entries]);"""

new_calc = """  // Chronological timeline replay algorithm
  const calculations = useMemo(() => {
    if (!loanDate || !principal) return [];
    
    const results = [];
    let currentBalance = principal;
    let lastDate = new Date(loanDate);
    
    // We only care about payments (credits)
    const paymentEntries = entries
      .filter(e => e.credit && Number(e.credit) > 0)
      .map(e => ({
        date: new Date(e.entry_date),
        amount: Number(e.credit),
        particulars: e.particulars || 'Payment'
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Add a final "Today" event if there are no payments today, to calculate interest up to now
    const today = new Date();
    if (paymentEntries.length === 0 || paymentEntries[paymentEntries.length - 1].date.toDateString() !== today.toDateString()) {
      paymentEntries.push({ date: today, amount: 0, particulars: 'Interest Accrued to Date' });
    }

    const dailyRate = (interestRate / 100) / 30.0; // Approximation for daily compound

    for (const payment of paymentEntries) {
      if (payment.date < lastDate) continue; // Skip invalid past dates

      const diffTime = Math.abs(payment.date.getTime() - lastDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const startingBalance = currentBalance;
      
      // Calculate interest for the days between last event and this event
      // Simple daily interest on the compounded balance
      const interestAdded = currentBalance * dailyRate * diffDays;
      
      currentBalance += interestAdded;
      currentBalance -= payment.amount;

      results.push({
        date: payment.date.toISOString().split('T')[0],
        particulars: payment.particulars,
        days: diffDays,
        startingBalance,
        interestAdded,
        paymentReceived: payment.amount,
        endingBalance: currentBalance
      });

      lastDate = payment.date;
    }
    
    return results;
  }, [principal, interestRate, loanDate, entries]);"""

content = content.replace(old_calc, new_calc)

old_table_header = """          <tr className="bg-slate-100 uppercase text-xs font-black tracking-wider text-slate-700">
            <th className="border border-slate-300 p-2 text-center">Month</th>
            <th className="border border-slate-300 p-2 text-right">Start Bal</th>
            <th className="border border-slate-300 p-2 text-right">Interest</th>
            <th className="border border-slate-300 p-2 text-right">Payment</th>
            <th className="border border-slate-300 p-2 text-right">End Bal</th>
          </tr>"""

new_table_header = """          <tr className="bg-slate-100 uppercase text-xs font-black tracking-wider text-slate-700">
            <th className="border border-slate-300 p-2 text-center">Date</th>
            <th className="border border-slate-300 p-2 text-left">Particulars</th>
            <th className="border border-slate-300 p-2 text-center">Days</th>
            <th className="border border-slate-300 p-2 text-right">Start Bal</th>
            <th className="border border-slate-300 p-2 text-right">Interest</th>
            <th className="border border-slate-300 p-2 text-right">Payment</th>
            <th className="border border-slate-300 p-2 text-right">End Bal</th>
          </tr>"""

content = content.replace(old_table_header, new_table_header)

old_table_row = """          {calculations.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
              <td className="border border-slate-300 p-2 text-center font-mono font-bold">{row.month}</td>
              <td className="border border-slate-300 p-2 text-right font-mono text-slate-600">₹{Math.round(row.startingBalance).toLocaleString('en-IN')}</td>
              <td className="border border-slate-300 p-2 text-right font-mono text-red-600">+₹{Math.round(row.interestAdded).toLocaleString('en-IN')}</td>
              <td className="border border-slate-300 p-2 text-right font-mono text-green-700">-₹{Math.round(row.paymentReceived).toLocaleString('en-IN')}</td>
              <td className="border border-slate-300 p-2 text-right font-mono font-black text-slate-900">₹{Math.round(row.endingBalance).toLocaleString('en-IN')}</td>
            </tr>
          ))}"""

new_table_row = """          {calculations.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
              <td className="border border-slate-300 p-2 text-center font-mono font-bold">{row.date.split('-').reverse().join('/')}</td>
              <td className="border border-slate-300 p-2 text-left text-slate-700">{row.particulars}</td>
              <td className="border border-slate-300 p-2 text-center font-mono text-slate-500">{row.days}</td>
              <td className="border border-slate-300 p-2 text-right font-mono text-slate-600">₹{Math.round(row.startingBalance).toLocaleString('en-IN')}</td>
              <td className="border border-slate-300 p-2 text-right font-mono text-red-600">+₹{Math.round(row.interestAdded).toLocaleString('en-IN')}</td>
              <td className="border border-slate-300 p-2 text-right font-mono text-green-700">{row.paymentReceived > 0 ? `-₹${Math.round(row.paymentReceived).toLocaleString('en-IN')}` : '-'}</td>
              <td className="border border-slate-300 p-2 text-right font-mono font-black text-slate-900">₹{Math.round(row.endingBalance).toLocaleString('en-IN')}</td>
            </tr>
          ))}"""

content = content.replace(old_table_row, new_table_row)

with open('src/components/finance/CompoundInterestModal.tsx', 'w') as f:
    f.write(content)
