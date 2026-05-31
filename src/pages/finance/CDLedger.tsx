import React, { useEffect, useState, useMemo } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinanceTransaction, FinanceDue, FinanceDocument } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Printer, 
  Download, 
  RefreshCw, 
  Search, 
  Edit2, 
  Save, 
  X, 
  Upload, 
  FileText, 
  User, 
  Phone, 
  MapPin, 
  File, 
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToExcel, exportToCSV } from '../../utils/excel';

const CDLedger: React.FC = () => {
  const { user } = useAuth();

  // Permission Check
  const hasAccess = useMemo(() => {
    return user?.is_admin || user?.features.includes('cd_ledger');
  }, [user]);

  // UI / State
  const [loading, setLoading] = useState(true);
  const [loansList, setLoansList] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<(FinanceLoan & { customer: FinanceCustomer; transactions: FinanceTransaction[]; photos: any[]; dues: FinanceDue[]; documents: FinanceDocument[] }) | null>(null);
  
  // Selected category state (Defaults to 'CD', but user can choose others)
  const [selectedLedgerType, setSelectedLedgerType] = useState('CD');
  
  // Edit mode details
  const [isEditing, setIsEditing] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  // Edit fields: Customer details
  const [editCustName, setEditCustName] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustPhone2, setEditCustPhone2] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustAadhaar, setEditCustAadhaar] = useState('');
  const [editCustFatherName, setEditCustFatherName] = useState('');
  const [editCustPartnerName, setEditCustPartnerName] = useState('');
  
  // Edit fields: Surety details
  const [editSuretyName, setEditSuretyName] = useState('');
  const [editSuretyPhone, setEditSuretyPhone] = useState('');
  const [editSuretyAadhaar, setEditSuretyAadhaar] = useState('');
  const [editSuretyAddress, setEditSuretyAddress] = useState('');
  const [editSuretyRelation, setEditSuretyRelation] = useState('');
  const [editLoanRemarks, setEditLoanRemarks] = useState('');

  // Upload document fields
  const [docType, setDocType] = useState('Pledge Document');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Print Preview Modal State
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    if (hasAccess) {
      fetchLoans();
    }
  }, [hasAccess]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const allLoans = await supabaseFinance.getLoans();
      setLoansList(allLoans);
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load loans directory');
      setLoading(false);
    }
  };

  // Perform search locally
  const handleSearch = () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const filtered = loansList.filter(loan => {
      const cust = loan.customer;
      // Filter by ledger category or search query
      const matchesQuery = 
        loan.loan_id.toLowerCase().includes(query) ||
        cust?.name.toLowerCase().includes(query) ||
        (cust?.phone && cust.phone.includes(query)) ||
        (cust?.phone2 && cust.phone2.includes(query)) ||
        (cust?.aadhaar && cust.aadhaar.includes(query)) ||
        (cust?.partner_name && cust.partner_name.toLowerCase().includes(query)) ||
        (loan.surety_name && loan.surety_name.toLowerCase().includes(query));

      return matchesQuery;
    });

    setSearchResults(filtered);
  };

  // Trigger search on typing or ledger type changes
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      handleSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadLedgerDetails = async (loanId: string) => {
    setLoading(true);
    try {
      const fullDetails = await supabaseFinance.getLoanById(loanId);
      if (fullDetails) {
        setSelectedLoan(fullDetails);
        
        // Map edit fields
        setEditCustName(fullDetails.customer?.name || '');
        setEditCustPhone(fullDetails.customer?.phone || '');
        setEditCustPhone2(fullDetails.customer?.phone2 || '');
        setEditCustAddress(fullDetails.customer?.address || '');
        setEditCustAadhaar(fullDetails.customer?.aadhaar || '');
        setEditCustFatherName(fullDetails.customer?.father_husband_name || '');
        setEditCustPartnerName(fullDetails.customer?.partner_name || '');

        setEditSuretyName(fullDetails.surety_name || '');
        setEditSuretyPhone(fullDetails.surety_phone || '');
        setEditSuretyAadhaar(fullDetails.surety_aadhaar || '');
        setEditSuretyAddress(fullDetails.surety_address || '');
        setEditSuretyRelation(fullDetails.surety_relation || '');
        setEditLoanRemarks(fullDetails.remarks || '');
        
        setIsEditing(false);
      } else {
        toast.error('Ledger details could not be resolved');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching CD ledger details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchLoans();
    if (selectedLoan) {
      loadLedgerDetails(selectedLoan.id);
    }
  };

  // Toggle edit details mode
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Save/Update Details
  const handleSaveDetails = async () => {
    if (!selectedLoan) return;
    setSavingDetails(true);
    try {
      const staffName = user?.username || 'Staff';
      
      // Update customer details
      const customerPayload: Partial<FinanceCustomer> = {
        name: editCustName,
        phone: editCustPhone || null,
        address: editCustAddress || null,
        aadhaar: editCustAadhaar || null,
        father_husband_name: editCustFatherName || null,
      };

      // Apply optional columns (with safety fallback check)
      try {
        customerPayload.phone2 = editCustPhone2 || null;
        customerPayload.partner_name = editCustPartnerName || null;
      } catch (err) {
        console.warn('phone2 or partner_name could not be updated in payload', err);
      }

      const updatedCust = await supabaseFinance.updateCustomer(
        selectedLoan.customer_id,
        customerPayload,
        staffName
      );

      // Update loan details
      const loanPayload: Partial<FinanceLoan> = {
        surety_name: editSuretyName || null,
        surety_phone: editSuretyPhone || null,
        surety_aadhaar: editSuretyAadhaar || null,
        remarks: editLoanRemarks || null,
      };

      try {
        loanPayload.surety_address = editSuretyAddress || null;
        loanPayload.surety_relation = editSuretyRelation || null;
      } catch (err) {
        console.warn('surety_address or surety_relation could not be updated in payload', err);
      }

      const updatedLoan = await supabaseFinance.updateLoan(
        selectedLoan.id,
        loanPayload,
        staffName
      );

      if (updatedCust && updatedLoan) {
        toast.success('Account details updated successfully!');
        setIsEditing(false);
        loadLedgerDetails(selectedLoan.id);
      } else {
        toast.error('Failed to save details. Verify your database is updated.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving updates. Check database logs.');
    } finally {
      setSavingDetails(false);
    }
  };

  // Upload Document handler
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedLoan) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      // 1. Prepare file payload
      const fileObj = new File([file], `doc-${selectedLoan.loan_id}-${Date.now()}-${file.name}`, { type: file.type });
      
      // 2. Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`documents/${fileObj.name}`, fileObj);

      if (error) throw error;

      // 3. Get Public URL
      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      // 4. Save to finance_documents
      const docResult = await supabaseFinance.addDocument({
        loan_id: selectedLoan.id,
        document_type: docType,
        document_url: publicUrl
      });

      if (docResult) {
        toast.success('Document uploaded and linked successfully!');
        loadLedgerDetails(selectedLoan.id);
      } else {
        toast.error('Failed to link document in database. Please apply migrations.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document file');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      const success = await supabaseFinance.deleteDocument(id);
      if (success) {
        toast.success('Document deleted');
        if (selectedLoan) loadLedgerDetails(selectedLoan.id);
      } else {
        toast.error('Failed to delete document');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting document');
    }
  };

  // Computations for calculations
  const ledgerComputations = useMemo(() => {
    if (!selectedLoan) return null;

    const principal = Number(selectedLoan.amount);
    const interestRate = Number(selectedLoan.interest_rate);
    const duration = Number(selectedLoan.duration_months);

    // Calculate Interest charge and total repayable balance
    const interestAmount = principal * (interestRate / 100) * duration;
    const totalRepayable = principal + interestAmount;

    // Filter collection transactions
    const collections = selectedLoan.transactions.filter(t => t.type === 'Collection');
    const totalCredit = collections.reduce((sum, c) => sum + Number(c.amount), 0);

    // Disbursements transactions
    const disbursements = selectedLoan.transactions.filter(t => t.type === 'Disbursement');
    const totalDebit = disbursements.reduce((sum, d) => sum + Number(d.amount), 0);

    const currentBalance = Math.max(0, totalRepayable - totalCredit);

    // Installment/dues statistics
    const totalDues = selectedLoan.dues.reduce((sum, d) => sum + Number(d.amount), 0);
    const paidDues = selectedLoan.dues.reduce((sum, d) => sum + Number(d.paid_amount || 0), 0);
    const pendingDues = Math.max(0, totalDues - paidDues);

    // Compile transaction list with running balance
    let runningBalance = totalRepayable;
    const processedTransactions = selectedLoan.transactions.map((tx) => {
      let credit = 0;
      let debit = 0;
      if (tx.type === 'Collection') {
        credit = Number(tx.amount);
        runningBalance = Math.max(0, runningBalance - credit);
      } else if (tx.type === 'Disbursement') {
        debit = Number(tx.amount);
      }
      return {
        ...tx,
        credit,
        debit,
        balance: runningBalance
      };
    });

    return {
      principal,
      interestAmount,
      totalRepayable,
      totalCredit,
      totalDebit,
      currentBalance,
      totalDues,
      paidDues,
      pendingDues,
      processedTransactions
    };
  }, [selectedLoan]);

  // Export to Excel / CSV
  const handleExport = (format: 'xlsx' | 'csv') => {
    if (!selectedLoan || !ledgerComputations) {
      toast.error('No ledger data is currently loaded to export');
      return;
    }

    const exportData = ledgerComputations.processedTransactions.map(tx => ({
      Date: tx.date,
      Account: selectedLoan.customer?.name || 'N/A',
      Credit: tx.credit,
      Debit: tx.debit,
      Balance: tx.balance,
      Particulars: tx.remarks || '',
      'Entered By': tx.collected_by || '',
      'Payment Mode': tx.payment_mode || 'Cash'
    }));

    const filename = `${selectedLoan.loan_id}_Ledger_${new Date().toISOString().split('T')[0]}`;

    if (format === 'xlsx') {
      const res = exportToExcel(exportData, filename, 'Transactions');
      if (res.success) toast.success('Excel ledger exported successfully');
    } else {
      const res = exportToCSV(exportData, filename);
      if (res.success) toast.success('CSV ledger exported successfully');
    }
  };

  // Access Denied screen if permissions do not match
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full border border-red-200">
          <ShieldAlert className="w-16 h-16 text-red-600 animate-pulse" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Access Restricted</h1>
        <p className="text-gray-500 max-w-md">
          Only authorized personnel are allowed to view the CD Ledger registry. Please consult your administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      
      {/* Top row: search inputs and action buttons */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm print:hidden">
        
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-1">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Today Date
            </label>
            <input 
              type="text"
              readOnly
              value={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-semibold text-gray-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Ledger Type
            </label>
            <select
              value={selectedLedgerType}
              onChange={(e) => setSelectedLedgerType(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              <option value="CD">CD Ledger (Chit Fund)</option>
              <option value="STBD">STBD Ledger</option>
              <option value="HP">HP Ledger</option>
              <option value="TBD">TBD Ledger</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Search Accounts
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, ID, Phone, Aadhaar..."
                className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              
              {/* Live search results overlay */}
              {searchResults.length > 0 && (
                <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto pr-1">
                  {searchResults.map(loan => (
                    <div
                      key={loan.id}
                      onClick={() => {
                        loadLedgerDetails(loan.id);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="p-3 hover:bg-green-50/50 cursor-pointer flex items-center justify-between border-b last:border-0 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-sm text-gray-900">{loan.customer?.name}</div>
                        <div className="text-xs text-gray-500 font-medium">Phone: {loan.customer?.phone || 'N/A'}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                          {loan.loan_id}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-1">{loan.loan_category} Mode</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex flex-wrap gap-2.5 items-center">
          <Button 
            onClick={handleRefresh} 
            variant="secondary" 
            size="sm" 
            icon={RefreshCw}
            className="rounded-xl border-gray-200"
          >
            Refresh
          </Button>

          <Button
            onClick={() => handleExport('xlsx')}
            variant="secondary"
            size="sm"
            icon={Download}
            disabled={!selectedLoan}
            className="rounded-xl border-gray-200 text-emerald-700 hover:bg-emerald-50"
          >
            Export Excel
          </Button>

          <Button
            onClick={() => setShowPrintPreview(true)}
            variant="primary"
            size="sm"
            icon={Printer}
            disabled={!selectedLoan}
            className="rounded-xl bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm"
          >
            Print
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
          <p className="text-sm font-semibold text-gray-500">Compiling CD ledger registry...</p>
        </div>
      ) : !selectedLoan ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <FileText className="w-16 h-16 mx-auto text-gray-300" />
          <h2 className="text-lg font-bold text-gray-800">No Account Loaded</h2>
          <p className="text-gray-400 text-sm max-w-sm mx-auto">
            Use the search panel above to filter and load customer accounts, view ledger sheets, guarantor cards, and print statements.
          </p>
        </div>
      ) : (
        <>
          {/* Main workspace area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: details cards */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card 1: Customer Details */}
              <Card 
                title="Customer Profile Details" 
                subtitle="Primary borrower card information"
                className="shadow-sm border-gray-100 rounded-3xl"
                headerActions={
                  <Button 
                    onClick={isEditing ? handleSaveDetails : handleToggleEdit} 
                    variant={isEditing ? "success" : "secondary"}
                    size="xs"
                    icon={isEditing ? Save : Edit2}
                    disabled={savingDetails}
                  >
                    {isEditing ? 'Save Changes' : 'Edit Borrower'}
                  </Button>
                }
              >
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Borrower Name" value={editCustName} onChange={setEditCustName} />
                    <Input label="Father/Husband Name" value={editCustFatherName} onChange={setEditCustFatherName} />
                    <Input label="Phone Number 1" value={editCustPhone} onChange={setEditCustPhone} />
                    <Input label="Phone Number 2" value={editCustPhone2} onChange={setEditCustPhone2} />
                    <Input label="Aadhaar Card No" value={editCustAadhaar} onChange={setEditCustAadhaar} />
                    <Input label="Partner Name" value={editCustPartnerName} onChange={setEditCustPartnerName} />
                    <div className="sm:col-span-2">
                      <Input label="Borrower Residential Address" value={editCustAddress} onChange={setEditCustAddress} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Customer Name</div>
                        <div className="font-bold text-gray-900">{selectedLoan.customer?.name}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Father/Husband Name</div>
                        <div className="font-bold text-gray-900">{selectedLoan.customer?.father_husband_name || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Primary Phone</div>
                        <div className="font-bold text-gray-900">{selectedLoan.customer?.phone || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Secondary Phone</div>
                        <div className="font-bold text-gray-900">{selectedLoan.customer?.phone2 || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Aadhaar Card UID</div>
                        <div className="font-bold text-gray-900">{selectedLoan.customer?.aadhaar || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Partner Name</div>
                        <div className="font-bold text-gray-900">{selectedLoan.customer?.partner_name || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:col-span-2">
                      <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Residential Address</div>
                        <div className="font-semibold text-gray-900">{selectedLoan.customer?.address || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Card 2: Loan Parameters & Details */}
              <Card 
                title="Loan Ledger Parameters" 
                subtitle="Financial terms & active calculations"
                className="shadow-sm border-gray-100 rounded-3xl"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
                  <div>
                    <div className="text-xs text-gray-400 font-bold">Loan ID / Acc Number</div>
                    <div className="font-mono font-bold text-gray-900 text-base">{selectedLoan.loan_id}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Category</div>
                    <div className="font-bold text-gray-900">{selectedLoan.loan_category || 'CD'}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Status</div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold mt-1 ${
                      selectedLoan.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedLoan.status}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Principal Amount</div>
                    <div className="font-bold text-gray-900 text-base">₹{Number(selectedLoan.amount).toLocaleString('en-IN')}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Interest Rate</div>
                    <div className="font-bold text-gray-900">{selectedLoan.interest_rate}% Flat pm</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Duration</div>
                    <div className="font-bold text-gray-900">{selectedLoan.duration_months} Months</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Due Mode / Amount</div>
                    <div className="font-bold text-gray-900">
                      {selectedLoan.due_type} - ₹{Number(selectedLoan.due_amount).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Total Repayable (BS)</div>
                    <div className="font-bold text-gray-900 text-base">₹{ledgerComputations?.totalRepayable.toLocaleString('en-IN')}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Total Interest Comp</div>
                    <div className="font-bold text-gray-900 text-base text-gray-500">₹{ledgerComputations?.interestAmount.toLocaleString('en-IN')}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Disbursement Date</div>
                    <div className="font-bold text-gray-900">
                      {new Date(selectedLoan.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Amount Paid (Cr)</div>
                    <div className="font-bold text-green-600 text-base">₹{ledgerComputations?.totalCredit.toLocaleString('en-IN')}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 font-bold">Outstanding Balance</div>
                    <div className="font-bold text-orange-700 text-base">₹{ledgerComputations?.currentBalance.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </Card>

              {/* Card 3: Surety / Guarantor Details */}
              <Card 
                title="Surety / Guarantor Information" 
                subtitle="Verification profile details for sureties"
                className="shadow-sm border-gray-100 rounded-3xl"
              >
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Surety Full Name" value={editSuretyName} onChange={setEditSuretyName} />
                    <Input label="Surety Phone" value={editSuretyPhone} onChange={setEditSuretyPhone} />
                    <Input label="Surety Aadhaar No" value={editSuretyAadhaar} onChange={setEditSuretyAadhaar} />
                    <Input label="Relation / Remark" value={editSuretyRelation} onChange={setEditSuretyRelation} />
                    <div className="sm:col-span-2">
                      <Input label="Surety Residential Address" value={editSuretyAddress} onChange={setEditSuretyAddress} />
                    </div>
                    <div className="sm:col-span-2">
                      <Input label="Loan Remarks / Audit Notes" value={editLoanRemarks} onChange={setEditLoanRemarks} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Surety Name</div>
                        <div className="font-bold text-gray-900">{selectedLoan.surety_name || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Surety Phone</div>
                        <div className="font-bold text-gray-900">{selectedLoan.surety_phone || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Surety Aadhaar No</div>
                        <div className="font-bold text-gray-900">{selectedLoan.surety_aadhaar || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Surety Relation / Notes</div>
                        <div className="font-bold text-gray-900">{selectedLoan.surety_relation || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:col-span-2">
                      <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Surety Address</div>
                        <div className="font-semibold text-gray-900">{selectedLoan.surety_address || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:col-span-2 pt-2 border-t border-gray-50">
                      <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-bold">Account Remarks / Notes</div>
                        <div className="font-semibold text-gray-600">{selectedLoan.remarks || 'No remarks provided.'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

            </div>

            {/* Right side: photos & documents preview */}
            <div className="space-y-6">
              
              {/* Customer Photo Card */}
              <Card title="Borrower Photo" className="shadow-sm border-gray-100 rounded-3xl text-center">
                <div className="aspect-[4/3] w-full max-w-[240px] mx-auto bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden">
                  {selectedLoan.customer_photo_url ? (
                    <img 
                      src={selectedLoan.customer_photo_url} 
                      alt="Borrower Photo" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 space-y-1">
                      <User className="w-12 h-12 mx-auto" />
                      <div className="text-xs font-bold">No photo attached</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Surety Photo Card */}
              <Card title="Surety Photo" className="shadow-sm border-gray-100 rounded-3xl text-center">
                <div className="aspect-[4/3] w-full max-w-[240px] mx-auto bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden">
                  {selectedLoan.surety_photo_url ? (
                    <img 
                      src={selectedLoan.surety_photo_url} 
                      alt="Surety Photo" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 space-y-1">
                      <User className="w-12 h-12 mx-auto" />
                      <div className="text-xs font-bold">No photo attached</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Documents & Files Area */}
              <Card title="Pledge Documents & Files" className="shadow-sm border-gray-100 rounded-3xl">
                <div className="space-y-4">
                  {/* File Upload Section */}
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                    <div className="flex gap-2">
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="flex-1 bg-white border border-gray-200 rounded-xl p-2 text-xs font-bold text-gray-800"
                      >
                        <option value="Pledge Document">Pledge Document</option>
                        <option value="Aadhaar Card Copy">Aadhaar Card Copy</option>
                        <option value="PAN Card Copy">PAN Card Copy</option>
                        <option value="Land Registry Copy">Land Registry Copy</option>
                        <option value="Other Attachment">Other Attachment</option>
                      </select>
                      
                      <label className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer select-none">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingDoc ? 'Uploading...' : 'Upload'}
                        <input
                          type="file"
                          onChange={handleUploadDocument}
                          disabled={uploadingDoc}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Documents List */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedLoan.documents && selectedLoan.documents.length > 0 ? (
                      selectedLoan.documents.map(doc => (
                        <div key={doc.id} className="p-2 border rounded-xl flex items-center justify-between text-xs bg-white hover:bg-gray-50/50">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <File className="w-4 h-4 text-green-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-bold text-gray-800 block truncate">{doc.document_type}</span>
                              <a 
                                href={doc.document_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[10px] text-green-700 hover:underline block truncate font-medium"
                              >
                                View Attachment
                              </a>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-400 text-xs">No documents uploaded for this loan</div>
                    )}
                  </div>
                </div>
              </Card>

            </div>

          </div>

          {/* Bottom section: tabs/tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Transaction Ledger Table */}
            <Card 
              title="Borrower Ledger Statement" 
              subtitle="All transactions and collection registry logs"
              className="shadow-sm border-gray-100 rounded-3xl"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Date</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Credit (Col)</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Debit (Dis)</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Balance</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Mode</th>
                      <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {ledgerComputations?.processedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50/30">
                        <td className="px-3 py-3 font-semibold text-gray-700">
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-3 text-green-600 font-bold">
                          {tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-red-600 font-bold">
                          {tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-gray-900">
                          ₹{tx.balance.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-500">
                          {tx.payment_mode || 'Cash'}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 font-bold">
                          {tx.collected_by || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Installments Schedule Table */}
            <Card 
              title="Installment Dues Schedule" 
              subtitle="Sequence record of scheduled receivables"
              className="shadow-sm border-gray-100 rounded-3xl"
            >
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-100 text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Due Date</th>
                      <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase">Amount</th>
                      <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase">Paid</th>
                      <th className="px-3 py-3 text-center font-bold text-gray-500 uppercase">Status</th>
                      <th className="px-3 py-3 text-right font-bold text-gray-500 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {selectedLoan.dues && selectedLoan.dues.length > 0 ? (
                      selectedLoan.dues.map((due) => {
                        const amt = Number(due.amount);
                        const paid = Number(due.paid_amount || 0);
                        const bal = Math.max(0, amt - paid);
                        
                        return (
                          <tr key={due.id} className="hover:bg-gray-50/30">
                            <td className="px-3 py-3 font-semibold text-gray-700">
                              {new Date(due.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-gray-900">
                              ₹{amt.toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-green-600">
                              ₹{paid.toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                due.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                due.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {due.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-orange-700">
                              ₹{bal.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">No scheduled dues created for this loan</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

          </div>

          {/* Totals Summary Footer Card */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Credit (Col)</div>
              <div className="text-lg font-black text-green-600 mt-1">₹{ledgerComputations?.totalCredit.toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Debit (Dis)</div>
              <div className="text-lg font-black text-red-600 mt-1">₹{ledgerComputations?.totalDebit.toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Present Balance</div>
              <div className="text-lg font-black text-orange-700 mt-1">₹{ledgerComputations?.currentBalance.toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Dues</div>
              <div className="text-lg font-black text-gray-900 mt-1">₹{ledgerComputations?.totalDues.toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Paid Dues</div>
              <div className="text-lg font-black text-emerald-600 mt-1">₹{ledgerComputations?.paidDues.toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pending Dues</div>
              <div className="text-lg font-black text-red-700 mt-1">₹{ledgerComputations?.pendingDues.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && selectedLoan && ledgerComputations && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex items-center justify-center p-4 print:p-0 print:bg-white">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-full print:shadow-none print:rounded-none">
            
            {/* Modal Header */}
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center print:hidden">
              <h3 className="font-bold text-gray-800">Print Preview (A4 Friendly Layout)</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => window.print()} 
                  variant="success" 
                  size="sm" 
                  icon={Printer}
                  className="rounded-xl"
                >
                  Print Now
                </Button>
                <Button 
                  onClick={() => setShowPrintPreview(false)} 
                  variant="secondary" 
                  size="sm" 
                  icon={X}
                  className="rounded-xl"
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Printable Content Container */}
            <div id="print-preview-area" className="p-8 overflow-y-auto print:overflow-visible flex-1 space-y-6 text-gray-800 font-sans text-xs md:text-sm print:p-0">
              
              {/* Header Title */}
              <div className="text-center border-b-2 border-double border-gray-300 pb-4">
                <h1 className="text-2xl font-black tracking-wide text-gray-900 uppercase">Thirumala Group Financials</h1>
                <p className="text-xs font-semibold text-gray-500 uppercase mt-0.5">Loan Ledger Card - {selectedLedgerType} System</p>
                <div className="flex justify-between items-center text-[10px] text-gray-400 mt-4 font-mono font-bold">
                  <span>PRINTED: {new Date().toLocaleString('en-IN')}</span>
                  <span>ACC ID: {selectedLoan.loan_id}</span>
                </div>
              </div>

              {/* Grid 1: Details */}
              <div className="grid grid-cols-2 gap-6 border-b pb-6">
                
                {/* Borrower details */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-green-800 border-b pb-1">Borrower Information</h4>
                  <table className="w-full text-left">
                    <tbody>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2 w-28">Name:</td>
                        <td className="font-bold text-gray-900">{selectedLoan.customer?.name}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Father/Husband:</td>
                        <td className="font-bold text-gray-800">{selectedLoan.customer?.father_husband_name || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Phones:</td>
                        <td className="font-bold text-gray-800">
                          {selectedLoan.customer?.phone || 'N/A'} {selectedLoan.customer?.phone2 ? `, ${selectedLoan.customer.phone2}` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Aadhaar:</td>
                        <td className="font-semibold text-gray-800">{selectedLoan.customer?.aadhaar || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Partner:</td>
                        <td className="font-semibold text-gray-800">{selectedLoan.customer?.partner_name || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Address:</td>
                        <td className="font-medium text-gray-700">{selectedLoan.customer?.address || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Loan parameters */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-green-800 border-b pb-1">Loan parameters</h4>
                  <table className="w-full text-left">
                    <tbody>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2 w-28">Principal:</td>
                        <td className="font-bold text-gray-900">₹{Number(selectedLoan.amount).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Rate/Months:</td>
                        <td className="font-bold text-gray-800">{selectedLoan.interest_rate}% Flat / {selectedLoan.duration_months} Months</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Repayable:</td>
                        <td className="font-bold text-gray-900">₹{ledgerComputations.totalRepayable.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Collected (Cr):</td>
                        <td className="font-bold text-green-700">₹{ledgerComputations.totalCredit.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Outstanding Balance:</td>
                        <td className="font-bold text-orange-700">₹{ledgerComputations.currentBalance.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 font-bold py-0.5 pr-2">Disbursement Date:</td>
                        <td className="font-semibold text-gray-800">
                          {new Date(selectedLoan.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Guarantor Details */}
              <div className="border-b pb-6 space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-green-800 border-b pb-1">Surety & Guarantor Card</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <table className="w-full text-left">
                      <tbody>
                        <tr>
                          <td className="text-gray-400 font-bold py-0.5 pr-2 w-28">Surety Name:</td>
                          <td className="font-bold text-gray-900">{selectedLoan.surety_name || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 font-bold py-0.5 pr-2">Phone:</td>
                          <td className="font-bold text-gray-800">{selectedLoan.surety_phone || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 font-bold py-0.5 pr-2">Aadhaar UID:</td>
                          <td className="font-bold text-gray-800">{selectedLoan.surety_aadhaar || 'N/A'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <table className="w-full text-left">
                      <tbody>
                        <tr>
                          <td className="text-gray-400 font-bold py-0.5 pr-2 w-28">Address:</td>
                          <td className="font-semibold text-gray-700">{selectedLoan.surety_address || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 font-bold py-0.5 pr-2">Relation/Remark:</td>
                          <td className="font-semibold text-gray-700">{selectedLoan.surety_relation || 'N/A'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-green-800 border-b pb-1">Ledger Transaction History</h4>
                <table className="min-w-full divide-y divide-gray-300 text-xs border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase">Date</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase">Particulars</th>
                      <th className="px-3 py-2 text-right font-bold text-gray-700 uppercase">Credit (Col)</th>
                      <th className="px-3 py-2 text-right font-bold text-gray-700 uppercase">Debit (Disb)</th>
                      <th className="px-3 py-2 text-right font-bold text-gray-700 uppercase">Balance</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white font-mono">
                    {ledgerComputations.processedTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-3 py-1.5 font-sans font-semibold text-gray-700">
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-1.5 font-sans text-gray-600">{tx.remarks || '-'}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-green-600">
                          {tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-red-600">
                          {tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-gray-900">
                          ₹{tx.balance.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 font-sans font-semibold text-gray-500">{tx.payment_mode || 'Cash'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Installment Dues Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-green-800 border-b pb-1">Scheduled Receivables Breakdown</h4>
                <table className="min-w-full divide-y divide-gray-300 text-xs border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase">Due Date</th>
                      <th className="px-3 py-2 text-right font-bold text-gray-700 uppercase">Instalment</th>
                      <th className="px-3 py-2 text-right font-bold text-gray-700 uppercase">Paid Amount</th>
                      <th className="px-3 py-2 text-center font-bold text-gray-700 uppercase">Status</th>
                      <th className="px-3 py-2 text-right font-bold text-gray-700 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white font-mono">
                    {selectedLoan.dues && selectedLoan.dues.length > 0 ? (
                      selectedLoan.dues.slice(0, 15).map((due) => {
                        const amt = Number(due.amount);
                        const paid = Number(due.paid_amount || 0);
                        const bal = Math.max(0, amt - paid);
                        return (
                          <tr key={due.id}>
                            <td className="px-3 py-1.5 font-sans font-semibold text-gray-700">
                              {new Date(due.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-gray-900">₹{amt.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-1.5 text-right font-bold text-green-600">₹{paid.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-1.5 text-center font-sans">
                              <span className="text-[10px] font-bold uppercase">{due.status}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-orange-700">₹{bal.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-4 font-sans text-gray-400">No scheduled dues created</td>
                      </tr>
                    )}
                    {selectedLoan.dues && selectedLoan.dues.length > 15 && (
                      <tr>
                        <td colSpan={5} className="text-center py-2 font-sans text-[10px] text-gray-400">
                          ... and {selectedLoan.dues.length - 15} more dues scheduled. Refer to system for complete list.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Summaries */}
              <div className="border-t border-b py-4 grid grid-cols-3 gap-4 text-center font-mono">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase font-sans">Total Collected</div>
                  <div className="font-bold text-green-600 text-sm">₹{ledgerComputations.totalCredit.toLocaleString('en-IN')}</div>
                </div>

                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase font-sans">Outstanding Balance</div>
                  <div className="font-bold text-orange-700 text-sm">₹{ledgerComputations.currentBalance.toLocaleString('en-IN')}</div>
                </div>

                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase font-sans">Total Scheduled Dues</div>
                  <div className="font-bold text-red-600 text-sm">₹{ledgerComputations.totalDues.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-16 grid grid-cols-2 gap-20 text-center font-semibold text-xs text-gray-500">
                <div>
                  <div className="border-t border-gray-300 pt-1.5 w-40 mx-auto">Borrower Signature</div>
                </div>
                <div>
                  <div className="border-t border-gray-300 pt-1.5 w-40 mx-auto">Partner / Audit Sign</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Global CSS to override display when window.print() is called */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-preview-area, #print-preview-area * {
            visibility: visible !important;
          }
          #print-preview-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
      
    </div>
  );
};

export default CDLedger;
