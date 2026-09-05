import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { FileSpreadsheet, FileText, Calendar, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../../lib/utils';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'quotations' | 'products' | 'discounts' | 'subscriptions'>('quotations');
  const [period, setPeriod] = useState('THIS_MONTH');

  const handleExport = async (format: 'PDF' | 'XLS') => {
    toast.success(`Exporting ${activeTab.toUpperCase()} report as ${format}... File generated.`);
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
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Executive Analytics & Reports
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit-grade performance analytics with PDF and Excel export capabilities
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleExport('PDF')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1C222E] hover:bg-[#252E3E] text-red-400 border border-red-500/20 transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('XLS')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1C222E] hover:bg-[#252E3E] text-emerald-400 border border-emerald-500/20 transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3.5 bg-[#12151C] border border-[#1E2430] rounded-2xl flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400 font-medium">Period:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-[#101319] border border-[#1E2430] rounded-xl px-2.5 py-1 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="Q3_2026">Q3 2026</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400 font-medium">Category:</span>
          <select className="bg-[#101319] border border-[#1E2430] rounded-xl px-2.5 py-1 text-white focus:outline-none focus:border-blue-500">
            <option>All Product Categories</option>
            <option>Hardware</option>
            <option>Services</option>
            <option>Subscriptions</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1E2430] pb-2">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Visual Chart Card */}
      <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Revenue by Top Product SKU (₹)
          </h2>
          <span className="text-[11px] text-emerald-400 font-mono font-semibold">+14.2% MoM</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2430" vertical={false} />
              <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
              <Tooltip
                formatter={(val: any) => [formatCurrency(Number(val)), 'Revenue']}
                contentStyle={{
                  backgroundColor: '#161B24',
                  border: '1px solid #283244',
                  borderRadius: '0.75rem',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                }}
              />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Audit Table Card */}
      <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#101319] border-b border-[#1E2430] text-slate-400 uppercase font-semibold text-[11px]">
              <th className="py-3 px-5">Representative / Deal</th>
              <th className="py-3 px-5 text-center">Quotes Created</th>
              <th className="py-3 px-5 text-center">Confirmed</th>
              <th className="py-3 px-5 text-right">Total Revenue</th>
              <th className="py-3 px-5 text-right">Win Rate</th>
              <th className="py-3 px-5 text-right">Avg Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A212D]">
            <tr>
              <td className="py-3.5 px-5 font-bold text-white">Dave Sales</td>
              <td className="py-3.5 px-5 text-center text-slate-300">24</td>
              <td className="py-3.5 px-5 text-center text-emerald-400 font-bold">16</td>
              <td className="py-3.5 px-5 text-right font-mono text-white">{formatCurrency(420000)}</td>
              <td className="py-3.5 px-5 text-right font-mono text-emerald-400 font-semibold">66.7%</td>
              <td className="py-3.5 px-5 text-right font-mono text-slate-300">38.4%</td>
            </tr>
            <tr>
              <td className="py-3.5 px-5 font-bold text-white">Sara Enterprise</td>
              <td className="py-3.5 px-5 text-center text-slate-300">18</td>
              <td className="py-3.5 px-5 text-center text-emerald-400 font-bold">12</td>
              <td className="py-3.5 px-5 text-right font-mono text-white">{formatCurrency(310000)}</td>
              <td className="py-3.5 px-5 text-right font-mono text-emerald-400 font-semibold">66.6%</td>
              <td className="py-3.5 px-5 text-right font-mono text-slate-300">35.2%</td>
            </tr>
            <tr>
              <td className="py-3.5 px-5 font-bold text-white">Alex KeyAccounts</td>
              <td className="py-3.5 px-5 text-center text-slate-300">14</td>
              <td className="py-3.5 px-5 text-center text-emerald-400 font-bold">9</td>
              <td className="py-3.5 px-5 text-right font-mono text-white">{formatCurrency(212000)}</td>
              <td className="py-3.5 px-5 text-right font-mono text-emerald-400 font-semibold">64.3%</td>
              <td className="py-3.5 px-5 text-right font-mono text-slate-300">33.9%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
