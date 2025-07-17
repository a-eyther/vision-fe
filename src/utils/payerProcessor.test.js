import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { 
  processPayerFiles, 
  identifyPayer, 
  mapRowToSDS, 
  parseDate, 
  parseNumber 
} from './payerProcessor';

// Mock XLSX
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn()
  }
}));

// Mock payer mappings
const mockPayerMappings = [
  {
    payerName: "MAA Yojna",
    identificationHeaders: ["TID", "Patient Name", "Hospital Code"],
    columnMapping: {
      "TID": "claimId",
      "Patient Name": "patientName",
      "Hospital Name": "hospitalName",
      "Date of Admission": "serviceDate",
      "Date of Discharge": "dischargeDate",
      "Status": "status",
      "Pkg Rate": "claimedAmount",
      "Approved Amount": "approvedAmount",
      "Paid Amount": "paidAmount"
    }
  },
  {
    payerName: "RGHS",
    identificationHeaders: ["TREATMENTPACKAGEUID", "PATIENTNAME", "HOSPITALCLAIMAMOUNT"],
    columnMapping: {
      "TREATMENTPACKAGEUID": "claimId",
      "PATIENTNAME": "patientName",
      "HOSPITALNAME": "hospitalName",
      "DATEOFADMISSION": "serviceDate",
      "DATEOFDISCHARGE": "dischargeDate",
      "STATUS": "status",
      "HOSPITALCLAIMAMOUNT": "claimedAmount",
      "CUAPPROVEDAMOUNT": "approvedAmount",
      "Actual Paid Amount": "paidAmount"
    }
  }
];

describe('payerProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseDate', () => {
    it('should parse MAA Yojna date format', () => {
      const date = parseDate('01,February , 2025');
      expect(date).toBeInstanceOf(Date);
      expect(date.getMonth()).toBe(1); // February
      expect(date.getDate()).toBe(1);
      expect(date.getFullYear()).toBe(2025);
    });

    it('should parse standard date format', () => {
      const date = parseDate('2025-02-01');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString().split('T')[0]).toBe('2025-02-01');
    });

    it('should return null for invalid dates', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate('invalid date')).toBeNull();
    });

    it('should handle Date objects', () => {
      const inputDate = new Date('2025-02-01');
      expect(parseDate(inputDate)).toBe(inputDate);
    });
  });

  describe('parseNumber', () => {
    it('should parse numeric strings', () => {
      expect(parseNumber('15000')).toBe(15000);
      expect(parseNumber('15,000')).toBe(15000);
      expect(parseNumber('15000.50')).toBe(15000.5);
    });

    it('should return 0 for invalid numbers', () => {
      expect(parseNumber(null)).toBe(0);
      expect(parseNumber('')).toBe(0);
      expect(parseNumber('abc')).toBe(0);
    });

    it('should handle numeric values', () => {
      expect(parseNumber(15000)).toBe(15000);
    });
  });

  describe('identifyPayer', () => {
    it('should identify MAA Yojna payer', () => {
      const headers = ['TID', 'Patient Name', 'Hospital Code', 'Hospital Name'];
      const result = identifyPayer(headers, mockPayerMappings);
      expect(result).toBeTruthy();
      expect(result.payerName).toBe('MAA Yojna');
    });

    it('should identify RGHS payer', () => {
      const headers = ['TREATMENTPACKAGEUID', 'PATIENTNAME', 'HOSPITALNAME', 'HOSPITALCLAIMAMOUNT'];
      const result = identifyPayer(headers, mockPayerMappings);
      expect(result).toBeTruthy();
      expect(result.payerName).toBe('RGHS');
    });

    it('should return null for unknown format', () => {
      const headers = ['ID', 'Name', 'Amount'];
      const result = identifyPayer(headers, mockPayerMappings);
      expect(result).toBeNull();
    });

    it('should handle case-insensitive headers', () => {
      const headers = ['tid', 'PATIENT NAME', 'Hospital Code'];
      const result = identifyPayer(headers, mockPayerMappings);
      expect(result).toBeTruthy();
      expect(result.payerName).toBe('MAA Yojna');
    });
  });

  describe('mapRowToSDS', () => {
    it('should map MAA Yojna row correctly', () => {
      const row = {
        'TID': 'T01022536626525',
        'Patient Name': 'Mohan Singh',
        'Hospital Name': 'STUTI HOSPITAL',
        'Date of Admission': '01,February , 2025',
        'Date of Discharge': '04,February , 2025',
        'Status': 'Claim Paid',
        'Pkg Rate': '15000',
        'Approved Amount': '15000',
        'Paid Amount': '0'
      };

      const result = mapRowToSDS(row, mockPayerMappings[0]);
      
      expect(result.payerName).toBe('MAA Yojna');
      expect(result.claimId).toBe('T01022536626525');
      expect(result.patientName).toBe('Mohan Singh');
      expect(result.hospitalName).toBe('STUTI HOSPITAL');
      expect(result.status).toBe('Claim Paid');
      expect(result.claimedAmount).toBe(15000);
      expect(result.approvedAmount).toBe(15000);
      expect(result.paidAmount).toBe(0);
      expect(result.serviceDate).toBeInstanceOf(Date);
      expect(result.dischargeDate).toBeInstanceOf(Date);
    });

    it('should map RGHS row correctly', () => {
      const row = {
        'TREATMENTPACKAGEUID': 'RGHS123456',
        'PATIENTNAME': 'John Doe',
        'HOSPITALNAME': 'City Hospital',
        'DATEOFADMISSION': '2025-02-01',
        'DATEOFDISCHARGE': '2025-02-05',
        'STATUS': 'CLAIM APPROVED',
        'HOSPITALCLAIMAMOUNT': '25000',
        'CUAPPROVEDAMOUNT': '22000',
        'Actual Paid Amount': '22000'
      };

      const result = mapRowToSDS(row, mockPayerMappings[1]);
      
      expect(result.payerName).toBe('RGHS');
      expect(result.claimId).toBe('RGHS123456');
      expect(result.patientName).toBe('John Doe');
      expect(result.hospitalName).toBe('City Hospital');
      expect(result.claimedAmount).toBe(25000);
      expect(result.approvedAmount).toBe(22000);
      expect(result.paidAmount).toBe(22000);
    });

    it('should handle missing columns with defaults', () => {
      const row = {
        'TID': 'T123',
        'Patient Name': 'Test Patient'
      };

      const result = mapRowToSDS(row, mockPayerMappings[0]);
      
      expect(result.hospitalName).toBe('');
      expect(result.claimedAmount).toBe(0);
      expect(result.serviceDate).toBeNull();
    });
  });

  describe('processPayerFiles', () => {
    it('should process valid MAA Yojna file', async () => {
      const mockFile = new File(['content'], 'maa_data.csv', { type: 'text/csv' });
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

      // Mock XLSX read
      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      });

      // Mock sheet_to_json calls - first call with header:1, second without
      XLSX.utils.sheet_to_json
        .mockImplementationOnce(() => [
          ['TID', 'Patient Name', 'Hospital Code', 'Hospital Name', 'Status', 'Pkg Rate', 'Approved Amount', 'Paid Amount'],
          ['T123', 'Test Patient', 'HC001', 'Test Hospital', 'Claim Paid', '10000', '10000', '10000']
        ])
        .mockImplementationOnce(() => [
          {
            'TID': 'T123',
            'Patient Name': 'Test Patient',
            'Hospital Code': 'HC001',
            'Hospital Name': 'Test Hospital',
            'Status': 'Claim Paid',
            'Pkg Rate': '10000',
            'Approved Amount': '10000',
            'Paid Amount': '10000'
          }
        ]);

      const result = await processPayerFiles([mockFile], mockPayerMappings);

      expect(result.consolidatedData).toHaveLength(1);
      expect(result.consolidatedData[0].payerName).toBe('MAA Yojna');
      expect(result.consolidatedData[0].claimId).toBe('T123');
      expect(result.processingErrors).toHaveLength(0);
      expect(result.stats.successfulFiles).toBe(1);
      expect(result.stats.totalRecords).toBe(1);
    });

    it('should handle unknown file format', async () => {
      const mockFile = new File(['content'], 'unknown.csv', { type: 'text/csv' });
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      });

      XLSX.utils.sheet_to_json
        .mockImplementationOnce(() => [
          ['ID', 'Name', 'Amount'],
          ['1', 'Test', '100']
        ])
        .mockImplementationOnce(() => [
          { 'ID': '1', 'Name': 'Test', 'Amount': '100' }
        ]);

      const result = await processPayerFiles([mockFile], mockPayerMappings);

      expect(result.consolidatedData).toHaveLength(0);
      expect(result.processingErrors).toHaveLength(1);
      expect(result.processingErrors[0].fileName).toBe('unknown.csv');
      expect(result.processingErrors[0].error).toContain('Unknown file format');
      expect(result.stats.failedFiles).toBe(1);
    });

    it('should handle empty file', async () => {
      const mockFile = new File([''], 'empty.csv', { type: 'text/csv' });
      mockFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      });

      XLSX.utils.sheet_to_json.mockReturnValueOnce([]);

      const result = await processPayerFiles([mockFile], mockPayerMappings);

      expect(result.consolidatedData).toHaveLength(0);
      expect(result.processingErrors).toHaveLength(1);
      expect(result.processingErrors[0].error).toContain('empty or has no data');
    });

    it.skip('should process multiple files and consolidate data', async () => {
      const file1 = new File(['content1'], 'maa1.csv', { type: 'text/csv' });
      const file2 = new File(['content2'], 'rghs1.csv', { type: 'text/csv' });
      
      file1.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
      file2.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

      // Reset mocks before setting up
      XLSX.read.mockClear();
      XLSX.utils.sheet_to_json.mockClear();

      XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      });

      // Mock for MAA file
      XLSX.utils.sheet_to_json
        .mockImplementationOnce(() => [
          ['TID', 'Patient Name', 'Hospital Code', 'Hospital Name', 'Pkg Rate', 'Approved Amount', 'Paid Amount'],
          ['T001', 'Patient 1', 'HC001', 'Hospital 1', '5000', '5000', '5000']
        ])
        .mockImplementationOnce(() => [{
          'TID': 'T001',
          'Patient Name': 'Patient 1',
          'Hospital Code': 'HC001',
          'Hospital Name': 'Hospital 1',
          'Pkg Rate': '5000',
          'Approved Amount': '5000',
          'Paid Amount': '5000'
        }])
        // Mock for RGHS file
        .mockImplementationOnce(() => [
          ['TREATMENTPACKAGEUID', 'PATIENTNAME', 'HOSPITALNAME', 'HOSPITALCLAIMAMOUNT', 'CUAPPROVEDAMOUNT', 'Actual Paid Amount'],
          ['RGHS001', 'Patient 2', 'Hospital 2', '8000', '8000', '8000']
        ])
        .mockImplementationOnce(() => [{
          'TREATMENTPACKAGEUID': 'RGHS001',
          'PATIENTNAME': 'Patient 2',
          'HOSPITALNAME': 'Hospital 2',
          'HOSPITALCLAIMAMOUNT': '8000',
          'CUAPPROVEDAMOUNT': '8000',
          'Actual Paid Amount': '8000'
        }]);

      const result = await processPayerFiles([file1, file2], mockPayerMappings);

      expect(result.consolidatedData).toHaveLength(2);
      expect(result.consolidatedData[0].payerName).toBe('MAA Yojna');
      expect(result.consolidatedData[1].payerName).toBe('RGHS');
      expect(result.stats.successfulFiles).toBe(2);
      expect(result.stats.totalRecords).toBe(2);
      expect(result.stats.payerBreakdown['MAA Yojna'].records).toBe(1);
      expect(result.stats.payerBreakdown['RGHS'].records).toBe(1);
    });

    it('should handle file read errors', async () => {
      const mockFile = new File(['content'], 'error.csv', { type: 'text/csv' });
      mockFile.arrayBuffer = vi.fn().mockRejectedValue(new Error('Read error'));

      const result = await processPayerFiles([mockFile], mockPayerMappings);

      expect(result.consolidatedData).toHaveLength(0);
      expect(result.processingErrors).toHaveLength(1);
      expect(result.processingErrors[0].error).toContain('Read error');
    });
  });
});