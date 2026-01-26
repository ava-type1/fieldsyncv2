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

  // Start camera with optimal settings for document scanning
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // Request better exposure for documents
          advanced: [{
            exposureMode: 'continuous',
            focusMode: 'continuous',
            whiteBalanceMode: 'continuous'
          }] as any
        }
      });
      
      // Try to enable torch/flash if available (helps with lighting)
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities?.torch) {
        try {
          await track.applyConstraints({ advanced: [{ torch: true }] } as any);
        } catch (e) {
          // Torch not available, that's fine
        }
      }
      
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

  // Enhance image for better OCR (boost contrast and brightness)
  const enhanceImageForOCR = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Increase contrast and brightness for document scanning
    const contrast = 1.3;  // 30% more contrast
    const brightness = 20; // Slight brightness boost
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast and brightness to RGB channels
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));     // R
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness)); // G
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness)); // B
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

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
      
      // Enhance the image for better OCR
      enhanceImageForOCR(ctx, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/png'); // PNG for better quality
      setImageData(dataUrl);
      stopCamera();
      processImage(dataUrl);
    }
  }, [stopCamera]);

  // Handle file upload - also enhance for OCR
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      
      // Load image and enhance it
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            enhanceImageForOCR(ctx, canvas.width, canvas.height);
            const enhancedDataUrl = canvas.toDataURL('image/png');
            setImageData(enhancedDataUrl);
            stopCamera();
            processImage(enhancedDataUrl);
            return;
          }
        }
        // Fallback if canvas not available
        setImageData(dataUrl);
        stopCamera();
        processImage(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Parse extracted text - optimized for Nobility Homes Service Department forms
  // Form layout: 
  //   Header: Plant #1, 3741 SW 7th street, Ocala FL 34474, Phone/Fax
  //   Name: [First Last]  [Second person name - ignore]
  //   Address: [street address]
  //   City: [city] State: [st] Zip: [zip]
  //   Home Ph: [xxx-xxx-xxxx] Work Ph: [xxx-xxx-xxxx] Cell Ph: [xxx-xxx-xxxx]
  //   Serial #: [X#-#####AB]
  const parseWorkOrderText = (text: string): ScannedWorkOrder => {
    const result: ScannedWorkOrder = { rawText: text };
    
    console.log('=== OCR Raw Text ===\n', text, '\n=== END ===');
    
    // Normalize the text: collapse multiple spaces, normalize line endings
    const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
    
    // === SERIAL NUMBER ===
    // Pattern: X#-#####[AB] - letter, digit, dash, 5 digits, optional letters
    // Examples: N1-17697AB, N1-17552, A2-12345XY
    const serialMatch = normalized.match(/(?:Serial\s*#?[:\s]*)?([A-Z]\d[\-\s]?\d{5}[A-Z]{0,2})/i);
    if (serialMatch) {
      result.serialNumber = serialMatch[1].replace(/[\s]/g, '').toUpperCase();
    }
    
    // === NAME ===
    // IMPORTANT: The customer name comes RIGHT AFTER the "Name" label on the form
    // Salesperson name comes after "Sales person" label - we must NOT grab that
    
    // First, try to find text immediately after "Name" label but BEFORE "Address" or other fields
    // Format: "Name Jessica Noel-Medeiros" or "Name    Bruce Pappy    Donna Pappy"
    
    // Pattern: "Name" followed by name (possibly hyphenated), stopping before Address/Home/Dealer/Sales
    const nameAfterLabel = normalized.match(/Name\s+([A-Z][a-z]+(?:[\-\s][A-Z][a-z]+)+)(?=\s+(?:Address|Home|Dealer|Sales|Serial|\d|$))/i);
    
    if (nameAfterLabel) {
      let fullName = nameAfterLabel[1].trim();
      // If there are two people (e.g., "Bruce Pappy Donna Pappy"), take only the first
      // Split by double-capital pattern (end of one name, start of another)
      const twoPeopleMatch = fullName.match(/^([A-Z][a-z]+(?:[\-\s][A-Z][a-z\-]+)?)\s+[A-Z][a-z]+\s+[A-Z]/);
      if (twoPeopleMatch) {
        fullName = twoPeopleMatch[1];
      }
      // Handle "Firstname Lastname" or "Firstname Hyphen-Lastname"
      const nameParts = fullName.split(/\s+/);
      if (nameParts.length >= 2) {
        result.customerName = nameParts.slice(0, 3).join(' '); // Take up to 3 parts (First Middle-Last or First Last Jr.)
      }
    }
    
    // Fallback: Look in the area between "Name" and "Address" labels
    if (!result.customerName) {
      const betweenLabels = normalized.match(/Name\s+([\s\S]+?)\s+Address/i);
      if (betweenLabels) {
        // Extract name pattern from this section
        const section = betweenLabels[1];
        const nameMatch = section.match(/([A-Z][a-z]+(?:[\-][A-Z][a-z]+)?)\s+([A-Z][a-z]+(?:[\-][A-Z][a-z]+)?)/);
        if (nameMatch) {
          result.customerName = `${nameMatch[1]} ${nameMatch[2]}`;
        }
      }
    }
    
    // Last resort: Look for common first names but NOT after "Sales person" or "Salesperson"
    if (!result.customerName) {
      const commonFirstNames = /^(james|john|robert|michael|david|william|richard|joseph|thomas|charles|christopher|daniel|matthew|anthony|mark|steven|paul|andrew|joshua|kenneth|kevin|brian|george|timothy|ronald|edward|jason|jeffrey|ryan|jacob|gary|nicholas|eric|jonathan|stephen|larry|justin|scott|brandon|benjamin|samuel|gregory|alexander|patrick|dennis|tyler|aaron|adam|nathan|henry|zachary|peter|kyle|bruce|sean|christian|austin|arthur|jesse|dylan|bryan|joe|jordan|albert|logan|randy|roy|eugene|russell|mason|philip|louis|carl|ethan|keith|roger|barry|walter|noah|alan|donna|mary|patricia|jennifer|linda|barbara|elizabeth|susan|jessica|sarah|karen|lisa|nancy|betty|margaret|sandra|ashley|kimberly|emily|michelle|dorothy|carol|amanda|melissa|deborah|stephanie|rebecca|sharon|laura|cynthia|kathleen|amy|angela|anna|brenda|pamela|emma|nicole|helen|samantha|katherine|christine|rachel|janet|catherine|maria|heather|diane|ruth|julie|olivia|joyce|virginia|victoria|kelly|lauren|christina|megan|andrea|cheryl|hannah|martha|gloria|teresa|sara|madison|kathryn|janice|jean|alice|sophia|grace|denise|amber|marilyn|danielle|isabella|diana|natalie|brittany|charlotte|marie|kayla|alexis|velvet)$/i;
      
      // Remove the salesperson section from consideration
      const textWithoutSales = normalized.replace(/Sales\s*person\s+[A-Za-z\s]+/gi, '');
      
      // Find name patterns
      const namePatterns = textWithoutSales.match(/([A-Z][a-z]+)\s+([A-Z][a-z]+(?:[\-][A-Z][a-z]+)?)/g) || [];
      
      for (const potentialName of namePatterns) {
        const parts = potentialName.trim().split(/\s+/);
        const firstName = parts[0];
        
        // Skip place names and labels
        if (potentialName.match(/florida|ocala|jacksonville|trenton|plant|street|lane|drive|road|service|department|phone|dealer|serial|model/i)) continue;
        
        if (commonFirstNames.test(firstName)) {
          result.customerName = potentialName;
          break;
        }
      }
    }
    
    // === ADDRESS ===
    // Look for street address pattern: number + street name
    // Examples: "7109 SE 77 Lane", "15510 CR 121", "123 Main Street"
    const addressPatterns = normalized.match(/(\d{2,5}\s+(?:[NSEW]{1,2}\s+)?(?:\d+\s+)?[A-Za-z]+(?:\s+[A-Za-z]+)?(?:\s+(?:Lane|Ln|Street|St|Road|Rd|Drive|Dr|Avenue|Ave|Court|Ct|Circle|Cir|Way|Place|Pl|Boulevard|Blvd|Trail|Trl|Terrace|Ter|CR|SR|HWY))?)/gi) || [];
    
    for (const addr of addressPatterns) {
      // Skip Ocala plant address
      if (addr.match(/3741|7th\s*street|SW\s*7/i)) continue;
      // Skip if it's just numbers
      if (/^\d+$/.test(addr.trim())) continue;
      
      const cleanAddr = addr.trim().replace(/\s+/g, ' ');
      if (cleanAddr.length >= 8) {
        result.address = cleanAddr;
        break;
      }
    }
    
    // === CITY, STATE, ZIP ===
    // Format: "City    bryceville    State  fl    Zip    32009"
    // Or might be: "Trenton FL 32693" or "Trenton, FL 32693"
    
    // Try labeled format first
    let cityMatch = normalized.match(/City\s+([A-Za-z][A-Za-z\s]*?)(?=\s+(?:State|FL|Fl|fl))/i);
    if (cityMatch) {
      result.city = cityMatch[1].trim();
      result.city = result.city.charAt(0).toUpperCase() + result.city.slice(1).toLowerCase();
    }
    
    const stateMatch = normalized.match(/(?:State\s+)?([Ff][Ll])(?=\s+(?:Zip|\d{5}))/i);
    if (stateMatch) {
      result.state = 'FL';
    }
    
    // Find ZIP but skip Ocala plant ZIPs (34474, 33474)
    const zipMatches = normalized.match(/(?:Zip\s+)?(\d{5})(?!\d)/gi) || [];
    for (const zm of zipMatches) {
      const zip = zm.replace(/\D/g, '');
      // Skip Ocala plant ZIP codes
      if (zip !== '34474' && zip !== '33474') {
        result.zip = zip;
        break;
      }
    }
    
    // Fallback: Look for "City, FL ZIP" or "City FL ZIP" pattern
    if (!result.city) {
      const cityStateZip = normalized.match(/([A-Z][a-z]+(?:ville|ton|land|burg|ford|field|wood|beach|springs|park)?)[,\s]+(?:FL|Fl|fl)[,\s]+(\d{5})/);
      if (cityStateZip && cityStateZip[1].toLowerCase() !== 'ocala') {
        result.city = cityStateZip[1];
        result.state = 'FL';
        result.zip = cityStateZip[2];
      }
    }
    
    // Another fallback: common Florida city names in text
    const flCities = normalized.match(/(Trenton|Chiefland|Gainesville|Jacksonville|Ocala|Tampa|Orlando|Tallahassee|Pensacola|Miami|Bryceville|Yulee|Starke|Palatka|Lake\s*City|Live\s*Oak|Perry|Madison|Mayo|Cross\s*City|Bronson|Williston|Archer|Newberry|Alachua|High\s*Springs|Fort\s*White)/i);
    if (flCities && !result.city && flCities[1].toLowerCase() !== 'ocala') {
      result.city = flCities[1].charAt(0).toUpperCase() + flCities[1].slice(1).toLowerCase();
      result.state = 'FL';
    }
    
    // === PHONE NUMBERS ===
    // Format variations: 
    //   "Ph: 352-284-2512 Work Ph: 352-810-6125 Cell Ph:"
    //   "Home Ph: 904-759-3894  Work Ph: 727-463-9890  Cell Ph:"
    // Phone patterns: xxx-xxx-xxxx, (xxx) xxx-xxxx, xxx xxx xxxx, xxxxxxxxxx
    const phoneRegex = /[(\s]*(\d{3})[)\s.\-]*(\d{3})[\s.\-]*(\d{4})/;
    
    // Home/Primary phone - look for "Ph:" or "Home Ph:" 
    const homePhMatch = normalized.match(new RegExp(`(?:Home\\s*)?Ph[:\\s]*${phoneRegex.source}`, 'i'));
    if (homePhMatch) {
      result.phone = `${homePhMatch[1]}-${homePhMatch[2]}-${homePhMatch[3]}`;
    }
    
    // Work phone
    const workPhMatch = normalized.match(new RegExp(`Work\\s*Ph[:\\s]*${phoneRegex.source}`, 'i'));
    if (workPhMatch) {
      result.workPhone = `${workPhMatch[1]}-${workPhMatch[2]}-${workPhMatch[3]}`;
    }
    
    // Cell phone
    const cellPhMatch = normalized.match(new RegExp(`Cell\\s*Ph[:\\s]*${phoneRegex.source}`, 'i'));
    if (cellPhMatch) {
      result.cellPhone = `${cellPhMatch[1]}-${cellPhMatch[2]}-${cellPhMatch[3]}`;
    }
    
    // Fallback: find all phone numbers and assign in order, skipping plant numbers
    const phonePattern = /[(\s]*(\d{3})[)\s.\-]*(\d{3})[\s.\-]*(\d{4})/g;
    const allPhones: string[] = [];
    let phoneMatch;
    
    while ((phoneMatch = phonePattern.exec(normalized)) !== null) {
      const num = `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
      // Skip plant numbers (352-732-xxxx)
      if (!num.startsWith('352-732')) {
        // Avoid duplicates
        if (!allPhones.includes(num)) {
          allPhones.push(num);
        }
      }
    }
    
    // Fill in any missing phones from the list
    if (!result.phone && allPhones.length > 0) result.phone = allPhones[0];
    if (!result.workPhone && allPhones.length > 1) result.workPhone = allPhones[1];
    if (!result.cellPhone && allPhones.length > 2) result.cellPhone = allPhones[2];
    
    // === LOT / DEALER ===
    // Format: "Dealer    Lot 18-Yulee"
    const lotMatch = normalized.match(/(?:Dealer|Lot)\s+(?:Lot\s+)?(\d+[\-\s][A-Za-z]+)/i);
    if (lotMatch) {
      result.lotNumber = lotMatch[1].trim();
      result.dealer = `Lot ${lotMatch[1].trim()}`;
    }
    
    // === MODEL ===
    const modelMatch = normalized.match(/Model\s*#?\s+([A-Za-z0-9\s]+?)(?=\s+(?:C\s*of|Date|$|\n))/i);
    if (modelMatch) {
      result.model = modelMatch[1].trim();
    }
    
    // === SALESPERSON ===
    const salespersonMatch = normalized.match(/Sales\s*person\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (salespersonMatch) {
      result.salesperson = salespersonMatch[1].trim();
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
