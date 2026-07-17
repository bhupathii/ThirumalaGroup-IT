import re

with open('src/pages/finance/GeneralLedger.tsx', 'r') as f:
    content = f.read()

# Update table headers
old_headers = """                    <tr className="divide-x divide-slate-200">
                      <th className="px-3 py-2 text-left font-bold text-[15px] uppercase">Head of Account</th>
                      <th className="w-48 px-3 py-2 text-right font-bold text-[15px] uppercase">Credit (Cr)</th>
                      <th className="w-48 px-3 py-2 text-right font-bold text-[15px] uppercase">Debit (Dr)</th>
                      <th className="w-48 px-3 py-2 text-right font-bold text-[15px] uppercase">Balance</th>
                      <th className="w-20 px-2 py-2 text-center font-bold text-[15px] uppercase">Drill</th>
                    </tr>"""

new_headers = """                    <tr className="divide-x divide-slate-200">
                      <th className="px-3 py-2 text-left font-bold text-[15px] uppercase">Head of Account</th>
                      <th className="w-40 px-3 py-2 text-right font-bold text-[15px] uppercase text-slate-500">Opening Bal</th>
                      <th className="w-32 px-3 py-2 text-right font-bold text-[15px] uppercase">Credit (Cr)</th>
                      <th className="w-32 px-3 py-2 text-right font-bold text-[15px] uppercase">Debit (Dr)</th>
                      <th className="w-40 px-3 py-2 text-right font-bold text-[15px] uppercase">Closing Bal</th>
                      <th className="w-16 px-2 py-2 text-center font-bold text-[15px] uppercase">Drill</th>
                    </tr>"""

content = content.replace(old_headers, new_headers)

# Update table row
old_row = """                        <td className="px-3 py-1.5 text-slate-900 font-bold uppercase truncate">{s.head}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-700 font-bold font-mono whitespace-nowrap">
                          {s.credit > 0 ? `${s.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right text-red-700 font-bold font-mono whitespace-nowrap">
                          {s.debit > 0 ? `${s.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-black font-mono whitespace-nowrap ${s.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {Math.abs(s.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {s.balance >= 0 ? 'Cr' : 'Dr'}
                        </td>"""

new_row = """                        <td className="px-3 py-1.5 text-slate-900 font-bold uppercase truncate">{s.head}</td>
                        <td className={`px-3 py-1.5 text-right font-bold font-mono whitespace-nowrap ${s.openingBalance === 0 ? 'text-slate-300' : (s.openingBalance > 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                          {s.openingBalance === 0 ? '—' : `${Math.abs(s.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${s.openingBalance >= 0 ? 'Cr' : 'Dr'}`}
                        </td>
                        <td className="px-3 py-1.5 text-right text-emerald-700 font-bold font-mono whitespace-nowrap">
                          {s.periodCredit > 0 ? `${s.periodCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right text-red-700 font-bold font-mono whitespace-nowrap">
                          {s.periodDebit > 0 ? `${s.periodDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-black font-mono whitespace-nowrap ${s.closingBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {Math.abs(s.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {s.closingBalance >= 0 ? 'Cr' : 'Dr'}
                        </td>"""

content = content.replace(old_row, new_row)

# Update overall totals row
old_overall_row = """                      <td className="px-3 py-2 text-slate-800 uppercase text-[15px]">Grand Total:</td>
                      <td className="px-3 py-2 text-right text-emerald-755 font-black font-mono whitespace-nowrap">
                        {overallTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right text-red-755 font-black font-mono whitespace-nowrap">
                        {overallTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 py-2 text-right font-black font-mono whitespace-nowrap ${overallTotals.balance >= 0 ? 'text-emerald-900' : 'text-rose-905'}`}>
                        {Math.abs(overallTotals.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {overallTotals.balance >= 0 ? 'Cr' : 'Dr'}
                      </td>"""

new_overall_row = """                      <td className="px-3 py-2 text-slate-800 uppercase text-[15px]">Grand Total:</td>
                      <td className={`px-3 py-2 text-right font-black font-mono whitespace-nowrap ${overallTotals.openingBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {Math.abs(overallTotals.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {overallTotals.openingBalance >= 0 ? 'Cr' : 'Dr'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-755 font-black font-mono whitespace-nowrap">
                        {overallTotals.periodCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right text-red-755 font-black font-mono whitespace-nowrap">
                        {overallTotals.periodDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-3 py-2 text-right font-black font-mono whitespace-nowrap ${overallTotals.closingBalance >= 0 ? 'text-emerald-900' : 'text-rose-905'}`}>
                        {Math.abs(overallTotals.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {overallTotals.closingBalance >= 0 ? 'Cr' : 'Dr'}
                      </td>"""

content = content.replace(old_overall_row, new_overall_row)

with open('src/pages/finance/GeneralLedger.tsx', 'w') as f:
    f.write(content)
