/**
 * Validation script for payerMappings.json
 * Ensures the schema is properly structured and contains required fields
 */

import payerMappings from './payerMappings.json' with { type: 'json' };

/**
 * Validates the payer mappings configuration
 * @returns {Object} Validation result with success status and errors
 */
export function validatePayerMappings() {
  const errors = [];
  const requiredSdsFields = [
    'claimId', 
    'patientName', 
    'hospitalName', 
    'serviceDate', 
    'dischargeDate', 
    'status', 
    'claimedAmount', 
    'approvedAmount', 
    'paidAmount'
  ];

  // Check if payerMappings is an array
  if (!Array.isArray(payerMappings)) {
    errors.push('payerMappings.json must contain an array');
    return { success: false, errors };
  }

  // Validate each payer mapping
  payerMappings.forEach((mapping, index) => {
    const payerErrors = [];
    
    // Check required fields
    if (!mapping.payerName || typeof mapping.payerName !== 'string') {
      payerErrors.push('Missing or invalid payerName');
    }
    
    if (!Array.isArray(mapping.identificationHeaders) || mapping.identificationHeaders.length === 0) {
      payerErrors.push('identificationHeaders must be a non-empty array');
    }
    
    if (!mapping.columnMapping || typeof mapping.columnMapping !== 'object') {
      payerErrors.push('Missing or invalid columnMapping');
    } else {
      // Check if all required SDS fields are mapped
      const mappedFields = Object.values(mapping.columnMapping);
      const missingFields = requiredSdsFields.filter(field => !mappedFields.includes(field));
      
      if (missingFields.length > 0) {
        payerErrors.push(`Missing mappings for SDS fields: ${missingFields.join(', ')}`);
      }
      
      // Check for duplicate mappings
      const duplicates = mappedFields.filter((field, idx) => mappedFields.indexOf(field) !== idx);
      if (duplicates.length > 0) {
        payerErrors.push(`Duplicate mappings found for: ${[...new Set(duplicates)].join(', ')}`);
      }
    }
    
    if (payerErrors.length > 0) {
      errors.push(`Payer ${mapping.payerName || `at index ${index}`}: ${payerErrors.join('; ')}`);
    }
  });
  
  // Check for duplicate payer names
  const payerNames = payerMappings.map(m => m.payerName).filter(Boolean);
  const duplicateNames = payerNames.filter((name, idx) => payerNames.indexOf(name) !== idx);
  if (duplicateNames.length > 0) {
    errors.push(`Duplicate payer names found: ${[...new Set(duplicateNames)].join(', ')}`);
  }

  return {
    success: errors.length === 0,
    errors,
    summary: {
      totalPayers: payerMappings.length,
      validPayers: payerMappings.length - errors.length,
      payerNames: payerNames
    }
  };
}

// Run validation if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validatePayerMappings();
  console.log('Validation Result:', JSON.stringify(result, null, 2));
  if (!result.success) {
    process.exit(1);
  }
}