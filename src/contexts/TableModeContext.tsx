import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/offlineQueueDB';
import { toast } from 'react-hot-toast';
import { queryClient } from '../lib/queryClient';

type TableMode = 'regular' | 'itr' | 'finance';

interface TableModeContextType {
  mode: TableMode;
  toggleMode: () => void | Promise<void>;
  setMode: (mode: TableMode) => void | Promise<void>;
  isITRMode: boolean;
  isFinanceMode: boolean;
}

const TableModeContext = createContext<TableModeContextType | undefined>(undefined);

export const useTableMode = () => {
  const context = useContext(TableModeContext);
  if (context === undefined) {
    throw new Error('useTableMode must be used within a TableModeProvider');
  }
  return context;
};

export const TableModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Load mode from localStorage, default to 'regular'
  const [mode, setMode] = useState<TableMode>(() => {
    const saved = localStorage.getItem('table_mode');
    return (saved === 'itr' ? 'itr' : saved === 'finance' ? 'finance' : 'regular') as TableMode;
  });

  // Save to localStorage whenever mode changes
  useEffect(() => {
    localStorage.setItem('table_mode', mode);
    window.dispatchEvent(
      new CustomEvent<TableMode>('table-mode-changed', {
        detail: mode,
      })
    );
  }, [mode]);

  const toggleMode = async () => {
    try {
      const count = await db.queued_operations
        .where('status')
        .equals('pending_sync')
        .count();
      if (count > 0) {
        toast.error(`Cannot switch modes while there are ${count} unsynchronized records. Please sync first.`);
        return;
      }
    } catch (err) {
      console.error('Failed to check offline queue before toggling mode:', err);
    }
    // Clear all React Query cache so next render fetches fresh data for the new mode
    queryClient.clear();
    setMode(prev => (prev === 'regular' ? 'itr' : prev === 'itr' ? 'finance' : 'regular'));
  };

  const setModeDirect = async (newMode: TableMode) => {
    if (newMode === mode) return;
    try {
      const count = await db.queued_operations
        .where('status')
        .equals('pending_sync')
        .count();
      if (count > 0) {
        toast.error(`Cannot switch modes while there are ${count} unsynchronized records. Please sync first.`);
        return;
      }
    } catch (err) {
      console.error('Failed to check offline queue before setting mode:', err);
    }
    // Clear all React Query cache so next render fetches fresh data for the new mode
    queryClient.clear();
    setMode(newMode);
  };

  const value: TableModeContextType = {
    mode,
    toggleMode,
    setMode: setModeDirect,
    isITRMode: mode === 'itr',
    isFinanceMode: mode === 'finance',
  };

  return (
    <TableModeContext.Provider value={value}>
      {children}
    </TableModeContext.Provider>
  );
};

