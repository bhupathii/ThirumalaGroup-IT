import React, { useEffect, useState, useMemo } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinanceTransaction, FinanceDue, FinanceDocument } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';
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
  File as FileIcon, 
  ShieldAlert,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToExcel, exportToCSV } from '../../utils/excel';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

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
  const [selectedLoan, setSelectedLoan] = useState<(FinanceLoan & { customer: FinanceCustomer; transactions: FinanceTransaction[]; photos: any[]; dues: FinanceDue[]; documents: FinanceDocument[] }) | null>(null);
  
  // New List / Payment State
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending/Open' | 'Closed' | 'NPA Closed'>('Pending/Open');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Settings state
  const [ledgerSettings, setLedgerSettings] = useState<any>({});
  
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

  // Return Document Modal State
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnedTo, setReturnedTo] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [isReturningDoc, setIsReturningDoc] = useState(false);
  const [returnSignature, setReturnSignature] = useState<File | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [showReturnDocModal, setShowReturnDocModal] = useState(false);

  // New Tables State
  const [cdLedgerEntries, setCdLedgerEntries] = useState<any[]>([]);
  const [cdInterestDetails, setCdInterestDetails] = useState<any[]>([]);

  // Action Panel State
  const [totalAmountPaying, setTotalAmountPaying] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  // NPA Modal State
  const [showNpaModal, setShowNpaModal] = useState(false);
  const [npaSettlementAmount, setNpaSettlementAmount] = useState('');
  const [npaReason, setNpaReason] = useState('');
  const [isNpaClosing, setIsNpaClosing] = useState(false);

  // Guarantor Full Objects for Display
  const [guarantor1, setGuarantor1] = useState<any | null>(null);
  const [guarantor2, setGuarantor2] = useState<any | null>(null);

  useEffect(() => {
    if (hasAccess) {
      fetchLedgerData();
    }
  }, [hasAccess]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const [allLoans, settings] = await Promise.all([
        supabaseFinance.getCDLoansList(),
        financeLedgerSettingsService.getAllLedgerSettings()
      ]);
      setLedgerSettings(settings);
      setLoansList(allLoans);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const filteredLoans = useMemo(() => {
    return loansList.filter(loan => {
      const isRightCategory = loan.loan_category === selectedLedgerType;
      const isActive = loan.status === 'Active' && !loan.npa_closed;
      const isClosed = loan.status === 'Closed';
      const isNpaClosed = !!loan.npa_closed;
      
      const matchesStatus = statusFilter === 'All' 
        ? true 
        : statusFilter === 'Pending/Open' 
          ? isActive 
          : statusFilter === 'Closed'
            ? isClosed
            : isNpaClosed;

      if (!isRightCategory || !matchesStatus) return false;

      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      const cust = loan.customer;
      return loan.loan_id.toLowerCase().includes(query) ||
        (cust?.name && cust.name.toLowerCase().includes(query)) ||
        (cust?.phone && cust.phone.includes(query)) ||
        (cust?.phone2 && cust.phone2.includes(query)) ||
        (cust?.phone_1 && cust.phone_1.includes(query)) ||
        (cust?.phone_2 && cust.phone_2.includes(query)) ||
        (cust?.aadhaar && cust.aadhaar.includes(query)) ||
        (cust?.partner_name && cust.partner_name.toLowerCase().includes(query)) ||
        (loan.surety_name && loan.surety_name.toLowerCase().includes(query)) ||
        (loan.surety_phone && loan.surety_phone.includes(query)) ||
        (loan.remarks && loan.remarks.toLowerCase().includes(query));
    });
  }, [loansList, searchQuery, selectedLedgerType, statusFilter]);

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
        setEditSuretyAddress(fullDetails.surety_present_address || '');
        setEditSuretyRelation(fullDetails.surety_relation || '');
        setEditLoanRemarks(fullDetails.remarks || '');
        
        // Fetch explicit CD entries and interest rows
        const entries = await supabaseFinance.getCDLedgerEntries(loanId);
        const interests = await supabaseFinance.getCDInterestDetails(loanId);
        setCdLedgerEntries(entries);
        setCdInterestDetails(interests);

        // Fetch Guarantors if present
        if (fullDetails.guarantor_1_id) {
          const { data: g1 } = await supabase.from('finance_guarantors').select('*').eq('id', fullDetails.guarantor_1_id).single();
          setGuarantor1(g1 || null);
        } else {
          setGuarantor1(null);
        }
        
        if (fullDetails.guarantor_2_id) {
          const { data: g2 } = await supabase.from('finance_guarantors').select('*').eq('id', fullDetails.guarantor_2_id).single();
          setGuarantor2(g2 || null);
        } else {
          setGuarantor2(null);
        }

        // Set auto-generated receipt number
        setReceiptNo(`REC-${Date.now().toString().slice(-6)}`);
        setTotalAmountPaying('');

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
    fetchLedgerData();
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
        loanPayload.surety_present_address = editSuretyAddress || null;
        loanPayload.surety_relation = editSuretyRelation || null;
      } catch (err) {
        console.warn('surety_present_address or surety_relation could not be updated in payload', err);
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
    return financeCalculationService.getLoanCalculations(selectedLoan, ledgerSettings[selectedLedgerType] || null);
  }, [selectedLoan, ledgerSettings, selectedLedgerType]);

  const renewCalculations = useMemo(() => {
    if (!selectedLoan) return null;
    const principal = Number(selectedLoan.amount);
    const entryDate = new Date(selectedLoan.date);
    const today = new Date(paymentDate);
    
    const diffTime = Math.max(0, today.getTime() - entryDate.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Due Date is Entry Date + 10 days
    const dueDate = new Date(entryDate.getTime() + 10 * 24 * 60 * 60 * 1000);
    const daysPastDue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    const interestRate = Number(selectedLoan.interest_rate) || 3;
    const penaltyRate = selectedLoan.penalty_percent !== undefined ? Number(selectedLoan.penalty_percent) : 0.75;
    
    let interest = 0;
    if (daysCount > 0) {
      interest = principal * (interestRate / 100) * (daysCount / 30);
    }
    
    let penalty = 0;
    const penaltyDays = Math.max(0, daysPastDue - 5);
    if (penaltyDays > 0) {
      penalty = principal * (penaltyRate / 100) * (penaltyDays / 30);
    }
    
    return {
      daysCount,
      dueDate: dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      daysPastDue,
      penaltyDays,
      interest: Math.round(interest),
      penalty: Math.round(penalty),
      principal
    };
  }, [selectedLoan, paymentDate]);

  const handleActionSubmit = async (actionType: 'Renew' | 'Partial' | 'Close') => {
    if (!selectedLoan || !renewCalculations) return;
    const amount = Number(totalAmountPaying);
    if (amount <= 0 || isNaN(amount)) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    
    setIsRenewing(true);
    try {
      let remainingAmount = amount;
      let penaltyPaid = 0;
      let interestPaid = 0;
      let principalPaid = 0;
      
      if (remainingAmount > 0 && renewCalculations.penalty > 0) {
        penaltyPaid = Math.min(remainingAmount, renewCalculations.penalty);
        remainingAmount -= penaltyPaid;
      }
      if (remainingAmount > 0 && renewCalculations.interest > 0) {
        interestPaid = Math.min(remainingAmount, renewCalculations.interest);
        remainingAmount -= interestPaid;
      }
      if (remainingAmount > 0) {
        principalPaid = Math.min(remainingAmount, renewCalculations.principal);
        remainingAmount -= principalPaid;
      }

      const totalAmountForRenewal = renewCalculations.penalty + renewCalculations.interest;
      const isFullyRenewed = actionType === 'Renew' && amount >= totalAmountForRenewal && amount > 0;
      
      const res = await supabaseFinance.postCdLedgerPayment({
        loanId: selectedLoan.id,
        customerId: selectedLoan.customer_id,
        accountName: selectedLoan.customer?.name || null,
        userName: user?.username || 'Staff',
        actionType,
        principalPaid,
        interestPaid,
        penaltyPaid,
        renewedDays: isFullyRenewed ? renewCalculations.daysCount : 0,
        paymentDate
      });
      
      if (!res.success) {
        throw new Error('Failed to post ledger entries');
      }
      
      const totalForClose = renewCalculations.principal + renewCalculations.interest + renewCalculations.penalty;

      if (actionType === 'Close' || amount >= totalForClose) {
        await supabase.from('finance_loans').update({ 
          status: 'Closed',
          amount: Math.max(0, renewCalculations.principal - principalPaid)
        }).eq('id', selectedLoan.id);
        toast.success('Account closed successfully');
      } else {
        const updates: any = {};
        
        if (isFullyRenewed) {
          // Shift loan date to selected custom date
          updates.date = new Date(paymentDate).toISOString();
        }
        
        if (principalPaid > 0) {
          updates.amount = renewCalculations.principal - principalPaid;
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('finance_loans').update(updates).eq('id', selectedLoan.id);
        }
        
        toast.success('Payment applied successfully');
      }
      
      setTotalAmountPaying('');
      await loadLedgerDetails(selectedLoan.id);
    } catch(e) {
      console.error(e);
      toast.error('Error applying payment');
    } finally {
      setIsRenewing(false);
    }
  };

  const handleNPACloseSubmit = async () => {
    if (!selectedLoan) return;
    setIsNpaClosing(true);
    try {
      const amount = Number(npaSettlementAmount) || 0;
      
      await supabase.from('finance_loans')
        .update({ status: 'Closed', npa_closed: true })
        .eq('id', selectedLoan.id);

      await supabaseFinance.addNPARecord({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        aadhaar: selectedLoan.customer?.aadhaar || '',
        loan_amount: Number(selectedLoan.amount),
        settlement_amount: amount,
        reason: npaReason,
        closed_at: new Date(paymentDate).toISOString()
      });

      await supabaseFinance.addCDLedgerEntry({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: selectedLoan.customer?.name || null,
        entry_date: new Date(paymentDate).toISOString(),
        credit: amount,
        debit: 0,
        receipt_no: `NPA-${Date.now().toString().slice(-6)}`,
        particulars: `NPA Settlement Close - ${npaReason}`,
        user_name: user?.username || 'Staff',
        entry_type: 'Settlement'
      });

      toast.success('NPA Account closed and settlement recorded.');
      setShowNpaModal(false);
      loadLedgerDetails(selectedLoan.id);
    } catch(e) {
      toast.error('Error settling NPA account');
    } finally {
      setIsNpaClosing(false);
    }
  };

  const handleReturnDocSubmit = async () => {
    if (!selectedLoan) return;
    setIsReturningDoc(true);
    try {
      let signatureUrl = null;
      if (returnSignature) {
        const fileExt = returnSignature.name.split('.').pop();
        const fileName = `signature-${selectedLoan.loan_id}-${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage.from('finance-photos').upload(`documents/${fileName}`, returnSignature);
        if (!error && data) {
          signatureUrl = supabase.storage.from('finance-photos').getPublicUrl(data.path).data.publicUrl;
        }
      }

      await supabase.from('finance_documents_returned').insert({
        loan_id: selectedLoan.id,
        returned_date: returnDate,
        returned_to: returnedTo,
        received_by_signature: signatureUrl,
        remarks: returnRemarks,
        created_by: user?.username || 'Staff'
      });

      await supabaseFinance.addCDLedgerEntry({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: selectedLoan.customer?.name || null,
        entry_date: returnDate,
        credit: 0,
        debit: 0,
        receipt_no: `DOC-${Date.now().toString().slice(-6)}`,
        particulars: `Documents Returned to ${returnedTo} - ${returnRemarks}`,
        user_name: user?.username || 'Staff',
        entry_type: 'Settlement'
      });

      toast.success('Documents returned successfully.');
      setShowReturnDocModal(false);
    } catch(e) {
      toast.error('Error recording document return');
    } finally {
      setIsReturningDoc(false);
    }
  };

  // Export to Excel / CSV
  const handleExport = (format: 'xlsx' | 'csv') => {
    if (!selectedLoan || !ledgerComputations) {
      toast.error('No ledger data is currently loaded to export');
      return;
    }

    const exportData = ledgerComputations.processedTransactions.map((tx: any) => ({
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
        <h1 className="finance-h1">Access Restricted</h1>
        <p className="text-gray-500 max-w-md">
          Only authorized personnel are allowed to view the CD Ledger registry. Please consult your administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className={`space-y-6 p-6 max-w-7xl mx-auto ${showPrintPreview ? 'print:hidden' : 'print:p-0'}`}>
      
      {/* Top row: search inputs and action buttons */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm print:hidden">
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <div>
            <label className="finance-caption uppercase">
              Ledger Category
            </label>
            <select
              value={selectedLedgerType}
              onChange={(e) => setSelectedLedgerType(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none finance-sidebar-link"
            >
              <option value="CD">CD Ledger (Chit Fund)</option>
              <option value="STBD">STBD Ledger</option>
              <option value="HP">HP Ledger</option>
              <option value="TBD">TBD Ledger</option>
            </select>
          </div>

          <div>
            <label className="finance-caption uppercase">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none finance-sidebar-link"
            >
              <option value="All">All Statuses</option>
              <option value="Pending/Open">Pending/Open Only</option>
              <option value="Closed">Closed Only</option>
              <option value="NPA Closed">NPA Closed Only</option>
            </select>
          </div>

          <div>
            <label className="finance-caption uppercase">
              Search Accounts
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, ID, Phone..."
                className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none finance-section-heading"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
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
            Open Report
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
          <p className="text-gray-500 finance-section-heading">Compiling CD ledger registry...</p>
        </div>
      ) : !selectedLoan || viewMode === 'list' ? (
        <Card title="Loans Ledger" subtitle={`Showing ${filteredLoans.length} accounts`} className="shadow-sm border-gray-100 rounded-3xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 finance-caption">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="finance-small-label uppercase">Account ID</th>
                  <th className="finance-small-label uppercase">Customer Info</th>
                  <th className="finance-small-label uppercase">Amount</th>
                  <th className="finance-small-label uppercase">Start Date</th>
                  <th className="finance-small-label uppercase">Status</th>
                  <th className="text-right finance-small-label uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400 italic">No loans found matching the filters.</td>
                  </tr>
                ) : (
                  filteredLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-3 font-mono text-gray-700">{loan.loan_id}</td>
                      <td className="px-3 py-3">
                        <div className="text-gray-900 font-medium">{loan.customer?.name}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{loan.customer?.phone}</div>
                      </td>
                      <td className="px-3 py-3 text-gray-700 font-medium">₹{Number(loan.amount).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-gray-500">{new Date(loan.date).toLocaleDateString('en-IN')}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs ${loan.status === 'Closed' ? 'bg-indigo-50 text-indigo-700' : loan.npa_closed ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {loan.status} {loan.npa_closed && '(NPA)'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => {
                            loadLedgerDetails(loan.id);
                            setViewMode('details');
                          }}
                          className="px-3 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors font-medium text-xs border border-emerald-100"
                        >
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" />
              <span className="finance-input">Close Ledger</span>
            </button>
          </div>
          {/* Main workspace area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: details cards */}
            <div className="lg:col-span-2 space-y-6">

              {/* Operator Action Panel */}
              <Card 
                title="Operator Action Panel" 
                subtitle="Execute transactions, renewals, and settlements"
                className="shadow-sm border-emerald-100 rounded-3xl bg-emerald-50/20"
              >
                <div className="bg-white border border-emerald-100 rounded-xl p-4 mb-6">
                  <h4 className="text-emerald-800 font-semibold mb-3 finance-input border-b border-emerald-50 pb-2">Calculated Requirements</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div>
                      <div className="text-gray-500 finance-caption uppercase">Amount</div>
                      <div className="text-gray-900 font-semibold finance-input">₹{renewCalculations?.principal?.toLocaleString('en-IN').replace(/\s/g, '') || 0}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 finance-caption uppercase">Interest</div>
                      <div className="text-orange-600 font-semibold finance-input">₹{renewCalculations?.interest?.toLocaleString('en-IN').replace(/\s/g, '') || 0}</div>
                      {renewCalculations?.daysCount !== undefined && <div className="text-[10px] text-gray-400 mt-0.5">{renewCalculations.daysCount} Interest Days</div>}
                    </div>
                    <div>
                      <div className="text-gray-500 finance-caption uppercase">Penalty</div>
                      <div className="text-red-600 font-semibold finance-input">₹{renewCalculations?.penalty?.toLocaleString('en-IN').replace(/\s/g, '') || 0}</div>
                      {renewCalculations?.penaltyDays !== undefined && <div className="text-[10px] text-gray-400 mt-0.5">{renewCalculations.penaltyDays} Penalty Days</div>}
                    </div>
                    <div className="sm:col-span-1">
                      <div className="text-gray-500 finance-caption uppercase">Total For Renewal</div>
                      <div className="text-emerald-600 font-bold finance-brand">₹{((renewCalculations?.interest || 0) + (renewCalculations?.penalty || 0)).toLocaleString('en-IN').replace(/\s/g, '')}</div>
                    </div>
                    <div className="sm:col-span-1">
                      <div className="text-gray-500 finance-caption uppercase">Total For Close</div>
                      <div className="text-indigo-700 font-bold finance-brand">₹{((renewCalculations?.principal || 0) + (renewCalculations?.interest || 0) + (renewCalculations?.penalty || 0)).toLocaleString('en-IN').replace(/\s/g, '')}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="finance-caption uppercase mb-1 block">Payment/Transaction Date</label>
                    <input 
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none finance-input"
                    />
                  </div>
                  <Input 
                    label="Receipt No (Auto-Generated)" 
                    value={receiptNo} 
                    onChange={setReceiptNo} 
                    className="font-mono text-gray-700 bg-gray-100 cursor-not-allowed"
                    readOnly
                  />
                  <Input 
                    label="Total Amount Paying" 
                    type="number"
                    value={totalAmountPaying} 
                    onChange={setTotalAmountPaying} 
                    className="text-lg font-bold text-green-700 placeholder-gray-300"
                    placeholder="Enter amount ₹"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handleActionSubmit('Renew')}
                    disabled={isRenewing || !totalAmountPaying || selectedLoan.status === 'Closed'}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    icon={CreditCard}
                  >
                    Renew Account
                  </Button>
                  <Button
                    onClick={() => handleActionSubmit('Partial')}
                    disabled={isRenewing || !totalAmountPaying || selectedLoan.status === 'Closed'}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    icon={CreditCard}
                  >
                    Partial Payment
                  </Button>
                  <Button
                    onClick={() => handleActionSubmit('Close')}
                    disabled={isRenewing || !totalAmountPaying || selectedLoan.status === 'Closed'}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    icon={ShieldAlert}
                  >
                    Close Account
                  </Button>
                  <Button
                    onClick={() => setShowNpaModal(true)}
                    disabled={selectedLoan.status === 'Closed'}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    icon={ShieldAlert}
                  >
                    NPA Close
                  </Button>
                  <Button
                    onClick={() => setShowReturnDocModal(true)}
                    disabled={selectedLoan.status !== 'Closed'}
                    className="bg-gray-800 hover:bg-gray-900 text-white"
                    icon={FileIcon}
                  >
                    Document Returned
                  </Button>
                </div>
              </Card>
              
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 finance-input">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-gray-400 finance-header-time">Customer Name</div>
                        <div className="text-gray-900 finance-input">{selectedLoan.customer?.name}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-gray-400 finance-header-time">Father/Husband Name</div>
                        <div className="text-gray-900 finance-input">{selectedLoan.customer?.father_husband_name || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-gray-400 finance-header-time">Primary Phone</div>
                        <div className="text-gray-900 finance-input">{selectedLoan.customer?.phone || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-gray-400 finance-header-time">Secondary Phone</div>
                        <div className="text-gray-900 finance-input">{selectedLoan.customer?.phone2 || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-gray-400 finance-header-time">Aadhaar Card UID</div>
                        <div className="text-gray-900 finance-input">{selectedLoan.customer?.aadhaar || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-gray-400 finance-header-time">Partner Name</div>
                        <div className="text-gray-900 finance-input">{selectedLoan.customer?.partner_name || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:col-span-2">
                      <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-gray-400 finance-header-time">Residential Address</div>
                        <div className="text-gray-900 finance-input">{selectedLoan.customer?.address || 'N/A'}</div>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 finance-input">
                  <div>
                    <div className="text-gray-400 finance-header-time">Loan ID / Acc Number</div>
                    <div className="font-mono text-gray-900 finance-brand">{selectedLoan.loan_id}</div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Category</div>
                    <div className="text-gray-900 finance-input">{selectedLoan.loan_category || 'CD'}</div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Status</div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full mt-1 ${ selectedLoan.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' } finance-header-time`}>
                      {selectedLoan.status}
                    </span>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Disbursement Date</div>
                    <div className="text-gray-900 finance-input">
                      {new Date(selectedLoan.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Principal Amount</div>
                    <div className="text-gray-900 finance-brand">₹{Number(selectedLoan.amount).toLocaleString('en-IN').replace(/\s/g, '')}</div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Rate / Penalty %</div>
                    <div className="text-gray-900 finance-input">{selectedLoan.interest_rate}% / {selectedLoan.penalty_percent || 0.75}%</div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Total Days (Since Date)</div>
                    <div className="text-gray-900 finance-input">{renewCalculations?.daysCount || 0} Days</div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Due Days (Past Due)</div>
                    <div className="text-gray-900 finance-input">
                      {renewCalculations?.daysPastDue || 0} Days
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Next Due Date</div>
                    <div className="text-gray-900 finance-input">
                      {renewCalculations?.dueDate}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Present Interest Due</div>
                    <div className="text-orange-600 finance-brand">₹{(renewCalculations?.interest || 0).toLocaleString('en-IN').replace(/\s/g, '')}</div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Present Penalty Due</div>
                    <div className="text-red-600 finance-brand">₹{(renewCalculations?.penalty || 0).toLocaleString('en-IN').replace(/\s/g, '')}</div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Total Required for Renewal</div>
                    <div className="text-green-600 finance-brand">₹{((renewCalculations?.interest || 0) + (renewCalculations?.penalty || 0)).toLocaleString('en-IN').replace(/\s/g, '')}</div>
                  </div>

                  <div>
                    <div className="text-gray-400 finance-header-time">Total Account Closing Balance</div>
                    <div className="text-indigo-700 finance-brand">₹{((renewCalculations?.principal || 0) + (renewCalculations?.interest || 0) + (renewCalculations?.penalty || 0)).toLocaleString('en-IN').replace(/\s/g, '')}</div>
                  </div>
                </div>
              </Card>

              {/* Card 3: Guarantor Details */}
              <Card 
                title="Guarantors Information" 
                subtitle="Primary and secondary guarantor details"
                className="shadow-sm border-gray-100 rounded-3xl"
              >
                {!guarantor1 && !guarantor2 && (
                  <div className="text-gray-400 py-4 finance-input italic">No guarantors found for this account.</div>
                )}
                
                {guarantor1 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 border-b pb-2 mb-3">Guarantor 1</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 finance-input">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Name</div>
                          <div className="text-gray-900 finance-input">{guarantor1.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Phone</div>
                          <div className="text-gray-900 finance-input">{guarantor1.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Aadhaar No</div>
                          <div className="text-gray-900 finance-input">{guarantor1.aadhaar}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Permanent Address</div>
                          <div className="text-gray-900 finance-input">
                            {[
                              guarantor1.permanent_address || guarantor1.aadhaar_address || guarantor1.address,
                              guarantor1.permanent_village || guarantor1.village,
                              guarantor1.permanent_mandal || guarantor1.mandal,
                              guarantor1.permanent_district || guarantor1.district
                            ].filter(Boolean).join(', ') || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Current Address</div>
                          <div className="text-gray-900 finance-input">
                            {[
                              guarantor1.current_address || guarantor1.present_address,
                              guarantor1.current_village,
                              guarantor1.current_mandal,
                              guarantor1.current_district
                            ].filter(Boolean).join(', ') || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {guarantor2 && (
                  <div>
                    <h4 className="font-semibold text-gray-800 border-b pb-2 mb-3">Guarantor 2</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 finance-input">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Name</div>
                          <div className="text-gray-900 finance-input">{guarantor2.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Phone</div>
                          <div className="text-gray-900 finance-input">{guarantor2.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Aadhaar No</div>
                          <div className="text-gray-900 finance-input">{guarantor2.aadhaar}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Permanent Address</div>
                          <div className="text-gray-900 finance-input">
                            {[
                              guarantor2.permanent_address || guarantor2.aadhaar_address || guarantor2.address,
                              guarantor2.permanent_village || guarantor2.village,
                              guarantor2.permanent_mandal || guarantor2.mandal,
                              guarantor2.permanent_district || guarantor2.district
                            ].filter(Boolean).join(', ') || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <div className="text-gray-400 finance-header-time">Current Address</div>
                          <div className="text-gray-900 finance-input">
                            {[
                              guarantor2.current_address || guarantor2.present_address,
                              guarantor2.current_village,
                              guarantor2.current_mandal,
                              guarantor2.current_district
                            ].filter(Boolean).join(', ') || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                    <div>
                      <div className="text-gray-400 finance-header-time">Account Remarks / Notes</div>
                      <div className="text-gray-600 finance-input">{selectedLoan.remarks || 'No remarks provided.'}</div>
                    </div>
                  </div>
                </div>
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
                      <div className="finance-header-time">No photo attached</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Guarantor 1 Photo Card */}
              {guarantor1 && (
                <Card title="Guarantor 1 Photo" className="shadow-sm border-gray-100 rounded-3xl text-center">
                  <div className="aspect-[4/3] w-full max-w-[240px] mx-auto bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden">
                    {guarantor1.photo_url ? (
                      <img 
                        src={guarantor1.photo_url} 
                        alt="Guarantor 1 Photo" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400 space-y-1">
                        <User className="w-12 h-12 mx-auto" />
                        <div className="finance-header-time">No photo attached</div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Guarantor 2 Photo Card */}
              {guarantor2 && (
                <Card title="Guarantor 2 Photo" className="shadow-sm border-gray-100 rounded-3xl text-center">
                  <div className="aspect-[4/3] w-full max-w-[240px] mx-auto bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden">
                    {guarantor2.photo_url ? (
                      <img 
                        src={guarantor2.photo_url} 
                        alt="Guarantor 2 Photo" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400 space-y-1">
                        <User className="w-12 h-12 mx-auto" />
                        <div className="finance-header-time">No photo attached</div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {!guarantor1 && !guarantor2 && (
                <Card title="Guarantor Photo" className="shadow-sm border-gray-100 rounded-3xl text-center">
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
                        <div className="finance-header-time">No photo attached</div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Documents & Files Area */}
              <Card title="Pledge Documents & Files" className="shadow-sm border-gray-100 rounded-3xl">
                <div className="space-y-4">
                  {/* File Upload Section */}
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                    <div className="flex gap-2">
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="flex-1 bg-white border border-gray-200 rounded-xl p-2 text-gray-800 finance-header-time"
                      >
                        <option value="Pledge Document">Pledge Document</option>
                        <option value="Aadhaar Card Copy">Aadhaar Card Copy</option>
                        <option value="PAN Card Copy">PAN Card Copy</option>
                        <option value="Land Registry Copy">Land Registry Copy</option>
                        <option value="Other Attachment">Other Attachment</option>
                      </select>
                      
                      <label className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-xl flex items-center gap-1 cursor-pointer select-none finance-header-time">
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
                        <div key={doc.id} className="p-2 border rounded-xl flex items-center justify-between bg-white hover:bg-gray-50/50 finance-caption">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileIcon className="w-4 h-4 text-green-600 shrink-0" />
                            <div className="truncate">
                              <span className="text-gray-800 block truncate finance-input">{doc.document_type}</span>
                              <a 
                                href={doc.document_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-green-700 hover:underline block truncate finance-small-label"
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
                      <div className="text-center py-6 text-gray-400 finance-caption">No documents uploaded for this loan</div>
                    )}
                  </div>
                </div>
              </Card>

            </div>

          </div>

          {/* Bottom section: tabs/tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Transaction Ledger Table */}
            {/* Transaction Ledger Table */}
            <Card 
              title="Borrower Ledger Statement" 
              subtitle="All transactions and collection registry logs"
              className="shadow-sm border-gray-100 rounded-3xl"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 md:text-sm finance-caption">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="finance-small-label uppercase">Date</th>
                      <th className="finance-small-label uppercase">A/C Name</th>
                      <th className="finance-small-label uppercase text-right">Credit</th>
                      <th className="finance-small-label uppercase text-right">Debit</th>
                      <th className="finance-small-label uppercase">User</th>
                      <th className="finance-small-label uppercase">Receipt No</th>
                      <th className="finance-small-label uppercase">Particulars</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {cdLedgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50/30">
                        <td className="px-3 py-3 text-gray-700 finance-input">
                          {new Date(entry.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-3 text-gray-900 finance-input">
                          {entry.account_name || '-'}
                        </td>
                        <td className="px-3 py-3 text-green-600 finance-input text-right">
                          {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN').replace(/\s/g, '')}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-red-600 finance-input text-right">
                          {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN').replace(/\s/g, '')}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-gray-500 finance-input">
                          {entry.user_name || 'Staff'}
                        </td>
                        <td className="px-3 py-3 text-gray-500 finance-input">
                          {entry.receipt_no || '-'}
                        </td>
                        <td className="px-3 py-3 text-gray-400 finance-header-time">
                          {entry.particulars || '-'}
                        </td>
                      </tr>
                    ))}
                    {cdLedgerEntries.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-400">No ledger entries found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Interest Details Table */}
            <Card 
              title="Interest & Penalty Details" 
              subtitle="Renewal history and calculated days"
              className="shadow-sm border-gray-100 rounded-3xl"
            >
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-100 md:text-sm finance-caption">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="finance-small-label uppercase">Date</th>
                      <th className="text-right finance-small-label uppercase">Credit</th>
                      <th className="finance-small-label uppercase">Receipt No</th>
                      <th className="finance-small-label uppercase">Particulars</th>
                      <th className="text-center finance-small-label uppercase">Days Renewed</th>
                      <th className="finance-small-label uppercase">Renewed Till</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {cdInterestDetails.length > 0 ? (
                      cdInterestDetails.map((detail) => (
                        <tr key={detail.id} className="hover:bg-gray-50/30">
                          <td className="px-3 py-3 text-gray-700 finance-input">
                            {new Date(detail.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="px-3 py-3 text-right text-green-600 finance-input">
                            ₹{Number(detail.credit).toLocaleString('en-IN').replace(/\s/g, '')}
                          </td>
                          <td className="px-3 py-3 text-gray-500 finance-input">
                            {detail.receipt_no || '-'}
                          </td>
                          <td className="px-3 py-3 text-gray-500 finance-input">
                            {detail.particulars || '-'}
                          </td>
                          <td className="px-3 py-3 text-center finance-input text-gray-900">
                            {detail.renewed_days > 0 ? `${detail.renewed_days} Days` : '-'}
                          </td>
                          <td className="px-3 py-3 text-gray-700 finance-input">
                            {detail.renewed_till_date ? new Date(detail.renewed_till_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">No interest details found for this loan</td>
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
              <div className="text-gray-400 finance-header-time uppercase">Total Credit (Col)</div>
              <div className="text-green-600 mt-1 finance-brand">₹{cdLedgerEntries.reduce((sum, entry) => sum + Number(entry.credit), 0).toLocaleString('en-IN').replace(/\s/g, '')}</div>
            </div>

            <div>
              <div className="text-gray-400 finance-header-time uppercase">Total Debit (Dis)</div>
              <div className="text-red-600 mt-1 finance-brand">₹{cdLedgerEntries.reduce((sum, entry) => sum + Number(entry.debit), 0).toLocaleString('en-IN').replace(/\s/g, '')}</div>
            </div>

            <div>
              <div className="text-gray-400 finance-header-time uppercase">Present Balance</div>
              <div className="text-orange-700 mt-1 finance-brand">₹{selectedLoan.amount ? Number(selectedLoan.amount).toLocaleString('en-IN').replace(/\s/g, '') : '0'}</div>
            </div>

            <div>
              <div className="text-gray-400 finance-header-time uppercase">Total Dues</div>
              <div className="text-gray-900 mt-1 finance-brand">₹{ledgerComputations?.totalDues.toLocaleString('en-IN').replace(/\s/g, '') || '0'}</div>
            </div>

            <div>
              <div className="text-gray-400 finance-header-time uppercase">Paid Dues</div>
              <div className="text-emerald-600 mt-1 finance-brand">₹{ledgerComputations?.paidDues.toLocaleString('en-IN').replace(/\s/g, '') || '0'}</div>
            </div>

            <div>
              <div className="text-gray-400 finance-header-time uppercase">Pending Dues</div>
              <div className="text-red-700 mt-1 finance-brand">₹{ledgerComputations?.pendingDues.toLocaleString('en-IN').replace(/\s/g, '') || '0'}</div>
            </div>
          </div>
        </>
      )}

    </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview && !!selectedLoan && !!ledgerComputations}
        onClose={() => setShowPrintPreview(false)}
        title="Print Preview (A4 Friendly Layout)"
        documentTitle={`Loan Ledger Card - ${selectedLedgerType} System`}
      >
        {selectedLoan && renewCalculations && (
          <div className="space-y-6 text-gray-800 font-sans md:text-sm finance-caption">
            
            {/* Header Title */}
            <div className="text-center border-b-2 border-double border-gray-300 pb-4">
              <div className="flex justify-between items-center text-gray-400 mt-4 font-mono finance-small-label">
                <span>PRINTED: {new Date().toLocaleString('en-IN').replace(/\s/g, '')}</span>
                <span>ACC ID: {selectedLoan.loan_id}</span>
              </div>
            </div>

            {/* Grid 1: Details */}
            <div className="grid grid-cols-2 gap-6 border-b pb-6">
              
              {/* Borrower details */}
              <div className="space-y-2">
                <h4 className="text-green-800 border-b pb-1 finance-header-time uppercase">Borrower Information</h4>
                <table className="w-full text-left">
                  <tbody>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 w-28 finance-input">Name:</td>
                      <td className="text-gray-900 finance-input">{selectedLoan.customer?.name}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Father/Husband:</td>
                      <td className="text-gray-800 finance-input">{selectedLoan.customer?.father_husband_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Phones:</td>
                      <td className="text-gray-800 finance-input">
                        {selectedLoan.customer?.phone || 'N/A'} {selectedLoan.customer?.phone2 ? `, ${selectedLoan.customer.phone2}` : ''}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Aadhaar:</td>
                      <td className="text-gray-800 finance-input">{selectedLoan.customer?.aadhaar || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Partner:</td>
                      <td className="text-gray-800 finance-input">{selectedLoan.customer?.partner_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Address:</td>
                      <td className="text-gray-700 finance-input">{selectedLoan.customer?.address || 'N/A'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Loan parameters */}
              <div className="space-y-2">
                <h4 className="text-green-800 border-b pb-1 finance-header-time uppercase">Loan parameters</h4>
                <table className="w-full text-left">
                  <tbody>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 w-28 finance-input">Principal:</td>
                      <td className="text-gray-900 finance-input">₹{renewCalculations.principal.toLocaleString('en-IN').replace(/\s/g, '')}</td>
                    </tr>
                    <tr>
                      <th className="px-3 py-1 text-gray-500 text-left border-r border-gray-200 finance-small-label uppercase">Rate / Penalty</th>
                      <td className="text-gray-800 finance-input">{selectedLoan.interest_rate || 3}% / {selectedLoan.penalty_percent || 0.75}%</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Present Interest Due:</td>
                      <td className="text-gray-900 finance-input">₹{renewCalculations.interest.toLocaleString('en-IN').replace(/\s/g, '')}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Present Penalty Due:</td>
                      <td className="text-red-700 finance-input">₹{renewCalculations.penalty.toLocaleString('en-IN').replace(/\s/g, '')}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Days Count:</td>
                      <td className="text-orange-700 finance-input">{renewCalculations.daysCount} Days</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400 py-0.5 pr-2 finance-input">Disbursement Date:</td>
                      <td className="text-gray-800 finance-input">
                        {new Date(selectedLoan.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Guarantor Details */}
            <div className="border-b pb-6 space-y-2">
              <h4 className="text-green-800 border-b pb-1 finance-header-time uppercase">Guarantor Details</h4>
              <div className="grid grid-cols-2 gap-4">
                {guarantor1 && (
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-1">Guarantor 1</h5>
                    <table className="w-full text-left">
                      <tbody>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 w-28 finance-input">Name:</td>
                          <td className="text-gray-900 finance-input">{guarantor1.name}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 finance-input">Phone:</td>
                          <td className="text-gray-800 finance-input">{guarantor1.phone}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 finance-input">Aadhaar UID:</td>
                          <td className="text-gray-800 finance-input">{guarantor1.aadhaar}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 finance-input">Permanent Address:</td>
                          <td className="text-gray-700 finance-input">
                            {[
                              guarantor1.permanent_address || guarantor1.aadhaar_address || guarantor1.address,
                              guarantor1.permanent_village || guarantor1.village,
                              guarantor1.permanent_mandal || guarantor1.mandal,
                              guarantor1.permanent_district || guarantor1.district
                            ].filter(Boolean).join(', ') || 'N/A'}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 finance-input">Current Address:</td>
                          <td className="text-gray-700 finance-input">
                            {[
                              guarantor1.current_address || guarantor1.present_address,
                              guarantor1.current_village,
                              guarantor1.current_mandal,
                              guarantor1.current_district
                            ].filter(Boolean).join(', ') || 'N/A'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {guarantor2 && (
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-1">Guarantor 2</h5>
                    <table className="w-full text-left">
                      <tbody>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 w-28 finance-input">Name:</td>
                          <td className="text-gray-900 finance-input">{guarantor2.name}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 finance-input">Phone:</td>
                          <td className="text-gray-800 finance-input">{guarantor2.phone}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 finance-input">Aadhaar UID:</td>
                          <td className="text-gray-800 finance-input">{guarantor2.aadhaar}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 finance-input">Permanent Address:</td>
                          <td className="text-gray-700 finance-input">
                            {[
                              guarantor2.permanent_address || guarantor2.aadhaar_address || guarantor2.address,
                              guarantor2.permanent_village || guarantor2.village,
                              guarantor2.permanent_mandal || guarantor2.mandal,
                              guarantor2.permanent_district || guarantor2.district
                            ].filter(Boolean).join(', ') || 'N/A'}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-gray-400 py-0.5 pr-2 finance-input">Current Address:</td>
                          <td className="text-gray-700 finance-input">
                            {[
                              guarantor2.current_address || guarantor2.present_address,
                              guarantor2.current_village,
                              guarantor2.current_mandal,
                              guarantor2.current_district
                            ].filter(Boolean).join(', ') || 'N/A'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Interest Details Table */}
            <div className="space-y-2 mt-4">
              <h4 className="text-green-800 border-b pb-1 finance-header-time uppercase">Interest & Penalty Details</h4>
              <table className="min-w-full divide-y divide-gray-300 border border-gray-200 finance-caption">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="finance-small-label uppercase">Date</th>
                    <th className="text-right finance-small-label uppercase">Credit</th>
                    <th className="finance-small-label uppercase">Receipt No</th>
                    <th className="finance-small-label uppercase">Particulars</th>
                    <th className="text-center finance-small-label uppercase">Days Renewed</th>
                    <th className="finance-small-label uppercase">Renewed Till</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white font-mono">
                  {cdInterestDetails.length > 0 ? (
                    cdInterestDetails.map((detail) => (
                      <tr key={detail.id}>
                        <td className="px-3 py-1.5 font-sans text-gray-700 finance-input">
                          {new Date(detail.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-1.5 text-right text-green-600 finance-input">
                          ₹{Number(detail.credit).toLocaleString('en-IN').replace(/\s/g, '')}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 finance-input">
                          {detail.receipt_no || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 finance-input">
                          {detail.particulars || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-center text-gray-900 finance-input">
                          {detail.renewed_days > 0 ? `${detail.renewed_days} Days` : '-'}
                        </td>
                        <td className="px-3 py-1.5 font-sans text-gray-700 finance-input">
                          {detail.renewed_till_date ? new Date(detail.renewed_till_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-4 font-sans text-gray-400">No interest details found for this loan</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Transactions Ledger Table */}
            <div className="space-y-2 mt-4">
              <h4 className="text-green-800 border-b pb-1 finance-header-time uppercase">Ledger Transaction History</h4>
              <table className="min-w-full divide-y divide-gray-300 border border-gray-200 finance-caption">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="finance-small-label uppercase">Date</th>
                    <th className="text-right finance-small-label uppercase">Debit</th>
                    <th className="text-right finance-small-label uppercase">Credit</th>
                    <th className="text-right finance-small-label uppercase">Balance</th>
                    <th className="finance-small-label uppercase">Receipt No</th>
                    <th className="finance-small-label uppercase">Particulars</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white font-mono">
                  {cdLedgerEntries.length > 0 ? (
                    cdLedgerEntries.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-3 py-1.5 font-sans text-gray-700 finance-input">
                          {new Date(tx.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-1.5 text-right text-red-600 finance-input">
                          {tx.debit > 0 ? `₹${Number(tx.debit).toLocaleString('en-IN').replace(/\s/g, '')}` : '-'}
                        </td>
                        <td className="px-3 py-1.5 text-right text-green-600 finance-input">
                          {tx.credit > 0 ? `₹${Number(tx.credit).toLocaleString('en-IN').replace(/\s/g, '')}` : '-'}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-900 finance-input">
                          ₹{Number(tx.balance).toLocaleString('en-IN').replace(/\s/g, '')}
                        </td>
                        <td className="px-3 py-1.5 font-sans text-gray-500 finance-input">{tx.receipt_no || '-'}</td>
                        <td className="px-3 py-1.5 font-sans text-gray-500 finance-input">{tx.particulars || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-4 font-sans text-gray-400">No ledger transactions found for this loan</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="pt-16 grid grid-cols-2 gap-20 text-center text-gray-500 finance-header-time">
              <div>
                <div className="border-t border-gray-300 pt-1.5 w-40 mx-auto">Borrower Signature</div>
              </div>
              <div>
                <div className="border-t border-gray-300 pt-1.5 w-40 mx-auto">Partner / Audit Sign</div>
              </div>
            </div>

          </div>
        )}
      </FinancePrintPreview>

      {/* NPA Close Account Modal */}
      {showNpaModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl relative">
            <button
              onClick={() => setShowNpaModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-orange-600" />
              NPA Settlement Close
            </h2>
            
            <div className="space-y-4">
              <div>
                <Input 
                  label={`Settlement Amount (₹)`} 
                  type="number"
                  value={npaSettlementAmount} 
                  onChange={setNpaSettlementAmount} 
                  placeholder="Enter final settled amount"
                />
              </div>
              <div>
                <Input 
                  label="Reason / Remarks" 
                  value={npaReason} 
                  onChange={setNpaReason} 
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <Button onClick={() => setShowNpaModal(false)} variant="secondary" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleNPACloseSubmit} variant="danger" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" disabled={isNpaClosing}>
                  {isNpaClosing ? 'Processing...' : 'Close NPA Account'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Documents Modal */}
      {showReturnDocModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl relative">
            <button
              onClick={() => setShowReturnDocModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <FileIcon className="w-6 h-6 text-blue-600" />
              Return Documents
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="finance-caption uppercase mb-2 block">Return Date</label>
                <input 
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>
              <div>
                <Input 
                  label="Returned To (Name)" 
                  value={returnedTo} 
                  onChange={setReturnedTo} 
                  placeholder="Person receiving documents"
                />
              </div>
              <div>
                <label className="finance-caption uppercase mb-2 block">Receiver Signature / Photo</label>
                <input 
                  type="file"
                  onChange={(e) => setReturnSignature(e.target.files?.[0] || null)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2 text-sm text-gray-800"
                />
              </div>
              <div>
                <Input 
                  label="Remarks" 
                  value={returnRemarks} 
                  onChange={setReturnRemarks} 
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <Button onClick={() => setShowReturnDocModal(false)} variant="secondary" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleReturnDocSubmit} variant="primary" className="flex-1 bg-blue-600 hover:bg-blue-700 border-0 text-white" disabled={isReturningDoc || !returnedTo}>
                  {isReturningDoc ? 'Saving...' : 'Confirm Return'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CDLedger;
