"use client";
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { parseOCROutput } from './utils/cardParser';
import { Camera, Download, Loader2, Save, RefreshCw, ScanLine, Smartphone, Repeat, FileSpreadsheet, Image as ImageIcon, User, Building, Briefcase, Mail, Phone, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- DARK THEME CONSTANTS ---
const COLORS = {
  bgMain: "bg-slate-950",
  bgCard: "bg-slate-900",
  textMain: "text-gray-100",
  textMuted: "text-gray-500",
  border: "border-slate-800",
  primary: "bg-indigo-500",
  primaryText: "text-indigo-400",
  primaryLight: "bg-slate-800",
  inputBg: "bg-slate-800",
  iconColor: "text-indigo-400"
};

// --- Components ---

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }} 
      animate={{ opacity: 1, y: 0, scale: 1 }} 
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`fixed bottom-6 left-6 right-6 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 backdrop-blur-md border ${
        type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-red-500/90 text-white border-red-400'
      }`}
    >
      <div className="font-medium text-sm">{message}</div>
    </motion.div>
  );
};

const InputField = ({ label, value, onChange, icon: Icon, placeholder, type = "text" }) => (
  <div className="relative group">
    <div className={`absolute left-3 top-3.5 ${COLORS.textMuted} group-focus-within:${COLORS.primaryText} transition-colors`}>
      <Icon size={18} />
    </div>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className={`w-full ${COLORS.inputBg} border ${COLORS.border} ${COLORS.textMain} pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium placeholder-gray-600 peer`}
      placeholder={placeholder}
      id={label}
    />
    <label 
      htmlFor={label}
      className={`absolute left-10 -top-2.5 ${COLORS.bgCard} px-1 text-xs font-bold ${COLORS.textMuted} transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:opacity-0 peer-focus:-top-2.5 peer-focus:opacity-100 peer-focus:${COLORS.primaryText}`}
    >
      {label}
    </label>
  </div>
);

// --- Main App ---

export default function MobileScanner() {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Scanning...");
  const [progress, setProgress] = useState(0);
  const [scannedData, setScannedData] = useState(null);
  const [toast, setToast] = useState(null);
  
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const backInputRef = useRef(null);

  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  const processImage = async (file, isBackSide = false) => {
    setLoading(true);
    setProgress(0);
    setLoadingMessage(isBackSide ? "Scanning Back Side..." : "Scanning Front Side...");
    try {
      const result = await Tesseract.recognize(file, 'eng', { logger: (m) => { if (m.status === 'recognizing text') setProgress(Math.floor(m.progress * 100)); }});
      const newData = parseOCROutput(result.data.text);
      if (isBackSide && scannedData) {
        setScannedData(prev => ({...prev, address: prev.address || newData.address, phone: prev.phone || newData.phone, email: prev.email || newData.email }));
        showToast("Back side info merged!", "success");
      } else {
        setScannedData(newData);
        showToast("Card scanned!", "success");
      }
    } catch (err) { showToast("Scanning failed.", "error"); } finally { setLoading(false); }
  };

  const validateForm = () => {
    if (!scannedData) return false;
    if (!scannedData.person_name || scannedData.person_name.trim().length < 2) { showToast("Name required", "error"); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    const { error } = await supabase.from('cards').insert([scannedData]);
    if (error) showToast("Failed to save", "error"); else { showToast("Saved!", "success"); setScannedData(null); }
  };

  const generateVCardHelper = () => { if(validateForm()) { 
    // Logic for vCard generation...
    const vCardData = `BEGIN:VCARD\nVERSION:3.0\nFN:${scannedData.person_name}\nORG:${scannedData.company_name}\nTITLE:${scannedData.designation}\nTEL;TYPE=WORK,VOICE:${scannedData.phone}\nEMAIL:${scannedData.email}\nADR;TYPE=WORK:;;${scannedData.address}\nEND:VCARD`;
    const blob = new Blob([vCardData], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scannedData.person_name || 'contact'}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("vCard created!", "success"); 
  }};

  const handleDownloadExcel = async () => {
    const { data, error } = await supabase.from('cards').select('*');
    if (error || !data) return showToast("Download failed", "error");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cards");
    XLSX.writeFile(wb, "My_Business_Cards.xlsx");
    showToast("Report downloaded!", "success");
  };

  return (
    <div className={`min-h-screen ${COLORS.bgMain} ${COLORS.textMain} font-sans transition-colors duration-300`}>
      
      {/* Header */}
      <header className={`${COLORS.bgCard}/90 backdrop-blur-md sticky top-0 z-30 border-b ${COLORS.border} px-6 py-4 flex justify-between items-center`}>
        <div className="flex items-center gap-2">
          <div className={`${COLORS.primary} p-2 rounded-lg shadow-lg shadow-indigo-500/20`}>
            <ScanLine className="text-white h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Card<span className={COLORS.primaryText}>Vault</span></h1>
        </div>
        {!scannedData && (
          <button onClick={handleDownloadExcel} className={`${COLORS.textMuted} hover:${COLORS.primaryText} transition-colors`}>
            <FileSpreadsheet size={24} />
          </button>
        )}
      </header>

      <main className="p-6 max-w-md mx-auto pb-32 relative">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[60vh] space-y-6">
              <div className="relative">
                <div className={`absolute inset-0 ${COLORS.primary} blur-xl opacity-20 animate-pulse rounded-full`}></div>
                <div className={`relative ${COLORS.bgCard} p-6 rounded-3xl shadow-xl border ${COLORS.border}`}>
                  <Loader2 className={`h-12 w-12 ${COLORS.iconColor} animate-spin`} />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">{loadingMessage}</h3>
                <div className={`w-48 h-2 ${COLORS.border} rounded-full overflow-hidden`}>
                  <motion.div className={`h-full ${COLORS.primary}`} initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                </div>
              </div>
            </motion.div>
          ) : scannedData ? (
            <motion.div key="form" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold">Review Details</h2>
                <button onClick={() => setScannedData(null)} className={`text-sm font-medium ${COLORS.textMuted} hover:text-red-500 flex items-center gap-1 ${COLORS.bgCard} px-3 py-1.5 rounded-full border ${COLORS.border} shadow-sm transition-colors`}>
                  <RefreshCw size={14} /> Clear
                </button>
              </div>

              <button onClick={() => backInputRef.current.click()} className={`w-full ${COLORS.primaryLight} border ${COLORS.border} ${COLORS.primaryText} py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-colors`}>
                <Repeat size={18} /> Scan Back Side to Add Address
              </button>

              <div className={`${COLORS.bgCard} rounded-3xl p-6 shadow-xl border ${COLORS.border} space-y-5`}>
                <InputField label="Person Name" placeholder="e.g. John Doe" value={scannedData.person_name} onChange={(e) => setScannedData({...scannedData, person_name: e.target.value})} icon={User} />
                <InputField label="Company" placeholder="e.g. Acme Inc." value={scannedData.company_name} onChange={(e) => setScannedData({...scannedData, company_name: e.target.value})} icon={Building} />
                <InputField label="Designation" placeholder="e.g. Sales Director" value={scannedData.designation} onChange={(e) => setScannedData({...scannedData, designation: e.target.value})} icon={Briefcase} />
                <InputField label="Email" type="email" placeholder="john@example.com" value={scannedData.email} onChange={(e) => setScannedData({...scannedData, email: e.target.value})} icon={Mail} />
                <InputField label="Phone" type="tel" placeholder="+1 555 0123" value={scannedData.phone} onChange={(e) => setScannedData({...scannedData, phone: e.target.value})} icon={Phone} />
                <InputField label="Address" placeholder="123 Market St, SF" value={scannedData.address} onChange={(e) => setScannedData({...scannedData, address: e.target.value})} icon={MapPin} />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                 <button onClick={generateVCardHelper} className={`flex items-center justify-center gap-2 ${COLORS.primaryLight} border ${COLORS.border} ${COLORS.primaryText} py-4 rounded-2xl font-bold hover:opacity-90 transition-colors`}>
                   <Smartphone size={20} /> Phone
                 </button>
                 <button onClick={handleSave} className={`flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all`}>
                   <Save size={20} /> Save
                 </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col justify-center pt-8 space-y-6">
              <div className="text-center space-y-2 mb-4">
                 <h2 className="text-2xl font-bold">Add New Card</h2>
                 <p className={COLORS.textMuted}>Choose how you want to scan</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div onClick={() => cameraInputRef.current.click()} className={`relative group cursor-pointer ${COLORS.bgCard} rounded-[2rem] p-6 shadow-xl border ${COLORS.border} flex items-center gap-4 hover:scale-[1.02] transition-all active:scale-95`}>
                  <div className={`h-14 w-14 ${COLORS.primary} rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30`}>
                    <Camera className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Open Camera</h3>
                    <p className={`${COLORS.textMuted} text-xs mt-0.5`}>Snap a photo directly</p>
                  </div>
                </div>

                <div onClick={() => galleryInputRef.current.click()} className={`relative group cursor-pointer ${COLORS.bgCard} rounded-[2rem] p-6 shadow-xl border ${COLORS.border} flex items-center gap-4 hover:scale-[1.02] transition-all active:scale-95`}>
                  <div className="h-14 w-14 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <ImageIcon className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Upload File</h3>
                    <p className={`${COLORS.textMuted} text-xs mt-0.5`}>Choose from Gallery</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={(e) => e.target.files[0] && processImage(e.target.files[0], false)} />
      <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={(e) => e.target.files[0] && processImage(e.target.files[0], false)} />
      <input type="file" accept="image/*" className="hidden" ref={backInputRef} onChange={(e) => e.target.files[0] && processImage(e.target.files[0], true)} />

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}