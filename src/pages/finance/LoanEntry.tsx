import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../../components/UI/Input';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinancePartner, FinanceGuarantor } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  User, 
  Calculator, 
  Printer, 
  X, 
  Upload, 
  Trash2, 
  Navigation,
  Check,
  Search,
  Camera
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { BiometricScanner } from '../../components/finance/BiometricScanner';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface DocumentItem {
  key: string;
  label: string;
  category: 'Financial' | 'Original' | 'Registration';
  checked: boolean;
  refNo: string;
  fileUrl: string | null;
  uploading: boolean;
  isCustom?: boolean;
}

const LoanEntry: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Loading/Saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Form State - Basics
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loanCategory, setLoanCategory] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('CD');
  const [loanId, setLoanId] = useState('');

  // Form State - Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [custName, setCustName] = useState('');
  const [custFatherName, setCustFatherName] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPhone2, setCustPhone2] = useState('');
  const [custVillage, setCustVillage] = useState('');
  const [custMandal, setCustMandal] = useState('');
  const [custDistrict, setCustDistrict] = useState('');
  const [custAadhaarAddress, setCustAadhaarAddress] = useState('');
  const [custPresentAddress, setCustPresentAddress] = useState('');
  const [custPhoto, setCustPhoto] = useState<string | null>(null);
  const [custFingerprintUrl, setCustFingerprintUrl] = useState<string | null>(null);
  const [custFingerprintTemplate, setCustFingerprintTemplate] = useState<string | null>(null);
  const [custFingerprintAdded, setCustFingerprintAdded] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);

  // Form State - Guarantor 1
  const [g1SelectedId, setG1SelectedId] = useState('');
  const [g1Name, setG1Name] = useState('');
  const [g1Phone, setG1Phone] = useState('');
  const [g1Aadhaar, setG1Aadhaar] = useState('');
  const [g1Address, setG1Address] = useState('');
  const [g1Photo, setG1Photo] = useState<string | null>(null);
  const [g1FingerprintUrl, setG1FingerprintUrl] = useState<string | null>(null);
  const [g1FingerprintTemplate, setG1FingerprintTemplate] = useState<string | null>(null);
  const [g1FingerprintAdded, setG1FingerprintAdded] = useState(false);
  const [g1Search, setG1Search] = useState('');
  const [g1DropdownOpen, setG1DropdownOpen] = useState(false);

  // Form State - Guarantor 2
  const [g2SelectedId, setG2SelectedId] = useState('');
  const [g2Name, setG2Name] = useState('');
  const [g2Phone, setG2Phone] = useState('');
  const [g2Aadhaar, setG2Aadhaar] = useState('');
  const [g2Address, setG2Address] = useState('');
  const [g2Photo, setG2Photo] = useState<string | null>(null);
  const [g2FingerprintUrl, setG2FingerprintUrl] = useState<string | null>(null);
  const [g2FingerprintTemplate, setG2FingerprintTemplate] = useState<string | null>(null);
  const [g2FingerprintAdded, setG2FingerprintAdded] = useState(false);
  const [g2Search, setG2Search] = useState('');
  const [g2DropdownOpen, setG2DropdownOpen] = useState(false);

  // Reference Data lists
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [guarantors, setGuarantors] = useState<FinanceGuarantor[]>([]);
  const [partners, setPartners] = useState<FinancePartner[]>([]);
  const [activeLoans, setActiveLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);

  // Form State - Loan Terms
  const [amount, setAmount] = useState('');
  const [docCharges, setDocCharges] = useState('');
  const [interestRate, setInterestRate] = useState('3'); // 3% default
  const [durationMonths, setDurationMonths] = useState('');
  const [annualHold, setAnnualHold] = useState('3'); // 3% default
  const [partialPaid, setPartialPaid] = useState('');
  const [dueType, setDueType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [particulars, setParticulars] = useState('');

  // Form State - Partner
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // Refs for closing dropdowns
  const dropdownRef = useRef<HTMLDivElement>(null);
  const g1DropdownRef = useRef<HTMLDivElement>(null);
  const g2DropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCustDropdownOpen(false);
      }
      if (g1DropdownRef.current && !g1DropdownRef.current.contains(e.target as Node)) {
        setG1DropdownOpen(false);
      }
      if (g2DropdownRef.current && !g2DropdownRef.current.contains(e.target as Node)) {
        setG2DropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredCustomersForSelect = useMemo(() => {
    if (!custSearch) return customers.slice(0, 10);
    const q = custSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.customer_id && String(c.customer_id).includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.phone_1 && c.phone_1.includes(q)) ||
      (c.aadhaar && c.aadhaar.includes(q))
    );
  }, [custSearch, customers]);

  const filteredGuarantorsForSelectG1 = useMemo(() => {
    if (!g1Search) return guarantors.slice(0, 10);
    const q = g1Search.toLowerCase();
    return guarantors.filter(g => 
      g.name.toLowerCase().includes(q) ||
      (g.guarantor_id && String(g.guarantor_id).includes(q)) ||
      (g.phone && g.phone.includes(q)) ||
      (g.aadhaar && g.aadhaar.includes(q))
    );
  }, [g1Search, guarantors]);

  const filteredGuarantorsForSelectG2 = useMemo(() => {
    if (!g2Search) return guarantors.slice(0, 10);
    const q = g2Search.toLowerCase();
    return guarantors.filter(g => 
      g.name.toLowerCase().includes(q) ||
      (g.guarantor_id && String(g.guarantor_id).includes(q)) ||
      (g.phone && g.phone.includes(q)) ||
      (g.aadhaar && g.aadhaar.includes(q))
    );
  }, [g2Search, guarantors]);

  // Form State - Documents Checklist
  const [documents, setDocuments] = useState<DocumentItem[]>([
    { key: 'bank_statements', label: 'BANK STATEMENTS', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'income_proof', label: 'INCOME PROOF / ITR', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'passbook_copy', label: 'PASSBOOK COPY', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    
    { key: 'land_title_deed', label: 'LAND TITLE DEED', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'property_tax', label: 'PROPERTY TAX REC', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'vehicle_asset_paper', label: 'VEHICLE / ASSET PAP', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    
    { key: 'joint_registration', label: 'JOINT REGISTRATION', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'agreement_bond', label: 'AGREEMENT / BOND', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'pledge_paper', label: 'PLEDGE PAPER', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
  ]);

  // Form State - Collateral Location
  const [locAddress, setLocAddress] = useState('');
  const [locVillage, setLocVillage] = useState('');
  const [locMandal, setLocMandal] = useState('');
  const [locDistrict, setLocDistrict] = useState('');
  const [locState, setLocState] = useState('');
  const [locPincode, setLocPincode] = useState('');
  const [locLandmark, setLocLandmark] = useState('');
  const [locLatitude, setLocLatitude] = useState('');
  const [locLongitude, setLocLongitude] = useState('');
  const [locMapsLink, setLocMapsLink] = useState('');
  const [collateralImage, setCollateralImage] = useState<string | null>(null);

  // Form State - Remarks & Extra
  const [remarks, setRemarks] = useState('');
  const [extraDetails, setExtraDetails] = useState('');

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    setLoading(true);
    try {
      const custs = await supabaseFinance.getCustomers();
      setCustomers(custs);

      const guars = await supabaseFinance.getGuarantors();
      setGuarantors(guars);

      const prts = await supabaseFinance.getPartners();
      setPartners(prts);

      const loans = await supabaseFinance.getLoans();
      setActiveLoans(loans);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load credit reference registry');
    } finally {
      setLoading(false);
    }
  };

  // Generate Auto sequential Loan ID
  const generateSequentialId = (loansList: any[], category: string) => {
    const prefix = category === 'L' ? 'L' : category;
    const matchingLoans = loansList.filter(l => {
      const lid = (l.loan_id || '').toUpperCase();
      return lid.startsWith(prefix);
    });
    
    let maxNum = 0;
    matchingLoans.forEach(l => {
      const lid = (l.loan_id || '').toUpperCase();
      const suffix = lid.slice(prefix.length);
      const num = parseInt(suffix, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const paddedCount = String(nextNum).padStart(3, '0');
    setLoanId(`${prefix}${paddedCount}`);
  };

  useEffect(() => {
    if (activeLoans.length > 0 || !loading) {
      generateSequentialId(activeLoans, loanCategory);
    }
  }, [loanCategory, activeLoans, loading]);

  // Autofill customer data
  useEffect(() => {
    if (selectedCustomerId) {
      const selected = customers.find(c => c.id === selectedCustomerId);
      if (selected) {
        setCustName(selected.name);
        setCustFatherName(selected.father_name || selected.father_husband_name || '');
        setCustPhone(selected.phone_1 || selected.phone || '');
        setCustPhone2(selected.phone_2 || selected.phone2 || '');
        setCustAadhaar(selected.aadhaar || '');
        setCustPhoto(selected.customer_photo_url || null);
        setCustFingerprintUrl(selected.customer_fingerprint_image_url || selected.fingerprint_url || null);
        setCustFingerprintTemplate(selected.customer_fingerprint_template || selected.fingerprint_template || null);
        setCustFingerprintAdded(!!(selected.customer_fingerprint_added || selected.fingerprint_added));
        
        // Redesign fields
        setCustVillage(selected.village || '');
        setCustMandal(selected.mandal || '');
        setCustDistrict(selected.district || '');
        setCustAadhaarAddress(selected.aadhaar_address || '');
        setCustPresentAddress(selected.present_address || selected.address || '');
        
        if (selected.partner_name) {
          const matchPartner = partners.find(p => p.name === selected.partner_name);
          if (matchPartner) {
            setSelectedPartnerId(matchPartner.id);
            setPartnerName(matchPartner.name);
          } else {
            setPartnerName(selected.partner_name);
          }
        }
      }
    }
  }, [selectedCustomerId, customers, partners]);

  // Autofill guarantor 1 data
  useEffect(() => {
    if (g1SelectedId) {
      const selected = guarantors.find(g => g.id === g1SelectedId);
      if (selected) {
        setG1Name(selected.name);
        setG1Phone(selected.phone || '');
        setG1Aadhaar(selected.aadhaar || '');
        setG1Address(selected.address || '');
        setG1Photo(selected.photo_url || null);
        setG1FingerprintUrl(selected.fingerprint_image_url || null);
        setG1FingerprintTemplate(selected.fingerprint_template || null);
        setG1FingerprintAdded(!!selected.fingerprint_added);
      }
    }
  }, [g1SelectedId, guarantors]);

  // Autofill guarantor 2 data
  useEffect(() => {
    if (g2SelectedId) {
      const selected = guarantors.find(g => g.id === g2SelectedId);
      if (selected) {
        setG2Name(selected.name);
        setG2Phone(selected.phone || '');
        setG2Aadhaar(selected.aadhaar || '');
        setG2Address(selected.address || '');
        setG2Photo(selected.photo_url || null);
        setG2FingerprintUrl(selected.fingerprint_image_url || null);
        setG2FingerprintTemplate(selected.fingerprint_template || null);
        setG2FingerprintAdded(!!selected.fingerprint_added);
      }
    }
  }, [g2SelectedId, guarantors]);

  // Autofill partner name
  useEffect(() => {
    if (selectedPartnerId) {
      const selected = partners.find(p => p.id === selectedPartnerId);
      if (selected) {
        setPartnerName(selected.name);
      }
    } else {
      setPartnerName('');
    }
  }, [selectedPartnerId, partners]);

  // Handle Location Detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    const loadingToast = toast.loading('Retrieving GPS satellite coordinates...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss(loadingToast);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocLatitude(String(lat));
        setLocLongitude(String(lng));
        setLocMapsLink(`https://www.google.com/maps/place/${lat},${lng}`);
        toast.success('Collateral GPS localized successfully!');
      },
      (error) => {
        toast.dismiss(loadingToast);
        console.error(error);
        toast.error('Failed to resolve coordinates: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Upload checklist document to storage
  const handleChecklistUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, uploading: true } : doc));
    
    try {
      const fileObj = new File([file], `doc-${loanId}-${key}-${Date.now()}-${file.name}`, { type: file.type });
      
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`documents/${fileObj.name}`, fileObj);

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, checked: true, fileUrl: publicUrl, uploading: false } : doc));
      toast.success('Document uploaded and attached successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Document upload failed');
      setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, uploading: false } : doc));
    }
  };

  const removeChecklistUpload = (key: string) => {
    setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, fileUrl: null } : doc));
    toast.success('Attachment detached');
  };

  const handleCollateralImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `collateral-${Date.now()}.${fileExt}`;
      const filePath = `collateral/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('finance-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('finance-photos')
        .getPublicUrl(filePath);

      setCollateralImage(data.publicUrl);
      toast.success('Collateral image uploaded successfully');
    } catch (err) {
      console.error('Error uploading collateral image:', err);
      toast.error('Failed to upload collateral image');
    }
  };

  const removeCollateralImage = () => {
    setCollateralImage(null);
  };

  // Live Calculations
  const liveCalculations = useMemo(() => {
    const P = Number(amount);
    const R = Number(interestRate);
    const D = Number(durationMonths);
    const docFees = Number(docCharges) || 0;

    if (isNaN(P) || P <= 0 || isNaN(R) || R < 0 || isNaN(D) || D <= 0) {
      return null;
    }

    const interestAmount = P * (R / 100) * D;
    const totalRepayment = P + interestAmount;

    let duesCount = 0;
    if (dueType === 'Daily') {
      duesCount = D * 30;
    } else if (dueType === 'Weekly') {
      duesCount = Math.round(D * 4.33);
    } else {
      duesCount = D;
    }

    const dueAmount = duesCount > 0 ? (totalRepayment / duesCount) : 0;
    const netDisbursed = P - docFees;

    return {
      principal: P,
      interestAmount: parseFloat(interestAmount.toFixed(2)),
      totalRepayment: parseFloat(totalRepayment.toFixed(2)),
      duesCount,
      dueAmount: parseFloat(dueAmount.toFixed(2)),
      docFees,
      netDisbursed: parseFloat(netDisbursed.toFixed(2))
    };
  }, [amount, interestRate, durationMonths, dueType, docCharges]);

  // Form Reset / Clear
  const handleClearForm = () => {
    if (!window.confirm('Are you sure you want to clear the form? All details will be reset.')) return;
    
    setDate(new Date().toISOString().split('T')[0]);
    setLoanCategory('CD');
    setSelectedCustomerId('');
    setCustName('');
    setCustFatherName('');
    setCustPhone('');
    setCustPhone2('');
    setCustAadhaar('');
    setCustPhoto(null);
    setCustFingerprintUrl(null);
    setCustFingerprintTemplate(null);
    setCustFingerprintAdded(false);
    setCustVillage('');
    setCustMandal('');
    setCustDistrict('');
    setCustAadhaarAddress('');
    setCustPresentAddress('');
    setCustSearch('');
    setCustDropdownOpen(false);

    setG1SelectedId('');
    setG1Name('');
    setG1Phone('');
    setG1Aadhaar('');
    setG1Address('');
    setG1Photo(null);
    setG1FingerprintUrl(null);
    setG1FingerprintTemplate(null);
    setG1FingerprintAdded(false);
    setG1Search('');
    setG1DropdownOpen(false);

    setG2SelectedId('');
    setG2Name('');
    setG2Phone('');
    setG2Aadhaar('');
    setG2Address('');
    setG2Photo(null);
    setG2FingerprintUrl(null);
    setG2FingerprintTemplate(null);
    setG2FingerprintAdded(false);
    setG2Search('');
    setG2DropdownOpen(false);

    setAmount('');
    setDocCharges('');
    setInterestRate('2');
    setDurationMonths('3');
    setDueType('Daily');
    setParticulars('');

    setSelectedPartnerId('');
    setPartnerName('');

    setLocAddress('');
    setLocVillage('');
    setLocMandal('');
    setLocDistrict('');
    setLocState('');
    setLocPincode('');
    setLocLandmark('');
    setLocLatitude('');
    setLocLongitude('');
    setLocMapsLink('');

    setRemarks('');
    setExtraDetails('');

    setDocuments(prev => prev.map(doc => ({ ...doc, checked: false, refNo: '', fileUrl: null })));
    toast.success('Form cleared successfully');
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId.trim()) {
      toast.error('Loan Number is required');
      return;
    }
    if (!custName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!liveCalculations) {
      toast.error('Please enter valid loan terms (Amount, Rate, Duration)');
      return;
    }

    // Validate customer Aadhaar format and duplicate if creating inline
    if (!selectedCustomerId) {
      const cleanAadhaar = custAadhaar.trim();
      if (cleanAadhaar) {
        if (!/^\d{12}$/.test(cleanAadhaar)) {
          toast.error('Aadhaar must be exactly 12 digits.');
          return;
        }

        // Query database directly to check for duplicate Aadhaar
        try {
          const { data: existingCustomers, error: checkError } = await supabase
            .from('finance_customers')
            .select('name, customer_id')
            .eq('aadhaar', cleanAadhaar)
            .limit(1);

          if (checkError) {
            console.error('Error checking duplicate Aadhaar:', checkError);
          } else if (existingCustomers && existingCustomers.length > 0) {
            const dup = existingCustomers[0];
            toast.error(`Customer with this Aadhaar already exists (Name: ${dup.name}, ID: ${dup.customer_id || 'N/A'}).`);
            return;
          }
        } catch (err) {
          console.error('Exception checking duplicate Aadhaar:', err);
        }
      }
    }

    setSaving(true);
    try {
      const staffName = user?.username || 'Staff';

      // 1. Resolve Customer ID
      let resolvedCustomerId = selectedCustomerId;
      if (!resolvedCustomerId) {
        // Check if customer already exists by Aadhaar, Phone, or exact Name + Father match
        const match = customers.find(c => 
          (c.aadhaar && custAadhaar && c.aadhaar === custAadhaar) ||
          (c.phone_1 && custPhone && c.phone_1 === custPhone) ||
          (c.phone && custPhone && c.phone === custPhone) ||
          (c.name.toLowerCase() === custName.toLowerCase().trim() && 
           (c.father_name || c.father_husband_name || '').toLowerCase() === custFatherName.toLowerCase().trim())
        );

        if (match) {
          resolvedCustomerId = match.id;
        } else {
          // Create new customer
          const newCust = await supabaseFinance.createCustomer({
            name: custName.trim(),
            phone: custPhone || null,
            phone2: custPhone2 || null,
            address: custPresentAddress || null,
            aadhaar: custAadhaar || null,
            customer_photo_url: custPhoto,
            father_husband_name: custFatherName || null,
            father_name: custFatherName || null,
            village: custVillage || null,
            mandal: custMandal || null,
            district: custDistrict || null,
            aadhaar_address: custAadhaarAddress || null,
            present_address: custPresentAddress || null,
            phone_1: custPhone || null,
            phone_2: custPhone2 || null,
            fingerprint_url: custFingerprintUrl || null,
            fingerprint_template: custFingerprintTemplate || null,
            fingerprint_added: custFingerprintAdded
          });
          if (newCust) {
            resolvedCustomerId = newCust.id;
          } else {
            toast.error('Failed to create new customer record.');
            setSaving(false);
            return;
          }
        }
      }

      // 2. Resolve Guarantor 1 ID
      let resolvedG1Id = g1SelectedId;
      if (!resolvedG1Id && g1Name.trim()) {
        const matchG1 = guarantors.find(g => 
          (g.aadhaar && g1Aadhaar && g.aadhaar === g1Aadhaar) ||
          (g.phone && g1Phone && g.phone === g1Phone) ||
          g.name.toLowerCase() === g1Name.toLowerCase().trim()
        );

        if (matchG1) {
          resolvedG1Id = matchG1.id;
        } else {
          const newGuar = await supabaseFinance.createGuarantor({
            name: g1Name.trim(),
            aadhaar: g1Aadhaar || null,
            phone: g1Phone || null,
            address: g1Address || null,
            photo_url: g1Photo,
            fingerprint_template: g1FingerprintTemplate || null,
            fingerprint_image_url: g1FingerprintUrl || null,
            fingerprint_added: g1FingerprintAdded
          });
          if (newGuar) {
            resolvedG1Id = newGuar.id;
          } else {
            toast.error('Failed to create Guarantor 1 record.');
            setSaving(false);
            return;
          }
        }
      }

      // 3. Resolve Guarantor 2 ID
      let resolvedG2Id = g2SelectedId;
      if (!resolvedG2Id && g2Name.trim()) {
        const matchG2 = guarantors.find(g => 
          (g.aadhaar && g2Aadhaar && g.aadhaar === g2Aadhaar) ||
          (g.phone && g2Phone && g.phone === g2Phone) ||
          g.name.toLowerCase() === g2Name.toLowerCase().trim()
        );

        if (matchG2) {
          resolvedG2Id = matchG2.id;
        } else {
          const newGuar = await supabaseFinance.createGuarantor({
            name: g2Name.trim(),
            aadhaar: g2Aadhaar || null,
            phone: g2Phone || null,
            address: g2Address || null,
            photo_url: g2Photo,
            fingerprint_template: g2FingerprintTemplate || null,
            fingerprint_image_url: g2FingerprintUrl || null,
            fingerprint_added: g2FingerprintAdded
          });
          if (newGuar) {
            resolvedG2Id = newGuar.id;
          } else {
            toast.error('Failed to create Guarantor 2 record.');
            setSaving(false);
            return;
          }
        }
      }

      // 4. Create dues schedule
      const duesList: any[] = [];
      const start = new Date(date);
      for (let i = 1; i <= liveCalculations.duesCount; i++) {
        const dDate = new Date(start);
        if (dueType === 'Daily') {
          dDate.setDate(start.getDate() + i);
        } else if (dueType === 'Weekly') {
          dDate.setDate(start.getDate() + i * 7);
        } else {
          dDate.setMonth(start.getMonth() + i);
        }
        duesList.push({
          due_date: dDate.toISOString().split('T')[0],
          amount: liveCalculations.dueAmount
        });
      }

      // Combined Guarantors Surety details for backward compat
      const combinedSuretyName = [g1Name, g2Name].filter(Boolean).join(' / ') || null;
      const combinedSuretyPhone = [g1Phone, g2Phone].filter(Boolean).join(' / ') || null;
      const combinedSuretyAadhaar = [g1Aadhaar, g2Aadhaar].filter(Boolean).join(' / ') || null;

      const finalRemarks = [
         remarks,
        `Collateral: ${locAddress || 'N/A'}, GPS: ${locLatitude && locLongitude ? `${locLatitude},${locLongitude}` : 'N/A'}`,
        `Extra: ${extraDetails || 'N/A'}`
      ].filter(Boolean).join(' | ');

      const customerPayload = {
        id: resolvedCustomerId,
        customer_photo_url: custPhoto,
        fingerprint_url: custFingerprintUrl,
        fingerprint_template: custFingerprintTemplate,
        fingerprint_added: custFingerprintAdded,
        customer_fingerprint_template: custFingerprintTemplate,
        customer_fingerprint_image_url: custFingerprintUrl,
        customer_fingerprint_added: custFingerprintAdded,
        father_husband_name: custFatherName || null,
        partner_name: partnerName || null
      };

      const loanPayload = {
        loan_id: loanId,
        customer_id: resolvedCustomerId,
        date,
        amount: liveCalculations.principal,
        interest_rate: Number(interestRate),
        duration_months: Number(durationMonths),
        due_type: dueType,
        due_amount: liveCalculations.dueAmount,
        surety_name: combinedSuretyName,
        surety_phone: combinedSuretyPhone,
        surety_aadhaar: combinedSuretyAadhaar,
        remarks: finalRemarks,
        customer_photo_url: custPhoto,
        surety_photo_url: g1Photo || g2Photo || null,
        fingerprint_url: custFingerprintUrl,
        fingerprint_template: custFingerprintTemplate,
        fingerprint_added: custFingerprintAdded,
        customer_fingerprint_template: custFingerprintTemplate,
        customer_fingerprint_image_url: custFingerprintUrl,
        customer_fingerprint_added: custFingerprintAdded,
        surety_fingerprint_template: g1FingerprintTemplate || g2FingerprintTemplate || null,
        surety_fingerprint_image_url: g1FingerprintUrl || g2FingerprintUrl || null,
        surety_fingerprint_added: g1FingerprintAdded || g2FingerprintAdded || false,
        father_husband_name: custFatherName || null,
        loan_category: loanCategory,
        guarantor_1_id: resolvedG1Id || null,
        guarantor_2_id: resolvedG2Id || null
      };

      const photosArray: any[] = [];
      if (custPhoto) photosArray.push({ photo_type: 'Customer', photo_url: custPhoto });

      const savedLoan = await supabaseFinance.createLoan(
        loanPayload,
        customerPayload,
        duesList,
        photosArray,
        staffName
      );

      if (savedLoan) {
        // Save submitted checklist document links
        const linkedDocs = documents.filter(doc => doc.checked && doc.fileUrl);
        for (const doc of linkedDocs) {
          await supabaseFinance.addDocument({
            loan_id: savedLoan.id,
            document_type: `${doc.label} (${doc.refNo || 'No Ref'})`,
            document_url: doc.fileUrl || ''
          });
        }

        // Save collateral info in logs
        const collateralJSON = {
          collateral_address: locAddress,
          village: locVillage,
          mandal: locMandal,
          district: locDistrict,
          state: locState,
          pincode: locPincode,
          landmark: locLandmark,
          gps_latitude: locLatitude,
          gps_longitude: locLongitude,
          google_maps_link: locMapsLink,
          collateral_image: collateralImage,
          particulars,
          extraDetails,
          document_charges: liveCalculations.docFees
        };

        try {
          await supabase.from('finance_edited_logs').insert([{
            table_name: 'finance_loans_collateral',
            record_id: savedLoan.id,
            old_values: {},
            new_values: collateralJSON,
            edited_by: staffName
          }]);
        } catch (err) {
          console.warn('Could not record collateral JSON metadata', err);
        }

        toast.success(`Loan Account ${loanId} created and disbursed successfully!`);
        navigate('/finance');
      } else {
        toast.error('Disbursal failed. Duplicate Loan Number.');
      }
    } catch (err: any) {
      console.error('Save loan error details:', err);
      const errorMsg = err.message || '';
      if (err.code === '42703' || errorMsg.includes('column') || errorMsg.includes('schema cache')) {
        toast.error('Customer table setup is incomplete. Please run migration.');
      } else if (err.code === '23505' || errorMsg.includes('duplicate') || errorMsg.includes('unique constraint')) {
        if (errorMsg.toLowerCase().includes('loan_id') || errorMsg.toLowerCase().includes('loans')) {
          toast.error('Disbursal failed. Duplicate Loan Number.');
        } else if (errorMsg.toLowerCase().includes('aadhaar')) {
          toast.error('Customer with this Aadhaar already exists.');
        } else {
          toast.error(`Duplicate entry error: ${errorMsg}`);
        }
      } else {
        toast.error(`Disbursal failed: ${errorMsg || 'Check database connection or RLS rules.'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPreview = () => {
    if (!liveCalculations) {
      toast.error('Please enter valid loan terms to preview statement');
      return;
    }
    setShowPrintPreview(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none print:p-0 print:bg-white">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <h1 className="finance-h1">NEW LOAN ENTRY</h1>
          <p className="mt-1 finance-small-label uppercase">
            CAPTURE & DISBURSE GENERAL — LEDGER — DUES CALCULATIONS PREVIEW & FILE
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <Link
            to="/finance/calculator"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <Calculator className="w-3.5 h-3.5" />
            CALCULATOR
          </Link>
          <button
            onClick={handlePrintPreview}
            disabled={!liveCalculations}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 finance-button uppercase"
          >
            <Printer className="w-3.5 h-3.5" />
            PREVIEW & PRINT
          </button>
          <button
            onClick={handleClearForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm finance-header-time"
          >
            <X className="w-3.5 h-3.5" />
            CLEAR
          </button>
          <button
            onClick={handleSaveLoan}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 finance-button uppercase"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'SAVING...' : 'SAVE LOAN'}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form entries */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: BASICS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 finance-header-time uppercase">
              BASICS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="finance-caption uppercase">
                  DATE *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                  required
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  LEDGER TYPE *
                </label>
                <select
                  value={loanCategory}
                  onChange={(e) => setLoanCategory(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                  required
                >
                  <option value="CD">CHIT FUND (CD)</option>
                  <option value="STBD">STBD LEDGER</option>
                  <option value="HP">HP LEDGER</option>
                  <option value="TBD">TBD LEDGER</option>
                </select>
                <span className="text-[9px] text-slate-400 mt-1.5 block finance-input uppercase">
                  CD, HP, STBD, TBD
                </span>
              </div>

              <div>
                <label className="finance-caption uppercase">
                  LOAN NUMBER
                </label>
                <input
                  type="text"
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  placeholder="e.g. CD001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 focus:outline-none font-mono finance-header-time"
                  required
                />
                <span className="text-[9px] text-slate-400 mt-1.5 block finance-input uppercase">
                  AUTO-GENERATED
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: CUSTOMER */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-slate-900 finance-header-time uppercase">
                CUSTOMER DETAILS
              </h3>
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId('');
                    setCustName('');
                    setCustFatherName('');
                    setCustPhone('');
                    setCustPhone2('');
                    setCustAadhaar('');
                    setCustPhoto(null);
                    setCustFingerprintUrl(null);
                    setCustFingerprintTemplate(null);
                    setCustFingerprintAdded(false);
                    setCustVillage('');
                    setCustMandal('');
                    setCustDistrict('');
                    setCustAadhaarAddress('');
                    setCustPresentAddress('');
                  }}
                  className="text-red-650 hover:underline finance-small-label uppercase"
                >
                  CLEAR SELECTION
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Search input for existing customer */}
              <div ref={dropdownRef} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 print:hidden">
                <label className="finance-caption uppercase">
                  SELECT EXISTING CUSTOMER (OR TYPE DETAILS DIRECTLY BELOW)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={custSearch}
                    onChange={(e) => {
                      setCustSearch(e.target.value);
                      setCustDropdownOpen(true);
                    }}
                    onFocus={() => setCustDropdownOpen(true)}
                    placeholder="Search by customer name, ID, phone, or Aadhaar..."
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                  />
                  
                  {custDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCustomersForSelect.length === 0 ? (
                        <div className="px-4 py-3 text-slate-400 text-center finance-header-time uppercase">
                          No matching customers found
                        </div>
                      ) : (
                        filteredCustomersForSelect.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setCustDropdownOpen(false);
                              setCustSearch('');
                            }}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                          >
                            <div>
                              <div className="text-slate-900 finance-header-time">{c.name}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5 finance-input uppercase">
                                ID: #{c.customer_id || 'N/A'} | Aadhaar: {c.aadhaar || 'N/A'}
                              </div>
                            </div>
                            {(c.phone_1 || c.phone) ? (
                              <div className="text-slate-500 font-mono finance-small-label">
                                {c.phone_1 || c.phone}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Inputs Panel */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <span className="bg-[#0b1329] text-white text-[9px] px-2 py-1 rounded finance-input uppercase">
                    {selectedCustomerId ? `ID: #${customers.find(c => c.id === selectedCustomerId)?.customer_id || 'N/A'}` : 'NEW ENTRY'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Customer Name *" 
                    value={custName} 
                    onChange={setCustName} 
                    placeholder="Full Name" 
                    readOnly={!!selectedCustomerId} 
                    required 
                  />
                  <Input 
                    label="Father Name" 
                    value={custFatherName} 
                    onChange={setCustFatherName} 
                    placeholder="Father Name" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Aadhaar UID" 
                    value={custAadhaar} 
                    onChange={setCustAadhaar} 
                    placeholder="12-digit Aadhaar UID" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Phone 1" 
                    value={custPhone} 
                    onChange={setCustPhone} 
                    placeholder="Primary contact" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Phone 2" 
                    value={custPhone2} 
                    onChange={setCustPhone2} 
                    placeholder="Secondary contact" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Village" 
                    value={custVillage} 
                    onChange={setCustVillage} 
                    placeholder="Village" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Mandal" 
                    value={custMandal} 
                    onChange={setCustMandal} 
                    placeholder="Mandal" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="District" 
                    value={custDistrict} 
                    onChange={setCustDistrict} 
                    placeholder="District" 
                    readOnly={!!selectedCustomerId} 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 mb-1 finance-input uppercase">
                      Aadhaar Address
                    </label>
                    <textarea
                      value={custAadhaarAddress}
                      onChange={(e) => setCustAadhaarAddress(e.target.value)}
                      placeholder="Address printed on Aadhaar"
                      rows={2}
                      disabled={!!selectedCustomerId}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 disabled:bg-slate-50 focus:outline-none resize-none finance-header-time"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 mb-1 finance-input uppercase">
                      Present Address
                    </label>
                    <textarea
                      value={custPresentAddress}
                      onChange={(e) => setCustPresentAddress(e.target.value)}
                      placeholder="Current residential address"
                      rows={2}
                      disabled={!!selectedCustomerId}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 disabled:bg-slate-50 focus:outline-none resize-none finance-header-time"
                    />
                  </div>
                </div>

                {/* Photo & Biometrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-150">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-3 shadow-sm">
                    <span className="finance-caption uppercase text-slate-500 font-semibold mb-1">Customer Photo</span>
                    <div className="w-24 h-24 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative group">
                      {custPhoto ? (
                        <>
                          <img src={custPhoto} alt="Customer" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setCustPhoto(null)}
                            className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-5 h-5 mb-1" />
                            <span className="finance-small-label uppercase">REMOVE</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 gap-1">
                          <User className="w-6 h-6 stroke-1" />
                          <span className="text-[9px] finance-input uppercase">NO PHOTO</span>
                        </div>
                      )}
                    </div>
                    <label className="text-[10px] bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer shadow-sm finance-input uppercase inline-flex items-center gap-1.5 transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                      {custPhoto ? 'REPLACE PHOTO' : 'CAPTURE / UPLOAD'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCustPhoto(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <BiometricScanner
                    label="Customer Fingerprint Capture"
                    existingTemplate={custFingerprintTemplate}
                    existingImageUrl={custFingerprintUrl}
                    onFingerprintSaved={(url, template, added) => {
                      setCustFingerprintUrl(url);
                      setCustFingerprintTemplate(template);
                      setCustFingerprintAdded(added);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: GUARANTORS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 finance-header-time uppercase">
              GUARANTORS
            </h3>
            
            {/* Guarantor 1 */}
            <div className="space-y-3 pb-4 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="text-slate-400 finance-small-label uppercase">
                  GUARANTOR 1
                </h4>
                {g1SelectedId && (
                  <button
                    type="button"
                    onClick={() => {
                      setG1SelectedId('');
                      setG1Name('');
                      setG1Phone('');
                      setG1Aadhaar('');
                      setG1Address('');
                      setG1Photo(null);
                    }}
                    className="text-[9px] text-red-650 hover:underline finance-input uppercase"
                  >
                    CLEAR SELECTION
                  </button>
                )}
              </div>

              {/* Search select existing guarantor 1 */}
              <div ref={g1DropdownRef} className="relative print:hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={g1Search}
                  onChange={(e) => {
                    setG1Search(e.target.value);
                    setG1DropdownOpen(true);
                  }}
                  onFocus={() => setG1DropdownOpen(true)}
                  placeholder="Select or Search Existing Guarantor 1..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                />
                
                {g1DropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredGuarantorsForSelectG1.length === 0 ? (
                      <div className="px-4 py-3 text-slate-400 text-center finance-header-time uppercase">
                        No matching guarantors
                      </div>
                    ) : (
                      filteredGuarantorsForSelectG1.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => {
                            setG1SelectedId(g.id);
                            setG1DropdownOpen(false);
                            setG1Search('');
                          }}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <div className="text-slate-900 finance-header-time">{g.name}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 finance-input uppercase">
                              ID: #{g.guarantor_id || 'N/A'} | Aadhaar: {g.aadhaar || 'N/A'}
                            </div>
                          </div>
                          {g.phone && (
                            <div className="text-[9px] text-slate-500 font-mono finance-input">
                              {g.phone}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Guarantor 1 details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input label="Name" value={g1Name} onChange={setG1Name} placeholder="Full Name" readOnly={!!g1SelectedId} />
                <Input label="Aadhaar" value={g1Aadhaar} onChange={setG1Aadhaar} placeholder="Aadhaar UID" readOnly={!!g1SelectedId} />
                <Input label="Phone" value={g1Phone} onChange={setG1Phone} placeholder="Phone No" readOnly={!!g1SelectedId} />
                <Input label="Address" value={g1Address} onChange={setG1Address} placeholder="Address details" readOnly={!!g1SelectedId} />
                {/* Guarantor 1 Photo & Biometrics */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-150">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-3">
                    <span className="finance-caption uppercase text-slate-500 font-semibold mb-1">Guarantor 1 Photo</span>
                    <div className="w-24 h-24 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative group">
                      {g1Photo ? (
                        <>
                          <img src={g1Photo} alt="Guarantor 1" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setG1Photo(null)}
                            className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-5 h-5 mb-1" />
                            <span className="finance-small-label uppercase">REMOVE</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 gap-1">
                          <User className="w-6 h-6 stroke-1" />
                          <span className="text-[9px] finance-input uppercase">NO PHOTO</span>
                        </div>
                      )}
                    </div>
                    <label className="text-[10px] bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer shadow-sm finance-input uppercase inline-flex items-center gap-1.5 transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                      {g1Photo ? 'REPLACE PHOTO' : 'CAPTURE / UPLOAD'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setG1Photo(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <BiometricScanner
                    label="Guarantor 1 Fingerprint Capture"
                    existingTemplate={g1FingerprintTemplate}
                    existingImageUrl={g1FingerprintUrl}
                    onFingerprintSaved={(url, template, added) => {
                      setG1FingerprintUrl(url);
                      setG1FingerprintTemplate(template);
                      setG1FingerprintAdded(added);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Guarantor 2 */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h4 className="text-slate-400 finance-small-label uppercase">
                  GUARANTOR 2
                </h4>
                {g2SelectedId && (
                  <button
                    type="button"
                    onClick={() => {
                      setG2SelectedId('');
                      setG2Name('');
                      setG2Phone('');
                      setG2Aadhaar('');
                      setG2Address('');
                      setG2Photo(null);
                    }}
                    className="text-[9px] text-red-650 hover:underline finance-input uppercase"
                  >
                    CLEAR SELECTION
                  </button>
                )}
              </div>

              {/* Search select existing guarantor 2 */}
              <div ref={g2DropdownRef} className="relative print:hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={g2Search}
                  onChange={(e) => {
                    setG2Search(e.target.value);
                    setG2DropdownOpen(true);
                  }}
                  onFocus={() => setG2DropdownOpen(true)}
                  placeholder="Select or Search Existing Guarantor 2..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                />
                
                {g2DropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredGuarantorsForSelectG2.length === 0 ? (
                      <div className="px-4 py-3 text-slate-400 text-center finance-header-time uppercase">
                        No matching guarantors
                      </div>
                    ) : (
                      filteredGuarantorsForSelectG2.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => {
                            setG2SelectedId(g.id);
                            setG2DropdownOpen(false);
                            setG2Search('');
                          }}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <div className="text-slate-900 finance-header-time">{g.name}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 finance-input uppercase">
                              ID: #{g.guarantor_id || 'N/A'} | Aadhaar: {g.aadhaar || 'N/A'}
                            </div>
                          </div>
                          {g.phone && (
                            <div className="text-[9px] text-slate-500 font-mono finance-input">
                              {g.phone}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Guarantor 2 details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input label="Name" value={g2Name} onChange={setG2Name} placeholder="Full Name" readOnly={!!g2SelectedId} />
                <Input label="Aadhaar" value={g2Aadhaar} onChange={setG2Aadhaar} placeholder="Aadhaar UID" readOnly={!!g2SelectedId} />
                <Input label="Phone" value={g2Phone} onChange={setG2Phone} placeholder="Phone No" readOnly={!!g2SelectedId} />
                <Input label="Address" value={g2Address} onChange={setG2Address} placeholder="Address details" readOnly={!!g2SelectedId} />
                {/* Guarantor 2 Photo & Biometrics */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-150">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-3">
                    <span className="finance-caption uppercase text-slate-500 font-semibold mb-1">Guarantor 2 Photo</span>
                    <div className="w-24 h-24 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative group">
                      {g2Photo ? (
                        <>
                          <img src={g2Photo} alt="Guarantor 2" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setG2Photo(null)}
                            className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-5 h-5 mb-1" />
                            <span className="finance-small-label uppercase">REMOVE</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 gap-1">
                          <User className="w-6 h-6 stroke-1" />
                          <span className="text-[9px] finance-input uppercase">NO PHOTO</span>
                        </div>
                      )}
                    </div>
                    <label className="text-[10px] bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer shadow-sm finance-input uppercase inline-flex items-center gap-1.5 transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                      {g2Photo ? 'REPLACE PHOTO' : 'CAPTURE / UPLOAD'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setG2Photo(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <BiometricScanner
                    label="Guarantor 2 Fingerprint Capture"
                    existingTemplate={g2FingerprintTemplate}
                    existingImageUrl={g2FingerprintUrl}
                    onFingerprintSaved={(url, template, added) => {
                      setG2FingerprintUrl(url);
                      setG2FingerprintTemplate(template);
                      setG2FingerprintAdded(added);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: LOAN TERMS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 finance-header-time uppercase">
              LOAN TERMS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Row 1 */}
              <div>
                <label className="finance-caption uppercase mb-1 block">LOAN AMOUNT *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-input"
                  required
                />
              </div>
              <div>
                <label className="finance-caption uppercase mb-1 block">RATE OF INTEREST (%) *</label>
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-input"
                  required
                />
                <span className="text-[9px] text-slate-400 mt-1 block finance-input uppercase">DEFAULT: 3%</span>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="finance-caption uppercase mb-1 block">PERIOD *</label>
                  <input
                    type="number"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-input"
                    required
                  />
                  <span className="text-[9px] text-slate-400 mt-1 block finance-input uppercase">DAYS FOR CD/OD, INSTALMENTS FOR HP/STBD, MONTHS FOR TBD</span>
                </div>
                <div className="col-span-1">
                  <label className="finance-caption uppercase mb-1 block">DUE TYPE *</label>
                  <select
                    value={dueType}
                    onChange={(e) => setDueType(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-input"
                    required
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="finance-caption uppercase mb-1 block">DOCUMENT CHARGES (₹)</label>
                <input
                  type="number"
                  value={docCharges}
                  onChange={(e) => setDocCharges(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-input"
                />
              </div>

              {/* Row 3 */}
              <div>
                <label className="finance-caption uppercase mb-1 block">ANNUAL HOLD %</label>
                <input
                  type="number"
                  value={annualHold}
                  onChange={(e) => setAnnualHold(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-input"
                />
                <span className="text-[9px] text-slate-400 mt-1 block finance-input uppercase">PRE-DEDUCTED FROM DISBURSAL, PRORATED OVER TENURE</span>
              </div>
              <div>
                <label className="finance-caption uppercase mb-1 block">PARTIAL PAID (₹)</label>
                <input
                  type="number"
                  value={partialPaid}
                  onChange={(e) => setPartialPaid(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-input"
                />
                <span className="text-[9px] text-slate-400 mt-1 block finance-input uppercase">ANY AMOUNT ALREADY COLLECTED AT ENTRY</span>
              </div>

              {/* Row 4 */}
              <div className="sm:col-span-2">
                <label className="finance-caption uppercase mb-1 block">PARTICULARS</label>
                <textarea
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-input resize-none"
                  placeholder="e.g. Gold weight or pledge card particulars"
                />
              </div>
            </div>
          </div>

          {/* Card 5: PARTNER */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 finance-header-time uppercase">
              PARTNER
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="finance-caption uppercase">
                  SELECT PARTNER
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                >
                  <option value="">-- SELECT PARTNER --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="PARTNER NAME (READONLY)"
                value={partnerName}
                placeholder="Partner Name"
              />
            </div>
          </div>

          {/* Card 6: DOCUMENTS SUBMITTED */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-slate-900 finance-header-time uppercase">
                DOCUMENTS SUBMITTED
              </h3>
              <div className="flex gap-2">
                <span className="text-[9px] text-blue-650 bg-blue-50 border border-blue-150 px-2 py-0.5 rounded finance-input uppercase">
                  FIN: {documents.filter(d => d.category === 'Financial' && (d.checked || d.fileUrl)).length}
                </span>
                <span className="text-[9px] text-purple-650 bg-purple-50 border border-purple-150 px-2 py-0.5 rounded finance-input uppercase">
                  ORIG: {documents.filter(d => d.category === 'Original' && (d.checked || d.fileUrl)).length}
                </span>
                <span className="text-[9px] text-amber-650 bg-amber-50 border border-amber-150 px-2 py-0.5 rounded finance-input uppercase">
                  REG: {documents.filter(d => d.category === 'Registration' && (d.checked || d.fileUrl)).length}
                </span>
              </div>
            </div>

            {/* Checklist Category Groups */}
            {(['Financial', 'Original', 'Registration'] as const).map((cat, catIdx) => (
              <div key={catIdx} className="space-y-2 pt-2 first:pt-0">
                <div className="flex justify-between items-center">
                  <h4 className="text-slate-400 finance-small-label uppercase">
                    {catIdx + 1}. {cat.toUpperCase()} DOCUMENTS
                  </h4>
                  <button 
                    type="button"
                    onClick={() => {
                      const newDoc: DocumentItem = {
                        key: `custom_${Date.now()}_${Math.random()}`,
                        label: '',
                        category: cat,
                        checked: true,
                        refNo: '',
                        fileUrl: null,
                        uploading: false,
                        isCustom: true
                      };
                      setDocuments(prev => [...prev, newDoc]);
                    }}
                    className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded hover:bg-slate-200 transition-colors finance-input uppercase font-semibold"
                  >
                    + ADD
                  </button>
                </div>
                
                <div className="space-y-2">
                  {documents.filter(doc => doc.category === cat).map((doc) => (
                    <div key={doc.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 border border-slate-100 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors finance-caption">
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={doc.checked}
                          onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, checked: e.target.checked } : d))}
                          className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900 shrink-0"
                        />
                        {doc.isCustom ? (
                          <input
                            type="text"
                            value={doc.label}
                            onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, label: e.target.value } : d))}
                            placeholder="DOCUMENT NAME..."
                            className="bg-white border border-slate-200 rounded p-1 text-[11px] text-slate-700 w-full focus:outline-none finance-input"
                          />
                        ) : (
                          <span className="text-slate-800 select-none finance-input w-full">
                            {doc.label}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-1 sm:justify-end shrink-0">
                        <input
                          type="text"
                          value={doc.refNo}
                          onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, refNo: e.target.value } : d))}
                          placeholder="REF NO..."
                          className="bg-white border border-slate-200 rounded p-1 text-[11px] text-slate-700 w-full sm:w-48 focus:outline-none finance-input"
                        />
                        
                        {doc.fileUrl ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 text-[9px] bg-green-550 text-white rounded hover:bg-green-600 transition-colors shadow-sm finance-input uppercase"
                            >
                              VIEW
                            </a>
                          </div>
                        ) : (
                          <label className="px-2.5 py-1 text-[9px] bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer rounded shrink-0 transition-colors select-none shadow-sm flex items-center gap-1 finance-input uppercase">
                            <Upload className="w-3 h-3" />
                            {doc.uploading ? 'UPLOADING...' : 'UPLOAD'}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleChecklistUpload(doc.key, e)}
                              className="hidden"
                              disabled={doc.uploading}
                            />
                          </label>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (doc.fileUrl) {
                              removeChecklistUpload(doc.key);
                            } else {
                              setDocuments(prev => prev.filter(d => d.key !== doc.key));
                            }
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0 ml-1"
                          title={doc.fileUrl ? "Remove uploaded file" : "Delete document row"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Card 7: ASSET / COLLATERAL LOCATION */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-slate-900 finance-header-time uppercase">
                ASSET / COLLATERAL LOCATION
              </h3>
              <button
                type="button"
                onClick={handleDetectGPS}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 rounded transition-colors shadow-sm finance-small-label"
              >
                <Navigation className="w-3.5 h-3.5 text-slate-600 animate-pulse" />
                DETECT GPS
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="ADDRESS"
                value={locAddress}
                onChange={setLocAddress}
                placeholder="DOOR NO, STREET, VILLAGE / TOWN"
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input label="VILLAGE/TOWN" value={locVillage} onChange={setLocVillage} placeholder="Village/Town" />
                <Input label="MANDAL" value={locMandal} onChange={setLocMandal} placeholder="Mandal" />
                <Input label="DISTRICT" value={locDistrict} onChange={setLocDistrict} placeholder="District" />
                <Input label="STATE" value={locState} onChange={setLocState} placeholder="State" />
                <Input label="PINCODE" value={locPincode} onChange={setLocPincode} placeholder="Pincode" />
                <Input label="LANDMARK" value={locLandmark} onChange={setLocLandmark} placeholder="e.g. Near Ramalayam temple" />
                <Input label="LATITUDE" value={locLatitude} onChange={setLocLatitude} placeholder="GPS Latitude" readOnly />
                <Input label="LONGITUDE" value={locLongitude} onChange={setLocLongitude} placeholder="GPS Longitude" readOnly />
              </div>

              <Input
                label="GOOGLE MAPS GPS LINK"
                value={locMapsLink}
                onChange={setLocMapsLink}
                placeholder="PASTE THE GOOGLE MAPS LINK"
              />
              
              <div className="pt-2 border-t border-slate-100">
                <label className="finance-caption uppercase block mb-2">
                  COLLATERAL PHOTO (OPTIONAL)
                </label>
                <div className="flex items-center gap-4">
                  {collateralImage ? (
                    <div className="relative w-32 h-32 rounded-xl border-2 border-slate-200 overflow-hidden group">
                      <img
                        src={collateralImage}
                        alt="Collateral"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeCollateralImage}
                        className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-5 h-5 mb-1" />
                        <span className="finance-small-label uppercase">REMOVE</span>
                      </button>
                    </div>
                  ) : (
                    <label className="w-32 h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer bg-slate-50/50">
                      <Camera className="w-6 h-6 text-slate-400 mb-2" />
                      <span className="finance-small-label uppercase text-slate-500 text-center px-2">
                        UPLOAD PHOTO
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCollateralImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 8: DESCRIPTION & EXTRA FEATURES */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 finance-header-time uppercase">
              DESCRIPTION & EXTRA FEATURES
            </h3>
            <div className="space-y-4">
              <div>
                <label className="finance-caption uppercase">
                  REMARKS
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="REASON FOR BORROWING, REPAYMENT ARRANGEMENT..."
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  EXTRA DETAILS
                </label>
                <textarea
                  value={extraDetails}
                  onChange={(e) => setExtraDetails(e.target.value)}
                  placeholder="SPECIAL CONDITIONS, ETC."
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live Calculation and Recent Loans */}
        <div className="space-y-6">
          
          {/* Card 9: LIVE CALCULATION */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-slate-900 finance-header-time uppercase">
                LIVE CALCULATION
              </h3>
              <span className="text-[9px] text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded finance-input uppercase">
                {dueType}
              </span>
            </div>

            {!liveCalculations ? (
              <div className="py-8 text-center text-slate-400 finance-header-time uppercase">
                FILL IN THE LOAN AMOUNT TO SEE THE CALCULATION PREVIEW.
              </div>
            ) : (
              <div className="space-y-4 text-slate-700 finance-caption">
                <div className="grid grid-cols-2 gap-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-400 finance-small-label uppercase">Principal:</span>
                  <span className="text-right text-slate-900 finance-input">₹{liveCalculations.principal.toLocaleString('en-IN')}</span>

                  <span className="text-slate-400 finance-small-label uppercase">Doc Fees:</span>
                  <span className="text-right text-slate-900 finance-input">₹{liveCalculations.docFees.toLocaleString('en-IN')}</span>

                  <span className="text-slate-400 finance-small-label uppercase">Net Disbursed:</span>
                  <span className="text-right text-slate-900 text-blue-650 finance-input">₹{liveCalculations.netDisbursed.toLocaleString('en-IN')}</span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 border-t pt-2.5">
                  <span className="text-slate-400 finance-small-label uppercase">Interest Component:</span>
                  <span className="text-right text-slate-900 finance-input">₹{liveCalculations.interestAmount.toLocaleString('en-IN')}</span>

                  <span className="text-slate-400 finance-small-label uppercase">Total Repayment:</span>
                  <span className="text-right text-slate-900 finance-input">₹{liveCalculations.totalRepayment.toLocaleString('en-IN')}</span>

                  <span className="text-slate-400 finance-small-label uppercase">Instalment Count:</span>
                  <span className="text-right text-slate-900 finance-input">{liveCalculations.duesCount} {dueType} Dues</span>

                  <span className="text-slate-800 mt-1 border-t pt-1.5 finance-sidebar-link uppercase">Instalment:</span>
                  <span className="text-right text-green-700 mt-1 border-t pt-1.5 finance-sidebar-link">₹{liveCalculations.dueAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 10: RECENT LOANS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 finance-header-time uppercase">
              RECENT LOANS
            </h3>
            
            {activeLoans.length === 0 ? (
              <div className="py-8 text-center text-slate-400 finance-header-time uppercase">
                NO LOANS YET
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {activeLoans.slice(0, 5).map(loan => (
                  <div key={loan.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-all flex justify-between items-center bg-slate-50/20">
                    <div>
                      <div className="text-slate-900 finance-header-time">{loan.customer?.name}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5 finance-input uppercase">{loan.due_type} Mode</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-slate-700 finance-header-time">{loan.loan_id}</div>
                      <div className="text-slate-900 mt-0.5 finance-header-time">₹{Number(loan.amount).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Loan Entry - Preview"
        documentTitle="LOAN ENTRY FORM"
      >
        <div className="space-y-6">
          {/* Top Header */}
          <div className="text-center border-b pb-4">
            <h1 className="finance-h1">THIRUMALA GROUP - LOAN ENTRY</h1>
            <p className="text-slate-500 mt-1 finance-sidebar-link">Date: {date} | Loan Type: {loanCategory}</p>
          </div>
          
          {/* Customer Info */}
          <div>
            <h3 className="bg-slate-100 p-2 finance-sidebar-link uppercase">Customer Details</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="text-gray-500 finance-header-time">NAME:</span> {custName}</div>
               <div><span className="text-gray-500 finance-header-time">F/W/H:</span> {custFatherName}</div>
               <div><span className="text-gray-500 finance-header-time">PHONE:</span> {custPhone}</div>
               <div><span className="text-gray-500 finance-header-time">AADHAAR:</span> {custAadhaar}</div>
               <div className="col-span-2"><span className="text-gray-500 finance-header-time">ADDRESS:</span> {custPresentAddress}</div>
            </div>
          </div>

          {/* Guarantors */}
          <div>
            <h3 className="bg-slate-100 p-2 finance-sidebar-link uppercase">Guarantor Details</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="text-gray-500 finance-header-time">G1 NAME:</span> {g1Name}</div>
               <div><span className="text-gray-500 finance-header-time">G1 PHONE:</span> {g1Phone}</div>
               {g2Name && <div><span className="text-gray-500 finance-header-time">G2 NAME:</span> {g2Name}</div>}
               {g2Phone && <div><span className="text-gray-500 finance-header-time">G2 PHONE:</span> {g2Phone}</div>}
            </div>
          </div>

          {/* Loan Terms */}
          <div>
            <h3 className="bg-slate-100 p-2 finance-sidebar-link uppercase">Loan Terms</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="text-gray-500 finance-header-time">PRINCIPAL:</span> ₹{Number(amount).toLocaleString('en-IN')}</div>
               <div><span className="text-gray-500 finance-header-time">INTEREST RATE:</span> {interestRate}% / MONTH</div>
               <div><span className="text-gray-500 finance-header-time">DURATION:</span> {durationMonths} MONTHS</div>
               <div><span className="text-gray-500 finance-header-time">DUE TYPE:</span> {dueType}</div>
               <div><span className="text-gray-500 finance-header-time">DOC CHARGES:</span> ₹{Number(docCharges).toLocaleString('en-IN')}</div>
               <div className="col-span-2"><span className="text-gray-500 finance-header-time">PARTICULARS:</span> {particulars}</div>
            </div>
          </div>

          {/* Live Calculation */}
          {liveCalculations && (
          <div>
            <h3 className="bg-slate-100 p-2 finance-sidebar-link uppercase">Calculations</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="text-gray-500 finance-header-time">NET DISBURSED:</span> ₹{liveCalculations.netDisbursed.toLocaleString('en-IN')}</div>
               <div><span className="text-gray-500 finance-header-time">TOTAL REPAYMENT:</span> ₹{liveCalculations.totalRepayment.toLocaleString('en-IN')}</div>
               <div><span className="text-gray-500 finance-header-time">INSTALMENT COUNT:</span> {liveCalculations.duesCount}</div>
               <div><span className="text-gray-500 finance-header-time">INSTALMENT AMOUNT:</span> ₹{liveCalculations.dueAmount.toLocaleString('en-IN')}</div>
            </div>
          </div>
          )}
          
          {/* Signatures */}
          <div className="pt-24 grid grid-cols-2 gap-10 text-center text-slate-500 finance-sidebar-link">
            <div>
              <div className="border-t border-slate-300 pt-2 w-48 mx-auto">Customer Signature</div>
            </div>
            <div>
              <div className="border-t border-slate-300 pt-2 w-48 mx-auto">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </FinancePrintPreview>

    </div>
  );
};

export default LoanEntry;
