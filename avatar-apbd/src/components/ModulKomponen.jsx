import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Edit3, Trash2, Save, FilePlus, Search, 
  ChevronDown, Layers, Calendar, AlertCircle, RefreshCw, Database, X, Check 
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function FormPerhitunganKomponen() {
  // State Utama Form Header
  const [tahun, setTahun] = useState('2025');
  const [kdkmp, setKdkmp] = useState('');
  const [ket, setKet] = useState('');
  const [mode, setMode] = useState('view'); // 'view' | 'tambah' | 'koreksi'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Master Data Komponen Unique (List kdkmp & ket)
  const [komponenList, setKomponenList] = useState([]);
  const [loadingKomponen, setLoadingKomponen] = useState(false);
  const [searchKomponen, setSearchKomponen] = useState('');

  // Master Data Rekening (Level 8)
  const [masterRekening, setMasterRekening] = useState([]);
  const [loadingRek, setLoadingRek] = useState(false);

  // Rows Data Perhitungan
  const [items, setItems] = useState([]);
  const [editingRowId, setEditingRowId] = useState(null); // Tracking ID baris yang sedang di-edit

  // Load Data awal saat pertama dimuat
  useEffect(() => {
    fetchMasterRekening();
    fetchKomponenUnique();
  }, []);

  // Fetch Master Rekening Level 8
  const fetchMasterRekening = async () => {
    setLoadingRek(true);
    try {
      const { data, error } = await supabase
        .from('mrek')
        .select('kdrek, nmrek')
        .eq('level', '8')
        .order('kdrek', { ascending: true });

      if (error) throw error;
      setMasterRekening(data || []);
    } catch (err) {
      console.error('Gagal mengambil master rekening:', err);
      setErrorMessage(`Gagal memuat master rekening level 8: ${err.message}`);
    } finally {
      setLoadingRek(false);
    }
  };

  // Fetch Data Komponen Unik (Hanya 1 Baris per kdkmp)
  const fetchKomponenUnique = async () => {
    setLoadingKomponen(true);
    try {
      const { data, error } = await supabase
        .from('komponen')
        .select('kdkmp, ket')
        .order('kdkmp', { ascending: true });

      if (error) throw error;

      // Filter unik berdasarkan kdkmp (Distinct)
      const uniqueMap = new Map();
      (data || []).forEach(item => {
        if (!uniqueMap.has(item.kdkmp)) {
          uniqueMap.set(item.kdkmp, item);
        }
      });

      setKomponenList(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error('Gagal mengambil list komponen:', err);
      setErrorMessage(`Gagal memuat list data komponen: ${err.message}`);
    } finally {
      setLoadingKomponen(false);
    }
  };

  // Handler Pilih Baris dari Tabel Komponen (Pilih kdkmp)
  const handleSelectKomponenRow = async (selected) => {
    setKdkmp(selected.kdkmp);
    setKet(selected.ket || '');
    setMode('view');
    setEditingRowId(null);
    setErrorMessage('');

    // Fetch rincian detail komponen berdasarkan kdkmp
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('komponen')
        .select('kdst, kdrek, nmrek, indeks')
        .eq('kdkmp', selected.kdkmp);

      if (error) throw error;

      const formattedItems = (data || []).map(row => ({
        id: Date.now() + Math.random(),
        kdst: row.kdst || 'awal',
        kdrek: row.kdrek || '',
        nmrek: row.nmrek || '',
        indeks: row.indeks || 0
      }));

      setItems(formattedItems);
    } catch (err) {
      console.error('Gagal memuat detail komponen:', err);
      setErrorMessage(`Gagal memuat rincian detail: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate kdkmp 5 Digit
  const generateKdkmp = async () => {
    try {
      const { data, error } = await supabase
        .from('komponen')
        .select('kdkmp')
        .order('kdkmp', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0 && data[0].kdkmp) {
        const lastCode = parseInt(data[0].kdkmp, 10);
        if (!isNaN(lastCode)) {
          nextNumber = lastCode + 1;
        }
      }

      const formattedCode = String(nextNumber).padStart(5, '0');
      setKdkmp(formattedCode);
    } catch (err) {
      console.error('Error auto increment kdkmp:', err);
      setKdkmp('00001');
    }
  };

  // Handler Tombol Tambah Baru Header
  const handleBtnTambah = async () => {
    setMode('tambah');
    setKet('');
    setErrorMessage('');
    setEditingRowId(null);
    const newRowId = Date.now();
    setItems([
      { id: newRowId, kdst: 'awal', kdrek: '', nmrek: '', indeks: '' }
    ]);
    setEditingRowId(newRowId);
    await generateKdkmp();
  };

  // Handler Tombol Koreksi
  const handleBtnKoreksi = () => {
    if (!kdkmp) {
      alert('Pilih data dari tabel komponen di atas terlebih dahulu.');
      return;
    }
    setMode('koreksi');
    setErrorMessage('');
  };

  // Handler Tombol Hapus Header
  const handleBtnHapusHeader = async () => {
    if (!kdkmp) return alert('Silakan pilih data komponen yang ingin dihapus dari tabel.');
    if (!window.confirm(`Yakin ingin menghapus seluruh data komponen dengan kode "${kdkmp}"?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('komponen')
        .delete()
        .eq('kdkmp', kdkmp);

      if (error) throw error;

      setKdkmp('');
      setKet('');
      setItems([]);
      setMode('view');
      setEditingRowId(null);
      fetchKomponenUnique();
    } catch (err) {
      setErrorMessage(`Gagal menghapus komponen: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler Penambahan Baris Baru di Tabel Detail
  const handleAddRow = () => {
    const newRowId = Date.now() + Math.random();
    const newRow = {
      id: newRowId,
      kdst: 'awal',
      kdrek: '',
      nmrek: '',
      indeks: ''
    };
    setItems(prev => [...prev, newRow]);
    setEditingRowId(newRowId); // Otomatis mengaktifkan mode edit baris baru
  };

  // Handler Hapus Baris Detail
  const handleDeleteRow = (id) => {
    if (items.length === 1) {
      alert('Tabel minimal memiliki 1 baris inputan.');
      return;
    }
    setItems(prev => prev.filter(row => row.id !== id));
    if (editingRowId === id) setEditingRowId(null);
  };

  // Handler Perubahan Data Input Kolom Detail
  const handleRowChange = (id, field, value) => {
    setItems(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  // Handler saat Rekening dipilih dari Dropdown
  const handleSelectRekening = (id, selectedRek) => {
    setItems(prev => prev.map(row => {
      if (row.id === id) {
        return {
          ...row,
          kdrek: selectedRek.kdrek,
          nmrek: selectedRek.nmrek
        };
      }
      return row;
    }));
  };

  // Handler Simpan Ke Database
  const handleSaveToDatabase = async () => {
    if (!kdkmp) return alert('Kode Komponen tidak boleh kosong.');
    if (items.length === 0) return alert('Tidak ada baris data untuk disimpan.');

    for (let i = 0; i < items.length; i++) {
      if (!items[i].kdrek) {
        alert(`Baris ke-${i + 1}: Kode Rekening belum dipilih.`);
        return;
      }
      if (items[i].indeks === '' || isNaN(parseFloat(items[i].indeks))) {
        alert(`Baris ke-${i + 1}: Indeks wajib diisi dengan angka/desimal valid.`);
        return;
      }
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const payload = items.map(item => ({
        kdkmp: kdkmp,
        ket: ket,
        kdst: item.kdst,
        kdrek: item.kdrek,
        nmrek: item.nmrek,
        indeks: parseFloat(item.indeks) || 0
      }));

      if (mode === 'koreksi' || mode === 'view') {
        await supabase.from('komponen').delete().eq('kdkmp', kdkmp);
      }

      const { error } = await supabase
        .from('komponen')
        .insert(payload);

      if (error) throw error;

      setMode('view');
      setEditingRowId(null);
      fetchKomponenUnique();
    } catch (err) {
      console.error(err);
      setErrorMessage(`Gagal menyimpan data ke database: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredKomponenList = komponenList.filter(
    item => 
      item.kdkmp?.toLowerCase().includes(searchKomponen.toLowerCase()) ||
      item.ket?.toLowerCase().includes(searchKomponen.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 font-mono text-slate-200">
      
      {/* HEADER CONTAINER / TITLE BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 mb-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-wider text-white uppercase">
                Data Perhitungan Komponen APBD
              </h1>
              <p className="text-[11px] text-slate-400 font-sans">
                Pengelolaan dan perincian indeks perhitungan komponen anggaran daerah.
              </p>
            </div>
          </div>

          {/* Opsi Kombo Tahun */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 self-start md:self-auto">
            <Calendar size={14} className="text-amber-400 shrink-0" />
            <label className="text-[11px] text-white uppercase font-semibold">Tahun APBD:</label>
            <select 
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer text-xs"
            >
              {['2025', '2026', '2027', '2028', '2029', '2030'].map(yr => (
                <option key={yr} value={yr} className="bg-slate-900 text-white">{yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ALERTS MESSAGE ERROR ONLY */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TABEL DATA KOMPONEN (PILIH DATA) - WARNA TULISAN KUNING EMAS */}
        <div className="mb-6 bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
              <Database size={14} className="text-amber-400" />
              <span>Daftar Komponen Terdaftar</span>
            </div>

            {/* Pencarian Komponen */}
            <div className="relative w-full sm:w-64">
              <Search size={12} className="absolute left-2.5 top-2.5 text-amber-500/70" />
              <input
                type="text"
                placeholder="Cari kode komponen / keterangan..."
                value={searchKomponen}
                onChange={(e) => setSearchKomponen(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1 text-amber-300 font-sans text-xs focus:outline-none focus:border-amber-500 placeholder-amber-500/50"
              />
            </div>
          </div>

          <div className="max-h-36 overflow-y-auto border border-slate-800/80 rounded-lg">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-950 text-amber-400 font-bold uppercase border-b border-slate-800 text-[10px] sticky top-0 z-10">
                <tr>
                  <th className="p-2 w-12 text-center text-amber-400">No</th>
                  <th className="p-2 w-40 text-amber-400">Kode Komponen</th>
                  <th className="p-2 text-amber-400">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {loadingKomponen ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-amber-400/60 font-sans text-xs">
                      Memuat daftar komponen...
                    </td>
                  </tr>
                ) : filteredKomponenList.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-amber-400/60 font-sans text-xs">
                      Tidak ada data komponen.
                    </td>
                  </tr>
                ) : (
                  filteredKomponenList.map((item, idx) => (
                    <tr
                      key={item.kdkmp}
                      onClick={() => handleSelectKomponenRow(item)}
                      className={`cursor-pointer transition-colors ${
                        kdkmp === item.kdkmp
                          ? 'bg-amber-500/20 border-l-4 border-l-amber-500 text-amber-300 font-bold'
                          : 'hover:bg-slate-800/60 text-amber-400'
                      }`}
                    >
                      <td className="p-2 text-center font-sans font-bold text-amber-500/80">{idx + 1}</td>
                      <td className="p-2 font-mono text-amber-300 font-bold">{item.kdkmp}</td>
                      <td className="p-2 font-sans text-amber-400">{item.ket || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOMBOL AKSI UTAMA */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            type="button"
            onClick={handleBtnTambah}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg ${
              mode === 'tambah'
                ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Plus size={14} /> TAMBAH BARU
          </button>

          <button
            type="button"
            onClick={handleBtnKoreksi}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg ${
              mode === 'koreksi'
                ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Edit3 size={14} /> KOREKSI
          </button>

          <button
            type="button"
            onClick={handleBtnHapusHeader}
            disabled={loading}
            className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 transition-all shadow-lg"
          >
            <Trash2 size={14} /> HAPUS
          </button>
        </div>

        {/* FORM INPUT HEADER (TEXTBOX BERISI TULISAN PUTIH TERANG) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs sm:text-sm uppercase font-bold text-white mb-2 tracking-wide">
              Kode Komponen
            </label>
            <input
              type="text"
              readOnly
              placeholder="Otomatis (5 Digit)"
              value={kdkmp}
              onChange={(e) => setKdkmp(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-600"
            />
            <span className="text-[10px] text-slate-400 font-sans mt-1 block">
              * Terisi otomatis urutan transaksi 5 digit (+1)
            </span>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs sm:text-sm uppercase font-bold text-white mb-2 tracking-wide">
              Keterangan Komponen
            </label>
            <input
              type="text"
              disabled={mode === 'view'}
              placeholder="Masukkan Keterangan Perhitungan Komponen APBD..."
              value={ket}
              onChange={(e) => setKet(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-sans text-xs focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 placeholder-slate-600"
            />
          </div>
        </div>
      </div>

      {/* SECTION DETAIL INPUT TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
        
        {/* TABEL ACTION HEADER */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            Rincian Indeks Rekening
          </h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-400 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <FilePlus size={13} /> DATA BARU
            </button>
          </div>
        </div>

        {/* DATA TABLE CONTAINER */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-slate-950 text-white font-bold uppercase border-b border-slate-800 text-[11px]">
              <tr>
                <th className="p-3 w-12 text-center text-white">No</th>
                <th className="p-3 w-32 text-white">Status</th>
                <th className="p-3 w-80 text-white">Kode Rekening</th>
                <th className="p-3 text-white">Nama Rekening</th>
                <th className="p-3 w-36 text-white">Indeks</th>
                <th className="p-3 w-20 text-center text-white">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500 font-sans">
                    // Pilih data pada tabel di atas atau klik "DATA BARU" untuk merincikan rekening.
                  </td>
                </tr>
              ) : (
                items.map((row, index) => {
                  const isEditing = editingRowId === row.id || mode === 'tambah' || mode === 'koreksi';

                  return (
                    <tr 
                      key={row.id} 
                      className={`transition-colors relative ${
                        isEditing ? 'bg-slate-900/90' : 'hover:bg-slate-900/50'
                      }`}
                      style={{ zIndex: items.length - index }}
                    >
                      
                      {/* NO */}
                      <td className="p-3 text-center text-white font-sans font-bold">
                        {index + 1}
                      </td>

                      {/* COMBO STATUS */}
                      <td className="p-3">
                        <select
                          disabled={!isEditing}
                          value={row.kdst}
                          onChange={(e) => handleRowChange(row.id, 'kdst', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-semibold focus:outline-none focus:border-amber-500 disabled:opacity-80 uppercase text-xs cursor-pointer"
                        >
                          <option value="awal" className="bg-slate-900 text-white">AWAL</option>
                          <option value="akhir" className="bg-slate-900 text-white">AKHIR</option>
                        </select>
                      </td>

                      {/* COMBO SEARCHABLE KODE REKENING */}
                      <td className="p-3 relative">
                        <SearchableRekeningSelect
                          disabled={!isEditing}
                          options={masterRekening}
                          value={row.kdrek}
                          loading={loadingRek}
                          onSelect={(selected) => handleSelectRekening(row.id, selected)}
                        />
                      </td>

                      {/* NAMA REKENING (OTOMATIS) */}
                      <td className="p-3 font-sans text-white">
                        <input
                          type="text"
                          readOnly
                          value={row.nmrek}
                          placeholder="Terisi otomatis..."
                          className="w-full bg-slate-900/50 border border-transparent rounded-lg p-2 text-white font-sans text-xs focus:outline-none placeholder-slate-600"
                        />
                      </td>

                      {/* INDEKS */}
                      <td className="p-3">
                        <input
                          type="number"
                          step="any"
                          disabled={!isEditing}
                          placeholder="0.00"
                          value={row.indeks}
                          onChange={(e) => handleRowChange(row.id, 'indeks', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-amber-500 disabled:opacity-80 text-right placeholder-slate-600"
                        />
                      </td>

                      {/* AKSI EDIT & HAPUS ROW */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing && mode === 'view' ? (
                            <button
                              type="button"
                              onClick={() => setEditingRowId(null)}
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
                              title="Selesai Edit Baris Ini"
                            >
                              <Check size={14} />
                            </button>
                          ) : (
                            mode === 'view' && (
                              <button
                                type="button"
                                onClick={() => setEditingRowId(row.id)}
                                className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"
                                title="Edit Baris Ini"
                              >
                                <Edit3 size={14} />
                              </button>
                            )
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            title="Hapus Baris Ini"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER ACTION: SIMPAN DATA */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={handleSaveToDatabase}
            className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                MENYIMPAN DATA...
              </>
            ) : (
              <>
                <Save size={14} />
                SIMPAN KE TABEL KOMPONEN
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
}

// ==========================================
// CUSTOM SEARCHABLE DROPDOWN REKENING
// ==========================================
function SearchableRekeningSelect({ options, value, onSelect, disabled, loading }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(
    item =>
      item.kdrek?.toLowerCase().includes(search.toLowerCase()) ||
      item.nmrek?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs flex items-center justify-between cursor-pointer ${
          disabled ? 'opacity-80 cursor-not-allowed' : 'hover:border-slate-700'
        }`}
      >
        <span className={value ? 'text-white font-bold' : 'text-slate-500'}>
          {value || 'Pilih Kode Rekening...'}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 left-0 font-sans text-xs ring-1 ring-slate-800">
          {/* Input Pencarian */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Cari Kode atau Nama Rekening..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-white font-sans text-xs focus:outline-none focus:border-amber-500 placeholder-slate-500"
            />
          </div>

          {/* List Opsi */}
          <div className="max-h-52 overflow-y-auto space-y-1">
            {loading ? (
              <div className="p-3 text-center text-slate-400 font-mono text-[10px]">
                Memuat Master Rekening Level 8...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-slate-400 font-mono text-[10px]">
                Data rekening tidak ditemukan.
              </div>
            ) : (
              filteredOptions.map((item) => (
                <div
                  key={item.kdrek}
                  onClick={() => {
                    onSelect(item);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border-b border-slate-800/40 last:border-0"
                >
                  <div className="font-mono text-white font-bold text-[11px]">{item.kdrek}</div>
                  <div className="text-slate-300 text-[10px] truncate">{item.nmrek}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}