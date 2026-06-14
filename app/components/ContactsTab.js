import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Mail, Phone, MapPin, Calendar, Trash2, Edit2, Check, X, Smartphone } from 'lucide-react';

export default function ContactsTab({ cards, onUpdateCard, onDeleteCard }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');
  const [expandedId, setExpandedId] = useState(null);
  
  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // Generate unique lists for filter options
  const companies = ['All', ...new Set(cards.map(c => c.company_name).filter(Boolean))];
  
  const roleCategories = ['All', 'Developer/Engineer', 'Manager/Lead', 'Director/VP/Executive', 'Sales/Business', 'Consultant'];
  
  const getRoleCategory = (designation) => {
    if (!designation) return 'Other';
    const d = designation.toLowerCase();
    if (d.includes('engineer') || d.includes('developer') || d.includes('programmer') || d.includes('architect') || d.includes('tech')) return 'Developer/Engineer';
    if (d.includes('manager') || d.includes('lead') || d.includes('supervisor') || d.includes('head')) return 'Manager/Lead';
    if (d.includes('director') || d.includes('vp') || d.includes('executive') || d.includes('ceo') || d.includes('founder') || d.includes('president') || d.includes('chief')) return 'Director/VP/Executive';
    if (d.includes('sales') || d.includes('marketing') || d.includes('business') || d.includes('account') || d.includes('representative')) return 'Sales/Business';
    if (d.includes('consultant') || d.includes('advisor') || d.includes('expert')) return 'Consultant';
    return 'Other';
  };

  // 1. Search + Filter Logic
  const filteredCards = cards.filter(card => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (card.person_name || '').toLowerCase().includes(searchLower) ||
      (card.company_name || '').toLowerCase().includes(searchLower) ||
      (card.designation || '').toLowerCase().includes(searchLower) ||
      (card.email || '').toLowerCase().includes(searchLower) ||
      (card.phone || '').toLowerCase().includes(searchLower) ||
      (card.address || '').toLowerCase().includes(searchLower);

    const matchesCompany = selectedCompany === 'All' || card.company_name === selectedCompany;
    
    const matchesRole = selectedRole === 'All' || getRoleCategory(card.designation) === selectedRole;

    return matchesSearch && matchesCompany && matchesRole;
  });

  // 2. Sort Logic
  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'date-desc') {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (sortBy === 'date-asc') {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    if (sortBy === 'name-asc') {
      return (a.person_name || '').localeCompare(b.person_name || '');
    }
    if (sortBy === 'name-desc') {
      return (b.person_name || '').localeCompare(a.person_name || '');
    }
    if (sortBy === 'company-asc') {
      return (a.company_name || '').localeCompare(b.company_name || '');
    }
    return 0;
  });

  const highlightText = (text, highlight) => {
    if (!highlight || !text) return text;
    const parts = text.split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() 
            ? <mark key={i} className="bg-indigo-500/30 text-indigo-300 font-semibold rounded-sm px-0.5">{part}</mark>
            : part
        )}
      </span>
    );
  };

  const handleEditStart = (card) => {
    setEditingId(card.id);
    setEditForm({ ...card });
  };

  const handleEditSave = async (id) => {
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update card');
      
      onUpdateCard(data.card);
      setEditingId(null);
      setEditForm(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete card');
      
      onDeleteCard(id);
      if (expandedId === id) setExpandedId(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const generateVCard = (card) => {
    const vCardData = `BEGIN:VCARD\nVERSION:3.0\nFN:${card.person_name}\nORG:${card.company_name || ''}\nTITLE:${card.designation || ''}\nTEL;TYPE=WORK,VOICE:${card.phone || ''}\nEMAIL:${card.email || ''}\nADR;TYPE=WORK:;;${card.address || ''}\nEND:VCARD`;
    const blob = new Blob([vCardData], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${card.person_name || 'contact'}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-4">
        <div className="relative group">
          <div className="absolute left-3.5 top-3.5 text-gray-500 group-focus-within:text-indigo-400 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, company, email..."
            className="w-full bg-slate-800/80 border border-slate-750 text-white pl-11 pr-4 py-3.5 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder-gray-500 font-medium"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Company</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="bg-slate-800 border border-slate-750 text-gray-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-medium"
            >
              {companies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Role Group</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-slate-800 border border-slate-750 text-gray-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-medium"
            >
              {roleCategories.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 md:col-span-1 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-800 border border-slate-750 text-gray-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-medium"
            >
              <option value="date-desc">Newest Added</option>
              <option value="date-asc">Oldest Added</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="company-asc">Company (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards List count */}
      <div className="flex justify-between items-center px-1">
        <span className="text-sm text-gray-400 font-semibold">
          Showing {sortedCards.length} {sortedCards.length === 1 ? 'contact' : 'contacts'}
        </span>
      </div>

      {/* Cards List Grid */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {sortedCards.map((card) => {
            const isExpanded = expandedId === card.id;
            const isEditing = editingId === card.id;

            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`bg-slate-900 border ${isExpanded ? 'border-indigo-500/50 shadow-indigo-500/5' : 'border-slate-800'} rounded-3xl p-5 shadow-xl transition-shadow`}
              >
                {/* Header card info */}
                <div 
                  className="flex items-center gap-4 cursor-pointer"
                  onClick={() => !isEditing && setExpandedId(isExpanded ? null : card.id)}
                >
                  <div className="h-12 w-12 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/10 shrink-0">
                    {getInitials(card.person_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-white truncate leading-tight">
                      {highlightText(card.person_name, searchTerm)}
                    </h3>
                    <p className="text-xs text-gray-400 truncate mt-0.5 font-medium">
                      {card.designation && <>{highlightText(card.designation, searchTerm)} at </>}
                      <span className="text-indigo-400 font-bold">
                        {card.company_name ? highlightText(card.company_name, searchTerm) : 'No Company'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Expanded Section */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-800 mt-4 pt-4 space-y-4">
                        {isEditing ? (
                          // Edit Form fields
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={editForm.person_name}
                                onChange={(e) => setEditForm({ ...editForm, person_name: e.target.value })}
                                placeholder="Person Name"
                                className="bg-slate-800 border border-slate-750 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                              />
                              <input
                                type="text"
                                value={editForm.company_name || ''}
                                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                                placeholder="Company"
                                className="bg-slate-800 border border-slate-750 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={editForm.designation || ''}
                                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                                placeholder="Designation"
                                className="bg-slate-800 border border-slate-750 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                              />
                              <input
                                type="email"
                                value={editForm.email || ''}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                placeholder="Email"
                                className="bg-slate-800 border border-slate-750 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={editForm.phone || ''}
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                placeholder="Phone"
                                className="bg-slate-800 border border-slate-750 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                              />
                              <input
                                type="text"
                                value={editForm.address || ''}
                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                placeholder="Address"
                                className="bg-slate-800 border border-slate-750 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                onClick={() => { setEditingId(null); setEditForm(null); }}
                                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-gray-400 hover:text-white"
                              >
                                <X size={16} />
                              </button>
                              <button
                                onClick={() => handleEditSave(card.id)}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl flex items-center gap-1.5"
                              >
                                <Check size={16} /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Static details
                          <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-300">
                              {card.email && (
                                <div className="flex items-center gap-2">
                                  <Mail size={16} className="text-gray-500" />
                                  <a href={`mailto:${card.email}`} className="hover:text-indigo-400 hover:underline truncate">
                                    {highlightText(card.email, searchTerm)}
                                  </a>
                                </div>
                              )}
                              {card.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone size={16} className="text-gray-500" />
                                  <a href={`tel:${card.phone}`} className="hover:text-indigo-400 hover:underline">
                                    {highlightText(card.phone, searchTerm)}
                                  </a>
                                </div>
                              )}
                              {card.address && (
                                <div className="flex items-start gap-2 sm:col-span-2">
                                  <MapPin size={16} className="text-gray-500 shrink-0 mt-0.5" />
                                  <span className="leading-tight">
                                    {highlightText(card.address, searchTerm)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-gray-500 pl-0.5">
                              <Calendar size={12} />
                              <span>Added on {new Date(card.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                            </div>

                            {/* Contact Action Buttons */}
                            <div className="flex flex-wrap justify-between items-center border-t border-slate-800/60 pt-4 gap-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditStart(card)}
                                  className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-750 text-gray-400 hover:text-white hover:bg-slate-750 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Edit2 size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(card.id)}
                                  className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-750 text-red-400 hover:text-red-300 hover:bg-red-950/20 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => generateVCard(card)}
                                  className="px-3.5 py-2 rounded-xl bg-indigo-900/30 border border-indigo-900/40 text-indigo-400 hover:bg-indigo-900/50 hover:text-indigo-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Smartphone size={13} /> Export vCard
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sortedCards.length === 0 && (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 border-dashed rounded-3xl">
            <User size={32} className="mx-auto text-gray-600 mb-3" />
            <h3 className="text-gray-400 font-bold">No contacts found</h3>
            <p className="text-xs text-gray-500 mt-1">Try adjusting your filters or adding a new card.</p>
          </div>
        )}
      </div>
    </div>
  );
}
