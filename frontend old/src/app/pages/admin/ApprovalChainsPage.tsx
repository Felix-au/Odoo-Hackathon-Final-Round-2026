import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

export function ApprovalChainsPage() {
  const [chains] = useState([
    {
      id: 'chain-low',
      name: 'Standard Operational Flow',
      scoreRange: '0 - 0',
      requiresApproval: false,
      roles: ['AUTO_APPROVED'],
      description: 'Discounts within tier and category ceilings require zero manual approval.',
    },
    {
      id: 'chain-med',
      name: 'Manager Approval Tier',
      scoreRange: '1 - 69',
      requiresApproval: true,
      roles: ['SALES_MANAGER'],
      description: 'Moderate ceiling breach. Requires Sales Manager sign-off.',
    },
    {
      id: 'chain-high',
      name: 'Two-Tier Critical Chain',
      scoreRange: '70 - 100',
      requiresApproval: true,
      roles: ['SALES_MANAGER', 'FINANCE'],
      description: 'Severe ceiling violation. Sequential review by Sales Manager and Finance Officer.',
    },
  ]);

  return (
    <div className="space-y-5 pb-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Risk Scoring & Approval Chains</h1>
          <p className="text-xs text-slate-500 mt-0.5">Dynamic routing thresholds configured in Catalog Service</p>
        </div>

        <Button variant="primary" size="sm" onClick={() => toast.success('Chain policy rules re-indexed')}>
          Refresh Policy Cache
        </Button>
      </div>

      <div className="space-y-4">
        {chains.map((chain) => (
          <Card key={chain.id} className="border border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 bg-slate-50/75 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <CardTitle className="text-xs font-bold text-slate-800">{chain.name}</CardTitle>
                <Badge variant={chain.requiresApproval ? 'warning' : 'success'} size="sm">
                  Risk Score: {chain.scoreRange}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-600 mb-2">{chain.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Sign-Off Sequence:</span>
                  {chain.roles.map((role, idx) => (
                    <Badge key={idx} variant="primary" size="sm" className="font-bold text-[10px]">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => toast.info(`Editing threshold rules for ${chain.name}`)}
              >
                Configure Thresholds
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
