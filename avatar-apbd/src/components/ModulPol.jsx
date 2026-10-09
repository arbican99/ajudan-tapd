import React from 'react';
import { Scale, Info, ShieldCheck, Clock } from 'lucide-react';

export default function ModulPol() {
  return (
    <div className="space-y-6 font-mono text-[11px]">
      {/* Banner Informasi Modul */}
      <div className="bg-slate-950/40 backdrop-blur-md border border-cyan-500/30 p-6 rounded-2xl relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.05)]">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-start gap-4">
          <div className="p-3 bg-cyan-950/60 border border-cyan-500/40 rounded-xl text-cyan-400 shrink-0">
            <Scale size={24} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold rounded uppercase">
                STAGING NODE
              </span>
              <span className="text-slate-500">// MODUL PERTIMBANGAN OBJEKTIF LAINNYA</span>
            </div>

            <h2 className="text-base font-black text-white tracking-wider uppercase">
              MODUL PERTIMBANGAN OBJEKTIF LAINNYA (POL)
            </h2>

            <p className="text-slate-400 leading-relaxed max-w-2xl text-[10px]">
              Ruang kerja untuk analisis dan pencatatan parameter Pertimbangan Objektif Lainnya dalam proses verifikasi APBD. Halaman ini sudah terhubung penuh ke menu utama dan siap diimplementasikan.
            </p>
          </div>
        </div>
      </div>

      {/* Grid Placeholder Informasi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/30 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <ShieldCheck size={14} />
            <span>AKSES STATUS</span>
          </div>
          <p className="text-slate-500 text-[10px]">Tersedia untuk role ADMIN dan TAPD.</p>
        </div>

        <div className="bg-slate-950/30 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <Clock size={14} />
            <span>NAVIGASI ACTIVE</span>
          </div>
          <p className="text-slate-500 text-[10px]">Tab aktif ID: <code className="text-slate-300">verifikasi-pol</code></p>
        </div>

        <div className="bg-slate-950/30 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <Info size={14} />
            <span>KONDISI FILE</span>
          </div>
          <p className="text-slate-500 text-[10px]">Export Default disesuaikan untuk <code className="text-slate-300">App.jsx</code>.</p>
        </div>
      </div>
    </div>
  );
}