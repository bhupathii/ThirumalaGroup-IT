import React, { useState, forwardRef } from 'react';
import { Calendar } from 'lucide-react';

interface InputProps {
  label?: string;
  type?: string;
  value: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  suggestions?: Array<string | number>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  size?: 'sm' | 'md' | 'lg';
  uppercase?: boolean;
  style?: React.CSSProperties;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      type = 'text',
      value,
      onChange,
      placeholder,
      required = false,
      disabled = false,
      readOnly = false,
      className = '',
      min,
      max,
      step,
      suggestions = [],
      onKeyDown,
      size = 'md',
      uppercase = false,
      style,
    },
    ref
  ) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [dateMode, setDateMode] = useState<'text' | 'date'>(type === 'date' ? 'text' : 'text');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;

      // Special handling: custom dd/MM/yyyy for date with calendar
      if (type === 'date') {
        setInputValue(val);
        if (dateMode === 'date') {
          // Native date gives ISO; pass through
          if (onChange) onChange(val);
        } else {
          // Text mode; if dd/MM/yyyy convert to ISO before emitting
          const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (m) {
            const [, dd, mm, yyyy] = m;
            const iso = `${yyyy}-${mm}-${dd}`;
            if (onChange) onChange(iso);
          } else if (val === '') {
            if (onChange) onChange('');
          }
        }
        setShowSuggestions(false);
        return;
      }

      // Apply uppercase transformation for text inputs when uppercase prop is true
      if (uppercase && type !== 'number' && type !== 'date') {
        val = val.toUpperCase();
      }

      setInputValue(val);
      if (type === 'number') {
        // Allow decimal values for quantity inputs
        if (onChange) onChange(val === '' ? '' : val);
      } else {
        if (onChange) onChange(val);
      }
      setShowSuggestions(true);
    };

    const filteredSuggestions = suggestions
      .map(String)
      .filter(
        s =>
          inputValue &&
          !String(inputValue).includes(s) &&
          Math.abs(Number(s) - Number(inputValue)) < 10
      )
      .slice(0, 5);

    return (
      <div className={className} style={{ position: 'relative' }}>
        {label && (
          <label className={`block font-bold text-gray-700 mb-1 ${
            size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
          }`} style={{ fontFamily: style?.fontFamily || 'Times New Roman', fontSize: '14px', fontWeight: 'bold' }}>
            {label}
            {required && <span className='text-red-500 ml-1'>*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={type === 'date' ? (dateMode === 'date' ? 'date' : 'text') : type}
            value={
              typeof value === 'number' && isNaN(value)
                ? ''
                : value === null || value === undefined
                  ? ''
                  : type === 'date'
                    ? (() => {
                        const v = String(value || inputValue || '');
                        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                        if (dateMode === 'date') {
                          // Native date expects ISO
                          if (m) return v;
                          const m2 = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                          if (m2) {
                            const [, dd, mm, yyyy] = m2;
                            return `${yyyy}-${mm}-${dd}`;
                          }
                          return '';
                        }
                        // Text mode shows dd/MM/yyyy
                        if (m) {
                          const [, yyyy, mm, dd] = m;
                          return `${dd}/${mm}/${yyyy}`;
                        }
                        return v;
                      })()
                    : uppercase && type !== 'number' 
                      ? String(value).toUpperCase()
                      : value
            }
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder={type === 'date' ? 'dd/MM/yyyy' : placeholder}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            min={min}
            max={max}
            step={step}
            className={`w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed font-bold ${
              size === 'sm' ? 'px-2 py-1 text-sm' : size === 'lg' ? 'px-4 py-3 text-lg' : 'px-3 py-2 text-base'
            }`}
            style={{ fontFamily: 'Times New Roman', fontSize: '14px', fontWeight: 'bold', paddingRight: type === 'date' ? '2.5rem' : undefined, ...style }}
            inputMode={type === 'date' && dateMode === 'text' ? 'numeric' : undefined}
            pattern={type === 'date' && dateMode === 'text' ? '\\d{2}/\\d{2}/\\d{4}' : undefined}
            onFocus={() => {
              if (type === 'date') setDateMode('date');
              setShowSuggestions(true);
            }}
            onBlur={() => {
              if (type === 'date') setDateMode('text');
              setTimeout(() => setShowSuggestions(false), 100);
            }}
          />
          {type === 'date' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <Calendar className="w-4 h-4" />
            </div>
          )}
        </div>
        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className='absolute z-10 bg-white border border-gray-200 rounded shadow-md mt-1 w-full max-h-40 overflow-y-auto'>
            {filteredSuggestions.map((s, idx) => (
              <li
                key={idx}
                className='px-3 py-2 cursor-pointer hover:bg-blue-100'
                onMouseDown={() => {
                  setInputValue(s);
                  if (onChange) onChange(String(s));
                  setShowSuggestions(false);
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;