import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '../ui/Button';

interface PhotoCaptureProps {
  propertyId: string; // Reserved for future use with offline sync
  onCapture: (photo: { id: string; localUri: string }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

export function PhotoCapture({ onCapture }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Compress image
    const blob = await compressImage(file, 1920, 0.8);
    const localUri = URL.createObjectURL(blob);
    const id = `photo-${Date.now()}`;

    onCapture({ id, localUri });

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />
      <Button
        variant="secondary"
        fullWidth
        onClick={() => inputRef.current?.click()}
        className="mt-3"
      >
        <Camera className="w-5 h-5 mr-2" />
        Take Photo
      </Button>
    </>
  );
}

async function compressImage(file: File, maxSize: number, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(file);
  });
}
