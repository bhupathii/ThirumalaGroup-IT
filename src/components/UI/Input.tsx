import React, { useState, forwardRef } from 'react';


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
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;

      // Special handling for date
      if (type === 'date') {
        setInputValue(val);
        if (onChange) onChange(val);
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
            type={type}
            value={
              typeof value === 'number' && isNaN(value)
                ? ''
                : value === null || value === undefined
                  ? ''
                  : type === 'date'
                    ? (() => {
                        const v = String(value || inputValue || '');
                        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
                        const m2 = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
                        const m3 = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                        if (m3) return `${m3[3]}-${m3[2]}-${m3[1]}`;
                        return '';
                      })()
                    : uppercase && type !== 'number' 
                      ? String(value).toUpperCase()
                      : value
            }
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            min={min}
            max={max}
            step={step}
            className={`w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed font-bold ${
              size === 'sm' ? 'px-2 py-1 text-sm' : size === 'lg' ? 'px-4 py-3 text-lg' : 'px-3 py-2 text-base'
            } ${type === 'date' ? 'cursor-pointer' : ''}`}
            style={{ fontFamily: 'Times New Roman', fontSize: '14px', fontWeight: 'bold', ...style }}
            onFocus={() => {
              setShowSuggestions(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 100);
            }}
          />
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