import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  Save, 
  Camera, 
  Trash2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BiometricScanner } from '../../components/finance/BiometricScanner';
import { SignaturePad } from '../../components/finance/SignaturePad';
import { validateFinanceForm, ValidationField } from '../../utils/financeValidation';
import { compressToWebP } from '../../utils/imageCompressor';

const NewCustomer: React.FC = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [estimatedId, setEstimatedId] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const aadhaarRef = useRef<HTMLInputElement>(null);
  const aadhaarAddressRef = useRef<HTMLTextAreaElement>(null);
  const presentAddressRef = useRef<HTMLTextAreaElement>(null);
  const phone1Ref = useRef<HTMLInputElement>(null);

  // Form State
  const [aadhaar, setAadhaar] = useState('');
  const [name, setName] = useState('');
  const [relationshipType, setRelationshipType] = useState<'Father' | 'Husband' | 'Wife'>('Father');
  const [relationshipName, setRelationshipName] = useState('');
  const [aadhaarAddress, setAadhaarAddress] = useState('');
  const [presentAddress, setPresentAddress] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [mandal, setMandal] = useState('');
  const [district, setDistrict] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  // Fingerprint State
  const [fingerprintUrl, setFingerprintUrl] = useState<string | null>(null);
  const [fingerprintTemplate, setFingerprintTemplate] = useState<string | null>(null);
  const [fingerprintAdded, setFingerprintAdded] = useState(false);

  // Camera Capture State
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  useEffect(() => {
    if (editId) {
      loadCustomerDetails(editId);
    } else {
      fetchNextId();
    }
    return () => {
      stopCamera();
    };
  }, [editId]);

  const loadCustomerDetails = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) {
        setEstimatedId(data.customer_id || 1);
        setAadhaar(data.aadhaar || '');
        setName(data.name || '');
        const rawRel = data.father_name || data.father_husband_name || '';
        if (rawRel.includes(':')) {
          const parts = rawRel.split(':');
          setRelationshipType(parts[0] as any);
          setRelationshipName(parts[1] || '');
        } else {
          setRelationshipType('Father');
          setRelationshipName(rawRel);
        }
        setAadhaarAddress(data.aadhaar_address || '');
        setPresentAddress(data.present_address || '');
        setHouseNo(data.address || '');
        setMandal(data.mandal || '');
        setDistrict(data.district || '');
        setPhone1(data.phone_1 || data.phone || '');
        setPhone2(data.phone_2 || data.phone2 || '');
        setPhotoUrl(data.customer_photo_url || null);
        setCapturedImage(data.customer_photo_url || null);
        setSignatureUrl(data.customer_fingerprint_image_url || null);
        setFingerprintUrl(data.fingerprint_url || null);
        setFingerprintTemplate(data.fingerprint_template || null);
        setFingerprintAdded(data.fingerprint_added || false);
      }
    } catch (err) {
      console.error('Error loading customer details:', err);
      toast.error('Failed to load customer details');
    }
  };

  const fetchNextId = async () => {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .select('customer_id')
        .order('customer_id', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      if (data && data.length > 0) {
        setEstimatedId((data[0].customer_id || 0) + 1);
      } else {
        setEstimatedId(1);
      }
    } catch (err) {
      console.error('Error fetching next Customer ID:', err);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast.error('Could not open camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    const rawFile = dataURLtoFile(dataUrl, 'temp.jpg');
    
    setSaving(true);
    try {
      const compressedBlob = await compressToWebP(rawFile, 1280, 0.7);
      
      const fileName = `cust_${Date.now()}_photo.webp`;
      
      const { error } = await supabase.storage
        .from('finance-photos')
        .upload(fileName, compressedBlob, { contentType: 'image/webp' });
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('finance-photos')
        .getPublicUrl(fileName);
        
      setPhotoUrl(publicUrl);
      setCapturedImage(publicUrl);
      toast.success('Photo captured and uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to capture photo');
    } finally {
      setSaving(false);
      stopCamera();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setSaving(true);
    try {
      const compressedBlob = await compressToWebP(file, 1280, 0.7);
      
      const fileName = `cust_${Date.now()}_photo.webp`;
      
      const { error } = await supabase.storage
        .from('finance-photos')
        .upload(fileName, compressedBlob, { contentType: 'image/webp' });
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('finance-photos')
        .getPublicUrl(fileName);
        
      setPhotoUrl(publicUrl);
      setCapturedImage(publicUrl);
      toast.success('Photo uploaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload photo');
    } finally {
      setSaving(false);
    }
  };

  const handleClearPhoto = () => {
    setPhotoUrl(null);
    setCapturedImage(null);
    stopCamera();
  };

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/webp';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const uploadSignature = async (signatureDataUrl: string | null) => {
    if (!signatureDataUrl) {
      setSignatureUrl(null);
      return;
    }
    setSaving(true);
    try {
      const fileName = `cust_${Date.now()}_sig.png`;
      const file = dataURLtoFile(signatureDataUrl, fileName);
      
      const { error } = await supabase.storage
        .from('finance-photos')
        .upload(fileName, file, { contentType: 'image/png' });
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('finance-photos')
        .getPublicUrl(fileName);
        
      setSignatureUrl(publicUrl);
      toast.success('Signature uploaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload signature');
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    setAadhaar('');
    setName('');
    setRelationshipType('Father');
    setRelationshipName('');
    setAadhaarAddress('');
    setPresentAddress('');
    setHouseNo('');
    setMandal('');
    setDistrict('');
    setPhone1('');
    setPhone2('');
    handleClearPhoto();
    setSignatureUrl(null);
    setFingerprintUrl(null);
    setFingerprintTemplate(null);
    setFingerprintAdded(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    // Validate
    const fields: ValidationField[] = [
      { name: 'name', label: 'Customer Name', value: name, required: true, ref: nameRef },
      { name: 'phone1', label: 'Phone 1', value: phone1, required: true, ref: phone1Ref },
      { name: 'aadhaarAddress', label: 'Aadhaar Address', value: aadhaarAddress, required: true, ref: aadhaarAddressRef },
      { name: 'presentAddress', label: 'Present Address', value: presentAddress, required: true, ref: presentAddressRef }
    ];

    const cleanAadhaar = aadhaar.replace(/\s+/g, '');
    if (cleanAadhaar && !/^\d{12}$/.test(cleanAadhaar)) {
      toast.error('Aadhaar UID must be exactly 12 digits');
      aadhaarRef.current?.focus();
      return;
    }

    const { isValid, errors: valErrors } = validateFinanceForm(fields);
    if (!isValid) {
      setErrors(valErrors);
      const firstErrorKey = Object.keys(valErrors)[0];
      const match = fields.find(f => f.name === firstErrorKey);
      if (match && match.ref && 'current' in match.ref && match.ref.current) {
        match.ref.current.focus();
      }
      return;
    }

    setSaving(true);
    try {
      if (!editId && cleanAadhaar) {
        const query = supabase.from('finance_customers').select('id, name, customer_id').eq('aadhaar', cleanAadhaar);
        const { data: existingCustomers } = await query.limit(1);

        if (existingCustomers && existingCustomers.length > 0) {
          const dup = existingCustomers[0];
          toast.error(`Customer with this Aadhaar already exists (Name: ${dup.name}, ID: ${dup.customer_id || 'N/A'}).`);
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: name.trim(),
        phone: phone1.trim() || null,
        phone2: phone2.trim() || null,
        partner_name: null,
        address: houseNo.trim() || null,
        aadhaar: cleanAadhaar || null,
        customer_photo_url: photoUrl || null,
        father_husband_name: `${relationshipType}:${relationshipName.trim()}`,
        father_name: `${relationshipType}:${relationshipName.trim()}`,
        aadhaar_address: aadhaarAddress.trim() || null,
        present_address: presentAddress.trim() || null,
        mandal: mandal.trim() || null,
        district: district.trim() || null,
        phone_1: phone1.trim() || null,
        phone_2: phone2.trim() || null,
        customer_fingerprint_image_url: signatureUrl || null,
        customer_fingerprint_template: null,
        customer_fingerprint_added: false,
        fingerprint_url: fingerprintUrl || null,
        fingerprint_template: fingerprintTemplate || null,
        fingerprint_added: fingerprintAdded
      };

      let result;
      if (editId) {
        const staffName = sessionStorage.getItem('thirumala_user') 
          ? JSON.parse(sessionStorage.getItem('thirumala_user')!).username 
          : 'Staff';
        result = await supabaseFinance.updateCustomer(editId, payload, staffName);
      } else {
        result = await supabaseFinance.createCustomer(payload);
      }

      if (result) {
        toast.success(editId ? 'Customer details updated successfully.' : 'Customer registered successfully.');
        if (!editId) {
          handleResetForm();
          fetchNextId();
        } else {
          navigate('/finance/customers');
        }
      } else {
        toast.error('Failed to save customer');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error processing request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 w-full select-none font-outfit text-slate-800 p-2">
      
      {/* Top Action Header */}
      <div className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
        <div>
          <h1 className="text-[24px] font-bold uppercase text-slate-900 tracking-tight leading-none">
            {editId ? `EDIT CUSTOMER PRO#${estimatedId}` : `NEW CUSTOMER REGISTRATION`}
          </h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase mt-1">
            Demographic, photograph, signature and biometrics
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(editId ? '/finance/customers' : '/finance')}
            className="inline-flex items-center justify-center gap-1 px-3 h-[48px] bg-white text-slate-700 border border-slate-250 rounded hover:bg-slate-50 font-bold text-[16px] uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center justify-center gap-1 px-3 h-[48px] bg-white text-red-700 border border-slate-250 rounded hover:bg-red-50 font-bold text-[16px] uppercase"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1 px-4 h-[48px] bg-[#0b1329] text-white border border-slate-800 rounded hover:bg-slate-800 font-bold text-[16px] uppercase disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Main Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
          
          {/* Row 1 Grid */}
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-12 md:col-span-3">
              <label className="uppercase block mb-1 text-[15px] font-bold text-slate-700">Customer Name *</label>
              <input
                type="text"
                ref={nameRef}
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors(p => ({...p, name: false})) }}
                placeholder="Full Name"
                className={`w-full bg-white border rounded px-3 text-[16px] text-slate-800 focus:outline-none h-[48px] font-bold ${errors.name ? 'border-red-500 bg-red-50' : 'border-slate-250 focus:ring-1 focus:ring-slate-900'}`}
                required
              />
            </div>
            
            <div className="col-span-4 md:col-span-2">
              <label className="uppercase block mb-1 text-[15px] font-bold text-slate-700">Relationship</label>
              <select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value as any)}
                className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[48px] font-bold"
              >
                <option value="Father">Father</option>
                <option value="Husband">Husband</option>
                <option value="Wife">Wife</option>
              </select>
            </div>

            <div className="col-span-8 md:col-span-4">
              <label className="uppercase block mb-1 text-[15px] font-bold text-slate-700">Relationship Name</label>
              <input
                type="text"
                value={relationshipName}
                onChange={(e) => setRelationshipName(e.target.value)}
                placeholder={`${relationshipType}'s Name`}
                className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[48px] font-bold uppercase"
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="uppercase block mb-1 text-[15px] font-bold text-slate-700 font-mono">Aadhaar (12-digit)</label>
              <input
                type="text"
                ref={aadhaarRef}
                value={aadhaar}
                onChange={(e) => { setAadhaar(e.target.value); setErrors(p => ({...p, aadhaar: false})) }}
                placeholder="12-digit Aadhaar UID"
                className={`w-full bg-white border rounded px-3 text-[16px] text-slate-800 focus:outline-none h-[48px] font-bold ${errors.aadhaar ? 'border-red-500 bg-red-50' : 'border-slate-250 focus:ring-1 focus:ring-slate-900'}`}
              />
            </div>
          </div>

          {/* Row 2 Grid */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-6">
              <label className="uppercase block mb-1 text-[15px] font-bold text-slate-700">Phone 1 *</label>
              <input
                type="text"
                ref={phone1Ref}
                value={phone1}
                onChange={(e) => { setPhone1(e.target.value); setErrors(p => ({...p, phone1: false})) }}
                placeholder="Primary Contact"
                className={`w-full bg-white border rounded px-3 text-[16px] text-slate-800 focus:outline-none h-[48px] font-bold ${errors.phone1 ? 'border-red-500 bg-red-50' : 'border-slate-250 focus:ring-1 focus:ring-slate-900'}`}
                required
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className="uppercase block mb-1 text-[15px] font-bold text-slate-700">Phone 2</label>
              <input
                type="text"
                value={phone2}
                onChange={(e) => setPhone2(e.target.value)}
                placeholder="Secondary Contact"
                className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] text-slate-850 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[48px] font-bold"
              />
            </div>
          </div>

          {/* Row 3 Grid */}
          <div className="grid grid-cols-12 gap-3 border-t border-slate-100 pt-3">
            <div className="col-span-12 md:col-span-4">
              <label className="block text-[15px] font-bold text-slate-700 uppercase mb-1">Aadhaar Address *</label>
              <textarea
                ref={aadhaarAddressRef}
                value={aadhaarAddress}
                onChange={(e) => { setAadhaarAddress(e.target.value); setErrors(p => ({...p, aadhaarAddress: false})) }}
                placeholder="Aadhaar Address (Door No, Street, Village, Mandal, District)"
                rows={3}
                className={`w-full bg-white border rounded p-2 text-[16px] text-slate-800 focus:outline-none resize-none font-bold ${errors.aadhaarAddress ? 'border-red-500 bg-red-50' : 'border-slate-250 focus:ring-1 focus:ring-slate-900'}`}
                required
              />
            </div>
            
            <div className="col-span-12 md:col-span-4">
              <label className="block text-[15px] font-bold text-slate-700 uppercase mb-1">Present Address *</label>
              <textarea
                ref={presentAddressRef}
                value={presentAddress}
                onChange={(e) => { setPresentAddress(e.target.value); setErrors(p => ({...p, presentAddress: false})) }}
                placeholder="Street / Village / Area"
                rows={3}
                className={`w-full bg-white border rounded p-2 text-[16px] text-slate-850 focus:outline-none resize-none font-bold ${errors.presentAddress ? 'border-red-500 bg-red-50' : 'border-slate-250 focus:ring-1 focus:ring-slate-900'}`}
                required
              />
            </div>

            <div className="col-span-12 md:col-span-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[15px] font-bold text-slate-700 uppercase mb-1">House No</label>
                <input
                  type="text"
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  placeholder="Door No"
                  className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[48px] font-bold uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-[15px] font-bold text-slate-700 uppercase mb-1">Mandal</label>
                <input
                  type="text"
                  value={mandal}
                  onChange={(e) => setMandal(e.target.value)}
                  placeholder="Mandal"
                  className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[48px] font-bold uppercase"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[15px] font-bold text-slate-700 uppercase mb-1">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="District"
                  className="w-full bg-white border border-slate-250 rounded px-3 text-[16px] text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[48px] font-bold uppercase"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Compressed Row: Photograph, Signature, Fingerprint */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Card 1: Photo Capture */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center space-y-2 shadow-sm">
            <span className="text-[15px] font-bold text-slate-700 uppercase">Customer Photograph</span>
            <div className="w-full h-24 bg-slate-50 rounded border border-slate-200 flex items-center justify-center overflow-hidden relative">
              {cameraActive ? (
                <video ref={videoRef} className="w-full h-full object-cover" />
              ) : capturedImage ? (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[14px] text-slate-400 font-bold uppercase">No Capture</span>
              )}
            </div>

            <div className="flex gap-1.5 w-full">
              {cameraActive ? (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-grow h-[38px] bg-slate-950 text-white rounded text-[16px] font-bold uppercase"
                >
                  Capture
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-grow h-[38px] bg-white text-slate-700 border border-slate-250 rounded text-[16px] font-bold uppercase inline-flex items-center justify-center gap-1 hover:bg-slate-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Camera
                </button>
              )}
              
              <label className="h-[38px] px-3 bg-white text-slate-700 border border-slate-250 rounded text-[16px] font-bold uppercase cursor-pointer hover:bg-slate-50 flex items-center justify-center">
                Browse
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {(capturedImage || photoUrl) && (
                <button
                  type="button"
                  onClick={handleClearPhoto}
                  className="px-2 h-[38px] bg-red-50 text-red-700 border border-red-250 rounded hover:bg-red-100 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <canvas ref={canvasRef} width={640} height={480} className="hidden" />
          </div>

          {/* Card 2: Signature Pad */}
          <SignaturePad
            existingUrl={signatureUrl}
            onSave={uploadSignature}
          />

          {/* Card 3: Fingerprint Biometric */}
          <BiometricScanner
            label="Fingerprint Biometric"
            existingTemplate={fingerprintTemplate}
            existingImageUrl={fingerprintUrl}
            onFingerprintSaved={(url, template, added) => {
              setFingerprintUrl(url);
              setFingerprintTemplate(template);
              setFingerprintAdded(added);
            }}
          />
        </div>
      </form>
    </div>
  );
};

export default NewCustomer;
