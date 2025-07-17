import { useState, useMemo } from 'react';
import { X, ArrowUpDown, Eye } from 'lucide-react';
import { formatCurrency, formatDays, formatNumber } from '../../utils/formatters';

const DrillDownTable = ({ 
  data, 
  title, 
  isOpen, 
  onClose, 
  type = 'rejection', // 'rejection', 'query', 'district'
  scheme = 'maa'
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'Pkg Rate', direction: 'desc' });

  const sortedData = useMemo(() => {
    // Always check for valid data first
    if (!data || data.length === 0) return [];
    
    // --- DIAGNOSTIC LOGS START ---
    if (isOpen) {
      console.log('[DIAGNOSTIC] DrillDownTable Opened');
      console.log(`[DIAGNOSTIC] Scheme: ${scheme}`);
      console.log(`[DIAGNOSTIC] Type: ${type}`);
      console.log(`[DIAGNOSTIC] Received ${data.length} rows.`);
      if (data.length > 0) {
        console.log('[DIAGNOSTIC] Keys of the first data row:', Object.keys(data[0]));
      }
    }
    // --- DIAGNOSTIC LOGS END ---
    
    let dataToProcess = [...data];

    if (scheme === 'maa_yojna' || scheme === 'maa') {
      const groupedByTID = data.reduce((acc, row) => {
        const tid = row['TID'];
        if (!tid) return acc;

        if (!acc[tid]) {
          acc[tid] = { ...row, 'Pkg Rate': 0, components: [] };
        }

        acc[tid]['Pkg Rate'] += parseFloat(row['Pkg Rate']) || 0;
        acc[tid].components.push(row);
        return acc;
      }, {});
      dataToProcess = Object.values(groupedByTID);
    }

    return dataToProcess.sort((a, b) => {
      const aValue = a[sortConfig.key] || 0;
      const bValue = b[sortConfig.key] || 0;
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [data, sortConfig, scheme]);

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  if (!isOpen || !data || data.length === 0) return null;

  const getColumns = () => {
    if (scheme === 'rghs') {
      return [
        { key: 'TID', label: 'TID', width: 'w-32' },
        { key: 'PATIENTNAME', label: 'Patient', width: 'w-40' },
        { key: 'HOSPITALNAME', label: 'Hospital', width: 'w-48' },
        { key: 'HOSPITALCLAIMAMOUNT', label: 'Claim Amount', width: 'w-32', format: formatCurrency },
        { key: 'STATUS', label: 'Status', width: 'w-40' },
        { key: 'DEPARTMENT', label: 'Specialty', width: 'w-48' }
      ];
    }

    const baseColumns = [
      { key: 'TID', label: 'TID', width: 'w-32' },
      { key: 'Patient Name', label: 'Patient', width: 'w-40' },
      { key: 'Hospital Name', label: 'Hospital', width: 'w-48' },
      { key: 'Pkg Rate', label: 'Package Rate', width: 'w-32', format: formatCurrency },
      { key: 'Status', label: 'Status', width: 'w-40' },
    ];

    if (type === 'query') {
      baseColumns.splice(4, 0, 
        { key: 'Query Raised', label: 'Queries', width: 'w-20', format: formatNumber },
        { key: 'Days to Payment', label: 'Days', width: 'w-24', format: formatDays }
      );
    }

    if (type === 'district') {
      baseColumns.splice(2, 0, 
        { key: 'District Name', label: 'District', width: 'w-32' }
      );
    }

    baseColumns.push(
      { key: 'Pkg Speciality Name', label: 'Specialty', width: 'w-48' }
    );

    return baseColumns;
  };

  const columns = getColumns();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1">
              Top {sortedData.length} cases sorted by package rate
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={`text-left p-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors ${column.width}`}
                      onClick={() => handleSort(column.key)}
                    >
                      <div className="flex items-center gap-2">
                        {column.label}
                        <ArrowUpDown className="w-4 h-4 text-slate-400" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData.slice(0, 10).map((row, index) => (
                  <tr
                    key={row.TID || index}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    {columns.map((column) => {
                      const value = row[column.key];
                      const formattedValue = column.format 
                        ? column.format(value) 
                        : value || '-';
                      
                      return (
                        <td key={column.key} className={`p-3 text-sm ${column.width}`}>
                          {(column.key === 'Status' || column.key === 'STATUS') && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium
                              ${value?.toLowerCase().includes('paid') || value?.toLowerCase().includes('approved')
                                ? 'bg-green-100 text-green-800'
                                : value?.toLowerCase().includes('rejected')
                                ? 'bg-red-100 text-red-800'
                                : value?.toLowerCase().includes('pending')
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {formattedValue}
                            </span>
                          )}
                          {(column.key === 'TID') && (
                            <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                              {formattedValue}
                            </span>
                          )}
                          {column.key !== 'Status' && column.key !== 'STATUS' && column.key !== 'TID' && (
                            <span className={column.key === 'Pkg Rate' || column.key === 'HOSPITALCLAIMAMOUNT' ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                              {formattedValue}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 bg-slate-50">
          <div className="flex justify-center items-center text-sm text-slate-600">
            <span>Showing top 10 of {sortedData.length} cases</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrillDownTable;