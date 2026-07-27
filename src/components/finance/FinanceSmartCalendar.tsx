import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  format, 
  startOfMonth, 
  startOfWeek, 
  addDays, 
  subMonths, 
  addMonths, 
  isSameMonth, 
  isSameDay 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { 
  FinanceModuleKey, 
  getFinanceModuleEventDates 
} from '../../services/financeCalendarService';

export interface FinanceSmartCalendarProps {
  value?: string; // ISO format YYYY-MM-DD
  onChange?: (dateISO: string) => void;
  module?: FinanceModuleKey;
  eventProvider?: (year: number, month: number) => Promise<Set<string>>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  className?: string;
  mode?: 'popover' | 'inline';
  allowClear?: boolean;
  compact?: boolean;
  onMonthChange?: (year: number, month: number) => void;
  refreshTrigger?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Converts ISO YYYY-MM-DD to display "DD/MM/YYYY" format (e.g. 25/07/2026)
 */
export function isoToDisplayFormatted(isoStr: string): string {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    const [yStr, mStr, dStr] = parts;
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
  }
  const dateObj = new Date(isoStr);
  if (!isNaN(dateObj.getTime())) {
    return format(dateObj, 'dd/MM/yyyy');
  }
  return isoStr;
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const maxDaysInMonth = new Date(year, month, 0).getDate();
  return day <= maxDaysInMonth;
}

/**
 * Auto-formats digits as user types:
 * 2 -> 2
 * 20 -> 20/
 * 200 -> 20/0
 * 2009 -> 20/09/
 * 20092 -> 20/09/2
 * 200920 -> 20/09/20
 * 20092026 -> 20/09/2026
 */
function formatAsUserTypes(rawInput: string, isBackspace: boolean = false): string {
  const digits = rawInput.replace(/\D/g, '').substring(0, 8);
  if (!digits) return '';

  if (isBackspace) {
    if (digits.length <= 2) {
      return digits;
    } else if (digits.length <= 4) {
      return `${digits.substring(0, 2)}/${digits.substring(2)}`;
    } else {
      return `${digits.substring(0, 2)}/${digits.substring(2, 4)}/${digits.substring(4)}`;
    }
  }

  if (digits.length === 1) {
    return digits;
  } else if (digits.length === 2) {
    return `${digits}/`;
  } else if (digits.length === 3) {
    return `${digits.substring(0, 2)}/${digits.substring(2)}`;
  } else if (digits.length === 4) {
    return `${digits.substring(0, 2)}/${digits.substring(2)}/`;
  } else {
    return `${digits.substring(0, 2)}/${digits.substring(2, 4)}/${digits.substring(4)}`;
  }
}

/**
 * Parses user-typed or pasted date inputs into ISO YYYY-MM-DD format with validation
 */
function parseUserTypedDate(input: string): string | null {
  const clean = input.trim();
  if (!clean) return null;

  const digits = clean.replace(/\D/g, '');

  let day = 0;
  let month = 0;
  let year = 0;

  if (digits.length === 8) {
    // 8 digits: DDMMYYYY (e.g. 20092026)
    day = parseInt(digits.substring(0, 2), 10);
    month = parseInt(digits.substring(2, 4), 10);
    year = parseInt(digits.substring(4, 8), 10);
  } else if (digits.length === 6) {
    // 6 digits: DDMMYY (e.g. 200926)
    day = parseInt(digits.substring(0, 2), 10);
    month = parseInt(digits.substring(2, 4), 10);
    const yr2 = parseInt(digits.substring(4, 6), 10);
    year = yr2 <= 50 ? 2000 + yr2 : 1900 + yr2;
  } else {
    // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const parts = clean.split(/[\/\-\.]/);
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) {
        year = year <= 50 ? 2000 + year : 1900 + year;
      }
    }
  }

  if (isValidCalendarDate(day, month, year)) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

export const FinanceSmartCalendar: React.FC<FinanceSmartCalendarProps> = ({
  value = '',
  onChange,
  module = 'DAY_BOOK',
  eventProvider,
  label,
  placeholder = 'DD/MM/YYYY',
  disabled = false,
  required = false,
  error = false,
  className = '',
  mode = 'popover',
  allowClear = true,
  compact = false,
  onMonthChange,
  refreshTrigger = 0
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastKeyRef = useRef<string>('');

  // Editable text input value (e.g. "25/07/2026")
  const [inputValue, setInputValue] = useState(() => isoToDisplayFormatted(value));

  // Current view month & year for calendar grid
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  const [eventDates, setEventDates] = useState<Set<string>>(new Set());

  // Sync internal state when external value prop changes
  useEffect(() => {
    setInputValue(isoToDisplayFormatted(value || ''));
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setCurrentMonth(d);
      }
    }
  }, [value]);

  // Notify parent when month changes
  useEffect(() => {
    if (onMonthChange) {
      onMonthChange(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    }
  }, [currentMonth, onMonthChange]);

  // Fetch module event dates for red activity indicators
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (eventProvider) {
        try {
          const dates = await eventProvider(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
          if (isMounted) setEventDates(dates || new Set());
        } catch (e) {
          console.error('Error fetching calendar events:', e);
        }
      } else if (module) {
        try {
          const dates = await getFinanceModuleEventDates(module, currentMonth.getFullYear(), currentMonth.getMonth() + 1);
          if (isMounted) setEventDates(dates || new Set());
        } catch (e) {
          console.error('Error fetching module calendar events:', e);
        }
      }
    };
    loadEvents();
    return () => { isMounted = false; };
  }, [module, eventProvider, currentMonth, refreshTrigger]);

  // Close popover when clicking outside
  useEffect(() => {
    if (mode === 'inline') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (value) {
          setInputValue(isoToDisplayFormatted(value));
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mode, value]);

  // Calendar Days Grid (42 cells)
  const daysGrid = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentMonth);
    const startDate = startOfWeek(firstDayOfMonth);

    const days: Date[] = [];
    let cursor = new Date(startDate);
    while (days.length < 42) {
      days.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [currentMonth]);

  // Extended Years List (1990 to 2040)
  const yearsList = useMemo(() => {
    const currentYr = new Date().getFullYear();
    const list: number[] = [];
    for (let y = currentYr - 35; y <= currentYr + 15; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setInputValue(isoToDisplayFormatted(dateStr));
    if (onChange) {
      onChange(dateStr);
    }
    if (mode === 'popover') {
      setIsOpen(false);
    }
  };

  const handleMonthSelectChange = (newMonthIdx: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), newMonthIdx, 1));
  };

  const handleYearSelectChange = (newYr: number) => {
    setCurrentMonth(new Date(newYr, currentMonth.getMonth(), 1));
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  // Direct Text Input Handler with Auto-Formatting & Masking
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const isBackspace = lastKeyRef.current === 'Backspace';

    if (!rawVal.trim()) {
      setInputValue('');
      if (onChange && allowClear) onChange('');
      return;
    }

    const formatted = formatAsUserTypes(rawVal, isBackspace);
    setInputValue(formatted);

    // Sync with calendar if valid 10-char date (DD/MM/YYYY)
    if (formatted.length === 10) {
      const parsedISO = parseUserTypedDate(formatted);
      if (parsedISO) {
        if (onChange) onChange(parsedISO);
        const parsedDate = new Date(parsedISO);
        if (!isNaN(parsedDate.getTime())) {
          setCurrentMonth(parsedDate);
        }
      }
    }
  };

  // Paste Handler
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const formatted = formatAsUserTypes(pastedText, false);
    setInputValue(formatted);

    const parsedISO = parseUserTypedDate(pastedText);
    if (parsedISO) {
      setInputValue(isoToDisplayFormatted(parsedISO));
      if (onChange) onChange(parsedISO);
      const parsedDate = new Date(parsedISO);
      if (!isNaN(parsedDate.getTime())) {
        setCurrentMonth(parsedDate);
      }
    }
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      if (onChange && allowClear) onChange('');
      return;
    }
    const parsedISO = parseUserTypedDate(inputValue);
    if (parsedISO) {
      setInputValue(isoToDisplayFormatted(parsedISO));
      if (onChange) onChange(parsedISO);
    } else if (value) {
      setInputValue(isoToDisplayFormatted(value));
    } else {
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    lastKeyRef.current = e.key;
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      handleInputBlur();
      setIsOpen(false);
    }
  };

  const calendarBody = (
    <div className="FinanceSmartCalendar bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-[330px] select-none text-slate-900 z-[9999] relative">
      {/* Month & Year Navigation Header */}
      <div className="flex items-center justify-between gap-1 mb-3">
        <button
          type="button"
          onClick={() => navigateMonth('prev')}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
          title="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5">
          <select
            value={currentMonth.getMonth()}
            onChange={(e) => handleMonthSelectChange(parseInt(e.target.value))}
            className="text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-800 cursor-pointer"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx}>{name}</option>
            ))}
          </select>

          <select
            value={currentMonth.getFullYear()}
            onChange={(e) => handleYearSelectChange(parseInt(e.target.value))}
            className="text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-800 cursor-pointer"
          >
            {yearsList.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => navigateMonth('next')}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
          title="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Row Header */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-500 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid (42 cells) */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {daysGrid.map((dateObj, idx) => {
          const dateISO = format(dateObj, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(dateObj, currentMonth);
          const isSelected = value === dateISO;
          const isToday = isSameDay(dateObj, new Date());
          const hasEvent = eventDates.has(dateISO);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDateClick(dateObj)}
              className={`relative h-10 w-full rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : isToday
                  ? 'bg-blue-100 text-blue-900 font-semibold'
                  : isCurrentMonth
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="-mt-1">{format(dateObj, 'd')}</span>

              {/* Red Entry Dot: 8px, perfect circle, centered horizontally, bottom aligned */}
              {hasEvent && (
                <span
                  className="w-2 h-2 rounded-full bg-red-500 absolute bottom-1 left-1/2 -translate-x-1/2"
                  title="Has entries"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Row */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          Has entries
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleDateClick(new Date())}
            className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === 'inline') {
    return <div className={`inline-block ${className}`}>{calendarBody}</div>;
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Reusable Input Container with dedicated right action button group */}
      <div className={`relative w-full ${compact ? 'min-w-[170px] h-[42px]' : 'min-w-[190px] h-[46px]'} flex items-center justify-between bg-white border rounded-[14px] shadow-2xs transition-all overflow-hidden focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 ${
        error ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
      } ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}>
        
        <input
          type="text"
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => !disabled && setIsOpen(true)}
          maxLength={10}
          placeholder={placeholder || 'DD/MM/YYYY'}
          className={`flex-1 min-w-[100px] h-full bg-transparent pl-3 pr-2 ${compact ? 'text-[15px]' : 'text-[17px]'} font-semibold text-slate-900 font-mono tracking-tight focus:outline-none`}
        />
        {/* Dedicated Actions Container: 6px gap, 10px right padding */}
        <div className="flex items-center gap-[6px] pr-[10px] shrink-0 pointer-events-auto select-none bg-transparent">
          {/* Clear (X) Button (26x26px clickable area, 18px icon) */}
          {allowClear !== false && value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setInputValue('');
                if (onChange) onChange('');
              }}
              className="w-[26px] h-[26px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-[6px] cursor-pointer transition-colors"
              title="Clear date"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          )}

          {/* Calendar Icon Button (26x26px clickable area, 20px icon) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="w-[26px] h-[26px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-[6px] cursor-pointer transition-colors"
            title="Open Calendar"
          >
            <CalendarIcon className="w-[20px] h-[20px]" />
          </button>
        </div>
      </div>

      {/* Popover Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-[9999] animate-in fade-in-50 zoom-in-95 drop-shadow-2xl">
          {calendarBody}
        </div>
      )}
    </div>
  );
};

export const FinanceDatePicker = FinanceSmartCalendar;

export default FinanceSmartCalendar;
