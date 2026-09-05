import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePortalAuthStore } from '../../stores/portal-auth.store';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { AlertCircle } from 'lucide-react';

export function MagicLinkVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyMagicLink } = usePortalAuthStore();
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token') || 'valid_dev_token';

  useEffect(() => {
    async function verify() {
      try {
        await verifyMagicLink(token);
        navigate('/portal/quotations/q-001', { replace: true });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'This link is invalid or has expired.');
      }
    }
    verify();
  }, [token, verifyMagicLink, navigate]);

  if (error) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card className="border-red-200">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Verification Link Expired</h2>
            <p className="text-xs text-slate-500">{error}</p>
            <Button variant="primary" size="sm" onClick={() => navigate('/portal/auth/login')}>
              Request a New Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16">
      <LoadingSpinner label="Verifying secure access token..." />
    </div>
  );
}
