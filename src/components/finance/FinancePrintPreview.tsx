import React, { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '../UI/Button'; // Assuming Button exists, or I will use standard buttons. Wait, I will use raw HTML buttons to avoid dependency issues if Button is not there.

interface FinancePrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  documentTitle: string;
  printedDate?: string;
  children: React.ReactNode;
}

const FinancePrintPreview: React.FC<FinancePrintPreviewProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  documentTitle,
  printedDate,
  children,
}) => {
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4 md:p-8 print:p-0 print:bg-white print:block">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-5xl w-full mx-auto overflow-hidden print:max-w-none print:border-none print:shadow-none print:rounded-none">
          
          {/* Header Actions */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 font-bold uppercase mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                PRINT DOCUMENT
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
                CLOSE
              </button>
            </div>
          </div>

          {/* Print Document A4 Container */}
          <div className="p-8 bg-white text-black print-document font-sans print:p-0">
            {/* Document Header */}
            <div className="text-center pb-6 border-b-2 border-slate-900 mb-6">
              <h2 className="text-2xl font-black tracking-widest uppercase">TIRUMALA FINANCE</h2>
              <p className="text-base font-bold uppercase tracking-wider mt-1">{documentTitle}</p>
            </div>

            {/* Injected Content */}
            {children}

            {/* Document Footer */}
            <div className="mt-12 text-center text-xs font-semibold text-slate-500 print:mt-16">
              GENERATED ON: {printedDate || new Date().toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          /* Hide app layout elements */
          aside, header, nav, .hide-on-print {
            display: none !important;
          }
          
          /* Override body styles for clean print */
          body, html {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Ensure the print document has basic clean styles */
          .print-document {
            display: block !important;
            background: white !important;
            color: black !important;
            font-size: 12px !important;
          }

          /* Table cleanups for print */
          .print-document table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .print-document th, .print-document td {
            border: 1px solid #000000 !important;
            padding: 6px !important;
            color: black !important;
          }
          .print-document th {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  );
};

export default FinancePrintPreview;
