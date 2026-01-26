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
    
    // Clean up OCR artifacts - common misreads in poor lighting
    const cleanText = text
      .replace(/[|l1]/g, (m, offset, str) => {
        // Only replace when it looks like OCR noise, not in words
        const before = str[offset - 1] || ' ';
        const after = str[offset + 1] || ' ';
        if (!/[a-zA-Z]/.test(before) && !/[a-zA-Z]/.test(after)) return '1';
        return m;
      })
      .replace(/[O0]/g, (m, offset, str) => {
        // In number contexts, treat O as 0
        const context = str.slice(Math.max(0, offset - 2), offset + 3);
        if (/\d/.test(context)) return '0';
        return m;
      });
    
    // Serial Number patterns: N1-17552, N1-17670AB, etc.
    const serialMatch = cleanText.match(/(?:Serial\s*(?:#|No\.?)?:?\s*)?([A-Z]\d-\d{4,5}[A-Z]{0,2})/i);
    if (serialMatch) {
      result.serialNumber = serialMatch[1].toUpperCase();
    }
    
    // Lot Number: "Lot #: 18-Yulee" or "LOT# 18-Yulee"
    const lotMatch = cleanText.match(/(?:Lot\s*(?:#|No\.?)?:?\s*)([A-Z0-9][A-Z0-9\-]+)/i);
    if (lotMatch) {
      result.lotNumber = lotMatch[1].trim();
    }
    
    // Salesperson
    const salespersonMatch = cleanText.match(/(?:Salesperson|Sales\s*Rep|Sold\s*By)[:\s]*([A-Za-z]+)/i);
    if (salespersonMatch) {
      result.salesperson = salespersonMatch[1].trim();
    }
    
    // Setup By / Set Up
    const setupMatch = cleanText.match(/(?:Set\s*Up\s*By|Setup)[:\s]*([A-Za-z\s]+?)(?=\n|$)/i);
    if (setupMatch) {
      result.setupBy = setupMatch[1].trim();
    }
    
    // Claim Number: 5 digits
    const claimMatch = cleanText.match(/(?:Claim\s*(?:#|Number)?:?\s*)(\d{5})/i);
    if (claimMatch) {
      result.claimNumber = claimMatch[1];
    }
    
    // P.O. Number
    const poMatch = cleanText.match(/(?:P\.?O\.?\s*(?:#|No\.?)?:?\s*)(\d{4,6})/i);
    if (poMatch) {
      result.poNumber = poMatch[1];
    }
    
    // Model pattern
    const modelMatch = cleanText.match(/(?:Model\s*(?:#)?:?\s*)([A-Z0-9]+(?:\([0-9]+\))?)/i);
    if (modelMatch) {
      result.model = modelMatch[1];
    }
    
    // Phone numbers - find labeled phones first
    const homePhoneMatch = cleanText.match(/(?:Home\s*(?:Phone)?|H\/P)[:\s]*[(\s]*(\d{3})[)\s\-\/]*(\d{3})[\s\-\/]*(\d{4})/i);
    const workPhoneMatch = cleanText.match(/(?:Work\s*(?:Phone)?|W\/P|Bus(?:iness)?)[:\s]*[(\s]*(\d{3})[)\s\-\/]*(\d{3})[\s\-\/]*(\d{4})/i);
    
    if (homePhoneMatch) {
      result.phone = `${homePhoneMatch[1]}-${homePhoneMatch[2]}-${homePhoneMatch[3]}`;
    }
    if (workPhoneMatch) {
      result.workPhone = `${workPhoneMatch[1]}-${workPhoneMatch[2]}-${workPhoneMatch[3]}`;
    }
    
    // If no labeled phones found, try to find any phone numbers
    if (!result.phone) {
      const phoneMatches = cleanText.match(/[(\s]*(\d{3})[)\s\-\/]+(\d{3})[\s\-\/]+(\d{4})/g);
      if (phoneMatches && phoneMatches.length > 0) {
        for (const match of phoneMatches) {
          const cleaned = match.replace(/[^\d]/g, '');
          if (!cleaned.startsWith('352')) { // Skip Ocala plant numbers
            result.phone = `${cleaned.slice(0,3)}-${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
            break;
          }
        }
      }
    }
    
    // CUSTOMER NAME - FIRST PERSON ONLY
    // Strategy: Find labeled name first, then fall back to pattern matching
    // Only take the FIRST name found, ignore "&" or "and" secondary names
    
    // Try labeled name field first
    let nameMatch = cleanText.match(/(?:Name|Customer|Owner|Homeowner)[:\s]+([A-Za-z][A-Za-z\-\'\s]+?)(?=\s+(?:&|and|\n|\d|$))/i);
    
    if (nameMatch) {
      // Clean up: take only first person if multiple listed
      let name = nameMatch[1].trim();
      // Remove anything after & or "and"
      name = name.split(/\s*(?:&|and)\s*/i)[0].trim();
      // Remove trailing words that look like labels
      name = name.replace(/\s+(Home|Work|Phone|Address|St|Street|Rd|Road).*$/i, '').trim();
      if (name.split(' ').length >= 2 && name.split(' ').length <= 4) {
        result.customerName = name;
      }
    }
    
    // If no labeled name, look for name patterns in first 15 lines
    if (!result.customerName) {
      for (const line of lines.slice(0, 15)) {
        // Skip obvious non-name lines
        if (line.match(/SERVICE|DEPARTMENT|COPY|PLANT|OCALA|SW|STREET|FAX|PHONE|\d{5}|^\d+\s|^P\.?O|^LOT|^SERIAL/i)) continue;
        if (line.length < 5 || line.length > 40) continue;
        
        // Look for "Firstname Lastname" pattern (2-4 words, capitalized)
        const nameParts = line.split(/\s+/).filter(p => /^[A-Z][a-z]+$/.test(p));
        if (nameParts.length >= 2 && nameParts.length <= 4) {
          // Check it's not a place name
          const joined = nameParts.join(' ');
          if (!joined.match(/Service|Department|Ocala|Florida|Street|Road|Drive|Lane|Court/i)) {
            // Take only first two parts if there's an "&" situation
            const firstName = nameParts[0];
            const lastName = nameParts[nameParts.length - 1];
            result.customerName = `${firstName} ${lastName}`;
            break;
          }
        }
      }
    }
    
    // ADDRESS - More forgiving parsing for imperfect scans
    // Look for street number + street name pattern
    // Common OCR issues: numbers get garbled, letters get swapped
    
    // Try to find address with street suffix
    const streetSuffixes = 'ST|STREET|RD|ROAD|AVE|AVENUE|DR|DRIVE|LN|LANE|CT|COURT|WAY|BLVD|BOULEVARD|HWY|HIGHWAY|CR|PKWY|PARKWAY|CIR|CIRCLE|PL|PLACE|TRL|TRAIL|TER|TERRACE';
    const addressRegex = new RegExp(`(\\d+[\\s\\-]?(?:[A-Z])?\\s+(?:[NSEW]\\.?\\s+)?[A-Za-z0-9\\s]+(?:${streetSuffixes})\\.?)`, 'gi');
    const addressMatches = cleanText.match(addressRegex);
    
    if (addressMatches) {
      for (const addr of addressMatches) {
        // Skip the Ocala plant address
        if (addr.match(/3741|SW\s*7th|Ocala/i)) continue;
        // Clean up the address
        let cleanAddr = addr.trim().replace(/\s+/g, ' ');
        // Remove trailing junk
        cleanAddr = cleanAddr.replace(/\s+(FL|Florida|\d{5}).*$/i, '').trim();
        if (cleanAddr.length >= 10) {
          result.address = cleanAddr;
          break;
        }
      }
    }
    
    // If no address found with suffix, try looser pattern (number + words)
    if (!result.address) {
      const looseAddrMatch = cleanText.match(/(\d{2,5}\s+[A-Za-z][A-Za-z\s]{5,30}?)(?=\n|,|\s+FL|\s+Florida|\d{5})/i);
      if (looseAddrMatch && !looseAddrMatch[1].match(/3741|Ocala|Phone|Fax/i)) {
        result.address = looseAddrMatch[1].trim().replace(/\s+/g, ' ');
      }
    }
    
    // City, State, Zip - FL ZIP codes start with 3
    const cityStateZipMatches = cleanText.match(/([A-Za-z][A-Za-z\s]{2,20})[,\s]+(FL|Florida)[,\s]+(\d{5})/gi);
    if (cityStateZipMatches) {
      for (const match of cityStateZipMatches) {
        const parsed = match.match(/([A-Za-z][A-Za-z\s]{2,20})[,\s]+(FL|Florida)[,\s]+(\d{5})/i);
        if (parsed && !parsed[1].match(/Ocala/i)) {
          result.city = parsed[1].trim();
          result.state = 'FL';
          result.zip = parsed[3];
          break;
        }
      }
    }
    
    // Dealer name
    const dealerMatch = cleanText.match(/(?:Dealer|Prestige|Home\s*Center)[:\s]*([^\n]+)/i);
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
