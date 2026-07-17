import re

with open('src/pages/finance/BusinessReport.tsx', 'r') as f:
    content = f.read()

# Add sortNumerically import
if 'sortNumerically' not in content:
    content = content.replace("import { getLocalBusinessDateISO } from '../../utils/dateUtils';", "import { getLocalBusinessDateISO } from '../../utils/dateUtils';\nimport { sortNumerically } from '../../lib/financialCalculations';")

# Sort loans in the map function
content = content.replace("loans.map(row => (", "loans.sort((a,b) => sortNumerically(a.cdNumber, b.cdNumber)).map(row => (")

# UI summary replacement
old_ui_summary = r"\{\/\* Summary Cards \*\/}.*?(?=\{\/\* Unified Disbursals Table \*\/})"

new_ui_summary = """{/* Partner Summary Section */}
          <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${showPrintPreview ? 'print:hidden' : ''} mb-6`}>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-slate-900 font-bold uppercase text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Partner Summary
              </h2>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50/50">
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Capital Invested</span>
                <span className="text-lg font-black text-slate-900">₹{summary.capitalInvested.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Total Loans</span>
                <span className="text-lg font-black text-blue-800">{summary.totalLoans}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Active Loans</span>
                <span className="text-lg font-black text-slate-800">{summary.activeLoans}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Closed Loans</span>
                <span className="text-lg font-black text-slate-800">{summary.closedLoans}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Principal Out</span>
                <span className="text-lg font-black text-slate-900">₹{Math.round(summary.principalOutstanding).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                <span className="text-emerald-700 finance-small-label uppercase font-bold">Interest Received</span>
                <span className="text-lg font-black text-emerald-800">₹{Math.round(summary.interestReceived).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                <span className="text-emerald-700 finance-small-label uppercase font-bold">Penalty Received</span>
                <span className="text-lg font-black text-emerald-800">₹{Math.round(summary.penaltyReceived).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 shadow-sm flex flex-col justify-center">
                <span className="text-rose-700 finance-small-label uppercase font-bold">Pending Interest</span>
                <span className="text-lg font-black text-rose-800">₹{Math.round(summary.pendingInterest).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 shadow-sm flex flex-col justify-center">
                <span className="text-rose-700 finance-small-label uppercase font-bold">Pending Penalty</span>
                <span className="text-lg font-black text-rose-800">₹{Math.round(summary.pendingPenalty).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Total Due</span>
                <span className="text-lg font-black text-rose-700">₹{Math.round(summary.totalDue).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          """
content = re.sub(old_ui_summary, new_ui_summary, content, flags=re.DOTALL)

# Also rename Unified Disbursals Table comment to Loan Details Section
content = content.replace("{/* Unified Disbursals Table */}", "{/* Loan Details Section */}")


# Print summary replacement
old_print_summary = r'<div className="grid grid-cols-5 gap-2">.*?<\/div>'
new_print_summary = """{/* Partner Summary - 10 Items */}
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

# Wait, `old_print_summary` needs to match the existing grid-cols-5 block which only occurs once under `<div className="mt-4">`.
content = re.sub(old_print_summary, new_print_summary, content, flags=re.DOTALL, count=1)

with open('src/pages/finance/BusinessReport.tsx', 'w') as f:
    f.write(content)

