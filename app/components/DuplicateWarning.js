import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, User, Building, Briefcase, Mail, Phone, MapPin } from 'lucide-react';

export default function DuplicateWarning({ scannedCard, existingCard, onOverwrite, onSaveNew, onCancel }) {
  
  const fields = [
    { label: 'Name', key: 'person_name', icon: User },
    { label: 'Company', key: 'company_name', icon: Building },
    { label: 'Designation', key: 'designation', icon: Briefcase },
    { label: 'Email', key: 'email', icon: Mail },
    { label: 'Phone', key: 'phone', icon: Phone },
    { label: 'Address', key: 'address', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
      >
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-amber-500">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Duplicate Contact Detected</h2>
            <p className="text-gray-400 text-xs mt-0.5">We found a similar contact already saved in your vault.</p>
          </div>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Existing Contact Card */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Existing in Vault</h3>
            <div className="space-y-3">
              {fields.map(({ label, key, icon: Icon }) => {
                const val = existingCard[key] || '—';
                const hasDiff = (scannedCard[key] || '').trim().toLowerCase() !== (existingCard[key] || '').trim().toLowerCase() && scannedCard[key] && existingCard[key];
                return (
                  <div key={key} className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                      <Icon size={10} /> {label}
                    </span>
                    <span className={`text-sm font-medium ${hasDiff ? 'text-amber-400' : 'text-gray-300'} break-all`}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Newly Scanned Contact Card */}
          <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
              Scanned Details
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">New Scan</span>
            </h3>
            <div className="space-y-3">
              {fields.map(({ label, key, icon: Icon }) => {
                const val = scannedCard[key] || '—';
                const hasDiff = (scannedCard[key] || '').trim().toLowerCase() !== (existingCard[key] || '').trim().toLowerCase() && scannedCard[key] && existingCard[key];
                return (
                  <div key={key} className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                      <Icon size={10} /> {label}
                    </span>
                    <span className={`text-sm font-medium ${hasDiff ? 'text-amber-400 font-semibold' : 'text-gray-300'} break-all`}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/30 rounded-2xl p-4 border border-slate-800/60 text-xs text-gray-400 flex items-start gap-2">
          <ArrowRight size={14} className="text-indigo-400 mt-0.5 shrink-0" />
          <span>
            Selecting <strong>Overwrite</strong> will update the existing card with the scanned details. 
            Selecting <strong>Save as New</strong> will create a duplicate entry in your vault.
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-800 text-gray-400 hover:text-white hover:bg-slate-800 transition-colors font-semibold text-sm cursor-pointer"
          >
            Cancel & Edit
          </button>
          
          <button
            onClick={onSaveNew}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400 hover:bg-slate-750 transition-colors font-semibold text-sm cursor-pointer"
          >
            Save as New
          </button>

          <button
            onClick={onOverwrite}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            Overwrite Existing
          </button>
        </div>
      </motion.div>
    </div>
  );
}
