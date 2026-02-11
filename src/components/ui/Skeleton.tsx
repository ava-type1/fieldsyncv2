interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-gray-800 rounded ${className}`} />;
}

export function PropertyCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between pt-3 border-t border-gray-800">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </div>
  );
}

export function PropertyDetailSkeleton() {
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-1/2" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
