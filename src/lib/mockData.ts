// Mock data for frontend-only version
export interface User {
  id: string;
  username: string;
  email: string;
  user_type: string;
  is_active: boolean;
}

export interface Company {
  id: string;
  company_name: string;
  address: string;
}

export interface Account {
  id: string;
  company_name: string;
  acc_name: string;
}

export interface SubAccount {
  id: string;
  company_name: string;
  acc_name: string;
  sub_acc: string;
}

export interface CashBookEntry {
  id: string;
  sno: number;
  acc_name: string;
  sub_acc_name: string;
  particulars: string;
  c_date: string;
  credit: number;
  debit: number;
  lock_record: boolean;
  company_name: string;
  address: string;
  staff: string;
  users: string;
  entry_time: string;
  sale_qty: number;
  purchase_qty: number;
  approved: boolean;
  edited: boolean;
  e_count: number;
  cb: string;
}

export interface Vehicle {
  id: string;
  sno: number;
  v_no: string;
  v_type: string;
  particulars: string;
  tax_exp_date: string;
  insurance_exp_date: string;
  fitness_exp_date: string;
  permit_exp_date: string;
  date_added: string;
}

export interface BankGuarantee {
  id: string;
  sno: number;
  bg_no: string;
  issue_date: string;
  exp_date: string;
  work_name: string;
  credit: number;
  debit: number;
  department: string;
  cancelled: boolean;
}

export interface Driver {
  id: string;
  sno: number;
  driver_name: string;
  license_no: string;
  exp_date: string;
  particulars: string;
  phone: string;
  address: string;
}

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@thirumala.com',
    user_type: 'Admin',
    is_active: true,
  },
  {
    id: '2',
    username: 'operator',
    email: 'operator@thirumala.com',
    user_type: 'Operator',
    is_active: true,
  },
  {
    id: '3',
    username: 'manager',
    email: 'manager@thirumala.com',
    user_type: 'Admin',
    is_active: true,
  },
  {
    id: '4',
    username: 'rajesh.kumar',
    email: 'rajesh@thirumala.com',
    user_type: 'Operator',
    is_active: true,
  },
  {
    id: '5',
    username: 'priya.sharma',
    email: 'priya@thirumala.com',
    user_type: 'Operator',
    is_active: true,
  },
];

// Mock Companies
export const mockCompanies: Company[] = [
  {
    id: '1',
    company_name: 'Thirumala Cotton Mills',
    address: 'Plot No. 45, Industrial Estate, Coimbatore - 641021, Tamil Nadu',
  },
  {
    id: '2',
    company_name: 'Thirumala Exports Pvt Ltd',
    address: 'Export House, Port Area, Chennai - 600001, Tamil Nadu',
  },
  {
    id: '3',
    company_name: 'Thirumala Trading Corporation',
    address: 'Market Complex, Gandhi Road, Erode - 638001, Tamil Nadu',
  },
  {
    id: '4',
    company_name: 'Thirumala Textiles',
    address: 'Textile Park, Tirupur - 641604, Tamil Nadu',
  },
];

// Mock Accounts
export const mockAccounts: Account[] = [
  {
    id: '1',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Cotton Sales Account',
  },
  {
    id: '2',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Raw Material Purchase',
  },
  {
    id: '3',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Manufacturing Expenses',
  },
  {
    id: '4',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Cash & Bank Account',
  },
  {
    id: '5',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Machinery & Equipment',
  },
  {
    id: '6',
    company_name: 'Thirumala Exports Pvt Ltd',
    acc_name: 'Export Sales Revenue',
  },
  {
    id: '7',
    company_name: 'Thirumala Exports Pvt Ltd',
    acc_name: 'Shipping & Logistics',
  },
  {
    id: '8',
    company_name: 'Thirumala Trading Corporation',
    acc_name: 'Trading Income',
  },
  {
    id: '9',
    company_name: 'Thirumala Trading Corporation',
    acc_name: 'Commission & Brokerage',
  },
  { id: '10', company_name: 'Thirumala Textiles', acc_name: 'Fabric Sales' },
];

// Mock Sub Accounts
export const mockSubAccounts: SubAccount[] = [
  {
    id: '1',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Cotton Sales Account',
    sub_acc: 'Local Market Sales',
  },
  {
    id: '2',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Cotton Sales Account',
    sub_acc: 'Interstate Sales',
  },
  {
    id: '3',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Cotton Sales Account',
    sub_acc: 'Wholesale Distribution',
  },
  {
    id: '4',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Raw Material Purchase',
    sub_acc: 'Cotton Procurement',
  },
  {
    id: '5',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Raw Material Purchase',
    sub_acc: 'Chemical & Dyes',
  },
  {
    id: '6',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Manufacturing Expenses',
    sub_acc: 'Labor Charges',
  },
  {
    id: '7',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Manufacturing Expenses',
    sub_acc: 'Power & Electricity',
  },
  {
    id: '8',
    company_name: 'Thirumala Cotton Mills',
    acc_name: 'Manufacturing Expenses',
    sub_acc: 'Maintenance & Repairs',
  },
  {
    id: '9',
    company_name: 'Thirumala Exports Pvt Ltd',
    acc_name: 'Export Sales Revenue',
    sub_acc: 'USA Market',
  },
  {
    id: '10',
    company_name: 'Thirumala Exports Pvt Ltd',
    acc_name: 'Export Sales Revenue',
    sub_acc: 'European Market',
  },
  {
    id: '11',
    company_name: 'Thirumala Exports Pvt Ltd',
    acc_name: 'Shipping & Logistics',
    sub_acc: 'Sea Freight',
  },
  {
    id: '12',
    company_name: 'Thirumala Trading Corporation',
    acc_name: 'Trading Income',
    sub_acc: 'Commodity Trading',
  },
];

// Mock Cash Book Entries
export const mockCashBookEntries: CashBookEntry[] = [
  {
    id: '1',
    sno: 1,
    acc_name: 'Cotton Sales Account',
    sub_acc_name: 'Local Market Sales',
    particulars:
      'Sale of premium cotton bales to ABC Textiles Ltd - Invoice #TH/2025/001',
    c_date: '2025-01-02',
    credit: 285000,
    debit: 0,
    lock_record: false,
    company_name: 'Thirumala Cotton Mills',
    address: 'Plot No. 45, Industrial Estate, Coimbatore',
    staff: 'admin',
    users: 'admin',
    entry_time: '2025-01-02T10:30:00Z',
    sale_qty: 750,
    purchase_qty: 0,
    approved: true,
    edited: false,
    e_count: 0,
    cb: 'CB/2025/001',
  },
  {
    id: '2',
    sno: 2,
    acc_name: 'Raw Material Purchase',
    sub_acc_name: 'Cotton Procurement',
    particulars:
      'Purchase of raw cotton from farmers cooperative society - Bill #FC/2025/045',
    c_date: '2025-01-02',
    credit: 0,
    debit: 165000,
    lock_record: false,
    company_name: 'Thirumala Cotton Mills',
    address: 'Plot No. 45, Industrial Estate, Coimbatore',
    staff: 'rajesh.kumar',
    users: 'rajesh.kumar',
    entry_time: '2025-01-02T14:15:00Z',
    sale_qty: 0,
    purchase_qty: 450,
    approved: false,
    edited: false,
    e_count: 0,
    cb: 'CB/2025/002',
  },
  {
    id: '3',
    sno: 3,
    acc_name: 'Manufacturing Expenses',
    sub_acc_name: 'Power & Electricity',
    particulars:
      'Monthly electricity bill payment - TNEB Bill #EB/DEC/2024/789',
    c_date: '2025-01-02',
    credit: 0,
    debit: 45000,
    lock_record: false,
    company_name: 'Thirumala Cotton Mills',
    address: 'Plot No. 45, Industrial Estate, Coimbatore',
    staff: 'admin',
    users: 'admin',
    entry_time: '2025-01-02T16:45:00Z',
    sale_qty: 0,
    purchase_qty: 0,
    approved: true,
    edited: false,
    e_count: 0,
    cb: 'CB/2025/003',
  },
  {
    id: '4',
    sno: 4,
    acc_name: 'Export Sales Revenue',
    sub_acc_name: 'USA Market',
    particulars:
      'Export shipment to Global Cotton Inc, USA - LC #LC/USA/2025/012',
    c_date: '2025-01-03',
    credit: 850000,
    debit: 0,
    lock_record: false,
    company_name: 'Thirumala Exports Pvt Ltd',
    address: 'Export House, Port Area, Chennai',
    staff: 'priya.sharma',
    users: 'priya.sharma',
    entry_time: '2025-01-03T09:20:00Z',
    sale_qty: 1200,
    purchase_qty: 0,
    approved: true,
    edited: false,
    e_count: 0,
    cb: 'CB/2025/004',
  },
  {
    id: '5',
    sno: 5,
    acc_name: 'Shipping & Logistics',
    sub_acc_name: 'Sea Freight',
    particulars:
      'Container shipping charges for USA export - Maersk Line Invoice #ML/2025/567',
    c_date: '2025-01-03',
    credit: 0,
    debit: 125000,
    lock_record: false,
    company_name: 'Thirumala Exports Pvt Ltd',
    address: 'Export House, Port Area, Chennai',
    staff: 'manager',
    users: 'manager',
    entry_time: '2025-01-03T11:30:00Z',
    sale_qty: 0,
    purchase_qty: 0,
    approved: false,
    edited: true,
    e_count: 1,
    cb: 'CB/2025/005',
  },
];

// Mock Vehicles
export const mockVehicles: Vehicle[] = [
  {
    id: '1',
    sno: 1,
    v_no: 'TN-38-AB-1234',
    v_type: 'Heavy Truck',
    particulars:
      'Tata Prima 4928.S - Cotton transport vehicle with hydraulic loading system',
    tax_exp_date: '2025-03-15',
    insurance_exp_date: '2025-02-28',
    fitness_exp_date: '2025-04-10',
    permit_exp_date: '2025-05-20',
    date_added: '2024-01-15',
  },
  {
    id: '2',
    sno: 2,
    v_no: 'TN-38-CD-5678',
    v_type: 'Mini Truck',
    particulars: 'Mahindra Bolero Pickup - Local delivery and staff transport',
    tax_exp_date: '2025-06-30',
    insurance_exp_date: '2025-01-15',
    fitness_exp_date: '2025-07-25',
    permit_exp_date: '2025-08-10',
    date_added: '2024-02-20',
  },
  {
    id: '3',
    sno: 3,
    v_no: 'TN-38-EF-9012',
    v_type: 'Trailer',
    particulars: 'Ashok Leyland 3118 IL - Long distance cotton transportation',
    tax_exp_date: '2025-02-10',
    insurance_exp_date: '2025-03-05',
    fitness_exp_date: '2025-01-20',
    permit_exp_date: '2025-04-15',
    date_added: '2024-03-10',
  },
];

// Mock Bank Guarantees
export const mockBankGuarantees: BankGuarantee[] = [
  {
    id: '1',
    sno: 1,
    bg_no: 'BG/SBI/2024/001',
    issue_date: '2024-06-01',
    exp_date: '2025-02-15',
    work_name:
      'Cotton Supply Contract - Reliance Textiles Ltd (Contract Value: 50 Lakhs)',
    credit: 0,
    debit: 500000,
    department: 'Cotton Mills Division',
    cancelled: false,
  },
  {
    id: '2',
    sno: 2,
    bg_no: 'BG/HDFC/2024/002',
    issue_date: '2024-08-15',
    exp_date: '2025-01-30',
    work_name:
      'Export Performance Guarantee - Global Cotton Inc, USA (LC Value: $120,000)',
    credit: 0,
    debit: 1000000,
    department: 'Export Division',
    cancelled: false,
  },
  {
    id: '3',
    sno: 3,
    bg_no: 'BG/ICICI/2024/003',
    issue_date: '2024-09-20',
    exp_date: '2025-03-25',
    work_name: 'Advance Payment Guarantee - Maharashtra Cotton Federation',
    credit: 0,
    debit: 750000,
    department: 'Trading Division',
    cancelled: false,
  },
];

// Mock Drivers
export const mockDrivers: Driver[] = [
  {
    id: '1',
    sno: 1,
    driver_name: 'Rajesh Kumar Patel',
    license_no: 'TN-3820240001234',
    exp_date: '2025-03-20',
    particulars:
      'Heavy Vehicle License - 15 years experience in cotton transportation',
    phone: '+91-9876543210',
    address: 'No. 45, Drivers Colony, Transport Nagar, Coimbatore - 641021',
  },
  {
    id: '2',
    sno: 2,
    driver_name: 'Suresh Babu Murugan',
    license_no: 'TN-3820240005678',
    exp_date: '2025-01-25',
    particulars:
      'Light & Heavy Vehicle License - Specialized in interstate transport',
    phone: '+91-9123456789',
    address: 'Plot 12, Gandhi Street, Peelamedu, Coimbatore - 641004',
  },
  {
    id: '3',
    sno: 3,
    driver_name: 'Venkatesh Reddy',
    license_no: 'TN-3820240009012',
    exp_date: '2025-04-15',
    particulars:
      'Commercial Vehicle License - Expert in long distance cotton delivery',
    phone: '+91-9988776655',
    address: 'Door No. 78, Textile Street, RS Puram, Coimbatore - 641002',
  },
];

// Transaction Types
export const transactionTypes = [
  { value: 'Cotton Sale', label: 'Cotton Sale' },
  { value: 'Raw Material Purchase', label: 'Raw Material Purchase' },
  { value: 'Manufacturing Expense', label: 'Manufacturing Expense' },
  { value: 'Export Revenue', label: 'Export Revenue' },
  { value: 'Shipping Cost', label: 'Shipping Cost' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Salary Payment', label: 'Salary Payment' },
  { value: 'Utility Bills', label: 'Utility Bills' },
  { value: 'Equipment Purchase', label: 'Equipment Purchase' },
  { value: 'Insurance Premium', label: 'Insurance Premium' },
];

// Yes/No/Both Options
export const yesNoOptions = [
  { value: 'YES', label: 'YES' },
  { value: 'NO', label: 'NO' },
  { value: 'BOTH', label: 'BOTH' },
];

// Departments
export const departments = [
  { value: 'Cotton Mills Division', label: 'Cotton Mills Division' },
  { value: 'Export Division', label: 'Export Division' },
  { value: 'Trading Division', label: 'Trading Division' },
  { value: 'Textile Manufacturing', label: 'Textile Manufacturing' },
  { value: 'Quality Control', label: 'Quality Control' },
  { value: 'Finance & Accounts', label: 'Finance & Accounts' },
  { value: 'Human Resources', label: 'Human Resources' },
  { value: 'Logistics & Transport', label: 'Logistics & Transport' },
];

// Vehicle Types
export const vehicleTypes = [
  { value: 'Heavy Truck', label: 'Heavy Truck' },
  { value: 'Mini Truck', label: 'Mini Truck' },
  { value: 'Trailer', label: 'Trailer' },
  { value: 'Container Truck', label: 'Container Truck' },
  { value: 'Pickup Van', label: 'Pickup Van' },
  { value: 'Staff Car', label: 'Staff Car' },
  { value: 'Motorcycle', label: 'Motorcycle' },
];

// Cotton Grades
export const cottonGrades = [
  { value: 'Premium Grade A', label: 'Premium Grade A' },
  { value: 'Grade B+', label: 'Grade B+' },
  { value: 'Grade B', label: 'Grade B' },
  { value: 'Grade C+', label: 'Grade C+' },
  { value: 'Grade C', label: 'Grade C' },
  { value: 'Mixed Grade', label: 'Mixed Grade' },
];

// Payment Methods
export const paymentMethods = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Letter of Credit', label: 'Letter of Credit' },
  { value: 'Demand Draft', label: 'Demand Draft' },
  { value: 'Online Payment', label: 'Online Payment' },
];

// Mock Authentication
export const mockAuth = {
  currentUser: mockUsers[0], // Default to admin
  login: (username: string, password: string) => {
    // Simple mock authentication
    const validCredentials = [
      { username: 'admin', password: 'admin123' },
      { username: 'operator', password: 'op123' },
      { username: 'manager', password: 'manager123' },
      { username: 'rajesh.kumar', password: 'rajesh123' },
      { username: 'priya.sharma', password: 'priya123' },
    ];

    const credential = validCredentials.find(
      cred => cred.username === username && cred.password === password
    );

    if (credential) {
      const user = mockUsers.find(u => u.username === username);
      return { success: true, user };
    }

    return { success: false, error: 'Invalid credentials' };
  },
};
