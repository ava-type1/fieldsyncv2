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
  phone?: string;       // Home phone
  workPhone?: string;   // Work phone
  cellPhone?: string;   // Cell phone
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

  // Parse extracted text - optimized for Nobility Homes Service Department forms
  // Form layout: Header (Ocala/plant), Name, Address, City/State/Zip, Phone numbers, Serial
  const parseWorkOrderText = (text: string): ScannedWorkOrder => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result: ScannedWorkOrder = { rawText: text };
    
    console.log('OCR Raw Text:', text); // Debug logging
    
    // === SERIAL NUMBER ===
    // Pattern: Letter + digit + dash + 4-5 digits, optionally followed by letters
    // Examples: N1-17552, N1-17670AB, A2-12345
    const serialMatch = text.match(/([A-Z]\d[\-\s]?\d{4,5}[A-Z]{0,2})/i);
    if (serialMatch) {
      result.serialNumber = serialMatch[1].replace(/\s/g, '').toUpperCase();
    }
    
    // === PHONE NUMBERS ===
    // Find ALL phone numbers first, then categorize them
    // Match various formats: (904) 555-1234, 904-555-1234, 904 555 1234, 9045551234
    const phonePattern = /[(\s]*(\d{3})[)\s.\-\/]*(\d{3})[\s.\-\/]*(\d{4})/g;
    const allPhones: string[] = [];
    let phoneMatch;
    
    while ((phoneMatch = phonePattern.exec(text)) !== null) {
      const num = `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
      // Skip Ocala plant number (352 area code starting with 352-629 or 352-854)
      if (!num.startsWith('352-629') && !num.startsWith('352-854') && !num.startsWith('352-622')) {
        allPhones.push(num);
      }
    }
    
    // Look for labeled phones
    const homeMatch = text.match(/(?:Home|H\/?P|Home\s*Phone)[:\s]*[(\s]*(\d{3})[)\s.\-\/]*(\d{3})[\s.\-\/]*(\d{4})/i);
    const workMatch = text.match(/(?:Work|W\/?P|Work\s*Phone|Bus(?:iness)?)[:\s]*[(\s]*(\d{3})[)\s.\-\/]*(\d{3})[\s.\-\/]*(\d{4})/i);
    const cellMatch = text.match(/(?:Cell|C\/?P|Cell\s*Phone|Mobile)[:\s]*[(\s]*(\d{3})[)\s.\-\/]*(\d{3})[\s.\-\/]*(\d{4})/i);
    
    if (homeMatch) {
      result.phone = `${homeMatch[1]}-${homeMatch[2]}-${homeMatch[3]}`;
    }
    if (workMatch) {
      result.workPhone = `${workMatch[1]}-${workMatch[2]}-${workMatch[3]}`;
    }
    if (cellMatch) {
      result.cellPhone = `${cellMatch[1]}-${cellMatch[2]}-${cellMatch[3]}`;
    }
    
    // If we didn't find labeled phones, use unlabeled ones in order found
    if (!result.phone && allPhones.length > 0) {
      result.phone = allPhones[0];
    }
    if (!result.workPhone && allPhones.length > 1) {
      result.workPhone = allPhones[1];
    }
    if (!result.cellPhone && allPhones.length > 2) {
      result.cellPhone = allPhones[2];
    }
    
    // === CUSTOMER NAME ===
    // The name is typically one of the first lines after the header
    // Look for a line that's just a name (First Last or First Middle Last)
    // Skip: anything with numbers, known headers, addresses
    
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const line = lines[i];
      
      // Skip empty or too short
      if (line.length < 4) continue;
      
      // Skip known header/junk lines
      if (line.match(/SERVICE|DEPARTMENT|OCALA|PLANT|COPY|FAX|PHONE|STREET|SW\s+\d|^\d{3}[\s\-]|^\(\d{3}\)|3741|32674|FLORIDA|^FL\s/i)) continue;
      
      // Skip lines that look like addresses (start with numbers)
      if (/^\d+\s/.test(line)) continue;
      
      // Skip lines with ZIP codes or phone-like patterns
      if (/\d{5}/.test(line) || /\d{3}[\s\-]\d{3}[\s\-]\d{4}/.test(line)) continue;
      
      // A name line should be mostly letters and spaces, 2-4 words
      const words = line.split(/\s+/).filter(w => w.length > 1);
      const letterWords = words.filter(w => /^[A-Za-z\-\']+$/.test(w));
      
      if (letterWords.length >= 2 && letterWords.length <= 4 && letterWords.length === words.length) {
        // Check each word is capitalized (or all caps)
        const looksLikeName = letterWords.every(w => /^[A-Z]/.test(w));
        if (looksLikeName) {
          // Take first name only (before any & or "and")
          let name = letterWords.join(' ');
          name = name.split(/\s*[&]\s*/)[0].trim();
          
          // Make sure it's not a place or label
          if (!name.match(/Service|Department|Ocala|Florida|Street|Road|Drive|Phone|Home|Work|Cell|Dealer/i)) {
            result.customerName = name;
            break;
          }
        }
      }
    }
    
    // === ADDRESS ===
    // Address line starts with a number, contains street name
    const streetSuffixes = '(?:ST|STREET|RD|ROAD|AVE|AVENUE|DR|DRIVE|LN|LANE|CT|COURT|WAY|BLVD|HWY|CR|PKWY|CIR|PL|TRL|TER)\\.?';
    
    for (const line of lines) {
      // Skip Ocala plant address
      if (line.match(/3741|SW\s*7th/i)) continue;
      
      // Look for: number + street name + optional suffix
      const addrMatch = line.match(new RegExp(`^(\\d+\\s+(?:[NSEW]\\.?\\s+)?[A-Za-z0-9\\s]+?(?:${streetSuffixes})?)[,\\s]*$`, 'i'));
      if (addrMatch) {
        const addr = addrMatch[1].trim().replace(/\s+/g, ' ');
        if (addr.length >= 8 && !addr.match(/Ocala/i)) {
          result.address = addr;
          break;
        }
      }
    }
    
    // Fallback: any line starting with number that's not a phone or ZIP
    if (!result.address) {
      for (const line of lines) {
        if (line.match(/3741|Ocala|^\d{5}$|^\d{3}[\-\s]\d{3}/i)) continue;
        if (/^\d+\s+[A-Za-z]/.test(line) && line.length >= 10 && line.length <= 50) {
          result.address = line.replace(/\s+/g, ' ').replace(/[,]?\s*(FL|Florida)?\s*\d{5}.*$/i, '').trim();
          if (result.address.length >= 8) break;
        }
      }
    }
    
    // === CITY, STATE, ZIP ===
    // Look for: City, FL 32XXX or City FL 32XXX patterns
    const cityStateZip = text.match(/([A-Za-z][A-Za-z\s]{1,25}?)[,\s]+(FL|Florida)[,\s]+(\d{5})/i);
    if (cityStateZip && !cityStateZip[1].match(/Ocala/i)) {
      result.city = cityStateZip[1].trim();
      result.state = 'FL';
      result.zip = cityStateZip[3];
    }
    
    // If no city found but we have a ZIP, try to find city near it
    if (!result.city) {
      const zipMatch = text.match(/(\d{5})(?!\d)/);
      if (zipMatch && zipMatch[1].startsWith('3') && zipMatch[1] !== '32674') {
        result.zip = zipMatch[1];
        result.state = 'FL';
      }
    }
    
    // === OTHER FIELDS (lower priority) ===
    
    // Lot Number
    const lotMatch = text.match(/(?:Lot\s*(?:#|No\.?)?[:\s]*)([A-Z0-9][A-Z0-9\-]+)/i);
    if (lotMatch) {
      result.lotNumber = lotMatch[1].trim();
    }
    
    // P.O. Number
    const poMatch = text.match(/(?:P\.?O\.?\s*(?:#|No\.?)?[:\s]*)(\d{4,6})/i);
    if (poMatch) {
      result.poNumber = poMatch[1];
    }
    
    // Model
    const modelMatch = text.match(/(?:Model\s*(?:#)?[:\s]*)([A-Z0-9]+(?:\([0-9]+\))?)/i);
    if (modelMatch) {
      result.model = modelMatch[1];
    }
    
    // Dealer
    const dealerMatch = text.match(/(?:Dealer|Prestige)[:\s]*([^\n]{3,30})/i);
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
                {scannedData.cellPhone && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cell Phone</span>
                    <span className="text-white">{scannedData.cellPhone}</span>
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
