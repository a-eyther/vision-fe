# Payer Mappings Configuration

This directory contains the configuration for mapping different payer CSV formats to the Standardized Data Schema (SDS).

## Files

- `payerMappings.json` - Main configuration file containing payer identification and column mappings
- `validatePayerMappings.js` - Validation script to ensure configuration integrity

## Structure

Each payer mapping in `payerMappings.json` contains:

```json
{
  "payerName": "Payer Display Name",
  "identificationHeaders": ["unique", "column", "headers"],
  "columnMapping": {
    "Source Column Name": "sdsFieldName"
  }
}
```

### Fields:

- **payerName**: Display name for the payer (e.g., "MAA Yojna", "RGHS")
- **identificationHeaders**: Array of column headers unique to this payer's CSV format. Used to automatically identify which payer a CSV file belongs to.
- **columnMapping**: Object mapping source CSV column names to SDS field names

## SDS Fields

All payer data is mapped to these standardized fields:

- `claimId` - Unique identifier for the claim
- `patientName` - Name of the patient
- `hospitalName` - Name of the hospital
- `serviceDate` - Date of admission/service start
- `dischargeDate` - Date of discharge/service end
- `status` - Current status of the claim
- `claimedAmount` - Amount claimed by the hospital
- `approvedAmount` - Amount approved by the payer
- `paidAmount` - Amount actually paid

## Adding New Payers

1. Add a new object to the array in `payerMappings.json`
2. Ensure all required SDS fields are mapped
3. Run validation: `node src/config/validatePayerMappings.js`

## Validation

Run the validation script to ensure configuration integrity:

```bash
cd frontend
node src/config/validatePayerMappings.js
```

The validation checks for:
- Required fields presence
- Proper data types
- All SDS fields are mapped
- No duplicate mappings
- No duplicate payer names