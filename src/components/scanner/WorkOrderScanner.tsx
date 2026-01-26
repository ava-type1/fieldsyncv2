import { useState, useRef, useCallback } from 'react';
import { createWorker, Worker } from 'tesseract.js';
import { Camera, X, Loader2, Check, RotateCcw, Zap, Upload } from 'lucide-react';
import { Button } from '../ui/Button';

export interface ScannedWorkOrder {
  serialNumber?: string;
  customerName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  workPhone?: string;
  poNumber?: string;
  claimNumber?: string;
  model?: string;
  dealer?: string;
  lotNumber?: string;
  salesperson?: string;
  setupBy?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      setError('Could not access camera. Please check permissions or use file upload.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Capture image from camera
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

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageData(dataUrl);
      stopCamera();
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Parse extracted text to find fields - optimized for Service Department forms
  const parseWorkOrderText = (text: string): ScannedWorkOrder => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result: ScannedWorkOrder = { rawText: text };
    
    // Normalize text for easier matching
    const normalizedText = text.replace(/\s+/g, ' ');
    
    // Serial Number patterns: N1-17552, N1-17670AB, etc.
    const serialMatch = text.match(/(?:Serial\s*(?:#|No\.?)?:?\s*)?([A-Z]\d-\d{4,5}[A-Z]{0,2})/i);
    if (serialMatch) {
      result.serialNumber = serialMatch[1].toUpperCase();
    }
    
    // Lot Number: "Lot #: 18-Yulee" or "LOT# 18-Yulee" or just pattern matching
    const lotMatch = text.match(/(?:Lot\s*(?:#|No\.?)?:?\s*)([A-Z0-9\-]+)/i) ||
                     text.match(/(\d{1,3}[\-\s]?[A-Za-z]+)(?=\s|$)/); // Pattern like "18-Yulee"
    if (lotMatch) {
      result.lotNumber = lotMatch[1].trim();
    }
    
    // Salesperson
    const salespersonMatch = text.match(/(?:Salesperson|Sales\s*Rep|Sold\s*By)[:\s]*([A-Za-z]+)/i);
    if (salespersonMatch) {
      result.salesperson = salespersonMatch[1].trim();
    }
    
    // Setup By / Set Up
    const setupMatch = text.match(/(?:Set\s*Up\s*By|Setup)[:\s]*([A-Za-z\s]+?)(?=\n|$)/i);
    if (setupMatch) {
      result.setupBy = setupMatch[1].trim();
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
    
    // Phone numbers - try to find Home Phone and Work Phone separately
    // Look for labeled phone numbers first
    const homePhoneMatch = text.match(/(?:Home\s*(?:Phone)?|H\/P)[:\s]*[(\s]*(\d{3})[)\s\-\/]*(\d{3})[\s\-\/]*(\d{4})/i);
    const workPhoneMatch = text.match(/(?:Work\s*(?:Phone)?|W\/P|Bus(?:iness)?)[:\s]*[(\s]*(\d{3})[)\s\-\/]*(\d{3})[\s\-\/]*(\d{4})/i);
    
    if (homePhoneMatch) {
      result.phone = `${homePhoneMatch[1]}-${homePhoneMatch[2]}-${homePhoneMatch[3]}`;
    }
    if (workPhoneMatch) {
      result.workPhone = `${workPhoneMatch[1]}-${workPhoneMatch[2]}-${workPhoneMatch[3]}`;
    }
    
    // If no labeled phones found, try to find any phone numbers
    if (!result.phone) {
      const phoneMatches = text.match(/[(\s]*(\d{3})[)\s\-\/]+(\d{3})[\s\-\/]+(\d{4})/g);
      if (phoneMatches && phoneMatches.length > 0) {
        // First phone found that's not in the header (skip 352 area code for Ocala plant)
        for (const match of phoneMatches) {
          const cleaned = match.replace(/[^\d]/g, '');
          if (!cleaned.startsWith('352')) { // Skip Ocala plant numbers
            result.phone = `${cleaned.slice(0,3)}-${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
            break;
          }
        }
      }
    }
    
    // Customer Name - look for patterns common in service forms
    // Try "Name:" or "Customer:" label first
    let nameMatch = text.match(/(?:Name|Customer|Owner)[:\s]+([A-Za-z][A-Za-z\-\'\s]+?)(?=\n|\d|$)/i);
    
    if (!nameMatch) {
      // Look for a name pattern near the top (after SERVICE DEPARTMENT header)
      // Names are often in format: "FirstName LastName" or "FirstName MiddleInitial LastName"
      // Skip lines that look like addresses or the plant header
      for (const line of lines.slice(0, 15)) {
        // Skip obvious non-name lines
        if (line.match(/SERVICE|DEPARTMENT|COPY|PLANT|OCALA|SW|STREET|FAX|\d{5}|^\d+\s/i)) continue;
        
        // Look for name pattern: two or more capitalized words, possibly with hyphens
        const potentialName = line.match(/^([A-Z][a-z]+(?:[\-\'][A-Z]?[a-z]+)?(?:\s+[A-Z][a-z]+(?:[\-\'][A-Z]?[a-z]+)?)+)$/);
        if (potentialName) {
          result.customerName = potentialName[1];
          break;
        }
      }
    } else {
      result.customerName = nameMatch[1].trim();
    }
    
    // If still no name, try a more aggressive pattern
    if (!result.customerName) {
      const capsNameMatch = text.match(/([A-Z][a-z]+(?:[\-\s][A-Z][a-z]+)+)/);
      if (capsNameMatch && !capsNameMatch[1].match(/Service|Department|Ocala|Florida|Street/i)) {
        result.customerName = capsNameMatch[1];
      }
    }
    
    // Address - look for street number followed by street name
    // Skip the plant address (3741 SW 7th Street, Ocala)
    const addressMatches = text.match(/(\d+\s+(?!SW\s*7th)(?:NW|NE|SW|SE|N|S|E|W\.?\s+)?[A-Za-z0-9\s]+(?:ST|STREET|RD|ROAD|AVE|AVENUE|DR|DRIVE|LN|LANE|CT|COURT|WAY|BLVD|HWY|CR|PKWY|CIR|CIRCLE)\.?)/gi);
    
    if (addressMatches) {
      // Find the address that's NOT the Ocala plant
      for (const addr of addressMatches) {
        if (!addr.match(/3741|SW\s*7th|Ocala/i)) {
          result.address = addr.trim().replace(/\s+/g, ' ');
          break;
        }
      }
    }
    
    // City, State, Zip - FL ZIP codes start with 3
    // Skip Ocala (plant location)
    const cityStateZipMatches = text.match(/([A-Za-z\s]+)[,\s]+(FL|Florida)\s+(\d{5})/gi);
    if (cityStateZipMatches) {
      for (const match of cityStateZipMatches) {
        const parsed = match.match(/([A-Za-z\s]+)[,\s]+(FL|Florida)\s+(\d{5})/i);
        if (parsed && !parsed[1].match(/Ocala/i)) {
          result.city = parsed[1].trim();
          result.state = 'FL';
          result.zip = parsed[3];
          break;
        }
      }
    }
    
    // Dealer name
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
          {step === 'capture' && 'Scan Service Form'}
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
                  Align service form within frame
                </p>
              </div>
            </div>
            
            {error && (
              <div className="absolute bottom-20 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg">
                {error}
              </div>
            )}
          </div>
          
          <div className="bg-black/80 p-4 pb-safe space-y-2">
            <Button onClick={captureImage} fullWidth size="lg">
              <Camera className="w-5 h-5 mr-2" />
              Capture
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={() => fileInputRef.current?.click()} 
              fullWidth
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload from Gallery
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
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
          <p className="text-white text-lg mb-2">Reading form...</p>
          
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
                    <span className="text-gray-400">Home Phone</span>
                    <span className="text-white">{scannedData.phone}</span>
                  </div>
                )}
                {scannedData.workPhone && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Work Phone</span>
                    <span className="text-white">{scannedData.workPhone}</span>
                  </div>
                )}
                
                <div className="border-t border-gray-700 my-2" />
                
                {scannedData.serialNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Serial #</span>
                    <span className="text-white font-mono">{scannedData.serialNumber}</span>
                  </div>
                )}
                {scannedData.lotNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lot #</span>
                    <span className="text-white">{scannedData.lotNumber}</span>
                  </div>
                )}
                {scannedData.salesperson && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Salesperson</span>
                    <span className="text-white">{scannedData.salesperson}</span>
                  </div>
                )}
                {scannedData.setupBy && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Setup By</span>
                    <span className="text-white">{scannedData.setupBy}</span>
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
