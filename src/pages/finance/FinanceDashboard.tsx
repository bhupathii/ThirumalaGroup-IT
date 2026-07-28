
import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTableMode } from '../../contexts/TableModeContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { 
  FileText, 
  Edit, 
  Users, 
  Shield, 
  BookOpen, 
  DollarSign, 
  Search, 
  Calculator, 
  Book, 
  TrendingUp, 
  AlertCircle, 
  ChevronRight,
  Plus, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalDisbursed: number;
  loansCount: number;
  totalOutstanding: number;
  collectedToday: number;
  overdueLoansCount: number;
}

const FinanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { mode: tableMode } = useTableMode();
  const { user } = useAuth();

  useEffect(() => {
    if (tableMode !== 'finance') {
      navigate('/', { replace: true });
    }
  }, [tableMode, navigate]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalDisbursed: 0,
    loansCount: 0,
    totalOutstanding: 0,
    collectedToday: 0,
    overdueLoansCount: 0
  });
  const [recentLoans, setRecentLoans] = useState<any[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    if (tableMode === 'finance') {
      fetchDashboardData();
    }
  }, [tableMode]);

  if (tableMode !== 'finance') {
    return null;
  }

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Get today's local date string formatted as YYYY-MM-DD
      const todayStr = getLocalBusinessDateISO();

      const [loans, txs, pendingCount, duesSummary] = await Promise.all([
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions(),
        user?.is_admin ? supabaseFinance.getPendingApprovalsCount() : Promise.resolve(0),
        supabaseFinance.getDuesLedgerSummary(todayStr)
      ]);
      setPendingApprovalsCount(pendingCount);

      // 1. Disbursed (All-time)
      const totalDisbursed = loans.reduce((sum, loan) => sum + Number(loan.amount), 0);
      const loansCount = loans.length;

      // 2. Outstanding & Overdue Loans
      let totalOutstanding = 0;
      let overdueCount = 0;

      const dues = duesSummary?.dues || [];
      dues.forEach((due: any) => {
        if (due.status === 'Active' || due.status === 'NPA_CLOSED') {
          totalOutstanding += Number(due.currentPrincipal || due.current_principal || due.principal || 0);
          if (due.status === 'Active' && (due.dueDays > 0 || due.due_days > 0)) {
            overdueCount++;
          }
        }
      });

      // 3. Collected Today (collections received on today's local date)
      const collectedToday = txs
        .filter(t => t.type === 'Collection' && t.date === todayStr)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      setStats({
        totalDisbursed,
        loansCount,
        totalOutstanding,
        collectedToday,
        overdueLoansCount: overdueCount
      });

      // Take 8 most recent disbursements
      setRecentLoans(loans.slice(0, 8));

    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      toast.error('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'New Loan', path: '/finance/loan-entry', icon: FileText },
    { label: 'Edit Loan', path: '/finance/edit-loan-entry', icon: Edit },
    { label: 'New Customer', path: '/finance/new-customer', icon: Users },
    { label: 'New Guarantor', path: '/finance/new-guarantor', icon: Shield },
    { label: 'Cash Book', path: '/finance/daybook', icon: BookOpen },
    { label: 'Capital', path: '/finance/capital-entry', icon: DollarSign },
    { label: 'Search', path: '/finance/search', icon: Search },
    { label: 'Calculator', path: '/finance/calculator', icon: Calculator },
    { label: 'CD Ledger', path: '/finance/cd-ledger', icon: Book },
    { label: 'HP Ledger', path: '/finance/hp-ledger', icon: Book },
    { label: 'STBD Ledger', path: '/finance/stbd-ledger', icon: Book },
    { label: 'TBD Ledger', path: '/finance/tbd-ledger', icon: Book },
  ];

  const reports = [
    { label: 'Day Book', path: '/finance/daybook', icon: BookOpen },
    { label: 'Daily Report', path: '/finance/new-customers', icon: FileText },
    { label: 'General Ledger', path: '/finance/general-ledger', icon: BookOpen },
    { label: 'Total Due List', path: '/finance/dues-ledger', icon: AlertCircle },
    { label: 'Outstanding List', path: '/finance/outstanding', icon: AlertTriangle },
    { label: 'P&L / Balance Sheet', path: '/finance/pl', icon: TrendingUp },
    { label: 'Final Statement', path: '/finance/final-statement', icon: FileText },
    { label: 'Business Details', path: '/finance/business-report', icon: FileText },
    { label: 'Partner Performance', path: '/finance/partner-performance', icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full select-none pb-4 px-1 text-slate-800">
      
      {/* Dashboard Page Title & Top Actions */}
      <div className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
        <div>
          <h1 className="text-[24px] font-bold uppercase tracking-tight text-slate-900 leading-none">DASHBOARD</h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase mt-1">
            OVERVIEW OF TODAY'S CD LEDGER OPERATIONS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/finance/loan-entry"
            className="inline-flex items-center justify-center gap-1.5 px-4 h-[48px] bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors font-bold text-[16px] uppercase"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            NEW LOAN
          </Link>
          <Link
            to="/finance/daybook"
            className="inline-flex items-center justify-center gap-1.5 px-4 h-[48px] bg-white text-slate-800 border border-slate-250 rounded hover:bg-slate-50 transition-colors font-bold text-[16px] uppercase"
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            CASH BOOK
          </Link>
        </div>
      </div>

      {/* Pending Approvals Card (Admin Only) */}
      {user?.is_admin && pendingApprovalsCount > 0 && (
        <div className="bg-[#fffbeb] border border-amber-200 rounded-lg p-3 shadow-sm flex justify-between items-center gap-4 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded border border-amber-200 shadow-inner">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-amber-800 text-[16px] uppercase tracking-wide leading-none">
                Transactions Pending Approval
              </h3>
              <p className="text-slate-600 text-[14px] mt-1 font-semibold">
                {pendingApprovalsCount} Pending validation and approval
              </p>
            </div>
          </div>
          <Link
            to="/finance/transaction-approval"
            className="inline-flex items-center justify-center px-4 h-[44px] bg-amber-600 text-white hover:bg-amber-700 rounded text-[16px] font-bold uppercase transition-all shadow-sm"
          >
            Verify & Approve
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* TODAY AT A GLANCE section */}
      <div className="space-y-1.5">
        <h2 className="text-[18px] font-bold uppercase tracking-wider text-slate-800">
          TODAY AT A GLANCE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Card 1: Disbursed (All-time) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-between h-[90px]">
            <div className="flex justify-between items-start">
              <span className="text-[17px] font-bold uppercase text-slate-500">
                DISBURSED (ALL-TIME)
              </span>
              <BookOpen className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex justify-between items-end">
              <div className="text-[26px] font-black text-slate-900 leading-none">
                {stats.totalDisbursed.toLocaleString('en-IN')}
              </div>
              <div className="text-[14px] text-slate-500 font-bold uppercase leading-none">
                {stats.loansCount} Loans
              </div>
            </div>
          </div>

          {/* Card 2: Outstanding */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-between h-[90px]">
            <div className="flex justify-between items-start">
              <span className="text-[17px] font-bold uppercase text-slate-500">
                OUTSTANDING
              </span>
              <TrendingUp className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex justify-between items-end">
              <div className="text-[26px] font-black text-rose-600 leading-none">
                {stats.totalOutstanding.toLocaleString('en-IN')}
              </div>
              <div className="text-[14px] text-slate-500 font-bold uppercase leading-none">
                PRINCIPAL + INT
              </div>
            </div>
          </div>

          {/* Card 3: Collected Today */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-between h-[90px]">
            <div className="flex justify-between items-start">
              <span className="text-[17px] font-bold uppercase text-slate-500">
                COLLECTED TODAY
              </span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex justify-between items-end">
              <div className="text-[26px] font-black text-emerald-600 leading-none">
                {stats.collectedToday.toLocaleString('en-IN')}
              </div>
              <div className="text-[14px] text-slate-500 font-bold uppercase leading-none">
                CASHBOOK DEBIT
              </div>
            </div>
          </div>

          {/* Card 4: Overdue Loans */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-between h-[90px]">
            <div className="flex justify-between items-start">
              <span className="text-[17px] font-bold uppercase text-slate-500">
                OVERDUE LOANS
              </span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex justify-between items-end">
              <div className="text-[26px] font-black text-amber-600 leading-none">
                {stats.overdueLoansCount}
              </div>
              <div className="text-[14px] text-slate-500 font-bold uppercase leading-none">
                PAST DUE DATE
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* QUICK ACTIONS section */}
      <div className="space-y-1.5">
        <h2 className="text-[18px] font-bold uppercase tracking-wider text-slate-800">
          QUICK ACTIONS
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {quickActions.map((action, idx) => {
            const IconComponent = action.icon;
            return (
              <Link
                key={idx}
                to={action.path}
                className="bg-white border border-slate-200 rounded p-3 shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2.5 h-[48px] group"
              >
                <div className="text-slate-500 group-hover:text-slate-900 transition-colors">
                  <IconComponent className="w-4 h-4" />
                </div>
                <span className="text-[16px] font-bold uppercase text-slate-850 truncate leading-none">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* RECENT LOANS & REPORTS side-by-side grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        
        {/* Left Column: Recent Loans */}
        <div className="lg:col-span-2 space-y-1.5">
          <div className="flex justify-between items-center border-b border-slate-200 pb-1 px-1">
            <h2 className="text-[18px] font-bold uppercase tracking-wider text-slate-800">
              RECENT LOANS
            </h2>
            <Link
              to="/finance/search"
              className="text-[14px] font-bold text-indigo-700 hover:underline uppercase"
            >
              VIEW ALL &rarr;
            </Link>
          </div>

          {recentLoans.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center bg-white min-h-[220px]">
              <div className="text-slate-800 font-bold text-[17px] uppercase">
                No loans yet
              </div>
              <div className="text-slate-500 mt-1 mb-4 text-[14px]">
                Start by creating your first loan entry.
              </div>
              <Link
                to="/finance/loan-entry"
                className="inline-flex items-center justify-center gap-1.5 px-4 h-[44px] bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors font-bold text-[16px] uppercase"
              >
                <Plus className="w-4 h-4" />
                Create loan
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-[16px] table-fixed divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr className="divide-x divide-slate-200">
                      <th className="w-24 px-3 py-2 text-left font-bold text-[15px] uppercase">Loan ID</th>
                      <th className="px-3 py-2 text-left font-bold text-[15px] uppercase">Customer Name</th>
                      <th className="w-32 px-3 py-2 text-left font-bold text-[15px] uppercase">Date</th>
                      <th className="w-32 px-3 py-2 text-right font-bold text-[15px] uppercase">Amount</th>
                      <th className="w-24 px-3 py-2 text-center font-bold text-[15px] uppercase">Category</th>
                      <th className="w-28 px-3 py-2 text-center font-bold text-[15px] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 divide-x divide-slate-50">
                    {recentLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors" style={{ height: '38px' }}>
                        <td className="px-3 py-1.5 font-mono text-slate-900 font-bold truncate">
                          {loan.loan_id}
                        </td>
                        <td className="px-3 py-1.5 text-slate-900 font-bold uppercase truncate">
                          {loan.customer?.name || 'N/A'}
                        </td>
                        <td className="px-3 py-1.5 text-slate-550 truncate">
                          {new Date(loan.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-900 font-bold font-mono">
                          {Number(loan.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-center text-slate-600 font-bold uppercase">
                          {loan.loan_category?.trim().toUpperCase() || 'CD'}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[14px] font-bold uppercase ${ loan.status === 'Active' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-500' }`}
                          >
                            {loan.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Reports */}
        <div className="space-y-1.5">
          <div className="border-b border-slate-200 pb-1 px-1">
            <h2 className="text-[18px] font-bold uppercase tracking-wider text-slate-800">
              REPORTS
            </h2>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-1.5 divide-y divide-slate-100 flex flex-col gap-0.5">
            {reports.map((report, idx) => {
              const IconComponent = report.icon;
              return (
                <Link
                  key={idx}
                  to={report.path}
                  className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 transition-colors rounded group h-[40px]"
                >
                  <div className="flex items-center gap-2.5">
                    <IconComponent className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                    <span className="text-slate-700 group-hover:text-slate-900 transition-colors text-[16px] font-bold uppercase">
                      {report.label}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};

export default FinanceDashboard;
