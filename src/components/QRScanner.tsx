import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GradientCard } from '@/components/ui/gradient-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, Search } from 'lucide-react';

interface QRScannerProps {
  onDropletIdFound: (dropletId: string) => void;
}

export function QRScanner({ onDropletIdFound }: QRScannerProps) {
  const [inputId, setInputId] = useState('');

  const extractDropletIdFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get('id');
      if (id && id.length === 6 && /^[A-Z0-9]{6}$/.test(id)) {
        return id;
      }
    } catch {
      // Not a valid URL, check if it's just the ID
      if (url.length === 6 && /^[A-Z0-9]{6}$/.test(url.toUpperCase())) {
        return url.toUpperCase();
      }
    }
    return null;
  };

  const handleSearch = () => {
    const dropletId = extractDropletIdFromUrl(inputId);
    if (dropletId) {
      onDropletIdFound(dropletId);
      setInputId('');
    }
  };

  return (
    <GradientCard variant="glow" className="w-full max-w-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <QrCode className="h-4 w-4 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Find Droplet</CardTitle>
        </div>
        <CardDescription>
          Search by Droplet ID or paste a claim link
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="searchInput" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Droplet ID or Claim Link
          </Label>
          <div className="flex gap-2">
            <Input
              id="searchInput"
              placeholder="A1B2C3 or https://..."
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              className="bg-secondary/50 border-border/50 focus:border-primary/50"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={!inputId.trim()}
              variant="outline"
            >
              Search
            </Button>
          </div>
        </div>
        
        <div className="text-center text-sm text-muted-foreground">
          <p>Enter a 6-character droplet ID or paste a claim link to get started</p>
        </div>
      </CardContent>
    </GradientCard>
  );
}