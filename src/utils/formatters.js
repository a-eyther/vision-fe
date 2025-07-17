// Utility functions for formatting currency and numbers with proper Cr/Lakhs logic

export const formatCurrency = (value, options = {}) => {
  if (value === null || value === undefined || isNaN(value)) return '₹0';
  
  const absValue = Math.abs(value);
  const { showSymbol = true, precision = 1 } = options;
  
  // Thresholds for different formats
  const croreThreshold = 10000000; // 1 Cr minimum threshold
  const lakhThreshold = 100000; // 1 Lakh minimum threshold
  
  let formatted = '';
  const symbol = showSymbol ? '₹' : '';
  
  if (absValue >= croreThreshold) {
    const crores = value / 10000000;
    formatted = `${symbol}${crores.toFixed(precision)}Cr`;
  } else if (absValue >= lakhThreshold) {
    const lakhs = value / 100000;
    formatted = `${symbol}${lakhs.toFixed(precision)}L`;
  } else if (absValue >= 1000) {
    const thousands = value / 1000;
    formatted = `${symbol}${thousands.toFixed(precision)}K`;
  } else {
    formatted = `${symbol}${Math.round(value)}`;
  }
  
  return formatted;
};

export const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-IN').format(value);
};

export const formatPercentage = (value, precision = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value.toFixed(precision)}%`;
};

// Format large numbers for better readability
export const formatLargeNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  
  const absValue = Math.abs(value);
  
  if (absValue >= 10000000) {
    return `${(value / 10000000).toFixed(1)}Cr`;
  } else if (absValue >= 100000) {
    return `${(value / 100000).toFixed(1)}L`;
  } else if (absValue >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  } else {
    return Math.round(value).toString();
  }
};

// Enhanced currency formatter for dashboard metrics
export const formatDashboardCurrency = (value) => {
  return formatCurrency(value, { precision: 1 });
};

// Compact currency format for charts and tooltips
export const formatCompactCurrency = (value) => {
  return formatCurrency(value, { precision: 0 });
};

// Format days with proper pluralization
export const formatDays = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const days = Math.round(value);
  return days === 1 ? '1 day' : `${days} days`;
};

// Format delay difference with + prefix
export const formatDelayDifference = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const days = Math.round(value);
  const sign = days >= 0 ? '+' : '';
  return `${sign}${days} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
};

// Format claim counts
export const formatClaimCount = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return formatNumber(value);
};