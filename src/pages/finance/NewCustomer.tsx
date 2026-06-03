import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  RotateCcw, 
  Save, 
  Camera, 
  FileImage, 
  X, 
  RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BiometricScanner } from '../../components/finance/BiometricScanner';

const NewCustomer: React.FC = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [estimatedId, setEstimatedId] = useState<number>(1);

  // Form State
  const [aadhaar, setAadhaar] = useState('');
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [village, setVillage] = useState('');
  const [mandal, setMandal] = useState('');
  const [district, setDistrict] = useState('');
  const [aadhaarAddress, setAadhaarAddress] = useState('');
  const [presentAddress, setPresentAddress] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Fingerprint State
  const [fingerprintUrl, setFingerprintUrl] = useState<string | null>(null);
  const [fingerprintTemplate, setFingerprintTemplate] = useState<string | null>(null);
  const [fingerprintAdded, setFingerprintAdded] = useState(false);

  // Camera Capture State
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchNextId();
    return () => {
      stopCamera();
    };
  }, []);

  const fetchNextId = async () => {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .select('customer_id')
        .order('customer_id', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setEstimatedId((data[0].customer_id || 0) + 1);
      } else {
        setEstimatedId(1);
      }
    } catch (err) {
      console.error('Error fetching next customer ID:', err);
    }
  };

  // Webcam Helpers
  const startCamera = async () => {
    try {
      setCapturedImage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error('Could not access camera. Please check device permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        stopCamera();
        uploadPhoto(dataUrl);
      }
    }
  };

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const uploadPhoto = async (base64Data: string) => {
    setUploading(true);
    try {
      const fileObj = dataURLtoFile(base64Data, `capture-${Date.now()}.jpg`);
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`photos/${fileObj.name}`, fileObj);

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      setPhotoUrl(publicUrl);
      toast.success('Photo uploaded successfully!');
    } catch (err) {
      console.error('Upload failed, falling back to direct base64:', err);
      // Fallback to storing base64 directly
      setPhotoUrl(base64Data);
      toast('Photo saved in database fallback.', { icon: '⚠️' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      setUploading(true);
      try {
        const { data, error } = await supabase.storage
          .from('finance-photos')
          .upload(`photos/upload-${Date.now()}-${file.name}`, file);

        if (error) throw error;

        const publicUrl = supabase.storage
          .from('finance-photos')
          .getPublicUrl(data.path).data.publicUrl;

        setPhotoUrl(publicUrl);
        toast.success('Image uploaded successfully!');
      } catch (err) {
        console.error('File upload failed, falling back to base64:', err);
        const base64Reader = new FileReader();
        base64Reader.onloadend = () => {
          setPhotoUrl(base64Reader.result as string);
        };
        base64Reader.readAsDataURL(file);
        toast('Using base64 image encoding fallback.', { icon: '⚠️' });
      } finally {
        setUploading(false);
      }
    }
  };

  const handleClearPhoto = () => {
    stopCamera();
    setCapturedImage(null);
    setPhotoUrl(null);
  };

  const handleResetForm = () => {
    if (!window.confirm('Are you sure you want to clear the form?')) return;
    setAadhaar('');
    setName('');
    setFatherName('');
    setVillage('');
    setMandal('');
    setDistrict('');
    setAadhaarAddress('');
    setPresentAddress('');
    setPhone1('');
    setPhone2('');
    handleClearPhoto();
    setFingerprintUrl(null);
    setFingerprintTemplate(null);
    setFingerprintAdded(false);
    toast.success('Form reset successfully');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Customer Name is required');
      return;
    }

    setSaving(true);
    try {
      const result = await supabaseFinance.createCustomer({
        name: name.trim(),
        phone: phone1 || null,
        phone2: phone2 || null,
        partner_name: null,
        address: presentAddress || null,
        aadhaar: aadhaar || null,
        customer_photo_url: photoUrl,
        father_husband_name: fatherName || null,
        
        // Redesign columns
        father_name: fatherName || null,
        village: village || null,
        mandal: mandal || null,
        district: district || null,
        aadhaar_address: aadhaarAddress || null,
        present_address: presentAddress || null,
        phone_1: phone1 || null,
        phone_2: phone2 || null,

        // Fingerprints
        fingerprint_url: fingerprintUrl || null,
        fingerprint_template: fingerprintTemplate || null,
        fingerprint_added: fingerprintAdded,
        customer_fingerprint_template: fingerprintTemplate || null,
        customer_fingerprint_image_url: fingerprintUrl || null,
        customer_fingerprint_added: fingerprintAdded
      });

      if (result) {
        toast.success(`Customer ${name} registered successfully!`);
        navigate('/finance/customers');
      } else {
        toast.error('Failed to register customer. Check if Aadhaar is duplicate.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none print:p-0">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            DASHBOARD / CUSTOMERS / NEW
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">NEW CUSTOMER</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
            REGISTER A NEW CUSTOMER IN THE MASTER LIST
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* Two-Column Grid Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Customer Details Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
              CUSTOMER DETAILS
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    CUSTOMER ID
                  </label>
                  <input
                    type="text"
                    value={estimatedId}
                    readOnly
                    disabled
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-500 focus:outline-none cursor-not-allowed"
                  />
                  <span className="text-[9px] text-slate-400 font-bold mt-1 block uppercase tracking-wide">
                    AUTO-GENERATED
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    AADHAAR
                  </label>
                  <input
                    type="text"
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value)}
                    placeholder="12-digit Aadhaar UID"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    FATHER
                  </label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Father's or Husband's name"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    VILLAGE
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="Village Name"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    MANDAL
                  </label>
                  <input
                    type="text"
                    value={mandal}
                    onChange={(e) => setMandal(e.target.value)}
                    placeholder="Mandal Name"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    DISTRICT
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="District Name"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Address Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    AADHAAR ADDRESS
                  </label>
                  <textarea
                    value={aadhaarAddress}
                    onChange={(e) => setAadhaarAddress(e.target.value)}
                    placeholder="Address details as printed on Aadhaar card"
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none resize-y"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    PRESENT ADDRESS
                  </label>
                  <textarea
                    value={presentAddress}
                    onChange={(e) => setPresentAddress(e.target.value)}
                    placeholder="Current residential address details"
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none resize-y"
                  />
                </div>
              </div>

              {/* Phone Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    PHONE 1
                  </label>
                  <input
                    type="text"
                    value={phone1}
                    onChange={(e) => setPhone1(e.target.value)}
                    placeholder="Primary 10-digit number"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    PHONE 2
                  </label>
                  <input
                    type="text"
                    value={phone2}
                    onChange={(e) => setPhone2(e.target.value)}
                    placeholder="Secondary contact number"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Photo Card */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">
                CUSTOMER PHOTO
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                UPLOAD OR CAPTURE. SAVED WITH CUSTOMER RECORD.
              </p>
            </div>

            {/* Photo Box Container */}
            <div className="relative border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6 flex flex-col items-center justify-center min-h-[240px] overflow-hidden shadow-inner">
              
              {/* Camera Active State */}
              {cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute bottom-4 flex gap-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow hover:bg-emerald-700 flex items-center gap-1"
                    >
                      <Camera className="w-4 h-4" />
                      CAPTURE
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold shadow hover:bg-slate-700"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {/* Preview State */}
              {capturedImage && !cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-2">
                  <img
                    src={capturedImage}
                    alt="Preview"
                    className="w-full h-full object-contain rounded-lg"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
                    </div>
                  )}
                  <div className="absolute bottom-4 flex gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-bold shadow-sm hover:bg-orange-100 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      RETAKE
                    </button>
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      className="px-3 py-1.5 bg-red-50 text-red-650 border border-red-200 rounded-lg text-[10px] font-bold shadow-sm hover:bg-red-100 flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      CLEAR
                    </button>
                  </div>
                </div>
              )}

              {/* Default Empty State */}
              {!cameraActive && !capturedImage && (
                <div className="text-center space-y-4 w-full flex flex-col items-center">
                  <div 
                    onClick={startCamera}
                    className="cursor-pointer group flex flex-col items-center space-y-2 p-4"
                  >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-orange-500 group-hover:scale-105 transition-all">
                      <Camera className="w-6 h-6 stroke-1.5" />
                    </div>
                    <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest block pt-1">
                      CUSTOMER PHOTO
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                      CLICK TO CAPTURE PHOTO
                    </span>
                  </div>

                  <div className="w-full flex items-center justify-center gap-2 pt-2 border-t border-slate-100/60">
                    <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm inline-flex items-center gap-1.5 uppercase tracking-wider">
                      <FileImage className="w-3.5 h-3.5 text-slate-500" />
                      OR SELECT FROM DEVICE
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden elements */}
            <canvas ref={canvasRef} width="640" height="480" className="hidden" />
          </div>

          {/* Fingerprint Capture Card */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <BiometricScanner
              label="Customer Fingerprint Capture"
              existingTemplate={fingerprintTemplate}
              existingImageUrl={fingerprintUrl}
              onFingerprintSaved={(url, template, added) => {
                setFingerprintUrl(url);
                setFingerprintTemplate(template);
                setFingerprintAdded(added);
              }}
            />
          </div>
        </div>

      </form>
    </div>
  );
};

export default NewCustomer;
