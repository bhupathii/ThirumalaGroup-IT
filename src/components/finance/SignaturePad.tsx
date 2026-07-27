import React, { useRef, useState, useEffect } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SignaturePadProps {
  existingUrl: string | null;
  onSave: (dataUrl: string | null) => void;
  readOnly?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ existingUrl, onSave, readOnly }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'draw' | 'browse'>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl);

  useEffect(() => {
    setPreviewUrl(existingUrl);
  }, [existingUrl]);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setIsEmpty(true);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onSave(null);
  };

  const handleSaveDrawn = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) {
      toast.error('Please draw a signature first');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    setPreviewUrl(dataUrl);
    onSave(dataUrl);
  };

  const handleBrowseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewUrl(dataUrl);
      onSave(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center space-y-2 shadow-sm w-full">
      <div className="flex items-center justify-between w-full">
        <span className="text-[15px] font-bold text-slate-700 uppercase">Customer Signature</span>
        {!readOnly && (
          <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setMode('draw')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-colors ${mode === 'draw' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Draw
            </button>
            <button
              type="button"
              onClick={() => setMode('browse')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-colors ${mode === 'browse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Browse
            </button>
          </div>
        )}
      </div>

      {/* Preview or Active Input */}
      {previewUrl ? (
        <div className="w-full h-24 bg-slate-50 rounded border border-slate-200 flex items-center justify-center relative overflow-hidden p-1">
          <img src={previewUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
          {!readOnly && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-1 right-1 bg-red-50 text-red-600 border border-red-200 p-1 rounded text-xs font-bold hover:bg-red-100 transition-colors"
              title="Clear Signature"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : mode === 'draw' ? (
        <div className="w-full">
          <canvas
            ref={canvasRef}
            width={320}
            height={96}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="border border-dashed border-slate-300 rounded bg-slate-50 cursor-crosshair w-full h-24 touch-none"
          />
          {!readOnly && (
            <div className="flex justify-end gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={handleClear}
                className="px-2 h-[32px] bg-slate-100 text-slate-700 border rounded text-[12px] font-bold uppercase hover:bg-slate-200"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSaveDrawn}
                disabled={isEmpty}
                className="px-3 h-[32px] bg-slate-900 text-white rounded text-[12px] font-bold uppercase hover:bg-slate-800 disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-24 bg-slate-50 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center p-2 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleBrowseFileChange}
            className="hidden"
            id="sig-file-upload"
          />
          <label
            htmlFor="sig-file-upload"
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded shadow-sm text-xs font-bold uppercase text-slate-700 hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            Select Signature File
          </label>
          <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">JPG, PNG, WebP (Max 5MB)</span>
        </div>
      )}
    </div>
  );
};
