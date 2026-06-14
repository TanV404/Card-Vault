"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { parseOCROutput } from './utils/cardParser';
import { findDuplicateContact } from './utils/fuzzy';
import { Camera, Download, Loader2, Save, RefreshCw, ScanLine, Smartphone, Repeat, FileSpreadsheet, Image as ImageIcon, User, Building, Briefcase, Mail, Phone, MapPin, Network, LogOut, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Sub components ---
import Auth from './components/Auth';
import ContactsTab from './components/ContactsTab';
import NetworkGraph from './components/NetworkGraph';
import DuplicateWarning from './components/DuplicateWarning';

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

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3500); return () => clearTimeout(timer); }, [onClose]);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }} 
      animate={{ opacity: 1, y: 0, scale: 1 }} 
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`fixed bottom-24 left-6 right-6 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 backdrop-blur-md border ${
        type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-red-500/90 text-white border-red-400'
      }`}
    >
      <div className="font-semibold text-sm leading-tight">{message}</div>
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

export default function MobileScanner() {
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('scan'); // 'scan', 'contacts', 'graph', 'profile'
  
  // OCR and Input States
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Scanning...");
  const [progress, setProgress] = useState(0);
  const [scannedData, setScannedData] = useState(null);
  
  // Duplicate Match Overlay State
  const [duplicateMatch, setDuplicateMatch] = useState(null); // { newCard, existingCard }

  const [toast, setToast] = useState(null);
  
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const backInputRef = useRef(null);

  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  // 2. Fetch Cards
  const fetchCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const response = await fetch('/api/cards');
      const data = await response.json();
      if (response.ok && data.cards) {
        setCards(data.cards);
      }
    } catch (err) {
      showToast("Failed to fetch contacts.", "error");
      console.error('Fetch cards error:', err);
    } finally {
      setCardsLoading(false);
    }
  }, []);

  // 1. Fetch Auth Session on Mount
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (response.ok && data.user) {
          setUser(data.user);
          // Fetch contacts immediately
          fetchCards();
        }
      } catch (err) {
        console.error('Failed to verify session:', err);
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
  }, [fetchCards]);

  const processImage = async (file, isBackSide = false) => {
    setLoading(true);
    setProgress(0);
    setLoadingMessage(isBackSide ? "Scanning Back Side..." : "Scanning Front Side...");
    try {
      const result = await Tesseract.recognize(file, 'eng', { 
        logger: (m) => { 
          if (m.status === 'recognizing text') setProgress(Math.floor(m.progress * 100)); 
        }
      });
      const newData = parseOCROutput(result.data.text);
      if (isBackSide && scannedData) {
        setScannedData(prev => ({
          ...prev, 
          address: prev.address || newData.address, 
          phone: prev.phone || newData.phone, 
          email: prev.email || newData.email 
        }));
        showToast("Back side info merged!", "success");
      } else {
        setScannedData(newData);
        showToast("Card scanned!", "success");
      }
    } catch (err) { 
      showToast("Scanning failed.", "error"); 
      console.error('Image scan error:', err);
    } finally { 
      setLoading(false); 
    }
  };

  const validateForm = () => {
    if (!scannedData) return false;
    if (!scannedData.person_name || scannedData.person_name.trim().length < 2) { 
      showToast("Name required (at least 2 chars)", "error"); 
      return false; 
    }
    return true;
  };

  // Triggered when user clicks "Save" inside the Scan review form
  const handleSaveAttempt = () => {
    if (!validateForm()) return;

    // Check for duplicates in local cached state first
    const duplicate = findDuplicateContact(scannedData, cards);

    if (duplicate) {
      setDuplicateMatch({ newCard: scannedData, existingCard: duplicate.card });
    } else {
      // Save directly
      saveCardDirect(scannedData);
    }
  };

  // Saves a new card directly to the server
  const saveCardDirect = async (cardData) => {
    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');

      // Update local cards state
      setCards(prev => [data.card, ...prev]);
      showToast("Saved to your vault!", "success");
      setScannedData(null);
      setDuplicateMatch(null);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Overwrites an existing card
  const handleOverwrite = async () => {
    if (!duplicateMatch) return;
    const { existingCard, newCard } = duplicateMatch;
    
    try {
      const response = await fetch(`/api/cards/${existingCard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_name: newCard.person_name,
          company_name: newCard.company_name || existingCard.company_name,
          designation: newCard.designation || existingCard.designation,
          email: newCard.email || existingCard.email,
          phone: newCard.phone || existingCard.phone,
          address: newCard.address || existingCard.address,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to overwrite');

      // Update local state
      setCards(prev => prev.map(c => c.id === existingCard.id ? data.card : c));
      showToast("Card details updated/overwritten!", "success");
      setScannedData(null);
      setDuplicateMatch(null);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Ignore warning and save duplicate as new contact
  const handleSaveAsNew = () => {
    if (!duplicateMatch) return;
    saveCardDirect(duplicateMatch.newCard);
  };

  const generateVCardHelper = () => { 
    if(validateForm()) { 
      const vCardData = `BEGIN:VCARD\nVERSION:3.0\nFN:${scannedData.person_name}\nORG:${scannedData.company_name || ''}\nTITLE:${scannedData.designation || ''}\nTEL;TYPE=WORK,VOICE:${scannedData.phone || ''}\nEMAIL:${scannedData.email || ''}\nADR;TYPE=WORK:;;${scannedData.address || ''}\nEND:VCARD`;
      const blob = new Blob([vCardData], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${scannedData.person_name || 'contact'}.vcf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("vCard created!", "success"); 
    }
  };

  const handleDownloadExcel = () => {
    if (cards.length === 0) {
      return showToast("No contacts available to export.", "error");
    }
    const ws = XLSX.utils.json_to_sheet(cards);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vault Cards");
    XLSX.writeFile(wb, "CardVault_Contacts_Export.xlsx");
    showToast("Report exported successfully!", "success");
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        setUser(null);
        setCards([]);
        setActiveTab('scan');
        showToast("Logged out successfully");
      }
    } catch (err) {
      showToast("Logout failed.", "error");
      console.error('Logout error:', err);
    }
  };

  const handleUpdateCard = (updatedCard) => {
    setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
    showToast("Contact updated!", "success");
  };

  const handleDeleteCard = (deletedId) => {
    setCards(prev => prev.filter(c => c.id !== deletedId));
    showToast("Contact deleted", "success");
  };

  // Get dynamic count of companies in the user's vault
  const uniqueCompaniesCount = new Set(cards.map(c => (c.company_name || 'Independent').trim()).filter(Boolean)).size;

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
        <span className="text-sm font-semibold text-gray-500">Checking session status...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth 
        onLoginSuccess={(userData) => {
          setUser(userData);
          fetchCards();
        }} 
      />
    );
  }

  return (
    <div className={`min-h-screen ${COLORS.bgMain} ${COLORS.textMain} font-sans transition-colors duration-300 pb-28`}>
      
      {/* Header */}
      <header className={`${COLORS.bgCard}/90 backdrop-blur-md sticky top-0 z-30 border-b ${COLORS.border} px-6 py-4 flex justify-between items-center`}>
        <div className="flex items-center gap-2">
          <div className={`${COLORS.primary} p-2 rounded-lg shadow-lg shadow-indigo-500/20`}>
            <ScanLine className="text-white h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Card<span className={COLORS.primaryText}>Vault</span></h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-gray-400">{user.email}</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white">
            {user.email[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="p-6 max-w-xl mx-auto relative">
        <AnimatePresence mode="wait">
          {activeTab === 'scan' && (
            <motion.div 
              key="scan-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center h-[50vh] space-y-6">
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
                </div>
              ) : scannedData ? (
                // Review scanned results form
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-extrabold">Review Details</h2>
                    <button onClick={() => setScannedData(null)} className={`text-sm font-semibold ${COLORS.textMuted} hover:text-red-500 flex items-center gap-1 ${COLORS.bgCard} px-3.5 py-1.5 rounded-full border ${COLORS.border} shadow-sm transition-colors cursor-pointer`}>
                      <RefreshCw size={14} /> Clear
                    </button>
                  </div>

                  <button onClick={() => backInputRef.current.click()} className={`w-full ${COLORS.primaryLight} border ${COLORS.border} ${COLORS.primaryText} py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-750 transition-colors cursor-pointer`}>
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
                     <button onClick={generateVCardHelper} className={`flex items-center justify-center gap-2 ${COLORS.primaryLight} border ${COLORS.border} ${COLORS.primaryText} py-4 rounded-2xl font-bold hover:bg-slate-750 transition-colors cursor-pointer`}>
                       <Smartphone size={20} /> Local vCard
                     </button>
                     <button onClick={handleSaveAttempt} className={`flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all cursor-pointer hover:bg-indigo-500`}>
                       <Save size={20} /> Save Contact
                     </button>
                  </div>
                </div>
              ) : (
                // Scanner landing panel
                <div className="flex flex-col justify-center pt-8 space-y-6">
                  <div className="text-center space-y-2 mb-4">
                     <h2 className="text-3xl font-extrabold text-white">Add New Card</h2>
                     <p className={COLORS.textMuted}>Digitize business cards instantly using local OCR</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div onClick={() => cameraInputRef.current.click()} className={`relative group cursor-pointer ${COLORS.bgCard} rounded-[2rem] p-6 shadow-xl border ${COLORS.border} flex items-center gap-4 hover:scale-[1.02] transition-all active:scale-95`}>
                      <div className={`h-14 w-14 ${COLORS.primary} rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30`}>
                        <Camera className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">Open Camera</h3>
                        <p className={`${COLORS.textMuted} text-xs mt-0.5`}>Snap a photo of the card</p>
                      </div>
                    </div>

                    <div onClick={() => galleryInputRef.current.click()} className={`relative group cursor-pointer ${COLORS.bgCard} rounded-[2rem] p-6 shadow-xl border ${COLORS.border} flex items-center gap-4 hover:scale-[1.02] transition-all active:scale-95`}>
                      <div className="h-14 w-14 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                        <ImageIcon className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">Upload File</h3>
                        <p className={`${COLORS.textMuted} text-xs mt-0.5`}>Upload card front from gallery</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'contacts' && (
            <motion.div 
              key="contacts-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {cardsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                  <span className="text-xs text-gray-500 font-semibold">Loading contacts...</span>
                </div>
              ) : (
                <ContactsTab 
                  cards={cards} 
                  onUpdateCard={handleUpdateCard} 
                  onDeleteCard={handleDeleteCard} 
                />
              )}
            </motion.div>
          )}

          {activeTab === 'graph' && (
            <motion.div 
              key="graph-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <NetworkGraph cards={cards} />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2 mb-2">
                 <h2 className="text-3xl font-extrabold text-white">Your Account</h2>
                 <p className={COLORS.textMuted}>Manage data and vault preferences</p>
              </div>

              {/* Stats Block */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center shadow-md">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Cards</span>
                  <div className="text-3xl font-extrabold text-indigo-400 mt-1">{cards.length}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center shadow-md">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Company Hubs</span>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-1">{uniqueCompaniesCount}</div>
                </div>
              </div>

              {/* Preferences list */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
                <div className="flex flex-col pb-4 border-b border-slate-800/60">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Logged In As</span>
                  <span className="text-sm font-bold text-white mt-1 break-all">{user.email}</span>
                </div>

                <div className="flex items-center justify-between py-2 cursor-pointer group" onClick={handleDownloadExcel}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Export Spreadsheet</h4>
                      <p className="text-[10px] text-gray-500">Download entire vault as Excel (.xlsx)</p>
                    </div>
                  </div>
                  <Download size={16} className="text-gray-500 group-hover:text-emerald-400 transition-colors" />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-slate-800/60 pt-4 cursor-pointer group" onClick={handleLogout}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400">
                      <LogOut size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">Log Out</h4>
                      <p className="text-[10px] text-gray-500">Clear session and exit vault</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-600 flex items-center justify-center gap-1.5 pt-4">
                <Info size={12} />
                <span>CardVault is secure and powered by a private PostgreSQL database.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden file inputs */}
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={(e) => e.target.files[0] && processImage(e.target.files[0], false)} />
      <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={(e) => e.target.files[0] && processImage(e.target.files[0], false)} />
      <input type="file" accept="image/*" className="hidden" ref={backInputRef} onChange={(e) => e.target.files[0] && processImage(e.target.files[0], true)} />

      {/* Overlays */}
      <AnimatePresence>
        {duplicateMatch && (
          <DuplicateWarning 
            scannedCard={duplicateMatch.newCard} 
            existingCard={duplicateMatch.existingCard} 
            onOverwrite={handleOverwrite} 
            onSaveNew={handleSaveAsNew} 
            onCancel={() => setDuplicateMatch(null)} 
          />
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800/80 px-6 py-4 flex justify-around items-center z-40 max-w-md mx-auto rounded-t-3xl shadow-2xl">
        <button 
          onClick={() => { setActiveTab('scan'); setScannedData(null); }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === 'scan' ? 'text-indigo-400 font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Camera size={20} className={activeTab === 'scan' ? 'animate-bounce' : ''} />
          <span className="text-[10px]">Scan</span>
        </button>

        <button 
          onClick={() => setActiveTab('contacts')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === 'contacts' ? 'text-indigo-400 font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <User size={20} />
          <span className="text-[10px]">Contacts</span>
        </button>

        <button 
          onClick={() => setActiveTab('graph')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === 'graph' ? 'text-indigo-400 font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Network size={20} />
          <span className="text-[10px]">Network</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === 'profile' ? 'text-indigo-400 font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <User size={20} className="rounded-full border border-current p-0.5" />
          <span className="text-[10px]">Account</span>
        </button>
      </nav>
    </div>
  );
}