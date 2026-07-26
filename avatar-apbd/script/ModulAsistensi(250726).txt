import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Save, Trash2, Plus, Edit2, CheckCircle2, 
  Building2, Layers, Search, FileText, 
  DollarSign, ShoppingBag, CreditCard, AlertCircle, RefreshCw,
  Cpu, Database, Activity, Sparkles, ArrowLeft, ChevronDown
} from 'lucide-react';

const DINKES_KODE = '1.02.0.00.0.00.01.0000';

export default function ModulAsistensi() {
  // === STATE DATA SUPABASE ===
  const [listStatus, setListStatus] = useState([]);
  const [listSkpd, setListSkpd] = useState([]);
  const [listRekening, setListRekening] = useState([]);
  const [listRka, setListRka] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // === FILTER STATES ===
  const [tahun, setTahun] = useState('2026');
  const [kdStatus, setKdStatus] = useState('');
  const [kdSkpd, setKdSkpd] = useState('');
  const [selectedSubunit, setSelectedSubunit] = useState(null);

  // === TAB / PAGE FRAME STATE ===
  const [activeTab, setActiveTab] = useState('pendapatan');

  // === DATA DRAFT INPUT ===
  const [draftPendapatan, setDraftPendapatan] = useState([]);
  const [draftBelanja, setDraftBelanja] = useState([]);
  const [draftPembiayaan, setDraftPembiayaan] = useState([]);

  // === DATABASE TABEL ASISTENSI ===
  const [dbAsistensi, setDbAsistensi] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSupabaseData();
    fetchAsistensiData();
  }, []);

  // Fetch data RKA dengan Pagination (Menembus Limit 1000 Supabase)
  const fetchAllRkaData = async () => {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from('rka')
        .select('*')
        .range(from, to);

      if (error) {
        console.error('Error fetching RKA page', page, error);
        throw error;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        page++;
        if (data.length < pageSize) {
          fetchMore = false;
        }
      } else {
        fetchMore = false;
      }
    }

    return allData;
  };

  const fetchSupabaseData = async () => {
    setLoadingDb(true);
    try {
      const { data: statusData, error: errStatus } = await supabase.from('tblstatus').select('*');
      if (errStatus) throw errStatus;

      const { data: skpdData, error: errSkpd } = await supabase.from('tblskpd').select('*');
      if (errSkpd) throw errSkpd;

      const { data: rekData, error: errRek } = await supabase.from('mrek').select('*');
      if (errRek) throw errRek;

      const rkaData = await fetchAllRkaData();

      setListStatus(statusData || []);
      setListSkpd(skpdData || []);
      setListRekening(rekData || []);
      setListRka(rkaData || []);
    } catch (error) {
      console.error('Error loading Supabase referensi:', error.message);
      alert('Gagal memuat data dari Supabase: ' + error.message);
    } finally {
      setLoadingDb(false);
    }
  };

  const fetchAsistensiData = async () => {
    try {
      const { data, error } = await supabase.from('asistensi').select('*').order('id', { ascending: false });
      if (!error && data) {
        setDbAsistensi(data);
      }
    } catch (err) {
      console.error('Error fetching asistensi:', err);
    }
  };

  // Reset Subunit ketika SKPD Utama Berganti
  useEffect(() => {
    setSelectedSubunit(null);
  }, [kdSkpd]);

  // 1. Daftar SKPD Utama dari tblskpd
  const listSkpdUtama = useMemo(() => {
    const map = new Map();
    listSkpd.forEach(s => {
      const kd = String(s.kd_skpd || s.kdskpd || s.id || '').trim();
      if (!map.has(kd)) {
        map.set(kd, s);
      }
    });
    return Array.from(map.values());
  }, [listSkpd]);

  // 2. Filter Khusus Subunit Dinas Kesehatan
  const listSubunitDinkes = useMemo(() => {
    if (kdSkpd !== DINKES_KODE) return [];
    
    return listSkpd.filter(s => {
      const kd = String(s.kd_skpd || s.kdskpd || s.kd_subunit || s.kdsubunit || '').trim();
      return kd.startsWith('1.02') && kd !== DINKES_KODE;
    });
  }, [listSkpd, kdSkpd]);

  // Kelengkapan Filter
  const isFilterComplete = useMemo(() => {
    if (!tahun || !kdStatus || !kdSkpd) return false;
    if (kdSkpd === DINKES_KODE && !selectedSubunit) return false;
    return true;
  }, [tahun, kdStatus, kdSkpd, selectedSubunit]);

  const selectedSkpdObj = useMemo(() => {
    return listSkpdUtama.find(s => String(s.kd_skpd || s.kdskpd) === String(kdSkpd));
  }, [listSkpdUtama, kdSkpd]);

  const selectedStatusObj = useMemo(() => {
    return listStatus.find(s => String(s.kd_status || s.kdstatus || s.id) === String(kdStatus));
  }, [listStatus, kdStatus]);

  // Opsi Rekening (mrek)
  const rekPendapatanOptions = useMemo(() => {
    return listRekening.filter(r => {
      const isLvl8 = r.level ? Number(r.level) === 8 : true;
      const kd = String(r.kd_rek || r.kdrek || '');
      return isLvl8 && kd.startsWith('4');
    });
  }, [listRekening]);

  const rekBelanjaOptions = useMemo(() => {
    return listRekening.filter(r => {
      const isLvl8 = r.level ? Number(r.level) === 8 : true;
      const kd = String(r.kd_rek || r.kdrek || '');
      return isLvl8 && kd.startsWith('5');
    });
  }, [listRekening]);

  const rekPembiayaanOptions = useMemo(() => {
    return listRekening.filter(r => {
      const isLvl8 = r.level ? Number(r.level) === 8 : true;
      const kd = String(r.kd_rek || r.kdrek || '');
      return isLvl8 && (kd.startsWith('6') || kd.startsWith('4'));
    });
  }, [listRekening]);

  // FILTER RKA UNTUK DAFTAR SUB KEGIATAN
  const rkaSubgiatOptions = useMemo(() => {
    if (!listRka || listRka.length === 0) return [];

    const uniqueMap = new Map();
    const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanRaw = (val) => String(val || '').trim();

    const targetStatusName = selectedStatusObj 
      ? cleanRaw(selectedStatusObj.nmstatus || selectedStatusObj.nm_status || selectedStatusObj.status)
      : cleanRaw(kdStatus);

    listRka.forEach((r) => {
      const fitTahun = !tahun || cleanRaw(r.tahun) === cleanRaw(tahun);
      const rkaStatusVal = cleanRaw(r.kdstatus || r.status);
      const fitStatus = !kdStatus || rkaStatusVal === cleanRaw(kdStatus) || rkaStatusVal === targetStatusName;
      const fitSkpd = !kdSkpd || normalize(r.kdskpd) === normalize(kdSkpd) || normalize(r.kdskpd).includes(normalize(kdSkpd));

      let fitSubunit = true;
      if (normalize(kdSkpd) === normalize(DINKES_KODE) && selectedSubunit) {
        const targetSub = normalize(selectedSubunit.kdsubunit || selectedSubunit.kd_subunit || selectedSubunit.kdskpd || selectedSubunit.kd_skpd);
        fitSubunit = normalize(r.kdsubunit) === targetSub;
      }

      if (fitTahun && fitStatus && fitSkpd && fitSubunit && r.kdsubgiat) {
        const key = cleanRaw(r.kdsubgiat);
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, r);
        }
      }
    });

    return Array.from(uniqueMap.values());
  }, [listRka, tahun, kdStatus, kdSkpd, selectedSubunit, selectedStatusObj]);

  // Filter Data Asistensi yang Tersimpan di Supabase berdasarkan SKPD/Subunit Terpilih
  const filteredDbAsistensiBySkpd = useMemo(() => {
    if (!kdSkpd) return [];
    const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    return dbAsistensi.filter((item) => {
      const fitSkpd = normalize(item.kdskpd) === normalize(kdSkpd);
      if (!fitSkpd) return false;

      if (normalize(kdSkpd) === normalize(DINKES_KODE) && selectedSubunit) {
        const subKode = normalize(selectedSubunit.kdsubunit || selectedSubunit.kd_subunit || selectedSubunit.kdskpd || selectedSubunit.kd_skpd);
        return normalize(item.kdsubunit) === subKode;
      }

      return true;
    });
  }, [dbAsistensi, kdSkpd, selectedSubunit]);

  // Kalkulasi total nominal draft
  const totalDraftPendapatan = useMemo(() => draftPendapatan.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0), [draftPendapatan]);
  const totalDraftBelanja = useMemo(() => draftBelanja.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0), [draftBelanja]);
  const totalDraftPembiayaan = useMemo(() => draftPembiayaan.reduce((acc, curr) => acc + (Number(curr.jumlah) || 0), 0), [draftPembiayaan]);

  const handleSimpanData = async () => {
    if (!isFilterComplete) {
      alert('Harap lengkapi semua filter terlebih dahulu!');
      return;
    }

    const allDrafts = [...draftPendapatan, ...draftBelanja, ...draftPembiayaan];

    if (allDrafts.length === 0) {
      alert('Tidak ada data usulan pada tabel inputan!');
      return;
    }

    setSaving(true);

    const newRecords = allDrafts.map((d) => ({
      tahun: String(tahun),
      status: selectedStatusObj?.nm_status || selectedStatusObj?.status || selectedStatusObj?.nmstatus || '',
      kdstatus: String(kdStatus),
      kdskpd: String(kdSkpd),
      nmskpd: selectedSkpdObj?.nm_skpd || selectedSkpdObj?.nmskpd || '',
      kdsubunit: selectedSubunit ? (selectedSubunit.kdsubunit || selectedSubunit.kd_subunit || selectedSubunit.kdskpd || selectedSubunit.kd_skpd) : '-',
      nmsubunit: selectedSubunit ? (selectedSubunit.nmsubunit || selectedSubunit.nm_subunit || selectedSubunit.nmskpd || selectedSubunit.nm_skpd) : '-',
      kdsubgiat: d.kdsubgiat || '-',
      nmsubgiat: d.nmsubgiat || '-',
      kdrek: String(d.kdrek),
      nmrek: String(d.nmrek),
      usulan: String(d.usulan),
      keterangan: String(d.keterangan || '-'),
      setuju: String(d.setuju || 'Disetujui'),
      jumlah: Number(d.jumlah) || 0
    }));

    try {
      const { data, error } = await supabase.from('asistensi').insert(newRecords).select();
      
      if (error) {
        throw new Error(`[Supabase Error] ${error.message}`);
      }

      alert('Berhasil menyimpan ' + (data ? data.length : newRecords.length) + ' data ke Supabase!');
      await fetchAsistensiData();
      setDraftPendapatan([]);
      setDraftBelanja([]);
      setDraftPembiayaan([]);
      setActiveTab('laporan');
    } catch (err) {
      console.error('Gagal simpan ke Supabase:', err);
      alert('GAGAL MENYIMPAN KE SUPABASE!\n\nPenyebab: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleHapusData = () => {
    if (confirm('Apakah Anda yakin ingin mengosongkan semua isian inputan draft saat ini?')) {
      setDraftPendapatan([]);
      setDraftBelanja([]);
      setDraftPembiayaan([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans space-y-6 relative overflow-hidden">
      
      {/* DEKORASI BACKGROUND */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* HEADER BAR */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 px-5 py-4 rounded-2xl border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.08)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
            <Cpu size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-300 uppercase">
                ASISTENSI APBD
              </h1>
              <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span> v2026
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
              <Database size={11} className="text-cyan-400" /> Integrated Supabase Core System
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchSupabaseData}
            disabled={loadingDb}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 text-white border border-slate-700/80 font-mono text-xs transition-all cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingDb ? 'animate-spin text-cyan-400' : 'text-slate-400'} />
            {loadingDb ? 'SYNCING...' : 'RELOAD DB'}
          </button>

          <button
            onClick={handleHapusData}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-800/50 font-semibold text-xs tracking-wide transition-all shadow-lg hover:shadow-rose-950/50 cursor-pointer"
          >
            <Trash2 size={14} /> RESET DRAFT
          </button>

          <button
            onClick={handleSimpanData}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] active:scale-95 disabled:opacity-50 cursor-pointer uppercase"
          >
            <Save size={14} /> {saving ? 'SAVING...' : 'SIMPAN KE SUPABASE'}
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="relative z-10 bg-slate-900/30 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80 text-[11px] font-mono text-cyan-400 uppercase tracking-widest">
          <Sparkles size={13} /> Filter Parameter Utama
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* 1. TAHUN */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase flex items-center justify-between">
              <span>1. Tahun Anggaran</span>
              <span className="text-[9px] text-cyan-400 font-normal">rka.tahun</span>
            </label>
            <select
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 shadow-inner"
            >
              <option value="2025" className="bg-slate-900 text-white">2025</option>
              <option value="2026" className="bg-slate-900 text-white">2026</option>
              <option value="2027" className="bg-slate-900 text-white">2027</option>
              <option value="2028" className="bg-slate-900 text-white">2028</option>
            </select>
          </div>

          {/* 2. TAHAPAN STATUS APBD */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase flex items-center justify-between">
              <span>2. Tahapan APBD</span>
              <span className="text-[9px] text-cyan-400 font-normal">rka.kdstatus</span>
            </label>
            <select
              value={kdStatus}
              onChange={(e) => setKdStatus(e.target.value)}
              disabled={loadingDb}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 shadow-inner disabled:opacity-50"
            >
              <option value="" className="bg-slate-900 text-white">-- PILIH TAHAPAN APBD --</option>
              {listStatus.map((s, idx) => {
                const valKode = String(s.kdstatus || s.kd_status || s.id || '').trim();
                const valNama = s.nmstatus || s.nm_status || s.status || s.nama_status || valKode;
                return (
                  <option key={valKode || idx} value={valKode} className="bg-slate-900 text-white">
                    [{valKode}] {valNama}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. SKPD */}
          <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
            <label className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase flex items-center justify-between">
              <span>3. Perangkat Daerah</span>
              <span className="text-[9px] text-cyan-400 font-normal">rka.kdskpd</span>
            </label>
            <select
              value={kdSkpd}
              onChange={(e) => setKdSkpd(e.target.value)}
              disabled={loadingDb}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 shadow-inner disabled:opacity-50"
            >
              <option value="" className="bg-slate-900 text-white">-- PILIH SKPD/PERANGKAT DAERAH --</option>
              {listSkpdUtama.map((skpd, idx) => {
                const kdS = skpd.kdskpd || skpd.kd_skpd || skpd.id;
                const nmS = skpd.nmskpd || skpd.nm_skpd || skpd.nama_skpd;
                return (
                  <option key={kdS || idx} value={kdS} className="bg-slate-900 text-white">
                    [{kdS}] {nmS}
                  </option>
                );
              })}
            </select>
          </div>

        </div>

        {/* 4. TREEVIEW SUBUNIT DINAS KESEHATAN */}
        {kdSkpd === DINKES_KODE && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-950/90 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all animate-fadeIn space-y-3">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-xs uppercase tracking-wider">
                <Layers size={16} /> Treeview Subunit Dinas Kesehatan
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                Wajib Dipilih Satu Node Subunit
              </span>
            </div>

            {listSubunitDinkes.length === 0 ? (
              <div className="text-center py-6 font-mono text-xs text-amber-400/80 bg-slate-900/40 rounded-xl border border-slate-800">
                -- Tidak Ada Subunit Dibawah Dinas Kesehatan Pada Tabel tblskpd --
              </div>
            ) : (
              <div className="space-y-2 pt-1 font-mono">
                {/* NODE INDUK (DINAS KESEHATAN) */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300">
                  <Building2 size={16} className="text-cyan-400 shrink-0" />
                  <span className="text-xs font-bold text-cyan-300">[{DINKES_KODE}]</span>
                  <span className="text-xs font-extrabold text-white tracking-wide uppercase">DINAS KESEHATAN (PARENT SKPD)</span>
                </div>

                {/* TREEVIEW DAFTAR SUBROW */}
                <div className="pl-4 sm:pl-6 space-y-1.5 border-l-2 border-cyan-500/30 ml-3 my-1">
                  {listSubunitDinkes.map((sub, idx) => {
                    const kodeSub = sub.kdsubunit || sub.kd_subunit || sub.kdskpd || sub.kd_skpd;
                    const namaSub = sub.nmsubunit || sub.nm_subunit || sub.nmskpd || sub.nm_skpd;
                    
                    const currentSubKode = selectedSubunit?.kdsubunit || selectedSubunit?.kd_subunit || selectedSubunit?.kdskpd || selectedSubunit?.kd_skpd;
                    const isSelected = currentSubKode === kodeSub;
                    const isLast = idx === listSubunitDinkes.length - 1;

                    return (
                      <div
                        key={sub.id || kodeSub || idx}
                        onClick={() => setSelectedSubunit(sub)}
                        className={`group relative flex items-center justify-between p-2.5 pl-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.25)] translate-x-1' 
                            : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:border-cyan-500/40 hover:bg-slate-900/90 hover:text-white hover:translate-x-1'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="text-slate-600 font-bold select-none text-xs">
                            {isLast ? '└─' : '├─'}
                          </span>
                          <div className={`p-1.5 rounded-lg border shrink-0 ${isSelected ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-400 group-hover:text-cyan-300'}`}>
                            <Layers size={13} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-tight">
                                {kodeSub}
                              </span>
                            </div>
                            <div className="text-xs font-semibold truncate text-white group-hover:text-cyan-200">
                              {namaSub}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          {isSelected ? (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-bold">
                              <CheckCircle2 size={13} /> TERPILIH
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
                              Pilih Node ➔
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DASHBOARD STATS SUMMARY */}
      {isFilterComplete && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-2xl backdrop-blur-md">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Draft Pendapatan</div>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
              Rp {totalDraftPendapatan.toLocaleString('id-ID')}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{draftPendapatan.length} Entri Usulan</div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-2xl backdrop-blur-md">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Draft Belanja</div>
            <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
              Rp {totalDraftBelanja.toLocaleString('id-ID')}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{draftBelanja.length} Entri Usulan</div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-2xl backdrop-blur-md">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Draft Pembiayaan</div>
            <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
              Rp {totalDraftPembiayaan.toLocaleString('id-ID')}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{draftPembiayaan.length} Entri Usulan</div>
          </div>
        </div>
      )}

      {/* TAB CONTENT & FRAME INPUT */}
      {!isFilterComplete ? (
        <div className="p-12 text-center bg-slate-900/20 rounded-2xl border border-dashed border-slate-800/80 backdrop-blur-md space-y-2">
          <AlertCircle size={36} className="mx-auto text-amber-400/80 animate-bounce" />
          <h3 className="text-sm font-bold text-slate-200 tracking-wide font-mono">STANDBY / FILTER INCOMPLETE</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Silakan tentukan Tahun Anggaran, Status APBD, dan SKPD {kdSkpd === DINKES_KODE ? '(termasuk Subunit Node)' : ''} pada panel atas untuk mengaktifkan modul input.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-slate-800/80 pb-3">
            {[
              { id: 'pendapatan', label: 'Frame Pendapatan', icon: DollarSign, color: 'text-emerald-400' },
              { id: 'belanja', label: 'Frame Belanja', icon: ShoppingBag, color: 'text-cyan-400' },
              { id: 'pembiayaan', label: 'Frame Pembiayaan', icon: CreditCard, color: 'text-amber-400' },
              { id: 'laporan', label: 'Page Frame Laporan', icon: FileText, color: 'text-indigo-400' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-800/90 text-white border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.18)]'
                      : 'bg-slate-900/40 text-slate-300 hover:bg-slate-900/80 hover:text-white border border-slate-800/50'
                  }`}
                >
                  <Icon size={15} className={tab.color} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-xl shadow-2xl space-y-6">
            
            {/* FITUR 1: DATA TERLEBIH DAHULU/DILUAR DARI DATABASE ASISTENSI OTOMATIS TAMPIL KETIKA SKPD DIPILIH */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Database size={14} className="text-amber-400" /> Data Log Asistensi Tersimpan ({filteredDbAsistensiBySkpd.length} Records)
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  Perangkat Daerah: <span className="text-cyan-300 font-bold">{selectedSkpdObj?.nm_skpd || selectedSkpdObj?.nmskpd}</span>
                </span>
              </div>

              <div className="overflow-x-auto max-h-56 rounded-lg border border-slate-800/80">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-900 text-amber-300 font-mono uppercase text-[10px] sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2 text-center">No</th>
                      <th className="p-2">Tahun / Status</th>
                      <th className="p-2">Sub Kegiatan</th>
                      <th className="p-2">Kode & Nama Rekening</th>
                      <th className="p-2">Usulan</th>
                      {/* FITUR 3: KETERANGAN DIPERLEBAR PADA TABEL */}
                      <th className="p-2 min-w-[280px]">Keterangan Catatan</th>
                      <th className="p-2 text-center">Setuju</th>
                      <th className="p-2 text-right">Jumlah (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono bg-slate-950/40 text-[11px]">
                    {filteredDbAsistensiBySkpd.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-500 italic font-sans text-xs">
                          -- Belum Ada Data Log Asistensi Tersimpan untuk SKPD Ini --
                        </td>
                      </tr>
                    ) : (
                      filteredDbAsistensiBySkpd.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2">
                            <span className="text-cyan-400 font-bold">{item.tahun}</span>
                            <span className="text-slate-400 text-[10px] block">{item.status}</span>
                          </td>
                          <td className="p-2 max-w-xs truncate font-sans text-slate-300">
                            {item.nmsubgiat !== '-' ? item.nmsubgiat : '-'}
                          </td>
                          <td className="p-2">
                            <span className="text-cyan-300 font-mono text-[10px] block">{item.kdrek}</span>
                            <span className="text-slate-200 font-sans font-medium text-[11px]">{item.nmrek}</span>
                          </td>
                          <td className="p-2 font-sans font-semibold text-white">{item.usulan}</td>
                          {/* KETERANGAN DIPERLEBAR DAN MULTILINE SUPPORT */}
                          <td className="p-2 font-sans text-slate-300 min-w-[280px] whitespace-pre-wrap break-words text-[11px]">
                            {item.keterangan || '-'}
                          </td>
                          <td className="p-2 text-center font-sans">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              item.setuju === 'Disetujui' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}>
                              {item.setuju}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono text-amber-300 font-bold">
                            {Number(item.jumlah || 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODUL TAB INPUT */}
            {activeTab === 'pendapatan' && (
              <InputTableFrame
                title="Input Asistensi Pendapatan"
                rekOptions={rekPendapatanOptions}
                draftData={draftPendapatan}
                setDraftData={setDraftPendapatan}
                hasSubgiat={false}
              />
            )}

            {activeTab === 'belanja' && (
              <InputTableFrame
                title="Input Asistensi Belanja"
                rekOptions={rekBelanjaOptions}
                rkaSubgiatOptions={rkaSubgiatOptions}
                draftData={draftBelanja}
                setDraftData={setDraftBelanja}
                hasSubgiat={true}
              />
            )}

            {activeTab === 'pembiayaan' && (
              <InputTableFrame
                title="Input Asistensi Pembiayaan"
                rekOptions={rekPembiayaanOptions}
                draftData={draftPembiayaan}
                setDraftData={setDraftPembiayaan}
                hasSubgiat={false}
              />
            )}

            {activeTab === 'laporan' && (
              <LaporanFrame 
                data={dbAsistensi} 
                selectedKdSkpd={kdSkpd}
                selectedSubunit={selectedSubunit}
                listSubunitDinkes={listSubunitDinkes}
                setSelectedSubunit={setSelectedSubunit}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// === FITUR 4: COMBOBOX REKENING DENGAN SEARCH PENCARIAN ===
function SelectRekeningSearchable({ rekOptions, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchRek, setSearchRek] = useState('');

  const selectedRek = useMemo(() => {
    return rekOptions.find(r => String(r.kdrek || r.kd_rek) === String(value));
  }, [rekOptions, value]);

  const filteredOptions = useMemo(() => {
    if (!searchRek.trim()) return rekOptions;
    const term = searchRek.toLowerCase();
    return rekOptions.filter(r => {
      const kd = String(r.kdrek || r.kd_rek || '').toLowerCase();
      const nm = String(r.nmrek || r.nm_rek || r.nama_rekening || r.uraian || '').toLowerCase();
      return kd.includes(term) || nm.includes(term);
    });
  }, [rekOptions, searchRek]);

  return (
    <div className="relative w-full">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-900 border border-slate-800 focus-within:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-white flex items-center justify-between cursor-pointer hover:border-cyan-500/50 min-h-[38px]"
      >
        <div className="truncate pr-2">
          {selectedRek ? (
            <span>
              <strong className="text-cyan-400">[{selectedRek.kdrek || selectedRek.kd_rek}]</strong>{' '}
              {selectedRek.nmrek || selectedRek.nm_rek || selectedRek.nama_rekening || selectedRek.uraian}
            </span>
          ) : (
            <span className="text-slate-500">-- Pilih & Cari Rekening --</span>
          )}
        </div>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 top-full mt-1 w-full bg-slate-950 border border-cyan-500/40 rounded-xl shadow-2xl p-2 space-y-2 max-h-64 overflow-hidden flex flex-col">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Ketik kode / nama rekening..."
              value={searchRek}
              onChange={(e) => setSearchRek(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto max-h-48 space-y-1 divide-y divide-slate-900 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-slate-500 font-mono">
                Tidak ada rekening yang cocok.
              </div>
            ) : (
              filteredOptions.map((r, idx) => {
                const kdR = r.kdrek || r.kd_rek || idx;
                const nmR = r.nmrek || r.nm_rek || r.nama_rekening || r.uraian || '';
                const isSelected = String(value) === String(kdR);

                return (
                  <div
                    key={kdR}
                    onClick={() => {
                      onChange(kdR, nmR);
                      setIsOpen(false);
                      setSearchRek('');
                    }}
                    className={`p-2 rounded-lg cursor-pointer text-xs font-mono transition-colors flex flex-col ${
                      isSelected ? 'bg-cyan-950 border border-cyan-500/40 text-cyan-300' : 'hover:bg-slate-900 text-slate-200'
                    }`}
                  >
                    <span className="text-cyan-400 font-bold text-[10px]">[{kdR}]</span>
                    <span className="text-white text-[11px] font-sans truncate">{nmR}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// === KOMPONEN FORM & TABEL INPUT DRAFT ===
function InputTableFrame({ title, rekOptions, rkaSubgiatOptions = [], draftData, setDraftData, hasSubgiat }) {
  const [form, setForm] = useState({
    kdsubgiat: '',
    nmsubgiat: '',
    kdrek: '',
    nmrek: '',
    usulan: 'Penambahan',
    jumlah: '',
    keterangan: '',
    setuju: 'Disetujui'
  });

  const [editIndex, setEditIndex] = useState(null);

  const formatRupiah = (val) => {
    if (!val && val !== 0) return '';
    const cleanNum = String(val).replace(/\D/g, '');
    return cleanNum ? Number(cleanNum).toLocaleString('id-ID') : '';
  };

  const handleJumlahChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    setForm(prev => ({ ...prev, jumlah: rawVal }));
  };

  const handleSubgiatChange = (e) => {
    const selectedKode = e.target.value;
    const found = rkaSubgiatOptions.find(r => String(r.kdsubgiat || r.kd_subgiat) === String(selectedKode));
    setForm(prev => ({
      ...prev,
      kdsubgiat: selectedKode,
      nmsubgiat: found ? (found.nmsubgiat || found.nm_subgiat || '') : ''
    }));
  };

  const handleTambahAtauUpdate = () => {
    if (!form.kdrek) {
      alert('Pilih Rekening terlebih dahulu!');
      return;
    }
    if (hasSubgiat && !form.kdsubgiat) {
      alert('Pilih Sub Kegiatan terlebih dahulu!');
      return;
    }
    if (!form.jumlah || isNaN(form.jumlah) || Number(form.jumlah) <= 0) {
      alert('Isi Jumlah dengan nominal angka yang valid!');
      return;
    }

    if (editIndex !== null) {
      const updated = [...draftData];
      updated[editIndex] = form;
      setDraftData(updated);
      setEditIndex(null);
    } else {
      setDraftData([...draftData, form]);
    }

    setForm({
      kdsubgiat: '',
      nmsubgiat: '',
      kdrek: '',
      nmrek: '',
      usulan: 'Penambahan',
      jumlah: '',
      keterangan: '',
      setuju: 'Disetujui'
    });
  };

  const handleEditRow = (idx) => {
    setForm(draftData[idx]);
    setEditIndex(idx);
  };

  const handleHapusRow = (idx) => {
    setDraftData(draftData.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
          <Activity size={15} /> {title}
        </h2>
        <span className="text-[10px] font-mono text-slate-400 uppercase">Form Input Mode</span>
      </div>

      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 shadow-inner space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {hasSubgiat && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">Sub Kegiatan (Tabel RKA: kdsubgiat)</label>
              <select
                value={form.kdsubgiat}
                onChange={handleSubgiatChange}
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
              >
                <option value="" className="bg-slate-900 text-white">-- Pilih Sub Kegiatan --</option>
                {rkaSubgiatOptions.map((item, idx) => {
                  const kode = item.kdsubgiat || '';
                  const nama = item.nmsubgiat || 'Tanpa Nama Subkegiatan';
                  return (
                    <option key={kode || idx} value={kode} className="bg-slate-900 text-white">
                      [{kode}] {nama}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* FITUR 4: SEARCHABLE REKENING COMBOBOX */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">Kode Rekening (Tabel mrek: kdrek)</label>
            <SelectRekeningSearchable
              rekOptions={rekOptions}
              value={form.kdrek}
              onChange={(kd, nm) => setForm(prev => ({ ...prev, kdrek: kd, nmrek: nm }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">Jenis Usulan</label>
            <select
              value={form.usulan}
              onChange={(e) => setForm({ ...form, usulan: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
            >
              <option value="Penambahan" className="bg-slate-900 text-white">Penambahan</option>
              <option value="Pengurangan" className="bg-slate-900 text-white">Pengurangan</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">Jumlah Nilai (Rp)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-mono text-cyan-400 font-bold">Rp</span>
              <input
                type="text"
                value={formatRupiah(form.jumlah)}
                onChange={handleJumlahChange}
                placeholder="0"
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white font-bold focus:outline-none placeholder-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">Status Persetujuan</label>
            <select
              value={form.setuju}
              onChange={(e) => setForm({ ...form, setuju: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
            >
              <option value="Disetujui" className="bg-slate-900 text-white">Disetujui</option>
              <option value="Tidak Disetujui" className="bg-slate-900 text-white">Tidak Disetujui</option>
            </select>
          </div>

          {/* FITUR 2: TEXTBOX KETERANGAN DIPERBESAR (TEXTAREA) */}
          <div className="space-y-1 md:col-span-3">
            <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">Keterangan Catatan (Uraian Panjang)</label>
            <textarea
              rows={3}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Uraian asistensi / catatan lengkap..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none font-sans resize-y"
            />
          </div>

          <div className="flex items-end md:col-span-1">
            <button
              onClick={handleTambahAtauUpdate}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(34,211,238,0.2)]"
            >
              {editIndex !== null ? <Edit2 size={13} /> : <Plus size={13} />}
              {editIndex !== null ? 'Update Item' : 'Tambah Ke Draft'}
            </button>
          </div>

        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-cyan-400 font-mono uppercase border-b border-slate-800 tracking-wider">
            <tr>
              <th className="p-3 text-center">No</th>
              {hasSubgiat && <th className="p-3">Sub Kegiatan</th>}
              <th className="p-3">Kode & Nama Rekening</th>
              <th className="p-3">Usulan</th>
              <th className="p-3 text-right">Jumlah (Rp)</th>
              {/* FITUR 3: KETERANGAN DIPERLEBAR */}
              <th className="p-3 min-w-[280px]">Keterangan</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans bg-slate-950/40">
            {draftData.length === 0 ? (
              <tr>
                <td colSpan={hasSubgiat ? 8 : 7} className="p-6 text-center text-slate-400 font-mono italic text-[11px]">
                  -- Belum Ada Usulan Ditambahkan Ke Dalam Draft --
                </td>
              </tr>
            ) : (
              draftData.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                  {hasSubgiat && (
                    <td className="p-3 max-w-xs">
                      <div className="font-mono text-cyan-300 text-[10px]">{item.kdsubgiat}</div>
                      <div className="text-white truncate text-[11px] font-medium">{item.nmsubgiat}</div>
                    </td>
                  )}
                  <td className="p-3 max-w-xs">
                    <div className="font-mono text-cyan-300 text-[10px]">{item.kdrek}</div>
                    <div className="text-white text-[11px] font-medium">{item.nmrek}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.usulan === 'Penambahan' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80' : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                    }`}>
                      {item.usulan}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-white font-bold">
                    {Number(item.jumlah).toLocaleString('id-ID')}
                  </td>
                  {/* FITUR 3: KOLOM KETERANGAN DIPERLEBAR */}
                  <td className="p-3 text-slate-300 text-[11px] min-w-[280px] whitespace-pre-wrap break-words">
                    {item.keterangan || '-'}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.setuju === 'Disetujui' ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80' : 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                    }`}>
                      {item.setuju}
                    </span>
                  </td>
                  <td className="p-3 text-center space-x-1.5">
                    <button onClick={() => handleEditRow(idx)} className="text-cyan-400 hover:text-cyan-300 cursor-pointer p-1">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleHapusRow(idx)} className="text-rose-400 hover:text-rose-300 cursor-pointer p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === KOMPONEN LAPORAN ASISTENSI ===
function LaporanFrame({ data, selectedKdSkpd, selectedSubunit, listSubunitDinkes, setSelectedSubunit }) {
  const [searchTerm, setSearchTerm] = useState('');

  const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // Filter Data berdasarkan SKPD yang sedang dipilih
  const dataSkpdOnly = useMemo(() => {
    if (!selectedKdSkpd) return data;
    return data.filter(d => normalize(d.kdskpd) === normalize(selectedKdSkpd));
  }, [data, selectedKdSkpd]);

  // Subunit terpilih dalam format string
  const activeSubunitKode = selectedSubunit ? (selectedSubunit.kdsubunit || selectedSubunit.kd_subunit || selectedSubunit.kdskpd || selectedSubunit.kd_skpd) : null;

  // Filter Data Final jika Subunit dipilih
  const filteredData = useMemo(() => {
    let base = dataSkpdOnly;

    if (selectedKdSkpd === DINKES_KODE && activeSubunitKode) {
      base = base.filter(d => normalize(d.kdsubunit) === normalize(activeSubunitKode));
    }

    if (!searchTerm) return base;
    const term = searchTerm.toLowerCase();
    return base.filter(d => 
      (d.nmskpd && d.nmskpd.toLowerCase().includes(term)) ||
      (d.nmsubunit && d.nmsubunit.toLowerCase().includes(term)) ||
      (d.kdrek && d.kdrek.toLowerCase().includes(term)) ||
      (d.nmrek && d.nmrek.toLowerCase().includes(term)) ||
      (d.nmsubgiat && d.nmsubgiat.toLowerCase().includes(term))
    );
  }, [dataSkpdOnly, selectedKdSkpd, activeSubunitKode, searchTerm]);

  // Statistik per Subunit khusus Dinas Kesehatan
  const subunitStats = useMemo(() => {
    if (selectedKdSkpd !== DINKES_KODE) return [];

    return listSubunitDinkes.map(sub => {
      const kodeSub = sub.kdsubunit || sub.kd_subunit || sub.kdskpd || sub.kd_skpd;
      const namaSub = sub.nmsubunit || sub.nm_subunit || sub.nmskpd || sub.nm_skpd;

      const records = dataSkpdOnly.filter(d => normalize(d.kdsubunit) === normalize(kodeSub));
      const totalNilai = records.reduce((acc, curr) => acc + Number(curr.jumlah || 0), 0);

      return {
        rawObj: sub,
        kodeSub,
        namaSub,
        count: records.length,
        totalNilai
      };
    });
  }, [selectedKdSkpd, listSubunitDinkes, dataSkpdOnly]);

  const isDinkesMode = selectedKdSkpd === DINKES_KODE;
  const showSubunitListMode = isDinkesMode && !activeSubunitKode;

  return (
    <div className="space-y-4">
      {/* HEADER LOGS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
            <FileText size={15} /> Database Logs: <span className="text-cyan-300 font-mono">asistensi</span>
          </h2>
          <p className="text-[10px] text-slate-300 mt-0.5 font-mono">
            {isDinkesMode ? (
              activeSubunitKode ? (
                <span className="text-cyan-400 font-bold">▶ Node Subunit: {selectedSubunit?.nmsubunit || selectedSubunit?.nm_subunit || selectedSubunit?.nmskpd || activeSubunitKode}</span>
              ) : (
                <span className="text-amber-400"> Pilih Subunit Dinas Kesehatan di bawah ini untuk melihat detail data.</span>
              )
            ) : (
              <span>Menampilkan log data SKPD aktif.</span>
            )}
          </p>
        </div>
        
        {!showSubunitListMode && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Cari Rekening / Subgiat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
            />
          </div>
        )}
      </div>

      {showSubunitListMode ? (
        <div className="space-y-3 p-4 rounded-xl bg-slate-950/80 border border-amber-500/30">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold border-b border-slate-800 pb-2">
            <Building2 size={16} /> PILIH SUBUNIT DINAS KESEHATAN UNTUK MEMBUKA DETAIL LOG
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {subunitStats.map((st, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedSubunit(st.rawObj)}
                className="group p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-400/80 hover:bg-cyan-950/30 cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">{st.kodeSub}</span>
                    <span className={`px-2 py-0.5 text-[9px] font-mono rounded-full border ${st.count > 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                      {st.count} Records
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white group-hover:text-cyan-200 mt-1 line-clamp-2">
                    {st.namaSub}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-400 text-[10px]">Total Value:</span>
                  <span className="font-bold text-amber-300">Rp {st.totalNilai.toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {isDinkesMode && activeSubunitKode && (
            <button
              onClick={() => setSelectedSubunit(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700 text-xs font-mono transition-all cursor-pointer"
            >
              <ArrowLeft size={13} /> Kembali ke Daftar Subunit Dinkes
            </button>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-amber-400 font-mono uppercase border-b border-slate-800 tracking-wider text-[11px]">
                <tr>
                  <th className="p-2.5 text-center">No</th>
                  <th className="p-2.5">tahun</th>
                  <th className="p-2.5">status</th>
                  <th className="p-2.5">nmskpd</th>
                  <th className="p-2.5">nmsubunit</th>
                  <th className="p-2.5">nmsubgiat</th>
                  <th className="p-2.5">nmrek</th>
                  <th className="p-2.5">usulan</th>
                  {/* FITUR 3: KETERANGAN DIPERLEBAR */}
                  <th className="p-2.5 min-w-[280px]">keterangan</th>
                  <th className="p-2.5 text-center">setuju</th>
                  <th className="p-2.5 text-right">jumlah (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono bg-slate-950/30">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 italic font-sans text-xs">
                      -- Tidak Ada Record Data Asistensi Ditemukan --
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-800/40 text-[10px] transition-colors">
                      <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-2.5 text-cyan-300 font-bold">{item.tahun}</td>
                      <td className="p-2.5">
                        <span className="text-white font-medium">{item.status}</span>
                        <span className="text-slate-400 text-[9px] ml-1">({item.kdstatus})</span>
                      </td>
                      <td className="p-2.5">
                        <div className="text-white font-sans font-semibold">{item.nmskpd}</div>
                        <div className="text-[9px] text-slate-400">{item.kdskpd}</div>
                      </td>
                      <td className="p-2.5">
                        <div className="text-white font-sans">{item.nmsubunit}</div>
                        <div className="text-[9px] text-slate-400">{item.kdsubunit}</div>
                      </td>
                      <td className="p-2.5">
                        <div className="text-white font-sans">{item.nmsubgiat}</div>
                        <div className="text-[9px] text-slate-400">{item.kdsubgiat}</div>
                      </td>
                      <td className="p-2.5">
                        <div className="text-cyan-300 font-sans font-medium">{item.nmrek}</div>
                        <div className="text-[9px] text-slate-400">{item.kdrek}</div>
                      </td>
                      <td className="p-2.5 font-sans font-semibold text-white">{item.usulan}</td>
                      {/* FITUR 3: KETERANGAN DIPERLEBAR */}
                      <td className="p-2.5 text-slate-300 font-sans min-w-[280px] whitespace-pre-wrap break-words">
                        {item.keterangan || '-'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-sans font-bold ${
                          item.setuju === 'Disetujui' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {item.setuju}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-amber-300 font-mono">
                        {Number(item.jumlah || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}