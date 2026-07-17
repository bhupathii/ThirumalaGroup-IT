import re

with open('src/pages/finance/BusinessReport.tsx', 'r') as f:
    content = f.read()

# I want to replace the first Partner Summary Section block which was mistakenly retained.
old_ui_summary = """          {/* Partner Summary Section */}
          <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${showPrintPreview ? 'print:hidden' : ''}`}>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-slate-900 font-bold uppercase text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Partner Summary
              </h2>
            </div>
            <div className="p-4 grid grid-cols-5 gap-4 bg-slate-50/50">
            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
              <span className="text-slate-400 finance-small-label uppercase font-bold">Capital Invested</span>
              <span className="text-lg font-black text-slate-900">₹{summary.capitalInvested.toLocaleString('en-IN')}</span>
            </div>"""

# Wait, let me just find the exact text using regex and delete the old cards.
# Actually it's easier to just take the good code from 'Partner Summary Section' up to 'Loan Details Section' and replace the whole chunk.

start_marker = "{/* Partner Summary Section */}"
end_marker = "{/* Loan Details Section */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    good_block = """          {/* Partner Summary Section */}
          <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${showPrintPreview ? 'print:hidden' : ''}`}>
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-slate-900 font-bold uppercase text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Partner Summary
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4">
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Capital Invested</span>
                <span className="text-lg font-black text-slate-900">₹{summary.capitalInvested.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Principal Out</span>
                <span className="text-lg font-black text-slate-900">₹{Math.round(summary.principalOutstanding).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                <span className="text-slate-400 finance-small-label uppercase font-bold">Total Due</span>
                <span className="text-lg font-black text-rose-700">₹{Math.round(summary.totalDue).toLocaleString('en-IN')}</span>
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
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-center">
                <span className="text-blue-700 finance-small-label uppercase font-bold">Total Loans</span>
                <span className="text-lg font-black text-blue-800">{summary.totalLoans}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-600 finance-small-label uppercase font-bold">Active Loans</span>
                <span className="text-lg font-black text-slate-800">{summary.activeLoans}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-slate-600 finance-small-label uppercase font-bold">Closed Loans</span>
                <span className="text-lg font-black text-slate-800">{summary.closedLoans}</span>
              </div>
            </div>
          </div>

"""
    new_content = content[:start_idx] + good_block + content[end_idx:]
    with open('src/pages/finance/BusinessReport.tsx', 'w') as f:
        f.write(new_content)
