import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart2, Layers, Users, Map as MapIcon, 
  Cpu, Terminal, Calendar, ChevronDown, ChevronRight, TrendingUp, ShoppingBag
} from 'lucide-react';

export default function ModulRealisasiBelanja() {
  const [skpdList, setSkpdList] = useState([]);
  const [tahunList, setTahunList] = useState([]);
  const [selectedSkpd, setSelectedSkpd] = useState('REKAP');
  const [selectedTahun, setSelectedTahun] = useState('ALL');
  
  const [activePage, setActivePage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [rawRealData, setRawRealData] = useState([]);
  const [mrekMap, setMrekMap] = useState(new window.Map());

  const [expandedSubgiat, setExpandedSubgiat] = useState({});
  const [expandedPerdin, setExpandedPerdin] = useState({});
  const [expandedBarang, setExpandedBarang] = useState({});

  useEffect(() => {
    setActivePage(1);
  }, [selectedSkpd]);

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
      if (mrekData) mrekData.forEach(item => newMrekMap.set(item.kdrek.trim(), item.nmrek));
      setMrekMap(newMrekMap);

    } catch (err) {
      console.error("Gagal memuat pipeline data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizeKodeRekening = (kodeRaw) => {
    if (!kodeRaw) return '';
    const seg = kodeRaw.trim().split('.');
    if (seg.length >= 5) {
      seg[4] = seg[4].padStart(3, '0');
    }
    if (seg.length >= 6) {
      seg[5] = seg[5].padStart(5, '0');
    }
    return seg.join('.');
  };

  const processedData = useMemo(() => {
    let totalPagu = 0, totalReal = 0;
    let opPagu = 0, opReal = 0;
    let modPagu = 0, modReal = 0;
    let ttPagu = 0, ttReal = 0;
    let trPagu = 0, trReal = 0;
    
    let pegPagu = 0, pegReal = 0;
    let perdinPagu = 0, perdinReal = 0;
    let barangPagu = 0, barangReal = 0;

    const globalLeafMap = new window.Map();
    const mapPage2Tree = new window.Map();
    const mapPage4Tree = new window.Map();
    const mapPage5Tree = new window.Map();

    rawRealData.forEach(item => {
      const ang = parseFloat(item.Anggaran) || 0;
      const rea = parseFloat(item.Realisasi) || 0;
      const kodeRek = normalizeKodeRekening(item.Kode_Rekening);
      const kodeSubgiat = item.Kode_Subgiat || 'UNMAPPED';
      const namaSubgiat = item.Nama_Subgiat || 'Tanpa Nama Subkegiatan';

      totalPagu += ang;
      totalReal += rea;

      if (kodeRek.startsWith('5.1')) { opPagu += ang; opReal += rea; }
      else if (kodeRek.startsWith('5.2')) { modPagu += ang; modReal += rea; }
      else if (kodeRek.startsWith('5.3')) { ttPagu += ang; ttReal += rea; }
      else if (kodeRek.startsWith('5.4')) { trPagu += ang; trReal += rea; }

      if (kodeRek.startsWith('5.1.01')) { pegPagu += ang; pegReal += rea; }
      if (kodeRek.startsWith('5.1.02.04')) { perdinPagu += ang; perdinReal += rea; }
      if (kodeRek.startsWith('5.1.02.01')) { barangPagu += ang; barangReal += rea; }

      if (kodeRek) {
        if (!globalLeafMap.has(kodeRek)) {
          globalLeafMap.set(kodeRek, { anggaran: 0, realisasi: 0 });
        }
        const target = globalLeafMap.get(kodeRek);
        target.anggaran += ang;
        target.realisasi += rea;
      }

      if (kodeSubgiat) {
        if (!mapPage2Tree.has(kodeSubgiat)) {
          mapPage2Tree.set(kodeSubgiat, { kode: kodeSubgiat, nama: namaSubgiat, anggaran: 0, realisasi: 0, children: new window.Map() });
        }
        const subgiatNode = mapPage2Tree.get(kodeSubgiat);
        subgiatNode.anggaran += ang;
        subgiatNode.realisasi += rea;

        if (!subgiatNode.children.has(kodeRek)) {
          subgiatNode.children.set(kodeRek, { kode: kodeRek, nama: mrekMap.get(kodeRek) || item.Nama_Rekening || '-', anggaran: 0, realisasi: 0 });
        }
        const childNode = subgiatNode.children.get(kodeRek);
        childNode.anggaran += ang;
        childNode.realisasi += rea;
      }

      if (kodeRek.startsWith('5.1.02.04')) {
        if (!mapPage4Tree.has(kodeSubgiat)) {
          mapPage4Tree.set(kodeSubgiat, { kode: kodeSubgiat, nama: namaSubgiat, anggaran: 0, realisasi: 0, children: new window.Map() });
        }
        const perdinNode = mapPage4Tree.get(kodeSubgiat);
        perdinNode.anggaran += ang;
        perdinNode.realisasi += rea;

        if (!perdinNode.children.has(kodeRek)) {
          perdinNode.children.set(kodeRek, { kode: kodeRek, nama: mrekMap.get(kodeRek) || item.Nama_Rekening || '-', anggaran: 0, realisasi: 0 });
        }
        const childNode = perdinNode.children.get(kodeRek);
        childNode.anggaran += ang;
        childNode.realisasi += rea;
      }

      if (kodeRek.startsWith('5.1.02.01')) {
        if (!mapPage5Tree.has(kodeSubgiat)) {
          mapPage5Tree.set(kodeSubgiat, { kode: kodeSubgiat, nama: namaSubgiat, anggaran: 0, realisasi: 0, children: new window.Map() });
        }
        const barangNode = mapPage5Tree.get(kodeSubgiat);
        barangNode.anggaran += ang;
        barangNode.realisasi += rea;

        if (!barangNode.children.has(kodeRek)) {
          barangNode.children.set(kodeRek, { kode: kodeRek, nama: mrekMap.get(kodeRek) || item.Nama_Rekening || '-', anggaran: 0, realisasi: 0 });
        }
        const childNode = barangNode.children.get(kodeRek);
        childNode.anggaran += ang;
        childNode.realisasi += rea;
      }
    });

    const hierarchicalRekapMap = new window.Map();

    globalLeafMap.forEach((dataNilai, kodeRekening) => {
      const seg = kodeRekening.split('.');
      const prefixes = [];

      if (seg.length >= 1) prefixes.push(seg[0]); 
      if (seg.length >= 2) prefixes.push(`${seg[0]}.${seg[1]}`); 
      if (seg.length >= 3) prefixes.push(`${seg[0]}.${seg[1]}.${seg[2]}`); 
      if (seg.length >= 4) prefixes.push(`${seg[0]}.${seg[1]}.${seg[2]}.${seg[3]}`); 
      if (seg.length >= 5) prefixes.push(`${seg[0]}.${seg[1]}.${seg[2]}.${seg[3]}.${seg[4]}`); 
      if (seg.length >= 6) prefixes.push(`${seg[0]}.${seg[1]}.${seg[2]}.${seg[3]}.${seg[4]}.${seg[5]}`); 

      prefixes.forEach(pfx => {
        if (pfx.startsWith('5')) {
          if (!hierarchicalRekapMap.has(pfx)) {
            hierarchicalRekapMap.set(pfx, {
              kode: pfx,
              nama: mrekMap.get(pfx) || '-',
              anggaran: 0,
              realisasi: 0
            });
          }
          const node = hierarchicalRekapMap.get(pfx);
          node.anggaran += dataNilai.anggaran;
          node.realisasi += dataNilai.realisasi;
        }
      });
    });

    const arrPage1 = Array.from(hierarchicalRekapMap.values()).sort((a, b) => a.kode.localeCompare(b.kode));
    
    const arrPage2 = Array.from(mapPage2Tree.values()).map(node => {
      const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.kode.localeCompare(b.kode));
      return { ...node, children: sortedChildren };
    });
    
    const arrPage4 = Array.from(mapPage4Tree.values()).map(node => {
      const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.kode.localeCompare(b.kode));
      return { ...node, children: sortedChildren };
    });

    const arrPage5 = Array.from(mapPage5Tree.values()).map(node => {
      const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.kode.localeCompare(b.kode));
      return { ...node, children: sortedChildren };
    });

    return {
      stats: {
        rekap: { anggaran: totalPagu, realisasi: totalReal },
        operasi: { anggaran: opPagu, realisasi: opReal },
        modal: { anggaran: modPagu, realisasi: modReal },
        takTerduga: { anggaran: ttPagu, realisasi: ttReal },
        transfer: { anggaran: trPagu, realisasi: trReal },
        pegawai: { anggaran: pegPagu, realisasi: pegReal },
        perdin: { anggaran: perdinPagu, realisasi: perdinReal },
        barang: { anggaran: barangPagu, realisasi: barangReal }
      },
      page1: arrPage1,
      page2: arrPage2,
      page3: arrPage1.filter(item => item.kode.startsWith('5.1.01')),
      page4: arrPage4,
      page5: arrPage5
    };
  }, [rawRealData, mrekMap]);

  const page5SkpdMatrix = useMemo(() => {
    const skpdMap = new window.Map();

    rawRealData.forEach(item => {
      const kodeSkpd = item.Kode_Skpd || 'UNMAPPED';
      const namaSkpd = item.Nama_Skpd || 'Tanpa Nama SKPD';
      const ang = parseFloat(item.Anggaran) || 0;
      const rea = parseFloat(item.Realisasi) || 0;
      const kodeRek = normalizeKodeRekening(item.Kode_Rekening);

      if (!skpdMap.has(kodeSkpd)) {
        skpdMap.set(kodeSkpd, {
          kode: kodeSkpd,
          nama: namaSkpd,
          totalAng: 0, totalReal: 0,
          pegawaiAng: 0, pegawaiReal: 0,
          perdinAng: 0, perdinReal: 0,
          modalAng: 0, modalReal: 0
        });
      }

      const row = skpdMap.get(kodeSkpd);
      row.totalAng += ang;
      row.totalReal += rea;

      if (kodeRek.startsWith('5.1.01')) { row.pegawaiAng += ang; row.pegawaiReal += rea; }
      if (kodeRek.startsWith('5.1.02.04')) { row.perdinAng += ang; row.perdinReal += rea; }
      if (kodeRek.startsWith('5.2')) { row.modalAng += ang; row.modalReal += rea; }
    });

    return Array.from(skpdMap.values()).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [rawRealData]);

  const toggleSubgiat = (id) => setExpandedSubgiat(prev => ({ ...prev, [id]: !prev[id] }));
  const togglePerdin = (id) => setExpandedPerdin(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleBarang = (id) => setExpandedBarang(prev => ({ ...prev, [id]: !prev[id] }));

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
  };

  const hitungPersen = (anggaran, realisasi) => {
    if (!anggaran) return '0.00%';
    return `${((realisasi / anggaran) * 100).toFixed(2)}%`;
  };

  // ⚡ MENAMPILKAN PROSENTASE TERHADAP TOTAL REKAP (PROP. PAGU)
  const RenderPieChart = ({ title, anggaran, realisasi, colorNeon, glowClass, totalRekapPagu }) => {
    if (!anggaran || anggaran === 0) return null;
    const persen = (realisasi / anggaran) * 100;
    const radius = 40; 
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(persen, 100) / 100) * circumference;
    const sisa = anggaran - realisasi;
    
    // Hitung proporsi sektor terhadap pagu total rekap belanja
    const proporsiPagu = totalRekapPagu > 0 ? (anggaran / totalRekapPagu) * 100 : 0;

    return (
      <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-5 relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.8)] min-h-[175px] w-full">
        <div className={`absolute top-0 left-0 w-full h-[2px] ${glowClass}`}></div>
        
        {/* Sisi Kiri: Donut Chart */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="text-white font-black uppercase tracking-widest text-[9px] mb-2 block md:hidden">
            {title}
          </div>
          <div className="relative w-28 h-28 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.2)]">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r={radius} className="stroke-slate-800/80 fill-none" strokeWidth="9" />
              <circle 
                cx="55" cy="55" r={radius} 
                className={`${colorNeon} fill-none transition-all duration-1000`} 
                strokeWidth="9" 
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-mono leading-tight">
              <span className="text-[16px] font-black text-white">{persen.toFixed(0)}%</span>
              <span className="text-[6px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">CAPAIAN</span>
            </div>
          </div>
        </div>

        {/* Sisi Kanan: Detail Informasi */}
        <div className="flex-1 font-mono text-[11px] w-full space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
          <div className="text-white font-black uppercase tracking-widest text-[10px] hidden md:flex items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${glowClass} inline-block`}></span>
              {title}
            </div>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">PAGU:</span> 
            <span className="text-cyan-400 font-bold whitespace-nowrap">{formatRupiah(anggaran)}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">REAL:</span> 
            <span className="text-emerald-400 font-black whitespace-nowrap">{formatRupiah(realisasi)}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">SISA:</span> 
            <span className="text-amber-500 font-bold whitespace-nowrap">{formatRupiah(sisa)}</span>
          </div>
          {/* Menyembunyikan PROP. PAGU jika chart-nya adalah Total Rekap, sekaligus merubah warna ke kuning neon */}
          {title !== "Total Rekap" && (
            <div className="flex justify-between items-center gap-4 border-t border-slate-900 pt-1 text-[10px]">
              <span className="text-yellow-400 font-bold">% PAGU:</span> 
              <span className="text-yellow-400 font-black whitespace-nowrap bg-yellow-950/40 px-1.5 py-0.5 rounded border border-yellow-900/40">
                {proporsiPagu.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const RenderHorizontalHeaderBar = () => {
    let targetAnggaran = processedData.stats.rekap.anggaran;
    let targetRealisasi = processedData.stats.rekap.realisasi;
    let contextTitle = "TOTAL REKAPITULASI BELANJA DAERAH";

    if (selectedSkpd !== 'REKAP') {
      if (activePage === 3) {
        targetAnggaran = processedData.stats.pegawai.anggaran;
        targetRealisasi = processedData.stats.pegawai.realisasi;
        contextTitle = "MATRIKS KHUSUS: BELANJA PEGAWAI (KODE 5.1.01)";
      } else if (activePage === 4) {
        targetAnggaran = processedData.stats.perdin.anggaran;
        targetRealisasi = processedData.stats.perdin.realisasi;
        contextTitle = "MATRIKS KHUSUS: PERJALANAN DINAS (KODE 5.1.02.04)";
      } else if (activePage === 5) {
        targetAnggaran = processedData.stats.barang.anggaran;
        targetRealisasi = processedData.stats.barang.realisasi;
        contextTitle = "MATRIKS KHUSUS: BELANJA BARANG (KODE 5.1.02.01)";
      }
    }

    const persen = targetAnggaran > 0 ? (targetRealisasi / targetAnggaran) * 100 : 0;

    return (
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-black border-2 border-amber-500/20 p-5 rounded-2xl space-y-3.5 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center font-mono text-[10px] gap-2 tracking-wider">
          <div className="flex items-center gap-2 font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
            <Cpu size={13} className="animate-pulse text-amber-400" /> 
            {contextTitle}
          </div>
          <div className="text-slate-400 text-[11px]">
            PAGU SEKTORAL: <span className="text-white font-bold">{formatRupiah(targetAnggaran)}</span> | 
            REALISASI: <span className="text-yellow-400 font-black drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] pl-1">{formatRupiah(targetRealisasi)}</span>
          </div>
        </div>
        <div className="relative h-7 bg-slate-950 rounded-xl border-2 border-slate-800 p-0.5 overflow-hidden flex items-center shadow-[inset_0_0_15px_rgba(0,0,0,0.9)]">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.8)] transition-all duration-1000 flex items-center justify-end pr-3 font-mono text-[10px] text-slate-950 font-black tracking-widest"
            style={{ width: `${Math.min(persen, 100)}%` }}
          >
            {persen > 8 && `${persen.toFixed(2)}% CAPAIAN`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-slate-100 p-1">
      
      {/* 1. FILTER CONTROLLER */}
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

      {/* 2. LAYER DONUT CHARTS (Diperlebar & Ditambah Proporsi Pagu) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <RenderPieChart title="Total Rekap" anggaran={processedData.stats.rekap.anggaran} realisasi={processedData.stats.rekap.realisasi} colorNeon="stroke-cyan-400" glowClass="bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Operasi" anggaran={processedData.stats.operasi.anggaran} realisasi={processedData.stats.operasi.realisasi} colorNeon="stroke-indigo-400" glowClass="bg-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Pegawai" anggaran={processedData.stats.pegawai.anggaran} realisasi={processedData.stats.pegawai.realisasi} colorNeon="stroke-teal-400" glowClass="bg-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Barang" anggaran={processedData.stats.barang.anggaran} realisasi={processedData.stats.barang.realisasi} colorNeon="stroke-fuchsia-400" glowClass="bg-fuchsia-400 shadow-[0_0_15px_rgba(232,121,249,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Perjalanan Dinas" anggaran={processedData.stats.perdin.anggaran} realisasi={processedData.stats.perdin.realisasi} colorNeon="stroke-yellow-400" glowClass="bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Modal" anggaran={processedData.stats.modal.anggaran} realisasi={processedData.stats.modal.realisasi} colorNeon="stroke-amber-400" glowClass="bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Tak Terduga" anggaran={processedData.stats.takTerduga.anggaran} realisasi={processedData.stats.takTerduga.realisasi} colorNeon="stroke-red-500" glowClass="bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Transfer" anggaran={processedData.stats.transfer.anggaran} realisasi={processedData.stats.transfer.realisasi} colorNeon="stroke-emerald-400" glowClass="bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
      </div>

      {/* 3. CONDITIONAL TABS LAYER */}
      {selectedSkpd === 'REKAP' ? (
        <div className="flex gap-2 bg-slate-900/90 p-2 border border-amber-500/30 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.6)]">
          {[
            { id: 1, label: 'PAGE 1: GRAFIK BATANG PER SKPD', icon: BarChart2, color: 'from-amber-500 to-yellow-400' },
            { id: 2, label: 'PAGE 2: REKAP KONSOLIDASI AKUN TOTAL', icon: Layers, color: 'from-cyan-400 to-blue-500' }
          ].map((page) => {
            const Icon = page.icon;
            const isSelected = activePage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-mono text-[10px] font-black tracking-widest transition-all duration-200 border-2 cursor-pointer ${
                  isSelected
                    ? `bg-gradient-to-r ${page.color} border-white text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.6)] scale-[1.01]`
                    : 'border-slate-700 text-slate-400 hover:text-white bg-slate-950/40 hover:bg-slate-900'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-slate-950 stroke-[3]' : 'text-slate-400'} />
                <span>{page.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 bg-slate-900/90 p-2 border border-slate-700 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.6)]">
          {[
            { id: 1, label: 'REKAP AKUN', icon: Layers },
            { id: 2, label: 'SUBKEGIATAN', icon: BarChart2 },
            { id: 3, label: 'BL. PEGAWAI', icon: Users },
            { id: 5, label: 'BL. BARANG', icon: ShoppingBag },
            { id: 4, label: 'PERJALANAN DINAS', icon: MapIcon }
          ].map((page) => {
            const Icon = page.icon;
            const isSelected = activePage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
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
      )}

      {/* 4. MAIN CONTAINER DISPLAY */}
      <div className="space-y-4">
        <RenderHorizontalHeaderBar />

        <div className="bg-slate-950/95 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-4">
          {loading ? (
            <div className="p-16 text-center text-xs font-mono text-cyan-400 font-bold tracking-[0.3em] flex flex-col items-center justify-center gap-3">
              <Cpu className="animate-spin text-cyan-400" size={22} />
              <span>SYNCHRONIZING REKAPITULASI MASTER SCHEMATIC...</span>
            </div>
          ) : (
            <div>
              {/* ==================== A. MODE FILTER = REKAP ==================== */}
              {selectedSkpd === 'REKAP' && (
                <div>
                  {activePage === 1 && (
                    <div className="space-y-6 p-2 font-mono">
                      <div className="text-[14px] font-bold text-sky-400 tracking-wider mb-2 flex items-center gap-2">
                        <TrendingUp size={17} className="text-amber-400" />
                        Matrik Realisasi Belanja SKPD
                      </div>
                      
                      <div className="space-y-6">
                        {page5SkpdMatrix.map((skpd, idx) => {
                          const maxPagu = Math.max(...page5SkpdMatrix.map(o => o.totalAng), 1);
                          const pctAnggaran = (skpd.totalAng / maxPagu) * 100;
                          
                          return (
                            <div key={idx} className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-2">
                              <div className="flex justify-between items-end text-[10px] text-slate-300 font-bold">
                                <span className="text-cyan-300 font-black tracking-wide max-w-xs md:max-w-xl text-justify leading-normal block">
                                  {skpd.kode} - {skpd.nama.toUpperCase()}
                                </span>
                                <span className="text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
                                  CAPAIAN: <span className="text-emerald-400 font-black">{hitungPersen(skpd.totalAng, skpd.totalReal)}</span>
                                </span>
                              </div>
                              
                              <div className="flex justify-between font-mono text-[9px] px-0.5">
                                <div className="text-slate-400">PAGU: <span className="text-cyan-400 font-bold">{formatRupiah(skpd.totalAng)}</span></div>
                                <div className="text-slate-300">REALISASI: <span className="text-yellow-400 font-black">{formatRupiah(skpd.totalReal)}</span></div>
                              </div>

                              <div className="w-full bg-slate-950 h-5 rounded-lg overflow-hidden border border-slate-800 p-0.5 relative shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
                                <div 
                                  className="h-full bg-gradient-to-r from-cyan-950 to-cyan-800 border border-cyan-500/30 rounded transition-all duration-700 relative flex items-center"
                                  style={{ width: `${Math.max(pctAnggaran, 1)}%` }}
                                >
                                  <div 
                                    className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 rounded shadow-[0_0_12px_rgba(234,179,8,0.5)] transition-all duration-700"
                                    style={{ width: `${skpd.totalAng > 0 ? (skpd.totalReal / skpd.totalAng) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activePage === 2 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                            <th className="p-4 border-r border-slate-900">Kode Rekening</th>
                            <th className="p-4 border-r border-slate-900">Struktur Nomenklatur Konsolidasi Total Daerah</th>
                            <th className="p-4 text-right border-r border-slate-900">Total Pagu</th>
                            <th className="p-4 text-right border-r border-slate-900">Total Realisasi</th>
                            <th className="p-4 text-right border-r border-slate-900">Sisa Anggaran</th>
                            <th className="p-4 text-center">Capaian</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/80">
                          {processedData.page1.map((row, index) => {
                            const level = row.kode.split('.').length;
                            const isParent = level <= 3;
                            return (
                              <tr key={index} className={`hover:bg-cyan-950/20 transition-colors group ${isParent ? 'bg-slate-950 font-black text-cyan-300' : 'text-slate-200'}`}>
                                <td className={`p-3.5 whitespace-nowrap border-r border-slate-900 font-bold ${isParent ? 'text-cyan-400' : 'text-slate-500'}`}>{row.kode}</td>
                                <td className="p-3.5 border-r border-slate-900 text-justify text-slate-100 whitespace-normal leading-relaxed block w-full" style={{ paddingLeft: `${level * 12}px` }}>
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
                    </div>
                  )}
                </div>
              )}

              {/* ==================== B. MODE FILTER = PER SKPD MANDIRI ==================== */}
              {selectedSkpd !== 'REKAP' && (
                <div className="overflow-x-auto">
                  
                  {/* TAB 1: REKAP AKUN */}
                  {activePage === 1 && (
                    <table className="w-full text-left font-mono text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                          <th className="p-4 border-r border-slate-900">Kode Rekening</th>
                          <th className="p-4 border-r border-slate-900">Struktur Nomenklatur Rekening</th>
                          <th className="p-4 text-right border-r border-slate-900">Pagu Anggaran</th>
                          <th className="p-4 text-right border-r border-slate-900">Realisasi Keuangan</th>
                          <th className="p-4 text-right border-r border-slate-900">Sisa Anggaran</th>
                          <th className="p-4 text-center">Capaian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/80">
                        {processedData.page1.map((row, index) => {
                          const level = row.kode.split('.').length;
                          const isParent = level <= 3;
                          return (
                            <tr key={index} className={`hover:bg-cyan-950/20 transition-colors group ${isParent ? 'bg-slate-950 font-black text-cyan-300' : 'text-slate-200'}`}>
                              <td className={`p-3.5 whitespace-nowrap border-r border-slate-900 font-bold ${isParent ? 'text-cyan-400' : 'text-slate-500'}`}>{row.kode}</td>
                              <td className="p-3.5 border-r border-slate-900 text-justify text-slate-100 whitespace-normal leading-relaxed block w-full" style={{ paddingLeft: `${level * 12}px` }}>
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

                  {/* TAB 2: TREEVIEW SUBKEGIATAN */}
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
                                <td className="p-3 border-r border-slate-900 flex items-center gap-2 text-justify text-slate-100 whitespace-normal leading-relaxed">
                                  {isExpanded ? <ChevronDown size={14} className="text-indigo-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-indigo-400 flex-shrink-0" />}
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
                                  <td className="p-2.5 pl-10 border-r border-slate-900 text-justify text-slate-400 whitespace-normal leading-relaxed">
                                    &bull; {child.nama}
                                  </td>
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

                  {/* TAB 3: BELANJA PEGAWAI */}
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
                            <td className="p-3.5 border-r border-slate-900 text-justify text-slate-100 whitespace-normal leading-relaxed">{row.nama}</td>
                            <td className="p-3.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(row.anggaran)}</td>
                            <td className="p-3.5 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(row.realisasi)}</td>
                            <td className="p-3.5 text-right border-r border-slate-900 text-amber-500">{formatRupiah(row.anggaran - row.realisasi)}</td>
                            <td className="p-3.5 text-center font-black text-cyan-400 bg-cyan-950/10">{hitungPersen(row.anggaran, row.realisasi)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* TAB 4: PERJALANAN DINAS */}
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
                                <td className="p-3 border-r border-slate-900 flex items-center gap-2 text-justify text-slate-200 whitespace-normal leading-relaxed">
                                  {isExpanded ? <ChevronDown size={14} className="text-amber-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-amber-400 flex-shrink-0" />}
                                  <span>{perdin.nama.toUpperCase()}</span>
                                </td>
                                <td className="p-3 text-right border-r border-slate-900 text-slate-400">{formatRupiah(perdin.anggaran)}</td>
                                <td className="p-3 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(perdin.realisasi)}</td>
                                <td className="p-3 text-right border-r border-slate-900 text-slate-500">{formatRupiah(perdin.anggaran - perdin.realisasi)}</td>
                                <td className="p-3 text-center font-black text-amber-400 bg-amber-950/10">{hitungPersen(perdin.anggaran, perdin.realisasi)}</td>
                              </tr>
                              {isExpanded && perdin.children && perdin.children.map((child, cIdx) => (
                                <tr key={cIdx} className="bg-slate-900/40 text-[10px] text-slate-300">
                                  <td className="p-2.5 pl-6 border-r border-slate-900 text-slate-500">{child.kode}</td>
                                  <td className="p-2.5 pl-10 border-r border-slate-900 text-justify text-amber-300/80 whitespace-normal leading-relaxed">
                                    &bull; {child.nama}
                                  </td>
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

                  {/* TAB 5: BELANJA BARANG */}
                  {activePage === 5 && (
                    <table className="w-full text-left font-mono text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                          <th className="p-4 border-r border-slate-900 w-48">Kode Unit</th>
                          <th className="p-4 border-r border-slate-900">Komponen Kerja Belanja Barang (Akun 5.1.02.01)</th>
                          <th className="p-4 text-right border-r border-slate-900">Anggaran</th>
                          <th className="p-4 text-right border-r border-slate-900">Realisasi</th>
                          <th className="p-4 text-right border-r border-slate-900">Sisa Pagu</th>
                          <th className="p-4 text-center">Persen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60">
                        {processedData.page5.map((barang, idx) => {
                          const isExpanded = !!expandedBarang[barang.kode];
                          return (
                            <React.Fragment key={idx}>
                              <tr 
                                onClick={() => toggleBarang(barang.kode)}
                                className="bg-slate-950 hover:bg-fuchsia-950/20 border-l-4 border-fuchsia-500 cursor-pointer text-fuchsia-300 font-bold transition-all"
                              >
                                <td className="p-3 border-r border-slate-900 text-slate-500">{barang.kode}</td>
                                <td className="p-3 border-r border-slate-900 flex items-center gap-2 text-justify text-slate-200 whitespace-normal leading-relaxed">
                                  {isExpanded ? <ChevronDown size={14} className="text-fuchsia-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-fuchsia-400 flex-shrink-0" />}
                                  <span>{barang.nama.toUpperCase()}</span>
                                </td>
                                <td className="p-3 text-right border-r border-slate-900 text-slate-400">{formatRupiah(barang.anggaran)}</td>
                                <td className="p-3 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(barang.realisasi)}</td>
                                <td className="p-3 text-right border-r border-slate-900 text-slate-500">{formatRupiah(barang.anggaran - barang.realisasi)}</td>
                                <td className="p-3 text-center font-black text-fuchsia-400 bg-fuchsia-950/10">{hitungPersen(barang.anggaran, barang.realisasi)}</td>
                              </tr>
                              {isExpanded && barang.children && barang.children.map((child, cIdx) => (
                                <tr key={cIdx} className="bg-slate-900/40 text-[10px] text-slate-300">
                                  <td className="p-2.5 pl-6 border-r border-slate-900 text-slate-500">{child.kode}</td>
                                  <td className="p-2.5 pl-10 border-r border-slate-900 text-justify text-fuchsia-300/80 whitespace-normal leading-relaxed">
                                    &bull; {child.nama}
                                  </td>
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
          )}
        </div>
      </div>
    </div>
  );
}