import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { LogOut, User, Plus, BookOpen, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTableMode } from '../../contexts/TableModeContext';

const FinanceHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const { setMode } = useTableMode();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleBackToModeSelection = () => {
    navigate('/mode-selection');
  };

  return (
    <header className="bg-[#0b1329] text-white px-6 py-3 flex items-center justify-between border-b border-slate-800 select-none">
      {/* Left side logo and title */}
      <div className="flex items-center gap-4">
        <button 
          onClick={handleBackToModeSelection}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Back to Mode Selection"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm tracking-wider shadow-inner text-white">
            TF
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-white leading-none">
              TIRUMALA FINANCE
            </h1>
            <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-1">
              FINANCE MANAGEMENT SYSTEM
            </p>
          </div>
        </div>
      </div>

      {/* Right side controls, quick actions and status */}
      <div className="flex items-center gap-6">
        {/* Quick global action buttons */}
        <div className="hidden md:flex items-center gap-2.5">
          <Link
            to="/finance/loan-entry"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            NEW LOAN
          </Link>
          <Link
            to="/finance/daybook"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5" />
            CASH BOOK
          </Link>
        </div>

        {/* Date and dynamic clock */}
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-slate-300 tracking-wider">
            {format(time, 'dd MMM yyyy, HH:mm:ss').toUpperCase()}
          </p>
        </div>

        {/* User profile & actions */}
        <div className="flex items-center gap-4 border-l border-slate-800 pl-4">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-black text-slate-200 border border-slate-600 uppercase">
              {user?.username.charAt(0)}
            </span>
            <span className="hidden lg:inline text-slate-300 font-bold">
              {user?.username.toUpperCase()}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default FinanceHeader;
