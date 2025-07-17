/**
 * Standardized Data Schema (SDS) for claims across all payers
 * This defines the canonical structure that all payer data will be mapped to
 */

/**
 * @typedef {Object} StandardizedClaim
 * @property {string} claimId - Unique identifier for the claim (e.g., TID for MAA, TREATMENTPACKAGEUID for RGHS)
 * @property {string} patientName - Name of the patient
 * @property {string} hospitalName - Name of the hospital providing treatment
 * @property {Date|string|null} serviceDate - Date of admission/service start
 * @property {Date|string|null} dischargeDate - Date of discharge/service end
 * @property {string} status - Current status of the claim (e.g., "Claim Paid", "Pending", "Rejected")
 * @property {number} claimedAmount - Amount claimed by the hospital
 * @property {number} approvedAmount - Amount approved by the payer/TPA
 * @property {number} paidAmount - Amount actually paid to the hospital
 * @property {string} payerName - Name of the payer (e.g., "MAA Yojna", "RGHS")
 */

/**
 * Payer mapping configuration structure
 * @typedef {Object} PayerMapping
 * @property {string} payerName - Name of the payer
 * @property {string[]} identificationHeaders - Unique headers to identify this payer's CSV format
 * @property {Object.<string, string>} columnMapping - Maps CSV column names to SDS field names
 */

/**
 * Processing result structure
 * @typedef {Object} ProcessingResult
 * @property {StandardizedClaim[]} consolidatedData - Successfully processed and mapped claims
 * @property {ProcessingError[]} processingErrors - Errors encountered during processing
 */

/**
 * Processing error structure
 * @typedef {Object} ProcessingError
 * @property {string} fileName - Name of the file that failed processing
 * @property {string} error - Error message describing what went wrong
 * @property {string} [payerName] - Identified payer name if detection was successful
 */

// Export empty object to make this a module
export {};