import React, { useState } from 'react';
import { X, Printer, Calculator } from 'lucide-react';
import FinancePrintPreview from './FinancePrintPreview';

interface CompoundInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  cdNumber: string;
  customerName: string;
  interestRate: number;
  penaltyPercent: number;
  loanDate: string;
  reportRows: any[];
  summary: any;
}

const CompoundInterestModal: React.FC<CompoundInterestModalProps> = ({
  isOpen,
  onClose,
  cdNumber,
  customerName,
  interestRate,
  penaltyPercent,
  loanDate,
  reportRows,
  summary
}) => {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !summary) return null;

  if (!isOpen) return null;

  const printableContent = (
    <div className="p-8 bg-white text-slate-900 font-sans">
      <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest">CI Calculation Report</h2>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-6 gap-4 bg-slate-50 p-4 rounded-t-lg border border-b-0 border-slate-200">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Borrower</p>
            <p className="text-sm font-bold truncate" title={customerName}>{customerName || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">CD Number</p>
            <p className="text-sm font-mono font-bold">{cdNumber || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Rate</p>
            <p className="text-sm font-mono font-bold">{interestRate.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Penalty</p>
            <p className="text-sm font-mono font-bold">{penaltyPercent.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Loan Date</p>
            <p className="text-sm font-mono font-bold">{loanDate ? new Date(loanDate).toLocaleDateString('en-GB') : '-'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Calculated Until</p>
            <p className="text-sm font-mono font-bold">{summary.calculatedUntil.split('-').reverse().join('/')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 bg-slate-100 p-4 rounded-b-lg border border-slate-200 text-center items-center">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Principal</p>
            <p className="text-lg font-mono font-bold text-slate-700">₹{summary.initialPrincipal.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Compound Interest Earned</p>
            <p className="text-lg font-mono font-bold text-red-600">
              + ₹{Math.round(summary.compoundInterestEarned || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Future Value</p>
            <p className="text-xl font-mono font-black text-slate-900">
              = ₹{Math.round(summary.finalCompoundBalance || 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse border border-slate-300 text-sm">
        <thead>
          <tr className="bg-slate-100 uppercase text-xs font-black tracking-wider text-slate-700">
            <th className="border border-slate-300 p-2 text-center">Date</th>
            <th className="border border-slate-300 p-2 text-left">Particulars</th>
            <th className="border border-slate-300 p-2 text-center">Days</th>
            <th className="border border-slate-300 p-2 text-right">Start Bal</th>
            <th className="border border-slate-300 p-2 text-right">Interest</th>
            <th className="border border-slate-300 p-2 text-right">Payment</th>
            <th className="border border-slate-300 p-2 text-right">Future Value</th>
          </tr>
        </thead>
        <tbody>
          {reportRows.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
              <td className="border border-slate-300 p-2 text-center font-mono font-bold">{row.date.split('-').reverse().join('/')}</td>
              <td className="border border-slate-300 p-2 text-left text-slate-700">{row.particulars}</td>
              <td className="border border-slate-300 p-2 text-center font-mono text-slate-500">{row.days}</td>
              <td className="border border-slate-300 p-2 text-right font-mono text-slate-600">₹{Math.round(row.startingBalance).toLocaleString('en-IN')}</td>
              <td className="border border-slate-300 p-2 text-right font-mono text-red-600">
                {row.interestAdded > 0 ? `+₹${Math.round(row.interestAdded).toLocaleString('en-IN')}` : '-'}
              </td>
              <td className="border border-slate-300 p-2 text-right font-mono text-green-700">
                {row.paymentReceived > 0 ? `-₹${Math.round(row.paymentReceived).toLocaleString('en-IN')}` : '-'}
              </td>
              <td className="border border-slate-300 p-2 text-right font-mono font-black text-slate-900">₹{Math.round(row.endingBalance).toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
          
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">CI Calculation Report</h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase mt-0.5 tracking-wider">A/C: {cdNumber} | {customerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPrinting(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs uppercase rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-rose-500 p-2 bg-white hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 hover:border-rose-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-0">
            {printableContent}
          </div>
          
        </div>
      </div>

      <FinancePrintPreview
        isOpen={isPrinting}
        onClose={() => setIsPrinting(false)}
        title="CI Calculation Report"
        documentTitle={`Compound_Interest_${cdNumber}`}
      >
        {printableContent}
      </FinancePrintPreview>
    </>
  );
};

export default CompoundInterestModal;
