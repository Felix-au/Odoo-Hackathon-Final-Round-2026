import { useLocation, Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
import { MailCheck, ExternalLink } from 'lucide-react';

export function MagicLinkSentPage() {
  const location = useLocation();
  const email = (location.state as any)?.email || 'your email';

  return (
    <div className="max-w-md mx-auto py-12 text-center">
      <Card className="p-6 shadow-sm border border-slate-200">
        <CardContent className="p-6">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-6 h-6" />
          </div>

          <h2 className="text-lg font-black text-slate-900">Check Your Email</h2>
          <p className="text-xs text-slate-500 mt-2">
            We sent a one-time magic login link to <strong className="text-slate-800">{email}</strong>. The link is valid for 24 hours.
          </p>

          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
            <strong>Hackathon Local Dev:</strong> In development, all outgoing emails are intercepted by Mailpit. You can inspect the email at{' '}
            <a
              href="http://localhost:8025"
              target="_blank"
              rel="noreferrer"
              className="text-primary font-bold underline inline-flex items-center gap-0.5"
            >
              http://localhost:8025
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="mt-6">
            <Link
              to="/portal/quotations/q-001"
              className="inline-block w-full py-2.5 px-4 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-700 transition-colors"
            >
              Continue to Sample Quotation ➔
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
