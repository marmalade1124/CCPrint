import { useState } from 'react';
import { Clock, CheckCircle, XCircle, Search, Printer, Download } from 'lucide-react';
import { FailureRecord } from './AnalyticsDashboard';
import { FilamentSpool } from './FilamentInventory';
import { PrintHistoryRecord } from '../types';

interface PrintHistoryProps {
  historyLog: PrintHistoryRecord[];
  failures: FailureRecord[];
  spools: FilamentSpool[];
}

export default function PrintHistory({ historyLog, failures, spools }: PrintHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

  const handleExportCSV = () => {
    const headers = ['Status', 'Job Title', 'Client', 'Filename', 'Weight (g)', 'Duration (mins)', 'Price (PHP)', 'Spool', 'Date Completed'];
    const rows = filteredHistory.map(item => [
      item.status === 'success' ? 'Completed' : `Failed (${item.wastePercent}%)`,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.client.replace(/"/g, '""')}"`,
      `"${item.filename.replace(/"/g, '""')}"`,
      item.weight,
      item.durationMinutes,
      item.cost,
      `"${item.spoolName.replace(/"/g, '""')}"`,
      item.date
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `print_history_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | 'today' | 'weekly'>('all');

  // Helper to resolve spool details
  const getSpoolName = (spoolId?: string) => {
    if (!spoolId) return 'Unknown Spool';
    const found = spools.find(s => s.id === spoolId);
    return found ? `${found.name} (${found.material})` : 'Default Spool';
  };

  // Compile history items from both completed jobs and failure logs
  const completedHistoryItems = historyLog.map(h => ({
    id: h.id,
    title: h.jobTitle,
    client: h.client,
    filename: h.filename,
    weight: h.weightGrams,
    durationMinutes: h.printTimeMinutes,
    cost: h.price,
    spoolId: h.spoolId,
    spoolName: h.spoolName || getSpoolName(h.spoolId),
    date: h.completedAt ? new Date(h.completedAt).toLocaleDateString() : new Date().toLocaleDateString(),
    status: 'success' as const,
    wastePercent: 0,
  }));

  const failedHistoryItems = failures.map(f => ({
    id: f.id,
    title: f.jobTitle,
    client: f.client,
    filename: f.jobTitle + ' (Failed)',
    weight: f.wastedGrams,
    durationMinutes: f.wastedTimeMinutes,
    cost: f.wastedCost,
    spoolId: f.spoolId,
    spoolName: f.spoolName || 'Default Spool',
    date: f.date,
    status: 'failed' as const,
    wastePercent: f.failurePercent,
  }));

  // Combine and sort by date descending (we'll parse date strings or assume order)
  const allHistory = [...completedHistoryItems, ...failedHistoryItems].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Apply filters
  const filteredHistory = allHistory.filter(item => {
    // 1. Search Query
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.spoolName.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Status Filter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'success' && item.status === 'success') ||
      (statusFilter === 'failed' && item.status === 'failed');

    // 3. Timeframe Filter
    const itemDate = new Date(item.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let matchesTimeframe = true;
    if (timeframeFilter === 'today') {
      matchesTimeframe = itemDate.getTime() >= today.getTime();
    } else if (timeframeFilter === 'weekly') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      matchesTimeframe = itemDate.getTime() >= oneWeekAgo.getTime();
    }

    return matchesSearch && matchesStatus && matchesTimeframe;
  });

  // Calculate totals for filtered list
  const totalGrams = filteredHistory.reduce((sum, item) => sum + item.weight, 0);
  const totalHours = Math.round(filteredHistory.reduce((sum, item) => sum + item.durationMinutes, 0) / 60);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Print History Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Audit log of finished fabrications, filament deductions, and failed runs.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center px-4 py-2.5 bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Ledger (CSV)
        </button>
      </div>

      {/* Summary KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Prints</span>
            <span className="text-lg font-black text-slate-800 mt-0.5 block">
              {filteredHistory.filter(i => i.status === 'success').length}
            </span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Failed Prints</span>
            <span className="text-lg font-black text-slate-800 mt-0.5 block">
              {filteredHistory.filter(i => i.status === 'failed').length}
            </span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Filament Used</span>
            <span className="text-lg font-black text-slate-800 mt-0.5 block">
              {totalGrams.toLocaleString()} g
            </span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Machine Time</span>
            <span className="text-lg font-black text-slate-800 mt-0.5 block">
              {totalHours.toLocaleString()} hrs
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Table Control Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Filters bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by print name, client name, or spool..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50/50 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-brand-orange focus:border-brand-orange text-xs text-slate-700 placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 text-[10px] font-bold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-450 hover:text-slate-700'
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter('success')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'success' ? 'bg-brand-orange text-white shadow-sm' : 'text-slate-450 hover:text-slate-700'
                }`}
              >
                Success
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'failed' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-450 hover:text-slate-700'
                }`}
              >
                Failed
              </button>
            </div>

            {/* Timeframe Filter */}
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 text-[10px] font-bold">
              <button
                onClick={() => setTimeframeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeframeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-450 hover:text-slate-700'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setTimeframeFilter('today')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeframeFilter === 'today' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-450 hover:text-slate-700'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeframeFilter('weekly')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeframeFilter === 'weekly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-450 hover:text-slate-700'
                }`}
              >
                Last 7 Days
              </button>
            </div>
          </div>
        </div>

        {/* Table of past prints */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Job Details</th>
                <th className="py-4 px-6">Client</th>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6 text-right">Weight</th>
                <th className="py-4 px-6 text-right">Time</th>
                <th className="py-4 px-6 text-right">Revenue/Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    No print history matches selected filters.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(item => {
                  const hoursStr = Math.floor(item.durationMinutes / 60);
                  const minsStr = item.durationMinutes % 60;
                  const timeFormatted = `${hoursStr > 0 ? hoursStr + 'h ' : ''}${minsStr}m`;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6">
                        {item.status === 'success' ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-brand-orange bg-brand-orange/10 rounded-full border border-brand-orange/20 shadow-sm">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 shadow-sm">
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Failed ({item.wastePercent}%)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-slate-800">{item.title}</div>
                        <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px] mt-0.5">
                          {item.spoolName}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-650">{item.client}</td>
                      <td className="py-4 px-6 font-medium text-slate-400">{item.date}</td>
                      <td className="py-4 px-6 text-right font-semibold text-slate-700">{item.weight} g</td>
                      <td className="py-4 px-6 text-right font-medium text-slate-550">{timeFormatted}</td>
                      <td className="py-4 px-6 text-right font-black">
                        <span className={item.status === 'success' ? 'text-brand-orange' : 'text-red-500'}>
                          {item.status === 'success' ? '₱' : '-₱'}{item.cost.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
