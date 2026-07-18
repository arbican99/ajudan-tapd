import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Sesuaikan dengan jalur file konfigurasi Supabase Anda
import * as XLSX from 'xlsx';
import { 
  Building2, 
  FolderOpen, 
  ChevronDown, 
  ChevronRight, 
  Upload, 
  RefreshCw, 
  Trash2, 
  Edit3 
} from 'lucide-react';

export default function ModulRka() {
  // States untuk Data dan Loading
  const [rkaData, setRkaData] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]); // Diambil dinamis dari tblstatus
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  // States untuk Filter Utama
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('APBD');
  const [searchQuery, setSearchQuery] = useState('');

  // States untuk Pengendalian Treeview Accordion
  const [expandedSkpd, setExpandedSkpd] = useState({});
  const [expandedSubunit, setExpandedSubunit] = useState({});
  const [expandedSubgiat, setExpandedSubgiat] = useState({});

  // States untuk Modal Edit Singkat (Opsional)
  const [editingItem, setEditingItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Load awal: ambil daftar status dan data RKA
  useEffect(() => {
    fetchStatusOptions();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedStatusFilter]);

  // Fungsi mengambil master data tahapan anggaran dari tblstatus
  const fetchStatusOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('tblstatus')
        .select('kd_status, status')
        .order('kd_status', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setStatusOptions(data);
        // Default filter diarahkan ke teks status pertama jika ada
        const defaultStatus = data.find(s => s.kd_status === '001')?.status || data[0].status;
        setSelectedStatusFilter(defaultStatus);
      }
    } catch (err) {
      console.error('Gagal mengambil opsi status:', err.message);
    }
  };

  // PERBAIKAN: Fungsi mengambil data RKA massal menggunakan teknik Chunking/Pagination (Bypass Limit 1000 Supabase)
  const fetchData = async () => {
    setLoading(true);
    try {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const fromRange = page * pageSize;
        const toRange = fromRange + pageSize - 1;

        const { data, error } = await supabase
          .from('rka')
          .select('*')
          .eq('status', selectedStatusFilter)
          .order('kdskpd', { ascending: true })
          .order('kdsubunit', { ascending: true })
          .order('kdsubgiat', { ascending: true })
          .order('kdrek', { ascending: true })
          .range(fromRange, toRange);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      setRkaData(allData);
    } catch (err) {
      alert('Gagal mengambil data RKA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi Helper untuk membersihkan format angka pagu/jumlah dari excel
  const parsePaguKeAngka = (val) => {
    if (!val) return 0;
    let clean = String(val).replace(/[^0-9,-]/g, '');
    if (clean.includes(',')) {
      clean = clean.split(',')[0]; 
    }
    const num = parseInt(clean, 10);
    return isNaN(num) ? 0 : num;
  };

  // FUNGSI UTAMA: PROSES IMPORT EXCEL BERBASIS TBLSTATUS
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellNF: true, cellText: true });
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });

        if (rawData.length === 0) {
          alert('File Excel kosong.');
          setLoading(false);
          return;
        }

        // 1. Ambil data master status terupdate dari tblstatus di database
        const { data: dbStatusList, error: statusError } = await supabase
          .from('tblstatus')
          .select('kd_status, status');

        if (statusError) throw new Error('Gagal mengambil master data status: ' + statusError.message);

        // 2. Ambil nilai kolom 'status' dari baris pertama file Excel yang diunggah
        const firstRow = rawData[0];
        const statusKeyInExcel = Object.keys(firstRow).find(k => k.trim().toLowerCase() === 'status');
        
        if (!statusKeyInExcel) {
          alert('Format Excel tidak valid: Kolom "status" tidak ditemukan.');
          setLoading(false);
          return;
        }

        const rawStatusValue = String(firstRow[statusKeyInExcel]).trim().toUpperCase();

        // 3. Cocokkan isi nilai Excel dengan data master di tblstatus (Case & Space Insensitive)
        const matchedStatus = dbStatusList.find(s => {
          const dbStatusClean = s.status.trim().toUpperCase().replace(/[\s_-]+/g, '');
          const excelStatusClean = rawStatusValue.replace(/[\s_-]+/g, '');
          return dbStatusClean === excelStatusClean;
        });

        let statusKunci = '';
        let kdStatusKunci = '';

        if (matchedStatus) {
          statusKunci = matchedStatus.status;      // Ambil string nama resmi dari DB
          kdStatusKunci = matchedStatus.kd_status;  // Ambil kode resmi dari DB
        } else {
          alert(
            `Gagal Import: Tahapan "${rawStatusValue}" pada file Excel ini belum terdaftar di tabel master (tblstatus) Supabase.\n\n` +
            `Silakan tambahkan data tahapan baru tersebut ke database terlebih dahulu.`
          );
          setLoading(false);
          return;
        }

        const dataToInsert = [];

        // Looping pemrosesan data baris per baris
        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          const getValClean = (keys) => {
            const foundKey = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
            return foundKey ? String(row[foundKey]).trim().replace(/\s+/g, ' ') : '';
          };
          const getNumAsText = (keys) => {
            const foundKey = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
            if (!foundKey) return '0';
            let val = row[foundKey];
            return (val === undefined || val === null || val === '') ? '0' : String(val).trim();
          };

          let kdskpd = getValClean(['kdskpd', 'kd_skpd', 'kode_skpd']);
          let rawKdSubunit = getValClean(['kdsubunit', 'kd_sub_unit', 'kode_subunit']);
          let kdsubgiat = getValClean(['kdsubgiat', 'kd_sub_giat', 'kd_sub_kegiatan']);
          let kdrek = getValClean(['kdrek', 'kd_rekening', 'kode_rekening']);

          // Bersihkan sisa format eksponensial bawaan pembacaan xlsx (.0)
          if (/^\d+\.0$/.test(kdskpd)) kdskpd = kdskpd.replace('.0', '');
          if (/^\d+\.0$/.test(rawKdSubunit)) rawKdSubunit = rawKdSubunit.replace('.0', '');
          if (/^\d+\.0$/.test(kdsubgiat)) kdsubgiat = kdsubgiat.replace('.0', '');
          if (/^\d+\.0$/.test(kdrek)) kdrek = kdrek.replace('.0', '');

          // Skip baris kosong yang tidak punya kode inti
          if (!kdskpd || !kdsubgiat || !kdrek) continue;

          const jmlText = getNumAsText(['jml', 'jumlah', 'pagu', 'nilai']);
          const nmskpdClean = getValClean(['nmskpd', 'nm_skpd', 'nama_skpd']).toUpperCase();
          const rawNmSubunit = getValClean(['nmsubunit', 'nm_sub_unit', 'nama_subunit']).toUpperCase();
          
          const tahunKunci = getValClean(['tahun', 'thn']) || '2026';
          const kdsdanaKunci = getValClean(['kdsdana', 'kd_sumber_dana']) || '0';
          
          // Pengaman Subunit: Bila sub kosong, arahkan otomatis ke kode induk SKPD
          const subunitKunci = rawKdSubunit ? rawKdSubunit : kdskpd;
          const nmSubunitKunci = rawNmSubunit ? rawNmSubunit : nmskpdClean;

          dataToInsert.push({
            tahun: tahunKunci,
            status: statusKunci,       
            kdstatus: kdStatusKunci, 
            kdurus: getValClean(['kdurus', 'kd_urus']),
            nmurus: getValClean(['nmurus', 'nm_urus']),
            kdskpd: kdskpd, 
            nmskpd: nmskpdClean,
            kdsubunit: subunitKunci, 
            nmsubunit: nmSubunitKunci,
            kdbidurus: getValClean(['kdbidurus', 'kd_bidang']),
            nmbidurus: getValClean(['nmbidurus', 'nm_bidang']),
            kdprog: getValClean(['kdprog', 'kd_program']),
            nmprog: getValClean(['nmprog', 'nm_program']),
            kdgiat: getValClean(['kdgiat', 'kd_kegiatan']),
            nmgiat: getValClean(['nmgiat', 'nm_kegiatan']),
            kdsubgiat: kdsubgiat, 
            nmsubgiat: getValClean(['nmsubgiat', 'nm_subgiat', 'nama_subgiat']),
            kdrek: kdrek, 
            nmrek: getValClean(['nmrek', 'nm_rekening']),
            kdsdana: kdsdanaKunci,
            nmsdana: getValClean(['nmsdana', 'nm_sumber_dana']),
            jml: parsePaguKeAngka(jmlText)
          });
        }

        if (dataToInsert.length === 0) {
          alert('Tidak ada rincian data RKA yang valid di dalam file.');
          setLoading(false);
          return;
        }

        // Tampilkan konfirmasi transparan berbasis data tblstatus asli kepada user
        const konfirmasi = window.confirm(
          `Sistem mencocokkan data sebagai tahapan resmi: "${statusKunci}" (Kode: ${kdStatusKunci}).\n\n` +
          `Aksi ini akan menghapus data lama dengan kode status "${kdStatusKunci}" di database, kemudian menggantinya dengan ${dataToInsert.length} baris baru.\n\n` +
          `Apakah Anda yakin?`
        );

        if (!konfirmasi) {
          setLoading(false);
          return;
        }

        // Bersihkan data lama pada kode status target (Anti-409 Unique Constraint)
        const { error: deleteError } = await supabase
          .from('rka')
          .delete()
          .eq('kdstatus', kdStatusKunci);

        if (deleteError) throw deleteError;

        // PERBAIKAN: Proses Bulk Insert dalam pecahan chunk maksimal 500 baris per eksekusi untuk menghindari batas payload API Supabase
        const chunkSize = 500;
        for (let i = 0; i < dataToInsert.length; i += chunkSize) {
          const chunk = dataToInsert.slice(i, i + chunkSize);
          const { error: insertError } = await supabase.from('rka').insert(chunk);
          if (insertError) throw insertError;
        }
        
        alert(`Sukses Sinkronisasi! Berhasil memuat ${dataToInsert.length} data ke tahapan "${statusKunci}".`);
        setSelectedStatusFilter(statusKunci);
        fetchData();
      } catch (err) {
        console.error("DETAIL ERROR IMPORT:", err);
        alert('Proses Sinkronisasi Gagal: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Fungsi hapus data per tahapan aktif secara menyeluruh
  const handleWipeStatusData = async () => {
    const konfirmasi = window.confirm(`PERINGATAN UTAMA: Apakah Anda ingin mengosongkan seluruh data pada tahapan "${selectedStatusFilter}"? Tindakan ini permanen.`);
    if (!konfirmasi) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('rka')
        .delete()
        .eq('status', selectedStatusFilter);

      if (error) throw error;
      alert(`Seluruh rincian data tahapan "${selectedStatusFilter}" berhasil dibersihkan.`);
      fetchData();
    } catch (err) {
      alert('Gagal membersihkan data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi hapus satu baris data rekening tertentu
  const handleDeleteRow = async (item) => {
    if (!window.confirm(`Hapus baris rekening ${item.kdrek} dengan nilai Rp ${item.jml.toLocaleString('id-ID')}?`)) return;
    try {
      const { error } = await supabase
        .from('rka')
        .delete()
        .eq('id', item.id); // Asumsi tabel rka memiliki primary key bernama 'id'

      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('Gagal menghapus baris: ' + err.message);
    }
  };

  // Handlers Toggle Treeview Accordion Expansion
  const toggleSkpd = (key) => setExpandedSkpd(p => ({ ...p, [key]: !p[key] }));
  const toggleSubunit = (key) => setExpandedSubunit(p => ({ ...p, [key]: !p[key] }));
  const toggleSubgiat = (key) => setExpandedSubgiat(p => ({ ...p, [key]: !p[key] }));

  // Pencarian filter lokal (client-side)
  const finalFilteredData = rkaData.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.kdskpd && item.kdskpd.toLowerCase().includes(query)) ||
      (item.nmskpd && item.nmskpd.toLowerCase().includes(query)) ||
      (item.kdsubunit && item.kdsubunit.toLowerCase().includes(query)) ||
      (item.nmsubunit && item.nmsubunit.toLowerCase().includes(query)) ||
      (item.kdsubgiat && item.kdsubgiat.toLowerCase().includes(query)) ||
      (item.nmsubgiat && item.nmsubgiat.toLowerCase().includes(query)) ||
      (item.kdrek && item.kdrek.toLowerCase().includes(query)) ||
      (item.nmrek && item.nmrek.toLowerCase().includes(query))
    );
  });

  // PERBAIKAN LOGIKA POHON BERJENJANG (Menghindari percampuran objek bypass antar SKPD)
  const groupedData = finalFilteredData.reduce((acc, item) => {
    const nmSkpdUpper = item.nmskpd ? item.nmskpd.trim().toUpperCase() : 'TANPA SKPD';
    const keySkpd = `${item.kdskpd} - ${nmSkpdUpper}`;
    
    // Cek apakah SKPD ini merupakan Dinas Kesehatan
    const isDinkes = nmSkpdUpper.includes("DINAS KESEHATAN");

    let keySubunit = "";
    if (isDinkes) {
      let subunitSeksi = item.kdsubunit ? item.kdsubunit.trim() : item.kdskpd;
      let nmSubunitSeksi = item.nmsubunit ? item.nmsubunit.trim().toUpperCase() : item.nmskpd;

      if (subunitSeksi === item.kdskpd) {
        subunitSeksi = item.kdskpd;
        nmSubunitSeksi = "DINAS KESEHATAN (INDUK)";
      }
      keySubunit = `${subunitSeksi} - ${nmSubunitSeksi}`;
    } else {
      // PERBAIKAN: Berikan key bypass yang unik berlandaskan kode SKPD masing-masing agar tidak saling bertumpuk satu sama lain
      keySubunit = `BYPASS_SUBUNIT_${item.kdskpd}`;
    }

    const keySubgiat = `${item.kdsubgiat} - ${item.nmsubgiat ? item.nmsubgiat.trim().toUpperCase() : 'TANPA SUB-KEGIATAN'}`;

    if (!acc[keySkpd]) acc[keySkpd] = {};
    if (!acc[keySkpd][keySubunit]) acc[keySkpd][keySubunit] = {};
    if (!acc[keySkpd][keySubunit][keySubgiat]) acc[keySkpd][keySubunit][keySubgiat] = [];
    
    acc[keySkpd][keySubunit][keySubgiat].push(item);
    return acc;
  }, {});

  const totalPaguAktif = finalFilteredData.reduce((sum, item) => sum + (Number(item.jml) || 0), 0);

  // Fungsi helper render Sub-Kegiatan & Rekening Belanja untuk menghindari redundansi kode JSX
  const renderSubgiatDanRekening = (subgiatsMap, paddingSubgiatClass, paddingRekeningClass) => {
    return Object.keys(subgiatsMap).map((subgiatKey) => {
      const listItems = subgiatsMap[subgiatKey];
      const isSubgiatExp = expandedSubgiat[subgiatKey];
      let totalPaguSubgiat = listItems.reduce((s, i) => s + (Number(i.jml) || 0), 0);

      return (
        <React.Fragment key={subgiatKey}>
          <tr onClick={() => toggleSubgiat(subgiatKey)} className="text-cyan-400 cursor-pointer bg-slate-950/60 border-b border-slate-900/20 hover:bg-slate-900/10 transition duration-150 select-none">
            <td className={`py-2 ${paddingSubgiatClass} flex items-center gap-1.5 font-medium`}>
              {isSubgiatExp ? <ChevronDown size={12} className="text-slate-600" /> : <ChevronRight size={12} className="text-slate-600" />} 
              <span>{subgiatKey}</span>
            </td>
            <td></td>
            <td className="py-2 px-4 text-right font-mono text-cyan-500/80">{totalPaguSubgiat.toLocaleString('id-ID')}</td>
            <td></td>
          </tr>
          
          {/* EXPAND LEVEL 4: DAFTAR REKENING BELANJA */}
          {isSubgiatExp && listItems.map((item, idx) => (
            <tr key={`${idx}-${item.kdrek}-${item.jml}`} className="text-slate-300 bg-slate-950 border-b border-slate-900/10 hover:bg-slate-900/5 transition duration-100 group">
              <td className={`py-1.5 ${paddingRekeningClass} pr-4 font-mono text-[10.5px] leading-relaxed text-slate-400`}>
                <span className="text-slate-500 font-semibold mr-1.5">{item.kdrek}</span> {item.nmrek}
              </td>
              <td className="py-1.5 px-4 text-slate-400 text-[10px] font-medium tracking-wide">
                {item.nmsdana ? item.nmsdana.toUpperCase() : '-'}
              </td>
              <td className="py-1.5 px-4 text-right font-mono text-slate-100 font-semibold">
                {item.jml.toLocaleString('id-ID')}
              </td>
              <td className="py-1.5 px-4 text-center">
                <div className="flex items-center justify-center gap-2 opacity-40 group-hover:opacity-100 transition duration-150">
                  <button 
                    onClick={() => { setEditingItem(item); setIsEditModalOpen(true); }}
                    className="p-1 text-slate-400 hover:text-teal-400 transition" 
                    title="Edit Item"
                  >
                    <Edit3 size={11} />
                  </button>
                  <button 
                    onClick={() => handleDeleteRow(item)}
                    className="p-1 text-slate-400 hover:text-red-400 transition" 
                    title="Hapus Item"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="text-slate-100 text-xs p-6 bg-slate-950 min-h-screen font-sans">
      
      {/* SECTION HEADER ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5 mb-5">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="text-teal-400" size={20} /> Master Dokumen RKA SKPD
          </h1>
          <p className="text-slate-400 text-[11px] mt-0.5">Sistem Pengelola Keuangan Daerah | Sinkronisasi Terkunci 100% Aman Sesuai Aturan SIPD.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition" title="Refresh Data">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          
          <label className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg cursor-pointer transition shadow-lg shadow-teal-950/20">
            <Upload size={14} />
            <span>IMPORT EXCEL</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} className="hidden" />
          </label>

          <button onClick={handleWipeStatusData} className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-400 font-medium rounded-lg transition">
            Bersihkan
          </button>
        </div>
      </div>

      {/* COMPONENT BAR DATA FILTER & PAGU TOTAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Tahapan Anggaran Aktif</label>
          <select 
            value={selectedStatusFilter} 
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:border-teal-500 font-medium cursor-pointer"
          >
            {statusOptions.map((opt) => (
              <option key={opt.kd_status} value={opt.status}>{opt.status.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Pencarian Global</label>
          <input 
            type="text"
            placeholder="Cari Kode/Nama SKPD, Subunit Puskesmas, Sub-Kegiatan, atau Uraian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-center">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Anggaran</span>
          <span className="text-base font-mono font-bold text-teal-400 mt-0.5">Rp {totalPaguAktif.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {/* CORE SYSTEM ACCORDION TREEVIEW TABLE */}
      {Object.keys(groupedData).length === 0 ? (
        <div className="py-16 text-center text-slate-500 border border-dashed border-slate-900 bg-slate-900/10 rounded-xl font-mono">
          [ Sistem RKA: Tidak Ada Record Rincian Belanja yang Ditemukan ]
        </div>
      ) : (
        <div className="border border-slate-900 bg-slate-950 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-mono tracking-wider select-none">
                <th className="py-2.5 px-4 w-[55%]">STRUKTUR RKA (SKPD / SUBUNIT / SUB-KEGIATAN / REKENING)</th>
                <th className="py-2.5 px-4 w-[20%]">SUMBER DANA</th>
                <th className="py-2.5 px-4 w-[15%] text-right">PAGU ANGGARAN (RP)</th>
                <th className="py-2.5 px-4 w-[10%] text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="text-[11px] divide-y divide-slate-900/20">
              {Object.keys(groupedData).map((skpdKey) => {
                const subunitsMap = groupedData[skpdKey];
                const isSkpdExp = expandedSkpd[skpdKey];
                
                // Cek apakah SKPD saat ini adalah Dinas Kesehatan
                const isDinkes = skpdKey.toUpperCase().includes("DINAS KESEHATAN");

                // Kalkulasi total pagu SKPD
                let totalPaguSkpd = 0;
                Object.values(subunitsMap).forEach(subgiatMap => {
                  Object.values(subgiatMap).forEach(arr => {
                    arr.forEach(i => totalPaguSkpd += (Number(i.jml) || 0));
                  });
                });

                // PERBAIKAN KEY: Dapatkan nama bypass yang spesifik untuk baris ini
                const bypassKey = `BYPASS_SUBUNIT_${skpdKey.split(' - ')[0]}`;

                return (
                  <React.Fragment key={skpdKey}>
                    {/* LEVEL 1: SKPD INDUK */}
                    <tr onClick={() => toggleSkpd(skpdKey)} className="bg-slate-900/40 border-b border-slate-900 hover:bg-slate-900 cursor-pointer font-bold text-amber-400 select-none transition duration-150">
                      <td className="py-2.5 px-4 flex items-center gap-2">
                        {isSkpdExp ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />} 
                        <Building2 size={13} className="text-amber-500" /> 
                        <span>{skpdKey}</span>
                      </td>
                      <td></td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-200">{totalPaguSkpd.toLocaleString('id-ID')}</td>
                      <td></td>
                    </tr>
                    
                    {/* CONDITIONAL RENDERING BERDASARKAN JENIS SKPD */}
                    {isSkpdExp && (
                      isDinkes ? (
                        // JIKA DINAS KESEHATAN -> TAMPILKAN LEVEL SUBUNIT
                        Object.keys(subunitsMap).map((subKey) => {
                          const subgiatsMap = subunitsMap[subKey];
                          const isSubExp = expandedSubunit[subKey];
                          
                          let totalPaguSubunit = 0;
                          Object.values(subgiatsMap).forEach(arr => arr.forEach(i => totalPaguSubunit += (Number(i.jml) || 0)));

                          return (
                            <React.Fragment key={subKey}>
                              {/* LEVEL 2: SUBUNIT */}
                              <tr onClick={() => toggleSubunit(subKey)} className="bg-slate-900/10 text-teal-400 cursor-pointer font-semibold border-b border-slate-900/30 hover:bg-slate-900/20 transition duration-150 select-none">
                                <td className="py-2 px-7 flex items-center gap-2">
                                  {isSubExp ? <ChevronDown size={13} className="text-slate-600" /> : <ChevronRight size={13} className="text-slate-600" />} 
                                  <FolderOpen size={12} className="text-teal-400" /> 
                                  <span>{subKey}</span>
                                </td>
                                <td></td>
                                <td className="py-2 px-4 text-right font-mono text-teal-400/90">{totalPaguSubunit.toLocaleString('id-ID')}</td>
                                <td></td>
                              </tr>

                              {/* LEVEL 3 & 4 (Di dalam Subunit Dinkes) */}
                              {isSubExp && renderSubgiatDanRekening(subgiatsMap, "px-12", "pl-20 pr-4")}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        // JIKA BUKAN DINAS KESEHATAN -> BYPASS SUBUNIT LANGSUNG KE SUB-KEGIATAN
                        subunitsMap[bypassKey] && renderSubgiatDanRekening(subunitsMap[bypassKey], "px-7", "pl-14 pr-4")
                      )
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DETACHED MODAL EDIT ANGGARAN (OPSIONAL) */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Edit3 size={14} className="text-teal-400" /> Penyesuaian Anggaran Pagu
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-4 leading-relaxed">{editingItem.kdrek} - {editingItem.nmrek}</p>
            
            <div className="mb-4">
              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wide">Nilai Anggaran Baru (Rp)</label>
              <input 
                type="number"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 font-mono text-teal-400 focus:outline-none focus:border-teal-500"
                value={editingItem.jml}
                onChange={(e) => setEditingItem({ ...editingItem, jml: Number(e.target.value) })}
              />
            </div>

            <div className="flex justify-end gap-2 text-[11px]">
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Batal
              </button>
              <button 
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('rka')
                      .update({ jml: editingItem.jml })
                      .eq('id', editingItem.id);
                    if (error) throw error;
                    setIsEditModalOpen(false);
                    fetchData();
                  } catch (err) {
                    alert('Gagal mengupdate pagu: ' + err.message);
                  }
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}