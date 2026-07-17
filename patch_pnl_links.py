import re

with open('src/pages/finance/ProfitAndLoss.tsx', 'r') as f:
    content = f.read()

# Add navigateToDetailedLedger
if "const navigateToDetailedLedger" not in content:
    func_code = """  const navigateToDetailedLedger = (head: string) => {
    navigate(`/finance/detailed-ledger?head=${encodeURIComponent(head)}&from=${startDate}&to=${endDate}`);
  };"""
    content = content.replace("  const totalIncome = useMemo", func_code + "\n\n  const totalIncome = useMemo")

# Update render for incomeHeads
old_income = """                <td className="border border-slate-300 p-2 font-bold text-slate-800 uppercase">{item.name}</td>"""
new_income = """                <td className="border border-slate-300 p-2 font-bold text-indigo-600 uppercase cursor-pointer hover:underline" onClick={() => navigateToDetailedLedger(item.name)}>{item.name}</td>"""
content = content.replace(old_income, new_income)

# Update render for expenseHeads
old_expense = """                <td className="border border-slate-300 p-2 font-bold text-slate-800 uppercase">{item.name}</td>"""
new_expense = """                <td className="border border-slate-300 p-2 font-bold text-indigo-600 uppercase cursor-pointer hover:underline" onClick={() => navigateToDetailedLedger(item.name)}>{item.name}</td>"""
content = content.replace(old_expense, new_expense)

# Update render for Balance Sheet heads
old_bs = """                  <td className="border border-slate-300 p-2 font-bold text-slate-800 uppercase">{item.accountName}</td>"""
new_bs = """                  <td className="border border-slate-300 p-2 font-bold text-indigo-600 uppercase cursor-pointer hover:underline" onClick={() => navigateToDetailedLedger(item.accountName)}>{item.accountName}</td>"""
content = content.replace(old_bs, new_bs)

with open('src/pages/finance/ProfitAndLoss.tsx', 'w') as f:
    f.write(content)
