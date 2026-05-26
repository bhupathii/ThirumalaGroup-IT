import { format } from 'date-fns';

export interface PrintOptions {
  title?: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'A4' | 'Letter' | 'Legal';
  margins?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  includeHeader?: boolean;
  includeFooter?: boolean;
  headerText?: string;
  footerText?: string;
  openingBalance?: number;
  closingBalance?: number;
  companyBalances?: Array<{companyName: string, openingBalance: number, closingBalance: number}>;
  isPrintMode?: boolean;
}

export const printTable = (
  data: any[],
  columns: { key: string; label: string; width?: string }[],
  options: PrintOptions = {}
) => {
  const {
    title = 'Report',
    subtitle = '',
    orientation = 'portrait',
    paperSize = 'A4',
    margins = { top: '1in', right: '0.5in', bottom: '1in', left: '0.5in' },
    includeHeader = true,
    includeFooter = true,
    headerText = 'Thirumala Group Business Management System',
    footerText = `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
  } = options;

  // Create print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  // Generate CSS
  const css = `
    @media print {
      @page {
        size: ${paperSize} ${orientation};
        margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
      }
    }
    
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    
    .print-header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    .print-title {
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin: 0;
    }
    
    .print-subtitle {
      font-size: 16px;
      color: #666;
      margin: 5px 0 0 0;
    }
    
    .print-header-text {
      font-size: 14px;
      color: #333;
      margin: 10px 0 0 0;
    }
    
    .print-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .print-table th {
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      font-size: 11px;
    }
    
    .print-table td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      font-size: 10px;
    }
    
    .print-table tr:nth-child(even) {
      background-color: #f9fafb;
    }
    
    .print-footer {
      text-align: center;
      border-top: 1px solid #333;
      padding-top: 10px;
      margin-top: 20px;
      font-size: 10px;
      color: #666;
    }
    
    .print-summary {
      margin: 0 auto 0 0;
      padding: 15px;
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      width: fit-content;
      max-width: 100%;
      margin-left: auto !important;
      margin-right: 0 !important;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    
    .print-summary h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #333;
    }
    
    .print-summary-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 11px;
    }
    
    .print-summary-label {
      font-weight: bold;
      color: #555;
    }
    
    .print-summary-value {
      color: #333;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .text-bold {
      font-weight: bold;
    }
    
    .text-green {
      color: #059669;
    }
    
    .text-red {
      color: #dc2626;
    }
    
    .text-orange {
      color: #ea580c;
    }
  `;
  const tableRows = data
    .map(row => {
      const cells = columns
        .map(col => {
          const value = row[col.key];
          let displayValue = value;

          // Format numbers
          if (typeof value === 'number') {
            if (
              col.key.toLowerCase().includes('amount') ||
              col.key.toLowerCase().includes('credit') ||
              col.key.toLowerCase().includes('debit') ||
              col.key.toLowerCase().includes('balance')
            ) {
              displayValue = `${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            } else {
              displayValue = value.toLocaleString('en-IN');
            }
          }

          // Format dates
          if (col.key.toLowerCase().includes('date') && value) {
            try {
              displayValue = format(new Date(value), 'dd/MM/yyyy');
            } catch (e) {
              displayValue = value;
            }
          }

          return `<td>${displayValue || ''}</td>`;
        })
        .join('');

      return `<tr>${cells}</tr>`;
    })
    .join('');

  const tableHeaders = columns
    .map(col => `<th style="width: ${col.width || 'auto'}">${col.label}</th>`)
    .join('');

  // Generate summary if data has totals
  let summaryHTML = '';
  if (data.length > 0) {
    const numericColumns = columns.filter(
      col =>
        col.key.toLowerCase().includes('amount') ||
        col.key.toLowerCase().includes('credit') ||
        col.key.toLowerCase().includes('debit') ||
        col.key.toLowerCase().includes('balance')
    );

    if (numericColumns.length > 0) {
      const totals = numericColumns.map(col => {
        const total = data.reduce((sum, row) => {
          const value = parseFloat(row[col.key]) || 0;
          return sum + value;
        }, 0);
        return { label: col.label, total };
      });

      summaryHTML = `
        <div class="print-summary">
          <h3>Summary</h3>
          ${totals
            .map(
              item => `
            <div class="print-summary-row">
              <span class="print-summary-label">Total ${item.label}:</span>
              <span class="print-summary-value">${item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          `
            )
            .join('')}
          <div class="print-summary-row">
            <span class="print-summary-label">Total Records:</span>
            <span class="print-summary-value">${data.length}</span>
          </div>
        </div>
      `;
    }
  }

  // Complete HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>${css}</style>
    </head>
    <body>
      ${
        includeHeader
          ? `
        <div class="print-header">
          <h1 class="print-title">${title}</h1>
          ${subtitle ? `<p class="print-subtitle">${subtitle}</p>` : ''}
          <p class="print-header-text">${headerText}</p>
        </div>
      `
          : ''
      }
      
      ${summaryHTML}
      
      <table class="print-table">
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      ${
        includeFooter
          ? `
        <div class="print-footer">
          <p>${footerText}</p>
        </div>
      `
          : ''
      }
    </body>
    </html>
  `;

  // Write to print window
  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
};

// Specialized print functions for different report types
export const printCashBook = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'date', label: 'Date', width: '100px' },
    { key: 'companyName', label: 'Company', width: '150px' },
    { key: 'accountName', label: 'Account', width: '150px' },
    { key: 'subAccount', label: 'Sub Account', width: '150px' },
    { key: 'particulars', label: 'Particulars', width: '200px' },
    { key: 'credit', label: 'Credit', width: '100px' },
    { key: 'debit', label: 'Debit', width: '100px' },
    { key: 'staff', label: 'Staff', width: '100px' },
    { key: 'approved', label: 'Status', width: '80px' },
  ];

  return printTable(data, columns, {
    title: 'Cash Book Report',
    subtitle: 'Financial Transaction Details',
    ...options,
  });
};

export const printLedger = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'accountName', label: 'Account Name', width: '200px' },
    { key: 'credit', label: 'Credit', width: '120px' },
    { key: 'debit', label: 'Debit', width: '120px' },
    { key: 'balance', label: 'Balance', width: '120px' },
    { key: 'yesNo', label: 'Category', width: '100px' },
  ];

  return printTable(data, columns, {
    title: 'Ledger Report',
    subtitle: 'Account-wise Summary',
    ...options,
  });
};

export const printBalanceSheet = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'accountName', label: 'Account Name', width: '250px' },
    { key: 'credit', label: 'Credit', width: '120px' },
    { key: 'debit', label: 'Debit', width: '120px' },
    { key: 'balance', label: 'Balance', width: '120px' },
    { key: 'yesNo', label: 'P&L', width: '80px' },
    { key: 'result', label: 'Result', width: '100px' },
  ];

  return printTable(data, columns, {
    title: 'Balance Sheet',
    subtitle: 'Financial Position Report',
    ...options,
  });
};

export const printVehicles = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'v_no', label: 'Vehicle No', width: '120px' },
    { key: 'v_type', label: 'Type', width: '150px' },
    { key: 'particulars', label: 'Particulars', width: '200px' },
    { key: 'tax_exp_date', label: 'Tax Expiry', width: '100px' },
    { key: 'insurance_exp_date', label: 'Insurance Expiry', width: '120px' },
    { key: 'fitness_exp_date', label: 'Fitness Expiry', width: '120px' },
    { key: 'permit_exp_date', label: 'Permit Expiry', width: '120px' },
  ];

  return printTable(data, columns, {
    title: 'Vehicle Management Report',
    subtitle: 'Fleet and Document Status',
    ...options,
  });
};

export const printBankGuarantees = (
  data: any[],
  options: PrintOptions = {}
) => {
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'bg_no', label: 'BG No', width: '150px' },
    { key: 'issue_date', label: 'Issue Date', width: '100px' },
    { key: 'exp_date', label: 'Expiry Date', width: '100px' },
    { key: 'work_name', label: 'Work Name', width: '250px' },
    { key: 'credit', label: 'Credit', width: '100px' },
    { key: 'debit', label: 'Debit', width: '100px' },
    { key: 'department', label: 'Department', width: '150px' },
  ];

  return printTable(data, columns, {
    title: 'Bank Guarantees Report',
    subtitle: 'BG Tracking and Management',
    ...options,
  });
};

export const printDrivers = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'driver_name', label: 'Driver Name', width: '200px' },
    { key: 'license_no', label: 'License No', width: '150px' },
    { key: 'exp_date', label: 'License Expiry', width: '120px' },
    { key: 'phone', label: 'Phone', width: '120px' },
    { key: 'address', label: 'Address', width: '250px' },
    { key: 'particulars', label: 'Particulars', width: '200px' },
  ];

  return printTable(data, columns, {
    title: 'Drivers Report',
    subtitle: 'Driver Information and License Status',
    ...options,
  });
};

// Specialized print function for Daily Reports with enhanced Thirumala Group branding
export const printDailyReport = (data: any[], options: PrintOptions = {}) => {
  const {
    title = 'Daily Report',
    subtitle = '',
    orientation = 'portrait',
    paperSize = 'A4',
    margins = { top: '0.3in', right: '0.5in', bottom: '1in', left: '0.5in' },
    includeHeader = true,
    includeFooter = true,
    headerText = 'Thirumala Group - Daily Transaction Report',
    footerText = `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    openingBalance = 0,
    closingBalance = 0,
    companyBalances = [],
    isPrintMode = false,
  } = options;

  // Create print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  // Basic CSS for Daily Report with simple Thirumala Group branding
  const css = `
    @media print {
      @page {
        size: ${paperSize} ${orientation};
        margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
      }
    }
    
    body {
      font-family: 'Arial', sans-serif;
      font-size: 14px;
      line-height: 1.4;
      margin: 0;
      padding: 20px;
      font-weight: bold;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      background-color: #f5f5f5;
    }
    
    .print-container {
      max-width: 100%;
      width: 100%;
      margin: 0 auto;
      background-color: white;
      padding: 20px;
      border: 2px solid #333;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      overflow: visible;
      box-sizing: border-box;
    }
    
    .print-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #333;
      padding-bottom: 2px;
      margin-bottom: 4px;
      margin-top: 0;
      padding-top: 0;
    }
    
    .header-left {
      flex: 1;
    }
    
    .header-center {
      flex: 1;
      text-align: center;
    }
    
    .header-right {
      flex: 1;
      text-align: right;
    }
    
    .company-name {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .company-subtitle {
      font-size: 12px;
      font-weight: bold;
      color: #666;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .print-title {
      font-size: 22px;
      font-weight: bold;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .print-subtitle {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .print-header-text {
      font-size: 12px;
      font-weight: bold;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .print-table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      table-layout: auto;
      word-wrap: break-word;
    }
    
    .print-table tfoot {
      display: table-row-group;
    }
    
    .print-table tfoot tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .print-table th {
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 6px 4px;
      text-align: left;
      font-weight: bold;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .print-table td {
      border: 1px solid #d1d5db;
      padding: 4px;
      font-size: 11px;
      font-weight: bold;
      overflow: hidden;
      text-overflow: ellipsis;
      word-wrap: break-word;
    }
    
    .print-table tr:nth-child(even) {
      background-color: #f9fafb;
    }
    
    .print-footer {
      text-align: center;
      border-top: 1px solid #333;
      padding-top: 10px;
      margin-top: 20px;
      font-size: 12px;
      font-weight: bold;
      color: #666;
    }
    
    .print-summary {
      margin: 0 auto 0 0;
      padding: 0;
      background: transparent;
      border: none;
      width: fit-content;
      max-width: 100%;
      margin-left: auto !important;
      margin-right: 0 !important;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    
    .print-summary h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      font-weight: bold;
      color: #333;
    }
    
    .print-summary-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      margin: 2px 0;
      font-size: 13px;
      font-weight: bold;
      width: 100%;
      column-gap: 16px;
    }

    /* Boxed tables for summaries */
    .boxed-table {
      width: auto;
      max-width: 620px;
      border-collapse: collapse;
      margin: 0;
      font-size: 13px;
      font-weight: bold;
      margin-left: auto !important;
      margin-right: 0 !important;
      display: table;
    }
    .boxed-table th {
      background-color: #f3f4f6;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #d1d5db;
      font-weight: bold;
      font-size: 13px;
    }
    .boxed-table td {
      padding: 4px 6px;
      border: 1px solid #d1d5db;
      font-weight: bold;
      font-size: 13px;
    }
    
    /* Summary table for Total, Opening Balance, Closing Balance, Grand Total */
    .summary-balance-table {
      width: 100%;
      max-width: 620px;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 13px;
      font-weight: bold;
    }
    .summary-balance-table th,
    .summary-balance-table td {
      padding: 6px 8px;
      font-weight: bold;
      font-size: 13px;
      border: 1px solid #000;
      font-weight: bold;
    }
    .summary-balance-table th {
      background-color: #f3f4f6;
      font-weight: bold;
    }
    .summary-balance-table th:first-child {
      text-align: left;
    }
    .summary-balance-table th:not(:first-child) {
      text-align: right;
    }
    .summary-balance-table td:first-child {
      text-align: left;
      font-weight: bold;
    }
    .summary-balance-table td:not(:first-child) {
      text-align: right;
      font-weight: bold;
    }
    
    @media print {
      .print-table th,
      .print-table td {
        border: 1px solid #000 !important;
      }
      .boxed-table th,
      .boxed-table td {
        border: 1px solid #000 !important;
      }
      .summary-balance-table th,
      .summary-balance-table td {
        border: 1px solid #000 !important;
      }
    }
    .balance-row {
      display: flex;
      gap: 20px;
    }
    .balance-item {
      flex: 1;
    }
    
    .print-summary-label {
      font-weight: 600;
      color: #222;
    }
    
    .print-summary-value {
      color: #333;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .text-bold {
      font-weight: bold;
    }
    
    .text-green {
      color: #059669;
    }
    
    .text-red {
      color: #dc2626;
    }
    
    .text-orange {
      color: #ea580c;
    }
    
    .print-button {
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
      background: #007bff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    }
    
    .print-button:hover {
      background: #0056b3;
    }
    
    @media print {
      @page {
        size: A4 portrait;
        margin: 0.3in 0.5in 0.5in 0.5in;
      }
      body {
        background-color: white;
        padding: 0;
        margin: 0;
        display: block;
        width: 100%;
        max-width: 100%;
        overflow: hidden;
      }
      .print-container {
        max-width: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        border: none;
        box-shadow: none;
        page-break-inside: avoid;
      }
      .print-table {
        width: 100% !important;
        max-width: 100% !important;
        font-size: 10px;
        page-break-inside: auto;
        table-layout: auto;
        word-wrap: break-word;
        border-collapse: collapse !important;
      }
      .print-table th,
      .print-table td {
        padding: 3px 2px;
        font-size: 10px;
        border: 1px solid #000 !important;
        word-wrap: break-word;
        box-sizing: border-box;
      }
      .print-table tfoot {
        display: table-row-group !important;
        width: 100% !important;
      }
      .print-table tfoot tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        display: table-row !important;
        width: 100% !important;
      }
      .print-table tfoot td {
        white-space: nowrap;
        box-sizing: border-box;
      }
      .print-button {
        display: none;
      }
      .print-summary,
      .boxed-table {
        max-width: 100%;
        width: auto;
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  `;

  // Generate table HTML - Adjusted widths to fit A4 page
  const columns = [
    { key: 'sno', label: 'S.No', width: '5%' },
    { key: 'date', label: 'Date', width: '8%' },
    { key: 'companyName', label: 'Company', width: '15%' },
    { key: 'accountName', label: 'Account', width: '12%' },
    { key: 'subAccount', label: 'Sub Account', width: '12%' },
    { key: 'particulars', label: 'Particulars', width: '18%' },
    { key: 'credit', label: 'Credit', width: '10%' },
    { key: 'debit', label: 'Debit', width: '10%' },
    { key: 'staff', label: 'Staff', width: '10%' },
  ];

  const formatCurrency = (value: number) =>
    value.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const buildTotalsSummaryTable = (
    totals: {
      totalCredit: number;
      totalDebit: number;
      openingBalanceValue: number;
      closingBalanceValue: number;
      grandTotalCredit: number;
      grandTotalDebit: number;
    },
    borderColor = '#000'
  ) => `
    <table class="summary-balance-table" style="border-color: ${borderColor};">
      <thead>
        <tr>
          <th style="border: 1px solid ${borderColor};">Description</th>
          <th style="border: 1px solid ${borderColor};">Credit</th>
          <th style="border: 1px solid ${borderColor};">Debit</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border: 1px solid ${borderColor};">Total</td>
          <td style="border: 1px solid ${borderColor};">${formatCurrency(totals.totalCredit)}</td>
          <td style="border: 1px solid ${borderColor};">${formatCurrency(totals.totalDebit)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid ${borderColor};">Opening Balance</td>
          <td style="border: 1px solid ${borderColor};">${formatCurrency(totals.openingBalanceValue)}</td>
          <td style="border: 1px solid ${borderColor};"></td>
        </tr>
        <tr>
          <td style="border: 1px solid ${borderColor};">Closing Balance</td>
          <td style="border: 1px solid ${borderColor};"></td>
          <td style="border: 1px solid ${borderColor};">${formatCurrency(totals.closingBalanceValue)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid ${borderColor};">Grand Total</td>
          <td style="border: 1px solid ${borderColor};">${formatCurrency(totals.grandTotalCredit)}</td>
          <td style="border: 1px solid ${borderColor};">${formatCurrency(totals.grandTotalDebit)}</td>
        </tr>
      </tbody>
    </table>
  `;

  // Remove Date and Staff columns when not provided in data (or explicitly excluded)
  const filteredColumns = columns.filter(col => {
    if (col.key === 'date' || col.key === 'staff') return false;
    if (!data || data.length === 0) return true;
    return Object.prototype.hasOwnProperty.call(data[0], col.key);
  });

  const tableRows = data
    .map((row, index) => {
      const cells = filteredColumns
        .map(col => {
          let value = row[col.key];
          
          // Fix S.No to start from 1
          if (col.key === 'sno') {
            value = index + 1;
          }
          
          let displayValue = value;

          // Format numbers
          if (typeof value === 'number') {
            if (
              col.key.toLowerCase().includes('amount') ||
              col.key.toLowerCase().includes('credit') ||
              col.key.toLowerCase().includes('debit') ||
              col.key.toLowerCase().includes('balance')
            ) {
              displayValue = `${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            } else {
              displayValue = value.toLocaleString('en-IN');
            }
          }

          // Format dates
          if (col.key.toLowerCase().includes('date') && value) {
            try {
              displayValue = format(new Date(value), 'dd/MM/yyyy');
            } catch (e) {
              displayValue = value;
            }
          }

          return `<td style="font-weight: bold; border: 1px solid #d1d5db; padding: 4px 3px;">${displayValue || ''}</td>`;
        })
        .join('');

      return `<tr>${cells}</tr>`;
    })
    .join('');

  const tableHeaders = filteredColumns
    .map(col => `<th style="width: ${col.width || 'auto'}; font-weight: bold; font-size: 11px; padding: 4px 3px;">${col.label}</th>`)
    .join('');

  // Calculate totals for the table footer
  const creditTotal = data.length > 0 ? data.reduce((sum, row) => {
    const creditValue = row.credit;
    if (creditValue === null || creditValue === undefined || creditValue === '') return sum;
    const numValue = typeof creditValue === 'number' ? creditValue : parseFloat(String(creditValue).replace(/,/g, ''));
    return sum + (isNaN(numValue) ? 0 : numValue);
  }, 0) : 0;
  const debitTotal = data.length > 0 ? data.reduce((sum, row) => {
    const debitValue = row.debit;
    if (debitValue === null || debitValue === undefined || debitValue === '') return sum;
    const numValue = typeof debitValue === 'number' ? debitValue : parseFloat(String(debitValue).replace(/,/g, ''));
    return sum + (isNaN(numValue) ? 0 : numValue);
  }, 0) : 0;
  const balance = creditTotal - debitTotal;

  // Generate summary table - removed per user request
  let summaryHTML = '';
  // Check if subtitle indicates "All Companies"
  const isAllCompanies = !subtitle || subtitle.toLowerCase().includes('all companies') || subtitle === '';

  // Company-wise closing balance for the filtered data
  let companySummaryHTML = '';
  
  // Generate company summary HTML for both preview and print modes when companyBalances are provided
  if (companyBalances && companyBalances.length > 0) {
    companySummaryHTML = `
      <div class="print-summary" style="margin-left: auto; margin-right: 0; width: fit-content; text-align: right;">
        <table class="boxed-table" style="margin-left: auto; margin-right: 0;">
          <thead>
            <tr><th colspan="3">Company-wise Opening and Closing Balances</th></tr>
            <tr>
              <th>Company</th>
              <th>Opening Balance</th>
              <th>Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            ${companyBalances.map(company => {
              const openingValue = Math.abs(company.openingBalance);
              const closingValue = Math.abs(company.closingBalance);
              const isOpeningDR = company.openingBalance < 0;
              const isClosingDR = company.closingBalance < 0;
              const openingText = `${isOpeningDR ? '-' : ''}${openingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${isOpeningDR ? 'DR' : 'CR'}`;
              const closingText = `${isClosingDR ? '-' : ''}${closingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${isClosingDR ? 'DR' : 'CR'}`;
              return `
                <tr>
                  <td><strong>${company.companyName}</strong></td>
                  <td class="${isOpeningDR ? 'text-red' : 'text-green'}">${openingText}</td>
                  <td class="${isClosingDR ? 'text-red' : 'text-green'}">${closingText}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Render subtitle with bold company name when present
  const subtitleHTML = subtitle
    ? (subtitle.startsWith('Company:')
        ? `Company: <span class="text-bold">${subtitle.replace('Company:', '').trim()}</span>`
        : `<span class="text-bold">${subtitle}</span>`)
    : '';

  // Generate print mode HTML function (to be called when print button is clicked)
  const generatePrintModeHTMLString = () => {
    const creditTotal = data.length > 0 ? data.reduce((sum, row) => {
      const creditValue = row.credit;
      if (creditValue === null || creditValue === undefined || creditValue === '') return sum;
      const numValue = typeof creditValue === 'number' ? creditValue : parseFloat(String(creditValue).replace(/,/g, ''));
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0) : 0;
    const debitTotal = data.length > 0 ? data.reduce((sum, row) => {
      const debitValue = row.debit;
      if (debitValue === null || debitValue === undefined || debitValue === '') return sum;
      const numValue = typeof debitValue === 'number' ? debitValue : parseFloat(String(debitValue).replace(/,/g, ''));
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0) : 0;
    
    // Generate company summary HTML for print mode (kept empty to hide in printed output per user request)
    let printCompanySummaryHTML = '';
    
    const printModeTableRows = data
      .map((row, index) => {
        const cells = filteredColumns
          .map(col => {
            let value = row[col.key];
            
            // Fix S.No to start from 1
            if (col.key === 'sno') {
              value = index + 1;
            }
            
            let displayValue = value;

            if (typeof value === 'number') {
              if (
                col.key.toLowerCase().includes('amount') ||
                col.key.toLowerCase().includes('credit') ||
                col.key.toLowerCase().includes('debit') ||
                col.key.toLowerCase().includes('balance')
              ) {
                displayValue = `${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
              } else {
                displayValue = value.toLocaleString('en-IN');
              }
            }

            if (col.key.toLowerCase().includes('date') && value) {
              try {
                displayValue = format(new Date(value), 'dd/MM/yyyy');
              } catch (e) {
                displayValue = value;
              }
            }

            return `<td style="font-weight: bold; border: 1px solid #000; padding: 4px 3px;">${displayValue || ''}</td>`;
          })
          .join('');

        return `<tr>${cells}</tr>`;
      })
      .join('');

    // Calculate grand totals
    const grandTotalCredit = creditTotal + openingBalance;
    const grandTotalDebit = debitTotal + closingBalance;
    
    // Format opening and closing balances (without CR/DR for grand total calculation)
    const openingBalanceValue = Math.abs(openingBalance);
    const closingBalanceValue = Math.abs(closingBalance);

    const totalsSummaryTable = buildTotalsSummaryTable(
      {
        totalCredit: creditTotal,
        totalDebit: debitTotal,
        openingBalanceValue,
        closingBalanceValue,
        grandTotalCredit,
        grandTotalDebit,
      },
      '#000'
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Thirumala Group</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="print-container">
          ${includeHeader ? `
            <div class="print-header">
              <div class="header-left">
                <h2 class="print-title">${title}</h2>
              </div>
              <div class="header-center">
                <h1 class="company-name">Thirumala Group</h1>
                <p class="company-subtitle">Business Management System</p>
              </div>
              <div class="header-right">
                ${subtitleHTML ? `<p class="print-subtitle">${subtitleHTML}</p>` : ''}
              </div>
            </div>
          ` : ''}
          
          <table class="print-table" style="width: 100%; max-width: 100%; border-collapse: collapse; table-layout: auto;">
            <thead>
              <tr>${tableHeaders}</tr>
            </thead>
            <tbody>
              ${printModeTableRows}
            </tbody>
          </table>

          <div class="print-summary">
            ${totalsSummaryTable}
          </div>
          
          <div style="text-align: right; width: 100%;">
            ${printCompanySummaryHTML}
          </div>
          
          ${includeFooter ? `
            <div class="print-footer">
              <p>${footerText}</p>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  };

  // Generate print mode HTML and escape it properly for embedding in script
  const printModeHTML = generatePrintModeHTMLString();
  // Escape for embedding in JavaScript string - replace backticks, template expressions, and newlines
  const printModeHTMLString = printModeHTML
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/`/g, '\\`')    // Escape backticks
    .replace(/\${/g, '\\${') // Escape template expressions
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '')      // Remove carriage returns
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/"/g, '\\"');   // Escape double quotes

  // Complete HTML with basic Thirumala Group branding
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Thirumala Group</title>
      <style>${css}</style>
      <script>
        function handlePrint() {
          try {
            const printModeHTML = \`${printModeHTMLString}\`;
            const actualPrintWindow = window.open('', '_blank');
            if (actualPrintWindow) {
              actualPrintWindow.document.write(printModeHTML);
              actualPrintWindow.document.close();
              setTimeout(() => {
                actualPrintWindow.print();
                setTimeout(() => {
                  actualPrintWindow.close();
                }, 100);
              }, 250);
            } else {
              alert('Please allow popups for this site to print.');
            }
          } catch (error) {
            console.error('Print error:', error);
            alert('Print failed: ' + error.message);
          }
        }
      </script>
    </head>
    <body>
      <button class="print-button" onclick="handlePrint()">Print</button>
      
      <div class="print-container">
        ${includeHeader ? `
          <div class="print-header">
            <div class="header-left">
              <h2 class="print-title">${title}</h2>
            </div>
            <div class="header-center">
              <h1 class="company-name">Thirumala Group</h1>
              <p class="company-subtitle">Business Management System</p>
            </div>
            <div class="header-right">
              ${subtitleHTML ? `<p class="print-subtitle">${subtitleHTML}</p>` : ''}
            </div>
          </div>
        ` : ''}
        
        <table class="print-table" style="width: 100%; max-width: 100%; border-collapse: collapse; table-layout: auto;">
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        ${!isPrintMode && data.length > 0 ? (() => {
            // Calculate totals for preview mode
            const previewCreditTotal = data.reduce((sum, row) => {
              const creditValue = row.credit;
              if (creditValue === null || creditValue === undefined || creditValue === '') return sum;
              const numValue = typeof creditValue === 'number' ? creditValue : parseFloat(String(creditValue).replace(/,/g, ''));
              return sum + (isNaN(numValue) ? 0 : numValue);
            }, 0);
            const previewDebitTotal = data.reduce((sum, row) => {
              const debitValue = row.debit;
              if (debitValue === null || debitValue === undefined || debitValue === '') return sum;
              const numValue = typeof debitValue === 'number' ? debitValue : parseFloat(String(debitValue).replace(/,/g, ''));
              return sum + (isNaN(numValue) ? 0 : numValue);
            }, 0);
            
            // Calculate overall opening and closing balances
            let previewOpeningBalance = Math.abs(openingBalance);
            let previewClosingBalance = Math.abs(closingBalance);
            
            if (isAllCompanies && companyBalances && companyBalances.length > 0) {
              previewOpeningBalance = companyBalances.reduce((sum, company) => sum + Math.abs(company.openingBalance), 0);
              previewClosingBalance = companyBalances.reduce((sum, company) => sum + Math.abs(company.closingBalance), 0);
            }
            
            const previewGrandTotalCredit = previewCreditTotal + previewOpeningBalance;
            const previewGrandTotalDebit = previewDebitTotal + previewClosingBalance;
            
            const previewSummaryTable = buildTotalsSummaryTable(
              {
                totalCredit: previewCreditTotal,
                totalDebit: previewDebitTotal,
                openingBalanceValue: previewOpeningBalance,
                closingBalanceValue: previewClosingBalance,
                grandTotalCredit: previewGrandTotalCredit,
                grandTotalDebit: previewGrandTotalDebit,
              },
              '#d1d5db'
            );

            return `
            <div class="print-summary">
              ${previewSummaryTable}
            </div>
            `;
          })() : ''}
        
        
        ${summaryHTML}
        <div style="text-align: right; width: 100%;">
          ${companySummaryHTML}
        </div>
        
        ${includeFooter ? `
          <div class="print-footer">
            <p>${footerText}</p>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;

  // Write to print window
  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load then focus (don't auto-print)
  printWindow.onload = () => {
    printWindow.focus();
  };
};