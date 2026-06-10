import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinanceTransaction, FinanceDue, FinanceDocument } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { financeCalculationService } from '../../services/financeCalculationService';
import { 
  Printer, 
  Download, 
  RefreshCw, 
  Search, 
  Edit2, 
  Save, 
  X, 
  User, 
  File as FileIcon, 
  ShieldAlert,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  List
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToExcel, exportToCSV } from '../../utils/excel';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

const startOfDay = (d: Date | string | number) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const CDLedger: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Permission Check
  const hasAccess = useMemo(() => {
    return user?.is_admin || user?.features.includes('cd_ledger');
  }, [user]);

  // UI / State
  const [loading, setLoading] = useState(true);
  const [loansList, setLoansList] = useState<(FinanceLoan & { customer: FinanceCustomer; guarantor_1?: FinanceCustomer; guarantor_2?: FinanceCustomer })[]>([]);
  
  // Custom Autocomplete Search State
  const [searchNameQuery, setSearchNameQuery] = useState('');
  const [searchAcQuery, setSearchAcQuery] = useState('');
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showAcDropdown, setShowAcDropdown] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState('');

  const [selectedLoan, setSelectedLoan] = useState<(FinanceLoan & { customer: FinanceCustomer; transactions: FinanceTransaction[]; photos: any[]; dues: FinanceDue[]; documents: FinanceDocument[] }) | null>(null);
  
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  
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
  const [npaReason, setNpaReason] = useState('');
  const [isNpaClosing, setIsNpaClosing] = useState(false);

  // Guarantor Full Objects for Display
  const [guarantor1, setGuarantor1] = useState<any | null>(null);
  const [guarantor2, setGuarantor2] = useState<any | null>(null);
  const [loanDocuments, setLoanDocuments] = useState<any[]>([]);
  const [collateralLog, setCollateralLog] = useState<any | null>(null);
  const [documentReturned, setDocumentReturned] = useState<any | null>(null);
  // Real-time ticking Clock State
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      let hours = d.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formatted = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
      setTimeStr(formatted);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchLedgerData();
    }
  }, [hasAccess]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const allLoans = await supabaseFinance.getCDLoansList();

      // Show ONLY CD loans in CD Ledger
      const cdLoans = allLoans.filter((l: any) => l.loan_category === 'CD');
      setLoansList(cdLoans);

      // Do NOT auto-load — show the index/list view on mount
    } catch (err) {
      console.error(err);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

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
        
        // Normalize legacy/native entries to prevent commission/charges from reducing dues.
        // KEY RULE: Never reclassify a row whose entry_type is already interest_payment or penalty_payment.
        // Only mark as opening_commission when: (a) DB type is opening_commission/Commission/document_charge,
        // OR (b) receipt_no is '-' or null/missing (disbursement-time rows have no real receipt number).
        const normalizedEntries = entries.map((entry: any) => {
          let entryType = entry.entry_type;
          let particulars = entry.particulars || '';
          const accountNameLower = (entry.account_name || '').toLowerCase();
          const particularsLower = particulars.toLowerCase();

          // If native CD entry, keep particulars unchanged except for opening charges normalization
          if (entry.account_name) {
            if (accountNameLower === 'cd commission a/c') {
              // Only treat as opening_commission if it was saved as such, or has no real receipt (disbursement row).
              // Do NOT reclassify interest_payment rows - they have RC numbers and different entry_type.
              const isOpeningRow = entryType === 'opening_commission' || entryType === 'Commission'
                || (!entry.receipt_no || entry.receipt_no === '-');
              if (isOpeningRow && entryType !== 'interest_payment' && entryType !== 'penalty_payment') {
                entryType = 'opening_commission';
                particulars = 'Opening CD Commission Charged';
              }
              // If entry_type is interest_payment or penalty_payment, leave completely unchanged
            } else if (accountNameLower === 'cd document charges a/c') {
              if (entryType !== 'document_charge') entryType = 'document_charge';
            } else if (
              particularsLower.includes('disbursement') ||
              accountNameLower === 'disbursement' ||
              entryType === 'original_loan' ||
              (accountNameLower === 'cd a/c' && entry.debit > 0 && !entry.credit)
            ) {
              entryType = 'original_loan';
              particulars = 'Original Loan Disbursement';
            }
            return { ...entry, entry_type: entryType, particulars };
          }

          // Fallback normalization for legacy/unsplit entries where account_name is null
          if (particularsLower.includes('disbursement') || (entry.debit > 0 && !entry.credit)) {
            entryType = 'original_loan';
            particulars = 'Original Loan Disbursement';
          }

          return { ...entry, entry_type: entryType, particulars };
        });
        
        setCdLedgerEntries(normalizedEntries);
        setCdInterestDetails(interests);

        // Fetch Guarantors if present from finance_customers
        if (fullDetails.guarantor_1_id) {
          const { data: g1 } = await supabase.from('finance_customers').select('*').eq('id', fullDetails.guarantor_1_id).single();
          setGuarantor1(g1 || null);
        } else {
          setGuarantor1(null);
        }
        
        if (fullDetails.guarantor_2_id) {
          const { data: g2 } = await supabase.from('finance_customers').select('*').eq('id', fullDetails.guarantor_2_id).single();
          setGuarantor2(g2 || null);
        } else {
          setGuarantor2(null);
        }

        // Fetch loan documents from finance_loan_documents
        const { data: loanDocs } = await supabase
          .from('finance_loan_documents')
          .select('*')
          .eq('loan_id', loanId);
        setLoanDocuments(loanDocs || []);

        // Fetch collateral logs from finance_edited_logs
        const { data: colLogs } = await supabase
          .from('finance_edited_logs')
          .select('*')
          .eq('table_name', 'finance_loans_collateral')
          .eq('record_id', loanId)
          .order('edited_at', { ascending: false })
          .limit(1);
        if (colLogs && colLogs.length > 0) {
          setCollateralLog(colLogs[0].new_values);
        } else {
          setCollateralLog(null);
        }

        // Fetch returned document status
        const { data: retDocs } = await supabase
          .from('finance_documents_returned')
          .select('*')
          .eq('loan_id', loanId)
          .order('created_at', { ascending: false })
          .limit(1);
        setDocumentReturned(retDocs && retDocs.length > 0 ? retDocs[0] : null);

        // Set auto-generated receipt number (sequential)
        const nextReceipt = await supabaseFinance.getNextReceiptNumber();
        setReceiptNo(nextReceipt);
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

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleSaveDetails = async () => {
    if (!selectedLoan) return;
    setSavingDetails(true);
    try {
      const staffName = user?.username || 'Staff';
      
      const customerPayload: Partial<FinanceCustomer> = {
        name: editCustName,
        phone: editCustPhone || null,
        address: editCustAddress || null,
        aadhaar: editCustAadhaar || null,
        father_husband_name: editCustFatherName || null,
      };

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
        toast.error('Failed to save details. Verify database schemas.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving updates');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedLoan) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const fileObj = new File([file], `doc-${selectedLoan.loan_id}-${Date.now()}-${file.name}`, { type: file.type });
      
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`documents/${fileObj.name}`, fileObj);

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      const docResult = await supabaseFinance.addLoanDocument({
        loan_id: selectedLoan.id,
        category: docType === 'Pledge Document' ? 'Financial' : docType === 'Land Registry Copy' ? 'Original' : 'Registration',
        document_name: docType,
        file_url: publicUrl,
        is_submitted: true
      });

      if (docResult) {
        toast.success('Document uploaded successfully!');
        loadLedgerDetails(selectedLoan.id);
      } else {
        toast.error('Failed to link document in database.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document file');
    } finally {
      setUploadingDoc(false);
    }
  };

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

  // Autocomplete Suggestions logic
  const nameSuggestions = useMemo(() => {
    const q = searchNameQuery.toLowerCase().trim();
    if (!q) return [];
    return loansList.filter(loan => {
      const cust = loan.customer;
      const g1 = loan.guarantor_1;
      const g2 = loan.guarantor_2;
      return (
        loan.loan_id.toLowerCase().includes(q) ||
        (cust?.name && cust.name.toLowerCase().includes(q)) ||
        (cust?.phone && cust.phone.includes(q)) ||
        (cust?.phone2 && cust.phone2.includes(q)) ||
        (cust?.phone_1 && cust.phone_1.includes(q)) ||
        (cust?.phone_2 && cust.phone_2.includes(q)) ||
        (cust?.aadhaar && cust.aadhaar.includes(q)) ||
        (cust?.partner_name && cust.partner_name.toLowerCase().includes(q)) ||
        (g1?.name && g1.name.toLowerCase().includes(q)) ||
        (g1?.phone && g1.phone.includes(q)) ||
        (g1?.aadhaar && g1.aadhaar.includes(q)) ||
        (g2?.name && g2.name.toLowerCase().includes(q)) ||
        (g2?.phone && g2.phone.includes(q)) ||
        (g2?.aadhaar && g2.aadhaar.includes(q)) ||
        (cust?.village && cust.village.toLowerCase().includes(q)) ||
        (cust?.mandal && cust.mandal.toLowerCase().includes(q)) ||
        (cust?.district && cust.district.toLowerCase().includes(q)) ||
        (cust?.aadhaar_village && cust.aadhaar_village.toLowerCase().includes(q)) ||
        (cust?.aadhaar_mandal && cust.aadhaar_mandal.toLowerCase().includes(q)) ||
        (cust?.aadhaar_district && cust.aadhaar_district.toLowerCase().includes(q)) ||
        (cust?.present_village && cust.present_village.toLowerCase().includes(q)) ||
        (cust?.present_mandal && cust.present_mandal.toLowerCase().includes(q)) ||
        (cust?.present_district && cust.present_district.toLowerCase().includes(q))
      );
    });
  }, [loansList, searchNameQuery]);

  const acSuggestions = useMemo(() => {
    const q = searchAcQuery.toLowerCase().trim();
    if (!q) return [];
    return loansList.filter(loan => loan.loan_id.toLowerCase().includes(q));
  }, [loansList, searchAcQuery]);

  // Record Index Navigator Memo
  const currentIndex = useMemo(() => {
    if (!selectedLoan || loansList.length === 0) return -1;
    return loansList.findIndex(l => l.id === selectedLoan.id);
  }, [selectedLoan, loansList]);

  const handlePrevRecord = () => {
    if (currentIndex > 0) {
      loadLedgerDetails(loansList[currentIndex - 1].id);
    }
  };

  const handleNextRecord = () => {
    if (currentIndex < loansList.length - 1) {
      loadLedgerDetails(loansList[currentIndex + 1].id);
    }
  };

  // ===== SINGLE SOURCE OF TRUTH: current principal balance =====
  // Derived from cdLedgerEntries so that renewCalculations, ledgerMetrics,
  // and all UI sections consume the exact same value.
  const currentPrincipalBalance = useMemo(() => {
    if (!selectedLoan) return Number(0);

    // 1. Find original disbursement amount from ledger entries
    const disbursementEntries = cdLedgerEntries.filter(
      (e: any) => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement'
    );
    const originalFromLedger = disbursementEntries.reduce(
      (sum: number, e: any) => sum + Number(e.debit || 0), 0
    );

    // 2. Find total principal paid from ledger entries
    const principalPaidFromLedger = cdLedgerEntries
      .filter((e: any) => {
        const isPrincipalPaid =
          (e.particulars || '').toLowerCase().includes('principal paid') ||
          (e.particulars || '').toLowerCase().includes('principal adjusted') ||
          e.entry_type === 'principal_payment';
        return isPrincipalPaid && Number(e.credit || 0) > 0;
      })
      .reduce((sum: number, e: any) => sum + Number(e.credit || 0), 0);

    // 3. If we found disbursement entries, use ledger-derived value;
    //    otherwise fall back to selectedLoan.amount (for loans without ledger history)
    if (originalFromLedger > 0) {
      return Number(Math.max(0, originalFromLedger - principalPaidFromLedger).toFixed(2));
    }

    // Fallback: use DB amount (already reduced by past payments)
    return Number(selectedLoan.amount);
  }, [selectedLoan, cdLedgerEntries]);

  // Dynamic calculations based on payment date and selected loan
  const renewCalculations = useMemo(() => {
    if (!selectedLoan) return null;

    const entryDate = new Date(selectedLoan.date);
    const today = new Date(paymentDate);

    // Original disbursement date (earliest disbursal entry or loan creation date)
    const disbEntry = [...cdLedgerEntries]
      .filter(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
      .sort((a, b) => startOfDay(a.entry_date) - startOfDay(b.entry_date))[0];
    const originalLoanDateMs: number = disbEntry
      ? startOfDay(disbEntry.entry_date)
      : startOfDay(selectedLoan.date);

    const originalLoanDate = new Date(originalLoanDateMs);

    // Validate: payment date must not be before the original loan disbursement date
    const isDateInvalid = startOfDay(today) < originalLoanDateMs;
    if (isDateInvalid) {
      return {
        isDateInvalid: true,
        daysCount: 0,
        loanDate: originalLoanDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        dueDate: null,
        daysPastDue: 0,
        daysRemaining: 0,
        nextDueDate: null,
        penaltyDays: 0,
        interest: 0,
        penalty: 0,
        principal: currentPrincipalBalance,
        grossInterest: 0,
        grossPenalty: 0,
        dailyInterest: 0,
        dailyPenalty: 0,
        penaltyPaid: 0,
        interestPaid: 0,
        principalPaid: 0
      };
    }

    const periodDays = 30;
    
    // Current Due Date = Loan Date + (Period Days - 1)
    const entryDateStart = new Date(startOfDay(entryDate));
    const dueDate = new Date(entryDateStart.getTime() + (periodDays - 1) * 24 * 60 * 60 * 1000);
    
    // Due Days = Payment Date - Due Date (Clamped to 0)
    const rawDueDays = Math.round((startOfDay(today) - startOfDay(dueDate)) / (1000 * 60 * 60 * 24));
    const dueDays = Math.max(0, rawDueDays);
    const daysRemaining = rawDueDays < 0 ? Math.abs(rawDueDays) : 0;
    
    const interestRate = Number(selectedLoan.interest_rate) || 3;
    const principalBalance = currentPrincipalBalance;

    // Interest = principal × rate × dueDays ÷ 30 ÷ 100 (0 if dueDays <= 0)
    // Penalty  = principal × 0.75% × penalty_days ÷ 30 (Starts only after 5 grace days, penalty_days = max(0, dueDays - 5))
    const grossInterest = dueDays <= 0 ? 0 : Number(((principalBalance * interestRate * dueDays) / 30 / 100).toFixed(2));
    const penaltyDays = Math.max(0, dueDays - 5);
    const grossPenalty  = penaltyDays <= 0 ? 0 : Number(((principalBalance * 0.75 * penaltyDays) / 30 / 100).toFixed(2));

    // Daily interest / renewal day value:
    // Always compute base daily interest rate for renewedDays calculation.
    const baseDailyInterest = Number((principalBalance * interestRate / 100 / 30).toFixed(5));
    let dailyInterest = baseDailyInterest;
    let dailyPenalty = 0;
    if (dueDays > 5) {
      dailyInterest = Number((principalBalance * (interestRate + 0.75) / 100 / 30).toFixed(5));
      dailyPenalty = Number((principalBalance * 0.75 / 100 / 30).toFixed(5));
    }

    // ── BUGFIX: Determine the true current-cycle start from the ledger ──────────
    // selectedLoan.date is updated to the *new* due date after a renewal, which is
    // a future date relative to already-posted payment entries.  Using it directly
    // as the cycle-start filter causes those entries to be excluded → paid = 0,
    // which makes the top card reset interest/penalty to zero after partial payment.
    //
    // Instead we resolve the true cycle boundary from the cdLedgerEntries:
    //   • Find the most recent renewal entry date  → payments AFTER that date
    //     are in the current cycle.
    //   • If no renewal exists, use the original disbursement date → payments
    //     ON OR AFTER that date are in the first cycle.
    const renewalEntries = cdLedgerEntries
      .filter(e =>
        e.entry_type === 'Renewal' || e.entry_type === 'Renew' ||
        (e.particulars || '').toLowerCase().includes('renewal') ||
        (e.particulars || '').toLowerCase().includes('renew') ||
        (e.particulars || '').toLowerCase().includes('partial payment')
      )
      .sort((a, b) => {
        const dateDiff = startOfDay(b.entry_date) - startOfDay(a.entry_date);
        if (dateDiff !== 0) return dateDiff;
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return (b.id && a.id) ? b.id.localeCompare(a.id) : 0;
      });

    const lastRenewalDateMs: number | null = renewalEntries.length > 0
      ? startOfDay(renewalEntries[0].entry_date)
      : null;

    const lastRenewalReceiptNo: string | null = renewalEntries.length > 0
      ? renewalEntries[0].receipt_no
      : null;

    const lastRenewalCreatedAt: string | null = renewalEntries.length > 0
      ? renewalEntries[0].created_at
      : null;

    // Reuses the originalLoanDateMs computed at the top of the memo block

    // Paid amounts for the current cycle:
    //   • On or after the last renewal date (>=) when a prior renewal exists.
    //     Using >= so that payments made on the SAME DAY as the renewal are included,
    //     BUT excluding the payment entries that were part of the renewal/partial transaction itself
    //     to prevent carrying forward historical paid interest/penalty into the next cycle.
    const penaltyPaidInCycle = cdLedgerEntries
      .filter(e => {
        if (e.entry_type !== 'penalty_payment') return false;
        if (lastRenewalReceiptNo && e.receipt_no === lastRenewalReceiptNo) {
          return false;
        }
        if (lastRenewalCreatedAt && e.created_at) {
          return e.created_at > lastRenewalCreatedAt;
        }
        const d = startOfDay(e.entry_date);
        return lastRenewalDateMs !== null ? d >= lastRenewalDateMs : d >= originalLoanDateMs;
      })
      .reduce((sum, e) => sum + Number(e.credit || 0), 0);

    const interestPaidInCycle = cdLedgerEntries
      .filter(e => {
        if (e.entry_type !== 'interest_payment') return false;
        if (lastRenewalReceiptNo && e.receipt_no === lastRenewalReceiptNo) {
          return false;
        }
        if (lastRenewalCreatedAt && e.created_at) {
          return e.created_at > lastRenewalCreatedAt;
        }
        const d = startOfDay(e.entry_date);
        return lastRenewalDateMs !== null ? d >= lastRenewalDateMs : d >= originalLoanDateMs;
      })
      .reduce((sum, e) => sum + Number(e.credit || 0), 0);

    // ── OLD ACCESS VBA: effective gross & pending dues ────────────────────────────
    // grossInterest can be NEGATIVE when loan is not yet due (credit).
    // For payment/outstanding purposes, outstanding = max(0, gross - paid).
    // For DISPLAY purposes, show the raw gross (including negative = credit).
    //
    // When gross is negative but there are payments in cycle, effectiveGross
    // must be at least the paid amount so pending doesn't go negative.
    const effectiveGrossInterest = Math.max(grossInterest, interestPaidInCycle);
    const effectiveGrossPenalty  = Math.max(grossPenalty,  penaltyPaidInCycle);

    // Outstanding dues for PAYMENT purposes (never negative)
    const outstandingInterest = Math.max(0, Number((effectiveGrossInterest - interestPaidInCycle).toFixed(2)));
    const outstandingPenalty  = Math.max(0, Number((effectiveGrossPenalty  - penaltyPaidInCycle).toFixed(2)));

    // Display interest/penalty: show the raw formula value (never negative)
    const displayInterest = dueDays <= 0 ? 0 : outstandingInterest;
    const displayPenalty  = dueDays <= 0 ? 0 : outstandingPenalty;

    return {
      isDateInvalid: false,
      daysCount: dueDays,
      loanDate: entryDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      dueDate: dueDate,
      daysPastDue: dueDays,            // raw due days (can be negative)
      daysRemaining,                    // absolute days remaining (when not yet due)
      nextDueDate: null,                // Computed dynamically based on renewedDays
      penaltyDays: dueDays <= 5 ? 0 : dueDays,
      interest: displayInterest,        // for display: negative when credit, pending when overdue
      penalty: displayPenalty,          // for display: 0 when not due, pending when overdue
      outstandingInterest,              // for payments: always >= 0
      outstandingPenalty,               // for payments: always >= 0
      principal: principalBalance,
      grossInterest,                    // raw formula result (can be negative)
      grossPenalty,                     // raw formula result (0 if dueDays <= 5)
      effectiveGrossInterest,           // max(grossInterest, paid) — always >= paid
      effectiveGrossPenalty,            // max(grossPenalty, paid) — always >= paid
      dailyInterest,
      dailyPenalty,
      baseDailyInterest,               // pure interest daily rate (no penalty component)
      penaltyPaid: penaltyPaidInCycle,
      interestPaid: interestPaidInCycle,
      principalPaid: 0
    };
  }, [selectedLoan, paymentDate, cdLedgerEntries, currentPrincipalBalance]);

  // Date Formatter helper (returns format e.g. 07-Mar-26)
  const formatDateOld = (dateStr: string | Date | number | null | undefined) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yy = String(d.getFullYear()).slice(-2);
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}-${months[d.getMonth()]}-${yy}`;
  };

  // Statement ledger builder containing native logs + fallbacks (interest, document charges etc.)
  const displayedStatementEntries = useMemo(() => {
    if (!selectedLoan || !renewCalculations) return [];
    
    const list: any[] = [];
    const sortedDbEntries = [...cdLedgerEntries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    
    // Find original loan start date
    const disb = sortedDbEntries.find(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement');
    const originalLoanStart = startOfDay(disb ? disb.entry_date : selectedLoan.date);
    
    // Find all renewal dates
    const cycleEnds = sortedDbEntries
      .filter(e => 
        e.entry_type === 'Renewal' || 
        e.entry_type === 'Renew' || 
        (e.particulars || '').toLowerCase().includes('renewal') || 
        (e.particulars || '').toLowerCase().includes('renew')
      )
      .map(e => startOfDay(e.entry_date));
    
    const uniqueCycleEnds = Array.from(new Set(cycleEnds)).sort((a, b) => a - b);
    
    // Build the list of cycles
    const cycles: { start: number; end: number; isCurrent: boolean }[] = [];
    let currentStart = originalLoanStart;
    for (const end of uniqueCycleEnds) {
      if (end > currentStart) {
        cycles.push({ start: currentStart, end, isCurrent: false });
        currentStart = end;
      }
    }
    cycles.push({ start: currentStart, end: startOfDay(paymentDate), isCurrent: true });

    // Step-by-step simulation of cycles to determine running principal and split payments
    const principalPaidTotalDb = sortedDbEntries
      .filter(e => {
        const isPrincipalPaid = (e.particulars || '').toLowerCase().includes('principal paid') || 
                                (e.particulars || '').toLowerCase().includes('principal adjusted') ||
                                e.entry_type === 'principal_payment';
        return e.account_name === 'CD A/C' && isPrincipalPaid;
      })
      .reduce((sum, e) => sum + Number(e.credit || 0), 0);
    
    const originalAmount = Number(selectedLoan.amount) + principalPaidTotalDb;
    let runningPrincipal = originalAmount;

    // Let's first add the Disbursement row
    const hasDisbursement = sortedDbEntries.some(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement');
    if (!hasDisbursement) {
      list.push({
        id: `fallback-disb-${selectedLoan.id}`,
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD A/C',
        entry_date: selectedLoan.date,
        credit: 0,
        debit: originalAmount,
        receipt_no: '-',
        particulars: 'Original Loan Disbursement',
        user_name: 'System',
        entry_type: 'original_loan'
      });
    }

    // Check if we have CD Commission opening row in the DB.
    // IMPORTANT: check by entry_type, not by account name — interest_payment rows also use CD COMMISSION A/C.
    const hasCommission = sortedDbEntries.some(e =>
      e.entry_type === 'opening_commission' || e.entry_type === 'Commission'
    );
    if (!hasCommission) {
      // Fallback: derive from disbursement debit (the true original principal, never changes)
      const disbEntry = sortedDbEntries.find(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement');
      const P = disbEntry ? Number(disbEntry.debit) : originalAmount;
      const R = Number(selectedLoan.interest_rate) || 3;
      const D = 30; // CD commission is always 1 month (30 days)
      const commAmount = Number(((P * (R / 100) * D) / 30).toFixed(2));

      list.push({
        id: `fallback-comm-${selectedLoan.id}`,
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD COMMISSION A/C',
        entry_date: disbEntry ? disbEntry.entry_date : selectedLoan.date,
        credit: commAmount,
        debit: 0,
        receipt_no: '-',
        particulars: 'Opening CD Commission Charged',
        user_name: 'System',
        entry_type: 'opening_commission'
      });
    }

    // Check if we have CD Document Charges row
    const docChargesVal = Number(selectedLoan.document_charges) || 0;
    const hasDocCharges = sortedDbEntries.some(e =>
      (e.account_name || '').toLowerCase() === 'cd document charges a/c' ||
      e.entry_type === 'document_charge'
    );
    if (!hasDocCharges && docChargesVal > 0) {
      list.push({
        id: `fallback-doc-${selectedLoan.id}`,
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD DOCUMENT CHARGES A/C',
        credit: docChargesVal,
        debit: 0,
        receipt_no: '-',
        particulars: 'Document Charges Collected',
        user_name: 'System',
        entry_type: 'document_charge',
        entry_date: selectedLoan.date
      });
    }

    // Process each cycle
    cycles.forEach((cycle) => {
      // Find all payments inside this cycle
      const cyclePayments = sortedDbEntries.filter(entry => {
        const isNonPaymentEntry =
          entry.entry_type === 'original_loan' || entry.entry_type === 'Disbursement' ||
          entry.entry_type === 'Document Charges' || entry.entry_type === 'document_charge' ||
          entry.entry_type === 'Commission' || entry.entry_type === 'opening_commission';
        if (isNonPaymentEntry) {
          return false;
        }
        const isPayment = entry.credit > 0 &&
                          !isNonPaymentEntry &&
                          !entry.id.toString().startsWith('fallback-comm-') &&
                          !entry.id.toString().startsWith('fallback-doc-');
        if (!isPayment) return false;
        
        const d = startOfDay(entry.entry_date);
        
        const isFirstCycle = cycle.start === originalLoanStart;
        if (isFirstCycle) {
          return d >= cycle.start && d <= cycle.end;
        } else {
          return d > cycle.start && d <= cycle.end;
        }
      });

      // Dues calculation for this cycle
      const periodDays = 30;
      const cycleDueDate = new Date(cycle.start + (periodDays - 1) * 24 * 60 * 60 * 1000);
      const cycleDueDays = Math.max(0, Math.round((cycle.end - startOfDay(cycleDueDate)) / (1000 * 60 * 60 * 24)));
      
      const interestRate = Number(selectedLoan.interest_rate) || 3;
      
      const cycleGrossInterest = cycleDueDays <= 0 ? 0 : Number(((runningPrincipal * interestRate * cycleDueDays) / 30 / 100).toFixed(2));
      const cycleGrossPenalty = cycleDueDays <= 0 ? 0 : Number(((runningPrincipal * 0.75 * cycleDueDays) / 30 / 100).toFixed(2));

      // Check if some payments inside this cycle are ALREADY split
      const alreadySplitSum = cyclePayments.filter(e => {
        const isPrincipalPaid = (e.particulars || '').toLowerCase().includes('principal paid') || 
                                (e.particulars || '').toLowerCase().includes('principal adjusted') ||
                                e.entry_type === 'principal_payment';
        const isAlreadySplit = ['penalty a/c', 'cd commission a/c'].includes((e.account_name || '').toLowerCase()) || 
                               e.entry_type === 'penalty_payment' ||
                               e.entry_type === 'interest_payment' ||
                               e.entry_type === 'principal_payment' ||
                               ((e.account_name || '').toLowerCase() === 'cd a/c' && isPrincipalPaid);
        return isAlreadySplit;
      }).reduce((sum, e) => sum + Number(e.credit), 0);

      let accumulatedPayments = alreadySplitSum;

      // Now map each payment entry in the cycle
      cyclePayments.forEach(entry => {
        const isPrincipalPaid = (entry.particulars || '').toLowerCase().includes('principal paid') || 
                               (entry.particulars || '').toLowerCase().includes('principal adjusted') ||
                               entry.entry_type === 'principal_payment';
        const isAlreadySplit = ['penalty a/c', 'cd commission a/c'].includes((entry.account_name || '').toLowerCase()) || 
                               entry.entry_type === 'penalty_payment' ||
                               entry.entry_type === 'interest_payment' ||
                               entry.entry_type === 'principal_payment' ||
                               ((entry.account_name || '').toLowerCase() === 'cd a/c' && isPrincipalPaid);

        if (isAlreadySplit) {
          list.push({ ...entry, account_name: entry.account_name || 'CD A/C' });
          if (((entry.account_name || '').toLowerCase() === 'cd a/c' && isPrincipalPaid) || entry.entry_type === 'principal_payment') {
            runningPrincipal -= Number(entry.credit);
          }
          return;
        }

        const isRenewal = entry.entry_type === 'Renewal' || entry.entry_type === 'Renew' || 
                          (entry.particulars || '').toLowerCase().includes('renewal') || 
                          (entry.particulars || '').toLowerCase().includes('renew');
        const isCloseAction = entry.entry_type === 'Close' || entry.entry_type === 'Settlement';
        const actionType = isCloseAction ? 'Close' : (isRenewal ? 'Renew' : 'Partial');
        const creditAmt = Number(entry.credit || 0);

        const monthlyInterestVal = Number((runningPrincipal * interestRate / 100).toFixed(2));

        const oldSplit = financeCalculationService.computeCDPaymentSplit(
          accumulatedPayments,
          cycleGrossPenalty,
          cycleGrossInterest,
          monthlyInterestVal,
          runningPrincipal,
          actionType
        );
        const newSplit = financeCalculationService.computeCDPaymentSplit(
          accumulatedPayments + creditAmt,
          cycleGrossPenalty,
          cycleGrossInterest,
          monthlyInterestVal,
          runningPrincipal,
          actionType
        );

        const pPaid = Number((newSplit.penaltyPaid - oldSplit.penaltyPaid).toFixed(2));
        const iPaid = Number((newSplit.interestPaid - oldSplit.interestPaid).toFixed(2));
        const prPaid = Number((newSplit.principalPaid - oldSplit.principalPaid).toFixed(2));

        accumulatedPayments += creditAmt;
        runningPrincipal -= prPaid;

        const actionText = actionType === 'Renew'
          ? 'Renewal Completed'
          : (actionType === 'Close' ? 'Close' : 'Partial Payment');
        const rNum = entry.receipt_no ? ` - ${entry.receipt_no}` : '';

        if (pPaid > 0) {
          list.push({
            ...entry,
            id: `${entry.id}-penalty`,
            account_name: 'PENALTY A/C',
            credit: pPaid,
            particulars: `Penalty Paid - ${actionText}${rNum}`
          });
        }
        if (iPaid > 0) {
          list.push({
            ...entry,
            id: `${entry.id}-interest`,
            account_name: 'CD COMMISSION A/C',
            credit: iPaid,
            particulars: `Interest Paid - ${actionText}${rNum}`
          });
        }
        if (prPaid > 0) {
          list.push({
            ...entry,
            id: `${entry.id}-principal`,
            account_name: 'CD A/C',
            credit: prPaid,
            particulars: `Principal Adjusted - ${actionText}${rNum}`
          });
        }
      });
    });

    // Pushes non-payment database entries directly (opening rows that are immutable)
    sortedDbEntries.forEach(entry => {
      const isNonPayment =
        entry.entry_type === 'original_loan' || entry.entry_type === 'Disbursement' ||
        entry.entry_type === 'Document Charges' || entry.entry_type === 'document_charge' ||
        entry.entry_type === 'Commission' || entry.entry_type === 'opening_commission' ||
        entry.entry_type === 'NPA_CLOSE' || entry.entry_type === 'NPA_CLOSED';
      if (isNonPayment) {
        list.push({ ...entry, account_name: entry.account_name || 'CD A/C' });
      }
    });

    return list.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }, [selectedLoan, cdLedgerEntries, paymentDate]);

  // Original Loan Amount calculations
  const originalLoanAmount = useMemo(() => {
    if (!selectedLoan) return 0;
    return displayedStatementEntries
      .filter(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
      .reduce((sum, e) => sum + Number(e.debit), 0) || Number(selectedLoan.amount);
  }, [selectedLoan, displayedStatementEntries]);

  const originalLoanDate = useMemo(() => {
    if (!selectedLoan) return null;
    const disb = displayedStatementEntries.find(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement');
    return disb ? disb.entry_date : selectedLoan.date;
  }, [displayedStatementEntries, selectedLoan]);

  // Principal Paid calculations
  const principalPaidTotal = useMemo(() => {
    return displayedStatementEntries
      .filter(e => 
        e.entry_type === 'principal_payment' ||
        (e.particulars || '').toLowerCase().includes('principal paid') || 
        (e.particulars || '').toLowerCase().includes('principal adjusted')
      )
      .reduce((sum, e) => sum + Number(e.credit), 0);
  }, [displayedStatementEntries]);

  // Interest Details builder
  const displayedInterestDetails = useMemo(() => {
    const list: any[] = [];
    if (!selectedLoan) return list;
    
    displayedStatementEntries.forEach(entry => {
      const isInterestOrPenalty = ['penalty a/c', 'cd commission a/c'].includes((entry.account_name || '').toLowerCase());
      if (isInterestOrPenalty && entry.credit > 0 && entry.entry_type !== 'opening_commission' && entry.entry_type !== 'Commission' && !entry.id.toString().startsWith('fallback-comm-')) {
        const isRenewalInterest = entry.particulars?.toLowerCase().includes('renew') && entry.account_name === 'CD COMMISSION A/C';
        list.push({
          id: `int-detail-${entry.id}`,
          loan_id: entry.loan_id,
          entry_id: entry.id,
          entry_date: entry.entry_date,
          credit: entry.credit,
          receipt_no: entry.receipt_no,
          particulars: entry.particulars,
          renewed_days: isRenewalInterest ? 30 : 0,
          renewed_till_date: isRenewalInterest 
            ? (() => {
                const dateObj = new Date(new Date(entry.entry_date).getTime() + 30 * 24 * 60 * 60 * 1000);
                const tzoffset = dateObj.getTimezoneOffset() * 60000;
                return new Date(dateObj.getTime() - tzoffset).toISOString().split('T')[0];
              })()
            : null,
          row_type: entry.account_name === 'PENALTY A/C' ? 'Penalty Paid' : 'Interest Paid',
          created_at: entry.created_at || entry.entry_date
        });
      }
    });

    cdInterestDetails.forEach(detail => {
      if ((detail.particulars || '').toLowerCase().includes('note:')) {
        list.push(detail);
      }
    });

    return list.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }, [displayedStatementEntries, cdInterestDetails, selectedLoan]);

  // Shared single source of truth calculations
  const ledgerMetrics = useMemo(() => {
    if (!selectedLoan || !renewCalculations) {
      return {
        originalPrincipal: 0,
        principalPaid: 0,
        principalBalance: 0,
        grossInterestDue: 0,
        grossPenaltyDue: 0,
        paidInterest: 0,
        paidPenalty: 0,
        pendingInterest: 0,
        pendingPenalty: 0,
        renewalDue: 0,
        currentTotalDues: 0,
        currentPaidDues: 0,
        currentPendingDues: 0,
        totalToRegularize: 0,
        totalClose: 0,
        totalCredit: 0,
        totalDebit: 0
      };
    }

    const originalPrincipal = originalLoanAmount;
    const principalPaid = principalPaidTotal;
    const principalBalance = Number((originalPrincipal - principalPaid).toFixed(2));

    const grossInterestDue = renewCalculations.effectiveGrossInterest || 0;
    const grossPenaltyDue = renewCalculations.effectiveGrossPenalty || 0;

    const paidInterest = renewCalculations.interestPaid || 0;
    const paidPenalty = renewCalculations.penaltyPaid || 0;

    // Display values (can be negative when loan is not yet due)
    const pendingInterest = renewCalculations.interest || 0;
    const pendingPenalty = renewCalculations.penalty || 0;


    // Outstanding values for payment purposes (always >= 0)

    const interestRate = Number(selectedLoan.interest_rate) || 3;
    const renewalDue = Number((principalBalance * interestRate / 100).toFixed(2));

    const outstandingInterest = renewCalculations.outstandingInterest || 0;
    const outstandingPenalty = renewCalculations.outstandingPenalty || 0;
    const totalDue = outstandingInterest + outstandingPenalty;

    // Total To Regularize = total_due + total_for_renewal
    // Where:
    //   total_due = outstanding_interest + outstanding_penalty
    //   total_for_renewal = renewalDue
    const totalToRegularize = Number((totalDue + renewalDue).toFixed(2));

    // Footer metrics synchronized with calculations and card values
    const currentTotalDues = (renewCalculations.daysPastDue || 0) <= 0
      ? 0
      : Number((grossInterestDue + grossPenaltyDue).toFixed(2));
    const currentPaidDues = (renewCalculations.daysPastDue || 0) <= 0
      ? 0
      : Number((paidInterest + paidPenalty).toFixed(2));
    const currentPendingDues = Math.max(0, Number((currentTotalDues - currentPaidDues).toFixed(2)));

    // Close Amount = Principal + Interest + Penalty (only when interest and penalty are non-negative)
    const totalClose = Number((principalBalance + Math.max(0, pendingInterest) + Math.max(0, pendingPenalty)).toFixed(2));

    // totalCredit = only real cash collected (interest, penalty, principal payments)
    // Must NOT include opening_commission or document_charge rows (not real collections)
    const NON_COLLECTION_TYPES = new Set(['original_loan', 'Disbursement', 'opening_commission', 'Commission', 'Document Charges', 'document_charge']);
    const totalCredit = displayedStatementEntries
      .filter(e => !NON_COLLECTION_TYPES.has(e.entry_type) && Number(e.credit) > 0)
      .reduce((sum, e) => sum + Number(e.credit || 0), 0);

    const totalDebit = displayedStatementEntries
      .filter(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
      .reduce((sum, e) => sum + Number(e.debit || 0), 0);

    return {
      originalPrincipal,
      principalPaid,
      principalBalance,
      grossInterestDue,
      grossPenaltyDue,
      paidInterest,
      paidPenalty,
      pendingInterest,
      pendingPenalty,
      renewalDue,
      currentTotalDues,
      currentPaidDues,
      currentPendingDues,
      totalToRegularize,
      totalClose,
      totalCredit,
      totalDebit
    };
  }, [selectedLoan, renewCalculations, originalLoanAmount, principalPaidTotal, displayedInterestDetails, displayedStatementEntries]);

  // Calculation bottom totals
  const bottomTotals = useMemo(() => {
    const totalCredit = displayedStatementEntries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
    const totalDebit = displayedStatementEntries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
    return {
      totalCredit,
      totalDebit,
      presentBalance: ledgerMetrics.principalBalance,
      totalDues: ledgerMetrics.currentTotalDues,
      paidDues: ledgerMetrics.currentPaidDues,
      pendingDues: ledgerMetrics.currentPendingDues
    };
  }, [displayedStatementEntries, ledgerMetrics]);

  // Payment preview calculation — priority allocation: Penalty → Interest → Principal
  const paymentPreview = useMemo(() => {
    const paymentAmount = Number(totalAmountPaying) || 0;
    if (paymentAmount <= 0 || !renewCalculations) return null;

    const principalBefore = ledgerMetrics.principalBalance;
    const outstandingPenalty = renewCalculations.outstandingPenalty || 0;
    const outstandingInterest = renewCalculations.outstandingInterest || 0;

    const interestRate = Number(selectedLoan?.interest_rate) || 3;
    const monthlyInterest = Number((principalBefore * interestRate / 100).toFixed(2));

    const isClosingPayment = paymentAmount >= Math.max(0, ledgerMetrics.totalClose);

    // Calculate Renew Option (Option 1)
    let renewPenaltyPaid = 0;
    let renewInterestPaid = 0;
    let renewPrincipalPaid = 0;
    let renewRenewedDays = 0;
    let renewNextDueDate: Date | null = null;

    if (isClosingPayment) {
      renewPenaltyPaid = outstandingPenalty;
      renewInterestPaid = outstandingInterest;
      renewPrincipalPaid = Number(Math.max(0, paymentAmount - renewPenaltyPaid - renewInterestPaid).toFixed(2));
      renewRenewedDays = 0;
      renewNextDueDate = null;
    } else {
      const split = financeCalculationService.computeCDPaymentSplit(
        paymentAmount,
        outstandingPenalty,
        outstandingInterest,
        monthlyInterest,
        principalBefore,
        'Renew'
      );
      renewPenaltyPaid = split.penaltyPaid;
      renewInterestPaid = split.interestPaid;
      renewPrincipalPaid = split.principalPaid;
      const baseDateMs = Math.max(startOfDay(renewCalculations?.dueDate || paymentDate), startOfDay(paymentDate));
      if (monthlyInterest > 0) {
        const renewalInterestPaid = Math.max(0, renewInterestPaid - outstandingInterest);
        renewRenewedDays = Math.max(0, Math.round((renewalInterestPaid / monthlyInterest) * 30));
      }
      if (renewRenewedDays <= 0) {
        renewRenewedDays = 30;
      }
      renewNextDueDate = new Date(baseDateMs + renewRenewedDays * 24 * 60 * 60 * 1000);
    }

    // Calculate Partial Option (Option 2)
    let partialPenaltyPaid = 0;
    let partialInterestPaid = 0;
    let partialPrincipalPaid = 0;
    let partialRenewedDays = 0;
    let partialNextDueDate: Date | null = null;

    if (isClosingPayment) {
      partialPenaltyPaid = outstandingPenalty;
      partialInterestPaid = outstandingInterest;
      partialPrincipalPaid = Number(Math.max(0, paymentAmount - partialPenaltyPaid - partialInterestPaid).toFixed(2));
      partialRenewedDays = 0;
      partialNextDueDate = null;
    } else {
      const split = financeCalculationService.computeCDPaymentSplit(
        paymentAmount,
        outstandingPenalty,
        outstandingInterest,
        monthlyInterest,
        principalBefore,
        'Partial'
      );
      partialPenaltyPaid = split.penaltyPaid;
      partialInterestPaid = split.interestPaid;
      partialPrincipalPaid = split.principalPaid;
      const baseDateMs = Math.max(startOfDay(renewCalculations?.dueDate || paymentDate), startOfDay(paymentDate));
      const totalToRegularize = Number((outstandingPenalty + outstandingInterest + monthlyInterest).toFixed(2));
      if (paymentAmount >= totalToRegularize) {
        partialRenewedDays = 30;
      } else {
        partialRenewedDays = 0;
      }
      if (partialRenewedDays > 0) {
        partialNextDueDate = new Date(baseDateMs + partialRenewedDays * 24 * 60 * 60 * 1000);
      }
    }

    const renewDetails = {
      penaltyPaid: renewPenaltyPaid,
      interestPaid: renewInterestPaid,
      principalPaid: renewPrincipalPaid,
      principalAfter: Number(Math.max(0, principalBefore - renewPrincipalPaid).toFixed(2)),
      renewedDays: renewRenewedDays,
      nextDueDate: renewNextDueDate
    };

    const partialDetails = {
      penaltyPaid: partialPenaltyPaid,
      interestPaid: partialInterestPaid,
      principalPaid: partialPrincipalPaid,
      principalAfter: Number(Math.max(0, principalBefore - partialPrincipalPaid).toFixed(2)),
      renewedDays: partialRenewedDays,
      nextDueDate: partialNextDueDate
    };

    return {
      paymentAmount,
      isClosingPayment,
      renew: renewDetails,
      partial: partialDetails
    };
  }, [totalAmountPaying, ledgerMetrics, renewCalculations, selectedLoan, paymentDate]);

  // Aggregated Loan Documents & Fingerprint display metadata
  const aggregatedDocs = useMemo(() => {
    const list: any[] = [];

    loanDocuments.forEach(doc => {
      list.push({
        id: doc.id,
        source: 'loan_doc',
        category: doc.category || 'Loan Doc',
        name: doc.document_name || 'Document',
        remarks: doc.remarks || 'N/A',
        fileUrl: doc.file_url,
        returnedStatus: documentReturned ? 'Returned' : 'Not Returned',
        allowDelete: true
      });
    });

    if (collateralLog) {
      list.push({
        id: 'collateral-metadata',
        source: 'collateral',
        category: 'Collateral',
        name: 'Collateral Assets Details',
        remarks: `Address: ${collateralLog.collateral_address || 'N/A'}, particulars: ${collateralLog.particulars || 'N/A'}`,
        fileUrl: null,
        returnedStatus: documentReturned ? 'Returned' : 'Not Returned',
        allowDelete: false
      });

      if (collateralLog.collateral_image) {
        list.push({
          id: 'collateral-image',
          source: 'collateral',
          category: 'Collateral',
          name: 'Collateral Asset Image',
          remarks: `GPS: ${collateralLog.gps_latitude || 'N/A'}, ${collateralLog.gps_longitude || 'N/A'}`,
          fileUrl: collateralLog.collateral_image,
          returnedStatus: documentReturned ? 'Returned' : 'Not Returned',
          allowDelete: false
        });
      }
    }

    if (selectedLoan?.customer) {
      if (selectedLoan.customer.customer_photo_url) {
        list.push({
          id: 'customer-photo',
          source: 'customer',
          category: 'Registration',
          name: 'Customer Photo',
          remarks: `Aadhaar: ${selectedLoan.customer.aadhaar || 'N/A'}`,
          fileUrl: selectedLoan.customer.customer_photo_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
      if (selectedLoan.customer.customer_fingerprint_image_url || selectedLoan.customer.fingerprint_url) {
        list.push({
          id: 'customer-fingerprint',
          source: 'customer',
          category: 'Registration',
          name: 'Customer Fingerprint',
          remarks: selectedLoan.customer.fingerprint_template ? 'Template Captured' : 'Image Captured',
          fileUrl: selectedLoan.customer.customer_fingerprint_image_url || selectedLoan.customer.fingerprint_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
    }

    if (guarantor1) {
      if (guarantor1.customer_photo_url) {
        list.push({
          id: 'guarantor1-photo',
          source: 'customer',
          category: 'Registration',
          name: 'Guarantor 1 Photo',
          remarks: `Aadhaar: ${guarantor1.aadhaar || 'N/A'}`,
          fileUrl: guarantor1.customer_photo_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
      if (guarantor1.customer_fingerprint_image_url || guarantor1.fingerprint_url) {
        list.push({
          id: 'guarantor1-fingerprint',
          source: 'customer',
          category: 'Registration',
          name: 'Guarantor 1 Fingerprint',
          remarks: guarantor1.fingerprint_template ? 'Template Captured' : 'Image Captured',
          fileUrl: guarantor1.customer_fingerprint_image_url || guarantor1.fingerprint_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
    }

    if (guarantor2) {
      if (guarantor2.customer_photo_url) {
        list.push({
          id: 'guarantor2-photo',
          source: 'customer',
          category: 'Registration',
          name: 'Guarantor 2 Photo',
          remarks: `Aadhaar: ${guarantor2.aadhaar || 'N/A'}`,
          fileUrl: guarantor2.customer_photo_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
      if (guarantor2.customer_fingerprint_image_url || guarantor2.fingerprint_url) {
        list.push({
          id: 'guarantor2-fingerprint',
          source: 'customer',
          category: 'Registration',
          name: 'Guarantor 2 Fingerprint',
          remarks: guarantor2.fingerprint_template ? 'Template Captured' : 'Image Captured',
          fileUrl: guarantor2.customer_fingerprint_image_url || guarantor2.fingerprint_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
    }

    return list;
  }, [loanDocuments, collateralLog, documentReturned, selectedLoan, guarantor1, guarantor2]);

  // Handle payments renewals and closures (Access VBA logic)
  const handleActionSubmit = async (actionType: 'Renew' | 'Partial' | 'Close') => {
    if (isRenewing) return;
    if (!selectedLoan || !renewCalculations) return;
    
    // Block if payment date is before loan date
    if (renewCalculations.isDateInvalid) {
      toast.error('Payment date cannot be before loan date.');
      return;
    }
    
    const amount = Number(totalAmountPaying) || 0;
    if (actionType !== 'Close' && (amount <= 0 || isNaN(amount))) {
      toast.error('Enter a valid payment amount.');
      return;
    }

    const dueDays = renewCalculations.daysPastDue || 0;

    
    setIsRenewing(true);
    try {
      // Snapshot variables before saving
      const principalBefore = ledgerMetrics.principalBalance;
      const paymentAmount = Number(amount.toFixed(2));

      // ===== PRIORITY ALLOCATION: Penalty → Interest → Principal =====
      let penaltyPaid = 0;
      let interestPaid = 0;
      let principalPaid = 0;
      let renewedDays = 0;

      // Use OUTSTANDING (always >= 0) for payment allocation, not display values
      const outstandingPenalty = renewCalculations.outstandingPenalty || 0;
      const outstandingInterest = renewCalculations.outstandingInterest || 0;

      const interestRate = Number(selectedLoan?.interest_rate) || 3;
      const monthlyInterest = Number((principalBefore * interestRate / 100).toFixed(2));

      const isClosingPayment = actionType === 'Close' || paymentAmount >= Math.max(0, ledgerMetrics.totalClose);

      if (isClosingPayment) {
        // Close: clear all remaining dues, excess reduces principal
        penaltyPaid   = outstandingPenalty;
        interestPaid  = outstandingInterest;
        principalPaid = Number(Math.max(0, paymentAmount - penaltyPaid - interestPaid).toFixed(2));
        renewedDays   = 0;
      } else {
        const split = financeCalculationService.computeCDPaymentSplit(
          paymentAmount,
          outstandingPenalty,
          outstandingInterest,
          monthlyInterest,
          principalBefore,
          actionType
        );
        penaltyPaid   = split.penaltyPaid;
        interestPaid  = split.interestPaid;
        principalPaid = split.principalPaid;
        
        if (actionType === 'Partial') {
          const totalToRegularize = Number((outstandingPenalty + outstandingInterest + monthlyInterest).toFixed(2));
          renewedDays = paymentAmount >= totalToRegularize ? 30 : 0;
        } else {
          if (monthlyInterest > 0) {
            const renewalInterestPaid = Math.max(0, interestPaid - outstandingInterest);
            renewedDays = Math.max(0, Math.round((renewalInterestPaid / monthlyInterest) * 30));
          }
          if (renewedDays <= 0) {
            renewedDays = 30;
          }
        }
      }

      // Console logs for debugging
      console.log('=== Priority Payment Split ===');
      console.log('receiptNo:', receiptNo);
      console.log('paymentAmount:', paymentAmount);
      console.log('dueDays:', dueDays);
      console.log('renewedDays:', renewedDays);
      console.log('penaltyPaid:', penaltyPaid);
      console.log('interestPaid:', interestPaid);
      console.log('principalPaid:', principalPaid);
      console.log('principalBefore:', principalBefore);
      console.log('principalAfter:', Number((principalBefore - principalPaid).toFixed(2)));
      
      const res = await supabaseFinance.postCdLedgerPayment({
        loanId: selectedLoan.id,
        customerId: selectedLoan.customer_id,
        accountName: selectedLoan.customer?.name || null,
        userName: user?.username || 'Staff',
        actionType,
        principalPaid,
        interestPaid,
        penaltyPaid,
        renewedDays,
        paymentDate,
        receiptNo
      });
      
      if (!res.success) {
        throw new Error(res.error || 'Failed to post ledger entries');
      }
      
      const totalForClose = ledgerMetrics.totalClose;

      if (actionType === 'Close' || paymentAmount >= totalForClose) {
        const { error: closeError } = await supabase.from('finance_loans').update({ 
          status: 'Closed',
          amount: Math.max(0, Number((principalBefore - principalPaid).toFixed(2)))
        }).eq('id', selectedLoan.id);
        if (closeError) throw closeError;
      } else {
        const updates: any = {};
        
        // For renewal/partial: set loan date based on next_due_date = base_date + renewed_days
        // Loan start date = next_due_date - (periodDays - 1)
        const periodDays = 30; // Strictly 30 days cycle length for CD
        if (actionType === 'Renew') {
          updates.date = paymentDate;
        } else if (renewedDays > 0) {
          const baseDateMs = Math.max(startOfDay(renewCalculations?.dueDate || paymentDate), startOfDay(paymentDate));
          const nextDueDate = new Date(baseDateMs + renewedDays * 24 * 60 * 60 * 1000);
          
          console.log('=== RENEWAL DUE DATE ADVANCEMENT DEBUG ===');
          console.log('old_current_due_date:', renewCalculations.dueDate);
          console.log('payment_date:', paymentDate);
          console.log('base_date:', new Date(baseDateMs));
          console.log('interest_paid:', interestPaid);
          console.log('monthly_interest:', monthlyInterest);
          console.log('renewed_days:', renewedDays);
          console.log('next_due_date:', nextDueDate);

          const newCycleStart = new Date(nextDueDate.getTime() - (periodDays - 1) * 24 * 60 * 60 * 1000);
          const tzoffset = newCycleStart.getTimezoneOffset() * 60000;
          updates.date = new Date(newCycleStart.getTime() - tzoffset).toISOString().split('T')[0];
          
          console.log('new_loan_date (updates.date):', updates.date);
        }
        
        if (principalPaid > 0) {
          updates.amount = Math.max(0, Number((principalBefore - principalPaid).toFixed(2)));
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase.from('finance_loans').update(updates).eq('id', selectedLoan.id);
          if (updateError) throw updateError;
        }
      }
      
      setTotalAmountPaying('');
      await fetchLedgerData();
      await loadLedgerDetails(selectedLoan.id);

      if (actionType === 'Close' || paymentAmount >= totalForClose) {
        toast.success('Account closed successfully');
      } else {
        toast.success(`Payment applied — ${renewedDays} days renewed`);
      }
    } catch(e: any) {
      console.error(e);
      toast.error(e?.message || 'Error applying payment');
    } finally {
      setIsRenewing(false);
    }
  };

  const handleNPACloseSubmit = async () => {
    if (!selectedLoan) return;
    setIsNpaClosing(true);
    try {
      const npaClosedDate = new Date(paymentDate).toISOString();
      const npaClosedAmount = 0;
      const closedBy = user?.username || 'Staff';
      const npaReceiptNo = await supabaseFinance.getNextReceiptNumber();
      
      const updatedRemarks = `${selectedLoan.remarks || ''}\n[NPA CLOSED at ${npaClosedDate} by ${closedBy} with settlement amount: ${npaClosedAmount}]`.trim();
      
      const { error: loanError } = await supabase.from('finance_loans')
        .update({ 
          status: 'NPA_CLOSED', 
          npa_closed: true, 
          amount: selectedLoan.amount,
          remarks: updatedRemarks
        })
        .eq('id', selectedLoan.id);
      if (loanError) throw loanError;

      const principal_balance = ledgerMetrics.principalBalance;
      const interest_due = ledgerMetrics.pendingInterest;
      const penalty_due = ledgerMetrics.pendingPenalty;
      const total_outstanding = principal_balance + interest_due + penalty_due;
      const principalPaidTotal = 0;

      await supabaseFinance.addNPARecord({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        customer_name: selectedLoan.customer?.name || '',
        aadhaar: selectedLoan.customer?.aadhaar || '',
        phone: selectedLoan.customer?.phone || '',
        loan_type: selectedLoan.loan_category || 'CD',
        loan_amount: Number(selectedLoan.amount),
        paid_amount: principalPaidTotal,
        balance_amount: principal_balance,
        interest_due: interest_due,
        penalty_due: penalty_due,
        settlement_amount: npaClosedAmount,
        reason: npaReason,
        closed_by: closedBy,
        closed_at: npaClosedDate
      });

      const npaParticulars = `NPA CLOSE\n` +
        `Principal Outstanding: ₹${principal_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `Interest Outstanding: ₹${interest_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `Penalty Outstanding: ₹${penalty_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `Total Outstanding: ₹${total_outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `Closed By: ${closedBy}\n` +
        `Reason: ${npaReason}`;

      await supabaseFinance.addCDLedgerEntry({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD A/C',
        entry_date: npaClosedDate,
        credit: 0,
        debit: 0,
        receipt_no: npaReceiptNo,
        particulars: npaParticulars,
        user_name: closedBy,
        entry_type: 'NPA_CLOSE'
      });

      await fetchLedgerData();
      await loadLedgerDetails(selectedLoan.id);
      toast.success('NPA Account closed and settlement recorded.');
      setShowNpaModal(false);
    } catch(e) {
      console.error(e);
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

      const docReceiptNo = await supabaseFinance.getNextReceiptNumber();

      const { error: docError } = await supabase.from('finance_documents_returned').insert({
        loan_id: selectedLoan.id,
        returned_date: returnDate,
        returned_to: returnedTo,
        received_by_signature: signatureUrl,
        remarks: returnRemarks,
        created_by: user?.username || 'Staff',
        receipt_no: docReceiptNo
      });
      if (docError) throw docError;

      await supabaseFinance.addCDLedgerEntry({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD A/C',
        entry_date: returnDate,
        credit: 0,
        debit: 0,
        receipt_no: docReceiptNo,
        particulars: `Documents Returned to ${returnedTo} - ${returnRemarks}`,
        user_name: user?.username || 'Staff',
        entry_type: 'Settlement'
      });

      await loadLedgerDetails(selectedLoan.id);
      toast.success('Documents returned successfully.');
      setShowReturnDocModal(false);
    } catch(e) {
      console.error(e);
      toast.error('Error recording document return');
    } finally {
      setIsReturningDoc(false);
    }
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (!selectedLoan) {
      toast.error('No ledger data is currently loaded to export');
      return;
    }

    const exportData = displayedStatementEntries.map((tx: any) => ({
      Date: formatDateOld(tx.entry_date),
      Account: tx.account_name || 'CD A/C',
      Credit: tx.credit,
      Debit: tx.debit,
      Particulars: tx.particulars || '',
      User: tx.user_name || '',
      'Receipt No': tx.receipt_no || '-'
    }));

    const filename = `${selectedLoan.loan_id}_CD_Ledger_${new Date().toISOString().split('T')[0]}`;

    if (format === 'xlsx') {
      const res = exportToExcel(exportData, filename, 'Transactions');
      if (res.success) toast.success('Excel ledger exported successfully');
    } else {
      const res = exportToCSV(exportData, filename);
      if (res.success) toast.success('CSV ledger exported successfully');
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full border border-red-200">
          <ShieldAlert className="w-16 h-16 text-red-600 animate-pulse" />
        </div>
        <h1 className="finance-h1">Access Restricted</h1>
        <p className="text-gray-500 max-w-md">
          Only authorized personnel are allowed to view the CD Ledger. Please consult your administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-6 p-6 max-w-7xl mx-auto ${showPrintPreview ? 'print:hidden' : 'print:p-0'}`}>
        
        {/* Top row: unified search and metadata header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm print:hidden">
          
          {/* Top Left: Today's date and navigation */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="finance-caption uppercase block mb-1">Today's Date / Payment Date</label>
              <input 
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={selectedLoan?.status === 'Closed' || selectedLoan?.status === 'NPA_CLOSED'}
                className={`bg-white border rounded-xl p-2 text-gray-800 focus:ring-2 focus:outline-none finance-input h-[42px] ${renewCalculations?.isDateInvalid ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-green-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            </div>
            
            <button
              onClick={() => navigate('/finance/stbd-ledger')}
              className="px-4 h-[42px] text-green-700 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors font-semibold text-sm flex items-center self-end"
            >
              Goto STBD Ledger
            </button>
          </div>

          {/* Top Middle: Dynamic user name & real-time clock */}
          <div className="flex flex-col text-center border-l border-r border-gray-150 px-6 py-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              User: <span className="text-green-700 font-bold">{(user as any)?.name || user?.username || 'RAMESH'}</span>
            </span>
            <span className="text-xs text-gray-400 font-mono mt-0.5">{timeStr}</span>
          </div>

          {/* Top Right: Autocomplete Name Search and Account Dropdowns */}
          <div className="flex flex-1 max-w-lg gap-3">
            {/* Name autocomplete */}
            <div className="relative flex-1">
              <label className="finance-caption uppercase block mb-1">Name Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchNameQuery !== '' ? searchNameQuery : (selectedLoan?.customer?.name || '')}
                  onChange={(e) => {
                    setSearchNameQuery(e.target.value);
                    setShowNameDropdown(true);
                  }}
                  onFocus={() => setShowNameDropdown(true)}
                  onBlur={() => setTimeout(() => setShowNameDropdown(false), 250)}
                  placeholder="Search name..."
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none h-[42px]"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
              
              {showNameDropdown && nameSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {nameSuggestions.map(loan => (
                    <button
                      key={loan.id}
                      onMouseDown={() => {
                        loadLedgerDetails(loan.id);
                        setSearchNameQuery('');
                        setShowNameDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm text-gray-750 font-medium border-b border-gray-50 last:border-0"
                    >
                      <div className="font-semibold text-gray-900">{loan.customer?.name}</div>
                      <div className="text-[10px] text-gray-500 flex justify-between">
                        <span>A/C: {loan.loan_id}</span>
                        <span>Phone: {loan.customer?.phone}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* A/C selector */}
            <div className="relative w-40">
              <label className="finance-caption uppercase block mb-1">A/C Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchAcQuery !== '' ? searchAcQuery : (selectedLoan?.loan_id || '')}
                  onChange={(e) => {
                    setSearchAcQuery(e.target.value);
                    setShowAcDropdown(true);
                  }}
                  onFocus={() => setShowAcDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAcDropdown(false), 250)}
                  placeholder="Search A/C..."
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none h-[42px]"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
              
              {showAcDropdown && acSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {acSuggestions.map(loan => (
                    <button
                      key={loan.id}
                      onMouseDown={() => {
                        loadLedgerDetails(loan.id);
                        setSearchAcQuery('');
                        setShowAcDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm text-gray-750 font-medium border-b border-gray-50 last:border-0"
                    >
                      <div className="font-semibold text-gray-900">A/C: {loan.loan_id}</div>
                      <div className="text-[10px] text-gray-500 flex justify-between">
                        <span>Name: {loan.customer?.name}</span>
                        <span>Phone: {loan.customer?.phone}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
            <p className="text-gray-500 finance-section-heading">Compiling CD ledger registry...</p>
          </div>
        ) : !selectedLoan ? (
          /* ========== LOAN INDEX / LIST VIEW ========== */
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Index Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <List className="w-5 h-5 text-green-600" />
                  All CD Loans
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{loansList.length} loan(s) in the system</p>
              </div>
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="Search by name, A/C number, or phone..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none focus:bg-white transition-colors"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Loan Table */}
            {(() => {
              const q = listSearchQuery.toLowerCase().trim();
              const filtered = q
                ? loansList.filter(loan =>
                    loan.loan_id.toLowerCase().includes(q) ||
                    (loan.customer?.name || '').toLowerCase().includes(q) ||
                    (loan.customer?.phone || '').includes(q) ||
                    (loan.customer?.aadhaar || '').includes(q)
                  )
                : loansList;

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-sm">
                      {loansList.length === 0
                        ? 'No CD loans found in the system.'
                        : `No loans match "${listSearchQuery}"`}
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">A/C Number</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Name</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Loan Amount</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate %</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((loan, idx) => (
                        <tr
                          key={loan.id}
                          className="hover:bg-green-50/50 cursor-pointer transition-colors group"
                          onClick={() => {
                            loadLedgerDetails(loan.id);
                            setListSearchQuery('');
                          }}
                        >
                          <td className="px-6 py-3.5 text-gray-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-6 py-3.5 font-bold text-green-700 font-mono">{loan.loan_id}</td>
                          <td className="px-6 py-3.5 font-semibold text-gray-900">{loan.customer?.name || 'N/A'}</td>
                          <td className="px-6 py-3.5 text-gray-600 font-mono">{loan.customer?.phone || '-'}</td>
                          <td className="px-6 py-3.5 font-semibold text-gray-800">₹{Number(loan.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-3.5 text-gray-600">{loan.interest_rate}%</td>
                          <td className="px-6 py-3.5 text-gray-500 text-xs">{loan.date ? new Date(loan.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}</td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              loan.status === 'Active' ? 'bg-green-100 text-green-700'
                              : loan.status === 'Closed' ? 'bg-gray-100 text-gray-500'
                              : loan.status === 'NPA_CLOSED' ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {(loan.status || 'Active').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="text-green-600 text-xs font-semibold group-hover:underline">Open →</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Unified Operator Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Customer Details & Record Navigator */}
              <div className="space-y-6">
                <Card 
                  title="Customer Details" 
                  subtitle="Primary borrower card information"
                  className="shadow-sm border-gray-100 rounded-3xl"
                  headerActions={
                    <Button 
                      onClick={isEditing ? handleSaveDetails : handleToggleEdit} 
                      variant={isEditing ? "success" : "secondary"}
                      size="xs"
                      icon={isEditing ? Save : Edit2}
                      disabled={savingDetails || selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'}
                    >
                      {isEditing ? 'Save' : 'Edit'}
                    </Button>
                  }
                >
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                          <Input label="Borrower Name" value={editCustName} onChange={setEditCustName} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Input label="S/o W/o" value={editCustFatherName} onChange={setEditCustFatherName} />
                        </div>
                        <div className="col-span-2">
                          <Input label="Borrower Address" value={editCustAddress} onChange={setEditCustAddress} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Input label="Phone No 1" value={editCustPhone} onChange={setEditCustPhone} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Input label="Phone No 2" value={editCustPhone2} onChange={setEditCustPhone2} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Input label="Aadhaar" value={editCustAadhaar} onChange={setEditCustAadhaar} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Input label="Partner" value={editCustPartnerName} onChange={setEditCustPartnerName} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-gray-700">
                        <div className="col-span-1 border-b pb-1.5">
                          <span className="text-gray-400 font-medium block text-xs">Name:</span>
                          <span className="font-semibold text-gray-900">{selectedLoan.customer?.name}</span>
                        </div>
                        <div className="col-span-1 border-b pb-1.5">
                          <span className="text-gray-400 font-medium block text-xs">S/o / W/o:</span>
                          <span className="font-medium text-gray-800">{selectedLoan.customer?.father_husband_name || 'N/A'}</span>
                        </div>
                        <div className="col-span-2 border-b pb-1.5">
                          <span className="text-gray-400 font-medium block text-xs">Address:</span>
                          <span className="font-medium text-gray-800 text-xs leading-relaxed">{selectedLoan.customer?.address || 'N/A'}</span>
                        </div>
                        <div className="col-span-1 border-b pb-1.5">
                          <span className="text-gray-400 font-medium block text-xs">Phone No 1:</span>
                          <span className="font-semibold text-gray-800">{selectedLoan.customer?.phone || 'N/A'}</span>
                        </div>
                        <div className="col-span-1 border-b pb-1.5">
                          <span className="text-gray-400 font-medium block text-xs">Phone No 2:</span>
                          <span className="font-medium text-gray-800">{selectedLoan.customer?.phone2 || 'N/A'}</span>
                        </div>
                        <div className="col-span-1 border-b pb-1.5">
                          <span className="text-gray-400 font-medium block text-xs">Aadhaar:</span>
                          <span className="font-medium text-gray-850 font-mono">{selectedLoan.customer?.aadhaar || 'N/A'}</span>
                        </div>
                        <div className="col-span-1 border-b pb-1.5">
                          <span className="text-gray-400 font-medium block text-xs">Partner:</span>
                          <span className="font-medium text-gray-850">{selectedLoan.customer?.partner_name || 'N/A'}</span>
                        </div>
                        <div className="col-span-1 border-b pb-1.5">
                          <span className="text-gray-400 font-medium block text-xs">Account Status:</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            selectedLoan.status === 'Active' ? 'bg-green-100 text-green-700'
                            : selectedLoan.status === 'Closed' ? 'bg-gray-100 text-gray-500'
                            : selectedLoan.status === 'NPA_CLOSED' ? 'bg-orange-100 text-orange-700'
                            : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {(selectedLoan.status || 'Active').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Record selector/navigator at the bottom */}
                  <div className="border-t border-gray-150 pt-4 mt-6 flex items-center justify-between">
                    <button
                      onClick={() => { setSelectedLoan(null); setListSearchQuery(''); }}
                      className="flex items-center gap-1.5 text-xs text-green-700 font-semibold hover:text-green-800 hover:underline transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to All Loans
                    </button>
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                      Record: <span className="text-gray-700">{currentIndex + 1}</span> of <span className="text-gray-700">{loansList.length}</span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handlePrevRecord}
                        disabled={currentIndex <= 0}
                        className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={handleNextRecord}
                        disabled={currentIndex >= loansList.length - 1}
                        className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Middle Column: Calculation / Action Panel */}
              <div className="space-y-6">
                <Card 
                  title="Operator Action & Calculations" 
                  subtitle="Configure transactions and calculations details"
                  className="shadow-sm border-gray-100 rounded-3xl"
                >
                  {renewCalculations?.isDateInvalid ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-750 font-semibold mb-6">
                      <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
                      <span>Payment date cannot be before loan date ({renewCalculations.loanDate}).</span>
                    </div>
                  ) : null}

                  {/* Calculation variables display */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {/* Row 1: Receipt No & Total Amount Paying */}
                    <Input label="Receipt No" value={receiptNo} readOnly className="bg-gray-50 text-gray-700 font-mono" />
                    <Input 
                      label="Total Amount Paying" 
                      value={totalAmountPaying} 
                      onChange={setTotalAmountPaying} 
                      className="font-bold text-green-700" 
                      placeholder="Enter ₹" 
                      type="text"
                      inputMode="decimal"
                      disabled={selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'}
                    />
                    
                    {/* Row 2: Loan Amount & Rate % */}
                    <Input label="Loan Amount" value={originalLoanAmount.toLocaleString('en-IN')} readOnly className="bg-gray-50 text-gray-700 font-mono" />
                    <Input label="Rate %" value={Number(selectedLoan.interest_rate).toFixed(2)} readOnly className="bg-gray-50 text-gray-700" />
                    
                    {/* Row 3: Original Loan Date & Last Payment Date */}
                    <Input label="Original Loan Date" value={formatDateOld(originalLoanDate)} readOnly className="bg-gray-50 text-gray-700" />
                    <Input label="Last Payment Date" value={formatDateOld(selectedLoan.date)} readOnly className="bg-gray-50 text-gray-700" />
                    
                    {/* Row 4: Current Due Date & Next Due Date */}
                    <Input label="Current Due Date" value={formatDateOld(renewCalculations?.dueDate)} readOnly className="bg-gray-50 text-gray-700" />
                    <Input label="Next Due Date" value={totalAmountPaying && Number(totalAmountPaying) > 0 && paymentPreview?.renew?.nextDueDate ? formatDateOld(paymentPreview.renew.nextDueDate) : ''} readOnly className="bg-gray-50 text-gray-700" />
                    
                    {/* Row 5: Due Days & Interest */}
                    <div>
                      <Input 
                        label="Due Days" 
                        value={renewCalculations?.daysPastDue !== undefined ? renewCalculations.daysPastDue : 0} 
                        readOnly 
                        className="bg-gray-50 text-gray-700" 
                      />
                      {renewCalculations && renewCalculations.daysRemaining !== undefined && renewCalculations.daysRemaining > 0 && (
                        <div className="text-[10px] text-green-650 font-bold uppercase mt-1 px-1">
                          Days Remaining = {renewCalculations.daysRemaining}
                        </div>
                      )}
                    </div>
                    <Input 
                      label="Interest" 
                      value={ledgerMetrics.pendingInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                      readOnly 
                      className="bg-gray-50 text-gray-700 font-mono" 
                      style={ledgerMetrics.pendingInterest < 0 ? { color: '#059669', fontWeight: 'bold' } : undefined}
                    />

                    {/* Row 6: Penalty & Total Balance / Principal */}
                    <Input label="Penalty" value={ledgerMetrics.pendingPenalty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly className="bg-gray-50 text-gray-700 font-mono" />
                    <Input label="Total Balance / Principal" value={ledgerMetrics.principalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly className="bg-gray-50 text-gray-700 font-mono" />

                    {/* Row 7: Amount Paid & Document Status */}
                    <Input label="Amount Paid" value={principalPaidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly className="bg-gray-50 text-gray-700 font-mono" />
                    <Input label="Document Status" value={documentReturned ? 'Documents Returned' : 'Submitted'} readOnly className="bg-gray-50 text-gray-700 font-medium" />
                  </div>

                  {/* Payment Split Preview Panel */}
                  {paymentPreview && (
                    <div className="bg-green-50/50 border border-green-100 rounded-2xl p-4 mb-6 space-y-4">
                      {paymentPreview.isClosingPayment ? (
                        <div>
                          <h4 className="text-xs text-green-800 font-bold uppercase tracking-wider mb-2">Account Closure Preview</h4>
                          <div className="space-y-1.5 text-sm font-mono bg-white/50 p-3 rounded-xl border border-green-100">
                            <div className="flex justify-between text-gray-655 border-b border-green-100/50 pb-1.5">
                              <span>Account Status:</span>
                              <span className="font-bold text-red-650">Will Close</span>
                            </div>
                            <div className="flex justify-between text-gray-655 border-b border-green-100/50 pb-1.5">
                              <span>Penalty Paid:</span>
                              <span className="font-bold text-red-650">₹{paymentPreview.renew.penaltyPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-gray-655 border-b border-green-100/50 pb-1.5">
                              <span>Interest Paid:</span>
                              <span className="font-bold text-orange-600">₹{paymentPreview.renew.interestPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-gray-655 border-b border-green-100/50 pb-1.5">
                              <span>Principal Paid:</span>
                              <span className="font-bold text-blue-650">₹{paymentPreview.renew.principalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-gray-700 pt-0.5">
                              <span>Remaining Bal:</span>
                              <span className="font-bold text-gray-900">₹{paymentPreview.renew.principalAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <h4 className="text-xs text-green-800 font-bold uppercase tracking-wider border-b border-green-200 pb-1">Payment Options Preview</h4>
                          
                          {/* Option 1: Renewal Account */}
                          <div>
                            <span className="text-xs font-bold text-green-700 uppercase block mb-1">Option 1: Renewal Account</span>
                            <div className="space-y-1.5 text-sm font-mono bg-white/50 p-3 rounded-xl border border-green-100">
                              <div className="flex justify-between text-gray-655">
                                <span>Penalty Paid:</span>
                                <span className="font-bold text-red-650">₹{paymentPreview.renew.penaltyPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-gray-655">
                                <span>Interest Paid:</span>
                                <span className="font-bold text-orange-600">₹{paymentPreview.renew.interestPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-gray-655">
                                <span>Principal Paid:</span>
                                <span className="font-bold text-gray-400">₹0.00</span>
                              </div>
                              <div className="flex justify-between text-gray-655 border-t border-green-100/50 pt-1.5 mt-1">
                                <span>Renewed Days:</span>
                                <span className="font-bold text-green-700">{paymentPreview.renew.renewedDays} days</span>
                              </div>
                              <div className="flex justify-between text-gray-655">
                                <span>Next Due Date:</span>
                                <span className="font-bold text-green-700">{paymentPreview.renew.nextDueDate ? formatDateOld(paymentPreview.renew.nextDueDate) : '-'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Option 2: Partial Payment */}
                          <div>
                            <span className="text-xs font-bold text-blue-700 uppercase block mb-1">Option 2: Partial Payment and Renewal</span>
                            <div className="space-y-1.5 text-sm font-mono bg-white/50 p-3 rounded-xl border border-blue-100">
                              <div className="flex justify-between text-gray-655">
                                <span>Penalty Paid:</span>
                                <span className="font-bold text-red-650">₹{paymentPreview.partial.penaltyPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-gray-655">
                                <span>Interest Paid:</span>
                                <span className="font-bold text-orange-600">₹{paymentPreview.partial.interestPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-gray-655">
                                <span>Principal Paid:</span>
                                <span className="font-bold text-blue-650">₹{paymentPreview.partial.principalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-gray-655 border-t border-blue-100/50 pt-1.5 mt-1">
                                <span>Renewed Days:</span>
                                <span className="font-bold text-green-700">{paymentPreview.partial.renewedDays} days</span>
                              </div>
                              <div className="flex justify-between text-gray-655">
                                <span>Next Due Date:</span>
                                <span className="font-bold text-green-700">{paymentPreview.partial.nextDueDate ? formatDateOld(paymentPreview.partial.nextDueDate) : '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Actions buttons */}
                  <div className="grid grid-cols-1 gap-2.5">
                    <Button
                      onClick={() => handleActionSubmit('Renew')}
                      disabled={
                        isRenewing || 
                        selectedLoan.status === 'Closed' || 
                        selectedLoan.status === 'NPA_CLOSED' || 
                        !!renewCalculations?.isDateInvalid ||
                        !totalAmountPaying || 
                        Number(totalAmountPaying) <= 0
                      }
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 border-0"
                    >
                      <CreditCard className="w-4 h-4" />
                      Renewal Account
                    </Button>
                    
                    <Button
                      onClick={() => handleActionSubmit('Partial')}
                      disabled={
                        isRenewing || 
                        !totalAmountPaying || 
                        Number(totalAmountPaying) <= 0 ||
                        Number(totalAmountPaying) <= (ledgerMetrics.totalToRegularize || 0) ||
                        selectedLoan.status === 'Closed' || 
                        selectedLoan.status === 'NPA_CLOSED' || 
                        !!renewCalculations?.isDateInvalid
                      }
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 border-0"
                    >
                      <CreditCard className="w-4 h-4" />
                      Partial Payment and Renewal
                    </Button>
                    
                    <Button
                      onClick={() => handleActionSubmit('Close')}
                      disabled={
                        isRenewing || 
                        selectedLoan.status === 'Closed' || 
                        selectedLoan.status === 'NPA_CLOSED' || 
                        !(
                          ledgerMetrics.principalBalance <= 0 && 
                          ((renewCalculations?.outstandingInterest || 0) + (renewCalculations?.outstandingPenalty || 0)) <= 0
                        ) ||
                        !!renewCalculations?.isDateInvalid
                      }
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-3 font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 border-0"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Close Account
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Right Column: Amount summaries, Guarantors, Photos */}
              <div className="space-y-6">
                
                {/* Visual Highlight Amount Summary (Matches Screenshot Colors in Modern Theme) */}
                <div className="bg-rose-50/40 border border-rose-100 rounded-3xl p-5 grid grid-cols-2 gap-4 shadow-sm">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Amount</span>
                    <span className="text-lg font-bold text-gray-900 font-mono">₹{ledgerMetrics.principalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Interest</span>
                    <span className={`text-lg font-bold font-mono ${ledgerMetrics.pendingInterest < 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      ₹{ledgerMetrics.pendingInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Penalty</span>
                    <span className="text-lg font-bold text-red-650 font-mono">₹{ledgerMetrics.pendingPenalty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Total Due</span>
                    <span className={`text-lg font-bold font-mono ${(ledgerMetrics.pendingInterest + ledgerMetrics.pendingPenalty) < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      ₹{(ledgerMetrics.pendingInterest + ledgerMetrics.pendingPenalty).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  <div className="border-t border-rose-100 pt-3 col-span-2 flex justify-between items-center">
                    <span className="text-rose-800 text-[10px] uppercase font-black tracking-wider">Total for Renewal</span>
                    <span className="text-xl font-black font-mono text-rose-700">
                      ₹{ledgerMetrics.renewalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="border-t border-rose-100 pt-3 col-span-2 flex justify-between items-center">
                    <span className="text-rose-800 text-[10px] uppercase font-black tracking-wider">Total to Regularize</span>
                    <span className="text-xl font-black font-mono text-rose-700">
                      ₹{ledgerMetrics.totalToRegularize.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  <div className="bg-rose-100/60 border border-rose-200 rounded-2xl p-3 col-span-2 flex justify-between items-center">
                    <span className="text-rose-900 text-xs uppercase font-black tracking-wider">Total for Close</span>
                    <span className="text-2xl font-black text-rose-950 font-mono">
                      ₹{ledgerMetrics.totalClose.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Guarantor Profile Info */}
                <Card 
                  title="Guarantors & Documents" 
                  className="shadow-sm border-gray-100 rounded-3xl"
                  headerActions={
                    <Button
                      onClick={() => setShowReturnDocModal(true)}
                      disabled={(selectedLoan.status !== 'Closed' && selectedLoan.status !== 'NPA_CLOSED') || !!renewCalculations?.isDateInvalid}
                      variant="primary"
                      size="xs"
                      className="bg-green-600 hover:bg-green-700 border-0"
                    >
                      Document Returned
                    </Button>
                  }
                >
                  <div className="space-y-4 text-xs text-gray-700">
                    <div>
                      <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Guarantor 1:</h4>
                      <div className="grid grid-cols-2 gap-y-1">
                        <span className="text-gray-400 font-medium">Name:</span>
                        <span className="font-semibold text-gray-950 text-right">{guarantor1?.name || 'N/A'}</span>
                        <span className="text-gray-400 font-medium">Phone No:</span>
                        <span className="font-medium text-gray-800 text-right">{guarantor1?.phone || 'N/A'}</span>
                        <span className="text-gray-400 font-medium">Aadhaar:</span>
                        <span className="font-medium text-gray-800 font-mono text-right">{guarantor1?.aadhaar || 'N/A'}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-800 border-b pb-1 mb-2">Guarantor 2:</h4>
                      <div className="grid grid-cols-2 gap-y-1">
                        <span className="text-gray-400 font-medium">Name:</span>
                        <span className="font-semibold text-gray-950 text-right">{guarantor2?.name || 'N/A'}</span>
                        <span className="text-gray-400 font-medium">Phone No:</span>
                        <span className="font-medium text-gray-800 text-right">{guarantor2?.phone || 'N/A'}</span>
                        <span className="text-gray-400 font-medium">Aadhaar:</span>
                        <span className="font-medium text-gray-800 font-mono text-right">{guarantor2?.aadhaar || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3 flex justify-between">
                      <span className="text-gray-400 font-medium uppercase tracking-wider">Document Type:</span>
                      <span className="font-medium text-gray-800 text-right max-w-[160px] truncate" title={loanDocuments.map(d => d.document_name).join(', ')}>
                        {loanDocuments.map(d => d.document_name).join(', ') || 'N/A'}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Photos Panel */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-100 rounded-3xl p-3 shadow-sm text-center">
                    <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-2">Loan Person</span>
                    <div className="aspect-[3/4] rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center">
                      {selectedLoan.customer?.customer_photo_url ? (
                        <img src={selectedLoan.customer.customer_photo_url} alt="Loan Person" className="w-full h-full object-cover" />
                      ) : selectedLoan.customer_photo_url ? (
                        <img src={selectedLoan.customer_photo_url} alt="Loan Person" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-gray-300" />
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-100 rounded-3xl p-3 shadow-sm text-center">
                    <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-2">Surety Person</span>
                    <div className="aspect-[3/4] rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center">
                      {guarantor1?.photo_url ? (
                        <img src={guarantor1.photo_url} alt="Surety Person" className="w-full h-full object-cover" />
                      ) : guarantor1?.customer_photo_url ? (
                        <img src={guarantor1.customer_photo_url} alt="Surety Person" className="w-full h-full object-cover" />
                      ) : selectedLoan.surety_photo_url ? (
                        <img src={selectedLoan.surety_photo_url} alt="Surety Person" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-gray-300" />
                      )}
                    </div>
                  </div>
                </div>

                {/* CD Ledger Documents Details Registry */}
                <Card title="Submitted Files & Media" className="shadow-sm border-gray-100 rounded-3xl max-h-[300px] overflow-y-auto">
                  <div className="space-y-2.5">
                    {/* Document Upload selector */}
                    <div className="flex gap-2 p-2 bg-gray-55 border rounded-xl items-center">
                      <select 
                        value={docType} 
                        onChange={(e) => setDocType(e.target.value)} 
                        disabled={selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'}
                        className="flex-1 text-xs bg-white border border-gray-150 p-1.5 rounded-lg focus:outline-none"
                      >
                        <option value="Pledge Document">Pledge Document</option>
                        <option value="Aadhaar Card Copy">Aadhaar Card Copy</option>
                        <option value="PAN Card Copy">PAN Card Copy</option>
                        <option value="Land Registry Copy">Land Registry Copy</option>
                        <option value="Other Attachment">Other Attachment</option>
                      </select>
                      <label className={`bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none ${
                        (selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED') ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                      }`}>
                        {uploadingDoc ? 'Uploading...' : 'Upload'}
                        <input 
                          type="file" 
                          onChange={handleUploadDocument} 
                          disabled={uploadingDoc || selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {aggregatedDocs.map((doc) => (
                        <div key={doc.id} className="flex justify-between items-center py-2 text-xs">
                          <div className="flex flex-col flex-1 min-w-0 pr-2">
                            <span className="font-semibold text-gray-800 truncate">{doc.name}</span>
                            <span className="text-[10px] text-gray-400 truncate">{doc.remarks}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              doc.returnedStatus === 'Returned' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                            }`}>
                              {doc.returnedStatus}
                            </span>
                            {doc.fileUrl ? (
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-green-700 hover:underline font-bold">
                                View
                              </a>
                            ) : null}
                            {doc.allowDelete ? (
                              <button 
                                onClick={() => handleDeleteDocument(doc.id)} 
                                disabled={selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'}
                                className="text-red-500 hover:text-red-700 font-bold ml-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {aggregatedDocs.length === 0 ? (
                        <p className="text-center text-gray-400 italic py-4">No documents or files found</p>
                      ) : null}
                    </div>
                  </div>
                </Card>

              </div>

            </div>

            {/* Bottom Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Bottom: Details (Borrower Ledger Statement) */}
              <Card 
                title="Borrower Ledger Statement" 
                subtitle="All transactions and collection registry logs"
                className="shadow-sm border-gray-100 rounded-3xl"
              >
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                  <table className="w-full text-xs text-left min-w-[950px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 uppercase tracking-wider text-[10px] font-bold border-b border-gray-100">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">A/C Name</th>
                        <th className="px-4 py-3 text-right">Credit</th>
                        <th className="px-4 py-3 text-right">Debit</th>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Receipt No</th>
                        <th className="px-4 py-3">Particulars</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {displayedStatementEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-700">{formatDateOld(entry.entry_date)}</td>
                          <td className="px-4 py-3 font-bold text-gray-800">{entry.account_name || 'CD A/C'}</td>
                          <td className="px-4 py-3 text-right text-green-700 font-semibold">
                            {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-red-700 font-semibold">
                            {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-medium">{entry.user_name || 'Staff'}</td>
                          <td className="px-4 py-3 font-mono text-gray-600">{entry.receipt_no || '-'}</td>
                          <td className="px-4 py-3 text-gray-500 font-medium font-sans" title={entry.particulars}>{entry.particulars || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Right Bottom: Interest Details */}
              <Card 
                title="Interest & Penalty Details" 
                subtitle="Renewal history and calculated days"
                className="shadow-sm border-gray-100 rounded-3xl"
              >
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                  <table className="w-full text-xs text-left min-w-[950px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 uppercase tracking-wider text-[10px] font-bold border-b border-gray-100">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Credit</th>
                        <th className="px-4 py-3">Receipt No</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Particulars</th>
                        <th className="px-4 py-3 text-center">Days Renewed</th>
                        <th className="px-4 py-3">Renewed Till</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {displayedInterestDetails.map((detail) => (
                        <tr key={detail.id} className="hover:bg-gray-50/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-700">{formatDateOld(detail.entry_date)}</td>
                          <td className="px-4 py-3 text-right text-green-700 font-semibold">
                            ₹{Number(detail.credit).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-650">{detail.receipt_no || '-'}</td>
                          <td className="px-4 py-3 font-medium text-gray-700">{detail.row_type || '-'}</td>
                          <td className="px-4 py-3 text-gray-500 font-medium font-sans" title={detail.particulars}>{detail.particulars || '-'}</td>
                          <td className="px-4 py-3 text-center font-bold text-gray-800">{detail.renewed_days > 0 ? `${detail.renewed_days} Days` : '-'}</td>
                          <td className="px-4 py-3 font-medium text-gray-700">{detail.renewed_till_date ? formatDateOld(detail.renewed_till_date) : '-'}</td>
                        </tr>
                      ))}
                      {displayedInterestDetails.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-450 italic">No interest details found for this loan</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>

            {/* Totals Summary Footer Card & Buttons */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
              
              {/* Bottom statistics display */}
              <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-6 w-full text-center md:text-left">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Credit</span>
                  <span className="text-sm font-bold text-green-700 font-mono">₹{bottomTotals.totalCredit.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Debit</span>
                  <span className="text-sm font-bold text-red-750 font-mono">₹{bottomTotals.totalDebit.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Present Bal.</span>
                  <span className="text-sm font-bold text-orange-700 font-mono">₹{bottomTotals.presentBalance.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Dues</span>
                  <span className="text-sm font-bold text-gray-900 font-mono">₹{bottomTotals.totalDues.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Paid Dues</span>
                  <span className="text-sm font-bold text-emerald-700 font-mono">₹{bottomTotals.paidDues.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Pending Dues</span>
                  <span className="text-sm font-bold text-red-650 font-mono">₹{bottomTotals.pendingDues.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Bottom right report / action buttons */}
              <div className="flex gap-2.5">
                <Button
                  onClick={() => setShowPrintPreview(true)}
                  variant="primary"
                  size="sm"
                  icon={Printer}
                  className="bg-green-600 hover:bg-green-700 border-0 text-white rounded-xl shadow-sm text-xs py-2 px-4"
                >
                  Open Report
                </Button>

                <Button
                  onClick={() => setShowNpaModal(true)}
                  disabled={false}
                  variant="danger"
                  size="sm"
                  icon={ShieldAlert}
                  className="bg-orange-600 hover:bg-orange-700 text-white border-0 rounded-xl shadow-sm text-xs py-2 px-4"
                >
                  NPA Close
                </Button>

                <Button 
                  onClick={handleRefresh} 
                  variant="secondary" 
                  size="sm" 
                  icon={RefreshCw}
                  className="rounded-xl border-gray-200 text-xs py-2 px-4"
                >
                  Refresh
                </Button>
                
                <Button
                  onClick={() => handleExport('xlsx')}
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  className="rounded-xl border-gray-200 text-emerald-700 hover:bg-emerald-50 text-xs py-2 px-4"
                >
                  Excel
                </Button>
              </div>

            </div>
          </>
        )}

      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview && !!selectedLoan && !!renewCalculations}
        onClose={() => setShowPrintPreview(false)}
        title="Print Preview (A4 Friendly Layout)"
        documentTitle="CD Daily Loan Ledger Report Card"
      >
        {selectedLoan && renewCalculations && (
          <div className="space-y-6 text-gray-800 font-sans text-xs">
            <div className="text-center border-b-2 border-double border-gray-300 pb-4">
              <h1 className="text-xl font-black text-gray-900 tracking-wide uppercase">Thirumala Finance Groups</h1>
              <span className="text-xs text-gray-500 uppercase tracking-widest block font-medium">CD Daily Loan Ledger statement</span>
              <div className="flex justify-between items-center text-gray-400 mt-4 font-mono text-[9px]">
                <span>PRINTED: {new Date().toLocaleString('en-IN').replace(/\s/g, '')}</span>
                <span>A/C ID: {selectedLoan.loan_id}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 border-b pb-6">
              <div className="space-y-1.5">
                <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Borrower Details</h4>
                <table className="w-full text-left text-xs leading-loose">
                  <tbody>
                    <tr>
                      <td className="text-gray-400 w-24">Name:</td>
                      <td className="text-gray-900 font-bold">{selectedLoan.customer?.name}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">S/o / W/o:</td>
                      <td className="text-gray-800 font-medium">{selectedLoan.customer?.father_husband_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Phones:</td>
                      <td className="text-gray-800 font-medium">
                        {selectedLoan.customer?.phone || 'N/A'} {selectedLoan.customer?.phone2 ? `, ${selectedLoan.customer.phone2}` : ''}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Aadhaar:</td>
                      <td className="text-gray-800 font-medium">{selectedLoan.customer?.aadhaar || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Partner:</td>
                      <td className="text-gray-800 font-medium">{selectedLoan.customer?.partner_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Address:</td>
                      <td className="text-gray-750 font-medium text-[11px] leading-relaxed">{selectedLoan.customer?.address || 'N/A'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Loan terms</h4>
                <table className="w-full text-left text-xs leading-loose">
                  <tbody>
                    <tr>
                      <td className="text-gray-400 w-28">Original Loan:</td>
                      <td className="text-gray-900 font-bold">₹{originalLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Remaining Bal:</td>
                      <td className="text-gray-900 font-bold">₹{ledgerMetrics.principalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Rate / Penalty:</td>
                      <td className="text-gray-800 font-medium">{selectedLoan.interest_rate || 3}% / {selectedLoan.penalty_percent || 0.75}%</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Present Interest:</td>
                      <td className="text-gray-900 font-bold text-orange-600">₹{ledgerMetrics.pendingInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Present Penalty:</td>
                      <td className="text-gray-900 font-bold text-red-650">₹{ledgerMetrics.pendingPenalty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Loan Date:</td>
                      <td className="text-gray-800 font-medium">{formatDateOld(selectedLoan.date)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guarantors */}
            <div className="border-b pb-6 space-y-2">
              <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Guarantor Profiles</h4>
              <div className="grid grid-cols-2 gap-4">
                {guarantor1 ? (
                  <div>
                    <h5 className="font-bold text-gray-800 mb-1 text-xs">Guarantor 1:</h5>
                    <table className="w-full text-left leading-normal text-xs">
                      <tbody>
                        <tr>
                          <td className="text-gray-400 w-20">Name:</td>
                          <td className="text-gray-900 font-medium">{guarantor1.name}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400">Phone:</td>
                          <td className="text-gray-800 font-medium">{guarantor1.phone}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400">Aadhaar:</td>
                          <td className="text-gray-800 font-medium">{guarantor1.aadhaar}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {guarantor2 ? (
                  <div>
                    <h5 className="font-bold text-gray-800 mb-1 text-xs">Guarantor 2:</h5>
                    <table className="w-full text-left leading-normal text-xs">
                      <tbody>
                        <tr>
                          <td className="text-gray-400 w-20">Name:</td>
                          <td className="text-gray-900 font-medium">{guarantor2.name}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400">Phone:</td>
                          <td className="text-gray-800 font-medium">{guarantor2.phone}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400">Aadhaar:</td>
                          <td className="text-gray-800 font-medium">{guarantor2.aadhaar}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Interest details */}
            <div className="space-y-2">
              <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Interest & Penalty logs</h4>
              <table className="w-full border border-gray-200 text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[9px] font-bold">
                    <th className="p-2 border-r">Date</th>
                    <th className="p-2 border-r text-right">Credit</th>
                    <th className="p-2 border-r">Receipt No</th>
                    <th className="p-2 border-r">Type</th>
                    <th className="p-2 border-r">Particulars</th>
                    <th className="p-2 border-r text-center">Days Renewed</th>
                    <th className="p-2">Renewed Till</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-250 font-mono text-gray-700">
                  {displayedInterestDetails.map((detail) => (
                    <tr key={detail.id}>
                      <td className="p-2 border-r font-sans">{formatDateOld(detail.entry_date)}</td>
                      <td className="p-2 border-r text-right text-green-700 font-semibold">₹{Number(detail.credit).toLocaleString('en-IN')}</td>
                      <td className="p-2 border-r text-gray-500">{detail.receipt_no || '-'}</td>
                      <td className="p-2 border-r font-sans text-gray-700">{detail.row_type || '-'}</td>
                      <td className="p-2 border-r text-gray-500 font-sans">{detail.particulars || '-'}</td>
                      <td className="p-2 border-r text-center font-bold text-gray-800">{detail.renewed_days > 0 ? `${detail.renewed_days} Days` : '-'}</td>
                      <td className="p-2 font-sans">{detail.renewed_till_date ? formatDateOld(detail.renewed_till_date) : '-'}</td>
                    </tr>
                  ))}
                  {displayedInterestDetails.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 font-sans text-gray-400 italic">No details found</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Statement table */}
            <div className="space-y-2">
              <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Statement Ledgers</h4>
              <table className="w-full border border-gray-200 text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[9px] font-bold">
                    <th className="p-2 border-r">Date</th>
                    <th className="p-2 border-r">A/C Name</th>
                    <th className="p-2 border-r text-right">Credit</th>
                    <th className="p-2 border-r text-right">Debit</th>
                    <th className="p-2 border-r">User</th>
                    <th className="p-2 border-r">Receipt No</th>
                    <th className="p-2">Particulars</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-250 font-mono text-gray-700">
                  {displayedStatementEntries.map((tx) => (
                    <tr key={tx.id}>
                      <td className="p-2 border-r font-sans">{formatDateOld(tx.entry_date)}</td>
                      <td className="p-2 border-r font-sans font-bold text-gray-900">{tx.account_name || 'CD A/C'}</td>
                      <td className="p-2 border-r text-right text-green-705 font-bold">{tx.credit > 0 ? `₹${Number(tx.credit).toLocaleString('en-IN')}` : '-'}</td>
                      <td className="p-2 border-r text-right text-red-705 font-bold">{tx.debit > 0 ? `₹${Number(tx.debit).toLocaleString('en-IN')}` : '-'}</td>
                      <td className="p-2 border-r font-sans text-gray-700">{tx.user_name || 'Staff'}</td>
                      <td className="p-2 border-r text-gray-500">{tx.receipt_no || '-'}</td>
                      <td className="p-2 text-gray-500 font-sans">{tx.particulars || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Print Signatures */}
            <div className="pt-20 grid grid-cols-2 gap-20 text-center text-gray-500 text-[10px] font-semibold">
              <div>
                <div className="border-t border-gray-300 pt-1.5 w-32 mx-auto">Borrower Signature</div>
              </div>
              <div>
                <div className="border-t border-gray-300 pt-1.5 w-32 mx-auto">Auditor Signature</div>
              </div>
            </div>

          </div>
        )}
      </FinancePrintPreview>

      {/* NPA Close Account Modal */}
      {showNpaModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl relative">
            <button onClick={() => setShowNpaModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-orange-600" />
              NPA Settlement Close
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 text-orange-850 border border-orange-200 rounded-2xl text-xs leading-relaxed leading-normal">
                <p className="font-semibold mb-1">Confirm NPA Close Action</p>
                <p>Are you sure you want to close this account under NPA? This will mark the loan status as Closed with NPA designation and set the settlement amount to 0.</p>
              </div>
              <div>
                <Input 
                  label="Reason / Remarks" 
                  value={npaReason} 
                  onChange={setNpaReason} 
                  placeholder="Enter reason/remarks for NPA closure"
                  required
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button onClick={() => setShowNpaModal(false)} variant="secondary" className="flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleNPACloseSubmit} variant="danger" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl" disabled={isNpaClosing || !npaReason.trim()}>
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
            <button onClick={() => setShowReturnDocModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
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
                <Input label="Remarks" value={returnRemarks} onChange={setReturnRemarks} />
              </div>
              <div className="pt-4 flex gap-3">
                <Button onClick={() => setShowReturnDocModal(false)} variant="secondary" className="flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleReturnDocSubmit} variant="primary" className="flex-1 bg-blue-600 hover:bg-blue-700 border-0 text-white rounded-xl" disabled={isReturningDoc || !returnedTo.trim()}>
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
