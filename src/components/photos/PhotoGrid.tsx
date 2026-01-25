import { Camera, X } from 'lucide-react';

interface PhotoGridProps {
  photos: Array<{
    id: string;
    localUri?: string;
    remoteUrl?: string;
    syncStatus: string;
  }>;
  onCapture: () => void;
  onRemove?: (id: string) => void;
}

export function PhotoGrid({ photos, onRemove }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p>No photos yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
        >
          <img
            src={photo.localUri || photo.remoteUrl}
            alt=""
            className="w-full h-full object-cover"
          />

          {/* Sync status overlay */}
          {photo.syncStatus === 'pending' && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="text-white text-xs">Uploading...</span>
            </div>
          )}

          {/* Remove button */}
          {onRemove && (
            <button
              onClick={() => onRemove(photo.id)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
