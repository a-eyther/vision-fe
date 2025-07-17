// Comprehensive audit of all dashboard metrics
export const auditDashboardMetrics = (stats, data) => {
  console.log('🔍 DASHBOARD METRICS AUDIT');
  console.log('========================');
  
  // 1. Basic Metrics
  console.log('\n1. BASIC METRICS:');
  console.log(`   Total Claims: ${stats.totalClaims || 0}`);
  console.log(`   Paid Claims: ${stats.paidClaims || 0}`);
  console.log(`   Approved Claims: ${stats.approvedClaims || 0}`);
  console.log(`   Rejected Claims: ${stats.rejectedClaims || 0}`);
  console.log(`   Pending Claims: ${stats.pendingClaims || 0}`);
  
  // 2. Financial Metrics
  console.log('\n2. FINANCIAL METRICS:');
  console.log(`   Total Claim Value: ₹${(stats.totalClaimValue || 0).toLocaleString()}`);
  console.log(`   Total Approved Amount: ₹${(stats.totalApprovedAmount || 0).toLocaleString()}`);
  console.log(`   Total Paid Amount: ₹${(stats.totalPaidAmount || 0).toLocaleString()}`);
  console.log(`   Revenue Leakage: ₹${(stats.revenueLeakage || 0).toLocaleString()}`);
  console.log(`   Outstanding Amount: ₹${(stats.approvedUnpaidAmount || 0).toLocaleString()}`);
  console.log(`   Revenue Stuck in Query: ₹${(stats.revenueStuckInQuery || 0).toLocaleString()}`);
  
  // 3. KPIs
  console.log('\n3. KEY PERFORMANCE INDICATORS:');
  console.log(`   First Pass Rate: ${stats.firstPassRate !== null && stats.firstPassRate !== undefined ? stats.firstPassRate.toFixed(2) + '%' : 'N/A'}`);
  console.log(`   Query Incidence: ${stats.queryIncidence !== null && stats.queryIncidence !== undefined ? stats.queryIncidence.toFixed(2) + '%' : 'N/A'}`);
  console.log(`   Denial Rate: ${(stats.denialRate || 0).toFixed(2)}%`);
  console.log(`   Collection Efficiency: ${(stats.collectionEfficiency || 0).toFixed(2)}%`);
  console.log(`   Revenue Leakage Rate: ${(stats.revenueLeakageRate || 0).toFixed(2)}%`);
  
  // 4. Processing Metrics
  console.log('\n4. PROCESSING METRICS:');
  console.log(`   Avg Processing Time: ${stats.avgProcessingTime !== null && stats.avgProcessingTime !== undefined ? stats.avgProcessingTime.toFixed(1) + ' days' : 'N/A'}`);
  console.log(`   Non-Query Avg Time: ${stats.nonQueryAvgTime !== null && stats.nonQueryAvgTime !== undefined ? stats.nonQueryAvgTime.toFixed(1) + ' days' : 'N/A'}`);
  console.log(`   Query Avg Time: ${stats.queryAvgTime !== null && stats.queryAvgTime !== undefined ? stats.queryAvgTime.toFixed(1) + ' days' : 'N/A'}`);
  console.log(`   Time Impact: ${stats.timeImpact !== null && stats.timeImpact !== undefined ? stats.timeImpact.toFixed(1) + ' days' : 'N/A'}`);
  
  // 5. Scores
  console.log('\n5. PERFORMANCE SCORES:');
  console.log(`   Health Score: ${(stats.healthScore || 0).toFixed(1)}/100`);
  console.log(`   Reimbursement Score: ${(stats.reimbursementScore || 0).toFixed(1)}/100`);
  console.log(`   Efficiency Score: ${(stats.efficiencyScore || 0).toFixed(1)}/100`);
  console.log(`   Cash Flow Score: ${(stats.cashFlowScore || 0).toFixed(1)}/100`);
  
  // 6. Data Quality Checks
  console.log('\n6. DATA QUALITY CHECKS:');
  const issues = [];
  
  if (stats.totalClaims === 0) {
    issues.push('No claims found in data');
  }
  
  if (stats.totalPaidAmount === 0 && stats.paidClaims > 0) {
    issues.push('Paid claims exist but total paid amount is 0');
  }
  
  if (stats.approvedUnpaidAmount === 0 && stats.approvedClaims > stats.paidClaims) {
    issues.push('Outstanding amount is 0 but there are unpaid approved claims');
  }
  
  if (stats.revenueStuckInQuery === 0 && stats.pendingClaims > 0) {
    issues.push('Revenue stuck in query is 0 but there are pending claims');
  }
  
  if (stats.collectionEfficiency > 100) {
    issues.push('Collection efficiency is over 100%');
  }
  
  if (issues.length > 0) {
    console.log('   ⚠️  Issues found:');
    issues.forEach(issue => console.log(`      - ${issue}`));
  } else {
    console.log('   ✅ No issues found');
  }
  
  // 7. Raw Data Sample
  if (data && data.length > 0) {
    console.log('\n7. RAW DATA SAMPLE:');
    console.log('   First record:', JSON.stringify(data[0], null, 2));
  }
  
  console.log('\n========================');
  return { stats, issues };
};