# Multi-Payer Dashboard Feature Documentation

## Overview

The Multi-Payer Dashboard feature enables users to upload and analyze healthcare claims data from multiple payers (insurance providers) simultaneously. This feature consolidates data from different CSV formats into a standardized schema, allowing for unified analysis and comparison across payers.

## Architecture

### Core Components

1. **Standardized Data Schema (SDS)** - `/src/types/claim.js`
   - Defines canonical structure for all claim data
   - Fields: claimId, patientName, hospitalName, serviceDate, dischargeDate, status, claimedAmount, approvedAmount, paidAmount, payerName

2. **Payer Mappings Configuration** - `/src/config/payerMappings.json`
   - Maps each payer's CSV format to SDS
   - Currently supports: MAA Yojna, RGHS TMS, RGHS Payment Tracker

3. **Payer Processor Utility** - `/src/utils/payerProcessor.js`
   - Identifies payer type from CSV headers
   - Maps data to standardized format
   - Consolidates multiple files into single dataset

4. **PayerFilter Component** - `/src/components/PayerFilter.jsx`
   - Multi-select dropdown with search
   - Allows filtering dashboard by selected payers

### Data Flow

```
User uploads files → CSVUpload component → processPayerFiles() 
→ Identify each file's payer → Map to SDS → Consolidate data 
→ Display in Dashboard → Apply payer/date filters → Update visualizations
```

## Key Features

### 1. Multi-File Upload
- Upload up to 4 CSV files simultaneously
- Mixed payer types supported in single upload
- Drag-and-drop or click to browse

### 2. Automatic Payer Identification
- Analyzes CSV headers to determine payer type
- No manual selection required
- Clear error messages for unrecognized formats

### 3. Data Standardization
- Converts different date formats to consistent format
- Normalizes amount fields (handles commas, currency symbols)
- Maps varied column names to standard fields

### 4. Error Handling
- Non-blocking toast notifications for failed files
- Successful files process even if others fail
- Detailed error messages identify problematic files

### 5. Interactive Filtering
- Multi-select payer filter with search
- Combines with existing date filters
- Real-time dashboard updates

## Usage Guide

### Enabling Multi-Payer Mode

1. Toggle "Multi-Payer Mode" switch in upload component
2. Select multiple CSV files (max 4)
3. Files are automatically identified and processed

### Adding New Payers

1. Edit `/src/config/payerMappings.json`
2. Add new payer configuration:
```json
{
  "payerName": "New Payer Name",
  "identificationHeaders": ["Unique", "Header", "Names"],
  "columnMapping": {
    "Source Column": "sdsField",
    // ... map all required fields
  }
}
```

3. Test with sample CSV file

### Filtering Data

1. Use payer filter dropdown in dashboard header
2. Search for specific payers
3. Select/deselect payers to update view
4. Combine with date filters for refined analysis

## Testing

### Unit Tests
- Run: `npm test`
- Location: `/src/utils/payerProcessor.test.js`
- Coverage: File identification, data mapping, error handling

### E2E Test Scenarios
1. Multi-file upload with valid files
2. Mixed valid/invalid file handling
3. Payer filter functionality
4. Data accuracy verification
5. Performance testing

### Test Data
Sample files in `/test-data/`:
- `maa-yojna-test.csv`
- `rghs-tms-test.csv`
- `rghs-payment-tracker-test.csv`
- `invalid-format-test.csv`

## Performance Considerations

- Client-side processing limits file size
- Recommended: <10MB per file
- Large datasets may impact browser performance
- Consider server-side processing for production

## Security Notes

- All processing happens client-side
- No data transmitted to external servers
- Sensitive data remains in browser
- LocalStorage used for session persistence (limited data)

## Future Enhancements

1. **Server-Side Processing**
   - Handle larger files
   - Better performance
   - Progress indicators

2. **Additional Payers**
   - Add more insurance providers
   - Support Excel formats
   - Handle nested data structures

3. **Advanced Analytics**
   - Payer comparison metrics
   - Trend analysis across payers
   - Benchmarking capabilities

4. **Export Features**
   - Combined reports
   - Payer-specific exports
   - Scheduled reports

## Troubleshooting

### Common Issues

1. **"Format not recognized" error**
   - Check CSV headers match configuration
   - Verify file encoding (UTF-8 recommended)
   - Ensure no extra header rows

2. **Missing data after upload**
   - Check date format compatibility
   - Verify required columns present
   - Look for data type mismatches

3. **Filter not showing payers**
   - Ensure multi-payer mode is enabled
   - Check if data has payerName field
   - Verify successful file processing

## API Reference

### processPayerFiles(files, mappings)
- **Parameters**: 
  - files: FileList or File array
  - mappings: Optional custom mappings
- **Returns**: Promise<{consolidatedData, processingErrors, stats}>

### PayerFilter Component Props
- **options**: string[] - List of payer names
- **selectedValues**: string[] - Currently selected
- **onChange**: (selected: string[]) => void
- **className**: string - Optional CSS classes

---

For questions or support, contact the development team.