import { useState, useEffect } from 'react';
import { Calculator, TrendingUp, IndianRupee, Clock, Users, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import { calculateTotalSavings, calculateROIWithEyther } from '../../utils/dataProcessor';
import { formatCurrency } from '../../utils/formatters';

const ROICalculator = ({ stats }) => {
  const [selectedDenialScenario, setSelectedDenialScenario] = useState('Moderate');
  const [selectedFirstPassScenario, setSelectedFirstPassScenario] = useState('Good');
  const [eytherFeePercentage, setEytherFeePercentage] = useState(2);
  const [claimsPerDay, setClaimsPerDay] = useState(15);
  const [manualStaffingSavings, setManualStaffingSavings] = useState(null);
  const [isEditingStaffing, setIsEditingStaffing] = useState(false);

  useEffect(() => {
    if (stats) {
      // Reset denial scenario if current selection is not available
      if (stats.denialRate <= 5 && selectedDenialScenario === 'Conservative') {
        setSelectedDenialScenario('Moderate');
      }
      if (stats.denialRate <= 3 && selectedDenialScenario === 'Moderate') {
        setSelectedDenialScenario('Aggressive');
      }

      // Reset first-pass scenario if current selection is not available
      if (stats.firstPassRate >= 60 && selectedFirstPassScenario === 'Moderate') {
        setSelectedFirstPassScenario('Good');
      }
      if (stats.firstPassRate >= 70 && selectedFirstPassScenario === 'Good') {
        setSelectedFirstPassScenario('Excellent');
      }
    }
  }, [stats, selectedDenialScenario, selectedFirstPassScenario]);
  
  const formatSavings = (value) => {
    if (!isFinite(value) || value === 0 || isNaN(value)) return '—';
    return formatCurrency(value, { precision: 2 });
  };

  if (!stats) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-slate-100 rounded-lg mr-3">
            <Calculator className="w-6 h-6 text-[#2a5eb4]" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 font-['Nunito_Sans']">ROI Calculator</h3>
            <p className="text-gray-600 font-['Nunito_Sans']">Upload your claims data to calculate potential savings</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500 font-['Nunito_Sans']">Please upload a CSV file to see ROI calculations</p>
        </div>
      </div>
    );
  }

  // Calculate actual ROI using real data
  const savingsData = calculateTotalSavings(selectedDenialScenario, selectedFirstPassScenario, stats, claimsPerDay);
  
  // Use manual savings if available
  if (manualStaffingSavings !== null) {
    savingsData.totalSavings = savingsData.totalSavings - savingsData.additionalCosts + parseFloat(manualStaffingSavings);
    savingsData.additionalCosts = parseFloat(manualStaffingSavings);
  }

  const roiData = calculateROIWithEyther(savingsData.totalSavings, stats, eytherFeePercentage / 100);
  

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center mb-6">
        <div className="p-2 bg-slate-100 rounded-lg mr-3">
          <Calculator className="w-6 h-6 text-[#2a5eb4]" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-900 font-['Nunito_Sans']">ROI Calculator</h3>
          <p className="text-gray-600 font-['Nunito_Sans']">Calculate potential savings with Eyther's AI-powered solutions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <h4 className="font-semibold text-gray-900 mb-4 font-['Nunito_Sans']">Scenario Configuration</h4>
          
          {/* Denial Rate Scenario - Always show for scenario planning */}
          {(
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-['Nunito_Sans']">
                Target Denial Rate Reduction
              </label>
              <select
                value={selectedDenialScenario}
                onChange={(e) => setSelectedDenialScenario(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5eb4] focus:border-transparent font-['Nunito_Sans']"
              >
                {stats.denialRate > 5 && <option value="Conservative">Conservative (5% denial rate)</option>}
                {stats.denialRate > 3 && <option value="Moderate">Moderate (3% denial rate)</option>}
                <option value="Aggressive">Aggressive (2% denial rate)</option>
              </select>
            </div>
          )}

          {/* First-Pass Rate Scenario - Always show for scenario planning */}
          {(
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-['Nunito_Sans']">
                Target First-Pass Success Rate
              </label>
              <select
                value={selectedFirstPassScenario}
                onChange={(e) => setSelectedFirstPassScenario(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5eb4] focus:border-transparent font-['Nunito_Sans']"
              >
                {stats.firstPassRate < 60 && <option value="Moderate">Moderate (60% first-pass)</option>}
                {stats.firstPassRate < 70 && <option value="Good">Good (70% first-pass)</option>}
                <option value="Excellent">Excellent (80% first-pass)</option>
              </select>
            </div>
          )}

          {/* Eyther Fee Percentage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-['Nunito_Sans']">
              Eyther Fee Percentage ({eytherFeePercentage}%)
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={eytherFeePercentage}
              onChange={(e) => setEytherFeePercentage(parseFloat(e.target.value))}
              className="w-full accent-[#2a5eb4]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1 font-['Nunito_Sans']">
              <span>1%</span>
              <span>5%</span>
            </div>
          </div>
          {(
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-['Nunito_Sans']">
                Claims Processed Per Day ({claimsPerDay})
              </label>
              <input
                type="range"
                min="10"
                max="30"
                step="1"
                value={claimsPerDay}
                onChange={(e) => {
                  setClaimsPerDay(parseInt(e.target.value));
                  setManualStaffingSavings(null);
                }}
                className="w-full accent-[#2a5eb4]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1 font-['Nunito_Sans']">
                <span>10</span>
                <span>30</span>
              </div>
              <p className="text-xs text-blue-600 mt-1 font-['Nunito_Sans']">
                Adjust processing capacity to see impact on staffing costs
              </p>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          <h4 className="font-semibold text-gray-900 mb-4 font-['Nunito_Sans']">Projected Results</h4>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center hover:shadow-md transition-shadow">
              <IndianRupee className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-xl font-bold text-green-600 font-['Nunito_Sans']">
                {formatSavings(savingsData.totalSavings)}
              </div>
              <div className="text-xs text-gray-600 font-['Nunito_Sans']">Annual Savings</div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center hover:shadow-md transition-shadow">
              <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-xl font-bold text-blue-600 font-['Nunito_Sans']">
                {isFinite(roiData.roiMultiple) ? roiData.roiMultiple.toFixed(1) : '—'}x
              </div>
              <div className="text-xs text-gray-600 font-['Nunito_Sans']">ROI Multiple</div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center hover:shadow-md transition-shadow">
              <Clock className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
              <div className="text-xl font-bold text-yellow-600 font-['Nunito_Sans']">
                {isFinite(roiData.paybackWeeks) ? Math.round(roiData.paybackWeeks) : '—'}
              </div>
              <div className="text-xs text-gray-600 font-['Nunito_Sans']">Payback (Weeks)</div>
            </div>

            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg text-center hover:shadow-md transition-shadow">
              <Zap className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <div className="text-xl font-bold text-purple-600 font-['Nunito_Sans']">
                {formatSavings(roiData.monthlySavings)}
              </div>
              <div className="text-xs text-gray-600 font-['Nunito_Sans']">Monthly Benefit</div>
            </div>
          </div>

          {/* Savings Breakdown */}
          <div className="space-y-3">
            <h5 className="font-medium text-gray-900 font-['Nunito_Sans']">Hospital Cost Savings Breakdown</h5>
            <div className="space-y-2 text-sm font-['Nunito_Sans']">
              <div className="flex justify-between">
                <span className="text-gray-600">• Claim Denial Recovery:</span>
                <span className="font-medium">{formatSavings(savingsData.denialRecovery)}</span>
              </div>
              {stats.firstPassRate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">• Faster Cash Flow:</span>
                  <span className="font-medium">{formatSavings(savingsData.workingCapitalSavings)}</span>
                </div>
              )}
              {savingsData.additionalCosts > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">• Hospital Staffing Savings:</span>
                  {isEditingStaffing ? (
                    <input
                      type="number"
                      value={manualStaffingSavings}
                      onChange={(e) => setManualStaffingSavings(e.target.value)}
                      onBlur={() => setIsEditingStaffing(false)}
                      className="w-24 text-right border-b border-gray-400 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium flex items-center">
                      {formatSavings(manualStaffingSavings !== null ? manualStaffingSavings : savingsData.additionalCosts)}
                      <button onClick={() => {
                        setManualStaffingSavings(manualStaffingSavings !== null ? manualStaffingSavings : savingsData.additionalCosts);
                        setIsEditingStaffing(true);
                      }} className="ml-2 text-xs text-blue-500 hover:underline">Edit</button>
                    </span>
                  )}
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total Annual Savings:</span>
                <span className="text-green-600">{formatSavings(savingsData.totalSavings)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Less Eyther Fee:</span>
                <span className="text-red-600">-{formatSavings(roiData.eytherFee)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Net Savings:</span>
                <span className="text-[#2a5eb4]">{formatSavings(roiData.netSavings)}</span>
              </div>
            </div>
          </div>

          {/* Additional Staffing Costs Breakdown */}
          {savingsData.additionalCostsBreakdown && (
            <div key={claimsPerDay} className="space-y-3 mt-6">
              <h5 className="font-medium text-gray-900 font-['Nunito_Sans']">Hospital Staffing Costs Avoided with Eyther</h5>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <div className="text-sm font-['Nunito_Sans'] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-800 font-medium">Daily Claims Volume:</span>
                    <span className="text-yellow-700">{savingsData.additionalCostsBreakdown.breakdown?.dailyClaims || 'N/A'} claims/day</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-800 font-medium">Processing Rate:</span>
                    <span className="text-yellow-700">{savingsData.additionalCostsBreakdown.breakdown?.claimsPerDay || claimsPerDay} claims/person/day</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-800 font-medium">Required Claim Experts:</span>
                    <span className="text-yellow-700">{savingsData.additionalCostsBreakdown.claimExperts || 0} experts</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-800 font-medium">Required Doctors:</span>
                    <span className="text-yellow-700">{savingsData.additionalCostsBreakdown.doctors || 0} doctor(s)</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs font-['Nunito_Sans']">
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div className="text-green-800 font-medium mb-2">Monthly Savings</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Claim Experts:</span>
                      <span>₹{savingsData.additionalCostsBreakdown.breakdown?.expertMonthlyCost?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Doctors:</span>
                      <span>₹{savingsData.additionalCostsBreakdown.breakdown?.doctorMonthlyCost?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>₹{savingsData.additionalCostsBreakdown.breakdown?.totalMonthlyCost?.toLocaleString() || '0'}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <div className="text-blue-800 font-medium mb-2">Annual Savings</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Claim Experts:</span>
                      <span>{formatSavings(savingsData.additionalCostsBreakdown.expertCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Doctors:</span>
                      <span>{formatSavings(savingsData.additionalCostsBreakdown.doctorCost)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>{formatSavings(savingsData.additionalCostsBreakdown.totalCost)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <p className="text-xs text-green-800 font-['Nunito_Sans']">
                  <strong>Note:</strong> With Eyther's AI automation, hospitals can achieve optimal denial rates and first-pass rates without hiring additional claim experts and supervising doctors. These staffing cost savings are calculated based on {claimsPerDay} claims/day processing capacity, with 1 doctor supervising every 10 experts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance Improvements - Only show if there's room for improvement */}
      {(stats.denialRate > 2 || stats.firstPassRate < 80) && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4 font-['Nunito_Sans']">Performance Improvements with Eyther</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Show denial rate improvement if current rate is above target */}
            {stats.denialRate > 2 && (
              <div className="bg-gradient-to-r from-red-50 to-green-50 border border-gray-200 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 font-['Nunito_Sans']">Claim Denial Rate</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-600 mb-1 font-['Nunito_Sans']">
                      {(stats?.denialRate || 8.5).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600 font-['Nunito_Sans']">Current</div>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600 mb-1 font-['Nunito_Sans']">
                      {selectedDenialScenario === 'Conservative' ? '5.0%' : 
                       selectedDenialScenario === 'Moderate' ? '3.0%' : '2.0%'}
                    </div>
                    <div className="text-xs text-gray-600 font-['Nunito_Sans']">Target</div>
                  </div>
                </div>
              </div>
            )}

            {/* Show first-pass improvement if current rate is below target */}
            {stats.firstPassRate < 80 && (
              <div className="bg-gradient-to-r from-yellow-50 to-green-50 border border-gray-200 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 font-['Nunito_Sans']">First-Pass Success Rate</span>
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-xl font-bold text-yellow-600 mb-1 font-['Nunito_Sans']">
                      {(stats?.firstPassRate || 45.2).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600 font-['Nunito_Sans']">Current</div>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600 mb-1 font-['Nunito_Sans']">
                      {selectedFirstPassScenario === 'Moderate' ? '60.0%' : 
                       selectedFirstPassScenario === 'Good' ? '70.0%' : '80.0%'}
                    </div>
                    <div className="text-xs text-gray-600 font-['Nunito_Sans']">Target</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ROICalculator;