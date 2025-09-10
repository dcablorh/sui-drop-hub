import { useParams, Navigate } from 'react-router-dom';
import { ClaimDroplet } from '@/components/ClaimDroplet';

export function ClaimPage() {
  const { dropletId } = useParams();
  
  // Validate droplet ID format
  if (!dropletId || dropletId.length !== 6 || !/^[A-Z0-9]{6}$/.test(dropletId.toUpperCase())) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <ClaimDroplet prefilledDropletId={dropletId.toUpperCase()} />
    </div>
  );
}