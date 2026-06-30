import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Lock, Mail, Eye, EyeOff, 
  FileSpreadsheet, ShieldAlert, Users, Plus, Trash2, Edit2, X,
  Terminal, Menu, Cpu, ChevronLeft, FileText, CheckCircle2, PieChart,
  ChevronDown, ChevronRight, Folder, Landmark, Calendar, ShieldCheck, Upload
} from 'lucide-react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';

export default function App() {
  // State Otentikasi Utama
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // State Navigasi setelah Login
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // State Minimize / Maximize Sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // State Menu Aktif
  const [activeMenu, setActiveMenu] = useState('komponen-verifikasi'); 
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', skpd: '', role: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // State File Ungguhan Komponen Verifikasi (Hanya Realisasi)
  const [realisasiFile, setRealisasiFile] = useState(null);
  const [uploadingRealisasi, setUploadingRealisasi] = useState(false);

  // State Mode Edit SKPD
  const [isEditing, setIsEditing] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  // State Dokumen RKA Dari Excel Asli
  const [rkaFile, setRkaFile] = useState(null);
  const [isRkaUploaded, setIsRkaUploaded] = useState(false);
  
  // State Informasi Header SKPD & Tahun dari Kolom Excel
  const [extractedSkpd, setExtractedSkpd] = useState({ kode: '-', nama: '-', tahun: '-' });
  
  // State Data Terstruktur Berdasarkan Kolom Spesifik User
  const [groupedRkaData, setGroupedRkaData] = useState([]);
  const [subKegiatanRows, setSubKegiatanRows] = useState([]);
  
  // State Kontrol Expand/Collapse Node Treeview Rekap & Tabel I
  const [expandedNodes, setExpandedNodes] = useState({});
  const [expandedTabel1, setExpandedTabel1] = useState({});

  const [rkaSummary, setRkaSummary] = useState({
    totalAnggaran: 0,
    mandatorySpending: 0,
    spmProgram: 0,
    treeData: {} 
  });

  // URL Cadangan Gambar Avatar/Logo
  const fallbackLogo = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60";

  useEffect(() => {
    if (isLoggedIn) {
      fetchUsers();
    }
  }, [isLoggedIn]);

  // Fungsi Helper untuk mencocokkan key Excel secara case-insensitive
  const getRowValue = (row, keyName) => {
    const targetKey = Object.keys(row).find(k => {
      const cleanTarget = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanSearch = keyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanTarget === cleanSearch;
    });
    return targetKey ? String(row[targetKey]).trim() : '';
  };

  // Fungsi Toggle Treeview Node Rekap Akun
  const toggleNode = (nodeKey) => {
    setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  // Fungsi Toggle Treeview Tabel I Matriks RKA
  const toggleTabel1Node = (subKey) => {
    setExpandedTabel1(prev => ({ ...prev, [subKey]: !prev[subKey] }));
  };

  // Fungsi Login Utama
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(`Akses Ditolak: ${error.message}`);
    } else {
      setUserEmail(data.user.email);
      setIsLoggedIn(true);
    }
    setLoading(false);
  };

  // Fungsi Logout
  const handleLogout = async () => {
    await supabase.signOut();
    setIsLoggedIn(false);
    setActiveMenu('komponen-verifikasi');
    setEmail('');
    setPassword('');
  };

  // Mengambil Daftar User SKPD dari Supabase
  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error) setUsersList(data || []);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSelectEditUser = (usr) => {
    setIsEditing(true);
    setEditUserId(usr.id);
    setNewUser({
      name: usr.nama_lengkap || '',
      email: usr.email || '',
      password: '******',
      skpd: usr.instansi_skpd || '',
      role: usr.role || ''
    });
    setSelectedFile(null); 
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditUserId(null);
    setNewUser({ name: '', email: '', password: '', skpd: '', role: '' });
    setSelectedFile(null);
  };

  // Operasi CRUD Akun SKPD
  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let avatarUrl = '';
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = publicUrlData.publicUrl;
      }

      if (isEditing) {
        const updateData = { nama_lengkap: newUser.name, instansi_skpd: newUser.skpd, role: newUser.role };
        if (avatarUrl) updateData.avatar_url = avatarUrl;
        const { error } = await supabase.from('profiles').update(updateData).eq('id', editUserId);
        if (error) throw error;
        alert('Data Operator SKPD berhasil diperbarui!');
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email: newUser.email, password: newUser.password });
        if (authError) throw authError;
        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert([
            {
              id: authData.user.id,
              email: newUser.email,
              nama_lengkap: newUser.name,
              instansi_skpd: newUser.skpd,
              role: newUser.role,
              avatar_url: avatarUrl || fallbackLogo,
            },
          ]);
          if (profileError) throw profileError;
        }
        alert('Operator SKPD baru berhasil terdaftar ke database!');
      }
      handleCancelEdit();
      fetchUsers();
    } catch (error) {
      alert(`Gagal menyimpan data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus operator ini?')) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) fetchUsers();
      else alert(`Gagal menghapus: ${error.message}`);
    }
  };

  // --- ENGINE SIMPAN DATA REALISASI (tabel: data_realisasi) ---
  const handleUploadRealisasiSubmit = async (e) => {
    e.preventDefault();
    if (!realisasiFile) return alert("Silakan pilih file realisasi terlebih dahulu.");
    setUploadingRealisasi(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawData.length === 0) throw new Error("File terbaca kosong.");

        const mappedData = rawData.map((row) => {
          const rawReal = getRowValue(row, 'Realisasi') || getRowValue(row, 'Anggaran') || '0';
          const cleanReal = parseFloat(rawReal.replace(/[^0-9.-]+/g, "")) || 0;
          const rawTahun = getRowValue(row, 'Tahun Anggaran') || getRowValue(row, 'Tahun') || '2025';

          return {
           tahun: parseInt(rawTahun.replace(/[^0-9]/g, "")) || 2026,
           Kode_Skpd: getRowValue(row, 'Kode SKPD'),
           Nama_Skpd: getRowValue(row, 'Nama SKPD'),
           Kode_Subunit: getRowValue(row, 'Kode Subunit') || getRowValue(row, 'Kode Sub Unit'),
           Nama_Subunit: getRowValue(row, 'Nama Subunit') || getRowValue(row, 'Nama Sub Unit'),
           Kode_Subgiat: getRowValue(row, 'Kode Sub Kegiatan') || getRowValue(row, 'Kode Sub Giat'),
           Nama_Subgiat: getRowValue(row, 'Nama Sub Kegiatan') || getRowValue(row, 'Nama Sub Giat'),
           Kode_Rekening: getRowValue(row, 'Kode Rekening'),
           Nama_Rekening: getRowValue(row, 'Nama Rekening'),
           Realisasi: cleanReal
          };
        });

        const { error } = await supabase.from('data_realisasi').insert(mappedData);
        if (error) throw error;

        alert(`Sukses menyimpan ${mappedData.length} baris data ke tabel data_realisasi.`);
        setRealisasiFile(null);
      } catch (err) {
        alert(`Gagal menyimpan data realisasi: ${err.message}`);
      } finally {
        setUploadingRealisasi(false);
      }
    };
    reader.readAsBinaryString(realisasiFile);
  };

  // --- PARSER ENGINE SINKRONISASI VALIDASI EXCEL RKA ---
  const handleRkaFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setRkaFile(e.target.files[0]);
    }
  };

  const handleUploadRkaSubmit = (e) => {
    e.preventDefault();
    if (!rkaFile) return alert("Silakan pilih file Excel RKA terlebih dahulu.");
    
    setUploading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rawData.length === 0) throw new Error("Berkas Excel terbaca kosong.");

        const sampleRow = rawData[0];
        const infoTahun = getRowValue(sampleRow, 'Tahun Anggaran');
        const infoKodeSkpd = getRowValue(sampleRow, 'Kode SKPD');
        const infoNamaSkpd = getRowValue(sampleRow, 'Nama SKPD');
        
        setExtractedSkpd({
          kode: infoKodeSkpd || 'Tidak Ditemukan',
          nama: infoNamaSkpd || 'Tidak Ditemukan',
          tahun: infoTahun || '2026'
        });

        let subKegiatanGrupMap = {};
        let totalAnggaran = 0;
        let mandatorySpending = 0;
        let spmProgram = 0;
        let treeStructure = {};
        let initialTabel1Toggle = {};
        let initialExpandedNodes = {};

        const jenisBelanjaDict = {
          "5.1.01": "Belanja Pegawai",
          "5.1.02": "Belanja Barang dan Jasa",
          "5.1.05": "Belanja Hibah",
          "5.1.06": "Belanja Bantuan Sosial",
          "5.2.01": "Belanja Modal Tanah",
          "5.2.02": "Belanja Modal Peralatan dan Mesin",
          "5.2.03": "Belanja Modal Gedung dan Bangunan",
          "5.2.04": "Belanja Modal Jalan, Irigasi, dan Jaringan",
          "5.2.05": "Belanja Modal Aset Tetap Lainnya",
          "5.3.01": "Belanja Tidak Terduga",
          "5.4.01": "Belanja Bagi Hasil",
          "5.4.02": "Belanja Bantuan Keuangan"
        };

        rawData.forEach((row) => {
          const kodeSubKeg = getRowValue(row, 'Kode Sub Kegiatan');
          const namaSubKeg = getRowValue(row, 'Nama Sub Kegiatan');
          const kodeRekening = getRowValue(row, 'Kode Rekening');
          const namaRekening = getRowValue(row, 'Nama Rekening');
          const anggaranRaw = getRowValue(row, 'Anggaran').replace(/[^0-9.-]+/g, "");
          
          const nilaiAnggaran = parseFloat(anggaranRaw) || 0;

          if (!kodeRekening && !kodeSubKeg) return;

          const isSpmText = namaSubKeg.toLowerCase().includes('spm') || namaRekening.toLowerCase().includes('spm');
          const isMandatoryText = namaSubKeg.toLowerCase().includes('pendidikan') || 
                                  namaSubKeg.toLowerCase().includes('kesehatan') || 
                                  namaSubKeg.toLowerCase().includes('sarana') || 
                                  namaSubKeg.toLowerCase().includes('wajib');

          if (isSpmText) {
            spmProgram += nilaiAnggaran;
          } else if (isMandatoryText) {
            mandatorySpending += nilaiAnggaran;
          }

          const groupKey = kodeSubKeg || "NON-SUB-KEG";
          if (!subKegiatanGrupMap[groupKey]) {
            subKegiatanGrupMap[groupKey] = {
              kodeSub: groupKey,
              namaSub: namaSubKeg || "RINCIAN DATA REKENING LAINNYA",
              paguSubTotal: 0,
              rincianRekening: []
            };
            initialTabel1Toggle[groupKey] = true; 
          }

          if (kodeRekening) {
            subKegiatanGrupMap[groupKey].rincianRekening.push({
              kode: kodeRekening,
              uraian: namaRekening || "(Tanpa Nama Rekening)",
              pagu: nilaiAnggaran
            });
            subKegiatanGrupMap[groupKey].paguSubTotal += nilaiAnggaran;
          }

          if (kodeRekening) {
            const parts = kodeRekening.split('.');
            if (parts.length >= 2) {
              const kelompokId = parts.slice(0, 2).join('.');
              let kelompokLabel = "Belanja Operasi";
              if (kelompokId === "5.2") kelompokLabel = "Belanja Modal";
              if (kelompokId === "5.3") kelompokLabel = "Belanja Tidak Terduga";
              if (kelompokId === "5.4") kelompokLabel = "Belanja Transfer";

              if (!treeStructure[kelompokId]) {
                treeStructure[kelompokId] = { id: kelompokId, nama: `${kelompokLabel} (${kelompokId})`, total: 0, jenis: {} };
                initialExpandedNodes[kelompokId] = true; 
              }

              const jenisId = parts.slice(0, 3).join('.');
              let jenisLabel = jenisBelanjaDict[jenisId];
              if (!jenisLabel) {
                if (kodeRekening === jenisId || kodeRekening.endsWith('.00') || kodeRekening.endsWith('.000')) {
                  jenisLabel = namaRekening;
                } else {
                  jenisLabel = `Jenis Belanja Kode ${jenisId}`;
                }
              }

              if (!treeStructure[kelompokId].jenis[jenisId]) {
                treeStructure[kelompokId].jenis[jenisId] = { id: jenisId, nama: jenisLabel, totalSub: 0 };
              } else {
                if (kodeRekening === jenisId && namaRekening) {
                  treeStructure[kelompokId].jenis[jenisId].nama = namaRekening;
                }
              }

              if (parts.length > 3 && nilaiAnggaran > 0) {
                treeStructure[kelompokId].total += nilaiAnggaran;
                treeStructure[kelompokId].jenis[jenisId].totalSub += nilaiAnggaran;
                totalAnggaran += nilaiAnggaran;
              }
            }
          }
        });

        Object.keys(treeStructure).forEach(kKey => {
          if (treeStructure[kKey].total === 0) {
            let subTotalJenis = 0;
            Object.keys(treeStructure[kKey].jenis).forEach(jKey => {
              subTotalJenis += treeStructure[kKey].jenis[jKey].totalSub;
            });
            treeStructure[kKey].total = subTotalJenis;
          }
        });

        const finalGroupedArray = Object.values(subKegiatanGrupMap);
        const finalTabel2List = finalGroupedArray.map((item, index) => {
          let kategoriSub = "Kategori Lainnya";
          if (item.namaSub.toLowerCase().includes('spm')) kategoriSub = "SPM (Standar Pelayanan Minimal)";
          else if (item.namaSub.toLowerCase().includes('pendidikan') || item.namaSub.toLowerCase().includes('kesehatan') || item.namaSub.toLowerCase().includes('sarana')) {
            kategoriSub = "Mandatory Spending";
          }
          return {
            id: `sub2-${index}`,
            namaSub: item.namaSub,
            kategori: kategoriSub,
            pagu: item.paguSubTotal
          };
        }).filter(item => item.namaSub !== "RINCIAN DATA REKENING LAINNYA");

        setGroupedRkaData(finalGroupedArray);
        setSubKegiatanRows(finalTabel2List);
        setExpandedTabel1(initialTabel1Toggle);
        setExpandedNodes(initialExpandedNodes);
        setRkaSummary({
          totalAnggaran,
          mandatorySpending,
          spmProgram,
          treeData: treeStructure
        });

        setIsRkaUploaded(true);
        alert(`Sukses sinkronisasi! Memproses ${rawData.length} baris data.`);
      } catch (err) {
        alert(`Gagal memparsing file Excel: ${err.message}`);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsBinaryString(rkaFile);
  };

  const handleResetRka = () => {
    setRkaFile(null);
    setIsRkaUploaded(false);
    setGroupedRkaData([]);
    setSubKegiatanRows([]);
    setExtractedSkpd({ kode: '-', nama: '-', tahun: '-' });
    setRkaSummary({ totalAnggaran: 0, mandatorySpending: 0, spmProgram: 0, treeData: {} });
    setExpandedNodes({});
  };

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex relative overflow-hidden select-none">
        
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none"></div>

        {/* SIDEBAR COMPACT */}
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-16'} bg-slate-950/70 backdrop-blur-xl border-r border-blue-950/60 flex flex-col justify-between relative z-20 shrink-0 transition-all duration-300 ease-in-out`}>
          <div>
            <div className={`px-3 py-5 border-b border-blue-950/40 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.25)] bg-slate-950 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src="/logo-avatar1.png" onError={(e) => { e.target.src = fallbackLogo; }} alt="Logo" className="w-full h-full object-cover" />
                </div>
                {isSidebarOpen && (
                  <div className="whitespace-nowrap">
                    <h1 className="text-[11px] font-black tracking-[0.2em] text-blue-400 font-mono drop-shadow-[0_0_5px_rgba(59,130,246,0.3)]">AVATAR APBD</h1>
                    <p className="text-[6.5px] font-mono tracking-[0.12em] text-slate-500 font-bold uppercase">OPERATIONAL CORE</p>
                  </div>
                )}
              </div>
              {isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(false)} className="p-1 bg-slate-900 border border-blue-950/80 hover:border-blue-500/30 text-slate-400 hover:text-blue-400 rounded-lg cursor-pointer">
                  <ChevronLeft size={13} />
                </button>
              )}
            </div>

            {!isSidebarOpen && (
              <div className="flex justify-center py-3 border-b border-blue-950/20">
                <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl cursor-pointer">
                  <Menu size={14} />
                </button>
              </div>
            )}

            <nav className="p-2 space-y-1 font-mono text-[11px]">
              {isSidebarOpen && <span className="block px-2 pt-2 pb-1 text-[8px] font-bold text-blue-500/40 uppercase tracking-widest">Main Services</span>}
              
              {/* MENU KOMPONEN VERIFIKASI */}
              <div 
                onClick={() => setActiveMenu('komponen-verifikasi')}
                className={`w-full px-2.5 py-2 rounded-xl flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} cursor-pointer transition-all duration-300 border-l-2 ${activeMenu === 'komponen-verifikasi' ? 'bg-blue-500/10 border-blue-400 text-blue-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'}`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={14} className="text-blue-400 shrink-0" />
                  {isSidebarOpen && <span className="truncate">Komponen Verifikasi</span>}
                </div>
              </div>

              <div 
                onClick={() => setActiveMenu('rka')}
                className={`w-full px-2.5 py-2 rounded-xl flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} cursor-pointer transition-all duration-300 border-l-2 ${activeMenu === 'rka' ? 'bg-blue-500/10 border-blue-400 text-blue-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'}`}
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet size={14} className="text-slate-500 shrink-0" />
                  {isSidebarOpen && <span className="truncate">Verifikasi RKA</span>}
                </div>
              </div>

              <div 
                onClick={() => setActiveMenu('skpd')} 
                className={`w-full px-2.5 py-2 rounded-xl flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} cursor-pointer transition-all border-l-2 ${activeMenu === 'skpd' ? 'bg-blue-500/10 border-blue-400 text-blue-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'}`}
              >
                <div className="flex items-center gap-2.5">
                  <Users size={14} className="text-slate-500 shrink-0" />
                  {isSidebarOpen && <span className="truncate">Akun SKPD</span>}
                </div>
              </div>
            </nav>
          </div>

          <div className="p-2 border-t border-blue-950/40 bg-slate-950/40 font-mono">
            <button onClick={handleLogout} className="w-full py-2 bg-slate-900 hover:bg-red-950/30 border border-blue-950/60 text-slate-400 text-[9px] font-bold rounded-xl cursor-pointer truncate">
              {isSidebarOpen ? 'DISCONNECT' : 'EXIT'}
            </button>
          </div>
        </aside>

        {/* WORKSPACE MAIN */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto relative z-10">
          <header className="w-full border-b border-blue-950/40 bg-slate-950/10 backdrop-blur-md px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2.5 font-mono">
              <Terminal size={12} className="text-blue-400" />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">WORKSPACE //</span>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">{activeMenu} panel</span>
            </div>
          </header>

          <main className="p-6 max-w-7xl w-full mx-auto flex-1">
            
            {/* INTERFACE MODUL KOMPONEN VERIFIKASI */}
            {activeMenu === 'komponen-verifikasi' && (
              <div className="space-y-6">
                <div className="bg-slate-950/40 backdrop-blur-md border border-blue-500/20 p-5 rounded-2xl">
                  <h2 className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider mb-2">
                    // MODUL ATURAN & ACUAN VERIFIKASI DATA APBD
                  </h2>
                  <p className="text-slate-400 font-sans text-xs leading-relaxed max-w-3xl">
                    Silakan unggah berkas realisasi historis daerah di bawah ini. Data realisasi akan disimpan secara terstruktur ke dalam database produksi dan dijadikan variabel pembanding otomatis saat memverifikasi berkas RKA SKPD.
                  </p>
                </div>

                <div className="max-w-xl mx-auto">
                  {/* Form Unggah Realisasi */}
                  <div className="bg-slate-950/60 border border-blue-950 p-5 rounded-2xl font-mono shadow-xl">
                    <div className="flex items-center gap-2.5 mb-4 border-b border-blue-950 pb-2">
                      <Upload size={16} className="text-cyan-400" />
                      <h3 className="text-xs font-bold text-slate-200 uppercase">Data Realisasi Historis</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans mb-4">
                      Target penyimpanan database: <b className="text-cyan-500 font-mono text-[10px]">data_realisasi</b>
                    </p>
                    <form onSubmit={handleUploadRealisasiSubmit} className="space-y-4">
                      <div className="p-6 bg-slate-950 border border-dashed border-blue-950 rounded-xl text-center">
                        <span className="block text-[11px] text-slate-300 font-bold mb-3">
                          {realisasiFile ? realisasiFile.name : 'Belum ada berkas dipilih'}
                        </span>
                        <label className="px-4 py-2 bg-slate-900 border border-blue-950 text-blue-400 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-slate-800 inline-block transition-all">
                          CARI FILE EXCEL
                          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files && setRealisasiFile(e.target.files[0])} className="hidden" />
                        </label>
                      </div>
                      <button type="submit" disabled={uploadingRealisasi} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer tracking-wider">
                        {uploadingRealisasi ? 'PROSES SIMPAN DATA...' : 'SIMPAN DATA'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL DOKUMEN RKA */}
            {activeMenu === 'rka' && (
              <div className="space-y-6">
                <div className="bg-slate-950/40 backdrop-blur-md border border-blue-500/20 p-4 rounded-2xl">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    {!isRkaUploaded ? (
                      <form onSubmit={handleUploadRkaSubmit} className="w-full flex flex-col sm:flex-row gap-3 items-center justify-center py-2 bg-slate-950/10">
                        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                          <FileText size={20} className="text-blue-500" />
                          <div>
                            <span className="block font-bold text-slate-300">{rkaFile ? rkaFile.name : 'Belum ada file terunggah'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <label className="px-3 py-1.5 bg-slate-900 border border-blue-950 text-blue-400 text-[11px] font-mono font-bold rounded-xl cursor-pointer hover:bg-slate-800 transition-all">
                            PILIH FILE
                            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleRkaFileChange} className="hidden" />
                          </label>
                          <button type="submit" disabled={uploading} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 font-mono font-bold text-white text-[11px] rounded-xl transition-all cursor-pointer">
                            {uploading ? 'PARSING...' : 'SINKRONKAN STRUKTUR'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="w-full flex items-center justify-between font-mono text-[11px]">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 size={15} />
                          <span>Berkas Sinkron: <b className="text-slate-200">{rkaFile?.name}</b></span>
                        </div>
                        <button onClick={handleResetRka} className="px-3 py-1 bg-red-950/60 border border-red-500/30 text-red-400 text-[10px] font-bold rounded-lg hover:bg-red-500 hover:text-white transition-all cursor-pointer">
                          BERSIHKAN DATA
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isRkaUploaded && (
                  <div className="bg-slate-950/80 border border-blue-950 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg font-mono">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center text-blue-300 border border-blue-500/20 shrink-0">
                        <Landmark size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[9px] font-black tracking-widest text-blue-500 uppercase">SATUAN KERJA SKPD TERPETAKAN //</span>
                        <h3 className="text-xs font-bold text-slate-100 truncate mt-0.5 uppercase tracking-wide">
                          {extractedSkpd.nama}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">
                          KODE SKPD: <span className="text-cyan-400">{extractedSkpd.kode}</span>
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-blue-950/80 flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <Calendar size={14} className="text-amber-400" />
                      <span className="text-[10px] font-bold text-slate-300">TA. {extractedSkpd.tahun}</span>
                    </div>
                  </div>
                )}

                {isRkaUploaded && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950/50 border border-blue-950 p-4 rounded-xl flex items-start gap-3.5 shadow-md">
                      <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0"><PieChart size={18} /></div>
                      <div className="font-mono">
                        <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">MANDATORY SPENDING (EST.)</span>
                        <h3 className="text-sm font-bold text-slate-200 mt-1">{formatIDR(rkaSummary.mandatorySpending)}</h3>
                      </div>
                    </div>
                    <div className="bg-slate-950/50 border border-blue-950 p-4 rounded-xl flex items-start gap-3.5 shadow-md">
                      <div className="w-9 h-9 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0"><ShieldAlert size={18} /></div>
                      <div className="font-mono">
                        <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">URUSAN PROGRAM SPM</span>
                        <h3 className="text-sm font-bold text-cyan-400 mt-1">{formatIDR(rkaSummary.spmProgram)}</h3>
                      </div>
                    </div>
                    <div className="bg-slate-950/50 border border-blue-950 p-4 rounded-xl flex items-start gap-3.5 shadow-md">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0"><FileText size={18} /></div>
                      <div className="font-mono">
                        <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">TOTAL PAGU DINAS</span>
                        <h3 className="text-sm font-bold text-indigo-400 mt-1">{formatIDR(rkaSummary.totalAnggaran)}</h3>
                      </div>
                    </div>
                  </div>
                )}

                {isRkaUploaded && (
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                    {/* TREEVIEW REKAP BELANJA */}
                    <div className="bg-slate-900/60 backdrop-blur-md border border-blue-400/20 p-4 rounded-xl font-mono shadow-xl">
                      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-blue-950 pb-2">
                        <Cpu size={13} /> Rekap Anggaran Akun
                      </h3>
                      <div className="text-[11px] space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {Object.keys(rkaSummary.treeData).map((kelompokKey) => {
                          const kelompok = rkaSummary.treeData[kelompokKey];
                          const isKelompokExpanded = expandedNodes[kelompokKey];
                          return (
                            <div key={kelompokKey} className="space-y-1">
                              <div onClick={() => toggleNode(kelompokKey)} className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-950 border border-blue-950/80 hover:border-blue-500/40 cursor-pointer transition-all">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  {isKelompokExpanded ? <ChevronDown size={12} className="text-amber-400" /> : <ChevronRight size={12} className="text-amber-400" />}
                                  <Folder size={13} className="text-amber-500 shrink-0" />
                                  <span className="text-slate-100 font-bold text-[10.5px] truncate">{kelompok.nama}</span>
                                </div>
                                <span className="font-mono font-black text-[9.5px] text-slate-300 pl-1 shrink-0">{formatIDR(kelompok.total)}</span>
                              </div>
                              {isKelompokExpanded && (
                                <div className="pl-3 border-l border-amber-500/30 space-y-1.5 py-1">
                                  {Object.keys(kelompok.jenis).map((jenisKey) => {
                                    const jenis = kelompok.jenis[jenisKey];
                                    return (
                                      <div key={jenisKey} className="flex flex-col p-2 rounded bg-slate-950/40 border border-blue-950/40 text-[10.5px] hover:border-blue-950 transition-colors">
                                        <span className="text-[8.5px] text-cyan-500 font-mono font-bold tracking-wider">{jenisKey}</span>
                                        <div className="flex justify-between items-start gap-2.5 mt-0.5">
                                          <span className="text-slate-300 font-sans font-medium leading-relaxed break-words flex-1">
                                            {jenis.nama}
                                          </span>
                                          <span className="text-emerald-400 font-mono font-bold text-[10px] shrink-0 pt-0.5">
                                            {formatIDR(jenis.totalSub)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* GRUP TABEL MATRIKS */}
                    <div className="xl:col-span-3 space-y-4">
                      {/* TABEL I */}
                      <div className="bg-slate-955/40 border border-blue-950/60 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 bg-slate-955/80 border-b border-blue-950 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,1)]"></div>
                          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">TABEL I: Matriks Treeview RKA Per Sub-Kegiatan</h4>
                        </div>
                        <div className="overflow-y-auto max-h-[250px] p-2 space-y-1 font-mono text-[11px]">
                          {groupedRkaData.map((subGrup, gIdx) => {
                            const isExpanded = expandedTabel1[subGrup.kodeSub];
                            return (
                              <div key={`t1-grup-${gIdx}`} className="border border-blue-950/40 rounded bg-slate-900/20 overflow-hidden">
                                <div 
                                  onClick={() => toggleTabel1Node(subGrup.kodeSub)} 
                                  className="p-2 bg-slate-900/80 hover:bg-slate-900 flex justify-between items-center cursor-pointer border-b border-blue-950/30"
                                >
                                  <div className="flex items-center gap-2 min-w-0 pr-2">
                                    {isExpanded ? <ChevronDown size={13} className="text-cyan-400 shrink-0" /> : <ChevronRight size={13} className="text-cyan-400 shrink-0" />}
                                    <div className="truncate">
                                      <span className="text-[9px] bg-blue-950 text-blue-400 px-1 rounded font-bold mr-1.5">{subGrup.kodeSub}</span>
                                      <span className="font-bold text-slate-100 uppercase text-[10px] font-sans">{subGrup.namaSub}</span>
                                    </div>
                                  </div>
                                  <span className="font-black text-[10px] text-emerald-400 shrink-0">{formatIDR(subGrup.paguSubTotal)}</span>
                                </div>
                                {isExpanded && (
                                  <div className="bg-slate-950/40 divide-y divide-blue-950/10">
                                    {subGrup.rincianRekening.map((rinci, rIdx) => (
                                      <div key={`rinci-${gIdx}-${rIdx}`} className="p-2 pl-6 flex justify-between items-center gap-4 text-[10px] hover:bg-slate-900/40">
                                        <div className="min-w-0 flex items-start gap-2">
                                          <span className="text-slate-500 font-mono text-[9px] pt-0.5 shrink-0">{rinci.kode}</span>
                                          <span className="text-slate-300 font-sans truncate max-w-xl" title={rinci.uraian}>{rinci.uraian}</span>
                                        </div>
                                        <span className="font-medium text-slate-300 shrink-0">{formatIDR(rinci.pagu)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* TABEL II */}
                      <div className="bg-slate-955/40 border border-blue-950/60 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 bg-slate-955/80 border-b border-blue-950 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)]"></div>
                          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">TABEL II: Daftar Sub-Kegiatan & Kategori Kebijakan APBD</h4>
                        </div>
                        <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
                          <table className="w-full text-left border-collapse font-mono text-[11px]">
                            <thead className="sticky top-0 bg-slate-955 z-10 border-b border-blue-950 text-cyan-400/80 uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="p-2.5">Nama Sub-Kegiatan Daerah</th>
                                <th className="p-2.5">Kategori Kebijakan APBD</th>
                                <th className="p-2.5 text-right">Total Alokasi Pagu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-950/30">
                              {subKegiatanRows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-900/30 text-slate-300">
                                  <td className="p-2.5 text-slate-100 max-w-sm truncate font-medium font-sans text-[11px]" title={row.namaSub}>{row.namaSub}</td>
                                  <td className="p-2.5">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      row.kategori.includes('SPM') ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/30' :
                                      row.kategori.includes('Mandatory') ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/30' :
                                      'bg-slate-900 text-slate-500'
                                    }`}>
                                      {row.kategori}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-right font-bold text-slate-200">{formatIDR(row.pagu)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!isRkaUploaded && (
                  <div className="border border-dashed border-blue-950/60 rounded-2xl p-12 text-center font-mono text-slate-500 text-xs">
                    // ENGINE STANDBY: SILAKAN UNGGAH FILE EXCEL UNTUK MEMULAI PARSING SESUAI STRUKTUR KOLOM SIPD
                  </div>
                )}
              </div>
            )}

            {/* PANEL AKUN MANAJEMEN OPERATOR */}
            {activeMenu === 'skpd' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="bg-slate-950/40 backdrop-blur-md border border-blue-500/20 p-5 rounded-2xl">
                  <div className="flex justify-between items-center mb-4 font-mono">
                    <h2 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus size={14} /> {isEditing ? 'Update Operator SKPD' : 'Registrasi Operator SKPD'}
                    </h2>
                    {isEditing && (
                      <button onClick={handleCancelEdit} className="text-[10px] text-red-400 hover:underline flex items-center gap-1">
                        <X size={10} /> Batal
                      </button>
                    )}
                  </div>
                  
                  <form onSubmit={handleAddUser} className="space-y-3.5 font-mono text-[11px]">
                    <div>
                      <label className="block text-slate-400 mb-1">Nama Lengkap Operator</label>
                      <input type="text" required value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} className="w-full bg-slate-950 border border-blue-950/60 focus:border-blue-500 rounded-lg p-2 text-white focus:outline-none" placeholder="Nama lengkap" />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Email Instansi</label>
                      <input type="email" required disabled={isEditing} value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="w-full bg-slate-950 border border-blue-950/60 focus:border-blue-500 rounded-lg p-2 text-white focus:outline-none disabled:opacity-50" placeholder="nama@pemda.go.id" />
                    </div>
                    {!isEditing && (
                      <div>
                        <label className="block text-slate-400 mb-1">Kata Sandi Default</label>
                        <input type="password" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="w-full bg-slate-950 border border-blue-950/60 focus:border-blue-500 rounded-lg p-2 text-white focus:outline-none" placeholder="******" />
                      </div>
                    )}
                    <div>
                      <label className="block text-slate-400 mb-1">Instansi / SKPD Pemilik</label>
                      <input type="text" required value={newUser.skpd} onChange={(e) => setNewUser({...newUser, skpd: e.target.value})} className="w-full bg-slate-950 border border-blue-950/60 focus:border-blue-500 rounded-lg p-2 text-white focus:outline-none" placeholder="Contoh: Dinas Kesehatan" />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Hak Akses Node</label>
                      <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="w-full bg-slate-950 border border-blue-950/60 focus:border-blue-500 rounded-lg p-2 text-white focus:outline-none">
                        <option value="">-- PILIH ROLE --</option>
                        <option value="operator_skpd">OPERATOR SKPD</option>
                        <option value="verifikator_tapd">VERIFIKATOR TAPD</option>
                        <option value="super_admin">SUPER ADMINISTRATOR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Berkas Foto Profil / Avatar</label>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-slate-400 text-[10px]" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-lg transition-colors shadow-md">
                      {loading ? 'MEMPROSES DATABASE...' : isEditing ? 'SIMPAN PERUBAHAN PROFILE' : 'COMMIT REGISTER OPERATOR'}
                    </button>
                  </form>
                </div>

                <div className="xl:col-span-2 bg-slate-950/40 border border-blue-950/60 rounded-2xl overflow-hidden font-mono text-[11px]">
                  <div className="p-4 border-b border-blue-950/40 bg-slate-950/20 flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} /> Database Operator Terdaftar ({usersList.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/80 border-b border-blue-950 text-blue-400/80 uppercase text-[10px] tracking-wider">
                          <th className="p-3">Identity / Profil</th>
                          <th className="p-3">Instansi SKPD</th>
                          <th className="p-3">Role Node</th>
                          <th className="p-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-950/30">
                        {usersList.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="p-6 text-center text-slate-500">// BELUM ADA OPERATOR SKPD YANG DISINKRONISASIKAN</td>
                          </tr>
                        ) : (
                          usersList.map((usr) => (
                            <tr key={usr.id} className="hover:bg-slate-900/30 text-slate-300">
                              <td className="p-3 flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-950 border border-blue-950 shrink-0">
                                  <img src={usr.avatar_url || fallbackLogo} onError={(e) => { e.target.src = fallbackLogo; }} className="w-full h-full object-cover" alt="avatar" />
                                </div>
                                <div className="truncate">
                                  <span className="block font-bold text-slate-200">{usr.nama_lengkap || 'No Name'}</span>
                                  <span className="block text-[10px] text-slate-500 truncate">{usr.email}</span>
                                </div>
                              </td>
                              <td className="p-3 text-slate-300 font-bold uppercase text-[10px]">{usr.instansi_skpd || '-'}</td>
                              <td className="p-3"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-950/60 border border-blue-800/40 text-blue-400">{usr.role || 'operator_skpd'}</span></td>
                              <td className="p-3">
                                <div className="flex justify-center gap-2">
                                  <button onClick={() => handleSelectEditUser(usr)} className="p-1 text-slate-400 hover:text-blue-400 transition-colors"><Edit2 size={13} /></button>
                                  <button onClick={() => handleDeleteUser(usr.id)} className="p-1 text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </main>

          <footer className="w-full text-center py-3 border-t border-blue-950/25 font-mono text-[8px] text-slate-600 tracking-widest bg-slate-950/20">
            SYSTEM CORE V4.4 // VERIFICATION RULES ENGINE // SECURED BY SUPABASE
          </footer>
        </div>
      </div>
    );
  }

  // INTERFACE LOGIN
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden select-none">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-sky-600/10 rounded-full blur-[130px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-3xl border border-blue-500/20 p-8 rounded-3xl shadow-[0_0_60px_rgba(59,130,246,0.12)] relative z-10 group">
        <div className="flex flex-col items-center mb-8">
          <div className="w-36 h-36 rounded-full p-1 bg-gradient-to-b from-blue-400 to-indigo-600 shadow-[0_0_30px_rgba(59,130,246,0.25)] mb-4 relative overflow-hidden">
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-950">
              <img src="/logo-avatar1.png" onError={(e) => { e.target.src = fallbackLogo; }} className="w-full h-full object-cover" alt="Avatar APBD" />
            </div>
            <span className="absolute bottom-1 right-2 w-4 h-4 bg-blue-500 border-2 border-slate-950 rounded-full animate-ping"></span>
            <span className="absolute bottom-1 right-2 w-4 h-4 bg-blue-500 border-2 border-slate-950 rounded-full"></span>
          </div>

          <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-blue-400 font-mono text-center">AVATAR APBD</h1>
          <div className="h-[2px] w-20 bg-gradient-to-r from-transparent via-blue-500 to-transparent mt-2.5"></div>
          <p className="text-[12px] text-blue-400/60 mt-2 uppercase tracking-[0.25em] font-mono font-bold text-center">Asisten Verifikasi Teknis Anggaran</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-blue-400/70 uppercase tracking-widest font-mono pl-1">Email User</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-4 text-slate-500" />
              <input type="email" required placeholder="email user" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950/80 border border-blue-950/40 focus:border-blue-500 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-blue-400/70 uppercase tracking-widest font-mono pl-1">Secure Passkey</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-4 text-slate-500" />
              <input type={showPassword ? "text" : "password"} required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950/80 border border-blue-950/40 focus:border-blue-500 rounded-xl pl-12 pr-12 py-3.5 text-sm text-white focus:outline-none font-mono" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-500 hover:text-blue-400 transition-colors cursor-pointer">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white py-4 px-4 rounded-xl font-black font-mono tracking-widest text-xs flex items-center justify-center gap-2 group shadow-[0_0_25px_rgba(59,130,246,0.2)] hover:shadow-[0_0_35px_rgba(59,130,246,0.4)] cursor-pointer">
            {loading ? 'INITIALIZING ENGINE...' : 'L O G I N'}
            <ArrowRight size={16} className="transform group-hover:translate-x-1.5 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
}