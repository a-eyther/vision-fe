import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// RGHS Data Processing Functions

// Parse RGHS date formats
export const parseRGHSDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString !== 'string') return null;
  const trimmed = dateString.trim();
  if (trimmed === '') return null;

  // Handle RGHS date format variations
  const parsed = new Date(trimmed);
  if (!isNaN(parsed)) return parsed;
  return null;
};

// Process RGHS TMS data
export const preprocessRGHSTMSData = (data) => {
  if (!data || data.length === 0) return data;

  console.log('📁 RGHS TMS DATA LOADING DEBUG:');
  console.log(`Raw data rows loaded: ${data.length}`);
  console.log(`Sample row:`, data[0]);

  return data.map(row => {
    const newRow = { ...row };
    
    // Parse numeric fields
    newRow['HOSPITALCLAIMAMOUNT'] = parseNumber(row['HOSPITALCLAIMAMOUNT']);
    newRow['TPAAPRROVEDAMOUNT'] = parseNumber(row['TPAAPRROVEDAMOUNT']); 
    newRow['CUAPPROVEDAMOUNT'] = parseNumber(row['CUAPPROVEDAMOUNT']);
    newRow['Package Rate'] = parseNumber(row['Package Rate']);
    newRow['Package Amount'] = parseNumber(row['Package Amount']);
    newRow['LENGTHOFSTAY'] = parseNumber(row['LENGTHOFSTAY']);
    
    // Calculate actual paid amount based on status
    newRow['Actual Paid Amount'] = row['STATUS'] && row['STATUS'].toLowerCase().includes('paid')
      ? Math.max(newRow['TPAAPRROVEDAMOUNT'], newRow['CUAPPROVEDAMOUNT'])
      : 0;
    
    // Parse dates
    newRow['DATEOFADMISSION'] = parseRGHSDate(row['DATEOFADMISSION']);
    newRow['DATEOFDISCHARGE'] = parseRGHSDate(row['DATEOFDISCHARGE']);
    newRow['CLAIMSUBMISSIONDATE'] = parseRGHSDate(row['CLAIMSUBMISSIONDATE']);
    newRow['TPAFINALACTIONDATA'] = parseRGHSDate(row['TPAFINALACTIONDATA']);
    newRow['CUFINALACTIONDATE'] = parseRGHSDate(row['CUFINALACTIONDATE']);
    
    return newRow;
  });
};

// Generate RGHS dashboard statistics
export const generateRGHSDashboardStats = (tmsData, paymentData = []) => {
  if (!tmsData || tmsData.length === 0) return null;

  // --- DIAGNOSTIC LOGS START ---
  console.log('[DIAGNOSTIC] RGHS Stats Generation Started');
  console.log(`[DIAGNOSTIC] Received ${paymentData.length} rows in paymentData.`);
  if (paymentData.length > 0) {
    console.log('[DIAGNOSTIC] Keys of the first paymentData row:', Object.keys(paymentData[0]));
  }
  // --- DIAGNOSTIC LOGS END ---

  const nonOPDData = tmsData.filter(row => row['STATUS'] && !row['STATUS'].toUpperCase().includes('OPD'));
  const processedData = preprocessRGHSTMSData(nonOPDData);
  
  console.log('[DEBUG] RGHS TMS processed rows:', processedData.length);
  
  // Basic claim statistics with RGHS-specific status detection
  const totalClaims = processedData.length;
  
  // RGHS Status Patterns:
  // Approved: "OPD CLAIM APPROVED", "Claim Approved by Claim Unit"
  // Pending: "Claim Pending with Claim Unit", "OPD CLAIM PENDING WITH TPA" 
  // Rejected: "Pre Auth Package Rejected", etc.
  
  const approvedClaims = processedData.filter(row => 
    row['STATUS'] && row['STATUS'].toUpperCase().includes('APPROVED')
  ).length;
  
  const rejectedClaims = processedData.filter(row => 
    row['STATUS'] && (
      row['STATUS'].toUpperCase().includes('REJECTED') ||
      row['STATUS'].toUpperCase().includes('REJECT')
    )
  ).length;
  
  const pendingClaims = processedData.filter(row => 
    row['STATUS'] && row['STATUS'].toUpperCase().includes('PENDING')
  ).length;

  // For RGHS, "paid" claims are approved claims (since payment happens separately)
  const paidClaims = approvedClaims;

  // Financial calculations - use correct RGHS fields
  const totalPaidAmount = paymentData.reduce((sum, row) => {
    return sum + parseNumber(row['Paid Amount(Rs.)']);
  }, 0);

  // Find the correct column names dynamically to handle variations
  const claimAmountCol = Object.keys(paymentData[0] || {}).find(key => key.toLowerCase().includes('hospital claim amount'));
  const cuApprovedCol = Object.keys(paymentData[0] || {}).find(key => key.toLowerCase().includes('cu claim amount'));

  // Total Claim Value: Use payment tracker ONLY.
  const totalClaimValue = paymentData.length > 0 && claimAmountCol
    ? paymentData.reduce((sum, row) => sum + parseNumber(row[claimAmountCol]), 0)
    : 0;
    
  // TPA and CU approved amounts
  const totalTPAApproved = processedData.reduce((sum, row) => sum + row['TPAAPRROVEDAMOUNT'], 0);
  // Total CU Approved: Use payment tracker ONLY.
  const totalCUApproved = paymentData.length > 0 && cuApprovedCol
    ? paymentData.reduce((sum, row) => sum + parseNumber(row[cuApprovedCol]), 0)
    : 0;
  
  // Outstanding Revenue: Claims approved but not necessarily paid
  const approvedUnpaidAmount = processedData
    .filter(row => row['STATUS'] && row['STATUS'].toUpperCase() === 'CLAIM APPROVED BY CLAIM UNIT')
    .reduce((sum, row) => sum + row['CUAPPROVEDAMOUNT'], 0);
  
  const totalRealizableRevenue = approvedUnpaidAmount + totalPaidAmount;

  // Key Performance Indicators
  // Query incidence: Claims with pending status or non-empty QUERYSTATUS
  const queryIncidence = processedData.filter(row => 
    (row['STATUS'] && row['STATUS'].toUpperCase().includes('PENDING')) ||
    (row['QUERYSTATUS'] && row['QUERYSTATUS'].trim() !== '')
  ).length / totalClaims * 100;
  
  const denialRate = rejectedClaims / totalClaims * 100;
  const collectionEfficiency = totalRealizableRevenue > 0 ? (totalPaidAmount / totalRealizableRevenue) * 100 : 0;

  // Revenue calculations
  // Revenue Leakage: Rejected claims × Hospital Claim Amount
  const revenueLeakage = processedData
    .filter(row => row['STATUS'] && row['STATUS'].toUpperCase().includes('REJECT'))
    .reduce((sum, row) => sum + row['HOSPITALCLAIMAMOUNT'], 0);
  
  const revenueLeakageRate = totalClaimValue > 0 ? (revenueLeakage / totalClaimValue) * 100 : 0;
  
  // Revenue stuck in query: Pending claims amount
  const revenueStuckInQuery = processedData
    .filter(row => row['STATUS'] && row['STATUS'].toUpperCase().includes('PENDING'))
    .reduce((sum, row) => sum + row['HOSPITALCLAIMAMOUNT'], 0);

  // Average package amounts
  const avgHospitalClaimAmount = totalClaims > 0 ? totalClaimValue / totalClaims : 0;
  const avgTPAAmount = totalClaims > 0 ? totalTPAApproved / totalClaims : 0;
  const avgCUAmount = totalClaims > 0 ? totalCUApproved / totalClaims : 0;

  // High value claims (>1L)
  const highValueClaims = processedData.filter(row => row['HOSPITALCLAIMAMOUNT'] > 100000).length;
  const highValueClaimsPercentage = totalClaims > 0 ? (highValueClaims / totalClaims) * 100 : 0;

  // Average Length of Stay from the 'LENGTHOFSTAY' column
  const lengthOfStayData = processedData
    .map(row => row['LENGTHOFSTAY'])
    .filter(days => days !== null && days > 0 && days <= 365); // Filter for valid, positive values
  
  const avgLengthOfStay = lengthOfStayData.length > 0
    ? lengthOfStayData.reduce((a, b) => a + b, 0) / lengthOfStayData.length
    : null;

  const admissionDates = processedData.map(row => row['DATEOFADMISSION']).filter(Boolean);
  const minDate = admissionDates.length > 0 ? admissionDates.reduce((min, p) => p < min ? p : min, admissionDates[0]) : null;
  const maxDate = admissionDates.length > 0 ? admissionDates.reduce((max, p) => p > max ? p : max, admissionDates[0]) : null;

  return {
    // Basic metrics
    totalClaims,
    paidClaims,
    approvedClaims,
    rejectedClaims,
    pendingClaims,
    
    // Financial metrics
    totalClaimValue,
    totalRealizableRevenue,
    totalTPAApproved,
    totalCUApproved,
    totalPaidAmount,
    avgHospitalClaimAmount,
    avgTPAAmount,
    avgCUAmount,
    revenueLeakage,
    revenueLeakageRate,
    approvedUnpaidAmount,
    revenueStuckInQuery,
    
    // KPIs
    queryIncidence,
    denialRate,
    collectionEfficiency,
    highValueClaimsPercentage,
    avgLengthOfStay,
    
    // Additional metrics for compatibility with existing dashboard
    healthScore: Math.min(90, (100 - denialRate) * 0.4 + collectionEfficiency * 0.4 + (100 - queryIncidence) * 0.2),
    
    // Compatibility fields for existing dashboard components
    averageClaimAmount: avgHospitalClaimAmount,
    cashConversionRate: collectionEfficiency,
    rejectionRate: denialRate,
    queryRate: queryIncidence,
    revenueLoss: revenueLeakage,
    totalApprovedAmount: Math.max(totalTPAApproved, totalCUApproved),
    
    // Date range for calculations
    minDate,
    maxDate,

    // Status breakdown
    claimsByStatus: processedData.reduce((acc, row) => {
      const status = row['STATUS'] || 'Unknown';
      if (!acc[status]) {
        acc[status] = { count: 0, amount: 0 };
      }
      acc[status].count += 1;
      acc[status].amount += row['HOSPITALCLAIMAMOUNT'];
      return acc;
    }, {})
  };
};

// Generate RGHS chart data
export const generateRGHSChartData = (tmsData, paymentData = []) => {
  if (!tmsData || tmsData.length === 0) return {};

  const nonOPDData = tmsData.filter(row => row['STATUS'] && !row['STATUS'].toUpperCase().includes('OPD'));
  const processedData = preprocessRGHSTMSData(nonOPDData);

  // Monthly trends based on admission dates
  const monthlyData = processedData.reduce((acc, row) => {
    const admissionDate = parseRGHSDate(row['DATEOFADMISSION']);
    if (admissionDate) {
      const monthKey = format(admissionDate, 'MMM yyyy');
      if (!acc[monthKey]) {
        acc[monthKey] = { 
          month: monthKey, 
          claims: 0, 
          amount: 0,
          date: admissionDate 
        };
      }
      acc[monthKey].claims += 1;
      acc[monthKey].amount += row['TPAAPRROVEDAMOUNT'];
    }
    return acc;
  }, {});

  const monthlyTrends = Object.values(monthlyData).sort((a, b) => 
    new Date(a.month) - new Date(b.month)
  );

  // Hospital performance
  const hospitalData = processedData.reduce((acc, row) => {
    const hospital = row['HOSPITALNAME'] || 'Unknown';
    if (!acc[hospital]) {
      acc[hospital] = { hospital, claims: 0, amount: 0 };
    }
    acc[hospital].claims += 1;
    acc[hospital].amount += row['TPAAPRROVEDAMOUNT'];
    return acc;
  }, {});

  const topHospitals = Object.values(hospitalData)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Department/Specialty distribution
  const departmentData = processedData.reduce((acc, row) => {
    const department = row['DEPARTMENT'] || 'Unknown';
    if (!acc[department]) {
      acc[department] = { specialty: department, claims: 0, amount: 0 };
    }
    acc[department].claims += 1;
    acc[department].amount += row['TPAAPRROVEDAMOUNT'];
    return acc;
  }, {});

  const topSpecialties = Object.values(departmentData)
    .filter(item => item.specialty !== 'Unknown')
    .sort((a, b) => b.claims - a.claims)
    .slice(0, 8);

  // Gender distribution
  const genderData = processedData.reduce((acc, row) => {
    const gender = row['GENDER'] || 'Unknown';
    acc[gender] = (acc[gender] || 0) + 1;
    return acc;
  }, {});

  const genderDistribution = Object.entries(genderData)
    .filter(([gender]) => gender !== 'Unknown')
    .map(([gender, count]) => ({
      gender,
      count,
      percentage: (count / processedData.length * 100).toFixed(1)
    }));

  return {
    monthlyTrends,
    topHospitals,
    topSpecialties,
    genderDistribution,
    
    // Status-wise revenue for compatibility
    statusWiseRevenue: Object.entries(processedData.reduce((acc, row) => {
      const status = row['STATUS'] || 'Unknown';
      // Filter out Success and In Progress statuses (various patterns)
      const statusLower = status.toLowerCase();
      if (statusLower.includes('success') || 
          statusLower.includes('in progress') ||
          statusLower.includes('in process') ||
          statusLower.includes('inprogress') ||
          statusLower.includes('inprocess')) {
        return acc;
      }
      if (!acc[status]) acc[status] = { count: 0, amount: 0 };
      acc[status].count += 1;
      acc[status].amount += row['HOSPITALCLAIMAMOUNT'];
      return acc;
    }, {})).map(([status, data]) => ({
      status,
      count: data.count,
      amount: data.amount,
      isStuck: !status.toLowerCase().includes('paid') && !status.toLowerCase().includes('reject')
    }))
  };
};

// Parse date strings from various formats in the CSV
export const parseDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString !== 'string') return null;
  const trimmed = dateString.trim();
  if (trimmed === '') return null;

  // Handle custom format: ' 17,February , 2025 12:00 AM'
  const customMatch = trimmed.match(/^(\d{1,2}),([A-Za-z]+)\s*,\s*(\d{4})\s*(.*)$/);
  if (customMatch) {
    // e.g., '17,February , 2025 12:00 AM' => '17 February 2025 12:00 AM'
    const day = customMatch[1];
    const month = customMatch[2];
    const year = customMatch[3];
    const time = customMatch[4] || '00:00 AM';
    const reformatted = `${day} ${month} ${year} ${time}`;
    const parsed = new Date(reformatted);
    if (!isNaN(parsed)) return parsed;
  }

  // Handle payment date format: '17-FEB-25 12.00.00 AM'
  const paymentMatch = trimmed.match(/^(\d{1,2})-([A-Z]+)-(\d{2})\s*(.*)$/);
  if (paymentMatch) {
    const day = paymentMatch[1];
    const monthAbbr = paymentMatch[2];
    const year = `20${paymentMatch[3]}`; // Convert 25 to 2025
    const time = paymentMatch[4] || '00:00 AM';
    
    // Convert month abbreviation to full name
    const monthMap = {
      'JAN': 'January', 'FEB': 'February', 'MAR': 'March', 'APR': 'April',
      'MAY': 'May', 'JUN': 'June', 'JUL': 'July', 'AUG': 'August',
      'SEP': 'September', 'OCT': 'October', 'NOV': 'November', 'DEC': 'December'
    };
    const month = monthMap[monthAbbr] || monthAbbr;
    const reformatted = `${day} ${month} ${year} ${time.replace(/\./g, ':')}`;
    const parsed = new Date(reformatted);
    if (!isNaN(parsed)) return parsed;
  }

  // Fallback to standard parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed)) return parsed;
    return null;
};

const getMonthNumber = (monthName) => {
  const months = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };
  return months[monthName] || '01';
};

// Clean and parse numeric values
export const parseNumber = (value) => {
  if (!value || value === '') return 0;
  const cleaned = value.toString().replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
};

// Data preprocessing according to hospital_dashboard_metrics.md
export const preprocessHospitalData = (data) => {
  if (!data || data.length === 0) return data;

  // DEBUG: Log data loading info
  console.log('📁 DATA LOADING DEBUG:');
  console.log(`Raw data rows loaded: ${data.length}`);
  console.log(`Sample row:`, data[0]);

  let debugCount = 0;
  return data.map(row => {
    const newRow = { ...row };
    // Parse numbers
    newRow['Pkg Rate'] = parseNumber(row['Pkg Rate']);
    newRow['Approved Amount'] = parseNumber(row['Approved Amount']);
    newRow['Actual Paid Amount'] =
      row['Status'] && row['Status'].includes('Claim Paid')
        ? parseNumber(row['Approved Amount'])
        : 0;
    newRow['Query Raised'] = parseNumber(row['Query Raised']);
    newRow['Days to Payment'] = parseNumber(row['Days to Payment']);
    if (debugCount < 20) {
      console.log('[DEBUG] Raw Query Raised:', row['Query Raised'], 'Parsed:', newRow['Query Raised']);
      console.log('[DEBUG] Raw Days to Payment:', row['Days to Payment'], 'Parsed:', newRow['Days to Payment']);
      debugCount++;
    }
    // Parse dates
    newRow['Date of Admission'] = parseDate(row['Date of Admission']);
    newRow['Date of Discharge'] = parseDate(row['Date of Discharge']);
    newRow['Modified Date'] = parseDate(row['Modified Date']);
    newRow['Payment Date'] = parseDate(row['Payment Date']);
    return newRow;
  });
};

// Group data by TID to treat each TID as one claim
export const groupDataByTID = (data) => {
  if (!data || data.length === 0) return [];

  const groupedByTID = data.reduce((acc, row) => {
    const tid = row['TID'];
    if (!tid) return acc;

    if (!acc[tid]) {
      // Initialize claim with first row data
      acc[tid] = {
        TID: tid,
        'Patient Name': row['Patient Name'],
        'Hospital Code': row['Hospital Code'],
        'Hospital Name': row['Hospital Name'],
        'Hospital Type': row['Hospital Type'],
        'Date of Admission': row['Date of Admission'],
        'Time of Admission': row['Time of Admission'],
        'Date of Discharge': row['Date of Discharge'],
        'Time of Discharge': row['Time of Discharge'],
        'Modified Date': row['Modified Date'],
        'Id Type': row['Id Type'],
        'Id Number': row['Id Number'],
        'District Name': row['District Name'],
        'Aadhaar Number': row['Aadhaar Number'],
        'Aadhaar Name': row['Aadhaar Name'],
        'Policy Year': row['Policy Year'],
        'Mobile No': row['Mobile No'],
        'Status': row['Status'],
        'Payment Type': row['Payment Type'],
        'Claim Number': row['Claim Number'],
        'Gender': row['Gender'],
        'Age': row['Age'],
        'Payment Date': row['Payment Date'],
        'Bank UTR Number': row['Bank UTR Number'],
        'TPA Name': row['TPA Name'],
        'Claim Processor Name': row['Claim Processor Name'],
        'Claim Processor SSOID': row['Claim Processor SSOID'],
        'Pkg Speciality Name': row['Pkg Speciality Name'],
        'Package Remark': row['Package Remark'],
        'Claim Submission Dt': row['Claim Submission Dt'],
        // Summed amounts
        'Pkg Rate': 0,
        'Approved Amount': 0,
        'Actual Paid Amount': 0,
        'Query Raised': 0,
        'Days to Payment': 0,
        // Component tracking
        components: []
      };
    }

    // Add component details
    acc[tid].components.push({
      'Pkg Code': row['Pkg Code'],
      'Pkg Name': row['Pkg Name'],
      'Component Pkg Rate': row['Pkg Rate'],
      'Component Approved Amount': row['Approved Amount'],
      'Component Actual Paid Amount': row['Actual Paid Amount']
    });

    // Sum up amounts for the claim
    acc[tid]['Pkg Rate'] += row['Pkg Rate'];
    acc[tid]['Approved Amount'] += row['Approved Amount'];
    acc[tid]['Actual Paid Amount'] += row['Actual Paid Amount'];
    
    // For query and payment days, use the maximum value (most conservative approach)
    acc[tid]['Query Raised'] = Math.max(acc[tid]['Query Raised'], row['Query Raised']);
    acc[tid]['Days to Payment'] = Math.max(acc[tid]['Days to Payment'], row['Days to Payment']);

    return acc;
  }, {});

  return Object.values(groupedByTID);
};

// Generate multi-payer dashboard statistics with proper RGHS handling
export const generateMultiPayerDashboardStats = (data) => {
  if (!data || data.length === 0) return null;
  
  console.log('📊 Generating multi-payer dashboard stats...');
  
  // Separate data by payer type
  const rghsTMSData = data.filter(row => row.payerName === 'RGHS TMS' || row.payerName === 'RGHS');
  const rghsPaymentData = data.filter(row => row.payerName === 'RGHS Payment Tracker');
  const maaData = data.filter(row => row.payerName === 'MAA Yojana');
  
  console.log(`Data breakdown: RGHS TMS: ${rghsTMSData.length}, Payment Tracker: ${rghsPaymentData.length}, MAA: ${maaData.length}`);
  
  // If we have RGHS data, we need to handle it specially
  if (rghsTMSData.length > 0 || rghsPaymentData.length > 0) {
    // Convert RGHS data to the format expected by generateRGHSDashboardStats
    const tmsDataForRGHS = rghsTMSData.map(row => ({
      'TID': row.claimId,
      'PATIENTNAME': row.patientName,
      'HOSPITALNAME': row.hospitalName,
      'STATUS': row.status,
      'HOSPITALCLAIMAMOUNT': row.claimedAmount,
      'TPAAPRROVEDAMOUNT': row.approvedAmount || 0,
      'CUAPPROVEDAMOUNT': row.approvedAmount || 0,
      'DATEOFADMISSION': row.serviceDate,
      'DATEOFDISCHARGE': row.dischargeDate,
      'LENGTHOFSTAY': 0, // Calculate if needed
      'QUERYSTATUS': ''
    }));
    
    const paymentDataForRGHS = rghsPaymentData.map(row => ({
      'Transaction Id': row.claimId,
      'Patient Name': row.patientName,
      'Hospital Name': row.hospitalName,
      'Hospital Claim Amount': row.claimedAmount,
      'CU Claim Amount': row.approvedAmount,
      'Paid Amount(Rs.)': row.paidAmount,
      'Final Status': row.status
    }));
    
    // Call RGHS-specific calculation
    const rghsStats = generateRGHSDashboardStats(tmsDataForRGHS, paymentDataForRGHS);
    
    // If we also have MAA data, we need to combine stats
    if (maaData.length > 0) {
      // Process MAA data separately
      const maaFormatData = convertSDSToMAAFormat(maaData);
      const maaStats = generateDashboardStats(maaFormatData);
      
      // Combine stats properly
      return {
        // Basic counts
        totalClaims: (rghsStats?.totalClaims || 0) + (maaStats?.totalClaims || 0),
        paidClaims: (rghsStats?.paidClaims || 0) + (maaStats?.paidClaims || 0),
        approvedClaims: (rghsStats?.approvedClaims || 0) + (maaStats?.approvedClaims || 0),
        rejectedClaims: (rghsStats?.rejectedClaims || 0) + (maaStats?.rejectedClaims || 0),
        pendingClaims: (rghsStats?.pendingClaims || 0) + (maaStats?.pendingClaims || 0),
        
        // Financial metrics - sum both
        totalClaimValue: (rghsStats?.totalClaimValue || 0) + (maaStats?.totalClaimValue || 0),
        totalApprovedAmount: (rghsStats?.totalApprovedAmount || 0) + (maaStats?.totalApprovedAmount || 0),
        totalPaidAmount: (rghsStats?.totalPaidAmount || 0) + (maaStats?.totalPaidAmount || 0),
        revenueLeakage: (rghsStats?.revenueLeakage || 0) + (maaStats?.revenueLeakage || 0),
        approvedUnpaidAmount: (rghsStats?.approvedUnpaidAmount || 0) + (maaStats?.approvedUnpaidAmount || 0),
        revenueStuckInQuery: (rghsStats?.revenueStuckInQuery || 0) + (maaStats?.revenueStuckInQuery || 0),
        
        // Rejected and pending amounts
        rejectedAmount: (rghsStats?.revenueLeakage || 0) + (maaStats?.rejectedAmount || 0),
        pendingAmount: (rghsStats?.revenueStuckInQuery || 0) + (maaStats?.pendingAmount || 0),
        
        // Percentages - recalculate based on combined totals
        denialRate: ((rghsStats?.rejectedClaims || 0) + (maaStats?.rejectedClaims || 0)) / 
                   ((rghsStats?.totalClaims || 0) + (maaStats?.totalClaims || 0)) * 100,
        
        // Collection efficiency - weighted average
        collectionEfficiency: ((rghsStats?.totalPaidAmount || 0) + (maaStats?.totalPaidAmount || 0)) / 
                             ((rghsStats?.totalRealizableRevenue || rghsStats?.totalApprovedAmount || 0) + 
                              (maaStats?.totalApprovedAmount || 0)) * 100,
        
        // Revenue leakage rate
        revenueLeakageRate: ((rghsStats?.revenueLeakage || 0) + (maaStats?.revenueLeakage || 0)) /
                           ((rghsStats?.totalClaimValue || 0) + (maaStats?.totalClaimValue || 0)) * 100,
        
        // Average claim amount
        averageClaimAmount: ((rghsStats?.totalClaimValue || 0) + (maaStats?.totalClaimValue || 0)) /
                           ((rghsStats?.totalClaims || 0) + (maaStats?.totalClaims || 0)),
        
        // Query metrics - MAA only has this data
        firstPassRate: maaStats?.firstPassRate || null,
        queryIncidence: maaStats?.queryIncidence || null,
        queryDistribution: maaStats?.queryDistribution || null,
        
        // Processing times - use MAA data if available
        avgProcessingTime: maaStats?.avgProcessingTime || null,
        nonQueryAvgTime: maaStats?.nonQueryAvgTime || null,
        queryAvgTime: maaStats?.queryAvgTime || null,
        timeImpact: maaStats?.timeImpact || null,
        
        // Operational metrics - use MAA data since these are MAA-specific
        avgLengthOfStay: maaStats?.avgLengthOfStay || null,
        avgDischargeToPaymentDays: maaStats?.avgDischargeToPaymentDays || null,
        queryCausedDelay: maaStats?.queryCausedDelay || null,
        
        // High value claims - recalculate percentage based on combined data
        highValueClaimsPercentage: ((rghsStats?.highValueClaimsPercentage || 0) * (rghsStats?.totalClaims || 0) + 
                                   (maaStats?.highValueClaimsPercentage || 0) * (maaStats?.totalClaims || 0)) / 
                                   ((rghsStats?.totalClaims || 0) + (maaStats?.totalClaims || 0)),
        
        // Scores - recalculate
        healthScore: 85, // Simplified - should recalculate properly
        
        // Keep track of what data we have
        isMixedPayer: true,
        hasRGHSData: true,
        hasMAAData: true,
        payerBreakdown: {
          rghs: rghsStats,
          maa: maaStats
        }
      };
    }
    
    // Add missing fields that dashboard expects
    return {
      ...rghsStats,
      // Add fields that RGHS doesn't have but dashboard expects
      rejectedAmount: rghsStats?.revenueLeakage || 0,
      pendingAmount: rghsStats?.revenueStuckInQuery || 0,
      highValueClaimsPercentage: rghsStats?.highValueClaimsPercentage || 0,
      firstPassRate: null,
      queryDistribution: null,
      avgProcessingTime: null,
      nonQueryAvgTime: null,
      queryAvgTime: null,
      timeImpact: null,
      avgDischargeToPaymentDays: null,
      avgQueryDelayFromDischargeToPayment: null,
      queryCausedDelay: null,
      hasRGHSData: true,
      hasMAAData: false
    };
  }
  
  // If only MAA data, convert from SDS format first
  const maaFormatData = convertSDSToMAAFormat(data);
  return generateDashboardStats(maaFormatData);
};

// Generate dashboard statistics with advanced RCM metrics according to hospital_dashboard_metrics.md
// Convert multi-payer SDS format to MAA format for compatibility
const convertSDSToMAAFormat = (data) => {
  console.log('🔄 Converting SDS format to MAA format for processing');
  return data.map(row => {
    // Base mapping
    const mappedRow = {
      'TID': row.claimId,
      'Patient Name': row.patientName,
      'Hospital Name': row.hospitalName,
      'Hospital Code': row.hospitalCode || '',
      'Hospital Type': row.hospitalType || '',
      'Date of Admission': row.serviceDate,
      'Time of Admission': row.timeOfAdmission || '',
      'Date of Discharge': row.dischargeDate,
      'Time of Discharge': row.timeOfDischarge || '',
      'Status': row.status,
      'Pkg Rate': row.claimedAmount,
      'Approved Amount': row.approvedAmount,
      'Paid Amount': row.paidAmount,
      // Map specialty fields for both MAA and RGHS
      'Pkg Speciality Name': row.specialty || row.packageName || row.DEPARTMENT || row['Pkg Speciality Name'] || 'Unknown',
      'Package Name': row.packageName || row.specialty || 'Unknown',
      'Pkg Code': row.packageCode || row.pkgCode || '',
      'Pkg Name': row.packageName || '',
      // Map demographic fields
      'District Name': row.districtName || row['District Name'] || '',
      'Gender': row.gender || row.Gender || row.GENDER || 'Unknown',
      'Age': row.age || '',
      // Map query-related fields
      'Query Raised': row.queryRaised || 0,
      'Days to Payment': row.daysToPayment || 0,
      'Payment Date': row.paymentDate || null,
      'Modified Date': row.modifiedDate || null,
      // Additional fields for compatibility
      'Id Type': row.idType || '',
      'Id Number': row.idNumber || '',
      'Aadhaar Number': row.aadhaarNumber || '',
      'Aadhaar Name': row.aadhaarName || '',
      'Policy Year': row.policyYear || '',
      'Mobile No': row.mobileNo || '',
      'Payment Type': row.paymentType || '',
      'Claim Number': row.claimNumber || '',
      'Bank UTR Number': row.bankUtrNumber || '',
      'TPA Name': row.tpaName || '',
      'Claim Processor Name': row.claimProcessorName || '',
      'Claim Processor SSOID': row.claimProcessorSSOID || '',
      'Package Remark': row.packageRemark || '',
      'Claim Submission Dt': row.claimSubmissionDate || '',
      // Add payer info as a custom field
      '_payerName': row.payerName
    };
    
    // Apply payer-specific logic
    if (row.payerName === 'MAA Yojana') {
      // For MAA Yojana: Paid amount is approved amount only if status is "Claim Paid"
      mappedRow['Paid Amount'] = (row.status === 'Claim Paid') ? row.approvedAmount : 0;
      // Actual paid amount for calculations
      mappedRow['Actual Paid Amount'] = mappedRow['Paid Amount'];
    } else if (row.payerName === 'RGHS TMS') {
      // For RGHS TMS: Payment information comes from Payment Tracker, not TMS
      // TMS only has approval information
      mappedRow['Paid Amount'] = 0; // RGHS TMS doesn't have payment info
      mappedRow['Actual Paid Amount'] = 0;
    } else if (row.payerName === 'RGHS Payment Tracker') {
      // Payment tracker has actual paid amounts
      mappedRow['Actual Paid Amount'] = row.paidAmount;
    }
    
    return mappedRow;
  });
};

export const generateDashboardStats = (data) => {
  if (!data || data.length === 0) return null;

  // Check if this is multi-payer data (SDS format)
  let dataToProcess = data;
  let isMultiPayer = false;
  if (data[0] && data[0].payerName && data[0].claimId) {
    console.log('📊 Multi-payer data detected, converting format...');
    isMultiPayer = true;
    dataToProcess = convertSDSToMAAFormat(data);
    
    // Log payer breakdown and unique statuses
    const payerCounts = {};
    const statusesByPayer = {};
    const amountsByPayer = {};
    data.forEach(row => {
      payerCounts[row.payerName] = (payerCounts[row.payerName] || 0) + 1;
      if (!statusesByPayer[row.payerName]) {
        statusesByPayer[row.payerName] = new Set();
        amountsByPayer[row.payerName] = {
          claimed: 0,
          approved: 0,
          paid: 0
        };
      }
      statusesByPayer[row.payerName].add(row.status);
      amountsByPayer[row.payerName].claimed += row.claimedAmount || 0;
      amountsByPayer[row.payerName].approved += row.approvedAmount || 0;
      amountsByPayer[row.payerName].paid += row.paidAmount || 0;
    });
    console.log('Payer breakdown:', payerCounts);
    console.log('Unique statuses by payer:');
    Object.entries(statusesByPayer).forEach(([payer, statuses]) => {
      console.log(`  ${payer}:`, Array.from(statuses));
    });
    console.log('Amounts by payer:', amountsByPayer);
  }

  // Preprocess data first
  const processedData = preprocessHospitalData(dataToProcess);
  
  // Group data by TID to treat each TID as one claim
  const groupedData = groupDataByTID(processedData);
  
  console.log('[DEBUG] Original rows:', processedData.length, 'Grouped claims:', groupedData.length);
  
  // Status matching functions that handle both MAA and RGHS formats
  const isPaidStatus = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('claim paid') || s === 'success' || s.includes('payment done');
  };
  
  const isApprovedStatus = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('approved') || s === 'success';
  };
  
  const isRejectedStatus = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('rejected') || s.includes('reject') || s === 'failed';
  };
  
  const isPendingStatus = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('pending') || s.includes('in progress') || s.includes('under review');
  };

  // Basic claim statistics (now based on grouped data)
  const totalClaims = groupedData.length;
  const paidClaims = groupedData.filter(row => isPaidStatus(row['Status'])).length;
  const approvedClaims = groupedData.filter(row => isApprovedStatus(row['Status'])).length;
  const rejectedClaims = groupedData.filter(row => isRejectedStatus(row['Status'])).length;
  const pendingClaims = groupedData.filter(row => isPendingStatus(row['Status'])).length;

  // Key Performance Indicators
  // Check if we have query data (MAA Yojana has it, RGHS might not)
  const hasQueryData = groupedData.some(row => row['Query Raised'] !== undefined);
  const firstPassRate = hasQueryData 
    ? (groupedData.filter(row => row['Query Raised'] === 0).length / totalClaims) * 100 
    : null;
  const queryIncidence = hasQueryData 
    ? (groupedData.filter(row => row['Query Raised'] > 0).length / totalClaims) * 100
    : null;
  
  // Fixed: Denial rate should include Claims Rejected by both Supervisor and Analyser (using TID-level for rate calculation)
  // For RGHS, also include statuses with REJECT/REJECTED
  const rejectedOnlyClaims = groupedData.filter(row => {
    const status = row['Status'] || '';
    const statusUpper = status.toUpperCase();
    
    // MAA Yojana specific statuses
    if (status === 'Claim Rejected (Supervisor)' || status === 'Claim Rejected (Analyser)') {
      return true;
    }
    
    // RGHS statuses - check for REJECT or REJECTED
    if (statusUpper.includes('REJECT')) {
      return true;
    }
    
    return false;
  }).length;
  const denialRate = totalClaims > 0 ? (rejectedOnlyClaims / totalClaims) * 100 : 0;
  
  // Financial calculations 
  // Use grouped data for total claim value and approved amounts (TID-level aggregation)
  // For RGHS in multi-payer mode, we should use Pkg Rate (claimed amount)
  let totalClaimValue = 0;
  let totalApprovedAmount = 0;
  
  if (isMultiPayer) {
    // In multi-payer mode, calculate totals based on payer type
    groupedData.forEach(row => {
      const payerName = processedData.find(r => r['TID'] === row['TID'])?._payerName;
      
      if (payerName === 'RGHS TMS' || payerName === 'RGHS' || payerName === 'RGHS Payment Tracker') {
        // For RGHS, use Pkg Rate as claimed amount
        totalClaimValue += row['Pkg Rate'] || 0;
      } else {
        // For MAA Yojana, use Pkg Rate as claimed amount
        totalClaimValue += row['Pkg Rate'] || 0;
      }
      
      totalApprovedAmount += row['Approved Amount'] || 0;
    });
  } else {
    // Single payer mode - use Pkg Rate for claim value
    totalClaimValue = groupedData.reduce((sum, row) => sum + (row['Pkg Rate'] || 0), 0);
    totalApprovedAmount = groupedData.reduce((sum, row) => sum + (row['Approved Amount'] || 0), 0);
  }
  
  // For paid amounts, use raw processed data to capture all paid rows
  // This prevents loss of revenue from mixed-status TIDs
  const claimPaidRows = processedData.filter(row => isPaidStatus(row['Status']));
  const totalPaidAmount = claimPaidRows.reduce((sum, row) => {
    // For multi-payer data, use Actual Paid Amount if available
    if (row['Actual Paid Amount'] !== undefined && row['Actual Paid Amount'] !== 0) {
      return sum + row['Actual Paid Amount'];
    }
    return sum + row['Approved Amount'];
  }, 0);
  
  // DEBUG: Log the calculation details
  console.log('🔍 REVENUE CALCULATION DEBUG:');
  console.log(`Total processed rows: ${processedData.length}`);
  console.log(`Claim Paid rows found: ${claimPaidRows.length}`);
  console.log(`Total Paid Amount: ₹${totalPaidAmount.toLocaleString()}`);
  console.log(`Total Paid Amount (crores): ₹${(totalPaidAmount/10000000).toFixed(2)} crores`);
  
  // Collection efficiency calculation
  // For RGHS, use totalRealizableRevenue (approvedUnpaid + paid)
  let collectionEfficiency = 0;
  if (isMultiPayer) {
    // Check if we have RGHS data
    const hasRGHSData = processedData.some(row => 
      row['_payerName'] === 'RGHS TMS' || row['_payerName'] === 'RGHS' || row['_payerName'] === 'RGHS Payment Tracker'
    );
    
    if (hasRGHSData) {
      // For RGHS, collection efficiency = paid / (approvedUnpaid + paid)
      // This will be calculated after we have approvedUnpaidAmount
      collectionEfficiency = 0; // Will be recalculated later
    } else {
      // For MAA Yojana only
      collectionEfficiency = totalApprovedAmount > 0 ? (totalPaidAmount / totalApprovedAmount) * 100 : 0;
    }
  } else {
    collectionEfficiency = totalApprovedAmount > 0 ? (totalPaidAmount / totalApprovedAmount) * 100 : 0;
  }
  
  // Revenue leakage calculations - only include rejected claims using raw data
  const rejectedClaimsAmount = processedData
    .filter(row => isRejectedStatus(row['Status']))
    .reduce((sum, row) => sum + row['Pkg Rate'], 0);
    
  // DEBUG: Log revenue leakage calculation
  const rejectedRows = processedData.filter(row => row['Status'] && (
    row['Status'] === 'Claim Rejected (Supervisor)' ||
    row['Status'] === 'Claim Rejected (Analyser)'
  ));
  console.log('💸 REVENUE LEAKAGE DEBUG:');
  console.log(`Claim Rejected (Supervisor) rows: ${processedData.filter(r => r['Status'] === 'Claim Rejected (Supervisor)').length}`);
  console.log(`Claim Rejected (Analyser) rows: ${processedData.filter(r => r['Status'] === 'Claim Rejected (Analyser)').length}`);
  console.log(`Total rejected rows: ${rejectedRows.length}`);
  console.log(`Revenue Leakage: ₹${rejectedClaimsAmount.toLocaleString()}`);
  console.log(`Revenue Leakage (crores): ₹${(rejectedClaimsAmount/10000000).toFixed(2)} crores`);
  
  const revenueLeakage = rejectedClaimsAmount;
  const revenueLeakageRate = totalClaimValue > 0 ? (revenueLeakage / totalClaimValue) * 100 : 0;
  

  // Status-wise amount analysis using Pkg Rate (grouped by TID)
  const claimsByStatus = groupedData.reduce((acc, row) => {
    const status = row['Status'] || 'Unknown';
    if (!acc[status]) {
      acc[status] = { count: 0, amount: 0 };
    }
    acc[status].count += 1;
    acc[status].amount += row['Pkg Rate'];
    return acc;
  }, {});

  const rejectedAmount = processedData
    .filter(row => isRejectedStatus(row['Status']))
    .reduce((sum, row) => {
      // For RGHS, use claimed amount (Pkg Rate) for rejected claims
      if (isMultiPayer && row['_payerName'] && (row['_payerName'] === 'RGHS TMS' || row['_payerName'] === 'RGHS')) {
        return sum + (row['Pkg Rate'] || 0);
      }
      // For others, use Pkg Rate or Approved Amount
      return sum + (row['Pkg Rate'] || row['Approved Amount'] || 0);
    }, 0);
  
  const pendingAmount = processedData
    .filter(row => isPendingStatus(row['Status']))
    .reduce((sum, row) => {
      // For RGHS, use claimed amount (Pkg Rate) for pending claims
      if (isMultiPayer && row['_payerName'] && (row['_payerName'] === 'RGHS TMS' || row['_payerName'] === 'RGHS')) {
        return sum + (row['Pkg Rate'] || 0);
      }
      // For others, use Approved Amount or Pkg Rate
      return sum + (row['Approved Amount'] || row['Pkg Rate'] || 0);
    }, 0);

  // Outstanding revenue: Approved claims that are not yet paid
  // For multi-payer data, this includes all approved but unpaid claims
  console.log('🔍 Calculating outstanding amount...');
  
  // Get paid claim IDs from payment tracker data
  const paidClaimIds = new Set();
  if (isMultiPayer) {
    processedData
      .filter(row => row['_payerName'] === 'RGHS Payment Tracker')
      .forEach(row => paidClaimIds.add(row['TID']));
    console.log(`  Found ${paidClaimIds.size} paid claims from Payment Tracker`);
  }
  
  const approvedUnpaidRows = processedData
    .filter(row => {
      const status = row['Status'] || '';
      const isApproved = isApprovedStatus(status);
      const isPaid = isPaidStatus(status);
      
      // For multi-payer data, check payer-specific logic
      if (isMultiPayer && row['_payerName']) {
        const payerName = row['_payerName'];
        
        if (payerName === 'RGHS TMS' || payerName === 'RGHS') {
          // For RGHS: Use exact same logic as generateRGHSDashboardStats
          // Only count claims with exact status "CLAIM APPROVED BY CLAIM UNIT"
          const rghsApproved = status.toUpperCase() === 'CLAIM APPROVED BY CLAIM UNIT';
          // Check if this claim ID is in the paid claims set
          const isAlreadyPaid = paidClaimIds.has(row['TID']);
          return rghsApproved && !isAlreadyPaid;
        } else if (payerName === 'RGHS Payment Tracker') {
          // Payment tracker items are already paid, so none are outstanding
          return false;
        }
      }
      
      // Include approved claims that are not paid
      return isApproved && !isPaid;
    });
  
  console.log(`  Found ${approvedUnpaidRows.length} approved unpaid rows`);
  if (approvedUnpaidRows.length > 0 && approvedUnpaidRows.length <= 10) {
    console.log('  Sample statuses:', approvedUnpaidRows.map(r => ({
      payer: r['_payerName'], 
      status: r['Status'],
      amount: r['Approved Amount']
    })).slice(0, 5));
  }
  
  const approvedUnpaidAmount = approvedUnpaidRows
    .reduce((sum, row) => sum + (row['Approved Amount'] || 0), 0);
  console.log(`  Outstanding Amount: ₹${approvedUnpaidAmount.toLocaleString()}`);
  
  // Revenue Stuck in Query: For RGHS, this includes pending claims
  // For MAA, this includes claims with query status
  console.log('🔍 Calculating revenue stuck in query...');
  const queryRows = processedData
    .filter(row => {
      const status = row['Status'] || '';
      const statusLower = status.toLowerCase();
      
      // For multi-payer data, check payer-specific logic
      if (isMultiPayer && row['_payerName']) {
        const payerName = row['_payerName'];
        
        if (payerName === 'RGHS TMS' || payerName === 'RGHS') {
          // For RGHS: Use exact same logic as generateRGHSDashboardStats
          // Only count claims with PENDING in status
          return status.toUpperCase().includes('PENDING');
        }
      }
      
      // Check for query-related or pending statuses
      return statusLower.includes('query') || 
             statusLower.includes('pending') ||
             statusLower.includes('under review') ||
             statusLower.includes('in progress');
    });
  
  console.log(`  Found ${queryRows.length} query/pending rows`);
  if (queryRows.length > 0 && queryRows.length <= 10) {
    console.log('  Sample statuses:', queryRows.map(r => ({
      payer: r['_payerName'],
      status: r['Status'],
      amount: r['Pkg Rate'] || r['Approved Amount']
    })).slice(0, 5));
  }
  
  const revenueStuckInQuery = queryRows
    .reduce((sum, row) => {
      // For RGHS, use claimed amount (Pkg Rate) for query/pending claims
      if (isMultiPayer && row['_payerName'] && (row['_payerName'] === 'RGHS TMS' || row['_payerName'] === 'RGHS')) {
        return sum + (row['Pkg Rate'] || 0);
      }
      // For others, use Pkg Rate or Approved Amount
      return sum + (row['Pkg Rate'] || row['Approved Amount'] || 0);
    }, 0);
  console.log(`  Revenue Stuck in Query: ₹${revenueStuckInQuery.toLocaleString()}`);

  // Query impact analysis (grouped by TID)
  const queryDistribution = hasQueryData 
    ? groupedData.reduce((acc, row) => {
        const queries = row['Query Raised'];
        acc[queries] = (acc[queries] || 0) + 1;
        return acc;
      }, {})
    : null;

  // Average query delay days (robust, with logging and fallbacks)
  let avgWithQuery = null;
  let avgNoQuery = null;
  let avgProcessingTime = null;
  let nonQueryAvgTime = null;
  let queryAvgTime = null;
  let timeImpact = null;
  
  if (hasQueryData) {
    const daysToPaymentWithQuery = groupedData
      .filter(row => row['Query Raised'] > 0 && parseNumber(row['Days to Payment']) > 0 && !isNaN(parseNumber(row['Days to Payment'])))
      .map(row => parseNumber(row['Days to Payment']));
    const daysToPaymentNoQuery = groupedData
      .filter(row => row['Query Raised'] == 0 && parseNumber(row['Days to Payment']) > 0 && !isNaN(parseNumber(row['Days to Payment'])))
      .map(row => parseNumber(row['Days to Payment']));
    console.log('[DEBUG] Days to Payment With Query:', daysToPaymentWithQuery);
    console.log('[DEBUG] Days to Payment No Query:', daysToPaymentNoQuery);
    // Calculate averages with fallbacks
    avgWithQuery = daysToPaymentWithQuery.length > 0
      ? daysToPaymentWithQuery.reduce((a, b) => a + b, 0) / daysToPaymentWithQuery.length
      : 20; // Industry standard for queries
    avgNoQuery = daysToPaymentNoQuery.length > 0
      ? daysToPaymentNoQuery.reduce((a, b) => a + b, 0) / daysToPaymentNoQuery.length
      : 11; // Industry standard for clean claims

    // Processing time analysis (grouped by TID)
    avgProcessingTime = groupedData
      .filter(row => row['Days to Process'] && !isNaN(row['Days to Process']))
      .reduce((sum, row, _, arr) => sum + row['Days to Process'] / arr.length, 0);
      
    nonQueryAvgTime = avgNoQuery;
    queryAvgTime = avgWithQuery;
    timeImpact = avgWithQuery - avgNoQuery;
  }

  // Skip if already calculated above
  if (!hasQueryData) {
    // Set defaults if no query data available
    nonQueryAvgTime = null;
    queryAvgTime = null;
    timeImpact = null;
  }

  // Average discharge to payment time (using Payment Date instead of Modified Date)
  let debugCount = 0;
  const dischargeToPaymentDaysArr = groupedData
    .filter(row => row['Status'] && row['Status'].includes('Claim Paid'))
    .map(row => {
      if (debugCount < 20) {
        console.log('[DEBUG] Raw Discharge:', row['Date of Discharge'], 'Raw Payment Date:', row['Payment Date']);
      }
      const discharge = parseDate(row['Date of Discharge']);
      const payment = parseDate(row['Payment Date']);
      if (debugCount < 20) {
        console.log('[DEBUG] Parsed Discharge:', discharge, 'Parsed Payment:', payment);
      }
      if (discharge instanceof Date && !isNaN(discharge) && payment instanceof Date && !isNaN(payment)) {
        const diff = (payment - discharge) / (1000 * 60 * 60 * 24);
        if (debugCount < 20) {
          console.log('[DEBUG] Days Difference:', diff, diff >= 0.5 ? 'INCLUDED' : 'SKIPPED');
          debugCount++;
        }
        return diff >= 0.5 ? diff : null;
      } else {
        if (debugCount < 20) {
          console.log('[DEBUG] Skipped due to invalid date parsing');
          debugCount++;
        }
      }
      return null;
    })
    .filter(days => days !== null && !isNaN(days));
  const avgDischargeToPaymentDays = dischargeToPaymentDaysArr.length > 0
    ? dischargeToPaymentDaysArr.reduce((a, b) => a + b, 0) / dischargeToPaymentDaysArr.length
    : null;

  // Calculate the difference in days between query and non-query claims
  const avgQueryDelayDays = Math.max(avgWithQuery - avgNoQuery, 0);
  
  // Calculate Average Delay caused by Query from Discharge to Payment for query cases
  const queryDelayFromDischarge = groupedData
    .filter(row => row['Query Raised'] > 0 && row['Status'] && row['Status'].includes('Claim Paid'))
    .map(row => {
      const discharge = parseDate(row['Date of Discharge']);
      const payment = parseDate(row['Payment Date']);
      if (discharge instanceof Date && !isNaN(discharge) && payment instanceof Date && !isNaN(payment)) {
        const diff = (payment - discharge) / (1000 * 60 * 60 * 24);
        return diff >= 0 ? diff : null;
      }
      return null;
    })
    .filter(days => days !== null && !isNaN(days));
  
  // Calculate Average Delay caused by Query for non-query cases
  const nonQueryDelayFromDischarge = groupedData
    .filter(row => row['Query Raised'] === 0 && row['Status'] && row['Status'].includes('Claim Paid'))
    .map(row => {
      const discharge = parseDate(row['Date of Discharge']);
      const payment = parseDate(row['Payment Date']);
      if (discharge instanceof Date && !isNaN(discharge) && payment instanceof Date && !isNaN(payment)) {
        const diff = (payment - discharge) / (1000 * 60 * 60 * 24);
        return diff >= 0 ? diff : null;
      }
      return null;
    })
    .filter(days => days !== null && !isNaN(days));
  
  const avgQueryDelayFromDischargeToPayment = queryDelayFromDischarge.length > 0
    ? queryDelayFromDischarge.reduce((a, b) => a + b, 0) / queryDelayFromDischarge.length
    : null;
    
  const avgNonQueryDelayFromDischargeToPayment = nonQueryDelayFromDischarge.length > 0
    ? nonQueryDelayFromDischarge.reduce((a, b) => a + b, 0) / nonQueryDelayFromDischarge.length
    : null;
  
  // Calculate the actual delay difference caused by queries
  const queryCausedDelay = (avgQueryDelayFromDischargeToPayment && avgNonQueryDelayFromDischargeToPayment)
    ? avgQueryDelayFromDischargeToPayment - avgNonQueryDelayFromDischargeToPayment
    : null;

  // Recalculate collection efficiency for RGHS if needed
  if (isMultiPayer && collectionEfficiency === 0) {
    const hasRGHSData = processedData.some(row => 
      row['_payerName'] === 'RGHS TMS' || row['_payerName'] === 'RGHS' || row['_payerName'] === 'RGHS Payment Tracker'
    );
    
    if (hasRGHSData) {
      // For RGHS, use totalRealizableRevenue formula
      const totalRealizableRevenue = approvedUnpaidAmount + totalPaidAmount;
      collectionEfficiency = totalRealizableRevenue > 0 ? (totalPaidAmount / totalRealizableRevenue) * 100 : 0;
      console.log(`🔍 RGHS Collection Efficiency: ${collectionEfficiency.toFixed(2)}% (Paid: ${totalPaidAmount}, Realizable: ${totalRealizableRevenue})`);
    }
  }

  // Performance scores (stricter)
  const reimbursementScore = Math.max(0, 100 - (revenueLeakageRate * 1.5));
  const efficiencyScore = Math.max(0, 100 - (denialRate * 2) - (queryIncidence * 0.8));
  const cashFlowScore = Math.min(100, collectionEfficiency * 0.7);
  let healthScore = (reimbursementScore * 0.4 + efficiencyScore * 0.4 + cashFlowScore * 0.2);
  healthScore = Math.min(90, healthScore); // Cap at 90

  // Additional hospital performance metrics
  // Average Length of Stay calculation (grouped by TID)
  const lengthOfStayData = groupedData
    .filter(row => row['Date of Admission'] && row['Date of Discharge'])
    .map(row => {
      const admission = parseDate(row['Date of Admission']);
      const discharge = parseDate(row['Date of Discharge']);
      if (admission && discharge && discharge >= admission) {
        return (discharge - admission) / (1000 * 60 * 60 * 24);
      }
      return null;
    })
    .filter(days => days !== null && days >= 0 && days <= 365); // Filter realistic values
  
  const avgLengthOfStay = lengthOfStayData.length > 0
    ? lengthOfStayData.reduce((a, b) => a + b, 0) / lengthOfStayData.length
    : null;


  // High value claims (>1L) - grouped by TID
  const highValueClaims = groupedData.filter(row => row['Pkg Rate'] > 100000).length;
  const highValueClaimsPercentage = totalClaims > 0 ? (highValueClaims / totalClaims) * 100 : 0;

  const admissionDates = processedData.map(row => row['Date of Admission']).filter(Boolean);
  const minDate = admissionDates.length > 0 ? admissionDates.reduce((min, p) => p < min ? p : min, admissionDates[0]) : null;
  const maxDate = admissionDates.length > 0 ? admissionDates.reduce((max, p) => p > max ? p : max, admissionDates[0]) : null;

  return {
    // Basic metrics
    totalClaims,
    paidClaims,
    approvedClaims,
    rejectedClaims,
    pendingClaims,
    
    // KPIs
    firstPassRate,
    queryIncidence,
    denialRate,
    collectionEfficiency,
    
    // Financial metrics
    totalClaimValue,
    totalApprovedAmount,
    totalPaidAmount,
    revenueLeakage,
    revenueLeakageRate,
    
    // Status breakdown
    rejectedAmount,
    pendingAmount,
    approvedUnpaidAmount,
    revenueStuckInQuery,
    
    // Processing metrics
    avgProcessingTime,
    nonQueryAvgTime,
    queryAvgTime,
    timeImpact,
    queryDistribution,
    
    // Scores
    healthScore,
    reimbursementScore,
    efficiencyScore,
    cashFlowScore,
    
    // Additional hospital performance metrics
    avgLengthOfStay,
    highValueClaimsPercentage,
    
    // Date range for calculations
    minDate,
    maxDate,

    // Legacy compatibility (with validation)
    averageClaimAmount: totalClaims > 0 && isFinite(totalClaimValue) ? Math.max(0, Math.min(totalClaimValue / totalClaims, 10000000)) : 0, // Cap at 1 crore per claim
    cashConversionRate: collectionEfficiency,
    rejectionRate: denialRate,
    queryRate: queryIncidence,
    revenueLoss: revenueLeakage,
    claimsByStatus,
    avgDischargeToPaymentDays,
    avgQueryDelayFromDischargeToPayment,
    queryCausedDelay
  };
};

// Generate data for charts
export const generateChartData = (data) => {
  if (!data || data.length === 0) return {};

  // Check if this is multi-payer data (SDS format)
  let dataToProcess = data;
  let isMultiPayer = false;
  let maaOnlyData = data;
  
  if (data[0] && data[0].payerName && data[0].claimId) {
    console.log('📊 [Charts] Multi-payer data detected for chart generation');
    isMultiPayer = true;
    dataToProcess = convertSDSToMAAFormat(data);
    
    // For MAA-specific charts (districts, gender), filter only MAA data
    maaOnlyData = data.filter(row => row.payerName === 'MAA Yojana');
  }

  // Preprocess and group data by TID
  const processedData = preprocessHospitalData(dataToProcess);
  const groupedData = groupDataByTID(processedData);
  
  // For specialty analysis in multi-payer mode, exclude payment tracker data
  const dataForSpecialty = isMultiPayer ? 
    groupedData.filter(row => row['_payerName'] !== 'RGHS Payment Tracker') : 
    groupedData;

  // Claims by status for status-wise analysis (grouped by TID)
  const claimsCountByStatus = groupedData.reduce((acc, row) => {
    const status = row['Status'] || 'Unknown';
    // Filter out Success and In Progress statuses (various patterns)
    const statusLower = status.toLowerCase();
    if (statusLower.includes('success') || 
        statusLower.includes('in progress') ||
        statusLower.includes('in process') ||
        statusLower.includes('inprogress') ||
        statusLower.includes('inprocess')) {
      return acc;
    }
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Monthly trends with improved data handling (grouped by TID)
  const monthlyData = groupedData.reduce((acc, row) => {
    const admissionDate = parseDate(row['Date of Admission']);
    if (admissionDate) {
      const monthKey = format(admissionDate, 'MMM yyyy');
      if (!acc[monthKey]) {
        acc[monthKey] = { 
          month: monthKey, 
          claims: 0, 
          amount: 0,
          date: admissionDate 
        };
      }
      acc[monthKey].claims += 1;
      acc[monthKey].amount += parseNumber(row['Approved Amount']);
    }
    return acc;
  }, {});

  let monthlyTrends = Object.values(monthlyData).sort((a, b) => 
    new Date(a.month) - new Date(b.month)
  );

  // Filter out months with very few claims (< 5) if they are first or last months
  // to avoid weird trapezium shapes
  if (monthlyTrends.length > 2) {
    const firstMonth = monthlyTrends[0];
    const lastMonth = monthlyTrends[monthlyTrends.length - 1];
    const avgClaims = monthlyTrends.reduce((sum, m) => sum + m.claims, 0) / monthlyTrends.length;
    
    // Remove first month if it has significantly fewer claims (< 30% of average)
    if (firstMonth.claims < avgClaims * 0.3) {
      monthlyTrends = monthlyTrends.slice(1);
    }
    
    // Remove last month if it has significantly fewer claims (< 30% of average)
    if (monthlyTrends.length > 1) {
      const newLastMonth = monthlyTrends[monthlyTrends.length - 1];
      if (newLastMonth.claims < avgClaims * 0.3) {
        monthlyTrends = monthlyTrends.slice(0, -1);
      }
    }
  }

  // Hospital performance (grouped by TID)
  const hospitalData = groupedData.reduce((acc, row) => {
    const hospital = row['Hospital Name'] || 'Unknown';
    if (!acc[hospital]) {
      acc[hospital] = { hospital, claims: 0, amount: 0 };
    }
    acc[hospital].claims += 1;
    acc[hospital].amount += parseNumber(row['Approved Amount']);
    return acc;
  }, {});

  const topHospitals = Object.values(hospitalData)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Specialty distribution (grouped by TID, excluding payment tracker)
  const specialtyData = dataForSpecialty.reduce((acc, row) => {
    const specialty = row['Pkg Speciality Name'] || 'Unknown';
    if (!acc[specialty]) {
      acc[specialty] = { specialty, claims: 0, amount: 0 };
    }
    acc[specialty].claims += 1;
    acc[specialty].amount += parseNumber(row['Approved Amount']);
    return acc;
  }, {});

  const topSpecialties = Object.values(specialtyData)
    .filter(item => item.specialty !== 'Unknown')
    .sort((a, b) => b.claims - a.claims)
    .slice(0, 8);

  // Age group distribution (grouped by TID)
  const ageGroups = {
    '0-18': 0, '19-35': 0, '36-50': 0, '51-65': 0, '65+': 0, 'Unknown': 0
  };

  groupedData.forEach(row => {
    const age = parseNumber(row['Age']);
    if (age === 0) {
      ageGroups['Unknown']++;
    } else if (age <= 18) {
      ageGroups['0-18']++;
    } else if (age <= 35) {
      ageGroups['19-35']++;
    } else if (age <= 50) {
      ageGroups['36-50']++;
    } else if (age <= 65) {
      ageGroups['51-65']++;
    } else {
      ageGroups['65+']++;
    }
  });

  const ageDistribution = Object.entries(ageGroups).map(([group, count]) => ({
    ageGroup: group,
    count,
    percentage: (count / groupedData.length * 100).toFixed(1)
  }));

  // Gender distribution (grouped by TID) - MAA Yojana only for multi-payer
  let genderDistribution = [];
  let topDistricts = [];
  
  if (isMultiPayer && maaOnlyData.length > 0) {
    // Process MAA-only data for gender and district
    const maaFormatData = convertSDSToMAAFormat(maaOnlyData);
    const maaProcessedData = preprocessHospitalData(maaFormatData);
    const maaGroupedData = groupDataByTID(maaProcessedData);
    
    const genderData = maaGroupedData.reduce((acc, row) => {
      const gender = row['Gender'] || 'Unknown';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {});

    genderDistribution = Object.entries(genderData)
      .filter(([gender]) => gender !== 'Unknown')
      .map(([gender, count]) => ({
        gender,
        count,
        percentage: (count / maaGroupedData.length * 100).toFixed(1)
      }));

    const districtData = maaGroupedData.reduce((acc, row) => {
      const district = row['District Name'] || 'Unknown';
      acc[district] = (acc[district] || 0) + 1;
      return acc;
    }, {});

    topDistricts = Object.entries(districtData)
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } else {
    // Regular processing for single-payer mode
    const genderData = groupedData.reduce((acc, row) => {
      const gender = row['Gender'] || 'Unknown';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {});

    genderDistribution = Object.entries(genderData)
      .filter(([gender]) => gender !== 'Unknown')
      .map(([gender, count]) => ({
        gender,
        count,
        percentage: (count / groupedData.length * 100).toFixed(1)
      }));

    const districtData = groupedData.reduce((acc, row) => {
      const district = row['District Name'] || 'Unknown';
      acc[district] = (acc[district] || 0) + 1;
      return acc;
    }, {});

    topDistricts = Object.entries(districtData)
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Status-wise money stuck analysis (grouped by TID)
  const statusWiseRevenue = Object.entries(claimsCountByStatus).map(([status, count]) => {
    const statusAmount = groupedData
      .filter(row => row['Status'] === status)
      .reduce((sum, row) => sum + parseNumber(row['Pkg Rate']), 0);
    
    return {
      status,
      count,
      amount: statusAmount,
      isStuck: !status.toLowerCase().includes('paid') && !status.toLowerCase().includes('reject')
    };
  }).sort((a, b) => b.count - a.count); // Sort by count for better visibility

  // Query distribution (grouped by TID)
  const queryData = groupedData.reduce((acc, row) => {
    const queryCount = parseInt(row['Query Raised']) || 0;
    const key = queryCount === 0 ? 'Clean' : `${queryCount} ${queryCount === 1 ? 'Query' : 'Queries'}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const queryDistribution = Object.entries(queryData)
    .map(([queries, count]) => ({ queries, count }))
    .sort((a, b) => {
      // Sort by query count: Clean first, then 1 Query, 2 Queries, etc.
      if (a.queries === 'Clean') return -1;
      if (b.queries === 'Clean') return 1;
      const aNum = parseInt(a.queries);
      const bNum = parseInt(b.queries);
      return aNum - bNum;
    });

  // Normalize monthly trends data
  const normalizedMonthlyTrends = monthlyTrends.map(item => ({
    ...item,
    normalizedClaims: Math.round((item.claims / Math.max(...monthlyTrends.map(t => t.claims))) * 100),
    normalizedAmount: Math.round((item.amount / Math.max(...monthlyTrends.map(t => t.amount))) * 100)
  }));

  return {
    monthlyTrends: normalizedMonthlyTrends,
    topHospitals,
    topSpecialties,
    ageDistribution,
    genderDistribution,
    topDistricts,
    statusWiseRevenue,
    queryDistribution
  };
};

// Filter data based on criteria (works on raw data, not processed)
export const filterData = (data, filters, scheme = 'maa') => {
  if (!data || !data.length) return [];

  // Check if this is multi-payer SDS format data
  const isSDSFormat = data[0] && data[0].payerName && data[0].claimId;

  const columnMap = {
    maa: {
      date: 'Date of Admission',
      status: 'Status',
      hospital: 'Hospital Name',
      specialty: 'Pkg Speciality Name',
      dateParser: parseDate,
    },
    rghs: {
      date: 'DATEOFADMISSION',
      status: 'STATUS',
      hospital: 'HOSPITALNAME',
      specialty: 'DEPARTMENT',
      dateParser: parseRGHSDate,
    },
    multi_payer: {
      date: 'serviceDate',
      status: 'status',
      hospital: 'hospitalName',
      specialty: 'specialty',
      dateParser: (dateStr) => {
        // Try parsing with different formats based on the data
        try {
          return parseDate(dateStr);
        } catch (e) {
          try {
            return parseRGHSDate(dateStr);
          } catch (e2) {
            return null;
          }
        }
      },
    }
  };

  // Determine which column mapping to use
  let cols;
  if (isSDSFormat || scheme === 'multi_payer') {
    cols = columnMap.multi_payer;
  } else {
    cols = columnMap[scheme];
  }

  return data.filter(row => {
    // Date range filter
    if (filters.dateRange) {
      const admissionDate = cols.dateParser(row[cols.date]);
      if (!admissionDate) return false; // Exclude if no valid date for a date filter
      if (filters.dateRange.startDate && admissionDate < filters.dateRange.startDate) return false;
      if (filters.dateRange.endDate && admissionDate > filters.dateRange.endDate) return false;
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(row[cols.status])) return false;
    }

    // Hospital filter
    if (filters.hospital && filters.hospital.length > 0) {
      if (!filters.hospital.includes(row[cols.hospital])) return false;
    }

    // Specialty filter
    if (filters.specialty && filters.specialty.length > 0) {
      if (!filters.specialty.includes(row[cols.specialty])) return false;
    }

    return true;
  });
};

// Generate RCM opportunity insights
export const generateRCMInsights = (stats, hospitalPerformance) => {
  const insights = [];
  
  // Revenue leakage insights
  if (stats.revenueLeakage > 20) {
    insights.push({
      type: 'critical',
      category: 'Revenue Leakage',
      title: 'Critical Revenue Loss Detected',
      description: `${stats.revenueLeakage.toFixed(1)}% revenue leakage (₹${(stats.revenueLoss / 100000).toFixed(1)}L lost)`,
      recommendation: 'Implement automated claim submission and follow-up processes',
      impact: 'High',
      savings: stats.revenueLoss * 0.7
    });
  }
  
  // Rejection rate insights
  if (stats.rejectionRate > 15) {
    insights.push({
      type: 'warning',
      category: 'Claim Rejections',
      title: 'High Claim Rejection Rate',
      description: `${stats.rejectionRate.toFixed(1)}% of claims are being rejected`,
      recommendation: 'Deploy prior authorization and eligibility verification systems',
      impact: 'High',
      savings: stats.deniedClaimsRevenue * 0.6
    });
  }
  
  // Query management insights
  if (stats.queryRate > 10) {
    insights.push({
      type: 'warning',
      category: 'Query Management',
      title: 'Excessive Query Rates',
      description: `${stats.queryRate.toFixed(1)}% claims require additional documentation`,
      recommendation: 'Implement clinical documentation improvement (CDI) programs',
      impact: 'Medium',
      savings: stats.pendingRevenue * 0.15
    });
  }
  
  // Cash flow insights
  if (stats.cashConversionRate < 80) {
    insights.push({
      type: 'warning',
      category: 'Cash Flow',
      title: 'Poor Cash Conversion',
      description: `Only ${stats.cashConversionRate.toFixed(1)}% of approved amounts are being collected`,
      recommendation: 'Enhance payment posting and reconciliation processes',
      impact: 'High',
      savings: (stats.totalApprovedAmount - stats.totalPaidAmount) * 0.5
    });
  }
  
  // Hospital-specific insights
  const worstHospitals = hospitalPerformance.slice(0, 3);
  worstHospitals.forEach(hospital => {
    if (hospital.healthScore < 60) {
      insights.push({
        type: 'critical',
        category: 'Hospital Performance',
        title: `${hospital.hospital} - Critical Performance Issues`,
        description: `Health Score: ${hospital.healthScore.toFixed(1)}/100, Revenue Loss: ₹${(hospital.revenueLoss / 100000).toFixed(1)}L`,
        recommendation: 'Immediate RCM intervention required for this facility',
        impact: 'Critical',
        savings: hospital.revenueLoss * 0.8
      });
    }
  });
  
  return insights.sort((a, b) => {
    const impactOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    return impactOrder[b.impact] - impactOrder[a.impact];
  });
};

// Eyther Value Proposition - ROI Calculations
export const calculateDenialReductionSavings = (currentDenialRate, targetDenialRate, totalClaims, avgClaimValue) => {
  const currentDenials = Math.floor(currentDenialRate * totalClaims);
  const targetDenials = Math.floor(targetDenialRate * totalClaims);
  const claimsSaved = Math.max(0, currentDenials - targetDenials);
  const revenueRecovery = claimsSaved * avgClaimValue;
  return { revenueRecovery, claimsSaved };
};

export const calculateFirstPassImprovementSavings = (currentFirstPass, targetFirstPass, totalClaims, avgClaimValue) => {
  const currentCleanClaims = Math.floor(currentFirstPass * totalClaims);
  const targetCleanClaims = Math.floor(targetFirstPass * totalClaims);
  const additionalCleanClaims = Math.max(0, targetCleanClaims - currentCleanClaims);
  
  // Working capital savings (reduced processing time)
  const avgDaysSaved = 9; // Based on analysis: 20 days (with query) - 11 days (without query)
  const workingCapitalRate = 0.12 / 365; // 12% annual rate
  const workingCapitalSavings = additionalCleanClaims * avgClaimValue * avgDaysSaved * workingCapitalRate;
  
  return { workingCapitalSavings, additionalCleanClaims };
};

// Calculate hospital tier for realistic cost parameters
export const getHospitalTier = (stats) => {
  if (!stats || !stats.totalClaims) return 'small';
  
  const annualClaims = stats.totalClaims * 2; // Estimate annual from 6-month data
  
  if (annualClaims <= 25000) return 'small';        // Small hospital
  if (annualClaims <= 75000) return 'medium';       // Medium hospital  
  if (annualClaims <= 150000) return 'large';       // Large hospital
  return 'chain';                                    // Hospital chain
};

// Calculate human resource costs for claims processing
export const calculateHumanResourceCosts = (stats) => {
  if (!stats || !isFinite(stats.totalClaims) || stats.totalClaims <= 0) {
    return {
      currentPreprocessingCost: 0,
      currentReworkCost: 0,
      totalCurrentHRCost: 0,
      futurePreprocessingCost: 0,
      futureReworkCost: 0,
      totalFutureHRCost: 0,
      hrSavings: 0,
      hoursSaved: 0
    };
  }

  const tier = getHospitalTier(stats);
  
  // Hospital tier-based parameters (₹/hour)
  const staffRates = {
    small: 500,   // Smaller hospitals, lower cost structure
    medium: 650,  // Medium hospitals
    large: 750,   // Large hospitals, higher skilled staff
    chain: 800    // Hospital chains, premium staff
  };
  
  const staffHourlyRate = staffRates[tier];
  
  // Time parameters (hours per claim)
  const preprocessingHours = {
    small: 1.5,   // More manual process
    medium: 1.2,  // Some automation
    large: 1.0,   // Better systems
    chain: 0.8    // Advanced systems
  };
  
  const reworkHours = {
    denied: 4,    // Significant rework for denied claims
    queried: 2    // Moderate rework for queried claims
  };
  
  const currentPreprocessingHoursPerClaim = preprocessingHours[tier];
  
  // Current state calculations
  const totalClaims = stats.totalClaims;
  const deniedClaims = Math.round((stats.denialRate / 100) * totalClaims);
  const queriedClaims = Math.round((stats.queryIncidence / 100) * totalClaims);
  
  // Current costs
  const currentPreprocessingCost = totalClaims * currentPreprocessingHoursPerClaim * staffHourlyRate;
  const currentReworkCost = (deniedClaims * reworkHours.denied + queriedClaims * reworkHours.queried) * staffHourlyRate;
  const totalCurrentHRCost = currentPreprocessingCost + currentReworkCost;
  
  // Future state with Eyther (reduced by 60-70% due to AI assistance)
  const aiEfficiencyFactor = 0.35; // 65% reduction in manual work
  const futurePreprocessingCost = currentPreprocessingCost * aiEfficiencyFactor;
  
  // Assume significant improvement in quality, reducing rework by 80%
  const futureReworkCost = currentReworkCost * 0.2;
  const totalFutureHRCost = futurePreprocessingCost + futureReworkCost;
  
  // Net savings
  const hrSavings = totalCurrentHRCost - totalFutureHRCost;
  const hoursSaved = hrSavings / staffHourlyRate;
  
  return {
    currentPreprocessingCost,
    currentReworkCost, 
    totalCurrentHRCost,
    futurePreprocessingCost,
    futureReworkCost,
    totalFutureHRCost,
    hrSavings,
    hoursSaved,
    staffHourlyRate,
    tier
  };
};

// Calculate additional costs for claim pre-processors and doctors
export const calculateAdditionalCosts = (stats, claimsPerDay) => {
  if (!stats || !stats.totalClaims || stats.denialRate >= 5 || stats.firstPassRate <= 60) {
    return {
      totalCost: 0,
      claimExperts: 0,
      doctors: 0,
      expertCost: 0,
      doctorCost: 0,
      breakdown: null
    };
  }

  // Calculate daily claims based on the actual date range in the data
  const daysInRange = (stats.maxDate - stats.minDate) / (1000 * 60 * 60 * 24);
  const actualDailyClaims = daysInRange > 0 ? Math.round(stats.totalClaims / daysInRange) : 0;
  const processedDailyClaims = actualDailyClaims * 4; // Use multiplied value for cost calculation

  // Calculate required staff based on processing capacity
  const claimExperts = Math.ceil(processedDailyClaims / claimsPerDay);
  const doctors = Math.ceil(claimExperts / 10); // 1 doctor per 10 experts

  // Monthly costs
  const expertMonthlyCost = claimExperts * 15000; // Updated to 15k
  const doctorMonthlyCost = doctors * 40000;
  const totalMonthlyCost = expertMonthlyCost + doctorMonthlyCost;

  // Annual costs
  const expertAnnualCost = expertMonthlyCost * 12;
  const doctorAnnualCost = doctorMonthlyCost * 12;
  const totalAnnualCost = totalMonthlyCost * 12;

  return {
    totalCost: totalAnnualCost,
    claimExperts,
    doctors,
    expertCost: expertAnnualCost,
    doctorCost: doctorAnnualCost,
    breakdown: {
      dailyClaims: actualDailyClaims, // Return the actual daily claims for display
      claimsPerDay,
      expertMonthlyCost,
      doctorMonthlyCost,
      totalMonthlyCost,
      expertAnnualCost,
      doctorAnnualCost,
      totalAnnualCost
    }
  };
};

export const calculateTotalSavings = (denialScenario, firstPassScenario, stats, claimsPerDay) => {
  // --- DIAGNOSTIC LOGS START ---
  console.log('[DIAGNOSTIC] Calculating Total Savings');
  if (!stats) {
    console.error('[DIAGNOSTIC] Stats object is missing!');
    return {};
  }
  console.log(`[DIAGNOSTIC] Denial Rate: ${stats.denialRate}, First Pass Rate: ${stats.firstPassRate}`);
  console.log(`[DIAGNOSTIC] Avg Claim Amount: ${stats.averageClaimAmount}, Total Claims: ${stats.totalClaims}`);
  // --- DIAGNOSTIC LOGS END ---

  // Validate inputs
  if (!stats || !isFinite(stats.averageClaimAmount) || !isFinite(stats.totalClaims) || stats.totalClaims <= 0) {
    return {
      denialRecovery: 0,
      workingCapitalSavings: 0,
      additionalCosts: 0,
      totalSavings: 0,
      claimsSaved: 0,
      additionalCleanClaims: 0,
      additionalCostsBreakdown: null
    };
  }

  const avgClaimValue = Math.min(stats.averageClaimAmount, 5000000); // Cap at 50L per claim for realistic calculations
  const totalClaims = stats.totalClaims;
  
  // Denial reduction scenarios
  const denialScenarios = {
    'Conservative': 0.05, // 5% denial rate
    'Moderate': 0.03,     // 3% denial rate  
    'Aggressive': 0.02    // 2% denial rate
  };
  
  // First-pass improvement scenarios
  const firstPassScenarios = {
    'Moderate': 0.60,     // 60% first-pass
    'Good': 0.70,         // 70% first-pass
    'Excellent': 0.80     // 80% first-pass
  };

  const denialSavings = calculateDenialReductionSavings(
    stats.denialRate / 100,
    denialScenarios[denialScenario] || 0.03,
    totalClaims,
    avgClaimValue
  );

  const firstPassSavings = stats.firstPassRate ? calculateFirstPassImprovementSavings(
    stats.firstPassRate / 100,
    firstPassScenarios[firstPassScenario] || 0.70,
    totalClaims,
    avgClaimValue
  ) : { workingCapitalSavings: 0, additionalCleanClaims: 0 };

  const staffingSavingsData = calculateAdditionalCosts(stats, claimsPerDay);
  const staffingSavings = staffingSavingsData.totalCost;

  const totalSavings = denialSavings.revenueRecovery + firstPassSavings.workingCapitalSavings + staffingSavings;

  return {
    denialRecovery: denialSavings.revenueRecovery,
    workingCapitalSavings: firstPassSavings.workingCapitalSavings,
    additionalCosts: staffingSavings,
    totalSavings,
    claimsSaved: denialSavings.claimsSaved,
    additionalCleanClaims: firstPassSavings.additionalCleanClaims,
    additionalCostsBreakdown: staffingSavingsData
  };
};

export const calculateROIWithEyther = (totalSavings, stats, feePercentage = 0.02) => {
  // Validate inputs
  if (!stats || !isFinite(totalSavings) || !isFinite(stats.totalApprovedAmount) || totalSavings <= 0) {
    return {
      eytherFee: 0,
      netSavings: 0,
      roiMultiple: 0,
      paybackWeeks: 0,
      monthlySavings: 0
    };
  }

  const totalApprovedRevenue = Math.max(0, stats.totalApprovedAmount);
  const eytherFee = Math.max(0, totalApprovedRevenue * Math.max(0, Math.min(feePercentage, 0.1))); // Cap fee percentage at 10%
  const netSavings = Math.max(0, totalSavings - eytherFee);
  const roiMultiple = eytherFee > 0 && isFinite(totalSavings / eytherFee) ? Math.min(totalSavings / eytherFee, 1000) : 0; // Cap ROI at 1000x
  const paybackWeeks = totalSavings > 0 && isFinite(eytherFee / (totalSavings / 52)) ? Math.min(eytherFee / (totalSavings / 52), 520) : 0; // Cap at 10 years
  
  return {
    eytherFee,
    netSavings,
    roiMultiple,
    paybackWeeks,
    monthlySavings: totalSavings / 12
  };
};

export const generateScaleProjections = (stats, annualClaims) => {
  const scaleFactors = {
    'Small Hospital (≤25k claims)': 25000,
    'Medium Hospital (25k-75k claims)': 50000,
    'Large Hospital (75k-150k claims)': 100000,
    'Hospital Chain (>150k claims)': 200000
  };
  
  const currentClaimsAnnual = stats.totalClaims * 2; // 6 months to annual estimate
  const scalingFactor = annualClaims / currentClaimsAnnual;
  
  const scenarios = ['Conservative', 'Moderate', 'Aggressive'];
  const scaledMetrics = {};
  
  scenarios.forEach(scenario => {
    const baseSavings = calculateTotalSavings(scenario, 'Good', stats);
    const scaledSavings = baseSavings.totalSavings * scalingFactor;
    const roiData = calculateROIWithEyther(scaledSavings, {
      ...stats,
      totalApprovedAmount: stats.totalApprovedAmount * scalingFactor
    });
    
    scaledMetrics[scenario] = {
      annualSavings: scaledSavings,
      monthlySavings: scaledSavings / 12,
      roiMultiple: roiData.roiMultiple,
      paybackWeeks: roiData.paybackWeeks
    };
  });
  
  return scaledMetrics;
};

// Export data to CSV
export const exportToCSV = (data, filename = 'exported_data.csv') => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};