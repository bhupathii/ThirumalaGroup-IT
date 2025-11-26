import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTableMode } from '../../contexts/TableModeContext';
import { supabaseDB } from '../../lib/supabaseDatabase';

interface CustomCalendarProps {
  onDateSelect: (date: string) => void;
  selectedDate?: string;
  onClose?: () => void;
  entries?: any[]; // Optional: if provided, use these entries instead of loading from DB
}

const CustomCalendar: React.FC<CustomCalendarProps> = ({
  onDateSelect,
  selectedDate = '',
  onClose,
  entries: providedEntries,
}) => {
  const { mode: tableMode } = useTableMode();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Load entries if not provided - reload when mode changes
  React.useEffect(() => {
    // Only load if entries are explicitly not provided (undefined or null)
    // If providedEntries is an empty array [], we still use it (means no entries exist)
    if (providedEntries === undefined || providedEntries === null) {
      const loadEntries = async () => {
        setLoadingEntries(true);
        try {
          console.log('📅 Loading entries for calendar, mode:', tableMode);
          const entries = await supabaseDB.getAllCashBookEntries();
          console.log('📅 Loaded entries for calendar:', entries.length);
          setAllEntries(entries);
        } catch (error) {
          console.error('Error loading entries for calendar:', error);
        } finally {
          setLoadingEntries(false);
        }
      };
      loadEntries();
    } else {
      // If entries are provided (even if empty array), use them
      setAllEntries([]);
    }
  }, [providedEntries, tableMode]);

  // Use provided entries or loaded entries
  // If providedEntries is explicitly undefined/null, use allEntries
  // If providedEntries is an array (even empty), use it
  const entries = providedEntries !== undefined && providedEntries !== null ? providedEntries : allEntries;

  // Get dates that have entries
  const getDatesWithEntries = useMemo(() => {
    const datesWithEntries = new Set<string>();
    if (!entries || entries.length === 0) {
      console.log('📅 No entries to process for calendar dots');
      return datesWithEntries;
    }
    
    console.log('📅 Processing', entries.length, 'entries for calendar dots, mode:', tableMode);
    
    entries.forEach((entry, index) => {
      if (entry.c_date) {
        try {
          // Handle both string and Date formats
          let dateStr = '';
          if (typeof entry.c_date === 'string') {
            // Handle datetime format: "2025-11-21 00:00:00" or "2025-11-21T00:00:00"
            // Extract just the date part (YYYY-MM-DD)
            const dateMatch = entry.c_date.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              dateStr = dateMatch[1]; // Extract YYYY-MM-DD part
            } else if (entry.c_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Already in YYYY-MM-DD format
              dateStr = entry.c_date;
            } else {
              // Try parsing as Date object
              const entryDate = new Date(entry.c_date);
              if (!isNaN(entryDate.getTime())) {
                dateStr = format(entryDate, 'yyyy-MM-dd');
              } else {
                // Try parsing as ISO string or other formats
                const parsed = Date.parse(entry.c_date);
                if (!isNaN(parsed)) {
                  dateStr = format(new Date(parsed), 'yyyy-MM-dd');
                }
              }
            }
          } else if (entry.c_date instanceof Date) {
            dateStr = format(entry.c_date, 'yyyy-MM-dd');
          }
          
          if (dateStr) {
            datesWithEntries.add(dateStr);
            // Log first few dates for debugging
            if (index < 10) {
              console.log(`📅 Entry ${index}: c_date="${entry.c_date}" → dateStr="${dateStr}"`);
            }
          } else {
            if (index < 10) {
              console.warn(`📅 Entry ${index}: Could not parse date:`, entry.c_date, typeof entry.c_date);
            }
          }
        } catch (error) {
          if (index < 10) {
            console.warn('Invalid date format for entry:', entry.c_date, error);
          }
        }
      } else {
        if (index < 10) {
          console.warn(`📅 Entry ${index}: No c_date field`);
        }
      }
    });
    
    const datesArray = Array.from(datesWithEntries).sort();
    console.log('📅 Dates with entries:', datesWithEntries.size, 'dates:', datesArray);
    return datesWithEntries;
  }, [entries, tableMode]);

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = startOfMonth(currentMonth);
  const lastDay = endOfMonth(currentMonth);
  const startDate = startOfWeek(firstDay);
  
  const days = [];
  const currentDate = new Date(startDate);
  
  for (let i = 0; i < 42; i++) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      if (direction === 'prev') {
        return subMonths(prev, 1);
      } else {
        return addMonths(prev, 1);
      }
    });
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    onDateSelect(dateStr);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 min-w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1 hover:bg-gray-100 rounded"
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold text-sm">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1 hover:bg-gray-100 rounded"
          type="button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-medium text-gray-500">
            {day}
          </div>
        ))}
        
        {days.map((date, index) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isCurrentMonth = date.getMonth() === month;
          const isToday = dateStr === format(today, 'yyyy-MM-dd');
          const isSelected = dateStr === selectedDate;
          const hasEntries = getDatesWithEntries.has(dateStr);
          
          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              type="button"
              className={`
                relative p-2 text-xs rounded hover:bg-blue-100 transition-colors
                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                ${isToday ? 'bg-blue-200 font-bold' : ''}
                ${isSelected ? 'bg-blue-500 text-white' : ''}
              `}
            >
              {date.getDate()}
              {hasEntries && (
                <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full opacity-80 shadow-sm"></div>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full opacity-80 shadow-sm"></div>
          <span>Has entries</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            type="button"
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomCalendar;

