import { useState, useRef, useCallback } from 'react';
import { Camera, X, Loader2, Check, RotateCcw, Zap, Upload } from 'lucide-react';
import { Button } from '../ui/Button';

const OCR_WORKER_URL = 'https://fieldsync-ocr.kameronmartinllc.workers.dev';

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

  // Process image with AI Vision (Cloudflare Workers AI)
  const processImage = async (dataUrl: string) => {
    setStep('processing');
    setProgress(10);
    setError(null);
    
    try {
      setProgress(30);
      
      const response = await fetch(OCR_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      
      setProgress(80);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to extract data');
      }
      
      setProgress(100);
      
      // Map AI response to ScannedWorkOrder format
      const data = result.data;
      const parsed: ScannedWorkOrder = {
        rawText: JSON.stringify(data, null, 2),
        serialNumber: data.serialNumber || undefined,
        customerName: data.customerName || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zip: data.zip || undefined,
        phone: data.phone || undefined,
        workPhone: data.workPhone || undefined,
        cellPhone: data.cellPhone || undefined,
        poNumber: data.poNumber || undefined,
        claimNumber: data.claimNumber || undefined,
        model: data.model || undefined,
        dealer: data.dealer || undefined,
        lotNumber: data.lotNumber || undefined,
        salesperson: data.salesperson || undefined,
        setupBy: data.setupBy || undefined,
      };
      
      setScannedData(parsed);
      setStep('review');
      
    } catch (err: any) {
      console.error('AI Vision error:', err);
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('No internet connection. Save the photo and try again when you have signal.');
      } else {
        setError(`Failed to process image: ${err.message}. Please try again.`);
      }
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
