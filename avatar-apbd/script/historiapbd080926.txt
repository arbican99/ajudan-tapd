import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Layers, RefreshCw, Building2, FileText, 
  ChevronRight, ChevronDown, Search, CheckSquare, Square, FolderTree, Calendar, GitFork
} from 'lucide-react';

const COLUMN_CONFIG = [
  { id: 'apbd', label: 'APBD' },
  { id: 'gsr1', label: 'PERGESERAN 1' },
  { id: 'gsr2', label: 'PERGESERAN 2' },
  { id: 'gsr3', label: 'PERGESERAN 3' },
  { id: 'gsr4', label: 'PERGESERAN 4' },
  { id: 'gsr5', label: 'PERGESERAN 5' },
  { id: 'apbdp', label: 'APBDP' },
];

export default function DashboardHistApbd() {
  // --- STATE MANAGEMENT ---
  const [skpdList, setSkpdList] = useState([]);
  const [selectedSkpd, setSelectedSkpd] = useState('REKAP');
  
  // State Sub Unit (Khusus Dinas Kesehatan / SKPD bersangkutan)
  const [subUnitList, setSubUnitList] = useState([]);
  const [selectedSubUnit, setSelectedSubUnit] = useState('SEMUA');
  const [isDinkesSelected, setIsDinkesSelected] = useState(false);

  // State Filter Tahun Anggaran
  const [thnList, setThnList] = useState([]);
  const [selectedThn, setSelectedThn] = useState('SEMUA');

  // Dynamic Checkbox Column Selection
  const [selectedColumns, setSelectedColumns] = useState(['apbd', 'apbdp']);
  
  // Page Frame State
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rawHistData, setRawHistData] = useState([]);
  const [mrekMap, setMrekMap] = useState(new Map());
  
  // State Search per Tab
  const [searchTab1, setSearchTab1] = useState('');
  const [searchTab2, setSearchTab2] = useState('');

  // State Treeview Expansion
  const [expandedNodes, setExpandedNodes] = useState({});

  useEffect(() => {
    ambilDataFilter();
    fetchMrekData();
  }, []);

  // Efek ketika SKPD terpilih berubah
  useEffect(() => {
    const foundSkpd = skpdList.find(s => s.kdskpd === selectedSkpd);
    const isDinkes = foundSkpd && foundSkpd.nmskpd.toLowerCase().includes('kesehatan');
    
    setIsDinkesSelected(!!isDinkes);
    setSelectedSubUnit('SEMUA'); // Reset sub unit saat ganti SKPD

    if (isDinkes) {
      fetchSubUnits(selectedSkpd);
    } else {
      setSubUnitList([]);
    }
  }, [selectedSkpd, skpdList]);

  // Trigger ulang fetch data utama saat filter berubah
  useEffect(() => {
    fetchMainData();
  }, [selectedSkpd, selectedSubUnit, selectedThn]);

  useEffect(() => {
    setActiveTab(1);
    setSearchTab1('');
    setSearchTab2('');
  }, [selectedSkpd, selectedSubUnit, selectedThn]);

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleCheckboxToggle = (colId) => {
    setSelectedColumns(prev => {
      if (prev.includes(colId)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== colId);
      } else {
        return [...prev, colId];
      }
    });
  };

  // --- 0. AMBIL REFERENSI MREK ---
  const fetchMrekData = async () => {
    try {
      let semuaMrek = [];
      let page = 0;
      const limit = 1000;
      let masiAda = true;

      while (masiAda) {
        const from = page * limit;
        const to = from + limit - 1;

        const { data, error } = await supabase
          .from('mrek')
          .select('kdrek, nmrek, level')
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          semuaMrek = [...semuaMrek, ...data];
          if (data.length < limit) masiAda = false;
          else page++;
        } else {
          masiAda = false;
        }
      }

      const map = new Map();
      semuaMrek.forEach(item => {
        if (item.kdrek) {
          map.set(String(item.kdrek).trim(), {
            nmrek: item.nmrek ? String(item.nmrek).trim() : '',
            level: item.level !== null && item.level !== undefined ? Number(item.level) : null
          });
        }
      });
      setMrekMap(map);
    } catch (err) {
      console.error("Gagal memuat referensi mrek:", err.message);
    }
  };

  // --- 1. AMBIL FILTER SKPD DAN TAHUN (DENGAN PAGINATION FULL LOOP 4871+ DATA) ---
  const ambilDataFilter = async () => {
    try {
      let semuaRawFilter = [];
      let page = 0;
      const limit = 1000;
      let masiAda = true;

      // Menyapu SELURUH record di tabel histapbd tanpa terpengaruh batas 1000 row Supabase
      while (masiAda) {
        const from = page * limit;
        const to = from + limit - 1;

        const { data, error } = await supabase
          .from('histapbd')
          .select('kdskpd, nmskpd, tahun')
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          semuaRawFilter = [...semuaRawFilter, ...data];
          if (data.length < limit) masiAda = false;
          else page++;
        } else {
          masiAda = false;
        }
      }

      // Olah SKPD Unik (34 SKPD)
      const mapSkpd = new Map();
      const uniqueSkpd = [];
      const mapThn = new Set();

      semuaRawFilter.forEach(item => {
        // Ambil SKPD
        const kodeClean = item.kdskpd ? String(item.kdskpd).trim() : '';
        if (kodeClean && !mapSkpd.has(kodeClean)) {
          mapSkpd.set(kodeClean, true);
          uniqueSkpd.push({
            kdskpd: kodeClean,
            nmskpd: item.nmskpd ? String(item.nmskpd).trim() : 'SKPD Tanpa Nama'
          });
        }

        // Ambil Tahun
        if (item.tahun !== null && item.tahun !== undefined) {
          mapThn.add(String(item.tahun).trim());
        }
      });

      // Urutkan SKPD berdasarkan kode
      uniqueSkpd.sort((a, b) => a.kdskpd.localeCompare(b.kdskpd, undefined, { numeric: true, sensitivity: 'base' }));
      setSkpdList(uniqueSkpd);

      // Urutkan Tahun Descending
      const sortedThn = Array.from(mapThn).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      setThnList(sortedThn);
      if (sortedThn.length > 0) {
        setSelectedThn(sortedThn[0]);
      }

    } catch (err) {
      console.error("Gagal mengambil data filter SKPD & Tahun:", err.message);
    }
  };

  // --- 2. AMBIL FILTER SUB UNIT (KHUSUS DINAS KESEHATAN) ---
  const fetchSubUnits = async (kdskpd) => {
    try {
      let semuaSubUnit = [];
      let page = 0;
      const limit = 1000;
      let masiAda = true;

      while (masiAda) {
        const from = page * limit;
        const to = from + limit - 1;

        const { data, error } = await supabase
          .from('histapbd')
          .select('kdsubunit, nmsubunit')
          .eq('kdskpd', kdskpd)
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          semuaSubUnit = [...semuaSubUnit, ...data];
          if (data.length < limit) masiAda = false;
          else page++;
        } else {
          masiAda = false;
        }
      }

      const mapSub = new Map();
      const uniqueSub = [];

      semuaSubUnit.forEach(item => {
        const kodeClean = item.kdsubunit ? String(item.kdsubunit).trim() : '';
        if (kodeClean && !mapSub.has(kodeClean)) {
          mapSub.set(kodeClean, true);
          uniqueSub.push({
            kdsubunit: kodeClean,
            nmsubunit: item.nmsubunit ? String(item.nmsubunit).trim() : 'Sub Unit Tanpa Nama'
          });
        }
      });

      uniqueSub.sort((a, b) => a.kdsubunit.localeCompare(b.kdsubunit, undefined, { numeric: true, sensitivity: 'base' }));
      setSubUnitList(uniqueSub);
    } catch (err) {
      console.error("Gagal mengambil sub unit:", err.message);
    }
  };

  // --- 3. FETCH DATA UTAMA DARI HISTAPBD ---
  const fetchMainData = async () => {
    setLoading(true);
    try {
      let semuaData = [];
      let page = 0;
      const limit = 1000;
      let masiAda = true;

      while (masiAda) {
        const from = page * limit;
        const to = from + limit - 1;

        let query = supabase.from('histapbd').select('*');

        if (selectedSkpd !== 'REKAP') {
          query = query.eq('kdskpd', selectedSkpd);
        }

        if (isDinkesSelected && selectedSubUnit !== 'SEMUA') {
          query = query.eq('kdsubunit', selectedSubUnit);
        }

        if (selectedThn !== 'SEMUA') {
          query = query.eq('tahun', selectedThn);
        }

        const { data, error } = await query.range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          semuaData = [...semuaData, ...data];
          if (data.length < limit) masiAda = false;
          else page++;
        } else {
          masiAda = false;
        }
      }

      setRawHistData(semuaData);
    } catch (err) {
      console.error("Gagal memuat data histapbd:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseAngka = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatRupiah = (val) => {
    const num = parseAngka(val);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  // --- OLAH DATA UNTUK REKAP & TREEVIEW ---
  const processedData = useMemo(() => {
    const rekeningMap = new Map();
    const skpdTree = {};
    const subgiatTree = {};

    rawHistData.forEach(item => {
      const kdrek = item.kdrek ? String(item.kdrek).trim() : '';
      if (!kdrek) return;

      const values = {
        apbd: parseAngka(item.apbd),
        gsr1: parseAngka(item.gsr1),
        gsr2: parseAngka(item.gsr2),
        gsr3: parseAngka(item.gsr3),
        gsr4: parseAngka(item.gsr4),
        gsr5: parseAngka(item.gsr5),
        apbdp: parseAngka(item.apbdp),
      };

      const mrekInfo = mrekMap.get(kdrek);
      const nmrek = (mrekInfo && mrekInfo.nmrek) ? mrekInfo.nmrek : (item.nmrek || 'Tanpa Nama Rekening');

      const kdskpd = item.kdskpd ? String(item.kdskpd).trim() : 'LAINNYA';
      const nmskpd = item.nmskpd || 'SKPD Tidak Teridentifikasi';

      const kdsubunit = item.kdsubunit ? String(item.kdsubunit).trim() : '';
      const nmsubunit = item.nmsubunit || 'Sub Unit Utama';

      const kdsubgiat = item.kdsubgiat ? String(item.kdsubgiat).trim() : 'TANPA_SUBGIAT';
      const nmsubgiat = item.nmsubgiat || 'Sub Kegiatan Umum';

      // 1. Rekap Rekening Hirarkis
      const parts = kdrek.split('.');
      let pathKode = '';

      parts.forEach((part, index) => {
        pathKode = index === 0 ? part : `${pathKode}.${part}`;

        if (!rekeningMap.has(pathKode)) {
          const pathMrekInfo = mrekMap.get(pathKode);
          rekeningMap.set(pathKode, {
            kdrek: pathKode,
            nmrek: pathMrekInfo ? pathMrekInfo.nmrek : (index === parts.length - 1 ? nmrek : `Rekening ${pathKode}`),
            level: index,
            apbd: 0, gsr1: 0, gsr2: 0, gsr3: 0, gsr4: 0, gsr5: 0, apbdp: 0
          });
        }

        const rekEntry = rekeningMap.get(pathKode);
        COLUMN_CONFIG.forEach(col => {
          rekEntry[col.id] += values[col.id];
        });

        if (index === parts.length - 1) {
          rekEntry.nmrek = nmrek;
        }
      });

      // 2. Treeview SKPD
      if (!skpdTree[kdskpd]) {
        skpdTree[kdskpd] = {
          kdskpd, nmskpd,
          apbd: 0, gsr1: 0, gsr2: 0, gsr3: 0, gsr4: 0, gsr5: 0, apbdp: 0,
          subUnits: {},
          rekening: {}
        };
      }
      COLUMN_CONFIG.forEach(col => { skpdTree[kdskpd][col.id] += values[col.id]; });

      const isDinasKesehatan = nmskpd.toLowerCase().includes('kesehatan');

      if (isDinasKesehatan) {
        const subKey = kdsubunit || `${kdskpd}-UTAMA`;
        if (!skpdTree[kdskpd].subUnits[subKey]) {
          skpdTree[kdskpd].subUnits[subKey] = {
            kdsubunit: subKey, nmsubunit,
            apbd: 0, gsr1: 0, gsr2: 0, gsr3: 0, gsr4: 0, gsr5: 0, apbdp: 0,
            rekening: {}
          };
        }
        COLUMN_CONFIG.forEach(col => { skpdTree[kdskpd].subUnits[subKey][col.id] += values[col.id]; });

        if (!skpdTree[kdskpd].subUnits[subKey].rekening[kdrek]) {
          skpdTree[kdskpd].subUnits[subKey].rekening[kdrek] = {
            kdrek, nmrek,
            apbd: 0, gsr1: 0, gsr2: 0, gsr3: 0, gsr4: 0, gsr5: 0, apbdp: 0
          };
        }
        COLUMN_CONFIG.forEach(col => { skpdTree[kdskpd].subUnits[subKey].rekening[kdrek][col.id] += values[col.id]; });
      } else {
        if (!skpdTree[kdskpd].rekening[kdrek]) {
          skpdTree[kdskpd].rekening[kdrek] = {
            kdrek, nmrek,
            apbd: 0, gsr1: 0, gsr2: 0, gsr3: 0, gsr4: 0, gsr5: 0, apbdp: 0
          };
        }
        COLUMN_CONFIG.forEach(col => { skpdTree[kdskpd].rekening[kdrek][col.id] += values[col.id]; });
      }

      // 3. Treeview Sub Kegiatan
      if (!subgiatTree[kdsubgiat]) {
        subgiatTree[kdsubgiat] = {
          kdsubgiat, nmsubgiat,
          apbd: 0, gsr1: 0, gsr2: 0, gsr3: 0, gsr4: 0, gsr5: 0, apbdp: 0,
          rekening: {}
        };
      }
      COLUMN_CONFIG.forEach(col => { subgiatTree[kdsubgiat][col.id] += values[col.id]; });

      if (!subgiatTree[kdsubgiat].rekening[kdrek]) {
        subgiatTree[kdsubgiat].rekening[kdrek] = {
          kdrek, nmrek,
          apbd: 0, gsr1: 0, gsr2: 0, gsr3: 0, gsr4: 0, gsr5: 0, apbdp: 0
        };
      }
      COLUMN_CONFIG.forEach(col => { subgiatTree[kdsubgiat].rekening[kdrek][col.id] += values[col.id]; });
    });

    const flatRekeningList = Array.from(rekeningMap.values()).sort((a, b) => 
      a.kdrek.localeCompare(b.kdrek, undefined, { numeric: true, sensitivity: 'base' })
    );

    const sortedSkpdTreeList = Object.values(skpdTree).sort((a, b) => 
      a.kdskpd.localeCompare(b.kdskpd, undefined, { numeric: true, sensitivity: 'base' })
    );

    const sortedSubgiatTreeList = Object.values(subgiatTree).sort((a, b) => 
      a.kdsubgiat.localeCompare(b.kdsubgiat, undefined, { numeric: true, sensitivity: 'base' })
    );

    return { flatRekeningList, sortedSkpdTreeList, sortedSubgiatTreeList };
  }, [rawHistData, mrekMap]);

  // --- SEARCH FILTERED RESULTS ---
  const filteredTab1Data = useMemo(() => {
    if (!searchTab1.trim()) return processedData.flatRekeningList;
    const kw = searchTab1.toLowerCase().trim();
    return processedData.flatRekeningList.filter(row => 
      row.kdrek.toLowerCase().includes(kw) || row.nmrek.toLowerCase().includes(kw)
    );
  }, [processedData.flatRekeningList, searchTab1]);

  const currentSkpdName = useMemo(() => {
    if (selectedSkpd === 'REKAP') return 'REKAPITULASI SELURUH SKPD';
    const found = skpdList.find(s => s.kdskpd === selectedSkpd);
    return found ? `${found.kdskpd} - ${found.nmskpd}` : selectedSkpd;
  }, [selectedSkpd, skpdList]);

  // --- RENDER DYNAMIC COLUMNS & TREND INDICATOR ---
  const renderValueCells = (row) => {
    return selectedColumns.map((colId, index) => {
      const val = row[colId] || 0;
      let trendElement = null;

      if (index > 0) {
        const prevColId = selectedColumns[index - 1];
        const prevVal = row[prevColId] || 0;
        const diff = val - prevVal;

        if (diff > 0) {
          trendElement = <span className="ml-1 text-[10px] text-emerald-400 font-extrabold" title={`Naik ${formatRupiah(diff)}`}>▲</span>;
        } else if (diff < 0) {
          trendElement = <span className="ml-1 text-[10px] text-rose-400 font-extrabold" title={`Turun ${formatRupiah(Math.abs(diff))}`}>▼</span>;
        } else {
          trendElement = <span className="ml-1 text-[10px] text-slate-500 font-bold">-</span>;
        }
      }

      return (
        <td key={colId} className="p-2.5 text-right font-mono border-r border-slate-800 whitespace-nowrap">
          <span>{formatRupiah(val)}</span>
          {trendElement}
        </td>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 font-mono p-4 md:p-6 select-none">
      
      {/* HEADER */}
      <header className="mb-5 border-b border-amber-500/30 pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-7 h-7 text-amber-400 animate-pulse" />
            <h1 className="text-lg md:text-xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 uppercase">
              DASHBOARD RIWAYAT PER STATUS APBD
            </h1>
          </div>
          <p className="text-xs text-amber-300/80 mt-1 flex items-center gap-1.5 flex-wrap">
            <Building2 className="w-3.5 h-3.5 text-amber-400" /> SKPD: <span className="text-white font-bold">{currentSkpdName}</span>
            <span className="text-slate-600">|</span>
            <Calendar className="w-3.5 h-3.5 text-amber-400" /> Tahun: <span className="text-white font-bold">{selectedThn}</span>
          </p>
        </div>

        <button
          onClick={fetchMainData}
          disabled={loading}
          className="self-start md:self-auto px-3 py-2 bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 rounded-lg text-amber-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs shadow-[0_0_10px_rgba(245,158,11,0.2)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${loading ? 'animate-spin' : ''}`} />
          <span className="font-bold">Sync Data</span>
        </button>
      </header>

      {/* FILTER PANEL */}
      <div className="mb-6 bg-[#0a0f1d] border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
        
        {/* DROPDOWNS: TAHUN, SKPD & SUB UNIT */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* TAHUN ANGGARAN DROP-DOWN */}
          <div className="md:col-span-3 space-y-1">
            <label className="text-[10px] md:text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> TAHUN ANGGARAN
            </label>
            <select
              value={selectedThn}
              onChange={(e) => setSelectedThn(e.target.value)}
              className="w-full bg-[#030712] text-amber-100 border border-slate-700 rounded-lg px-3 py-2 text-xs md:text-sm font-bold focus:outline-none focus:border-amber-400 cursor-pointer appearance-none truncate shadow-inner"
            >
              <option value="SEMUA">» SEMUA TAHUN</option>
              {thnList.map((thn) => (
                <option key={thn} value={thn}>
                  » TAHUN {thn}
                </option>
              ))}
            </select>
          </div>

          {/* PILIH SKPD DROP-DOWN */}
          <div className={isDinkesSelected ? "md:col-span-5 space-y-1" : "md:col-span-9 space-y-1"}>
            <label className="text-[10px] md:text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-amber-400" /> PILIH SKPD 
            </label>
            <select
              value={selectedSkpd}
              onChange={(e) => setSelectedSkpd(e.target.value)}
              className="w-full bg-[#030712] text-amber-100 border border-slate-700 rounded-lg px-4 py-2 text-xs md:text-sm font-bold focus:outline-none focus:border-amber-400 cursor-pointer appearance-none truncate shadow-inner"
            >
              <option value="REKAP">» REKAPITULASI SELURUH SKPD</option>
              {skpdList.map((skpd) => (
                <option key={skpd.kdskpd} value={skpd.kdskpd}>
                  » {skpd.kdskpd} - {skpd.nmskpd}
                </option>
              ))}
            </select>
          </div>

          {/* SUB UNIT DROP-DOWN (TAMPIL KHUSUS DINAS KESEHATAN) */}
          {isDinkesSelected && (
            <div className="md:col-span-4 space-y-1 animate-fadeIn">
              <label className="text-[10px] md:text-xs text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <GitFork className="w-3.5 h-3.5 text-cyan-400" /> PILIH SUB UNIT
              </label>
              <select
                value={selectedSubUnit}
                onChange={(e) => setSelectedSubUnit(e.target.value)}
                className="w-full bg-[#030712] text-cyan-100 border border-cyan-500/50 rounded-lg px-3 py-2 text-xs md:text-sm font-bold focus:outline-none focus:border-cyan-400 cursor-pointer appearance-none truncate shadow-inner"
              >
                <option value="SEMUA">» REKAP SELURUH SUB UNIT</option>
                {subUnitList.map((sub) => (
                  <option key={sub.kdsubunit} value={sub.kdsubunit}>
                    » {sub.kdsubunit} - {sub.nmsubunit}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>

        {/* FIELD SELECTION CHECKBOXES */}
        <div className="border-t border-slate-800/80 pt-3">
          <label className="text-[10px] md:text-xs text-amber-400 font-bold uppercase tracking-wider block mb-2">
            PILIH KOLOM YANG DITAMPILKAN SESUAI URUTAN
          </label>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {COLUMN_CONFIG.map((col) => {
              const selectedIndex = selectedColumns.indexOf(col.id);
              const isChecked = selectedIndex !== -1;

              return (
                <button
                  key={col.id}
                  onClick={() => handleCheckboxToggle(col.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                      : 'bg-[#030712] text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {isChecked ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                  <span>{col.label}</span>
                  {isChecked && (
                    <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[10px] rounded-full font-black">
                      {selectedIndex + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* MAIN CONTAINER */}
      {loading ? (
        <div className="h-80 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-amber-300 text-xs font-bold animate-pulse">Memuat Data Histapbd...</p>
        </div>
      ) : (
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
          
          {/* TAB FRAME HEADER & SEARCH BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            
            {/* BUTTON PAGE FRAMES */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab(1)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  activeTab === 1 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                    : 'bg-[#030712] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>REKAP REKENING</span>
              </button>

              <button
                onClick={() => setActiveTab(2)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  activeTab === 2 
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                    : 'bg-[#030712] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {selectedSkpd === 'REKAP' ? <Building2 className="w-4 h-4" /> : <FolderTree className="w-4 h-4" />}
                <span>{selectedSkpd === 'REKAP' ? 'REKAP SKPD' : 'SUB KEGIATAN'}</span>
              </button>
            </div>

            {/* PAGE SEARCH INPUT */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {activeTab === 1 ? (
                <input
                  type="text"
                  placeholder="Cari Rekening (Kode/Nama)..."
                  value={searchTab1}
                  onChange={(e) => setSearchTab1(e.target.value)}
                  className="w-full bg-[#030712] text-amber-100 text-xs rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-500"
                />
              ) : (
                <input
                  type="text"
                  placeholder={selectedSkpd === 'REKAP' ? "Cari SKPD..." : "Cari Sub Kegiatan..."}
                  value={searchTab2}
                  onChange={(e) => setSearchTab2(e.target.value)}
                  className="w-full bg-[#030712] text-amber-100 text-xs rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:outline-none focus:border-cyan-400 transition-all placeholder:text-slate-500"
                />
              )}
            </div>

          </div>

          {/* TABLE AREA */}
          <div className="overflow-x-auto rounded-lg border border-slate-800 shadow-md">
            <table className="w-full text-left text-xs text-slate-200 border-collapse">
              <thead>
                <tr className="bg-[#030712] border-b border-slate-800 text-slate-300 uppercase text-xs tracking-wider">
                  <th className="p-3 font-extrabold border-r border-slate-800 w-48 text-center">
                    {activeTab === 1 ? 'KODE REKENING' : (selectedSkpd === 'REKAP' ? 'KODE SKPD / SUB UNIT' : 'KODE SUB KEGIATAN / REK')}
                  </th>
                  <th className="p-3 font-extrabold border-r border-slate-800 text-center">
                    {activeTab === 1 ? 'URAIAN REKENING' : (selectedSkpd === 'REKAP' ? 'NAMA SKPD / SUB UNIT / REKENING' : 'NAMA SUB KEGIATAN / REKENING')}
                  </th>
                  {selectedColumns.map(colId => {
                    const col = COLUMN_CONFIG.find(c => c.id === colId);
                    return (
                      <th key={colId} className="p-3 font-extrabold border-r border-slate-800 w-44 text-center">
                        {col ? col.label : colId}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#070b16]">
                
                {/* --- PAGE FRAME 1: REKAP REKENING FLAT --- */}
                {activeTab === 1 && (
                  filteredTab1Data.length === 0 ? (
                    <tr>
                      <td colSpan={2 + selectedColumns.length} className="p-4 text-center text-slate-400 italic">
                        Data rekening tidak ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredTab1Data.map((row) => {
                      const isLevel0 = row.level === 0;
                      const isLevel1 = row.level === 1;

                      return (
                        <tr 
                          key={row.kdrek} 
                          className={`border-b border-slate-800/60 transition-colors ${
                            isLevel0 
                              ? 'bg-amber-500/20 font-black text-amber-200 uppercase text-sm' 
                              : isLevel1 
                              ? 'bg-amber-500/10 font-bold text-amber-300 text-xs' 
                              : 'hover:bg-slate-800/40 text-xs text-slate-200'
                          }`}
                        >
                          <td className="p-2.5 font-mono border-r border-slate-800 whitespace-nowrap">
                            <span className={isLevel0 || isLevel1 ? 'font-black text-amber-400' : 'text-cyan-300 font-semibold'}>
                              {row.kdrek}
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-slate-800 text-left">
                            <span className={isLevel0 || isLevel1 ? 'font-black uppercase tracking-wide' : 'font-medium'}>
                              {row.nmrek}
                            </span>
                          </td>
                          {renderValueCells(row)}
                        </tr>
                      );
                    })
                  )
                )}

                {/* --- PAGE FRAME 2 (OPTION A): REKAP SKPD TREEVIEW (MODE REKAP) --- */}
                {activeTab === 2 && selectedSkpd === 'REKAP' && (
                  processedData.sortedSkpdTreeList.length === 0 ? (
                    <tr>
                      <td colSpan={2 + selectedColumns.length} className="p-4 text-center text-slate-400 italic">Tidak ada data SKPD.</td>
                    </tr>
                  ) : (
                    processedData.sortedSkpdTreeList
                      .filter(s => s.kdskpd.toLowerCase().includes(searchTab2.toLowerCase()) || s.nmskpd.toLowerCase().includes(searchTab2.toLowerCase()))
                      .map((skpd) => {
                        const isExpanded = !!expandedNodes[skpd.kdskpd];
                        const isDinasKesehatan = skpd.nmskpd.toLowerCase().includes('kesehatan');

                        const sortedSubUnits = Object.values(skpd.subUnits || {}).sort((a, b) => 
                          a.kdsubunit.localeCompare(b.kdsubunit, undefined, { numeric: true, sensitivity: 'base' })
                        );

                        const sortedRekeningSkpd = Object.values(skpd.rekening || {}).sort((a, b) => 
                          a.kdrek.localeCompare(b.kdrek, undefined, { numeric: true, sensitivity: 'base' })
                        );

                        return (
                          <React.Fragment key={skpd.kdskpd}>
                            {/* LEVEL SKPD */}
                            <tr className="bg-slate-900/90 font-bold border-b border-slate-800 hover:bg-slate-800/60 transition-colors">
                              <td className="p-2.5 border-r border-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => toggleNode(skpd.kdskpd)}
                                    className="p-0.5 hover:bg-slate-700 rounded text-cyan-400 focus:outline-none cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                  <span className="text-cyan-300 font-mono font-bold">{skpd.kdskpd}</span>
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-800 font-bold text-slate-100 text-left">
                                {skpd.nmskpd}
                              </td>
                              {renderValueCells(skpd)}
                            </tr>

                            {/* SUB UNIT DINAS KESEHATAN */}
                            {isExpanded && isDinasKesehatan && sortedSubUnits.map((sub) => {
                              const subNodeId = `${skpd.kdskpd}-${sub.kdsubunit}`;
                              const isSubExpanded = !!expandedNodes[subNodeId];
                              const sortedRekeningSub = Object.values(sub.rekening || {}).sort((a, b) => 
                                a.kdrek.localeCompare(b.kdrek, undefined, { numeric: true, sensitivity: 'base' })
                              );

                              return (
                                <React.Fragment key={subNodeId}>
                                  <tr className="bg-slate-800/50 font-bold border-b border-slate-800/80 hover:bg-slate-800/80 transition-colors">
                                    <td className="p-2 pl-6 border-r border-slate-800 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={() => toggleNode(subNodeId)}
                                          className="p-0.5 hover:bg-slate-700 rounded text-amber-400 focus:outline-none cursor-pointer"
                                        >
                                          {isSubExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        </button>
                                        <span className="text-amber-300 font-mono text-xs">{sub.kdsubunit}</span>
                                      </div>
                                    </td>
                                    <td className="p-2 border-r border-slate-800 text-amber-200 text-xs font-semibold text-left">
                                      ↳ {sub.nmsubunit}
                                    </td>
                                    {renderValueCells(sub)}
                                  </tr>

                                  {/* REKENING SUB UNIT */}
                                  {isSubExpanded && sortedRekeningSub.map((rek) => (
                                    <tr key={rek.kdrek} className="border-b border-slate-800/40 hover:bg-slate-800/30 text-[11px]">
                                      <td className="p-2 pl-12 border-r border-slate-800 text-cyan-300/90 font-mono whitespace-nowrap">
                                        {rek.kdrek}
                                      </td>
                                      <td className="p-2 border-r border-slate-800 text-slate-300 text-left">
                                        {rek.nmrek}
                                      </td>
                                      {renderValueCells(rek)}
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            })}

                            {/* REKENING SKPD NON-DINAS KESEHATAN */}
                            {isExpanded && !isDinasKesehatan && sortedRekeningSkpd.map((rek) => (
                              <tr key={rek.kdrek} className="border-b border-slate-800/40 hover:bg-slate-800/30 text-[11px]">
                                <td className="p-2 pl-8 border-r border-slate-800 text-amber-300/90 font-mono whitespace-nowrap">
                                  {rek.kdrek}
                                </td>
                                <td className="p-2 border-r border-slate-800 text-slate-300 text-left">
                                  {rek.nmrek}
                                </td>
                                {renderValueCells(rek)}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                  )
                )}

                {/* --- PAGE FRAME 2 (OPTION B): SUB KEGIATAN TREEVIEW (MODE SINGLE SKPD) --- */}
                {activeTab === 2 && selectedSkpd !== 'REKAP' && (
                  processedData.sortedSubgiatTreeList.length === 0 ? (
                    <tr>
                      <td colSpan={2 + selectedColumns.length} className="p-4 text-center text-slate-400 italic">Tidak ada data Sub Kegiatan.</td>
                    </tr>
                  ) : (
                    processedData.sortedSubgiatTreeList
                      .filter(sg => sg.kdsubgiat.toLowerCase().includes(searchTab2.toLowerCase()) || sg.nmsubgiat.toLowerCase().includes(searchTab2.toLowerCase()))
                      .map((subgiat) => {
                        const isExpanded = !!expandedNodes[subgiat.kdsubgiat];
                        const sortedRekening = Object.values(subgiat.rekening || {}).sort((a, b) => 
                          a.kdrek.localeCompare(b.kdrek, undefined, { numeric: true, sensitivity: 'base' })
                        );

                        return (
                          <React.Fragment key={subgiat.kdsubgiat}>
                            {/* LEVEL SUB KEGIATAN */}
                            <tr className="bg-slate-900/90 font-bold border-b border-slate-800 hover:bg-slate-800/60 transition-colors">
                              <td className="p-2.5 border-r border-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => toggleNode(subgiat.kdsubgiat)}
                                    className="p-0.5 hover:bg-slate-700 rounded text-cyan-400 focus:outline-none cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                  <span className="text-cyan-300 font-mono font-bold">{subgiat.kdsubgiat}</span>
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-800 font-bold text-slate-100 text-left">
                                {subgiat.nmsubgiat}
                              </td>
                              {renderValueCells(subgiat)}
                            </tr>

                            {/* REKENING DI DALAM SUB KEGIATAN */}
                            {isExpanded && sortedRekening.map((rek) => (
                              <tr key={rek.kdrek} className="border-b border-slate-800/40 hover:bg-slate-800/30 text-[11px]">
                                <td className="p-2 pl-8 border-r border-slate-800 text-amber-300/90 font-mono whitespace-nowrap">
                                  {rek.kdrek}
                                </td>
                                <td className="p-2 border-r border-slate-800 text-slate-300 text-left">
                                  {rek.nmrek}
                                </td>
                                {renderValueCells(rek)}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                  )
                )}

              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}