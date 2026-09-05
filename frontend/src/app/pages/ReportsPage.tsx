import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { FileSpreadsheet, FileText, Calendar, Filter } from 'lucide-react';
import { toast } from 'sonner';

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('quotations');
  const [period, setPeriod] = useState('THIS_MONTH');

  const handleExport = (format: 'PDF' | 'XLS') => {
    toast.success(`Exporting ${activeTab.toUpperCase()} report as ${format}... File download simulated.`);
  };

  const REPORT_TABS = [
    { id: 'quotations', label: 'Quotation Performance' },
    { id: 'products', label: 'Product & Margin Mix' },
    { id: 'discounts', label: 'Discount Exceptions & Violations' },
    { id: 'subscriptions', label: 'Recurring Revenue & MRR' },
  ];

  return (
    <div className="space-y-5 pb-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Reporting & Exports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Comprehensive audit reports with PDF and Excel downloads</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('PDF')}>
            <FileText className="w-3.5 h-3.5 mr-1 text-red-500" />
            Export PDF
          </Button>

          <Button variant="outline" size="sm" onClick={() => handleExport('XLS')}>
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Export Excel (XLS)
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Period:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-slate-50 focus:outline-none"
          >
            <option value="TODAY">Today</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="Q3_2026">Q3 2026</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Category:</span>
          <select className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-slate-50 focus:outline-none">
            <option>All Product Categories</option>
            <option>Hardware</option>
            <option>Services</option>
            <option>Subscriptions</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={REPORT_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Panels */}
      {activeTab === 'quotations' && (
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50/75">
            <CardTitle className="text-xs font-bold text-slate-800">Quotation Performance Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left table-dense">
              <thead>
                <tr>
                  <th>Sales Representative</th>
                  <th className="text-center">Quotes Created</th>
                  <th className="text-center">Confirmed</th>
                  <th className="text-right">Total Value</th>
                  <th className="text-right">Win Rate</th>
                  <th className="text-right">Avg Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="font-bold text-xs text-slate-900">Dave Sales</td>
                  <td className="text-center text-xs">24</td>
                  <td className="text-center text-xs text-emerald-600 font-bold">16</td>
                  <td className="text-right font-black text-xs text-slate-900">₹184,200.00</td>
                  <td className="text-right text-xs font-bold text-slate-800">66.7%</td>
                  <td className="text-right text-xs font-semibold text-emerald-600">38.4%</td>
                </tr>
                <tr>
                  <td className="font-bold text-xs text-slate-900">Eve Martinez</td>
                  <td className="text-center text-xs">18</td>
                  <td className="text-center text-xs text-emerald-600 font-bold">12</td>
                  <td className="text-right font-black text-xs text-slate-900">₹118,500.00</td>
                  <td className="text-right text-xs font-bold text-slate-800">66.7%</td>
                  <td className="text-right text-xs font-semibold text-emerald-600">34.1%</td>
                </tr>
                <tr>
                  <td className="font-bold text-xs text-slate-900">Frank Wilson</td>
                  <td className="text-center text-xs">6</td>
                  <td className="text-center text-xs text-emerald-600 font-bold">3</td>
                  <td className="text-right font-black text-xs text-slate-900">₹39,800.00</td>
                  <td className="text-right text-xs font-bold text-slate-800">50.0%</td>
                  <td className="text-right text-xs font-semibold text-emerald-600">31.2%</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'discounts' && (
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50/75">
            <CardTitle className="text-xs font-bold text-slate-800">Discount Ceiling Breaches & Exceptions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left table-dense">
              <thead>
                <tr>
                  <th>Quotation</th>
                  <th>Customer</th>
                  <th>Violating Item</th>
                  <th className="text-center">Ceiling</th>
                  <th className="text-center">Applied</th>
                  <th className="text-center">Status</th>
                  <th>Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="font-mono text-xs font-bold text-slate-800">QT-2026-0042</td>
                  <td className="text-xs">Beta Industries</td>
                  <td className="text-xs">Dell PowerEdge Server</td>
                  <td className="text-center text-xs">15%</td>
                  <td className="text-center text-xs font-bold text-red-600">20% (+5%)</td>
                  <td className="text-center">
                    <Badge variant="warning" size="sm">
                      PENDING
                    </Badge>
                  </td>
                  <td className="text-xs text-slate-500">Awaiting Manager & Finance</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'subscriptions' && (
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50/75">
            <CardTitle className="text-xs font-bold text-slate-800">Active Subscriptions & Recurring Run-Rate</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Monthly Recurring Revenue (MRR)</div>
                <div className="text-xl font-black text-slate-900 mt-1">₹48,200.00</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Annual Run Rate (ARR)</div>
                <div className="text-xl font-black text-slate-900 mt-1">₹578,400.00</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Average Revenue Per User (ARPU)</div>
                <div className="text-xl font-black text-slate-900 mt-1">₹240.00/seat</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'products' && (
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50/75">
            <CardTitle className="text-xs font-bold text-slate-800">Top Performing Products by Margin Volume</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left table-dense">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-center">Units Sold</th>
                  <th className="text-right">Gross Revenue</th>
                  <th className="text-right">Net Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="font-bold text-xs text-slate-900">Enterprise Laptop Pro</td>
                  <td className="text-xs text-slate-500">Hardware</td>
                  <td className="text-center text-xs">84</td>
                  <td className="text-right font-black text-xs text-slate-900">₹109,116.00</td>
                  <td className="text-right text-xs font-bold text-emerald-600">30.7%</td>
                </tr>
                <tr>
                  <td className="font-bold text-xs text-slate-900">ProSupport 24/7 SLA</td>
                  <td className="text-xs text-slate-500">Services</td>
                  <td className="text-center text-xs">38</td>
                  <td className="text-right font-black text-xs text-slate-900">₹37,962.00</td>
                  <td className="text-right text-xs font-bold text-emerald-600">65.0%</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
