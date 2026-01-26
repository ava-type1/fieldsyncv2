import { useState, useRef, useCallback } from 'react';
import { createWorker, Worker } from 'tesseract.js';
import { Camera, X, Loader2, Check, RotateCcw, Zap, Upload } from 'lucide-react';
import { Button } from '../ui/Button';

// Scan tip removed - landscape orientation didn't improve OCR results

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
  const nativeCameraRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Start camera with optimal settings for document scanning
  const startCamera = useCallback(async () => {
    try {
      // Request highest available resolution for better OCR accuracy
      // Use min constraints to ensure we don't get a low-quality stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { min: 1920, ideal: 4096 },
          height: { min: 1080, ideal: 2160 },
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

  // Calculate the visible crop region when using object-fit: cover
  // This ensures we capture exactly what the user sees in the viewfinder
  const calculateCoverCrop = (video: HTMLVideoElement) => {
    // Get the actual video dimensions (full frame from camera)
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    // Get the display dimensions (what the user sees)
    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;
    
    // Calculate aspect ratios
    const videoAspect = videoWidth / videoHeight;
    const displayAspect = displayWidth / displayHeight;
    
    let sx = 0, sy = 0, sw = videoWidth, sh = videoHeight;
    
    if (videoAspect > displayAspect) {
      // Video is wider than display - crop horizontally
      // Video height fills display, width is cropped
      sw = videoHeight * displayAspect;
      sx = (videoWidth - sw) / 2;
    } else {
      // Video is taller than display - crop vertically
      // Video width fills display, height is cropped
      sh = videoWidth / displayAspect;
      sy = (videoHeight - sh) / 2;
    }
    
    return { sx, sy, sw, sh };
  };

  // Capture image from camera
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Calculate the visible region (what the user sees with object-fit: cover)
    const { sx, sy, sw, sh } = calculateCoverCrop(video);
    
    // Set canvas to the cropped dimensions
    canvas.width = sw;
    canvas.height = sh;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw only the visible portion of the video
      // drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      
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

  // Known Nobility Homes model names for fuzzy matching
  const NOBILITY_MODELS = [
    'Hailey', 'Kingswood', 'Tropic Isle', 'Kensington', 'Lakewood', 'Magnolia',
    'Palm Bay', 'Cedar Key', 'Bay Shore', 'Regency', 'Brookhaven', 'Wind Zone',
    'Cypress', 'Coastal', 'Windsor', 'Carolina', 'Sandalwood', 'Flagler', 'Sunrise'
  ];
  
  // Common OCR substitution errors and corrections
  const ocrCorrections: Record<string, string> = {
    // Common letter misreads for Taylor
    'raylor': 'Taylor', 'laylor': 'Taylor', '1aylor': 'Taylor', 'Tay1or': 'Taylor', 'Tayl0r': 'Taylor',
    'Halley': 'Hailey', 'Ha1ley': 'Hailey', 'Hai1ey': 'Hailey', 'Hailay': 'Hailey',
    'l-lailey': 'Hailey', 'Hai ley': 'Hailey',
    'lessica': 'Jessica', 'Jessíca': 'Jessica', '1essica': 'Jessica', 'Jess1ca': 'Jessica',
    'lacksonville': 'Jacksonville', '1acksonville': 'Jacksonville', 'Jacksonvi11e': 'Jacksonville',
    'Noe1': 'Noel', 'N0el': 'Noel',
    'Mede1ros': 'Medeiros', 'Medeirns': 'Medeiros', 'Medeiros': 'Medeiros',
    'rrent': 'Trent', 'lrent': 'Trent', 'rrentn': 'Trenton', 'lrenton': 'Trenton',
    // State variations
    'Fl': 'FL', 'fl': 'FL', 'fL': 'FL',
  };
  
  // Apply OCR corrections to text
  const applyOcrCorrections = (text: string): string => {
    let corrected = text;
    for (const [wrong, right] of Object.entries(ocrCorrections)) {
      corrected = corrected.replace(new RegExp(wrong, 'gi'), right);
    }
    // Fix common OCR issues: lowercase at start of word that should be caps
    // e.g., "raylor" -> "Taylor", "lessica" -> "Jessica"
    corrected = corrected.replace(/\b([rl1])([aeiou][a-z]+)\b/gi, (match, first, rest) => {
      const lowerMatch = match.toLowerCase();
      // Check if this looks like a name that should start with T or J
      if (lowerMatch.match(/^[rl1]aylor/i)) return 'Taylor';
      if (lowerMatch.match(/^[l1]essica/i)) return 'Jessica';
      if (lowerMatch.match(/^[l1]ack/i)) return match.replace(/^[l1]/i, 'J');
      return match;
    });
    return corrected;
  };
  
  // Fuzzy match against known model names
  const fuzzyMatchModel = (text: string): string | null => {
    const cleanText = text.toLowerCase().replace(/[^a-z\s]/gi, '');
    
    for (const model of NOBILITY_MODELS) {
      const modelLower = model.toLowerCase();
      // Direct match
      if (cleanText.includes(modelLower)) return model;
      
      // Fuzzy match: allow 1-2 character differences
      const words = cleanText.split(/\s+/);
      for (const word of words) {
        if (word.length < 4) continue;
        // Check Levenshtein-like similarity
        let matches = 0;
        const shorter = word.length < modelLower.length ? word : modelLower;
        const longer = word.length < modelLower.length ? modelLower : word;
        for (let i = 0; i < shorter.length; i++) {
          if (longer.includes(shorter[i])) matches++;
        }
        // If 80%+ characters match, consider it a match
        if (matches / shorter.length >= 0.8 && shorter.length >= 4) {
          return model;
        }
      }
    }
    return null;
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
    
    // Apply OCR corrections first
    let normalized = applyOcrCorrections(text);
    
    // Normalize: collapse multiple spaces, normalize line endings
    normalized = normalized.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
    
    // Remove known header content that shouldn't be parsed as customer data
    // Plant address: "Plant #1, 3741 SW 7th Street, Ocala FL 34474"
    const withoutHeader = normalized
      .replace(/Plant\s*#?\s*\d[^,\n]*Ocala[^,\n]*34474[^,\n]*/gi, '')
      .replace(/3741\s*SW\s*7th\s*[Ss]treet/gi, '')
      .replace(/Ocala\s*,?\s*FL\s*,?\s*34474/gi, '')
      .replace(/352[-.\s]*732[-.\s]*\d{4}/g, ''); // Remove plant phone numbers
    
    console.log('=== After header removal ===\n', withoutHeader, '\n=== END ===');
    
    // === SERIAL NUMBER ===
    // Pattern: X#-#####[AB] - letter, digit, dash, 5 digits, optional letters
    // Examples: N1-17697AB, N1-17552, A2-12345XY
    const serialMatch = normalized.match(/(?:Serial\s*#?[:\s]*)?([A-Z]\d[\-\s]?\d{5}[A-Z]{0,2})/i);
    if (serialMatch) {
      result.serialNumber = serialMatch[1].replace(/[\s]/g, '').toUpperCase();
    }
    
    // === NAME ===
    // Strategy: Look for "Name" label, then extract the capitalized name that follows
    // OCR may garble text, so we also try pattern matching on name-like text
    
    // First: Look for text between "Name" label and next field label
    // The form shows: "Name Jessica Noel-Medeiros" followed by another name or "Address"
    const nameSection = withoutHeader.match(/Name\s+([\s\S]{5,60}?)(?=\s*(?:Address|Home\s*Ph|Dealer|Sales|Serial|\n\s*\n|$))/i);
    
    if (nameSection) {
      const section = nameSection[1];
      // Look for capitalized name patterns: "First Last" or "First Last-Name" or "First Middle Last"
      // Must have capital at start, may have hyphen
      const nameMatch = section.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:[\-][A-Z][a-z]+)?)/);
      if (nameMatch) {
        result.customerName = nameMatch[1].trim();
      }
    }
    
    // Fallback: Scan entire text (minus plant header) for name patterns
    if (!result.customerName) {
      // Common first names - extensive list
      const firstNamePattern = /\b(James|John|Robert|Michael|David|William|Richard|Joseph|Thomas|Charles|Christopher|Daniel|Matthew|Anthony|Mark|Steven|Paul|Andrew|Joshua|Kenneth|Kevin|Brian|George|Timothy|Ronald|Edward|Jason|Jeffrey|Ryan|Jacob|Gary|Nicholas|Eric|Jonathan|Stephen|Larry|Justin|Scott|Brandon|Benjamin|Samuel|Gregory|Alexander|Patrick|Dennis|Tyler|Aaron|Adam|Nathan|Henry|Zachary|Peter|Kyle|Bruce|Sean|Christian|Austin|Arthur|Jesse|Dylan|Bryan|Joe|Jordan|Albert|Logan|Randy|Roy|Eugene|Russell|Mason|Philip|Louis|Carl|Ethan|Keith|Roger|Barry|Walter|Noah|Alan|Donna|Mary|Patricia|Jennifer|Linda|Barbara|Elizabeth|Susan|Jessica|Sarah|Karen|Lisa|Nancy|Betty|Margaret|Sandra|Ashley|Kimberly|Emily|Michelle|Dorothy|Carol|Amanda|Melissa|Deborah|Stephanie|Rebecca|Sharon|Laura|Cynthia|Kathleen|Amy|Angela|Anna|Brenda|Pamela|Emma|Nicole|Helen|Samantha|Katherine|Christine|Rachel|Janet|Catherine|Maria|Heather|Diane|Ruth|Julie|Olivia|Joyce|Virginia|Victoria|Kelly|Lauren|Christina|Megan|Andrea|Cheryl|Hannah|Martha|Gloria|Teresa|Sara|Madison|Kathryn|Janice|Jean|Alice|Sophia|Grace|Denise|Amber|Marilyn|Danielle|Isabella|Diana|Natalie|Brittany|Charlotte|Marie|Kayla|Alexis|Taylor|Velvet|Crystal|Tiffany|Brandy|Destiny)\s+([A-Z][a-z]+(?:[\-][A-Z][a-z]+)?)/;
      
      // Don't match names in salesperson section
      const textWithoutSales = withoutHeader.replace(/Sales\s*person[:\s]+[A-Za-z\s]+/gi, '___SALES___');
      
      const fnMatch = textWithoutSales.match(firstNamePattern);
      if (fnMatch) {
        result.customerName = `${fnMatch[1]} ${fnMatch[2]}`;
      }
    }
    
    // === ADDRESS ===
    // Look for "Address" label followed by street address
    // CRITICAL: Skip Ocala plant address (3741 SW 7th Street)
    
    // Try labeled format
    const addressAfterLabel = withoutHeader.match(/Address\s+(\d+\s*[A-Za-z0-9\s]+?)(?=\s*(?:City|State|Zip|Home|Ph|$))/i);
    if (addressAfterLabel) {
      let addr = addressAfterLabel[1].trim();
      // Fix mushed text: "SE77" -> "SE 77", "77lane" -> "77 Lane"
      addr = addr.replace(/([A-Za-z])(\d)/g, '$1 $2');
      addr = addr.replace(/(\d)([A-Za-z])/g, '$1 $2');
      addr = addr.replace(/\s+/g, ' ').trim();
      // Capitalize street suffix
      addr = addr.replace(/\b(lane|ln|street|st|road|rd|drive|dr|avenue|ave|court|ct|circle|cir|way|place|pl|boulevard|blvd|trail|trl|terrace|ter)\b/gi, 
        (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
      if (addr.length >= 5 && !addr.match(/3741|7th/i)) {
        result.address = addr;
      }
    }
    
    // Fallback: Look for street number patterns
    if (!result.address) {
      const addressPatterns = withoutHeader.match(/(\d{3,5}\s*(?:[NSEW]{1,2}\s*)?(?:\d+\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)/gi) || [];
      
      for (const addr of addressPatterns) {
        // Skip Ocala plant address
        if (addr.match(/3741|7th\s*street|SW\s*7/i)) continue;
        if (/^\d+$/.test(addr.trim())) continue;
        // Skip form field keywords
        if (addr.match(/Phone|Serial|Claim|Model|Date|Ocala|Plant|Service|Department|Copy|Fax|Lot|Setup|Sales|Dealer|Cell|Work|Home|Zip|State|City/i)) continue;
        
        let cleanAddr = addr.trim();
        cleanAddr = cleanAddr.replace(/([A-Za-z])(\d)/g, '$1 $2');
        cleanAddr = cleanAddr.replace(/(\d)([A-Za-z])/g, '$1 $2');
        cleanAddr = cleanAddr.replace(/\s+/g, ' ');
        
        if (cleanAddr.length >= 8) {
          result.address = cleanAddr;
          break;
        }
      }
    }
    
    // === CITY, STATE, ZIP ===
    // Format: "City Jacksonville State FL Zip 32208"
    // CRITICAL: Must NOT pick up Ocala/34474 from plant header
    
    // Try labeled format: "City [name] State"
    let cityMatch = withoutHeader.match(/City\s+([A-Za-z][A-Za-z\s]*?)(?=\s+(?:State|FL|Fl|fl))/i);
    if (cityMatch && !cityMatch[1].match(/Ocala/i)) {
      result.city = cityMatch[1].trim();
      // Proper case
      result.city = result.city.split(/\s+/).map(w => 
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
    }
    
    // State - look for "State FL" or standalone "FL" near zip
    const stateMatch = withoutHeader.match(/State\s+([A-Z]{2})|([A-Z]{2})\s+(?:Zip\s*)?\d{5}/i);
    if (stateMatch) {
      result.state = (stateMatch[1] || stateMatch[2]).toUpperCase();
    }
    
    // ZIP: Must skip Ocala plant ZIPs (34474, 33474)
    // Look for "Zip XXXXX" pattern first
    const zipLabelMatch = withoutHeader.match(/Zip\s+(\d{5})/i);
    if (zipLabelMatch && !['34474', '33474'].includes(zipLabelMatch[1])) {
      result.zip = zipLabelMatch[1];
    }
    
    // Fallback: find ZIPs not associated with Ocala
    if (!result.zip) {
      // Find all 5-digit numbers that look like ZIPs (not part of phone, serial, etc.)
      const potentialZips = withoutHeader.match(/(?<![0-9\-])(\d{5})(?![0-9\-])/g) || [];
      for (const pz of potentialZips) {
        // Skip Ocala area codes and plant ZIP
        if (!['34474', '33474', '34471', '34472', '34473', '34475', '34476', '34477', '34478', '34479', '34480', '34481', '34482', '34483'].includes(pz)) {
          result.zip = pz;
          break;
        }
      }
    }
    
    // Try "City, FL ZIP" or "City FL ZIP" pattern
    if (!result.city) {
      // Match city names (may end in common suffixes) followed by FL and ZIP
      const cityStateZip = withoutHeader.match(/([A-Z][a-z]+(?:ville|ton|land|burg|ford|field|wood|beach|springs|park|son)?)[,\s]+(?:FL|Fl|fl)[,\s]+(\d{5})/);
      if (cityStateZip && cityStateZip[1].toLowerCase() !== 'ocala') {
        result.city = cityStateZip[1];
        result.state = 'FL';
        if (!['34474', '33474'].includes(cityStateZip[2])) {
          result.zip = cityStateZip[2];
        }
      }
    }
    
    // Fallback: known Florida city names (OCR-corrected versions included)
    if (!result.city) {
      const flCities = withoutHeader.match(/\b(Trenton|Jacksonville|Gainesville|Tampa|Orlando|Tallahassee|Pensacola|Miami|Bryceville|Yulee|Starke|Palatka|Lake\s*City|Live\s*Oak|Perry|Madison|Mayo|Cross\s*City|Bronson|Williston|Archer|Newberry|Alachua|High\s*Springs|Fort\s*White|Chiefland|Cedar\s*Key|Crystal\s*River|Inverness|Dunnellon|Belleview|Summerfield|The\s*Villages|Leesburg|Tavares|Eustis|Mount\s*Dora|Sanford|Daytona|Palm\s*Coast|St\.?\s*Augustine)\b/i);
      if (flCities) {
        let city = flCities[1];
        result.city = city.split(/\s+/).map(w => 
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
        result.state = 'FL';
      }
    }
    
    // === PHONE NUMBERS ===
    const phoneRegex = /[(\s]*(\d{3})[)\s.\-]*(\d{3})[\s.\-]*(\d{4})/;
    
    // Home/Primary phone
    const homePhMatch = withoutHeader.match(new RegExp(`(?:Home\\s*)?Ph[:\\s]*${phoneRegex.source}`, 'i'));
    if (homePhMatch) {
      result.phone = `${homePhMatch[1]}-${homePhMatch[2]}-${homePhMatch[3]}`;
    }
    
    // Work phone
    const workPhMatch = withoutHeader.match(new RegExp(`Work\\s*Ph[:\\s]*${phoneRegex.source}`, 'i'));
    if (workPhMatch) {
      result.workPhone = `${workPhMatch[1]}-${workPhMatch[2]}-${workPhMatch[3]}`;
    }
    
    // Cell phone
    const cellPhMatch = withoutHeader.match(new RegExp(`Cell\\s*Ph[:\\s]*${phoneRegex.source}`, 'i'));
    if (cellPhMatch) {
      result.cellPhone = `${cellPhMatch[1]}-${cellPhMatch[2]}-${cellPhMatch[3]}`;
    }
    
    // Fallback: collect all phones, skip plant numbers
    const phonePattern = /[(\s]*(\d{3})[)\s.\-]*(\d{3})[\s.\-]*(\d{4})/g;
    const allPhones: string[] = [];
    let phoneMatch;
    
    while ((phoneMatch = phonePattern.exec(withoutHeader)) !== null) {
      const num = `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
      // Skip plant numbers (352-732-xxxx)
      if (!num.startsWith('352-732') && !allPhones.includes(num)) {
        allPhones.push(num);
      }
    }
    
    if (!result.phone && allPhones.length > 0) result.phone = allPhones[0];
    if (!result.workPhone && allPhones.length > 1) result.workPhone = allPhones[1];
    if (!result.cellPhone && allPhones.length > 2) result.cellPhone = allPhones[2];
    
    // === LOT / DEALER ===
    const lotMatch = withoutHeader.match(/(?:Dealer|Lot)\s+(?:Lot\s+)?(\d+[\-\s]*[A-Za-z]+)/i);
    if (lotMatch) {
      result.lotNumber = lotMatch[1].replace(/\s+/g, '-').trim();
      result.dealer = `Lot ${result.lotNumber}`;
    }
    
    // === MODEL ===
    // First try: Look for "Model #" or "Model" label
    const modelMatch = withoutHeader.match(/Model\s*#?\s+([A-Za-z0-9\s\-]+?)(?=\s+(?:C\s*of|Date|Serial|Dealer|$|\n))/i);
    if (modelMatch) {
      const rawModel = modelMatch[1].trim();
      // Try to fuzzy match to known model
      const fuzzyModel = fuzzyMatchModel(rawModel);
      if (fuzzyModel) {
        result.model = fuzzyModel;
      } else {
        // Clean up: take first word that looks like a model name
        const cleanModel = rawModel.match(/^([A-Z][a-z]+)/i);
        if (cleanModel) {
          result.model = cleanModel[1];
        }
      }
    }
    
    // Fallback: scan for known model names anywhere in text
    if (!result.model) {
      const modelFromText = fuzzyMatchModel(withoutHeader);
      if (modelFromText) {
        result.model = modelFromText;
      }
    }
    
    // === SALESPERSON ===
    // OCR often misreads initial capital (T -> r, J -> l)
    let salespersonMatch = withoutHeader.match(/Sales\s*person[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (salespersonMatch) {
      let name = salespersonMatch[1].trim();
      // Apply OCR corrections
      name = applyOcrCorrections(name);
      // Fix lowercase start that should be uppercase
      const nameParts = name.split(/\s+/);
      result.salesperson = nameParts.map(p => 
        p.charAt(0).toUpperCase() + p.slice(1)
      ).join(' ');
    }
    
    // === SETUP BY ===
    const setupMatch = withoutHeader.match(/Set\s*up\s*(?:by)?[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (setupMatch) {
      let name = setupMatch[1].trim();
      name = applyOcrCorrections(name);
      result.setupBy = name.split(/\s+/).map(p => 
        p.charAt(0).toUpperCase() + p.slice(1)
      ).join(' ');
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
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex-shrink-0 bg-black/80 px-4 py-2 flex items-center justify-between safe-area-top">
        <h2 className="text-white font-medium text-sm">
          {step === 'capture' && 'Scan Service Form'}
          {step === 'processing' && 'Processing...'}
          {step === 'review' && 'Review Extracted Data'}
        </h2>
        <button onClick={onClose} className="text-white p-2 -mr-2">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Capture Step */}
      {step === 'capture' && (
        <>
          <div className="flex-1 relative min-h-0 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() => videoRef.current?.play()}
            />
            
            {/* Overlay guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/50 rounded-lg w-[90%] h-[60%] flex items-center justify-center">
                <p className="text-white/70 text-sm bg-black/50 px-3 py-1 rounded">
                  Align service form within frame
                </p>
              </div>
            </div>
            
            {error && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg">
                {error}
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0 bg-black/90 p-3 space-y-2 safe-area-bottom">
            {/* Native camera - best quality, recommended */}
            <Button 
              onClick={() => nativeCameraRef.current?.click()} 
              fullWidth 
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              <Camera className="w-5 h-5 mr-2" />
              📸 Take Photo (Best Quality)
            </Button>
            
            <input
              ref={nativeCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
            
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
        <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 overflow-auto">
          {imageData && (
            <img 
              src={imageData} 
              alt="Captured" 
              className="max-w-full max-h-[30dvh] rounded-lg mb-4 opacity-50"
            />
          )}
          
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-3" />
          <p className="text-white text-base mb-2">Reading form...</p>
          
          <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
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
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            <div className="bg-gray-900 rounded-lg p-3 space-y-3">
              <h3 className="text-white font-medium flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />
                Extracted Data
              </h3>
              
              {/* Extracted fields */}
              <div className="space-y-2 text-sm">
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
                
                <div className="border-t border-gray-700 my-1" />
                
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
              <details className="mt-2">
                <summary className="text-gray-500 text-xs cursor-pointer">
                  View raw text
                </summary>
                <pre className="mt-2 text-xs text-gray-400 whitespace-pre-wrap bg-black/50 p-2 rounded max-h-24 overflow-y-auto">
                  {scannedData.rawText}
                </pre>
              </details>
            </div>
          </div>
          
          <div className="flex-shrink-0 bg-black/90 p-3 space-y-2 safe-area-bottom">
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
