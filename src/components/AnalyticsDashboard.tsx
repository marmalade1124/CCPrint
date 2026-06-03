import { useState } from 'react';
import { TrendingUp, BarChart2, DollarSign, Clock, Scale, Users, Layers, Activity, ShieldAlert } from 'lucide-react';
import { Job } from './KanbanBoard';
import { FilamentSpool } from './FilamentInventory';

export interface FailureRecord {
  id: string;
  jobTitle: string;
  client: string;
  spoolId?: string;
  spoolName?: string;
  wastedGrams: number;
  wastedCost: number;
  wastedTimeMinutes: number;
  failurePercent: number;
  date: string;
}

import { PrintHistoryRecord } from '../types';

interface AnalyticsDashboardProps {
  jobs: Job[];
  spools: FilamentSpool[];
  failures?: FailureRecord[];
  historyLog?: PrintHistoryRecord[];
}

export default function AnalyticsDashboard({ jobs, spools, failures = [], historyLog = [] }: AnalyticsDashboardProps) {
  const [timeframe, setTimeframe] = useState<'all' | 'weekly'>('all');

  // Filter active jobs for queue value/count
  const printingJobs = jobs.filter((j) => j.status === 'Printing');
  const awaitingJobs = jobs.filter((j) => j.status === 'Awaiting Approval');

  // Calculate Key KPIs from historyLog instead of active completedJobs
  const totalRevenue = historyLog.reduce((sum, h) => sum + h.price, 0);
  const activeQueueValue = awaitingJobs.reduce((sum, j) => sum + j.price, 0) + printingJobs.reduce((sum, j) => sum + j.price, 0);
  const totalMaterialGrams = historyLog.reduce((sum, h) => sum + h.weightGrams, 0);
  
  const totalRuntimeMinutes = historyLog.reduce((sum, h) => sum + h.printTimeMinutes, 0);
  const totalRuntimeHours = Math.round((totalRuntimeMinutes / 60) * 10) / 10;
  
  const totalInventoryValue = spools.reduce((sum, s) => sum + s.cost * (s.weightLeft / s.initialWeight), 0);

  // Failure and Waste calculations
  const totalWastedGrams = failures.reduce((sum, f) => sum + f.wastedGrams, 0);
  const totalWastedCost = failures.reduce((sum, f) => sum + f.wastedCost, 0);
  const wastedRuntimeMinutes = failures.reduce((sum, f) => sum + f.wastedTimeMinutes, 0);
  const wastedRuntimeHours = Math.round((wastedRuntimeMinutes / 60) * 10) / 10;
  
  const totalPrintAttempts = historyLog.length + failures.length;
  const printSuccessRate = totalPrintAttempts > 0 
    ? Math.round((historyLog.length / totalPrintAttempts) * 100) 
    : 100;

  // 1. Group completed jobs by date for Revenue Chart (from historyLog)
  const revenueByDate: Record<string, number> = {};
  historyLog.forEach((h) => {
    const date = h.completedAt ? new Date(h.completedAt).toLocaleDateString() : new Date().toLocaleDateString();
    revenueByDate[date] = (revenueByDate[date] || 0) + h.price;
  });

  // Sort dates chronologically (or take the last 7 entries)
  const sortedDates = Object.keys(revenueByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).slice(-7);
  const maxDailyRevenue = Math.max(...Object.values(revenueByDate), 100);

  // SVG Line Chart coordinates calculation
  const chartWidth = 500;
  const chartHeight = 180;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 25;
  
  const linePoints: { x: number; y: number; date: string; value: number }[] = [];
  if (sortedDates.length > 0) {
    sortedDates.forEach((date, idx) => {
      const val = revenueByDate[date] || 0;
      const x = paddingLeft + (idx / Math.max(1, sortedDates.length - 1)) * (chartWidth - paddingLeft - paddingRight);
      const y = chartHeight - paddingBottom - (val / maxDailyRevenue) * (chartHeight - paddingTop - paddingBottom);
      linePoints.push({ x, y, date, value: val });
    });
  }

  const linePathD = linePoints.length > 0 
    ? `M ${linePoints.map(p => `${p.x},${p.y}`).join(' L ')}` 
    : '';
  const areaPathD = linePoints.length > 0 
    ? `M ${linePoints[0].x},${chartHeight - paddingBottom} L ${linePoints.map(p => `${p.x},${p.y}`).join(' L ')} L ${linePoints[linePoints.length - 1].x},${chartHeight - paddingBottom} Z` 
    : '';

  // 2. Client Revenue Breakdown
  const revenueByClient: Record<string, { revenue: number; weight: number; count: number }> = {};
  historyLog.forEach((h) => {
    const client = h.client || 'Walk-in Client';
    if (!revenueByClient[client]) {
      revenueByClient[client] = { revenue: 0, weight: 0, count: 0 };
    }
    revenueByClient[client].revenue += h.price;
    revenueByClient[client].weight += h.weightGrams;
    revenueByClient[client].count += 1;
  });

  const rankedClients = Object.entries(revenueByClient)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const maxClientRevenue = rankedClients.length > 0 ? rankedClients[0].revenue : 100;

  // 3. Material consumption breakdown (derived from filament spools or default PLA)
  const materialBreakdown: Record<string, number> = { PLA: 0, PETG: 0, ABS: 0, TPU: 0, ASA: 0, Other: 0 };
  historyLog.forEach((h) => {
    const fn = (h.filename || '').toUpperCase();
    let mat = 'PLA';
    if (fn.includes('PETG')) mat = 'PETG';
    else if (fn.includes('ABS')) mat = 'ABS';
    else if (fn.includes('TPU')) mat = 'TPU';
    else if (fn.includes('ASA')) mat = 'ASA';
    
    materialBreakdown[mat] = (materialBreakdown[mat] || 0) + h.weightGrams;
  });

  const totalGramsAll = Object.values(materialBreakdown).reduce((sum, g) => sum + g, 0) || 1;

  // SVG Donut calculations
  let cumulativePercent = 0;
  const donutData = Object.entries(materialBreakdown)
    .filter(([_, grams]) => grams > 0)
    .map(([material, grams]) => {
      const percent = (grams / totalGramsAll) * 100;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;
      return { material, grams, percent, startPercent };
    });

  const donutRadius = 55;
  const donutCircumference = 2 * Math.PI * donutRadius; // ~345.57

  const getMaterialColor = (material: string) => {
    switch (material) {
      case 'PLA': return '#FF8025'; // Brand Orange
      case 'PETG': return '#3b82f6'; // Blue
      case 'ABS': return '#eab308'; // Yellow
      case 'TPU': return '#8b5cf6'; // Violet
      case 'ASA': return '#ec4899'; // Pink
      default: return '#64748b'; // Slate
    }
  };

  // Helper to format currency
  const formatCurrency = (val: number) => {
    return '₱' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Financial &amp; Print Analytics</h2>
          <p className="text-xs text-slate-400 mt-1">Monthly revenue totals, filament metrics, and client values</p>
        </div>

        {/* Timeframe switch */}
        <div className="bg-slate-200/50 p-0.5 rounded-lg flex space-x-1">
          <button
            onClick={() => setTimeframe('all')}
            className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all ${
              timeframe === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            All-Time
          </button>
          <button
            onClick={() => setTimeframe('weekly')}
            className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all ${
              timeframe === 'weekly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            This Week
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 bg-brand-orange/10 rounded-xl flex items-center justify-center text-brand-orange shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total Revenue</span>
            <span className="text-lg font-black text-slate-800">{formatCurrency(totalRevenue)}</span>
            <span className="text-[9px] text-slate-450 block mt-0.5">From completed prints</span>
          </div>
        </div>

        {/* Active Queue Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Active Queue</span>
            <span className="text-lg font-black text-slate-800">{formatCurrency(activeQueueValue)}</span>
            <span className="text-[9px] text-slate-455 block mt-0.5">Pending &amp; printing quotes</span>
          </div>
        </div>

        {/* Material Consumed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Filament Extruded</span>
            <span className="text-lg font-black text-slate-800">
              {totalMaterialGrams >= 1000 ? `${(totalMaterialGrams / 1000).toFixed(2)} kg` : `${totalMaterialGrams} g`}
            </span>
            <span className="text-[9px] text-slate-450 block mt-0.5">Actual printed mass</span>
          </div>
        </div>

        {/* Total Printer Runtime */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Machine Runtime</span>
            <span className="text-lg font-black text-slate-800">{totalRuntimeHours} hrs</span>
            <span className="text-[9px] text-slate-450 block mt-0.5">
              Stock: {spools.length} spools (worth {formatCurrency(totalInventoryValue)})
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SVG Revenue Line Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-6 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm flex items-center">
              <BarChart2 className="w-4 h-4 mr-2 text-brand-orange" />
              Daily Revenue Trend
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">Last 7 Active Days</span>
          </div>

          {sortedDates.length === 0 ? (
            <div className="h-52 border border-dashed border-slate-150 rounded-xl flex items-center justify-center text-xs text-slate-400 italic">
              No completed job statistics to chart
            </div>
          ) : (
            <div className="h-52 w-full">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF8025" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="#FF8025" stopOpacity="0.01"/>
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                <line x1={paddingLeft} y1={paddingTop} x2={chartWidth - paddingRight} y2={paddingTop} stroke="#f1f5f9" strokeDasharray="3,3" strokeWidth="1"/>
                <line x1={paddingLeft} y1={(paddingTop + (chartHeight - paddingBottom)) / 2} x2={chartWidth - paddingRight} y2={(paddingTop + (chartHeight - paddingBottom)) / 2} stroke="#f1f5f9" strokeDasharray="3,3" strokeWidth="1"/>
                <line x1={paddingLeft} y1={chartHeight - paddingBottom} x2={chartWidth - paddingRight} y2={chartHeight - paddingBottom} stroke="#cbd5e1" strokeWidth="0.75"/>

                {/* Y-Axis Labels */}
                <text x="2" y={paddingTop + 4} fill="#94a3b8" fontSize="8" fontWeight="600">₱{Math.round(maxDailyRevenue)}</text>
                <text x="2" y={(paddingTop + (chartHeight - paddingBottom)) / 2 + 4} fill="#94a3b8" fontSize="8" fontWeight="600">₱{Math.round(maxDailyRevenue / 2)}</text>
                <text x="2" y={chartHeight - paddingBottom + 4} fill="#94a3b8" fontSize="8" fontWeight="600">₱0</text>

                {/* Area Fill */}
                <path d={areaPathD} fill="url(#areaGrad)"/>

                {/* Line Path */}
                <path d={linePathD} fill="none" stroke="#FF8025" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>

                {/* Circles & Labels */}
                {linePoints.map((pt) => (
                  <g key={pt.date}>
                    <circle cx={pt.x} cy={pt.y} r="4.5" fill="#FF8025" stroke="white" strokeWidth="1.5" className="hover:scale-125 transition-transform cursor-pointer"/>
                    {/* Tooltip trigger or label */}
                    <text x={pt.x} y={chartHeight - 8} fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">
                      {new Date(pt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </text>
                    <text x={pt.x} y={pt.y - 8} fill="#334155" fontSize="7" fontWeight="black" textAnchor="middle">
                      ₱{Math.round(pt.value)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>

        {/* Dynamic SVG Donut Chart for Filament consumption */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <Layers className="w-4 h-4 mr-2 text-brand-orange" />
            Material Breakdown
          </h3>

          {totalGramsAll <= 1 ? (
            <div className="text-center py-12 text-slate-400 italic text-xs">
              No material consumption logged
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-5 flex-1 justify-center">
              {/* Donut Graphic */}
              <div className="relative w-36 h-36">
                <svg width="100%" height="100%" viewBox="0 0 150 150">
                  {/* Background Track */}
                  <circle cx="75" cy="75" r={donutRadius} fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
                  
                  {/* Segments */}
                  {(() => {
                    let currentOffset = 0;
                    return donutData.map((d) => {
                      const dashArray = `${(d.percent / 100) * donutCircumference} ${donutCircumference}`;
                      const dashOffset = currentOffset;
                      currentOffset -= (d.percent / 100) * donutCircumference;
                      return (
                        <circle
                          key={d.material}
                          r={donutRadius}
                          cx="75"
                          cy="75"
                          fill="transparent"
                          stroke={getMaterialColor(d.material)}
                          strokeWidth="16"
                          strokeDasharray={dashArray}
                          strokeDashoffset={dashOffset}
                          transform="rotate(-90 75 75)"
                        />
                      );
                    });
                  })()}
                </svg>
                {/* Mid label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider leading-none">Mass</span>
                  <span className="text-sm font-black text-slate-800 mt-0.5">
                    {totalGramsAll >= 1000 ? `${(totalGramsAll / 1000).toFixed(1)}kg` : `${totalGramsAll}g`}
                  </span>
                </div>
              </div>

              {/* Legends */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full text-[10px] font-bold">
                {donutData.map((d) => (
                  <div key={d.material} className="flex items-center space-x-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getMaterialColor(d.material) }} />
                    <span className="text-slate-500 truncate">{d.material}</span>
                    <span className="text-slate-800 font-extrabold">{Math.round(d.percent)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Client Leaderboard & Queue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Top Clients by Revenue */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-5">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <Users className="w-4 h-4 mr-2 text-brand-orange" />
            Top Clients by Revenue
          </h3>

          {rankedClients.length === 0 ? (
            <div className="py-8 text-center text-slate-400 italic text-xs">
              Awaiting completed jobs to aggregate client billing values.
            </div>
          ) : (
            <div className="space-y-4">
              {rankedClients.map((client, index) => {
                const widthPercent = Math.round((client.revenue / maxClientRevenue) * 100);
                
                return (
                  <div key={client.name} className="flex items-center justify-between space-x-6 text-xs">
                    <div className="flex items-center space-x-3 w-1/3 shrink-0">
                      <span className="font-bold text-slate-400 w-4">#{index + 1}</span>
                      <span className="font-semibold text-slate-850 truncate">{client.name}</span>
                    </div>
                    {/* Visual share bar */}
                    <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden relative">
                      <div 
                        className="bg-brand-orange h-full rounded-full transition-all duration-1000"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    {/* Revenue totals */}
                    <div className="text-right w-1/4 shrink-0 font-extrabold text-slate-800">
                      {formatCurrency(client.revenue)}
                      <span className="block text-[9px] text-slate-450 font-medium">{client.weight}g ({client.count} prints)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Circular Gauge for Success rate */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <Activity className="w-4 h-4 mr-2 text-brand-orange" />
            Print Success Analytics
          </h3>

          <div className="flex-1 flex flex-col items-center justify-center py-2 space-y-5">
            {/* Circular Gauge */}
            <div className="relative w-28 h-28">
              <svg width="100%" height="100%" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={printSuccessRate >= 80 ? '#FF8025' : printSuccessRate >= 50 ? '#f97316' : '#ef4444'}
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - printSuccessRate / 100)}
                  transform="rotate(-90 50 50)"
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Success</span>
                <span className="text-base font-black text-slate-800 mt-0.5">{printSuccessRate}%</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] w-full pt-2">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="block font-semibold text-slate-400 leading-none">QUEUED</span>
                <span className="block text-slate-800 font-black text-xs mt-1.5">{awaitingJobs.length + jobs.filter(j => j.status === 'Pending Quote').length}</span>
              </div>
              <div className="bg-blue-50/50 p-2.5 rounded-lg text-blue-700 border border-blue-100/30">
                <span className="block font-semibold text-blue-400 leading-none">RUNNING</span>
                <span className="block font-black text-xs mt-1.5">{printingJobs.length}</span>
              </div>
              <div className="bg-brand-orange/10 p-2.5 rounded-lg text-brand-orange border border-brand-orange/20">
                <span className="block font-semibold text-brand-orange/70 leading-none">DONE</span>
                <span className="block font-black text-xs mt-1.5">{completedJobs.length + jobs.filter(j => j.status === 'Ready for Pickup').length}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-[10px] w-full text-center">
              <div>
                <span className="text-slate-400 block font-bold uppercase tracking-wider">SUCCESS ATTEMPTS</span>
                <span className="text-brand-orange font-extrabold text-xs">{completedJobs.length}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase tracking-wider">FAILED ATTEMPTS</span>
                <span className="text-red-500 font-extrabold text-xs">{failures.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Waste & Failure Diagnostic Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Filament Wasted */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Filament Wasted</span>
            <span className="text-lg font-black text-red-700">
              {totalWastedGrams >= 1000 ? `${(totalWastedGrams / 1000).toFixed(2)} kg` : `${totalWastedGrams.toFixed(1)} g`}
            </span>
            <span className="text-[9px] text-slate-450 block mt-0.5">From failed prints</span>
          </div>
        </div>

        {/* Cost of Waste */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-655 shrink-0">
            <DollarSign className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Financial Loss (Waste)</span>
            <span className="text-lg font-black text-red-700">{formatCurrency(totalWastedCost)}</span>
            <span className="text-[9px] text-slate-450 block mt-0.5">Cost of extruded plastic wasted</span>
          </div>
        </div>

        {/* Wasted Printer Time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-650 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Wasted Machine Runtime</span>
            <span className="text-lg font-black text-orange-700">{wastedRuntimeHours} hrs</span>
            <span className="text-[9px] text-slate-450 block mt-0.5">Time spent on failed prints</span>
          </div>
        </div>
      </div>

      {/* Failure History Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <ShieldAlert className="w-4 h-4 mr-2 text-red-500" />
          Failed Print Logs
        </h3>

        {failures.length === 0 ? (
          <div className="py-6 text-center text-slate-400 italic text-xs">
            No failed print history recorded. Success rate is 100%!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-500 border-collapse">
              <thead className="text-[10px] uppercase text-slate-455 font-black bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Spool</th>
                  <th className="py-3 px-4 text-center">Failure %</th>
                  <th className="py-3 px-4 text-right">Wasted Mass</th>
                  <th className="py-3 px-4 text-right">Wasted Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {failures.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-medium text-slate-400">{f.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-700">{f.jobTitle}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{f.client}</td>
                    <td className="py-3 px-4 text-slate-500">{f.spoolName || 'Unknown Spool'}</td>
                    <td className="py-3 px-4 text-center font-bold text-red-500">{f.failurePercent}%</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-700">{f.wastedGrams.toFixed(1)} g</td>
                    <td className="py-3 px-4 text-right font-extrabold text-red-500">₱{f.wastedCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
