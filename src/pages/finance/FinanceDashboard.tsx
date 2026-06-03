import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, 
  Edit, 
  Users, 
  Search, 
  Calculator, 
  DollarSign, 
  Camera, 
  History, 
  BookOpen, 
  Phone, 
  TrendingUp, 
  FileCheck, 
  Book, 
  AlertCircle,
  Calendar,
  Shield,
  ChevronRight
} from 'lucide-react';

const FinanceDashboard: React.FC = () => {
  const { user } = useAuth();

  const formattedDate = new Date().toLocaleDateString('en-IN', { 
    weekday: 'long', 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });

  const newEntries = [
    { label: 'Loans Entry Form', path: '/finance/loan-entry', icon: FileText },
    { label: 'Edit', path: '/finance/edit-loan-entry', icon: Edit },
    { label: 'Partners', path: '/finance/partners', icon: Users },
    { label: 'Search', path: '/finance/search', icon: Search },
    { label: 'General Calculation', path: '/finance/calculator', icon: Calculator },
    { label: 'Capital Entry Form', path: '/finance/capital-entry', icon: DollarSign },
    { label: 'Camera', path: '/finance/camera', icon: Camera },
    { label: 'Edited / Deleted Records', path: '/finance/logs', icon: History },
  ];

  const reports = [
    { label: 'Day Book', path: '/finance/daybook', icon: BookOpen },
    { label: 'General Ledger', path: '/finance/general-ledger', icon: BookOpen },
    { label: 'Phone Numbers Edit Form', path: '/finance/phone-editor', icon: Phone },
    { label: 'Profit and Loss', path: '/finance/pl', icon: TrendingUp },
    { label: 'Final Statement', path: '/finance/final-statement', icon: FileCheck },
    { label: 'Partner Performance', path: '/finance/partner-performance', icon: TrendingUp },
    { label: 'New Customers', path: '/finance/new-customers', icon: Users },
  ];

  const ledgerReports = [
    { label: 'CD Ledger', path: '/finance/cd-ledger', icon: Book },
    { label: 'STBD Ledger', path: '/finance/stbd-ledger', icon: Book },
    { label: 'HP Ledger', path: '/finance/hp-ledger', icon: Book },
    { label: 'TBD Ledger', path: '/finance/tbd-ledger', icon: Book },
    { label: 'Business', path: '/finance/business-report', icon: TrendingUp },
    { label: 'Dues List', path: '/finance/dues-ledger', icon: AlertCircle },
    { label: 'Aadhaar Search', path: '/finance/aadhaar-search', icon: Search },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header Card */}
      <div className="bg-[#0b1329] text-white border border-slate-800 rounded-xl p-5 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-slate-800/10 rounded-full blur-2xl pointer-events-none" />
        <div>
          <h1 className="text-2xl font-black tracking-tight">TIRUMALA FINANCE</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
            FINANCE MANAGEMENT SYSTEM
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase text-slate-350 z-10">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <Shield className="w-4 h-4 text-slate-400" />
            <span>
              {user?.is_admin ? 'ADMINISTRATOR' : 'STAFF ACCESS'}: {user?.username || 'STAFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Menus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Section 1: New Entries */}
        <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
            NEW ENTRIES
          </h3>
          <div className="space-y-2">
            {newEntries.map((item, idx) => (
              <Link
                key={idx}
                to={item.path}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/80 hover:border-slate-300 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-slate-100 rounded-lg bg-slate-50/50 text-slate-700 group-hover:bg-slate-100/80 transition-colors">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {item.label}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        {/* Section 2: Reports */}
        <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
            REPORTS
          </h3>
          <div className="space-y-2">
            {reports.map((item, idx) => (
              <Link
                key={idx}
                to={item.path}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/80 hover:border-slate-300 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-slate-100 rounded-lg bg-slate-50/50 text-slate-700 group-hover:bg-slate-100/80 transition-colors">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {item.label}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        {/* Section 3: Ledger / Reports */}
        <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
            LEDGER / REPORTS
          </h3>
          <div className="space-y-2">
            {ledgerReports.map((item, idx) => (
              <Link
                key={idx}
                to={item.path}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/80 hover:border-slate-300 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-slate-100 rounded-lg bg-slate-50/50 text-slate-700 group-hover:bg-slate-100/80 transition-colors">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {item.label}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export default FinanceDashboard;
