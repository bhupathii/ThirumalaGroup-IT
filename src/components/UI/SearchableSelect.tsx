import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelect?: (value: string) => void; // New callback for when an option is selected
  searchPlaceholder?: string;
  noOptionsMessage?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SearchableSelect = forwardRef<HTMLInputElement, SearchableSelectProps>(
  (
    {
      label,
      value,
      onChange,
      options,
      placeholder = 'Select an option...',
      required = false,
      disabled = false,
      className = '',
      onKeyDown,
      onSelect,
      searchPlaceholder = 'Search...',
      noOptionsMessage = 'No options found',
      size = 'md',
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get the selected option label
    const selectedOption = options.find(option => option.value === value);
    const displayValue = selectedOption ? selectedOption.label : '';

    // Filter options based on search term
    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Handle click outside to close dropdown
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex(prev => 
              prev < filteredOptions.length - 1 ? prev + 1 : 0
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex(prev => 
              prev > 0 ? prev - 1 : filteredOptions.length - 1
            );
          }
          break;
        case 'Enter':
          // If dropdown is open and an option is highlighted, select it
          if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            e.preventDefault();
            handleSelect(filteredOptions[highlightedIndex].value);
          } else if (!isOpen) {
            // When closed, allow parent to handle Enter (to move focus)
            if (onKeyDown) {
              onKeyDown(e);
            } else {
              // fallback: open the dropdown if no parent handler
              e.preventDefault();
              setIsOpen(true);
            }
          } else {
            // Dropdown open but nothing highlighted: pass to parent for focus advance
            if (onKeyDown) {
              onKeyDown(e);
            } else {
              e.preventDefault();
            }
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
          break;
        case 'Tab':
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
          break;
        default:
          // Call the parent onKeyDown if provided
          if (onKeyDown) {
            onKeyDown(e);
          }
          break;
      }
    };

    const handleSelect = (selectedValue: string) => {
      onChange(selectedValue);
      setIsOpen(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
      
      // Call onSelect callback if provided (for auto-navigation)
      if (onSelect) {
        onSelect(selectedValue);
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSearchTerm = e.target.value;
      setSearchTerm(newSearchTerm);
      setHighlightedIndex(-1);
      
      // If user is typing and dropdown is closed, open it
      if (!isOpen && newSearchTerm.length > 0) {
        setIsOpen(true);
      }
    };

    const handleInputClick = () => {
      if (!disabled) {
        setIsOpen(!isOpen);
        if (!isOpen) {
          setSearchTerm('');
          setHighlightedIndex(-1);
        }
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      setSearchTerm('');
      setHighlightedIndex(-1);
    };

    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        {label && (
          <label className={`block font-bold text-gray-700 mb-1 ${
            size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
          }`} style={{ fontFamily: 'Times New Roman', fontSize: '14px', fontWeight: 'bold' }}>
            {label}
            {required && <span className='text-red-500 ml-1'>*</span>}
          </label>
        )}
        
        <div className='relative'>
          <input
            ref={ref || inputRef}
            type='text'
            value={isOpen ? searchTerm : (className.includes('staff-field') ? displayValue.toUpperCase() : displayValue)}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onClick={handleInputClick}
            placeholder={isOpen ? searchPlaceholder : placeholder}
            disabled={disabled}
            required={required}
            className={`w-full pr-20 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed font-bold ${
              size === 'sm' ? 'px-2 py-1 text-sm' : size === 'lg' ? 'px-4 py-3 text-lg' : 'px-3 py-2 text-base'
            } ${className.includes('staff-field') ? 'uppercase' : ''}`}
            style={{ 
              fontFamily: 'Times New Roman', 
              fontSize: '14px',
              fontWeight: 'bold',
              ...(className.includes('staff-field') ? { textTransform: 'uppercase' } : {})
            }}
          />
          
          <div className='absolute inset-y-0 right-0 flex items-center'>
            {value && !disabled && (
              <button
                type='button'
                onClick={handleClear}
                className='p-1 text-gray-400 hover:text-gray-600 mr-1'
              >
                <X size={16} />
              </button>
            )}
            <div className='p-1 text-gray-400'>
              <ChevronDown 
                size={16} 
                className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </div>

        {isOpen && (
          <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto'>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    index === highlightedIndex
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100'
                  } ${
                    option.value === value ? 'bg-blue-50 text-blue-900 font-medium' : ''
                  }`}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {className.includes('staff-field') ? option.label.toUpperCase() : option.label}
                </div>
              ))
            ) : (
              <div className='px-3 py-2 text-gray-500 text-sm'>
                {noOptionsMessage}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

SearchableSelect.displayName = 'SearchableSelect';

export default SearchableSelect;
