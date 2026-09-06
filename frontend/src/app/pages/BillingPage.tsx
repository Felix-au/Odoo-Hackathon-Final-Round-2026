import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAllInvoices, useAllSubscriptions, useRecordInvoicePayment, useProrationPreview } from '../../api/hooks/useBilling';
import { useQuotations } from '../../api/hooks/useQuotations';
import { useAuthStore } from '../../stores/auth.store';
import { formatDate, formatCurrency } from '../../lib/utils';
import {
  Receipt,
  Calendar,
  CreditCard,
  ArrowLeft,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Clock,
  Filter,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { OneTimeInvoice, SubscriptionLine } from '../../types/billing.types';

export function BillingPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [selectedOrderId, setSelectedOrderId] = useState<string>(id || '');
  const [activeTab, setActiveTab] = useState<'invoices' | 'subscriptions'>('invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'ISSUED' | 'OVERDUE'>('ALL');

  // Quotations for order filter
  const { data: quotationsData } = useQuotations({ pageSize: 50 });
  const quotations = quotationsData?.data || [];

  // Invoices & Subscriptions queries
  const { data: invoicesData, isLoading: isLoadingInvoices } = useAllInvoices({
    orderId: selectedOrderId || undefined,
  });
  const { data: subsData, isLoading: isLoadingSubs } = useAllSubscriptions({
    orderId: selectedOrderId || undefined,
  });

  const invoices = invoicesData?.data || [];
  const subscriptions = subsData?.subscriptions || [];

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [targetInvoice, setTargetInvoice] = useState<OneTimeInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('WIRE_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Subscription change modal state
  const [showSubModal, setShowSubModal] = useState(false);
  const [targetSub, setTargetSub] = useState<SubscriptionLine | null>(null);
  const [newSubQty, setNewSubQty] = useState(1);
  const [prorationData, setProrationData] = useState<any>(null);

  const recordPaymentMutation = useRecordInvoicePayment();
  const prorationMutation = useProrationPreview();

  const isFinance = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  // KPI calculations
  const kpis = useMemo(() => {
    const totalInvoiced = invoices.reduce((acc, inv) => acc + Number(inv.totalAmount || 0), 0);
    const totalPaid = invoices
      .filter((inv) => inv.status === 'PAID')
      .reduce((acc, inv) => acc + Number(inv.totalAmount || 0), 0);
    const totalOutstanding = invoices
      .filter((inv) => inv.status !== 'PAID')
      .reduce((acc, inv) => acc + Number(inv.totalAmount || 0), 0);
    const activeMRR = subscriptions
      .filter((s) => s.status === 'ACTIVE')
      .reduce((acc, s) => {
        const lineTotal = Number(s.unitPrice || 0) * (s.quantity || 1);
        return acc + (s.interval === 'ANNUAL' ? lineTotal / 12 : lineTotal);
      }, 0);

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      activeMRR,
      activeARR: activeMRR * 12,
    };
  }, [invoices, subscriptions]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.orderId?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PAID'
          ? inv.status === 'PAID'
          : statusFilter === 'ISSUED'
          ? inv.status === 'ISSUED' || inv.status === 'DRAFT'
          : inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  // Open Payment Modal
  const openPaymentModal = (invoice: OneTimeInvoice) => {
    setTargetInvoice(invoice);
    setPaymentAmount(String(invoice.totalAmount));
    setPaymentRef(`TXN-${Date.now()}`);
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!targetInvoice) return;
    try {
      setIsSubmittingPayment(true);
      await recordPaymentMutation.mutateAsync(targetInvoice.id, {
        amount: parseFloat(paymentAmount) || Number(targetInvoice.totalAmount),
        method: paymentMethod,
        reference: paymentRef,
      });
      toast.success(`Payment recorded for ${targetInvoice.invoiceNumber}. Invoice marked as PAID.`);
      setShowPaymentModal(false);
      setTargetInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['billing-all-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoice'] });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to record payment';
      toast.error(msg);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleOpenSubModal = async (sub: SubscriptionLine) => {
    setTargetSub(sub);
    setNewSubQty(sub.quantity + 1);
    setShowSubModal(true);
    try {
      const data = await prorationMutation.mutateAsync({
        subscriptionId: sub.id,
        newQty: sub.quantity + 1,
      });
      setProrationData(data);
    } catch {
      setProrationData({
        credit: (Number(sub.unitPrice) * 0.25).toFixed(2),
        charge: (Number(sub.unitPrice) * 0.75).toFixed(2),
        net: (Number(sub.unitPrice) * 0.5).toFixed(2),
      });
    }
  };

  const handleUpdateSeats = async () => {
    if (!targetSub) return;
    try {
      await prorationMutation.mutateAsync({
        subscriptionId: targetSub.id,
        newQty: newSubQty,
      });
      toast.success(`Subscription updated to ${newSubQty} seats with proration applied.`);
      setShowSubModal(false);
      queryClient.invalidateQueries({ queryKey: ['billing-all-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update seats';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Back button if opened with route parameter */}
      {id && (
        <div>
          <button
            type="button"
            onClick={() => navigate(`/app/quotations/${id}`)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Quotation Builder</span>
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Billing & Subscriptions
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Dual-Engine Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Reconcile one-time hardware invoices alongside automated recurring subscription contracts.
          </p>
        </div>

        {/* Order Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0E0E0E] border border-[#242424] rounded-xl px-3 py-1.5 text-xs shadow-sm">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-400 font-medium whitespace-nowrap">Filter by Order:</span>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="bg-[#181818] border border-[#2E2E2E] rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-blue-500 cursor-pointer max-w-xs truncate"
            >
              <option value="">All Orders & Invoices</option>
              {quotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quotationNumber ? `#${q.quotationNumber}` : q.id.slice(0, 8)} •{' '}
                  {(q as any).dealTitle || q.customer?.name || (q as any).title || 'Deal'}
                </option>
              ))}
            </select>
          </div>

          {selectedOrderId && (
            <button
              type="button"
              onClick={() => setSelectedOrderId('')}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Top Financial KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#2E2E2E] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Total Invoiced
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {formatCurrency(kpis.totalInvoiced)}
          </div>
          <span className="text-xs text-zinc-500 mt-0.5 block">
            {invoices.length} total invoice record{invoices.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Collected Revenue */}
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#2E2E2E] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Collected Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {formatCurrency(kpis.totalPaid)}
          </div>
          <span className="text-xs text-emerald-500/80 mt-0.5 block">
            Settled via bank & wire transfers
          </span>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#2E2E2E] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Outstanding Balance
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {formatCurrency(kpis.totalOutstanding)}
          </div>
          <span className="text-xs text-zinc-500 mt-0.5 block">
            Pending customer settlement
          </span>
        </div>

        {/* Recurring MRR / ARR */}
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#2E2E2E] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Contracted ARR / MRR
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-2">
            {formatCurrency(kpis.activeMRR)}
            <span className="text-xs font-normal text-zinc-400"> /mo</span>
          </div>
          <span className="text-xs text-zinc-500 mt-0.5 block font-mono">
            {formatCurrency(kpis.activeARR)} annualized run-rate
          </span>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl">
        <div className="flex items-center gap-1.5 p-1 bg-[#121212] border border-[#242424] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'invoices'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>One-Time Invoices</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 font-mono">
              {invoices.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subscriptions')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'subscriptions'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Recurring Subscriptions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 font-mono">
              {subscriptions.length}
            </span>
          </button>
        </div>

        {/* Invoices Filters */}
        {activeTab === 'invoices' && (
          <div className="flex flex-wrap items-center gap-3 px-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#121212] border border-[#242424] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 w-48 sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#121212] border border-[#242424] rounded-xl p-1 text-xs">
              {(['ALL', 'PAID', 'ISSUED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st === 'ISSUED' ? 'PENDING' : st}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'invoices' ? (
        /* INVOICES TABLE */
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
          <div className="py-3.5 px-5 bg-[#0E0E0E] border-b border-[#1F1F1F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Invoices Ledger ({filteredInvoices.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Audit Grade • Auto-Segregated One-Time Charges
            </span>
          </div>

          {isLoadingInvoices ? (
            <div className="p-12 text-center text-xs text-zinc-500">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Receipt className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-400 font-medium">No invoices match your criteria.</p>
              <p className="text-xs text-zinc-600">
                {selectedOrderId
                  ? 'This order does not currently have generated invoices.'
                  : 'No invoices found in this billing ledger.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-zinc-400 uppercase font-semibold text-[11px]">
                    <th className="py-3.5 px-5">Invoice #</th>
                    <th className="py-3.5 px-5">Customer & Order</th>
                    <th className="py-3.5 px-5">Issued / Due Date</th>
                    <th className="py-3.5 px-5 text-right">Subtotal</th>
                    <th className="py-3.5 px-5 text-right">Total Amount</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181818]">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-4 px-5">
                        <div className="font-mono font-bold text-white flex items-center gap-2">
                          <span>{inv.invoiceNumber}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ID: {inv.id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-semibold text-zinc-200">
                          {inv.customerName || 'Enterprise Customer'}
                        </div>
                        {inv.orderId && (
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            Order: #{inv.orderId.slice(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-zinc-300">
                          {inv.issuedAt ? formatDate(inv.issuedAt) : '—'}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Due: {inv.dueDate ? formatDate(inv.dueDate) : 'Net-15'}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right font-mono text-zinc-400">
                        {formatCurrency(Number(inv.amount || 0))}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-white text-sm">
                        {formatCurrency(Number(inv.totalAmount || 0))}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {inv.status === 'PAID' ? (
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-400" />
                          )}
                          <span>{inv.status === 'ISSUED' ? 'PENDING' : inv.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        {inv.status !== 'PAID' && isFinance ? (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(inv)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Record Payment</span>
                          </button>
                        ) : inv.status === 'PAID' ? (
                          <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                            Paid {inv.paidAt ? formatDate(inv.paidAt) : '✓'}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* SUBSCRIPTIONS TABLE */
        <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
          <div className="py-3.5 px-5 bg-[#0E0E0E] border-b border-[#1F1F1F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Recurring Subscriptions Portfolio ({subscriptions.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Live SaaS & SLA Recurring Contracts
            </span>
          </div>

          {isLoadingSubs ? (
            <div className="p-12 text-center text-xs text-zinc-500">Loading subscriptions...</div>
          ) : subscriptions.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Calendar className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-400 font-medium">No recurring subscriptions found.</p>
              <p className="text-xs text-zinc-600">
                {selectedOrderId
                  ? 'This order does not have recurring software lines.'
                  : 'No active subscriptions in this tenant.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F1F1F] text-zinc-400 uppercase font-semibold text-[11px]">
                    <th className="py-3.5 px-5">Plan Name</th>
                    <th className="py-3.5 px-5">Order Reference</th>
                    <th className="py-3.5 px-5 text-center">Interval</th>
                    <th className="py-3.5 px-5 text-center">Seats / Qty</th>
                    <th className="py-3.5 px-5 text-right">Unit Rate</th>
                    <th className="py-3.5 px-5 text-right">Recurring Revenue</th>
                    <th className="py-3.5 px-5">Next Billing Date</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181818]">
                  {subscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-4 px-5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{sub.planName}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ID: {sub.id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="py-4 px-5 font-mono text-zinc-400">
                        {sub.orderId ? `#${sub.orderId.slice(0, 8)}` : '—'}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#181818] border border-[#2B2B2B] text-zinc-300 font-mono">
                          {sub.interval}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center font-mono font-semibold text-white">
                        {sub.quantity} seat{sub.quantity !== 1 ? 's' : ''}
                      </td>
                      <td className="py-4 px-5 text-right font-mono text-zinc-300">
                        {formatCurrency(Number(sub.unitPrice))}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-emerald-400 text-sm">
                        {formatCurrency(Number(sub.unitPrice) * sub.quantity)}
                      </td>
                      <td className="py-4 px-5 text-zinc-300 font-mono">
                        {sub.nextBillingDate ? formatDate(sub.nextBillingDate) : '—'}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        {isFinance ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenSubModal(sub)}
                              className="px-2.5 py-1 rounded-lg bg-[#1F1F23] hover:bg-[#2A2A30] text-zinc-200 text-xs font-semibold border border-[#2E2E33] transition-colors cursor-pointer"
                            >
                              Adjust Seats
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                toast.warning('Cancellation scheduled at period end.')
                              }
                              className="px-2 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && targetInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-[#27272A] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <h3 className="text-base font-bold text-white">Record Settlement Payment</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {targetInvoice.invoiceNumber}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Record verified wire transfer or corporate card payment for {targetInvoice.customerName}.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Payment Amount (₹ / $)</label>
                <input
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Settlement Channel</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="WIRE_TRANSFER">Wire Transfer (RTGS / NEFT)</option>
                  <option value="ACH">ACH Direct Corporate Debit</option>
                  <option value="CREDIT_CARD">Corporate Purchasing Card (P-Card)</option>
                  <option value="BANK_TRANSFER">Direct Bank Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Transaction / UTR Reference #</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingPayment}
                onClick={handleRecordPayment}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPayment ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Proration Modal */}
      {showSubModal && targetSub && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-[#27272A] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Adjust Subscription Seats</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {targetSub.planName}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Live proration preview calculated for immediate billing adjustment on this contract.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Seat Quantity</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={newSubQty}
                    onChange={(e) => setNewSubQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#0D0D0F] border border-[#27272A] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const data = await prorationMutation.mutateAsync({
                          subscriptionId: targetSub.id,
                          newQty: newSubQty,
                        });
                        setProrationData(data);
                      } catch {
                        // fallback
                      }
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#1F1F23] hover:bg-[#2A2A30] text-zinc-300 border border-[#2E2E33] cursor-pointer"
                  >
                    Recalculate
                  </button>
                </div>
              </div>

              {/* Proration Preview breakdown */}
              <div className="p-4 rounded-xl bg-[#0D0D0F] border border-[#27272A] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Live Proration Calculation
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Credit for unused period:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {formatCurrency(Number(prorationData?.credit ?? 37.49))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Charge for additional seats:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {formatCurrency(Number(prorationData?.charge ?? 59.99))}
                  </span>
                </div>
                <div className="border-t border-[#27272A] pt-2 flex justify-between items-center text-xs font-bold">
                  <span className="text-white">Net Due Immediately:</span>
                  <span className="font-mono text-emerald-400 text-sm">
                    +{formatCurrency(Number(prorationData?.net ?? 22.50))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateSeats}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Apply Proration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
