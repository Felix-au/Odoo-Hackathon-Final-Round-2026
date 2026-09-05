import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { FileSpreadsheet, FileText, Calendar, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../../lib/utils';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'quotations' | 'products' | 'discounts' | 'subscriptions'>('quotations');
  const [period, setPeriod] = useState('THIS_MONTH');

  const handleExport = (format: 'PDF' | 'XLS') => {
    toast.success(`Exporting ${activeTab.toUpperCase()} audit report as ${format}... File generated.`);
  };

  const chartData = [
    { name: 'ER-500 Router', revenue: 46000, margin: 34 },
    { name: 'Switch 48-Port', revenue: 28000, margin: 42 },
    { name: '24/7 SLA Support', revenue: 19500, margin: 76 },
    { name: 'Cloud Controller', revenue: 14000, margin: 68 },
    { name: 'Sec Gateway', revenue: 22000, margin: 45 },
  ];

  const REPORT_TABS = [
    { id: 'quotations', label: 'Quotation Performance' },
    { id: 'products', label: 'Product & Margin Mix' },
    { id: 'discounts', label: 'Discount Exceptions & Violations' },
    { id: 'subscriptions', label: 'Recurring Revenue & MRR' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Executive Analytics & Reports
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Audit Grade
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Enterprise gross margin tracking, SKU volume velocity, and executive export records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleExport('PDF')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#121212] hover:bg-[#1A1A1A] text-zinc-300 hover:text-white border border-[#242424] hover:border-[#333333] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('XLS')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#121212] hover:bg-[#1A1A1A] text-zinc-300 hover:text-white border border-[#242424] hover:border-[#333333] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Filter and Period Selection Bar */}
      <div className="p-3.5 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs shadow-xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-zinc-300">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-400 font-medium">Reporting Window:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-[#121212] border border-[#222222] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-zinc-400 cursor-pointer"
            >
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="Q3_2026">Q3 2026</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-zinc-300">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-400 font-medium">Product Segment:</span>
            <select className="bg-[#121212] border border-[#222222] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-zinc-400 cursor-pointer">
              <option>All Product Categories</option>
              <option>Hardware & Infrastructure</option>
              <option>Services & Consulting</option>
              <option>Recurring Subscriptions</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-zinc-500">
          Last reconciled: 2 mins ago
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl overflow-x-auto">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Visual Chart Card */}
      <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Product Mix Performance
            </div>
            <h2 className="text-base font-bold text-white tracking-tight mt-0.5">
              Revenue Velocity by Top Product SKU (₹)
            </h2>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            +14.2% MoM Blended Growth
          </span>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
              <XAxis dataKey="name" stroke="#71717A" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#71717A"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
              />
              <Tooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Net Revenue']}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-black/95 border border-[#2E2E2E] rounded-xl p-3 shadow-2xl text-xs space-y-1">
                        <div className="font-bold text-white">{data.name}</div>
                        <div className="text-emerald-400 font-mono font-semibold">
                          Revenue: {formatCurrency(data.revenue)}
                        </div>
                        <div className="text-zinc-400 font-mono text-[11px]">
                          Blended Margin: {data.margin}%
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="revenue" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Audit Table Card */}
      <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl">
        <div className="py-3.5 px-5 bg-[#0E0E0E] border-b border-[#1F1F1F] flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Representative Conversion Breakdown
          </h2>
          <span className="text-[11px] font-mono text-zinc-500">Live Period Aggregate</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1F1F1F] text-zinc-400 uppercase font-semibold text-[11px]">
                <th className="py-3.5 px-5">Sales Representative</th>
                <th className="py-3.5 px-5 text-center">Quotes Created</th>
                <th className="py-3.5 px-5 text-center">Deals Won</th>
                <th className="py-3.5 px-5 text-right">Total Revenue</th>
                <th className="py-3.5 px-5 text-right">Win Rate</th>
                <th className="py-3.5 px-5 text-right">Avg Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {[
                { name: 'Sarah Jenkins', role: 'Enterprise Account Executive', created: 24, won: 16, revenue: 420000, winRate: '66.7%', margin: '38.4%' },
                { name: 'Michael Chang', role: 'Mid-Market Sales Lead', created: 18, won: 12, revenue: 310000, winRate: '66.6%', margin: '35.2%' },
                { name: 'Alex Rivera', role: 'Commercial Solutions Specialist', created: 14, won: 9, revenue: 212000, winRate: '64.3%', margin: '33.9%' },
              ].map((rep) => (
                <tr key={rep.name} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#181818] border border-[#2E2E2E] flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {rep.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-bold text-white">{rep.name}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{rep.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-center text-zinc-300 font-mono font-medium">{rep.created}</td>
                  <td className="py-4 px-5 text-center text-emerald-400 font-bold font-mono">{rep.won}</td>
                  <td className="py-4 px-5 text-right font-mono font-bold text-white">{formatCurrency(rep.revenue)}</td>
                  <td className="py-4 px-5 text-right font-mono text-emerald-400 font-semibold">{rep.winRate}</td>
                  <td className="py-4 px-5 text-right font-mono text-zinc-300">{rep.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
