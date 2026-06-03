import React, { useState } from 'react';
import { User, Phone, Mail, Building, Plus, Trash2, Edit2, Search, X } from 'lucide-react';
import { Job } from './KanbanBoard';
import { PrintHistoryRecord } from '../types';
import { FailureRecord } from './AnalyticsDashboard';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  dateAdded: string;
}

interface CustomerManagerProps {
  customers: Customer[];
  jobs: Job[];
  historyLog?: PrintHistoryRecord[];
  failures?: FailureRecord[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (id: string, updated: Partial<Customer>) => void;
  onDeleteCustomer: (id: string) => void;
}

export default function CustomerManager({
  customers,
  jobs,
  historyLog = [],
  failures = [],
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
}: CustomerManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');

  // Selected customer for detailed view
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setName(customer.name);
    setEmail(customer.email);
    setPhone(customer.phone);
    setCompany(customer.company);
    setNotes(customer.notes);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      onUpdateCustomer(editingId, { name, email, phone, company, notes });
      setEditingId(null);
    } else {
      const newCustomer: Customer = {
        id: 'cust-' + Math.random().toString(36).substring(2, 9),
        name,
        email,
        phone,
        company,
        notes,
        dateAdded: new Date().toLocaleDateString(),
      };
      onAddCustomer(newCustomer);
    }

    // Reset form
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setNotes('');
    setShowForm(false);
  };

  // Filtered customer list
  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate statistics for a customer
  const getCustomerStats = (customerName: string) => {
    // 1. Filter active board jobs (excluding Completed ones to prevent duplicates)
    const clientActiveJobs = jobs.filter(j => 
      (j.client || '').toLowerCase() === customerName.toLowerCase() && 
      j.status !== 'Completed'
    );
    
    // 2. Filter completed runs from history ledger
    const clientHistory = historyLog.filter(h => 
      (h.client || '').toLowerCase() === customerName.toLowerCase()
    );

    // 3. Filter failure runs
    const clientFailures = failures.filter(f => 
      (f.client || '').toLowerCase() === customerName.toLowerCase()
    );

    const totalSpent = clientHistory.reduce((sum, h) => sum + h.price, 0);
    const totalFilament = clientHistory.reduce((sum, h) => sum + h.weightGrams, 0) + clientFailures.reduce((sum, f) => sum + f.wastedGrams, 0);
    
    const activeJobs = clientActiveJobs.filter(j => j.status === 'Printing' || j.status === 'Awaiting Approval' || j.status === 'Ready for Pickup').length;
    const jobCount = clientActiveJobs.length + clientHistory.length + clientFailures.length;

    // Build unified order history timeline
    const activeMapped = clientActiveJobs.map(job => ({
      id: job.id,
      title: job.title,
      dateCreated: job.dateCreated,
      status: job.status,
      price: job.price,
    }));

    const historyMapped = clientHistory.map(h => ({
      id: h.id,
      title: h.jobTitle,
      dateCreated: h.completedAt ? new Date(h.completedAt).toLocaleDateString() : new Date().toLocaleDateString(),
      status: 'Completed' as const,
      price: h.price,
    }));

    const failedMapped = clientFailures.map(f => ({
      id: f.id,
      title: `${f.jobTitle} (Failed ${f.failurePercent}%)`,
      dateCreated: f.date,
      status: 'Failed' as const,
      price: f.wastedCost,
    }));

    const clientJobs = [...activeMapped, ...historyMapped, ...failedMapped].sort((a, b) => 
      new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    );

    return { totalSpent, totalFilament, jobCount, activeJobs, clientJobs };
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedStats = selectedCustomer ? getCustomerStats(selectedCustomer.name) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Customer Directory</h2>
          <p className="text-xs text-slate-400 mt-1">Manage client profiles, contact information, and order analytics.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setName('');
            setEmail('');
            setPhone('');
            setCompany('');
            setNotes('');
            setShowForm(!showForm);
          }}
          className="bg-brand-orange hover:bg-brand-orange/90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Client Profile</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 animate-slideIn">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-800 text-sm">{editingId ? 'Edit Client Profile' : 'New Client Profile'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Company / Organization</label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+63 917 123 4567"
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Internal Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add special requirements, filament preferences, or delivery addresses..."
                rows={3}
                className="w-full text-xs rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 p-2.5"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {editingId ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Directory List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center px-4 space-x-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client name, email, or company..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-xs p-0 text-slate-700 placeholder-slate-400"
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center space-y-3">
              <User className="w-12 h-12 text-slate-200 mx-auto stroke-1" />
              <div>
                <h4 className="font-bold text-slate-700">No Customers Found</h4>
                <p className="text-xs text-slate-400 mt-1">Start by adding a client profile to build client analytics history.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCustomers.map(customer => {
                const stats = getCustomerStats(customer.name);
                const isSelected = selectedCustomerId === customer.id;

                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:shadow-md ${
                      isSelected ? 'border-brand-orange ring-2 ring-brand-orange/10' : 'border-slate-100'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="font-black text-slate-800 text-sm tracking-tight">{customer.name}</h3>
                          {customer.company && (
                            <span className="inline-flex items-center text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                              <Building className="w-3 h-3 mr-1" />
                              {customer.company}
                            </span>
                          )}
                        </div>
                        <div className="flex space-x-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleEdit(customer)}
                            className="p-1.5 text-slate-400 hover:text-slate-650 hover:bg-slate-50 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete profile for ${customer.name}?`)) {
                                onDeleteCustomer(customer.id);
                                if (selectedCustomerId === customer.id) setSelectedCustomerId(null);
                              }
                            }}
                            className="p-1.5 text-red-400 hover:text-red-650 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-[11px] text-slate-500 font-medium">
                        {customer.email && (
                          <div className="flex items-center">
                            <Mail className="w-3.5 h-3.5 mr-2 text-slate-450 shrink-0" />
                            <span className="truncate">{customer.email}</span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center">
                            <Phone className="w-3.5 h-3.5 mr-2 text-slate-450 shrink-0" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-450">Jobs: <strong className="text-slate-700">{stats.jobCount}</strong></span>
                      <span className="text-slate-450">Spent: <strong className="text-brand-orange font-extrabold">₱{stats.totalSpent.toLocaleString()}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Detail Analytics Panel */}
        <div className="lg:col-span-1">
          {selectedCustomer && selectedStats ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6 animate-slideIn">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Client Profile Analytics</span>
                <h3 className="font-black text-slate-800 text-base">{selectedCustomer.name}</h3>
                <p className="text-[10px] text-slate-400">Added on {selectedCustomer.dateAdded}</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total spent</span>
                  <span className="text-base font-black text-brand-orange mt-1 block">₱{selectedStats.totalSpent.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Filament Used</span>
                  <span className="text-base font-black text-slate-800 mt-1 block">{selectedStats.totalFilament.toLocaleString()} g</span>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Jobs Booked</span>
                  <span className="text-base font-black text-slate-800 mt-1 block">{selectedStats.jobCount}</span>
                </div>
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Active Jobs</span>
                  <span className="text-base font-black text-amber-500 mt-1 block">{selectedStats.activeJobs}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedCustomer.notes && (
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Internal Notes</span>
                  <div className="p-3 bg-slate-50/50 rounded-xl text-xs text-slate-650 leading-relaxed border border-slate-100">
                    {selectedCustomer.notes}
                  </div>
                </div>
              )}

              {/* Job history timeline */}
              <div className="space-y-3">
                <span className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Order History</span>
                {selectedStats.clientJobs.length === 0 ? (
                  <p className="text-xs text-slate-450 italic">No orders linked to this client yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {selectedStats.clientJobs.map(job => (
                      <div key={job.id} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-100 bg-slate-50/20 text-xs">
                        <div className="space-y-0.5 max-w-[140px]">
                          <span className="font-bold text-slate-700 block truncate">{job.title}</span>
                          <span className="text-[9px] text-slate-400">{job.dateCreated}</span>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold ${
                            job.status === 'Completed' ? 'bg-brand-orange/10 text-brand-orange' :
                            job.status === 'Printing' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {job.status}
                          </span>
                          <span className="block font-black text-slate-800 text-[10px] mt-0.5">₱{job.price.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100 p-8 text-center text-slate-400 space-y-2">
              <User className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
              <span className="text-xs block font-bold">Select a Client</span>
              <p className="text-[10px] leading-relaxed max-w-[160px] mx-auto text-slate-400">
                Click a client card on the left to review metrics and full job history.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
