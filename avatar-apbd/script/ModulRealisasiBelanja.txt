import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart2, Layers, Users, Map as MapIcon, 
  Cpu, Terminal, Calendar, ChevronDown, ChevronRight
} from 'lucide-react';

export default function ModulRealisasiBelanja() {
  const [skpdList, setSkpdList] = useState([]);
  const [tahunList, setTahunList] = useState([]);
  const [selectedSkpd, setSelectedSkpd] = useState('REKAP');
  const [selectedTahun, setSelectedTahun] = useState('ALL');
  const [activePage, setActivePage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [rawRealData, setRawRealData] = useState([]);
  const [mrekMap, setMrekMap] = useState(new window.Map());

  // Treeview Expanded States
  const [expandedSubgiat, setExpandedSubgiat] = useState({});
  const [expandedPerdin, setExpandedPerdin] = useState({});

  useEffect(() => {
    ambilDataFilter();
  }, []);

  useEffect(() => {
    fetchMainData();
  }, [selectedSkpd, selectedTahun]);

  const ambilDataFilter = async () => {
    try {
      const { data, error } = await supabase
        .from('data_realisasi')
        .select('Kode_Skpd, Nama_Skpd, tahun');
      
      if (error) throw error;

      if (data) {
        const uniqueSkpd = [];
        const mapSkpd = new window.Map();
        const uniqueTahun = new Set();
        
        data.forEach(item => {
          if (item.Kode_Skpd && !mapSkpd.has(item.Kode_Skpd)) {
            mapSkpd.set(item.Kode_Skpd, true);
            uniqueSkpd.push({
              kode_skpd: item.Kode_Skpd,
              nama_skpd: item.Nama_Skpd || 'Tanpa Nama SKPD'
            });
          }
          if (item.tahun) uniqueTahun.add(item.tahun.toString());
        });

        uniqueSkpd.sort((a, b) => a.kode_skpd.localeCompare(b.kode_skpd));
        setSkpdList(uniqueSkpd);
        setTahunList(Array.from(uniqueTahun).sort());
        
        if (uniqueTahun.size > 0) {
          setSelectedTahun(Array.from(uniqueTahun).sort().pop());
        }
      }
    } catch (err) {
      console.error("Gagal mengambil filter:", err.message);
    }
  };

  const fetchMainData = async () => {
    setLoading(true);
    try {
      let queryReal = supabase.from('data_realisasi').select('Kode_Skpd, Nama_Skpd, Kode_Rekening, Nama_Rekening, Anggaran, Realisasi, Kode_Subgiat, Nama_Subgiat, tahun');
      if (selectedSkpd !== 'REKAP') queryReal = queryReal.eq('Kode_Skpd', selectedSkpd);
      if (selectedTahun !== 'ALL') queryReal = queryReal.eq('tahun', parseInt(selectedTahun));
      
      const { data: realData, error: errorReal } = await queryReal;
      if (errorReal) throw errorReal;
      setRawRealData(realData || []);

      const { data: mrekData, error: errorMrek } = await supabase.from('mrek').select('kdrek, nmrek');
      if (errorMrek) throw errorMrek;

      const newMrekMap = new window.Map();
      if (mrekData) mrekData.forEach(item => newMrekMap.set(item.kdrek, item.nmrek));
      setMrekMap(newMrekMap);

    } catch (err) {
      console.error("Gagal memuat pipeline data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // ⚡ OPTIMIZED DATA PROCESSING ENGINE (useMemo)
  const processedData = useMemo(() => {
    let totalPagu = 0, totalReal = 0;
    let opPagu = 0, opReal = 0;
    let modPagu = 0, modReal = 0;
    let ttPagu = 0, ttReal = 0;
    let trPagu = 0, trReal = 0;

    const mapPage1 = new window.Map();
    const mapPage2Tree = new window.Map();
    const mapPage4Tree = new window.Map();

    rawRealData.forEach(item => {
      const ang = parseFloat(item.Anggaran) || 0;
      const rea = parseFloat(item.Realisasi) || 0;
      const kodeRek = item.Kode_Rekening || '';
      const kodeSubgiat = item.Kode_Subgiat || 'UNMAPPED';
      const namaSubgiat = item.Nama_Subgiat || 'Tanpa Nama Subkegiatan';

      // 1. Dashboard Stats
      if (kodeRek.startsWith('5.1')) { opPagu += ang; opReal += rea; }
      else if (kodeRek.startsWith('5.2')) { modPagu += ang; modReal += rea; }
      else if (kodeRek.startsWith('5.3')) { ttPagu += ang; ttReal += rea; }
      else if (kodeRek.startsWith('5.4')) { trPagu += ang; trReal += rea; }
      totalPagu += ang;
      totalReal += rea;

      // 2. Page 1 Architecture
      if (kodeRek) {
        if (!mapPage1.has(kodeRek)) {
          mapPage1.set(kodeRek, { kode: kodeRek, nama: item.Nama_Rekening || mrekMap.get(kodeRek) || 'Nomenklatur Rincian', anggaran: 0, realisasi: 0 });
        }
        const current = mapPage1.get(kodeRek);
        current.anggaran += ang;
        current.realisasi += rea;

        const parts = kodeRek.split('.');
        let currentPrefix = '';
        parts.forEach((part, idx) => {
          currentPrefix = idx === 0 ? part : `${currentPrefix}.${part}`;
          if (currentPrefix !== kodeRek && currentPrefix.startsWith('5')) {
            if (!mapPage1.has(currentPrefix)) {
              mapPage1.set(currentPrefix, { 
                kode: currentPrefix, 
                nama: mrekMap.get(currentPrefix) || (currentPrefix === '5' ? 'BELANJA DAERAH' : currentPrefix === '5.1' ? 'BELANJA OPERASI' : 'Induk Akun'), 
                anggaran: 0, 
                realisasi: 0 
              });
            }
            const parentItem = mapPage1.get(currentPrefix);
            parentItem.anggaran += ang;
            parentItem.realisasi += rea;
          }
        });
      }

      // 3. Page 2 Architecture (Tree)
      if (kodeSubgiat) {
        if (!mapPage2Tree.has(kodeSubgiat)) {
          mapPage2Tree.set(kodeSubgiat, { kode: kodeSubgiat, nama: namaSubgiat, anggaran: 0, realisasi: 0, children: new window.Map() });
        }
        const subgiatNode = mapPage2Tree.get(kodeSubgiat);
        subgiatNode.anggaran += ang;
        subgiatNode.realisasi += rea;

        if (!subgiatNode.children.has(kodeRek)) {
          subgiatNode.children.set(kodeRek, { kode: kodeRek, nama: item.Nama_Rekening || mrekMap.get(kodeRek) || 'Rekening Subkegiatan', anggaran: 0, realisasi: 0 });
        }
        const childNode = subgiatNode.children.get(kodeRek);
        childNode.anggaran += ang;
        childNode.realisasi += rea;
      }

      // 4. Page 4 Architecture (Tree)
      if (kodeRek.startsWith('5.1.02.04')) {
        if (!mapPage4Tree.has(kodeSubgiat)) {
          mapPage4Tree.set(kodeSubgiat, { kode: kodeSubgiat, nama: namaSubgiat, anggaran: 0, realisasi: 0, children: new window.Map() });
        }
        const perdinNode = mapPage4Tree.get(kodeSubgiat);
        perdinNode.anggaran += ang;
        perdinNode.realisasi += rea;

        if (!perdinNode.children.has(kodeRek)) {
          perdinNode.children.set(kodeRek, { kode: kodeRek, nama: item.Nama_Rekening || mrekMap.get(kodeRek) || 'Akun Perdin', anggaran: 0, realisasi: 0 });
        }
        const childNode = perdinNode.children.get(kodeRek);
        childNode.anggaran += ang;
        childNode.realisasi += rea;
      }
    });

    const arrPage1 = Array.from(mapPage1.values()).sort((a, b) => a.kode.localeCompare(b.kode));
    const arrPage2 = Array.from(mapPage2Tree.values()).map(node => ({ ...node, children: Array.from(node.children.values()) }));
    const arrPage4 = Array.from(mapPage4Tree.values()).map(node => ({ ...node, children: Array.from(node.children.values()) }));

    return {
      stats: {
        rekap: { anggaran: totalPagu, realisasi: totalReal },
        operasi: { anggaran: opPagu, realisasi: opReal },
        modal: { anggaran: modPagu, realisasi: modReal },
        takTerduga: { anggaran: ttPagu, realisasi: ttReal },
        transfer: { anggaran: trPagu, realisasi: trReal },
      },
      page1: arrPage1,
      page2: arrPage2,
      page3: arrPage1.filter(item => item.kode.startsWith('5.1.01')),
      page4: arrPage4
    };
  }, [rawRealData, mrekMap]);

  const toggleSubgiat = (id) => setExpandedSubgiat(prev => ({ ...prev, [id]: !prev[id] }));
  const togglePerdin = (id) => setExpandedPerdin(prev => ({ ...prev, [id]: !prev[id] }));

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
  };

  const hitungPersen = (anggaran, realisasi) => {
    if (!anggaran) return '0.00%';
    return `${((realisasi / anggaran) * 100).toFixed(2)}%`;
  };

  const RenderPieChart = ({ title, anggaran, realisasi, colorNeon, glowClass }) => {
    if (!anggaran || anggaran === 0) return null;
    const persen = (realisasi / anggaran) * 100;
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(persen, 100) / 100) * circumference;

    return (
      <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.8)] min-h-[190px]">
        <div className={`absolute top-0 left-0 w-full h-[2px] ${glowClass}`}></div>
        <div className="text-white font-black uppercase tracking-widest text-[10px] mb-3 flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${glowClass} inline-block`}></span>
          {title}
        </div>
        <div className="relative w-24 h-24 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.2)]">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} className="stroke-slate-800/80 fill-none" strokeWidth="8" />
            <circle 
              cx="50" cy="50" r={radius} 
              className={`${colorNeon} fill-none transition-all duration-1000`} 
              strokeWidth="8" 
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono leading-tight">
            <span className="text-[14px] font-black text-white">{persen.toFixed(0)}%</span>
            <span className="text-[7px] text-slate-400 mt-0.5 font-bold uppercase">CAPAIAN</span>
          </div>
        </div>
        <div className="mt-3 font-mono text-[9px] w-full border-t border-slate-900 pt-2 space-y-0.5">
          <div className="text-slate-400">PAGU: <span className="text-cyan-400 font-bold">{formatRupiah(anggaran)}</span></div>
          <div className="text-slate-300">REAL: <span className="text-emerald-400 font-black">{formatRupiah(realisasi)}</span></div>
        </div>
      </div>
    );
  };

  // 📊 BIGGER NEON YELLOW HORIZONTAL BAR CHART (Digunakan di semua halaman)
  const RenderHorizontalBarChart = ({ targetData, isTree }) => {
    const { totalAnggaran, totalRealisasi } = useMemo(() => {
      let ang = 0, rea = 0;
      if (isTree) {
        targetData.forEach(x => { ang += x.anggaran; rea += x.realisasi; });
      } else {
        // Khusus struktur page 1 & 3, hitung hanya akun induk utama '5' agar tidak terjadi double counting
        const rootItem = targetData.find(x => x.kode === '5');
        if (rootItem) {
          ang = rootItem.anggaran;
          rea = rootItem.realisasi;
        } else {
          targetData.forEach(x => { if(x.kode.split('.').length === 3) { ang += x.anggaran; rea += x.realisasi; } });
        }
      }
      return { totalAnggaran: ang, totalRealisasi: rea };
    }, [targetData, isTree]);

    const persen = totalAnggaran > 0 ? (totalRealisasi / totalAnggaran) * 100 : 0;

    return (
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-black border-2 border-amber-500/20 p-5 rounded-2xl space-y-3.5 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center font-mono text-[10px] gap-2 tracking-wider">
          <div className="flex items-center gap-2 font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
            <Cpu size={13} className="animate-pulse text-amber-400" /> 
            LIVE BUDGET MATRIX VISUALIZATION // GLOW ACCELERATOR
          </div>
          <div className="text-slate-400 text-[11px]">
            TOTAL PAGU: <span className="text-white font-bold">{formatRupiah(totalAnggaran)}</span> | 
            REALISASI: <span className="text-yellow-400 font-black drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] pl-1">{formatRupiah(totalRealisasi)}</span>
          </div>
        </div>
        
        {/* Diperbesar: h-4 menjadi h-7 (Lebih Tebal & Terang) */}
        <div className="relative h-7 bg-slate-950 rounded-xl border-2 border-slate-800 p-0.5 overflow-hidden flex items-center shadow-[inset_0_0_15px_rgba(0,0,0,0.9)]">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.8)] transition-all duration-1000 flex items-center justify-end pr-3 font-mono text-[10px] text-slate-950 font-black tracking-widest"
            style={{ width: `${Math.min(persen, 100)}%` }}
          >
            {persen > 8 && `${persen.toFixed(2)}% MATCH`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-slate-100 p-1">
      
      {/* 1. LAYER FILTER CODES */}
      <div className="flex flex-col sm:flex-row gap-4 bg-slate-950/90 border-2 border-cyan-500/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.05)] backdrop-blur-md">
        <div className="flex-1 space-y-1">
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-widest pl-1">
            <Terminal size={11} className="text-cyan-400 animate-pulse" />
            FILTER DATA COMPONENT (SKPD)
          </label>
          <select
            value={selectedSkpd}
            onChange={(e) => setSelectedSkpd(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none cursor-pointer"
          >
            <option value="REKAP">» [ALL PORTAL] REKAPITULASI TOTAL DAERAH</option>
            {skpdList.map((skpd, i) => (
              <option key={i} value={skpd.kode_skpd}>» {skpd.kode_skpd} - {skpd.nama_skpd}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-48 space-y-1">
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-widest pl-1">
            <Calendar size={11} className="text-cyan-400" />
            TAHUN ANGGARAN
          </label>
          <select
            value={selectedTahun}
            onChange={(e) => setSelectedTahun(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">» SEMUA TAHUN</option>
            {tahunList.map((th, i) => (
              <option key={i} value={th}>» TAHUN {th}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. LAYER DONUT CHARTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <RenderPieChart title="Total Rekap" anggaran={processedData.stats.rekap.anggaran} realisasi={processedData.stats.rekap.realisasi} colorNeon="stroke-cyan-400" glowClass="bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
        <RenderPieChart title="Belanja Operasi" anggaran={processedData.stats.operasi.anggaran} realisasi={processedData.stats.operasi.realisasi} colorNeon="stroke-indigo-400" glowClass="bg-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
        <RenderPieChart title="Belanja Modal" anggaran={processedData.stats.modal.anggaran} realisasi={processedData.stats.modal.realisasi} colorNeon="stroke-amber-400" glowClass="bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
        <RenderPieChart title="Belanja Tak Terduga" anggaran={processedData.stats.takTerduga.anggaran} realisasi={processedData.stats.takTerduga.realisasi} colorNeon="stroke-red-500" glowClass="bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
        <RenderPieChart title="Belanja Transfer" anggaran={processedData.stats.transfer.anggaran} realisasi={processedData.stats.transfer.realisasi} colorNeon="stroke-emerald-400" glowClass="bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
      </div>

      {/* 3. LAYER NAVIGATION TABS FRAME (DIBAWAH DONUT CHART & TANPA NOMOR) */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2 bg-slate-900/90 p-2 border border-slate-700 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.6)]">
        {[
          { id: 1, label: 'REKAP AKUN', icon: Layers },
          { id: 2, label: 'SUBKEGIATAN', icon: BarChart2 },
          { id: 3, label: 'BL. PEGAWAI', icon: Users },
          { id: 4, label: 'PERJALANAN DINAS', icon: MapIcon }
        ].map((page) => {
          const Icon = page.icon;
          const isSelected = activePage === page.id;
          return (
            <button
              key={page.id}
              onClick={() => { setActivePage(page.id); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-mono text-[10px] font-black tracking-widest transition-all duration-200 border-2 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 border-white text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.8)] scale-[1.02]'
                  : 'border-cyan-400/60 text-cyan-300 hover:text-white hover:border-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50'
              }`}
            >
              <Icon size={13} className={isSelected ? 'text-slate-950 stroke-[3]' : 'text-cyan-400'} />
              <span className="whitespace-nowrap">{page.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. LAYER DATA PRESENTATION WITH LIVE ACCELERATED GLOW CHARTS */}
      <div className="space-y-4">
        
        {/* Glowing Yellow Bar Chart Rendered on EVERY Page Switch */}
        {activePage === 1 && <RenderHorizontalBarChart targetData={processedData.page1} isTree={false} />}
        {activePage === 2 && <RenderHorizontalBarChart targetData={processedData.page2} isTree={true} />}
        {activePage === 3 && <RenderHorizontalBarChart targetData={processedData.page3} isTree={false} />}
        {activePage === 4 && <RenderHorizontalBarChart targetData={processedData.page4} isTree={true} />}

        <div className="bg-slate-950/95 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
          {loading ? (
            <div className="p-16 text-center text-xs font-mono text-cyan-400 font-bold tracking-[0.3em] flex flex-col items-center justify-center gap-3">
              <Cpu className="animate-spin text-cyan-400" size={22} />
              <span>ENGAGING QUANTUM SCHEMA DEPLOYMENT...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              
              {/* ==================== SCREEN PAGE 1 ==================== */}
              {activePage === 1 && (
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                      <th className="p-4 border-r border-slate-900">Kode Rekening</th>
                      <th className="p-4 border-r border-slate-900">Struktur Nomenklatur Rekening (mrek)</th>
                      <th className="p-4 text-right border-r border-slate-900">Pagu Anggaran</th>
                      <th className="p-4 text-right border-r border-slate-900">Realisasi Keuangan</th>
                      <th className="p-4 text-right border-r border-slate-900">Sisa Anggaran</th>
                      <th className="p-4 text-center">Capaian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/80">
                    {processedData.page1.map((row, index) => {
                      const level = row.kode.split('.').length;
                      const isParent = level <= 2;
                      return (
                        <tr key={index} className={`hover:bg-cyan-950/20 transition-colors group ${isParent ? 'bg-slate-950 font-black text-cyan-300' : 'text-slate-200'}`}>
                          <td className={`p-3.5 whitespace-nowrap border-r border-slate-900 font-bold ${isParent ? 'text-cyan-400' : 'text-slate-500'}`}>{row.kode}</td>
                          <td className="p-3.5 max-w-sm truncate border-r border-slate-900" style={{ paddingLeft: `${level * 12}px` }}>
                            {isParent ? row.nama.toUpperCase() : row.nama}
                          </td>
                          <td className="p-3.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(row.anggaran)}</td>
                          <td className="p-3.5 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(row.realisasi)}</td>
                          <td className="p-3.5 text-right border-r border-slate-900 text-amber-500/90">{formatRupiah(row.anggaran - row.realisasi)}</td>
                          <td className="p-3.5 text-center font-black text-cyan-400 bg-cyan-950/10">{hitungPersen(row.anggaran, row.realisasi)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* ==================== SCREEN PAGE 2 (TREEVIEW SUBKEGIATAN) ==================== */}
              {activePage === 2 && (
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                      <th className="p-4 border-r border-slate-900 w-48">Kode Identifikasi</th>
                      <th className="p-4 border-r border-slate-900">Nomenklatur Kerja (Subkegiatan &rarr; Rekening)</th>
                      <th className="p-4 text-right border-r border-slate-900">Pagu Anggaran</th>
                      <th className="p-4 text-right border-r border-slate-900">Realisasi</th>
                      <th className="p-4 text-right border-r border-slate-900">Sisa Pagu</th>
                      <th className="p-4 text-center">Capaian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {processedData.page2.map((subgiat, idx) => {
                      const isExpanded = !!expandedSubgiat[subgiat.kode];
                      return (
                        <React.Fragment key={idx}>
                          <tr 
                            onClick={() => toggleSubgiat(subgiat.kode)}
                            className="bg-slate-950/60 hover:bg-indigo-950/30 border-l-4 border-indigo-500 cursor-pointer text-indigo-300 font-bold transition-all"
                          >
                            <td className="p-3 border-r border-slate-900 tracking-wide font-black">{subgiat.kode}</td>
                            <td className="p-3 border-r border-slate-900 flex items-center gap-2 max-w-sm truncate text-slate-100">
                              {isExpanded ? <ChevronDown size={14} className="text-indigo-400" /> : <ChevronRight size={14} className="text-indigo-400" />}
                              <span>{subgiat.nama.toUpperCase()}</span>
                            </td>
                            <td className="p-3 text-right border-r border-slate-900 text-slate-400">{formatRupiah(subgiat.anggaran)}</td>
                            <td className="p-3 text-right border-r border-slate-900 text-emerald-400 font-black">{formatRupiah(subgiat.realisasi)}</td>
                            <td className="p-3 text-right border-r border-slate-900 text-amber-500">{formatRupiah(subgiat.anggaran - subgiat.realisasi)}</td>
                            <td className="p-3 text-center font-black text-indigo-400 bg-indigo-950/10">{hitungPersen(subgiat.anggaran, subgiat.realisasi)}</td>
                          </tr>
                          {isExpanded && subgiat.children.map((child, cIdx) => (
                            <tr key={cIdx} className="bg-slate-900/20 hover:bg-slate-900/50 text-slate-300 text-[10px]">
                              <td className="p-2.5 pl-6 border-r border-slate-900 text-slate-500 font-medium">{child.kode}</td>
                              <td className="p-2.5 pl-10 border-r border-slate-900 max-w-sm truncate italic text-slate-400">&bull; {child.nama}</td>
                              <td className="p-2.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(child.anggaran)}</td>
                              <td className="p-2.5 text-right border-r border-slate-900 text-emerald-400/80">{formatRupiah(child.realisasi)}</td>
                              <td className="p-2.5 text-right border-r border-slate-900 text-slate-500">{formatRupiah(child.anggaran - child.realisasi)}</td>
                              <td className="p-2.5 text-center text-cyan-400 font-bold">{hitungPersen(child.anggaran, child.realisasi)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* ==================== SCREEN PAGE 3 ==================== */}
              {activePage === 3 && (
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                      <th className="p-4 border-r border-slate-900">Kode Objek &rarr; Subrincian</th>
                      <th className="p-4 border-r border-slate-900">Uraian Komponen Belanja Pegawai</th>
                      <th className="p-4 text-right border-r border-slate-900">Anggaran</th>
                      <th className="p-4 text-right border-r border-slate-900">Realisasi</th>
                      <th className="p-4 text-right border-r border-slate-900">Sisa Anggaran</th>
                      <th className="p-4 text-center">Persen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-slate-200">
                    {processedData.page3.map((row, index) => (
                      <tr key={index} className="hover:bg-cyan-950/20 transition-colors group">
                        <td className="p-3.5 text-cyan-400 font-bold whitespace-nowrap border-r border-slate-900">{row.kode}</td>
                        <td className="p-3.5 max-w-sm truncate border-r border-slate-900 text-slate-100">{row.nama}</td>
                        <td className="p-3.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(row.anggaran)}</td>
                        <td className="p-3.5 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(row.realisasi)}</td>
                        <td className="p-3.5 text-right border-r border-slate-900 text-amber-500">{formatRupiah(row.anggaran - row.realisasi)}</td>
                        <td className="p-3.5 text-center font-black text-cyan-400 bg-cyan-950/10">{hitungPersen(row.anggaran, row.realisasi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ==================== SCREEN PAGE 4 (TREEVIEW PERJALANAN DINAS) ==================== */}
              {activePage === 4 && (
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                      <th className="p-4 border-r border-slate-900 w-48">Kode Unit</th>
                      <th className="p-4 border-r border-slate-900">Komponen Kerja Perjalanan Dinas (Akun 5.1.02.04)</th>
                      <th className="p-4 text-right border-r border-slate-900">Anggaran</th>
                      <th className="p-4 text-right border-r border-slate-900">Realisasi</th>
                      <th className="p-4 text-right border-r border-slate-900">Sisa Pagu</th>
                      <th className="p-4 text-center">Persen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {processedData.page4.map((perdin, idx) => {
                      const isExpanded = !!expandedPerdin[perdin.kode];
                      return (
                        <React.Fragment key={idx}>
                          <tr 
                            onClick={() => togglePerdin(perdin.kode)}
                            className="bg-slate-950 hover:bg-amber-950/20 border-l-4 border-amber-500 cursor-pointer text-amber-400 font-bold transition-all"
                          >
                            <td className="p-3 border-r border-slate-900 text-slate-500">{perdin.kode}</td>
                            <td className="p-3 border-r border-slate-900 flex items-center gap-2 max-w-xs truncate text-slate-200">
                              {isExpanded ? <ChevronDown size={14} className="text-amber-400" /> : <ChevronRight size={14} className="text-amber-400" />}
                              <span>{perdin.nama.toUpperCase()}</span>
                            </td>
                            <td className="p-3 text-right border-r border-slate-900 text-slate-400">{formatRupiah(perdin.anggaran)}</td>
                            <td className="p-3 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(perdin.realisasi)}</td>
                            <td className="p-3 text-right border-r border-slate-900 text-slate-500">{formatRupiah(perdin.anggaran - perdin.realisasi)}</td>
                            <td className="p-3 text-center font-black text-amber-400 bg-amber-950/10">{hitungPersen(perdin.anggaran, perdin.realisasi)}</td>
                          </tr>
                          {isExpanded && perdin.children.map((child, cIdx) => (
                            <tr key={cIdx} className="bg-slate-900/40 text-[10px] text-slate-300">
                              <td className="p-2.5 pl-6 border-r border-slate-900 text-slate-500">{child.kode}</td>
                              <td className="p-2.5 pl-10 border-r border-slate-900 italic text-amber-300/80">&bull; {child.nama}</td>
                              <td className="p-2.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(child.anggaran)}</td>
                              <td className="p-2.5 text-right border-r border-slate-900 text-emerald-400/80">{formatRupiah(child.realisasi)}</td>
                              <td className="p-2.5 text-right border-r border-slate-900 text-slate-600">{formatRupiah(child.anggaran - child.realisasi)}</td>
                              <td className="p-2.5 text-center font-bold text-emerald-400">{hitungPersen(child.anggaran, child.realisasi)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}