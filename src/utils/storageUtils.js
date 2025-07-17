// Utility functions for localStorage management

/**
 * Compress data using a simple technique - remove redundant fields
 * and use shorter key names for storage
 */
export const compressDataForStorage = (data) => {
  if (!Array.isArray(data)) return data;
  
  // Define key mappings to shorten field names
  const keyMap = {
    payerName: 'pn',
    claimId: 'ci',
    patientName: 'pt',
    hospitalName: 'hn',
    serviceDate: 'sd',
    dischargeDate: 'dd',
    status: 's',
    claimedAmount: 'ca',
    approvedAmount: 'aa',
    paidAmount: 'pa'
  };
  
  return data.map(row => {
    const compressed = {};
    Object.entries(row).forEach(([key, value]) => {
      const shortKey = keyMap[key] || key;
      // Skip null/undefined values to save space
      if (value !== null && value !== undefined && value !== '') {
        compressed[shortKey] = value;
      }
    });
    return compressed;
  });
};

/**
 * Decompress data back to original format
 */
export const decompressDataFromStorage = (compressedData) => {
  if (!Array.isArray(compressedData)) return compressedData;
  
  // Reverse key mappings
  const reverseKeyMap = {
    pn: 'payerName',
    ci: 'claimId',
    pt: 'patientName',
    hn: 'hospitalName',
    sd: 'serviceDate',
    dd: 'dischargeDate',
    s: 'status',
    ca: 'claimedAmount',
    aa: 'approvedAmount',
    pa: 'paidAmount'
  };
  
  return compressedData.map(row => {
    const decompressed = {};
    Object.entries(row).forEach(([key, value]) => {
      const fullKey = reverseKeyMap[key] || key;
      decompressed[fullKey] = value;
    });
    return decompressed;
  });
};

/**
 * Calculate approximate size of data in localStorage
 */
export const calculateStorageSize = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    // Approximate size in bytes
    const sizeInBytes = new Blob([jsonString]).size;
    // Convert to MB
    return (sizeInBytes / (1024 * 1024)).toFixed(2);
  } catch (error) {
    return 0;
  }
};

/**
 * Check if localStorage has enough space
 */
export const checkStorageQuota = async () => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const percentUsed = (estimate.usage / estimate.quota) * 100;
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentUsed: percentUsed.toFixed(2),
        availableMB: ((estimate.quota - estimate.usage) / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('Failed to estimate storage:', error);
    }
  }
  return null;
};

/**
 * Clear old data from localStorage to make space
 */
export const clearOldData = (userId, storageKeyPrefix) => {
  const keysToCheck = [
    `${storageKeyPrefix}csv_data_${userId}`,
    `${storageKeyPrefix}consolidated_data_${userId}`,
    `${storageKeyPrefix}identified_payers_${userId}`,
    `${storageKeyPrefix}selected_payers_${userId}`,
    `${storageKeyPrefix}metadata_${userId}`
  ];
  
  let clearedSize = 0;
  keysToCheck.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      clearedSize += data.length;
      localStorage.removeItem(key);
    }
  });
  
  return (clearedSize / (1024 * 1024)).toFixed(2); // Return cleared size in MB
};