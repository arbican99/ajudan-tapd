import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Search, 
  RefreshCw, 
  Trash2, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit3,
  Check,
  X,
  FolderOpen,
  Type
} from 'lucide-react';
import { supabase } from '../supabaseClient'; // Sesuaikan dengan jalur file supabaseClient Anda
import * as XLSX from 'xlsx';

export default function ModulTematik() {
  // ─── STATE MANAGEMENT ───
  const [dataTematik, setDataTematik] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State untuk daftar kategori unik (untuk isi dropdown / combo box)
  const [listKategori, setListKategori] = useState([]);
  // Mode input kategori baru (true = input teks manual, false = select/combo box dropdown)
  const [isNewCategoryMode, setIsNewCategoryMode] = useState(false);

  // State Treeview: Default tertutup rapi di awal
  const [expandedCategories, setExpandedCategories] = useState({});

  // State Form Tambah Data Baru Manual
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRow, setNewRow] = useState({ katagori: '', kode: '', kdsubgiat: '', nmsubgiat: '' });

  // State Form Edit/Update Per Baris
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({ katagori: '', kode: '', kdsubgiat: '', nmsubgiat: '' });

  useEffect(() => {
    fetchData();
  }, []);

  // ─── 1. READ DATA FROM SUPABASE ───
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tblmds')
        .select('*')
        .order('katagori', { ascending: true })
        .order('kdsubgiat', { ascending: true });

      if (error) throw error;
      
      const secureData = data || [];
      setDataTematik(secureData);
      
      // Ambil daftar unik kategori dari tabel tblmds untuk isi combo box
      const katUnik = [...new Set(secureData.map(item => item.katagori ? item.katagori.trim().toUpperCase() : ''))]
        .filter(k => k !== ''); // Buang string kosong jika ada
      setListKategori(katUnik);

    } catch (error) {
      console.error(error);
      alert('Gagal mengambil data dari Supabase: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── 2. CREATE DATA MANUAL ───
  const handleCreateRow = async (e) => {
    e.preventDefault();
    if (!newRow.katagori || !newRow.kdsubgiat || !newRow.nmsubgiat) {
      alert('Mohon isi kolom Kategori, Kode Sub-Kegiatan, dan Nama Sub-Kegiatan.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('tblmds').insert([newRow]);
      if (error) throw error;
      
      alert('Data Baru Sukses Ditambahkan!');
      setNewRow({ katagori: '', kode: '', kdsubgiat: '', nmsubgiat: '' });
      setShowAddForm(false);
      setIsNewCategoryMode(false); // Reset mode ke combo box kembali
      fetchData();
    } catch (error) {
      alert('Gagal menambah data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── 3. UPDATE DATA PER BARIS ───
  const handleUpdateRow = async (id) => {
    if (!editRow.katagori || !editRow.kdsubgiat || !editRow.nmsubgiat) {
      alert('Kolom wajib tidak boleh dikosongkan.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tblmds')
        .update(editRow)
        .eq('id', id);

      if (error) throw error;

      alert('Data Berhasil Diperbarui!');
      setEditingId(null);
      fetchData();
    } catch (error) {
      alert('Gagal memperbarui data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── 4. DELETE DATA PER BARIS ───
  const handleDeleteRow = async (id, name) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data sub-kegiatan:\n"${name}"?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('tblmds').delete().eq('id', id);
      if (error) throw error;

      alert('Data Berhasil Dihapus.');
      fetchData();
    } catch (error) {
      alert('Gagal menghapus data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── 5. BULK IMPORT VIA SPREADSHEET ───
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rawData.length === 0) {
          alert('File Excel kosong atau format tidak sesuai.');
          setLoading(false);
          return;
        }

        const formattedData = rawData.map((row) => {
          const getVal = (keys) => {
            const foundKey = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
            return foundKey ? String(row[foundKey]).trim() : '';
          };
          return {
            katagori: getVal(['katagori', 'kategori', 'jenis']).toUpperCase() || 'LAIN-LAIN',
            kode: getVal(['kode', 'kd']),
            kdsubgiat: getVal(['kdsubgiat', 'kode sub kegiatan', 'kode_sub_giat']),
            nmsubgiat: getVal(['nmsubgiat', 'nama sub kegiatan', 'nama_sub_giat'])
          };
        });

        const { error } = await supabase.from('tblmds').insert(formattedData);
        if (error) throw error;

        alert(`Berhasil mengimpor ${formattedData.length} data baru dari berkas "${file.name}"!`);
        fetchData();
      } catch (err) {
        alert('Terjadi kendala saat membaca data spreadsheet: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // ─── 6. TRUNCATE / KOSONGKAN DATA ───
  const handleClearData = async () => {
    if (!window.confirm('Peringatan! Apakah Anda yakin ingin mengosongkan seluruh isi tabel tblmds?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('tblmds').delete().neq('id', 0);
      if (error) throw error;
      alert('Seluruh data berhasil dibersihkan.');
      fetchData();
    } catch (error) {
      alert('Gagal membersihkan data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Handler Treeview Buka/Tutup
  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  // Aktivasi Mode Inline Editing
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditRow({
      katagori: item.katagori || '',
      kode: item.kode || '',
      kdsubgiat: item.kdsubgiat || '',
      nmsubgiat: item.nmsubgiat || ''
    });
  };

  // Query Real-Time Filter Pencarian
  const filteredData = dataTematik.filter(item => 
    (item.nmsubgiat && item.nmsubgiat.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.kdsubgiat && item.kdsubgiat.includes(searchTerm)) ||
    (item.katagori && item.katagori.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Grouping Engine: Kelompokkan Array Data JSON Berdasarkan Kategori
  const groupedData = filteredData.reduce((groups, item) => {
    const category = item.katagori ? item.katagori.trim().toUpperCase() : 'TANPA KATEGORI';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});

  return (
    <div className="text-slate-100">
      
      {/* ─── BARIS HEADER UTAMA ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400 flex items-center gap-2">
            <FileSpreadsheet size={24} className="text-cyan-400" />
            Kelompok Laporan Tematik
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gunakan modul ini untuk melakukan konfigurasi kode referensi urusan tematik APBD (CRUD manual & Import Excel).
          </p>
        </div>

        {/* PERBAIKAN SEJAJAR PERFECT: Menempatkan tombol IMPORT sejajar dalam satu container aksi utama */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-400 rounded-xl transition duration-200"
            title="Muat Ulang Komponen"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600 text-emerald-400 hover:text-slate-950 font-bold text-xs rounded-xl transition duration-200"
          >
            <Plus size={14} />
            BARIS BARU
          </button>

          <button
            onClick={handleClearData}
            disabled={loading || dataTematik.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 hover:border-rose-500 text-rose-400 rounded-xl text-xs font-semibold transition duration-200 disabled:opacity-30"
          >
            <Trash2 size={14} />
            Kosongkan Data
          </button>

          {/* Label Unggah Excel yang Diperkecil & Sejajar Atas */}
          <label className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-bold cursor-pointer transition duration-200 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
            <Upload size={14} />
            {loading ? 'MEMBACA...' : 'IMPORT'}
            <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={loading} className="hidden" />
          </label>
        </div>
      </div>

      {/* ─── FORM TAMBAH BARIS DATA MANUALLY (CUSTOM COLS RATIO & PENDEKATAN INPUT) ─── */}
      {showAddForm && (
        <form onSubmit={handleCreateRow} className="mb-6 p-4 bg-slate-900/90 border border-emerald-500/30 rounded-xl grid grid-cols-1 md:grid-cols-[1.5fr_0.6fr_1.2fr_3.5fr] gap-3 animate-fadeIn items-end">
          {/* 1. Kategori Grup */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Kategori Grup *</label>
              <button 
                type="button" 
                onClick={() => {
                  setIsNewCategoryMode(!isNewCategoryMode);
                  setNewRow({...newRow, katagori: ''});
                }}
                className="text-[9px] text-cyan-400 hover:underline flex items-center gap-0.5"
                title={isNewCategoryMode ? "Pilih dari grup yang ada" : "Ketik kategori baru manual"}
              >
                <Type size={10} /> {isNewCategoryMode ? "Pilih Grup" : "+ Baru"}
              </button>
            </div>
            {isNewCategoryMode ? (
              <input
                type="text" required placeholder="Ketik grup baru..."
                value={newRow.katagori} onChange={(e) => setNewRow({...newRow, katagori: e.target.value.toUpperCase()})}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-xs text-white focus:outline-none"
              />
            ) : (
              <select
                required
                value={newRow.katagori}
                onChange={(e) => setNewRow({...newRow, katagori: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-xs text-white focus:outline-none"
              >
                <option value="">-- Pilih Kategori --</option>
                {listKategori.map((kat) => (
                  <option key={kat} value={kat}>{kat}</option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Kode Tematik (Dibuat sangat sempit dan mepet) */}
          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase tracking-wider">Kode Tematik</label>
            <input
              type="text" placeholder="01"
              value={newRow.kode} onChange={(e) => setNewRow({...newRow, kode: e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-xs text-white focus:outline-none text-center font-mono"
            />
          </div>

          {/* 3. Kode Sub-Giat (Rapat di sebelah kode tematik) */}
          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase tracking-wider">Kode Sub-Giat *</label>
            <input
              type="text" required placeholder="1.01.02.2.01.0006"
              value={newRow.kdsubgiat} onChange={(e) => setNewRow({...newRow, kdsubgiat: e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-xs text-white focus:outline-none font-mono"
            />
          </div>

          {/* 4. Nama Sub-Kegiatan (Mendominasi form / super lebar) */}
          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase tracking-wider">Nomenklatur Nama Sub-Kegiatan Anggaran *</label>
            <div className="flex gap-2">
              <input
                type="text" required placeholder="Masukkan nama/nomenklatur urusan sub kegiatan secara lengkap..."
                value={newRow.nmsubgiat} onChange={(e) => setNewRow({...newRow, nmsubgiat: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg p-2 text-xs text-white focus:outline-none"
              />
              <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg hover:bg-emerald-500 transition whitespace-nowrap">
                SIMPAN
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ─── CONTAINER FILTER INPUT PENCARIAN ─── */}
      <div className="mb-5 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500"><Search size={16} /></div>
        <input
          type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter data dinamis berdasarkan kategori, nama, atau kode sub kegiatan..."
          className="w-full bg-slate-900/60 border border-slate-800 focus:border-cyan-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none font-sans"
        />
      </div>

      {/* ─── KOMPONEN VISUAL DATA TREEVIEW ─── */}
      {loading && dataTematik.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-sm animate-pulse">Menghubungkan visual komponen treeview...</div>
      ) : Object.keys(groupedData).length === 0 ? (
        <div className="py-16 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-sm">
          <AlertTriangle size={32} className="mx-auto mb-2 text-slate-600" />
          Tidak ada data referensi yang cocok atau tabel database kosong.
        </div>
      ) : (
        <div className="border border-slate-800 bg-slate-950/40 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  <th className="py-3 px-4 w-12 text-center">STRUKTUR</th>
                  <th className="py-3 px-4 w-24 text-center">KODE TEMATIK</th>
                  <th className="py-3 px-4 w-44">KODE SUB-KEGIATAN</th>
                  <th className="py-3 px-4">NOMENKLATUR SUB-KEGIATAN TEMATIK</th>
                  <th className="py-3 px-4 w-24 text-center">AKSI CONTROL</th>
                </tr>
              </thead>
              
              <tbody className="text-xs font-sans">
                {Object.keys(groupedData).map((categoryName) => {
                  const isExpanded = expandedCategories[categoryName];
                  const childRows = groupedData[categoryName];

                  return (
                    <React.Fragment key={categoryName}>
                      {/* BARIS PARENT GRUP UTAMA (TEXT WARNA KUNING EMAS) */}
                      <tr 
                        onClick={() => toggleCategory(categoryName)}
                        className="bg-slate-900/40 border-b border-slate-900/60 hover:bg-slate-900/70 cursor-pointer transition select-none group"
                      >
                        <td colSpan={4} className="py-3 px-4 font-bold text-amber-400 font-mono tracking-wide text-xs">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown size={16} className="text-amber-500" /> : <ChevronRight size={16} className="text-slate-500 group-hover:text-amber-400" />}
                            <FolderOpen size={14} className="text-amber-500/80" />
                            <span>{categoryName}</span>
                            <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded-full font-normal">
                              {childRows.length} item
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4"></td>
                      </tr>

                      {/* BARIS ANAK DAFTAR SUB-KEGIATAN (TEXT WARNA PUTIH BERSIH) */}
                      {isExpanded && childRows.map((item, idx) => {
                        const isEditing = editingId === item.id;

                        return (
                          <tr key={item.id || idx} className="border-b border-slate-900/20 hover:bg-slate-900/20 transition text-white">
                            {/* Jalur Garis Penunjuk Cabang */}
                            <td className="py-2 px-4 text-center text-slate-500 font-mono text-[11px]">
                              └── {idx + 1}
                            </td>

                            {/* Kolom Kode Referensi Tematik */}
                            <td className="py-2 px-4 font-mono text-slate-300 text-center">
                              {isEditing ? (
                                <input
                                  type="text" value={editRow.kode}
                                  onChange={(e) => setEditRow({...editRow, kode: e.target.value})}
                                  className="w-full max-w-[60px] bg-slate-900 border border-amber-500 rounded px-1 py-0.5 text-xs text-white text-center"
                                />
                              ) : (
                                item.kode || '-'
                              )}
                            </td>

                            {/* Kolom Kode Anggaran Sub-Kegiatan */}
                            <td className="py-2 px-4 font-mono text-teal-400 font-semibold">
                              {isEditing ? (
                                <input
                                  type="text" value={editRow.kdsubgiat}
                                  onChange={(e) => setEditRow({...editRow, kdsubgiat: e.target.value})}
                                  className="w-full bg-slate-900 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-teal-300"
                                />
                              ) : (
                                item.kdsubgiat || '-'
                              )}
                            </td>

                            {/* Kolom Judul Nomenklatur Sub-Kegiatan */}
                            <td className="py-2 px-4 text-white font-medium tracking-wide">
                              {isEditing ? (
                                <div className="flex flex-col gap-1.5">
                                  <input
                                    type="text" value={editRow.nmsubgiat}
                                    onChange={(e) => setEditRow({...editRow, nmsubgiat: e.target.value})}
                                    className="w-full bg-slate-900 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-white"
                                  />
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-mono text-slate-400">PINDAH GRUP KATEGORI:</span>
                                    <input
                                      type="text" value={editRow.katagori}
                                      onChange={(e) => setEditRow({...editRow, katagori: e.target.value.toUpperCase()})}
                                      className="bg-slate-900 border border-slate-800 text-[10px] text-amber-400 font-mono uppercase px-1 rounded"
                                    />
                                  </div>
                                </div>
                              ) : (
                                item.nmsubgiat || '-'
                              )}
                            </td>

                            {/* OPERATOR CONTROL MANAGEMENT ACTION */}
                            <td className="py-2 px-4 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleUpdateRow(item.id)}
                                    className="p-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 rounded transition"
                                    title="Simpan Perubahan"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 rounded transition"
                                    title="Batalkan"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => startEdit(item)}
                                    className="p-1 text-slate-500 hover:text-amber-400 hover:bg-amber-950/20 rounded transition"
                                    title="Edit Baris Data"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRow(item.id, item.nmsubgiat)}
                                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                                    title="Hapus Baris Data"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FOOTER COUNTER INDIKATOR */}
          <div className="p-3 bg-slate-900/50 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-500">
            <div>TOTAL REFERENSI DATABASE: {dataTematik.length} BARIS</div>
            <div>JUMLAH GRUP KATEGORI AKTIF: {Object.keys(groupedData).length} SEKTOR</div>
          </div>
        </div>
      )}
    </div>
  );
}