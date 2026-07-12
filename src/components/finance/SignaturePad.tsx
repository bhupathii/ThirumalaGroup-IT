import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  existingUrl: string | null;
  onSave: (dataUrl: string | null) => void;
  readOnly?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ existingUrl, onSave, readOnly }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl);

  useEffect(() => {
    setPreviewUrl(existingUrl);
  }, [existingUrl]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    setPreviewUrl(null);
    onSave(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    const dataUrl = canvas.toDataURL('image/png');
    setPreviewUrl(dataUrl);
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col items-center space-y-2 border border-slate-200 rounded-xl p-3 bg-white w-full">
      <span className="text-xs font-bold text-slate-700 uppercase">Customer Signature</span>
      
      {previewUrl ? (
        <div className="border border-slate-200 rounded-lg bg-slate-50 w-full h-32 flex items-center justify-center relative overflow-hidden">
          <img src={previewUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
          {!readOnly && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-bold uppercase hover:bg-red-100 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      ) : (
        <div className="w-full">
          <canvas
            ref={canvasRef}
            width={320}
            height={128}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-crosshair w-full h-32"
          />
          {!readOnly && (
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={handleClear}
                className="bg-slate-100 text-slate-700 border px-3 py-1 rounded text-xs font-bold uppercase hover:bg-slate-200"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isEmpty}
                className="bg-slate-900 text-white border px-3 py-1 rounded text-xs font-bold uppercase hover:bg-slate-800 disabled:opacity-50"
              >
                Save Signature
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
