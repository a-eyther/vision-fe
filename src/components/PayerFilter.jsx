import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

const PayerFilter = ({ options = [], selectedValues = [], onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (option) => {
    if (selectedValues.includes(option)) {
      // Prevent unchecking if it would leave no payers selected
      if (selectedValues.length > 1) {
        onChange(selectedValues.filter(v => v !== option));
      }
    } else {
      onChange([...selectedValues, option]);
    }
  };

  const selectAll = () => {
    onChange(options);
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedCount = selectedValues.length;
  const allSelected = selectedCount === options.length && options.length > 0;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span className="truncate">
          {selectedCount === 0 
            ? 'Select Payers' 
            : allSelected 
            ? 'All Payers' 
            : selectedCount === 1
            ? selectedValues[0]
            : `${selectedCount} Payers Selected`
          }
        </span>
        <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search payers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Select All */}
          <div className="px-2 py-1 border-b border-gray-200 flex justify-between">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Select All
            </button>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No payers found</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option);
                return (
                  <div
                    key={option}
                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleOption(option)}
                  >
                    <div className={`flex items-center justify-center w-4 h-4 mr-2 border rounded ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600' 
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-gray-900">{option}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Items Display */}
          {selectedCount > 0 && (
            <div className="px-3 py-2 border-t border-gray-200">
              <div className="text-xs text-gray-600 mb-2">
                Selected ({selectedCount} of {options.length}):
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedValues.map(value => (
                  <span
                    key={value}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default PayerFilter;