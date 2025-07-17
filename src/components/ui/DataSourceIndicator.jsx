import { Info, AlertCircle } from 'lucide-react';

const DataSourceIndicator = ({ 
  availablePayers = [], 
  supportedPayers = [], 
  scheme,
  className = "",
  showIcon = true,
  variant = "default" // "default", "compact", "banner"
}) => {
  // Determine what data is available
  const getDataAvailability = () => {
    if (scheme === 'multi_payer') {
      if (availablePayers.length === 0) {
        return {
          type: 'no-data',
          message: 'No data available',
          color: 'text-gray-500 bg-gray-50 border-gray-200'
        };
      } else if (availablePayers.length === 1) {
        const payer = availablePayers[0];
        const payerName = payer === 'RGHS TMS' || payer === 'RGHS Payment Tracker' ? 'RGHS' : payer;
        return {
          type: 'single-payer',
          message: `${payerName} data only`,
          color: 'text-blue-700 bg-blue-50 border-blue-200'
        };
      } else {
        // Multiple payers
        const hasRGHS = availablePayers.some(p => p.includes('RGHS'));
        const hasMAA = availablePayers.includes('MAA Yojana');
        
        if (hasMAA && !hasRGHS) {
          return {
            type: 'maa-only',
            message: 'MAA Yojana data only',
            color: 'text-blue-700 bg-blue-50 border-blue-200'
          };
        } else if (hasRGHS && !hasMAA) {
          return {
            type: 'rghs-only',
            message: 'RGHS data only',
            color: 'text-indigo-700 bg-indigo-50 border-indigo-200'
          };
        } else {
          return {
            type: 'multiple',
            message: `${availablePayers.length} payers selected`,
            color: 'text-gray-700 bg-gray-50 border-gray-200'
          };
        }
      }
    } else {
      // Single payer mode
      const schemeName = scheme === 'rghs' ? 'RGHS' : 'MAA Yojana';
      return {
        type: 'single-scheme',
        message: `${schemeName} data`,
        color: 'text-gray-600 bg-gray-50 border-gray-200'
      };
    }
  };

  // Check if feature is supported for current data
  const getFeatureSupport = () => {
    if (supportedPayers.length === 0) return null;
    
    const hasRequiredData = supportedPayers.some(required => 
      availablePayers.some(available => 
        available.includes(required) || required.includes(available)
      )
    );
    
    if (!hasRequiredData) {
      return {
        type: 'unsupported',
        message: `This feature requires ${supportedPayers.join(' or ')} data`,
        color: 'text-amber-700 bg-amber-50 border-amber-200'
      };
    }
    
    return null;
  };

  const availability = getDataAvailability();
  const featureSupport = getFeatureSupport();
  const showWarning = featureSupport?.type === 'unsupported';

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-1 text-xs ${className}`}>
        {showIcon && (
          showWarning ? 
            <AlertCircle className="w-3 h-3" /> : 
            <Info className="w-3 h-3" />
        )}
        <span className={showWarning ? 'text-amber-600' : 'text-gray-600'}>
          {featureSupport?.message || availability.message}
        </span>
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${featureSupport?.color || availability.color} ${className}`}>
        {showIcon && (
          showWarning ? 
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> : 
            <Info className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="font-medium">
          {featureSupport?.message || availability.message}
        </span>
        {scheme === 'multi_payer' && availablePayers.length > 1 && !featureSupport && (
          <span className="text-xs opacity-75">
            ({availablePayers.filter(p => !p.includes('Payment Tracker')).join(', ')})
          </span>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${featureSupport?.color || availability.color} ${className}`}>
      {showIcon && (
        showWarning ? 
          <AlertCircle className="w-3 h-3" /> : 
          <Info className="w-3 h-3" />
      )}
      <span>
        {featureSupport?.message || availability.message}
      </span>
    </div>
  );
};

export default DataSourceIndicator;