import { useState, useRef, useCallback } from 'react';
import { createWorker, Worker } from 'tesseract.js';
import { Camera, X, Loader2, Check, RotateCcw, Zap } from 'lucide-react';
import { Button } from '../ui/Button';

export interface ScannedWorkOrder {
  serialNumber?: string;
  customerName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  poNumber?: string;
  claimNumber?: string;
  model?: string;
  dealer?: string;
  rawText: string;
}

interface WorkOrderScannerProps {
  onScanComplete: (data: ScannedWorkOrder) => void;
  onClose: () => void;
}

export function WorkOrderScanner({ onScanComplete, onClose }: WorkOrderScannerProps) {
  const [step, setStep] = useState<'capture' | 'processing' | 'review'>('capture');
  const [imageData, setImageData] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ScannedWorkOrder | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please check permissions.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Capture image
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setImageData(dataUrl);
      stopCamera();
      processImage(dataUrl);
    }
  }, [stopCamera]);

  // Parse extracted text to find fields
  const parseWorkOrderText = (text: string): ScannedWorkOrder => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result: ScannedWorkOrder = { rawText: text };
    
    // Serial Number patterns: N1-17670AB, N1-16279AB, etc.
    const serialMatch = text.match(/(?:Serial\s*(?:#|No\.?)?:?\s*)?([A-Z]\d-\d{5}[A-Z]{0,2})/i);
    if (serialMatch) {
      result.serialNumber = serialMatch[1].toUpperCase();
    }
    
    // Claim Number: 5 digits
    const claimMatch = text.match(/(?:Claim\s*(?:#|Number)?:?\s*)(\d{5})/i);
    if (claimMatch) {
      result.claimNumber = claimMatch[1];
    }
    
    // P.O. Number
    const poMatch = text.match(/(?:P\.?O\.?\s*(?:#|No\.?)?:?\s*)(\d{4,6})/i);
    if (poMatch) {
      result.poNumber = poMatch[1];
    }
    
    // Model pattern
    const modelMatch = text.match(/(?:Model\s*(?:#)?:?\s*)([A-Z0-9]+(?:\([0-9]+\))?)/i);
    if (modelMatch) {
      result.model = modelMatch[1];
    }
    
    // Phone numbers: xxx-xxx-xxxx or xxx/xxx-xxxx
    const phoneMatch = text.match(/(?:Phone:?\s*)?(\d{3}[\/\-]\d{3}[\/\-]\d{4})/);
    if (phoneMatch) {
      result.phone = phoneMatch[1].replace(/\//g, '-');
    }
    
    // Look for owner/customer name - usually after "Owner" or near address
    // Common pattern: NAME in caps followed by address
    const ownerMatch = text.match(/(?:Owner|Customer)\s*:?\s*([A-Z][A-Z\s\/]+?)(?=\n|\d)/i);
    if (ownerMatch) {
      result.customerName = ownerMatch[1].trim();
    } else {
      // Try to find a name in ALL CAPS that looks like a person name
      const capsNameMatch = text.match(/\n([A-Z][A-Z]+(?:\s*\/\s*[A-Z]+)?\s+[A-Z][A-Z]+)\n/);
      if (capsNameMatch) {
        result.customerName = capsNameMatch[1];
      }
    }
    
    // Address pattern - number followed by street
    const addressMatch = text.match(/(\d+\s+(?:NW|NE|SW|SE|N|S|E|W)?\s*[A-Z0-9\s]+(?:ST|STREET|RD|ROAD|AVE|AVENUE|DR|DRIVE|LN|LANE|CT|COURT|WAY|BLVD|HWY|CR|PKWY))/i);
    if (addressMatch) {
      result.address = addressMatch[1].trim();
    }
    
    // City, State, Zip - FL ZIP codes start with 3
    const cityStateZipMatch = text.match(/([A-Z][A-Z]+)\s+(FL|FLORIDA)\s+(\d{5})/i);
    if (cityStateZipMatch) {
      result.city = cityStateZipMatch[1];
      result.state = 'FL';
      result.zip = cityStateZipMatch[3];
    }
    
    // Dealer name - look for common dealer patterns
    const dealerMatch = text.match(/(?:Dealer|Prestige|Home\s*Center)[:\s]*([^\n]+)/i);
    if (dealerMatch) {
      result.dealer = dealerMatch[1].trim();
    }
    
    return result;
  };

  // Process image with OCR
  const processImage = async (dataUrl: string) => {
    setStep('processing');
    setProgress(0);
    setError(null);
    
    try {
      // Create worker
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      
      workerRef.current = worker;
      
      // Run OCR
      const { data: { text } } = await worker.recognize(dataUrl);
      
      // Parse the text
      const parsed = parseWorkOrderText(text);
      setScannedData(parsed);
      setStep('review');
      
      // Cleanup
      await worker.terminate();
      workerRef.current = null;
      
    } catch (err) {
      console.error('OCR error:', err);
      setError('Failed to process image. Please try again.');
      setStep('capture');
      setImageData(null);
    }
  };

  // Retake photo
  const retake = () => {
    setImageData(null);
    setScannedData(null);
    setStep('capture');
    startCamera();
  };

  // Confirm and use data
  const confirmData = () => {
    if (scannedData) {
      onScanComplete(scannedData);
    }
  };

  // Initialize camera on mount
  useState(() => {
    startCamera();
    return () => {
      stopCamera();
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  });

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/80 px-4 py-3 flex items-center justify-between">
        <h2 className="text-white font-medium">
          {step === 'capture' && 'Scan Work Order'}
          {step === 'processing' && 'Processing...'}
          {step === 'review' && 'Review Extracted Data'}
        </h2>
        <button onClick={onClose} className="text-white p-2">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Capture Step */}
      {step === 'capture' && (
        <>
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() => videoRef.current?.play()}
            />
            
            {/* Overlay guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/50 rounded-lg w-[90%] h-[70%] flex items-center justify-center">
                <p className="text-white/70 text-sm bg-black/50 px-3 py-1 rounded">
                  Align work order within frame
                </p>
              </div>
            </div>
            
            {error && (
              <div className="absolute bottom-20 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg">
                {error}
              </div>
            )}
          </div>
          
          <div className="bg-black/80 p-4 pb-safe">
            <Button onClick={captureImage} fullWidth size="lg">
              <Camera className="w-5 h-5 mr-2" />
              Capture
            </Button>
          </div>
        </>
      )}

      {/* Processing Step */}
      {step === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {imageData && (
            <img 
              src={imageData} 
              alt="Captured" 
              className="max-w-full max-h-[40vh] rounded-lg mb-6 opacity-50"
            />
          )}
          
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
          <p className="text-white text-lg mb-2">Reading work order...</p>
          
          <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-gray-400 text-sm mt-2">{progress}%</p>
        </div>
      )}

      {/* Review Step */}
      {step === 'review' && scannedData && (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-gray-900 rounded-lg p-4 space-y-4">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Extracted Data
              </h3>
              
              {/* Extracted fields */}
              <div className="space-y-3">
                {scannedData.serialNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Serial #</span>
                    <span className="text-white font-mono">{scannedData.serialNumber}</span>
                  </div>
                )}
                {scannedData.customerName && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Customer</span>
                    <span className="text-white">{scannedData.customerName}</span>
                  </div>
                )}
                {scannedData.address && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Address</span>
                    <span className="text-white text-right text-sm">{scannedData.address}</span>
                  </div>
                )}
                {(scannedData.city || scannedData.state || scannedData.zip) && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">City/State/Zip</span>
                    <span className="text-white">
                      {[scannedData.city, scannedData.state, scannedData.zip].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {scannedData.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone</span>
                    <span className="text-white">{scannedData.phone}</span>
                  </div>
                )}
                {scannedData.poNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">P.O. #</span>
                    <span className="text-white">{scannedData.poNumber}</span>
                  </div>
                )}
                {scannedData.claimNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Claim #</span>
                    <span className="text-white">{scannedData.claimNumber}</span>
                  </div>
                )}
                {scannedData.model && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Model</span>
                    <span className="text-white">{scannedData.model}</span>
                  </div>
                )}
                {scannedData.dealer && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Dealer</span>
                    <span className="text-white text-right text-sm">{scannedData.dealer}</span>
                  </div>
                )}
              </div>
              
              {/* No data warning */}
              {!scannedData.serialNumber && !scannedData.customerName && (
                <div className="bg-yellow-900/50 text-yellow-200 px-3 py-2 rounded text-sm">
                  ⚠️ Couldn't extract key fields. Try retaking with better lighting or angle.
                </div>
              )}
              
              {/* Raw text preview (collapsible) */}
              <details className="mt-4">
                <summary className="text-gray-500 text-sm cursor-pointer">
                  View raw text
                </summary>
                <pre className="mt-2 text-xs text-gray-400 whitespace-pre-wrap bg-black/50 p-2 rounded max-h-32 overflow-y-auto">
                  {scannedData.rawText}
                </pre>
              </details>
            </div>
          </div>
          
          <div className="bg-black/80 p-4 pb-safe space-y-2">
            <Button onClick={confirmData} fullWidth>
              <Check className="w-5 h-5 mr-2" />
              Use This Data
            </Button>
            <Button variant="secondary" onClick={retake} fullWidth>
              <RotateCcw className="w-5 h-5 mr-2" />
              Retake Photo
            </Button>
          </div>
        </>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
