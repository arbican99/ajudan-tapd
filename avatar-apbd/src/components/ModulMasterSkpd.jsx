import React, { useState, useEffect } from 'react';
import { HardDrive, UploadCloud, CheckCircle2, AlertTriangle, RefreshCw, Trash2, Search, PlusCircle, ArrowRight, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

export default function ModulMasterSkpd() {
  const [masterFile, setMasterFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  // State data master dari database
  const [skpdList, setSkpdList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // State untuk data yang akan diproses setelah review
  const [pendingInserts, setPendingInserts] = useState([]);
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const [comparisonList, setComparisonList] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // State untuk form input data langsung (manual)
  const [manualForm, setManualForm] = useState({
    kd_skpd: '',
    nm_skpd: '',
    kd_subunit: '',
    nm_subunit: ''
  });
  const [savingManual, setSavingManual] = useState(false);

  // Ambil data saat pertama kali dimuat
  useEffect(() => {
    fetchMasterSkpd();
  }, []);

  const fetchMasterSkpd = async () => {
    setFetching(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('tblskpd')
        .select('id, kd_skpd, nm_skpd, kd_subunit, nm_subunit')
        .order('kd_skpd', { ascending: true });

      if (error) throw error;
      setSkpdList(data || []);
    } catch (err) {
      console.error(err);
      setErrorMessage(`Gagal mengambil data master SKPD: ${err.message}`);
    } finally {
      setFetching(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setMasterFile(e.target.files[0]);
      setErrorMessage('');
      setComparisonList([]);
      setShowModal(false);
    }
  };

  const extractValue = (row, ...possibleKeys) => {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
    }
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
      const foundKey = rowKeys.find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey) return String(row[foundKey]).trim();
    }
    return '';
  };

  // Tahap 1: Membaca & Menganalisis File Excel (Deteksi Duplikasi)
  const handleUploadMasterSubmit = async (e) => {
    e.preventDefault();
    if (!masterFile) return alert("Silakan pilih file Excel Master SKPD terlebih dahulu.");
    setUploading(true);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawData.length === 0) throw new Error("Berkas Excel terbaca kosong.");

        const mappedData = rawData.map((row) => {
          return {
            kd_skpd: extractValue(row, 'Kode SKPD', 'Kode_Skpd', 'kd_skpd', 'KODE'),
            nm_skpd: extractValue(row, 'Nama SKPD', 'Nama_skpd', 'nm_skpd', 'NAMA').toUpperCase(),
            kd_subunit: extractValue(row, 'Kode Subunit', 'Kode_Subunit', 'kd_subunit', 'SUBUNIT_KODE'),
            nm_subunit: extractValue(row, 'Nama Subunit', 'Nama_Subunit', 'nm_subunit', 'SUBUNIT_NAMA').toUpperCase(),
          };
        }).filter(item => item.kd_skpd || item.nm_skpd);

        if (mappedData.length === 0) throw new Error("Tidak ada baris data yang valid untuk diimpor.");

        const inserts = [];
        const updates = [];
        const comparisons = [];

        // Bandingkan data Excel dengan database lokal state (skpdList)
        mappedData.forEach((excelRow) => {
          const existing = skpdList.find(
            (dbRow) => dbRow.kd_skpd === excelRow.kd_skpd && dbRow.kd_subunit === excelRow.kd_subunit
          );

          if (existing) {
            // Jika ada perbedaan teks nama, kumpulkan ke dalam daftar perbandingan
            if (existing.nm_skpd !== excelRow.nm_skpd || existing.nm_subunit !== excelRow.nm_subunit) {
              updates.push({ id: existing.id, ...excelRow });
              comparisons.push({
                kode_skpd: excelRow.kd_skpd,
                kode_subunit: excelRow.kd_subunit,
                db_nm_skpd: existing.nm_skpd,
                excel_nm_skpd: excelRow.nm_skpd,
                db_nm_subunit: existing.nm_subunit,
                excel_nm_subunit: excelRow.nm_subunit
              });
            }
          } else {
            inserts.push(excelRow);
          }
        });

        setPendingInserts(inserts);
        setPendingUpdates(updates);

        // Jika ditemukan data duplikat dengan nama berbeda, munculkan tabel komparasi
        if (comparisons.length > 0) {
          setComparisonList(comparisons);
          setShowModal(true);
          setUploading(false);
        } else {
          // Jika aman tanpa konflik/perubahan, langsung eksekusi insert bulk
          if (inserts.length > 0) {
            const { error } = await supabase.from('tblskpd').insert(inserts);
            if (error) throw error;
            setRowCount(inserts.length);
            setIsUploaded(true);
            alert(`Sukses! Berhasil menambahkan ${inserts.length} data baru.`);
          } else {
            alert("Semua data dalam file Excel sudah sinkron dengan database.");
          }
          fetchMasterSkpd();
          setUploading(false);
        }

      } catch (err) {
        console.error(err);
        setErrorMessage(`Gagal memproses data: ${err.message}`);
        setUploading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Gagal membaca file fisik Excel.');
      setUploading(false);
    };

    reader.readAsBinaryString(masterFile);
  };

  // Tahap 2: Eksekusi Update & Insert setelah Konfirmasi Modal
  const handleConfirmSync = async () => {
    setUploading(true);
    setErrorMessage('');
    try {
      let totalProcessed = 0;

      // 1. Jalankan proses insert data baru jika ada
      if (pendingInserts.length > 0) {
        const { error: insertErr } = await supabase.from('tblskpd').insert(pendingInserts);
        if (insertErr) throw insertErr;
        totalProcessed += pendingInserts.length;
      }

      // 2. Jalankan proses update data lama yang berubah satu-per-satu
      if (pendingUpdates.length > 0) {
        for (const item of pendingUpdates) {
          const { error: updateErr } = await supabase
            .from('tblskpd')
            .update({ nm_skpd: item.nm_skpd, nm_subunit: item.nm_subunit })
            .eq('id', item.id);
          if (updateErr) throw updateErr;
        }
        totalProcessed += pendingUpdates.length;
      }

      setRowCount(totalProcessed);
      setIsUploaded(true);
      setShowModal(false);
      setComparisonList([]);
      alert(`Sinkronisasi Berhasil! Memproses total ${totalProcessed} baris data.`);
      fetchMasterSkpd();
    } catch (err) {
      console.error(err);
      setErrorMessage(`Gagal sinkronisasi data perubahan: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.kd_skpd || !manualForm.nm_skpd) {
      return alert("Kode SKPD dan Nama SKPD wajib diisi.");
    }

    setSavingManual(true);
    try {
      const { error } = await supabase.from('tblskpd').insert([manualForm]);
      if (error) throw error;

      alert("Data SKPD Baru berhasil ditambahkan.");
      setManualForm({ kd_skpd: '', nm_skpd: '', kd_subunit: '', nm_subunit: '' });
      fetchMasterSkpd();
    } catch (err) {
      alert(`Gagal menambah data manual: ${err.message}`);
    } finally {
      setSavingManual(false);
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Hapus data SKPD "${name}"?`)) return;
    try {
      const { error } = await supabase.from('tblskpd').delete().eq('id', id);
      if (error) throw error;
      fetchMasterSkpd();
    } catch (err) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  const handleClearTable = async () => {
    if (!window.confirm("Apakah Anda yakin ingin mengosongkan semua data di tabel master SKPD?")) return;
    setFetching(true);
    try {
      const { error } = await supabase.from('tblskpd').delete().neq('id', 0);
      if (error) throw error;
      alert("Seluruh data repositori master SKPD berhasil dibersihkan.");
      fetchMasterSkpd();
    } catch (err) {
      alert(`Gagal membersihkan data: ${err.message}`);
    } finally {
      setFetching(false);
    }
  };

  const filteredSkpd = skpdList.filter(item => 
    (item.nm_skpd?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.kd_skpd?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.nm_subunit?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-mono text-[11px]">
      
      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 max-w-7xl mx-auto">
          <AlertTriangle size={14} className="shrink-0" />
          <span>ERROR COMMAND PANEL: {errorMessage}</span>
        </div>
      )}

      {/* SEGMEN PANEL MANAJEMEN DATA (2 KOLOM) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        
        {/* KOLOM A: TAMBAH DATA LANGSUNG (MANUAL) */}
        <div className="bg-slate-950/40 backdrop-blur-md border border-emerald-500/20 p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-2">
              <PlusCircle size={16} /> Entri Data SKPD Manual
            </h2>
            <p className="text-slate-500 mb-4">// Tambah record satu per satu langsung ke database</p>

            <form onSubmit={handleManualSubmit} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-slate-400 text-[10px] uppercase font-bold pl-1">Kode SKPD</label>
                <input 
                  type="text"
                  required
                  placeholder="Contoh: 1.01.0.00.0.00.01"
                  value={manualForm.kd_skpd}
                  onChange={(e) => setManualForm({...manualForm, kd_skpd: e.target.value})}
                  className="col-span-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-white placeholder-slate-700 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-slate-400 text-[10px] uppercase font-bold pl-1">Nama SKPD</label>
                <input 
                  type="text"
                  required
                  placeholder="DINAS PENDIDIKAN DAN KEBUDAYAAN"
                  value={manualForm.nm_skpd}
                  onChange={(e) => setManualForm({...manualForm, nm_skpd: e.target.value.toUpperCase()})}
                  className="col-span-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-white placeholder-slate-700 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-slate-400 text-[10px] uppercase font-bold pl-1">Kode Subunit</label>
                <input 
                  type="text"
                  placeholder="Contoh: 1.01.0.00.0.00.01.0001 (Opsional)"
                  value={manualForm.kd_subunit}
                  onChange={(e) => setManualForm({...manualForm, kd_subunit: e.target.value})}
                  className="col-span-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-white placeholder-slate-700 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <label className="text-slate-400 text-[10px] uppercase font-bold pl-1">Nama Subunit</label>
                <input 
                  type="text"
                  placeholder="SEKRETARIAT DINAS PENDIDIKAN (Opsional)"
                  value={manualForm.nm_subunit}
                  onChange={(e) => setManualForm({...manualForm, nm_subunit: e.target.value.toUpperCase()})}
                  className="col-span-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-white placeholder-slate-700 outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={savingManual}
                className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 font-bold text-white rounded-lg tracking-wider transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                {savingManual ? 'SAVING DATA ENGINE...' : 'SIMPAN DATA MANUAL'}
              </button>
            </form>
          </div>
        </div>

        {/* KOLOM B: UPLOAD FILE EXCEL BULK */}
        <div className="bg-slate-950/40 backdrop-blur-md border border-blue-500/20 p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-black text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-2">
              <HardDrive size={16} /> Bulk Upload File Excel
            </h2>
            <p className="text-slate-500 mb-4">// Unggah banyak record sekaligus menggunakan template file</p>

            {!isUploaded ? (
              <form onSubmit={handleUploadMasterSubmit} className="space-y-4">
                <div className="border-2 border-dashed border-blue-950/80 rounded-xl p-6 bg-slate-950/20 flex flex-col items-center justify-center gap-2">
                  <UploadCloud size={28} className="text-blue-500/50" />
                  <span className="text-slate-400 text-center max-w-xs break-all">
                    {masterFile ? masterFile.name : 'Pilih file Excel (.xlsx / .xls)'}
                  </span>
                  <label className="px-3 py-1.5 bg-slate-900 border border-blue-950 text-blue-400 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                    BUKA BERKAS EXCEL
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
                
                <button 
                  type="submit" 
                  disabled={uploading || !masterFile} 
                  className={`px-6 py-2.5 font-bold text-white rounded-lg tracking-wider w-full flex items-center justify-center gap-2 transition-all ${
                    uploading || !masterFile 
                      ? 'bg-blue-950/40 text-slate-500 border border-blue-950/20 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-[0_0_15px_rgba(37,99,235,0.2)]'
                  }`}
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      MENGANALISIS DATA FILE...
                    </>
                  ) : (
                    'PROSES DATA FILE EXCEL'
                  )}
                </button>
              </form>
            ) : (
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-3 text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 size={16} />
                  <span>SINKRONISASI DATABASE BERHASIL</span>
                </div>
                <p className="text-slate-400">
                  Sebanyak <b className="text-emerald-400">{rowCount}</b> baris record (Insert/Update) berhasil dieksekusi.
                </p>
                <button 
                  onClick={() => { setIsUploaded(false); setMasterFile(null); setRowCount(0); }} 
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 border border-blue-950 text-slate-400 text-[10px] font-bold rounded-lg"
                >
                  UNGHAH FILE BARU LAINNYA
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL POPUP: REVIEW DATA DUPLIKAT DAN PERBANDINGAN NAMA */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header Modal */}
            <div className="p-4 bg-amber-950/40 border-b border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <AlertTriangle size={16} />
                <span>TERDETEKSI PERUBAHAN DATA PADA KODE YANG SAMA ({comparisonList.length} Konflik Baris)</span>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Isi Tabel Perbandingan */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              <p className="text-slate-400 mb-2 leading-relaxed text-[10px]">
                // Sistem mendeteksi kode di bawah ini sudah ada, namun memiliki deskripsi teks nama yang berbeda di file Excel. 
                Data lama di database sebelah kiri akan di-<b>UPDATE</b> mengikuti data Excel sebelah kanan jika Anda melanjutkan.
              </p>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-left text-[10px]">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 text-center w-10">No</th>
                      <th className="p-2.5 w-32">Kode SKPD / Subunit</th>
                      <th className="p-2.5 bg-red-950/20 text-red-400">Nama SKPD (Saat ini di DB)</th>
                      <th className="p-2.5 w-6 text-center text-slate-600"></th>
                      <th className="p-2.5 bg-emerald-950/20 text-emerald-400">Nama SKPD (Baru dari Excel)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 bg-slate-950/20">
                    {comparisonList.map((comp, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="p-2.5 text-center text-slate-600 font-sans">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-400 space-y-0.5">
                          <div className="text-cyan-500 tracking-tight">{comp.kode_skpd}</div>
                          {comp.kode_subunit && <div className="text-blue-400 text-[9px] font-medium">{comp.kode_subunit}</div>}
                        </td>
                        
                        {/* Kolom DB Saat Ini */}
                        <td className="p-2.5 bg-red-950/10 space-y-1">
                          <div className="text-slate-200 uppercase font-semibold">{comp.db_nm_skpd}</div>
                          {comp.db_nm_subunit && <div className="text-slate-400 text-[9px] uppercase font-normal">{comp.db_nm_subunit}</div>}
                        </td>
                        
                        {/* Kolom Indikator Panah */}
                        <td className="p-2.5 text-center text-amber-500">
                          <ArrowRight size={12} className="mx-auto" />
                        </td>
                        
                        {/* Kolom Excel Baru */}
                        <td className="p-2.5 bg-emerald-950/10 space-y-1">
                          <div className={`text-emerald-300 font-semibold uppercase ${comp.db_nm_skpd !== comp.excel_nm_skpd ? 'underline decoration-amber-500/60' : ''}`}>
                            {comp.excel_nm_skpd}
                          </div>
                          {comp.excel_nm_subunit && (
                            <div className={`text-emerald-400 text-[9px] uppercase ${comp.db_nm_subunit !== comp.excel_nm_subunit ? 'underline decoration-amber-500/60' : ''}`}>
                              {comp.excel_nm_subunit}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal Action Buttons */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="text-[10px] text-slate-500">
                Ringkasan Aksi: <span className="text-emerald-400 font-bold">{pendingInserts.length} baris baru (Insert)</span> & <span className="text-amber-400 font-bold">{pendingUpdates.length} baris konflik (Update)</span>.
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  BATALKAN IMIPOR
                </button>
                <button 
                  onClick={handleConfirmSync}
                  disabled={uploading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                >
                  {uploading ? <RefreshCw size={12} className="animate-spin" /> : 'KONFIRMASI & SINKRONKAN DATA'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SEGMEN BAWAH: DATABASE GRID VIEW */}
      <div className="bg-slate-950/20 border border-blue-950/60 rounded-xl overflow-hidden shadow-xl max-w-7xl mx-auto">
        <div className="p-4 bg-slate-950/60 border-b border-blue-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide shrink-0">
              Database Referensi SKPD ({skpdList.length})
            </h3>
            
            <div className="relative w-full sm:w-64">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input 
                type="text"
                placeholder="Cari nama dinas / subunit / kode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-blue-950 px-2.5 pl-7 py-1.5 rounded text-white font-sans text-xs focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button 
              onClick={fetchMasterSkpd} 
              disabled={fetching}
              className="px-3 py-1 bg-slate-900 border border-blue-950 text-slate-300 rounded hover:bg-slate-800 flex items-center gap-1"
            >
              <RefreshCw size={11} className={fetching ? "animate-spin" : ""} /> REFRESH
            </button>
            <button 
              onClick={handleClearTable} 
              disabled={fetching || skpdList.length === 0}
              className="px-3 py-1 bg-red-950/40 border border-red-500/20 text-red-400 rounded hover:bg-red-900/40 flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 size={11} /> HAPUS DATA
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-slate-950 border-b border-blue-950 text-blue-400/80 uppercase text-[10px]">
              <tr>
                <th className="p-3 border-r border-blue-950/25 w-12 text-center">No</th>
                <th className="p-3 border-r border-blue-950/25">Kode SKPD</th>
                <th className="p-3 border-r border-blue-950/25">Nama SKPD</th>
                <th className="p-3 border-r border-blue-950/25">Kode Subunit</th>
                <th className="p-3 border-r border-blue-950/25">Nama Subunit</th>
                <th className="p-3 w-16 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-950/20 text-slate-300">
              {fetching ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">// LOADING DATA CORE NODE...</td>
                </tr>
              ) : filteredSkpd.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">// RECORD DATA REPOSITORI KOSONG</td>
                </tr>
              ) : (
                filteredSkpd.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-slate-900/40 border-b border-blue-950/10">
                    <td className="p-2.5 border-r border-blue-950/25 text-center text-slate-500 font-sans">{index + 1}</td>
                    <td className="p-2.5 border-r border-blue-950/25 text-cyan-500 font-bold tracking-tight">{item.kd_skpd}</td>
                    <td className="p-2.5 border-r border-blue-950/25 uppercase font-sans text-slate-200 text-[10px] tracking-wide">{item.nm_skpd}</td>
                    <td className="p-2.5 border-r border-blue-950/25 text-blue-400 font-medium tracking-tight">{item.kd_subunit}</td>
                    <td className="p-2.5 border-r border-blue-950/25 uppercase font-sans text-slate-400 text-[10px] tracking-wide">{item.nm_subunit}</td>
                    <td className="p-2.5 text-center">
                      <button 
                        onClick={() => handleDeleteItem(item.id, item.nm_skpd)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Hapus baris ini"
                      >
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
    </div>
  );
}