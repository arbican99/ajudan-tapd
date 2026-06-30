import React, { useState } from 'react';
import { Users, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

export default function ModulAkunSkpd({ fallbackLogo }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Logika login internal disederhanakan untuk mode operasional modular
    setTimeout(() => {
      setLoading(false);
      alert("Sesi login operator diperbarui!");
    }, 800);
  };

  return (
    <div className="max-w-md mx-auto bg-slate-950/40 border border-blue-500/20 p-6 rounded-2xl font-mono text-[11px] backdrop-blur-md">
      <div className="text-center mb-6">
        <img 
          src={fallbackLogo} 
          alt="Avatar Core" 
          className="w-16 h-16 rounded-2xl mx-auto object-cover border border-blue-500/30 mb-3 shadow-lg shadow-blue-500/10"
        />
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-blue-400" /> Profil Otentikasi SKPD
        </h2>
        <p className="text-[9px] text-slate-500 uppercase font-bold mt-1">// CONFIG MANAGEMENT ENGINE</p>
      </div>

      <form onSubmit={handleLoginSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-[9px] uppercase font-bold mb-1">Operator Username</label>
          <div className="relative">
            <Users size={14} className="absolute left-3 top-2.5 text-slate-600" />
            <input 
              type="text" required
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full bg-slate-950 border border-blue-950/60 rounded-xl pl-9 pr-3 py-2 text-white focus:border-blue-500 outline-none" 
              placeholder="Masukkan ID SKPD / Dinas"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-[9px] uppercase font-bold mb-1">Security Token / Password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-2.5 text-slate-600" />
            <input 
              type={showPassword ? "text" : "password"} required
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full bg-slate-950 border border-blue-950/60 rounded-xl pl-9 pr-3 py-2 text-white focus:border-blue-500 outline-none" 
              placeholder="••••••••"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          {loading ? 'INITIALIZING ENGINE...' : 'L O G I N'} <ArrowRight size={14} />
        </button>
      </form>
    </div>
  );
}