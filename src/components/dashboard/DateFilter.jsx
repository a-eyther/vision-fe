import { useState, useMemo } from 'react';
import { Calendar, ChevronDown, CalendarDays } from 'lucide-react';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { DateRangePicker } from 'react-date-range';
import { parseDate, parseRGHSDate } from '../../utils/dataProcessor';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './DateFilter.css';

const DateFilter = ({ data, onFilterChange, className = '', scheme = 'maa' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('all');
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection'
    }
  ]);

  // Calculate available date range from data
  const { minDate, maxDate, hasData } = useMemo(() => {
    let dataArray;
    
    if (scheme === 'multi_payer') {
      // Handle multi-payer consolidated data
      dataArray = Array.isArray(data) ? data : [];
    } else if (scheme === 'rghs') {
      const tmsFile = Array.isArray(data) ? data.find(file => file.fileType === 'tms_data') : null;
      dataArray = tmsFile ? tmsFile.data : [];
    } else {
      dataArray = data;
    }

    if (!dataArray || dataArray.length === 0) {
      return { minDate: null, maxDate: null, hasData: false };
    }

    // Handle different date field names for multi-payer mode
    const getDateFromRow = (row) => {
      if (scheme === 'multi_payer') {
        // Try serviceDate first (SDS format), then fall back to original field names
        if (row.serviceDate) {
          return parseDate(row.serviceDate);
        }
        // Fall back to payer-specific field names
        const dateStr = row['Date of Admission'] || row['DATEOFADMISSION'] || row.admissionDate;
        if (dateStr) {
          const parser = row.payerName?.includes('RGHS') ? parseRGHSDate : parseDate;
          return parser(dateStr);
        }
        return null;
      } else {
        const dateColumn = scheme === 'rghs' ? 'DATEOFADMISSION' : 'Date of Admission';
        const dateParser = scheme === 'rghs' ? parseRGHSDate : parseDate;
        const admissionStr = row[dateColumn];
        if (!admissionStr) return null;
        try {
          return dateParser(admissionStr);
        } catch {
          return null;
        }
      }
    };

    const dates = dataArray
      .map(getDateFromRow)
      .filter(date => date && !isNaN(date))
      .sort((a, b) => a - b);

    if (dates.length === 0) {
      return { minDate: null, maxDate: null, hasData: false };
    }

    return {
      minDate: dates[0],
      maxDate: dates[dates.length - 1],
      hasData: true
    };
  }, [data, scheme]);

  const presets = useMemo(() => {
    if (!hasData || !maxDate) {
      return [
        { key: 'all', label: 'All Time', disabled: true }
      ];
    }

    const now = new Date();
    const presetList = [
      { key: 'all', label: 'All Time', disabled: false },
      { 
        key: 'last7days', 
        label: 'Last 7 Days', 
        startDate: startOfDay(subDays(now, 7)),
        endDate: endOfDay(now),
        disabled: maxDate < subDays(now, 7)
      },
      { 
        key: 'last30days', 
        label: 'Last 30 Days', 
        startDate: startOfDay(subDays(now, 30)),
        endDate: endOfDay(now),
        disabled: maxDate < subDays(now, 30)
      },
      { 
        key: 'last3months', 
        label: 'Last 3 Months', 
        startDate: startOfDay(subMonths(now, 3)),
        endDate: endOfDay(now),
        disabled: maxDate < subMonths(now, 3)
      },
      { 
        key: 'last6months', 
        label: 'Last 6 Months', 
        startDate: startOfDay(subMonths(now, 6)),
        endDate: endOfDay(now),
        disabled: maxDate < subMonths(now, 6)
      },
      { 
        key: 'lastyear', 
        label: 'Last Year', 
        startDate: startOfDay(subMonths(now, 12)),
        endDate: endOfDay(now),
        disabled: maxDate < subMonths(now, 12)
      },
      { 
        key: 'custom', 
        label: 'Custom Range', 
        disabled: false,
        isCustom: true
      }
    ];

    return presetList;
  }, [hasData, maxDate]);

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.key);
    
    if (preset.isCustom) {
      setShowCustomCalendar(true);
      // Initialize custom date range with data boundaries
      if (hasData && minDate && maxDate) {
        setCustomDateRange([{
          startDate: minDate,
          endDate: maxDate,
          key: 'selection'
        }]);
      }
    } else {
      setIsOpen(false);
      setShowCustomCalendar(false);
      
      if (preset.key === 'all') {
        onFilterChange(null);
      } else {
        onFilterChange({
          startDate: preset.startDate,
          endDate: preset.endDate
        });
      }
    }
  };

  const handleCustomDateChange = (ranges) => {
    setCustomDateRange([ranges.selection]);
  };

  const applyCustomDateRange = () => {
    const range = customDateRange[0];
    onFilterChange({
      startDate: startOfDay(range.startDate),
      endDate: endOfDay(range.endDate)
    });
    setShowCustomCalendar(false);
    setIsOpen(false);
  };

  const cancelCustomDateRange = () => {
    setShowCustomCalendar(false);
    setSelectedPreset('all');
  };

  const selectedPresetLabel = useMemo(() => {
    const preset = presets.find(p => p.key === selectedPreset);
    if (selectedPreset === 'custom' && customDateRange[0]) {
      const range = customDateRange[0];
      return `${format(range.startDate, 'MMM dd')} - ${format(range.endDate, 'MMM dd, yyyy')}`;
    }
    return preset?.label || 'All Time';
  }, [selectedPreset, presets, customDateRange]);

  const dateRangeText = hasData && minDate && maxDate 
    ? `${format(minDate, 'MMM dd, yyyy')} - ${format(maxDate, 'MMM dd, yyyy')}`
    : 'No data available';

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!hasData}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium transition-colors
          ${hasData 
            ? 'text-slate-700 hover:bg-slate-50 hover:border-slate-400' 
            : 'text-slate-400 cursor-not-allowed bg-slate-50'
          }
        `}
      >
        <Calendar className="w-4 h-4" />
        <span>{selectedPresetLabel}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !showCustomCalendar && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-slate-100">
            <div className="text-xs font-medium text-slate-900 mb-1">Available Data Range</div>
            <div className="text-xs text-slate-600">{dateRangeText}</div>
          </div>
          
          <div className="py-1">
            {presets.map((preset) => (
              <button
                key={preset.key}
                onClick={() => !preset.disabled && handlePresetSelect(preset)}
                disabled={preset.disabled}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between
                  ${preset.disabled
                    ? 'text-slate-400 cursor-not-allowed'
                    : selectedPreset === preset.key
                    ? 'bg-[#2a5eb4] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {preset.isCustom && <CalendarDays className="w-4 h-4" />}
                  {preset.label}
                </span>
                {preset.disabled && (
                  <span className="text-xs text-slate-400">(No data)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom Date Range Picker */}
      {showCustomCalendar && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-slate-100">
            <div className="text-sm font-medium text-slate-900 mb-1">Select Custom Date Range</div>
            <div className="text-xs text-slate-600">{dateRangeText}</div>
          </div>
          
          <div className="p-2">
            <DateRangePicker
              ranges={customDateRange}
              onChange={handleCustomDateChange}
              minDate={minDate}
              maxDate={maxDate}
              rangeColors={['#2a5eb4']}
              showSelectionPreview={true}
              moveRangeOnFirstSelection={false}
              months={1}
              direction="horizontal"
              showDateDisplay={false}
            />
          </div>
          
          <div className="flex justify-end gap-2 p-3 border-t border-slate-100">
            <button
              onClick={cancelCustomDateRange}
              className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={applyCustomDateRange}
              className="px-3 py-2 text-sm bg-[#2a5eb4] text-white rounded-md hover:bg-[#1e4a8c] transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {(isOpen || showCustomCalendar) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setIsOpen(false);
            setShowCustomCalendar(false);
          }}
        />
      )}
    </div>
  );
};

export default DateFilter;