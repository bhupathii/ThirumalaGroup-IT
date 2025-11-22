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
      margin: 20px 0;
      padding: 15px;
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
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

  // Generate table HTML
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
      font-size: 12px;
      line-height: 1.4;
      margin: 0;
      padding: 0;
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
      font-size: 14px;
      font-weight: bold;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .company-subtitle {
      font-size: 10px;
      color: #666;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .print-title {
      font-size: 16px;
      font-weight: bold;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .print-subtitle {
      font-size: 16px;
      font-weight: bold;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1;
    }
    
    .print-header-text {
      font-size: 10px;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1;
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
      margin: 6px 0 8px 0;
      padding: 0;
      background: transparent;
      border: none;
      width: 100%;
      max-width: 520px; /* keep labels and values close, avoid huge center gap */
    }
    
    .print-summary h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #333;
    }
    
    .print-summary-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      margin: 2px 0;
      font-size: 11px;
      width: 100%;
      column-gap: 16px;
    }

    /* Boxed tables for summaries */
    .boxed-table {
      width: 100%;
      max-width: 620px;
      border-collapse: collapse;
      margin: 4px 0 6px 0;
      font-size: 11px;
    }
    .boxed-table th {
      background-color: #f3f4f6;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #d1d5db;
      font-weight: 600;
    }
    .boxed-table td {
      padding: 4px 6px;
      border: 1px solid #d1d5db;
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
      .print-button {
        display: none;
      }
    }
  `;

  // Generate table HTML
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'date', label: 'Date', width: '100px' },
    { key: 'companyName', label: 'Company', width: '180px' },
    { key: 'accountName', label: 'Account', width: '150px' },
    { key: 'subAccount', label: 'Sub Account', width: '150px' },
    { key: 'particulars', label: 'Particulars', width: '200px' },
    { key: 'credit', label: 'Credit', width: '100px' },
    { key: 'debit', label: 'Debit', width: '100px' },
    { key: 'staff', label: 'Staff', width: '100px' },
  ];

  // Remove Date and Staff columns when not provided in data (or explicitly excluded)
  const filteredColumns = columns.filter(col => {
    if (col.key === 'date' || col.key === 'staff') return false;
    if (!data || data.length === 0) return true;
    return Object.prototype.hasOwnProperty.call(data[0], col.key);
  });

  const tableRows = data
    .map(row => {
      const cells = filteredColumns
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

  const tableHeaders = filteredColumns
    .map(col => `<th style="width: ${col.width || 'auto'}">${col.label}</th>`)
    .join('');

  // Calculate totals for the table footer
  const creditTotal = data.length > 0 ? data.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0) : 0;
  const debitTotal = data.length > 0 ? data.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0) : 0;
  const balance = creditTotal - debitTotal;

  // Generate summary tables - only show in preview mode, not in actual print
  let summaryHTML = '';
  if (data.length > 0 && !isPrintMode) {
    summaryHTML = `
      <div class="print-summary">
        <table class="boxed-table">
          <thead>
            <tr><th colspan="4">Opening and Closing Balance</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Opening Balance</strong></td>
              <td class="${openingBalance >= 0 ? 'text-green' : 'text-red'}"><strong>${Math.abs(openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${openingBalance >= 0 ? 'CR' : 'DR'}</strong></td>
              <td><strong>Closing Balance</strong></td>
              <td class="${closingBalance >= 0 ? 'text-green' : 'text-red'}"><strong>${Math.abs(closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${closingBalance >= 0 ? 'CR' : 'DR'}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="print-summary">
        <table class="boxed-table">
          <thead>
            <tr><th colspan="2">Daily Report Summary</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Credit</td>
              <td class="text-green">${creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Total Debit</td>
              <td class="text-red">${debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td>Net Balance</td>
              <td class="${balance >= 0 ? 'text-green' : 'text-red'}">${Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${balance >= 0 ? 'CR' : 'DR'}</td>
            </tr>
            <tr>
              <td>Total Records</td>
              <td>${data.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  // Company-wise closing balance for the filtered data
  let companySummaryHTML = '';
  // Check if subtitle indicates "All Companies"
  const isAllCompanies = !subtitle || subtitle.toLowerCase().includes('all companies') || subtitle === '';
  
  // In preview mode: Show all companies with opening/closing balances when "All Companies" is selected
  if (!isPrintMode && isAllCompanies && companyBalances && companyBalances.length > 0) {
    companySummaryHTML = `
      <div class="print-summary">
        <table class="boxed-table">
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
              const openingText = `${Math.abs(company.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${company.openingBalance >= 0 ? 'CR' : 'DR'}`;
              const closingText = `${Math.abs(company.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${company.closingBalance >= 0 ? 'CR' : 'DR'}`;
              return `
                <tr>
                  <td><strong>${company.companyName}</strong></td>
                  <td class="${company.openingBalance >= 0 ? 'text-green' : 'text-red'}">${openingText}</td>
                  <td class="${company.closingBalance >= 0 ? 'text-green' : 'text-red'}">${closingText}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (data.length > 0 && !isAllCompanies && !isPrintMode) {
    // Show company-wise closing balance when a specific company is selected (preview only)
    const companyTotals: Record<string, { credit: number; debit: number }> = {};
    data.forEach(row => {
      const name = String(row.companyName || row.company_name || '').trim();
      if (!name) return;
      if (!companyTotals[name]) companyTotals[name] = { credit: 0, debit: 0 };
      companyTotals[name].credit += parseFloat(row.credit) || 0;
      companyTotals[name].debit += parseFloat(row.debit) || 0;
    });

    const rows = Object.entries(companyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([company, totals]) => {
        const closing = totals.credit - totals.debit;
        const closingText = `${Math.abs(closing).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${closing >= 0 ? 'CR' : 'DR'}`;
        return `
          <div class="print-summary-row">
            <span class="print-summary-label">${company}</span>
            <span class="print-summary-value ${closing >= 0 ? 'text-green' : 'text-red'}">${closingText}</span>
          </div>
        `;
      })
      .join('');

    if (rows) {
      companySummaryHTML = `
        <div class="print-summary">
          <table class="boxed-table">
            <thead>
              <tr><th colspan="2">Company-wise Closing Balance</th></tr>
              <tr>
                <th>Company</th>
                <th>Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(companyTotals)
                .sort(([a],[b])=>a.localeCompare(b))
                .map(([company, totals])=>{
                  const closing = totals.credit - totals.debit;
                  const closingText = `${Math.abs(closing).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${closing >= 0 ? 'CR' : 'DR'}`;
                  return `<tr><td><strong>${company}</strong></td><td class="${closing>=0?'text-green':'text-red'}">${closingText}</td></tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // Render subtitle with bold company name when present
  const subtitleHTML = subtitle
    ? (subtitle.startsWith('Company:')
        ? `Company: <span class="text-bold">${subtitle.replace('Company:', '').trim()}</span>`
        : `<span class="text-bold">${subtitle}</span>`)
    : '';

  // Generate print mode HTML function (to be called when print button is clicked)
  const generatePrintModeHTML = () => {
    const creditTotal = data.length > 0 ? data.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0) : 0;
    const debitTotal = data.length > 0 ? data.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0) : 0;
    
    const printModeTableRows = data
      .map(row => {
        const cells = filteredColumns
          .map(col => {
            const value = row[col.key];
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

            return `<td>${displayValue || ''}</td>`;
          })
          .join('');

        return `<tr>${cells}</tr>`;
      })
      .join('');

    // Calculate colspan: number of columns before credit column
    const creditColIndex = filteredColumns.findIndex(col => col.key.toLowerCase().includes('credit'));
    const totalColspan = creditColIndex >= 0 ? creditColIndex : filteredColumns.length - 2;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Thirumala Group</title>
        <style>${css}</style>
      </head>
      <body>
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
        
        <table class="print-table">
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${printModeTableRows}
            <tr style="background-color: #f0f0f0; font-weight: bold;">
              <td colspan="${totalColspan}" style="text-align: right; padding: 6px 8px; border: 1px solid #d1d5db;">TOTAL:</td>
              <td class="text-green" style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold;">${creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-red" style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold;">${debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
        
        ${includeFooter ? `
          <div class="print-footer">
            <p>${footerText}</p>
          </div>
        ` : ''}
      </body>
      </html>
    `;
  };

  // Generate print mode HTML as a string for embedding in script
  const generatePrintModeHTMLString = () => {
    const creditTotal = data.length > 0 ? data.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0) : 0;
    const debitTotal = data.length > 0 ? data.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0) : 0;
    
    const printModeTableRows = data
      .map(row => {
        const cells = filteredColumns
          .map(col => {
            const value = row[col.key];
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

            return '<td>' + (displayValue || '') + '</td>';
          })
          .join('');

        return '<tr>' + cells + '</tr>';
      })
      .join('');

    const creditColIndex = filteredColumns.findIndex(col => col.key.toLowerCase().includes('credit'));
    const totalColspan = creditColIndex >= 0 ? creditColIndex : filteredColumns.length - 2;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Thirumala Group</title>
        <style>${css.replace(/`/g, '\\`').replace(/\${/g, '\\${')}</style>
      </head>
      <body>
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
        
        <table class="print-table">
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${printModeTableRows}
            <tr style="background-color: #f0f0f0; font-weight: bold;">
              <td colspan="${totalColspan}" style="text-align: right; padding: 6px 8px; border: 1px solid #d1d5db;">TOTAL:</td>
              <td class="text-green" style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold;">${creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-red" style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold;">${debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
        
        ${includeFooter ? `
          <div class="print-footer">
            <p>${footerText}</p>
          </div>
        ` : ''}
      </body>
      </html>
    `;
  };

  // Escape the print mode HTML for embedding in script tag using JSON.stringify
  const printModeHTMLString = JSON.stringify(generatePrintModeHTMLString());

  // Complete HTML with basic Thirumala Group branding
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Thirumala Group</title>
      <style>${css}</style>
      <script>
        function handlePrint() {
          const printModeHTML = ${printModeHTMLString};
          const actualPrintWindow = window.open('', '_blank');
          if (actualPrintWindow) {
            actualPrintWindow.document.write(printModeHTML);
            actualPrintWindow.document.close();
            setTimeout(() => {
              actualPrintWindow.print();
              actualPrintWindow.close();
            }, 250);
          }
        }
      </script>
    </head>
    <body>
      <button class="print-button" onclick="handlePrint()">Print</button>
      
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
      
      <table class="print-table">
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      ${summaryHTML}
      ${companySummaryHTML}
      
      ${includeFooter ? `
        <div class="print-footer">
          <p>${footerText}</p>
        </div>
      ` : ''}
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