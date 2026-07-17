import re

with open('src/pages/finance/BusinessReport.tsx', 'r') as f:
    content = f.read()

# Add sortNumerically import
if 'sortNumerically' not in content:
    content = content.replace("import { getLocalBusinessDateISO } from '../../utils/dateUtils';", "import { getLocalBusinessDateISO } from '../../utils/dateUtils';\nimport { sortNumerically } from '../../lib/financialCalculations';")

# Sort loans in the map functions
content = content.replace("loans.map(row => (", "loans.sort((a,b) => sortNumerically(a.cdNumber, b.cdNumber)).map(row => (")
# Make sure I didn't replace it twice
content = content.replace("loans.sort((a,b) => sortNumerically(a.cdNumber, b.cdNumber)).sort((a,b) => sortNumerically(a.cdNumber, b.cdNumber))", "loans.sort((a,b) => sortNumerically(a.cdNumber, b.cdNumber))")

# Update the print view for summary cards to show all 10 cards using 2 rows of 5
old_print_summary = """          <div className="grid grid-cols-5 gap-2">
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Capital Invested</span><p className="font-black text-sm">₹{summary.capitalInvested.toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Principal Out</span><p className="font-black text-sm">₹{Math.round(summary.principalOutstanding).toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Total Due</span><p className="font-black text-sm text-rose-700">₹{Math.round(summary.totalDue).toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded bg-emerald-50"><span className="font-bold uppercase text-[9px] block text-emerald-700">Int Received</span><p className="font-black text-sm text-emerald-800">₹{Math.round(summary.interestReceived).toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded bg-rose-50"><span className="font-bold uppercase text-[9px] block text-rose-700">Pend Int</span><p className="font-black text-sm text-rose-800">₹{Math.round(summary.pendingInterest).toLocaleString('en-IN')}</p></div>
          </div>"""

new_print_summary = """          {/* Partner Summary - 10 Items */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Capital Invested</span><p className="font-black text-sm">₹{summary.capitalInvested.toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Total Loans</span><p className="font-black text-sm text-blue-800">{summary.totalLoans}</p></div>
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Active Loans</span><p className="font-black text-sm text-slate-800">{summary.activeLoans}</p></div>
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Closed Loans</span><p className="font-black text-sm text-slate-800">{summary.closedLoans}</p></div>
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Principal Out</span><p className="font-black text-sm">₹{Math.round(summary.principalOutstanding).toLocaleString('en-IN')}</p></div>
            
            <div className="border p-2 rounded bg-emerald-50"><span className="font-bold uppercase text-[9px] block text-emerald-700">Int Received</span><p className="font-black text-sm text-emerald-800">₹{Math.round(summary.interestReceived).toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded bg-emerald-50"><span className="font-bold uppercase text-[9px] block text-emerald-700">Pen Received</span><p className="font-black text-sm text-emerald-800">₹{Math.round(summary.penaltyReceived).toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded bg-rose-50"><span className="font-bold uppercase text-[9px] block text-rose-700">Pend Int</span><p className="font-black text-sm text-rose-800">₹{Math.round(summary.pendingInterest).toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded bg-rose-50"><span className="font-bold uppercase text-[9px] block text-rose-700">Pend Pen</span><p className="font-black text-sm text-rose-800">₹{Math.round(summary.pendingPenalty).toLocaleString('en-IN')}</p></div>
            <div className="border p-2 rounded"><span className="font-bold uppercase text-[9px] block text-slate-500">Total Due</span><p className="font-black text-sm text-rose-700">₹{Math.round(summary.totalDue).toLocaleString('en-IN')}</p></div>
          </div>"""

content = content.replace(old_print_summary, new_print_summary)

# Reorganize the UI summary cards block to have a section title
old_ui_summary = """          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">"""

new_ui_summary = """          {/* Partner Summary Section */}
          <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${showPrintPreview ? 'print:hidden' : ''}`}>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-slate-900 font-bold uppercase text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Partner Summary
              </h2>
            </div>
            <div className="p-4 grid grid-cols-5 gap-4">"""

content = content.replace(old_ui_summary, new_ui_summary)

# The UI summary cards previously ended with </div>
old_ui_summary_end = """              <span className="text-slate-600 finance-small-label uppercase font-bold">Closed Loans</span>
              <span className="text-lg font-black text-slate-800">{summary.closedLoans}</span>
            </div>
          </div>

          {/* Unified Disbursals Table */}"""

new_ui_summary_end = """              <span className="text-slate-600 finance-small-label uppercase font-bold">Closed Loans</span>
              <span className="text-lg font-black text-slate-800">{summary.closedLoans}</span>
            </div>
          </div>
          </div>

          {/* Loan Details Section */}"""

content = content.replace(old_ui_summary_end, new_ui_summary_end)

# Also fix the grid-cols-4 to grid-cols-5 in the UI if it was missed, wait, I already replaced the wrapping div in new_ui_summary to `grid-cols-5`. 

# Let's write the modified content back
with open('src/pages/finance/BusinessReport.tsx', 'w') as f:
    f.write(content)

