import { useRef, useEffect, useState, useCallback, TouchEvent, MouseEvent } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface SignatureCaptureProps {
  onSave?: (signatureData: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  lineColor?: string;
  lineWidth?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

export function SignatureCapture({
  onSave,
  onClear,
  width = 400,
  height = 200,
  lineColor = '#1f2937',
  lineWidth = 2,
  placeholder = 'Sign here',
  disabled = false,
  className = '',
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width, height });
  const lastPoint = useRef<Point | null>(null);

  // Handle responsive sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newWidth = Math.min(containerWidth - 2, width); // -2 for border
        const newHeight = Math.round((newWidth / width) * height);
        setCanvasSize({ width: newWidth, height: newHeight });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [width, height]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    ctx.scale(dpr, dpr);

    // Set drawing styles
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;

    // Clear and draw placeholder line
    drawPlaceholder(ctx, canvasSize.width, canvasSize.height);
  }, [canvasSize, lineColor, lineWidth]);

  const drawPlaceholder = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) => {
    ctx.clearRect(0, 0, w, h);

    // Draw "Sign here" line
    const lineY = h - 40;
    const padding = 20;

    ctx.save();
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, lineY);
    ctx.lineTo(w - padding, lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw placeholder text
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(placeholder, padding, lineY + 25);

    // Draw "X" indicator
    ctx.font = '18px system-ui, -apple-system, sans-serif';
    ctx.fillText('✕', padding, lineY - 10);
    ctx.restore();
  };

  const getPointFromEvent = (
    e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>
  ): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = useCallback(
    (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
      if (disabled) return;

      e.preventDefault();
      const point = getPointFromEvent(e);
      if (!point) return;

      setIsDrawing(true);
      lastPoint.current = point;

      // Clear placeholder on first stroke
      if (!hasSignature) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = lineWidth;
        }
      }
    },
    [disabled, hasSignature, canvasSize, lineColor, lineWidth]
  );

  const draw = useCallback(
    (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing || disabled) return;

      e.preventDefault();
      const point = getPointFromEvent(e);
      if (!point || !lastPoint.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();

      lastPoint.current = point;
      setHasSignature(true);
    },
    [isDrawing, disabled]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPoint.current = null;
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setHasSignature(false);
    drawPlaceholder(ctx, canvasSize.width, canvasSize.height);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    onClear?.();
  }, [canvasSize, lineColor, lineWidth, onClear, placeholder]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    // Export as base64 PNG
    const signatureData = canvas.toDataURL('image/png');
    onSave?.(signatureData);
  }, [hasSignature, onSave]);

  // Get signature data without triggering callback
  const getSignatureData = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return null;
    return canvas.toDataURL('image/png');
  }, [hasSignature]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        ref={containerRef}
        className={cn(
          'relative w-full bg-white rounded-lg border-2 overflow-hidden',
          disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300',
          isDrawing && 'border-primary-500'
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            'touch-none',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'
          )}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClear}
          disabled={disabled || !hasSignature}
          className="flex-1"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Clear
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={disabled || !hasSignature}
          className="flex-1"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Save Signature
        </Button>
      </div>
    </div>
  );
}

// Export ref-based component for imperative access
export type SignatureCaptureRef = {
  clear: () => void;
  getSignatureData: () => string | null;
  hasSignature: () => boolean;
};
