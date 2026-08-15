import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export function generateNextPartnerId(existingPartners: Array<{ partner_id?: number | string | null; partner_code?: string | null }>): string {
  if (!existingPartners || existingPartners.length === 0) {
    return 'P01';
  }

  let maxSeq = 0;
  let usesTwoDigitPadding = true;

  for (const p of existingPartners) {
    // 1. Check partner_code (e.g. 'P01', 'P02', 'P1', 'P-05', etc.)
    if (p.partner_code) {
      const codeStr = String(p.partner_code).trim();
      const match = codeStr.match(/^P-?(\d+)$/i);
      if (match) {
        const digitsStr = match[1];
        const num = parseInt(digitsStr, 10);
        if (!isNaN(num)) {
          if (num > maxSeq) maxSeq = num;
          if (digitsStr.length === 1 && num < 10) {
            usesTwoDigitPadding = false;
          } else if (digitsStr.length >= 2 && digitsStr.startsWith('0')) {
            usesTwoDigitPadding = true;
          }
        }
      } else {
        const num = parseInt(codeStr.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }

    // 2. Check numeric or string partner_id
    if (p.partner_id !== undefined && p.partner_id !== null) {
      const num = typeof p.partner_id === 'number'
        ? p.partner_id
        : parseInt(String(p.partner_id).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextNum = maxSeq + 1;
  return usesTwoDigitPadding
    ? `P${String(nextNum).padStart(2, '0')}`
    : `P${nextNum}`;
}

const NewPartner: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  
  // Fields state
  const [partnerId, setPartnerId] = useState<number | string>('...');
  const [role, setRole] = useState<'MANAGING PARTNER' | 'PARTNER'>('PARTNER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [homePhone, setHomePhone] = useState('');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const nameRef = React.useRef<HTMLInputElement>(null);
  const phoneRef = React.useRef<HTMLInputElement>(null);

  // Fetch data on load depending on mode
  useEffect(() => {
    if (editId) {
      loadPartnerDetails(editId);
    } else {
      fetchNextPartnerId();
    }
  }, [editId]);

  const fetchNextPartnerId = async () => {
    try {
      // Fetch all existing partners across database to find the maximum existing sequence index
      const { data, error } = await supabase
        .from('finance_partners')
        .select('id, partner_id, partner_code, name');

      if (error) throw error;

      const nextId = generateNextPartnerId(data || []);
      setPartnerId(nextId);
    } catch (err) {
      console.error('Error fetching next partner ID:', err);
      setPartnerId('P01'); // Default fallback
    }
  };

  const loadPartnerDetails = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('finance_partners')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setPartnerId(data.partner_code || (data.partner_id ? `P${String(data.partner_id).padStart(2, '0')}` : 'P01'));
        setRole(data.is_md ? 'MANAGING PARTNER' : 'PARTNER');
        setName(data.name || '');
        setPhone(data.phone || '');
        setHomePhone(data.home_phone || '');
        setVillage(data.village || '');
        setAddress(data.address || '');
      }
    } catch (err) {
      console.error('Error loading partner details:', err);
      toast.error('Failed to load partner details');
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setName('');
      setRole('PARTNER');
      setPhone('');
      setHomePhone('');
      setVillage('');
      setAddress('');
      if (editId) {
        loadPartnerDetails(editId);
      } else {
        fetchNextPartnerId();
      }
      toast.success('Form reset');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (saving) return; // Prevent double submit

    const validationErrors: Record<string, boolean> = {};

    if (!name.trim()) validationErrors.name = true;
    if (!phone.trim()) validationErrors.phone = true;
    if (!village.trim()) validationErrors.village = true;
    if (!address.trim()) validationErrors.address = true;

    if (phone.trim() && !/^\d{10}$/.test(phone.replace(/[^\d]/g, ''))) {
      validationErrors.phone = true;
      toast.error('Phone number must be exactly 10 digits');
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please complete all mandatory fields (Name, Phone, Village, Address)');
      if (validationErrors.name) nameRef.current?.focus();
      else if (validationErrors.phone) phoneRef.current?.focus();
      return;
    }

    setSaving(true);
    const savingToastId = toast.loading(editId ? 'Updating partner details...' : 'Registering partner...');
    try {
      const staffName = user?.username || 'Staff';
      const financeMode = (sessionStorage.getItem('finance_previous_mode') || localStorage.getItem('finance_previous_mode')) === 'itr' ? 'ITR' : 'REGULAR';
      let bookId: string | null = null;
      try {
        bookId = await supabaseFinance.getLegacyBookId(financeMode);
      } catch (e) {
        console.warn('Could not get legacy book id', e);
      }

      const seqNum = parseInt(String(partnerId).replace(/[^0-9]/g, ''), 10) || 1;

      const payload: any = {
        name: name.trim(),
        is_md: role === 'MANAGING PARTNER',
        phone: phone.trim() || null,
        home_phone: homePhone.trim() || null,
        village: village.trim() || null,
        address: address.trim() || null,
        partner_code: String(partnerId),
        partner_id: seqNum
      };
      if (bookId) {
        payload.book_id = bookId;
      }

      let result;
      if (editId) {
        result = await supabaseFinance.updatePartner(editId, payload, staffName);
      } else {
        result = await supabaseFinance.createPartner(payload as any);
      }

      if (result) {
        toast.success(editId ? 'Partner details updated!' : `Partner "${name.trim()}" (${partnerId}) registered!`, { id: savingToastId });
        navigate('/finance/partners');
      } else {
        toast.error(editId ? 'Failed to update partner' : 'Failed to register partner', { id: savingToastId });
      }
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error occurred while saving partner data';
      toast.error(errMsg, { id: savingToastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>DASHBOARD</span>
            <span>/</span>
            <span>PARTNERS</span>
            <span>/</span>
            <span className="text-slate-600">{editId ? 'EDIT' : 'NEW'}</span>
          </div>
          <h1 className="mt-1 finance-h1">
            {editId ? 'EDIT PARTNER' : 'NEW PARTNER'}
          </h1>
          <p className="mt-0.5 finance-small-label uppercase">
            {editId ? 'MODIFY PARTNER OR MD PROFILE DETAILS' : 'REGISTER A PARTNER OR MD WHO SOURCES BUSINESS'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance/partners')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-550" />
            RESET
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 finance-button uppercase"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* Main Form Area */}
      <div className="max-w-4xl">
        <form onSubmit={handleSubmit}>
          <Card 
            title={<span className="text-slate-900 finance-header-time uppercase">PARTNER DETAILS</span>}
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <div className="space-y-4">
              
              {/* Partner ID & Role Checkbox Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="PARTNER ID *"
                  value={partnerId}
                  readOnly={true}
                  disabled={true}
                />
                
                <div>
                  <label className="finance-caption uppercase">
                    ROLE *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg shadow-sm focus:ring-1 focus:ring-slate-950 focus:outline-none text-slate-850 finance-header-time"
                  >
                    <option value="PARTNER">PARTNER</option>
                    <option value="MANAGING PARTNER">MANAGING PARTNER</option>
                  </select>
                </div>
              </div>

              {/* Name (Full Width) */}
              <Input
                label="NAME *"
                value={name}
                onChange={(val) => { setName(val); setErrors(p => ({...p, name: false})) }}
                placeholder="Full Name"
                required
                ref={nameRef}
                error={errors.name}
              />

              {/* Phones (Grid of 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="PHONE *"
                  value={phone}
                  onChange={(val) => { setPhone(val); setErrors(p => ({...p, phone: false})) }}
                  placeholder="Primary contact number (10 digits)"
                  ref={phoneRef}
                  error={errors.phone}
                />
                <Input
                  label="HOME PHONE"
                  value={homePhone}
                  onChange={setHomePhone}
                  placeholder="Alternate/Home number"
                />
              </div>

              {/* Village */}
              <Input
                label="VILLAGE *"
                value={village}
                onChange={(val) => { setVillage(val); setErrors(p => ({...p, village: false})) }}
                placeholder="Village / Location"
                error={errors.village}
              />

              {/* Address (Textarea) */}
              <div>
                <label className="finance-caption uppercase">
                  ADDRESS <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setErrors(p => ({...p, address: false})) }}
                  placeholder="Residential or Office address"
                  className={`w-full bg-white border rounded-lg p-2 text-slate-855 focus:outline-none h-24 finance-header-time ${errors.address ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-955'}`}
                />
                {errors.address && <p className="text-xs text-red-500 font-bold mt-1">Address is required</p>}
              </div>

            </div>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default NewPartner;


