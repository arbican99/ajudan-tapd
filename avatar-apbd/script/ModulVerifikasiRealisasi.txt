import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, CheckCircle2, UploadCloud, RefreshCw, AlertTriangle, Search, Trash2, Filter, Plus, X, ChevronDown, ChevronRight, Folder, FolderOpen, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

export default function ModulVerifikasiRealisasi({ getRowValue }) {
  // State Data Database & UI Grid
  const [realisasiList, setRealisasiList] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // State Dropdown Filter
  const [selectedTahun, setSelectedTahun] = useState('');
  const [selectedSkpd, setSelectedSkpd] = useState('');
  const [filterOptions, setFilterOptions] = useState({ tahuns: [], skpds: [] });

  // State Treeview Expand/Collapse Nodes
  const [expandedNodes, setExpandedNodes] = useState({});

  // State Modal Upload Berkas
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [realisasiFile, setRealisasiFile] = useState(null);
  const [isUploaded, setIsUploaded] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // State Deteksi Konflik & Duplikasi Data
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingData, setPendingData] = useState([]);
  const [conflictingKeys, setConflictingKeys] = useState([]);

  // Ambil data dari database saat komponen pertama kali dimuat
  useEffect(() => {
    fetchRealisasiData();
  }, []);

  const fetchRealisasiData = async () => {
    setFetching(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('data_realisasi')
        .select('*')
        .order('tahun', { ascending: false });

      if (error) throw error;
      
      const records = data || [];
      setRealisasiList(records);

      // Membuat opsi filter tahun dan SKPD secara dinamis
      const uniqueTahuns = [...new Set(records.map(item => item.tahun))].sort((a, b) => b - a);
      const uniqueSkpds = [...new Set(records.map(item => item.Nama_Skpd))].filter(Boolean).sort();

      setFilterOptions({
        tahuns: uniqueTahuns,
        skpds: uniqueSkpds
      });

    } catch (err) {
      console.error(err);
      setErrorMessage(`Gagal mengambil data realisasi: ${err.message}`);
    } finally {
      setFetching(false);
    }
  };

  // Mengatasi Error Konsol "getRowValue is not a function" dengan fallback internal aman
  const safeGetRowValue = (row, keyName) => {
    if (typeof getRowValue === 'function') {
      return getRowValue(row, keyName);
    }
    if (!row) return '';
    const targetKey = keyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const foundKey = Object.keys(row).find(k => {
      const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanKey === targetKey || cleanKey.includes(targetKey) || targetKey.includes(cleanKey);
    });
    return foundKey ? String(row[foundKey]).trim() : '';
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setRealisasiFile(e.target.files[0]);
      setErrorMessage('');
    }
  };

  // Parsing file Excel & deteksi duplikasi komposit
  const handleUploadRealisasiSubmit = async (e) => {
    e.preventDefault();
    if (!realisasiFile) return alert("Silakan pilih file Excel Realisasi terlebih dahulu.");
    setUploadLoading(true);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawData.length === 0) throw new Error("Berkas Excel Realisasi terbaca kosong.");

        const mappedData = rawData.map((row) => {
          const rawReal = safeGetRowValue(row, 'Realisasi') || '0';
          const cleanReal = parseFloat(rawReal.replace(/[^0-9.-]+/g, "")) || 0;

          const rawAnggaran = safeGetRowValue(row, 'Anggaran') || safeGetRowValue(row, 'Pagu') || '0';
          const cleanAnggaran = parseFloat(rawAnggaran.replace(/[^0-9.-]+/g, "")) || 0;

          const rawTahun = safeGetRowValue(row, 'Tahun Anggaran') || safeGetRowValue(row, 'Tahun') || '2026';

          return {
            tahun: parseInt(rawTahun.replace(/[^0-9]/g, "")) || 2026,
            Kode_Skpd: safeGetRowValue(row, 'Kode SKPD') || safeGetRowValue(row, 'Kode_Skpd'),
            Nama_Skpd: safeGetRowValue(row, 'Nama SKPD') || safeGetRowValue(row, 'Nama_skpd'),
            Kode_Subunit: safeGetRowValue(row, 'Kode Subunit') || safeGetRowValue(row, 'Kode_Subunit') || safeGetRowValue(row, 'Kode Sub Unit'),
            Nama_Subunit: safeGetRowValue(row, 'Nama Subunit') || safeGetRowValue(row, 'Nama_Subunit') || safeGetRowValue(row, 'Nama Sub Unit'),
            Kode_Subgiat: safeGetRowValue(row, 'Kode Sub Kegiatan') || safeGetRowValue(row, 'Kode_Subgiat') || safeGetRowValue(row, 'Kode Sub Giat'),
            Nama_Subgiat: safeGetRowValue(row, 'Nama Sub Kegiatan') || safeGetRowValue(row, 'Nama_Subgiat') || safeGetRowValue(row, 'Nama Sub Giat'),
            Kode_Rekening: safeGetRowValue(row, 'Kode Rekening') || safeGetRowValue(row, 'Kode_rekening'),
            Nama_Rekening: safeGetRowValue(row, 'Nama Rekening') || safeGetRowValue(row, 'Nama_rekening'),
            Anggaran: cleanAnggaran,
            Realisasi: cleanReal
          };
        }).filter(item => item.Kode_Skpd && item.Kode_Rekening);

        if (mappedData.length === 0) throw new Error("Tidak ada baris data valid untuk diimpor. Periksa nama kolom berkas.");

        const { data: existingData, error: fetchErr } = await supabase
          .from('data_realisasi')
          .select('tahun, Kode_Skpd, Kode_Subunit, Kode_Subgiat, Kode_Rekening');
        if (fetchErr) throw fetchErr;

        const existingSet = new Set(
          (existingData || []).map(d => `${d.tahun}|${d.Kode_Skpd}|${d.Kode_Subunit || ''}|${d.Kode_Subgiat}|${d.Kode_Rekening}`)
        );

        const conflicts = [];
        mappedData.forEach(item => {
          const key = `${item.tahun}|${item.Kode_Skpd}|${item.Kode_Subunit || ''}|${item.Kode_Subgiat}|${item.Kode_Rekening}`;
          if (existingSet.has(key)) {
            conflicts.push(key);
          }
        });

        if (conflicts.length > 0) {
          setPendingData(mappedData);
          setConflictingKeys([...new Set(conflicts)]);
          setShowConflictModal(true);
          setUploadLoading(false);
        } else {
          await executeInsertData(mappedData);
        }

      } catch (err) {
        console.error(err);
        setErrorMessage(err.message || 'Terjadi kesalahan sistem saat memproses berkas.');
        alert(`Gagal memproses berkas realisasi: ${err.message}`);
        setUploadLoading(false);
      }
    };
    
    reader.onerror = () => {
      setErrorMessage('Gagal membaca file fisik Excel.');
      setUploadLoading(false);
    };

    reader.readAsBinaryString(realisasiFile);
  };

  const executeInsertData = async (dataToInsert) => {
    try {
      setUploadLoading(true);
      const { error } = await supabase.from('data_realisasi').insert(dataToInsert);
      if (error) throw error;

      setRowCount(dataToInsert.length);
      setIsUploaded(true);
      fetchRealisasiData();
    } catch (err) {
      alert(`Database Error: ${err.message}`);
      setErrorMessage(err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleResolveOverwrite = async () => {
    setShowConflictModal(false);
    setUploadLoading(true);
    try {
      for (const key of conflictingKeys) {
        const [tahun, kodeSkpd, kodeSubunit, kodeSubgiat, kodeRekening] = key.split('|');
        
        let query = supabase
          .from('data_realisasi')
          .delete()
          .eq('tahun', parseInt(tahun))
          .eq('Kode_Skpd', kodeSkpd)
          .eq('Kode_Subgiat', kodeSubgiat)
          .eq('Kode_Rekening', kodeRekening);

        if (kodeSubunit) {
          query = query.eq('Kode_Subunit', kodeSubunit);
        } else {
          query = query.is('Kode_Subunit', null);
        }

        await query;
      }

      await executeInsertData(pendingData);
      alert(`Sukses Overwrite! Data lama dibersihkan dan data baru berhasil masuk.`);
    } catch (err) {
      alert(`Gagal menimpa data: ${err.message}`);
      setUploadLoading(false);
    }
  };

  const handleResolveAppend = async () => {
    setShowConflictModal(false);
    await executeInsertData(pendingData);
    alert(`Berhasil menambahkan data baru!`);
  };

  const handleDeleteItem = async (id, rekName) => {
    if (!window.confirm(`Hapus baris realisasi rekening "${rekName}"?`)) return;
    try {
      const { error } = await supabase.from('data_realisasi').delete().eq('id', id);
      if (error) throw error;
      fetchRealisasiData();
    } catch (err) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  // 🔥 BARU: Hapus data spesifik berdasarkan filter dropdown yang aktif
  const handleDeleteByFilter = async () => {
    if (!selectedTahun && !selectedSkpd) return;

    let infoPesan = "";
    if (selectedTahun && selectedSkpd) {
      infoPesan = `Tahun "${selectedTahun}" dan SKPD "${selectedSkpd}"`;
    } else if (selectedTahun) {
      infoPesan = `Tahun "${selectedTahun}" saja (Semua SKPD)`;
    } else if (selectedSkpd) {
      infoPesan = `SKPD "${selectedSkpd}" saja (Semua Tahun)`;
    }

    if (!window.confirm(`PERINGATAN!\nAnda akan menghapus data realisasi khusus untuk:\n-> ${infoPesan}\n\nApakah Anda yakin?`)) return;

    setFetching(true);
    try {
      let query = supabase.from('data_realisasi').delete();

      if (selectedTahun) {
        query = query.eq('tahun', parseInt(selectedTahun));
      }
      if (selectedSkpd) {
        query = query.eq('Nama_Skpd', selectedSkpd);
      }

      const { error } = await query;
      if (error) throw error;

      alert(`Data realisasi untuk ${infoPesan} berhasil dihapus dari database.`);
      
      // Reset filter setelah data dihapus agar antarmuka kembali segar
      if (selectedTahun) setSelectedTahun('');
      if (selectedSkpd) setSelectedSkpd('');
      
      fetchRealisasiData();
    } catch (err) {
      alert(`Gagal menghapus data terfilter: ${err.message}`);
    } finally {
      setFetching(false);
    }
  };

  const handleClearTable = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus SELURUH data realisasi di database?")) return;
    setFetching(true);
    try {
      const { error } = await supabase.from('data_realisasi').delete().neq('id', 0);
      if (error) throw error;
      
      alert("Seluruh data repositori realisasi sukses dikosongkan.");
      setSelectedTahun('');
      setSelectedSkpd('');
      fetchRealisasiData();
    } catch (err) {
      alert(`Gagal membersihkan database: ${err.message}`);
    } finally {
      setFetching(false);
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);
  };

  // LOGIKA STRUKTUR KONDISIONAL POHON YANG DISESUAIKAN MURNI
  const buildTreeData = () => {
    const baseFiltered = realisasiList.filter(item => {
      const matchTahun = selectedTahun === '' || String(item.tahun) === selectedTahun;
      const matchSkpd = selectedSkpd === '' || item.Nama_Skpd === selectedSkpd;
      return matchTahun && matchSkpd;
    });

    const tree = {};

    // Langkah 1: Kumpulkan seluruh baris data ke struktur Map
    baseFiltered.forEach(row => {
      const skpdKey = row.Kode_Skpd || 'NO_SKPD';
      
      if (searchTerm !== '') {
        const text = searchTerm.toLowerCase();
        const matchesSearch = 
          row.Nama_Rekening?.toLowerCase().includes(text) ||
          row.Kode_Rekening?.toLowerCase().includes(text) ||
          row.Nama_Subgiat?.toLowerCase().includes(text);
        
        if (!matchesSearch) return;
      }

      if (!tree[skpdKey]) {
        tree[skpdKey] = {
          type: 'skpd',
          id: skpdKey,
          kode: row.Kode_Skpd,
          nama: row.Nama_Skpd,
          anggaran: 0,
          realisasi: 0,
          rawRows: []
        };
      }
      tree[skpdKey].rawRows.push(row);
    });

    // Langkah 2: Konstruksi cabang anak secara kondisional per SKPD
    return Object.values(tree).map(skpdNode => {
      const hasAnySubunit = skpdNode.rawRows.some(row => 
        row.Kode_Subunit && 
        row.Kode_Subunit.trim() !== "" && 
        row.Kode_Subunit !== skpdNode.kode
      );

      if (hasAnySubunit) {
        const subunitMap = {};

        skpdNode.rawRows.forEach(row => {
          const subKey = (row.Kode_Subunit && row.Kode_Subunit.trim() !== "") ? row.Kode_Subunit : skpdNode.kode;
          const subNama = (row.Kode_Subunit && row.Kode_Subunit.trim() !== "") ? row.Nama_Subunit : skpdNode.nama;
          const subgiatKey = row.Kode_Subgiat || 'NO_SUBGIAT';

          if (!subunitMap[subKey]) {
            subunitMap[subKey] = {
              type: 'subunit',
              id: `${skpdNode.id}-${subKey}`,
              kode: subKey,
              nama: subNama,
              anggaran: 0,
              realisasi: 0,
              subgiatMap: {}
            };
          }

          if (!subunitMap[subKey].subgiatMap[subgiatKey]) {
            subunitMap[subKey].subgiatMap[subgiatKey] = {
              type: 'subgiat',
              id: `${skpdNode.id}-${subKey}-${subgiatKey}`,
              kode: row.Kode_Subgiat,
              nama: row.Nama_Subgiat,
              anggaran: 0,
              realisasi: 0,
              children: []
            };
          }

          subunitMap[subKey].subgiatMap[subgiatKey].children.push({
            type: 'rekening',
            id: row.id,
            nodeKode: row.Kode_Rekening,
            nodeNama: row.Nama_Rekening,
            kode: row.Kode_Rekening,
            nama: row.Nama_Rekening,
            anggaran: row.Anggaran || 0,
            realisasi: row.Realisasi || 0
          });

          subunitMap[subKey].subgiatMap[subgiatKey].anggaran += (row.Anggaran || 0);
          subunitMap[subKey].subgiatMap[subgiatKey].realisasi += (row.Realisasi || 0);
          subunitMap[subKey].anggaran += (row.Anggaran || 0);
          subunitMap[subKey].realisasi += (row.Realisasi || 0);
          skpdNode.anggaran += (row.Anggaran || 0);
          skpdNode.realisasi += (row.Realisasi || 0);
        });

        const formattedSubunits = Object.values(subunitMap).map(sub => {
          return {
            ...sub,
            children: Object.values(sub.subgiatMap)
          };
        });

        return { ...skpdNode, children: formattedSubunits };

      } else {
        const subgiatMap = {};

        skpdNode.rawRows.forEach(row => {
          const subgiatKey = row.Kode_Subgiat || 'NO_SUBGIAT';

          if (!subgiatMap[subgiatKey]) {
            subgiatMap[subgiatKey] = {
              type: 'subgiat',
              id: `${skpdNode.id}-${subgiatKey}`,
              kode: row.Kode_Subgiat,
              nama: row.Nama_Subgiat,
              anggaran: 0,
              realisasi: 0,
              children: []
            };
          }

          subgiatMap[subgiatKey].children.push({
            type: 'rekening',
            id: row.id,
            nodeKode: row.Kode_Rekening,
            nodeNama: row.Nama_Rekening,
            kode: row.Kode_Rekening,
            nama: row.Nama_Rekening,
            anggaran: row.Anggaran || 0,
            realisasi: row.Realisasi || 0
          });

          subgiatMap[subgiatKey].anggaran += (row.Anggaran || 0);
          subgiatMap[subgiatKey].realisasi += (row.Realisasi || 0);
          skpdNode.anggaran += (row.Anggaran || 0);
          skpdNode.realisasi += (row.Realisasi || 0);
        });

        return { ...skpdNode, children: Object.values(subgiatMap) };
      }
    });
  };

  const treeData = buildTreeData();

  // RECURSIVE RENDER: Pengatur indentasi berjenjang visual treeview otomatis
  const renderTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = !!expandedNodes[node.id];
      const paddingLeft = `${(depth * 20) + 12}px`;

      if (node.type === 'skpd' || node.type === 'subunit' || node.type === 'subgiat') {
        return (
          <React.Fragment key={node.id}>
            <tr className={`hover:bg-slate-900/50 border-b border-blue-950/20 ${
              node.type === 'skpd' ? 'bg-slate-900/70 font-bold text-slate-100' : 
              node.type === 'subunit' ? 'bg-slate-900/30 text-emerald-400 font-semibold' : 
              'bg-slate-950/20 text-slate-300'
            }`}>
              <td className="p-2 flex items-center gap-2 cursor-pointer select-none" style={{ paddingLeft }} onClick={() => toggleNode(node.id)}>
                {isExpanded ? <ChevronDown size={13} className="text-blue-400" /> : <ChevronRight size={13} className="text-slate-500" />}
                {node.type === 'skpd' ? (
                  <FolderOpen size={13} className="text-amber-500 shrink-0" />
                ) : node.type === 'subunit' ? (
                  <FolderOpen size={12} className="text-emerald-500 shrink-0" />
                ) : (
                  <Folder size={12} className="text-blue-500 shrink-0" />
                )}
                <span className={`${node.type === 'skpd' ? 'text-cyan-400' : node.type === 'subunit' ? 'text-emerald-400' : 'text-blue-400'} font-sans mr-1`}>
                  [{node.kode}]
                </span>
                <span className="uppercase text-[10px] tracking-wide">{node.nama}</span>
              </td>
              <td className="p-2 text-right font-sans border-r border-blue-950/10 text-emerald-400">{formatRupiah(node.anggaran)}</td>
              <td className="p-2 text-right font-sans border-r border-blue-950/10 text-cyan-400">{formatRupiah(node.realisasi)}</td>
              <td className="p-2 text-center text-slate-600">-</td>
            </tr>
            {isExpanded && node.children && renderTreeNodes(node.children, depth + 1)}
          </React.Fragment>
        );
      }

      return (
        <tr key={node.id} className="hover:bg-blue-950/20 bg-slate-950/10 border-b border-blue-950/5 text-slate-400">
          <td className="p-2 flex items-center gap-2" style={{ paddingLeft }}>
            <FileText size={11} className="text-slate-600 shrink-0" />
            <span className="text-cyan-600 font-sans mr-1">{node.kode}</span>
            <span className="uppercase text-[10px] text-slate-400 font-sans">{node.nama}</span>
          </td>
          <td className="p-2 text-right text-emerald-500/70 font-sans border-r border-blue-950/10">{formatRupiah(node.anggaran)}</td>
          <td className="p-2 text-right text-cyan-500/70 font-sans border-r border-blue-950/10">{formatRupiah(node.realisasi)}</td>
          <td className="p-2 text-center">
            <button onClick={() => handleDeleteItem(node.id, node.nama)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
              <Trash2 size={12} />
            </button>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="space-y-6 font-mono text-[11px]">
      
      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 max-w-7xl mx-auto">
          <AlertTriangle size={14} className="shrink-0" />
          <span>SYSTEM LOG: {errorMessage}</span>
        </div>
      )}

      {/* PANEL FILTER & KONTROL UTAMA */}
      <div className="bg-slate-950/40 backdrop-blur-md border border-blue-500/20 p-4 rounded-2xl max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between border-b border-blue-950/60 pb-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} /> Panel Kontrol Realisasi (Kondisional Treeview)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowUploadModal(true); setIsUploaded(false); setRealisasiFile(null); }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1 transition-all"
            >
              <Plus size={13} /> UNGHAH EXCEL
            </button>
            
            {/* 🔥 BUTTON BARU: HAPUS DATA TERFILTER */}
            <button 
              onClick={handleDeleteByFilter}
              disabled={fetching || (!selectedTahun && !selectedSkpd)}
              className="px-3 py-1.5 bg-amber-950/40 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-900/40 flex items-center gap-1 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="Aktifkan filter Tahun atau SKPD di bawah terlebih dahulu untuk menggunakan tombol ini"
            >
              <Trash2 size={13} /> HAPUS DATA TERFILTER
            </button>

            <button 
              onClick={handleClearTable} 
              disabled={fetching || realisasiList.length === 0}
              className="px-3 py-1.5 bg-red-950/40 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-900/40 flex items-center gap-1 disabled:opacity-30"
            >
              <Trash2 size={13} /> KOSONGKAN TABEL
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input 
              type="text"
              placeholder="Cari Sub Kegiatan / Rekening..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-blue-950/60 pl-8 pr-2.5 py-1.5 rounded-lg text-white outline-none focus:border-blue-500 text-[11px]"
            />
          </div>

          <select
            value={selectedTahun}
            onChange={(e) => setSelectedTahun(e.target.value)}
            className="w-full bg-slate-950 border border-blue-950/60 px-2 py-1.5 rounded-lg text-slate-300 outline-none focus:border-amber-500/50"
          >
            <option value="">[ ALL TAHUN ANGGARAN ]</option>
            {filterOptions.tahuns.map(th => <option key={th} value={th}>{th}</option>)}
          </select>

          <select
            value={selectedSkpd}
            onChange={(e) => setSelectedSkpd(e.target.value)}
            className="w-full bg-slate-950 border border-blue-950/60 px-2 py-1.5 rounded-lg text-slate-300 outline-none focus:border-amber-500/50"
          >
            <option value="">[ ALL PERANGKAT DAERAH / SKPD ]</option>
            {filterOptions.skpds.map(skpd => <option key={skpd} value={skpd}>{skpd}</option>)}
          </select>
        </div>
      </div>

      {/* CORE TREEVIEW TABLE VIEW */}
      <div className="bg-slate-950/20 border border-blue-950/60 rounded-xl overflow-hidden max-w-7xl mx-auto">
        <div className="p-3 bg-slate-950/60 border-b border-blue-950 flex items-center justify-between">
          <div className="text-slate-400 text-[10px]">
            Struktur Urusan Belanja Daerah // Subunit hanya muncul pada SKPD yang memiliki unit kerja operasional mandiri terpisah.
          </div>
          <button onClick={fetchRealisasiData} disabled={fetching} className="px-2.5 py-1 bg-slate-900 border border-blue-950 text-slate-300 rounded hover:bg-slate-800 flex items-center gap-1">
            <RefreshCw size={11} className={fetching ? "animate-spin" : ""} /> REFRESH DATA
          </button>
        </div>

        <div className="overflow-x-auto max-h-[650px]">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-slate-950 border-b border-blue-950 text-blue-400/80 uppercase text-[10px]">
              <tr>
                <th className="p-3 border-r border-blue-950/25">Struktur Berjenjang Urusan & Rekening Belanja</th>
                <th className="p-3 border-r border-blue-950/25 text-right w-44">Total Anggaran (Pagu)</th>
                <th className="p-3 border-r border-blue-950/25 text-right w-44">Total Realisasi</th>
                <th className="p-3 w-14 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-950/10 text-slate-300">
              {fetching ? (
                <tr><td colSpan="4" className="p-12 text-center text-slate-500">// MERESTRUKTURISASI KONDISIONAL BERJENJANG MULTI-TIER...</td></tr>
              ) : treeData.length === 0 ? (
                <tr><td colSpan="4" className="p-12 text-center text-slate-500">// REPOSITORI DATA REALISASI KOSONG</td></tr>
              ) : (
                renderTreeNodes(treeData)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CHOOSE EXCEL FILE */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-blue-500/40 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-950 border-b border-blue-950 flex items-center justify-between">
              <div className="text-blue-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <UploadCloud size={15} /> Upload Berkas Realisasi Excel
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-6">
              {!isUploaded ? (
                <form onSubmit={handleUploadRealisasiSubmit} className="space-y-4">
                  <div className="border-2 border-dashed border-blue-950 rounded-xl p-8 bg-slate-950/30 flex flex-col items-center justify-center gap-3 text-center">
                    <FileSpreadsheet size={32} className="text-blue-500/40" />
                    <span className="text-[11px] text-slate-400 max-w-xs break-all">
                      {realisasiFile ? realisasiFile.name : 'Pilih berkas rincian objek (.xlsx / .xls)'}
                    </span>
                    <label className="px-3 py-1.5 bg-slate-950 border border-blue-900 text-blue-400 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-slate-800">
                      PILIH BERKAS FILE
                      <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                  <button type="submit" disabled={uploadLoading || !realisasiFile} className="px-6 py-2.5 font-bold text-white text-[11px] rounded-lg w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40">
                    {uploadLoading ? <RefreshCw size={12} className="animate-spin mx-auto" /> : 'PROSES & SINKRONKAN KE DATABASE'}
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 size={16} /><span>DATA INGESTION SUCCESS</span>
                  </div>
                  <p className="text-slate-400">Sebanyak <b className="text-emerald-400">{rowCount}</b> data penyerapan realisasi berhasil disinkronkan.</p>
                  <button onClick={() => setShowUploadModal(false)} className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-lg mx-auto block">TUTUP JENDELA</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DUPLICATION DETECTED WARNING */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-amber-950/40 border-b border-amber-500/20 flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle size={16} className="animate-pulse" /> TERDETEKSI DUPLIKASI DATA
            </div>
            <div className="p-6 space-y-4 text-center">
              <p className="text-slate-300 text-[11px]">
                Sistem menemukan ada <span className="text-amber-400 font-bold">{conflictingKeys.length} kombinasi kunci rekening</span> di file Excel yang sudah terdaftar di database untuk Tahun Anggaran ini.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={handleResolveOverwrite} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-[10px] tracking-wider">
                  HAPUS & TIMPA DATA (OVERWRITE)
                </button>
                <button type="button" onClick={handleResolveAppend} className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-blue-900 text-blue-400 font-bold rounded-xl text-[10px] tracking-wider">
                  TETAP LANJUTKAN (APPEND)
                </button>
              </div>
              <button type="button" onClick={() => { setShowConflictModal(false); setPendingData([]); }} className="text-slate-600 hover:text-slate-400 text-[10px] underline block mx-auto pt-2">
                Batalkan Proses Ingestion
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}