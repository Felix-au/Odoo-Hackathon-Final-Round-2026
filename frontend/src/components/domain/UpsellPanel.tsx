import { useState } from 'react';
import { UpsellSuggestion } from '../../types/catalog.types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatCurrency } from '../../lib/utils';
import { Sparkles, Plus, X } from 'lucide-react';

export interface UpsellPanelProps {
  suggestions: UpsellSuggestion[];
  onAddSuggestion: (suggestion: UpsellSuggestion) => void;
  isLoading?: boolean;
}

export function UpsellPanel({ suggestions, onAddSuggestion, isLoading = false }: UpsellPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.includes(s.suggestedProductId)
  );

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => [...prev, id]);
  };

  return (
    <Card className="border-blue-200/80 bg-gradient-to-b from-blue-50/40 to-white">
      <CardHeader className="py-3 px-4 bg-blue-50/60">
        <CardTitle className="text-xs flex items-center gap-1.5 text-blue-900 font-bold">
          <Sparkles className="w-4 h-4 text-primary" />
          Smart Upsell & Margin Boosters
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2.5">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-16 bg-slate-200 rounded-lg" />
            <div className="h-16 bg-slate-200 rounded-lg" />
          </div>
        ) : visibleSuggestions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No further recommendations for current cart.
          </div>
        ) : (
          visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.suggestedProductId}
              className="p-3 bg-white rounded-lg border border-slate-200/80 shadow-2xs hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-xs font-bold text-slate-800 leading-tight">
                  {suggestion.suggestedProduct.name}
                </h4>
                {suggestion.isPromoted && (
                  <Badge variant="warning" size="sm" className="text-[10px] shrink-0 font-bold">
                    {suggestion.promotionTag || '🔥 Hot Deal'}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between mt-1 text-xs">
                <span className="font-semibold text-slate-900">
                  {formatCurrency(suggestion.suggestedProduct.basePrice)}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  +{suggestion.estimatedMarginPct.toFixed(0)}% Margin
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1 text-xs py-1 h-7"
                  onClick={() => onAddSuggestion(suggestion)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add to Quote
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-slate-400 hover:text-slate-600"
                  onClick={() => handleDismiss(suggestion.suggestedProductId)}
                  title="Dismiss suggestion"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
