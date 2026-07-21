import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

interface VoiceRecorderProps {
  onTranscriptionCompleted: (text: string) => void;
  disabled?: boolean;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptionCompleted, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // MAX DURATION: 45 seconds
  const MAX_RECORDING_TIME = 45;

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options: MediaRecorderOptions = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options = { mimeType: 'audio/webm' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options = { mimeType: 'audio/mp4' };
      }
      options.audioBitsPerSecond = 128000; // High quality
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
        
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        if (elapsed < 2) {
          toast.error('Recording too short (minimum 2 seconds).');
          return;
        }
        
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('Microphone permission denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    console.log(`[DEBUG] 3. Frontend audio duration approx: ${recordingTime}s`);
    
    const formData = new FormData();
    // Groq Whisper expects a file
    formData.append('file', audioBlob, 'recording.webm');
    
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.text) {
        onTranscriptionCompleted(data.text);
      } else {
        toast.error('No speech detected.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Unable to transcribe audio. Retry.');
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording && !isProcessing && (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-900 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
        >
          <span role="img" aria-label="mic" className="text-[14px]">🎤</span> Start Recording
        </button>
      )}

      {isRecording && (
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded bg-red-100 text-red-700 font-mono text-[12px] font-black flex items-center gap-1.5 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
            {formatTime(recordingTime)}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
          >
            ■ Stop
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 rounded-lg">
          <svg className="animate-spin -ml-1 h-3 w-3 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
