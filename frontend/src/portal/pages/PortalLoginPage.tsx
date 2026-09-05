import { UnifiedAuthPage } from '../../app/pages/UnifiedAuthPage';

export function PortalLoginPage() {
  return <UnifiedAuthPage initialScope="portal" initialMode="login" />;
}
