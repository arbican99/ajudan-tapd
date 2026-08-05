import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Download, RefreshCw, Cpu, Database, Sparkles, UserCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DINKES_KODE = '1.02.0.00.0.00.01.0000';

export default function ModulAsistensi({ activeEmail }) {
  // === STATE USER & TBLUSER ===
  const [userProfile, setUserProfile] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // === STATE SUPABASE DATA ===
  const [listStatus, setListStatus] = useState([]);
  const [listSkpd, setListSkpd] = useState([]);
  const [dbAsistensi, setDbAsistensi] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // STATE SUBUNIT DINAS KESEHATAN
  const [listSubunitDinkes, setListSubunitDinkes] = useState([]);

  // === FILTER STATES ===
  const [tahun, setTahun] = useState('2026');
  const [kdStatus, setKdStatus] = useState('');
  const [kdSkpd, setKdSkpd] = useState('');

  // 1. CARI PROFILE USER DI TBLUSER BERDASARKAN EMAIL SIKAP / AUTH
  useEffect(() => {
    const loadUserProfile = async () => {
      setLoadingUser(true);
      try {
        // Ambil email dari props activeEmail atau dari Supabase Auth
        let targetEmail = activeEmail;
        
        if (!targetEmail) {
          const { data: { user } } = await supabase.auth.getUser();
          targetEmail = user?.email;
        }

        if (!targetEmail) {
          setLoadingUser(false);
          return;
        }

        // Query ke tbluser berdasarkan email
        const { data, error } = await supabase
          .from('tbluser')
          .select('*')
          .ilike('email', targetEmail.trim())
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setUserProfile(data);

          // Cek Status Role User
          const statusRole = String(data.status || data.role || '').trim().toUpperCase();
          const userKdSkpd = String(data.kdskpd || data.kd_skpd || '').trim();

          // Jika User SKPD (Bukan Admin/TAPD), Kunci kdSkpd dari tbluser
          if (!statusRole.includes('ADMIN') && !statusRole.includes('TAPD') && userKdSkpd) {
            setKdSkpd(userKdSkpd);
          }
        }
      } catch (err) {
        console.error('Gagal mengambil data user dari tbluser:', err.message);
      } finally {
        setLoadingUser(false);
      }
    };

    loadUserProfile();
  }, [activeEmail]);

  // Cek Apakah Admin / TAPD
  const isAdminOrTapd = useMemo(() => {
    if (!userProfile) return false;
    const statusVal = String(
      userProfile.status || userProfile.role || userProfile.user_status || ''
    ).trim().toUpperCase();

    return statusVal.includes('ADMIN') || statusVal.includes('TAPD');
  }, [userProfile]);

  // Daftar SKPD Unik
  const listSkpdUtama = useMemo(() => {
    const map = new Map();
    listSkpd.forEach(s => {
      const kd = String(s.kd_skpd || s.kdskpd || s.id || '').trim();
      if (kd && !map.has(kd)) map.set(kd, s);
    });
    return Array.from(map.values());
  }, [listSkpd]);

  // Auto-Select SKPD Pertama Hanya Untuk ADMIN / TAPD Jika Belum Memilih
  useEffect(() => {
    if (isAdminOrTapd && listSkpdUtama.length > 0 && !kdSkpd) {
      const firstKd = listSkpdUtama[0]?.kd_skpd || listSkpdUtama[0]?.kdskpd || '';
      if (firstKd) setKdSkpd(String(firstKd).trim());
    }
  }, [isAdminOrTapd, listSkpdUtama, kdSkpd]);

  useEffect(() => {
    fetchSupabaseData();
  }, []);

  // Fetch Data Asistensi
  const fetchAllAsistensiData = async () => {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from('asistensi')
        .select('*')
        .order('id', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        page++;
        if (data.length < pageSize) fetchMore = false;
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

      const asistensiData = await fetchAllAsistensiData();

      setListStatus(statusData || []);
      setListSkpd(skpdData || []);
      setDbAsistensi(asistensiData || []);

      if (statusData && statusData.length > 0 && !kdStatus) {
        const firstStatus = statusData[0]?.kdstatus || statusData[0]?.kd_status || statusData[0]?.id;
        if (firstStatus) setKdStatus(String(firstStatus).trim());
      }
    } catch (error) {
      console.error('Error loading Supabase:', error.message);
      alert('Gagal memuat data dari Supabase: ' + error.message);
    } finally {
      setLoadingDb(false);
    }
  };

  // Subunit Dinkes Listener
  useEffect(() => {
    const cleanKd = String(kdSkpd).replace(/[^a-zA-Z0-9]/g, '');
    const cleanDinkes = DINKES_KODE.replace(/[^a-zA-Z0-9]/g, '');

    if (cleanKd === cleanDinkes && cleanKd !== '') {
      const fetchSubunits = async () => {
        try {
          const { data, error } = await supabase
            .from('tblskpd')
            .select('kd_subunit, nm_subunit')
            .eq('kd_skpd', DINKES_KODE);

          if (error) throw error;
          setListSubunitDinkes(data || []);
        } catch (err) {
          console.error('Error fetching subunit:', err.message);
        }
      };
      fetchSubunits();
    } else {
      setListSubunitDinkes([]);
    }
  }, [kdSkpd]);

  const selectedSkpdObj = useMemo(() => {
    const cleanSelected = String(kdSkpd).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return listSkpdUtama.find(s => {
      const kd = String(s.kd_skpd || s.kdskpd || s.id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return kd === cleanSelected;
    });
  }, [listSkpdUtama, kdSkpd]);

  const selectedStatusObj = useMemo(() => {
    const cleanStatus = String(kdStatus).trim();
    return listStatus.find(s => String(s.kd_status || s.kdstatus || s.id || '').trim() === cleanStatus);
  }, [listStatus, kdStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 px-6 py-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide uppercase">
              Cetak Laporan Hasil Asistensi APBD
            </h1>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
              <Database size={12} className="text-blue-400" /> Modul Preview & Download Laporan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userProfile && (
            <div className="hidden md:flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <UserCheck size={14} className="text-emerald-400" />
              <span className="text-slate-300 font-mono">{userProfile.email}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold uppercase">
                {userProfile.status || userProfile.role || 'SKPD'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={fetchSupabaseData}
            disabled={loadingDb}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loadingDb ? 'animate-spin' : ''} />
            {loadingDb ? 'Memuat Data...' : 'Reload DB'}
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-blue-400 uppercase tracking-wider">
          <Sparkles size={14} /> Filter Cetakan Data
        </div>

        <div className={`grid grid-cols-1 ${isAdminOrTapd ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">1. Tahun Anggaran</label>
            <select
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">2. Tahapan APBD</label>
            <select
              value={kdStatus}
              onChange={(e) => setKdStatus(e.target.value)}
              disabled={loadingDb}
              className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none disabled:opacity-50"
            >
              <option value="">-- PILIH TAHAPAN APBD --</option>
              {listStatus.map((s, idx) => {
                const valKode = String(s.kdstatus || s.kd_status || s.id || '').trim();
                const valNama = s.nmstatus || s.nm_status || s.status || valKode;
                return (
                  <option key={idx} value={valKode}>[{valKode}] {valNama}</option>
                );
              })}
            </select>
          </div>

          {/* COMBO BOX HANYA DITAMPILKAN UNTUK USER ADMIN DAN TAPD */}
          {isAdminOrTapd && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">3. Perangkat Daerah (SKPD)</label>
              <select
                value={kdSkpd}
                onChange={(e) => setKdSkpd(e.target.value)}
                disabled={loadingDb}
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none disabled:opacity-50"
              >
                <option value="">-- PILIH SKPD / PERANGKAT DAERAH --</option>
                {listSkpdUtama.map((skpd, idx) => {
                  const kdS = skpd.kdskpd || skpd.kd_skpd || skpd.id;
                  const nmS = skpd.nmskpd || skpd.nm_skpd || skpd.nama_skpd;
                  return (
                    <option key={idx} value={kdS}>[{kdS}] {nmS}</option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* VIEW LAPORAN ASISTENSI */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
        <LaporanFrame 
          dbAsistensi={dbAsistensi} 
          selectedKdSkpd={kdSkpd}
          selectedSkpdObj={selectedSkpdObj}
          selectedStatusObj={selectedStatusObj}
          listSubunitDinkes={listSubunitDinkes}
          tahun={tahun}
          kdStatus={kdStatus}
        />
      </div>
    </div>
  );
}

// === PAGE FRAME LAPORAN ===
function LaporanFrame({ dbAsistensi, selectedKdSkpd, selectedSkpdObj, selectedStatusObj, listSubunitDinkes, tahun, kdStatus }) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const formatAngkaIndo = (val) => {
    if (!val && val !== 0) return '0,00';
    return Number(val).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredData = useMemo(() => {
    if (!selectedKdSkpd) return [];
    
    const targetSkpdClean = normalize(selectedKdSkpd);
    const targetStatusClean = normalize(kdStatus);
    const targetTahunClean = normalize(tahun);

    return dbAsistensi.filter(d => {
      const itemSkpdClean = normalize(d.kdskpd || d.kd_skpd);
      const itemStatusClean = normalize(d.kdstatus || d.kd_status);
      const itemTahunClean = normalize(d.tahun);

      const matchSkpd = itemSkpdClean === targetSkpdClean;
      const matchTahun = !targetTahunClean || itemTahunClean === targetTahunClean;
      const matchStatus = !targetStatusClean || itemStatusClean === targetStatusClean;

      return matchSkpd && matchTahun && matchStatus;
    });
  }, [dbAsistensi, selectedKdSkpd, tahun, kdStatus]);

  const buildReportStructure = (dataItems) => {
    const getItemKdRek = (item) => item.kdrekbhs || item.kdrek || item.kd_rek || '';
    const getItemNmRek = (item) => item.nmrekbhs || item.nmrek || item.nm_rek || '';
    const getItemUsulan = (item) => item.usulanbhs || item.usulan || '';
    const getItemJumlah = (item) => item.jumlahbhs !== undefined ? Number(item.jumlahbhs) : Number(item.jumlah || 0);
    const getItemKet = (item) => item.ketbhs || item.keterangan || '-';
    const getItemSt = (item) => item.stbhs || item.setuju || 'Disetujui';

    const pendapatan = dataItems.filter(d => String(getItemKdRek(d)).startsWith('4'));
    const belanja = dataItems.filter(d => String(getItemKdRek(d)).startsWith('5'));
    const pembiayaan = dataItems.filter(d => String(getItemKdRek(d)).startsWith('6'));

    const subgiatMap = new Map();
    belanja.forEach(item => {
      const subKey = item.kdsubgiat || item.kd_sub_giat || 'LAINNYA';
      if (!subgiatMap.has(subKey)) {
        subgiatMap.set(subKey, {
          kdsubgiat: subKey,
          nmsubgiat: item.nmsubgiat || item.nm_sub_giat || '-',
          items: []
        });
      }
      subgiatMap.get(subKey).items.push(item);
    });

    const totalPenambahan = dataItems.reduce((acc, curr) => acc + (getItemUsulan(curr) === 'Penambahan' ? getItemJumlah(curr) : 0), 0);
    const totalPengurangan = dataItems.reduce((acc, curr) => acc + (getItemUsulan(curr) === 'Pengurangan' ? getItemJumlah(curr) : 0), 0);

    return {
      pendapatan,
      belanjaSubgiat: Array.from(subgiatMap.values()),
      pembiayaan,
      totalPenambahan,
      totalPengurangan,
      helpers: { getItemKdRek, getItemNmRek, getItemUsulan, getItemJumlah, getItemKet, getItemSt }
    };
  };

  const handleDownloadPDF = async () => {
    if (!selectedKdSkpd) {
      alert("Silakan pilih SKPD terlebih dahulu.");
      return;
    }

    setDownloadingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('LAPORAN HASIL ASISTENSI APBD', pageWidth / 2, 12, { align: 'center' });
      
      doc.setFontSize(8);
      const namaSkpd = (selectedSkpdObj?.nm_skpd || selectedSkpdObj?.nmskpd || selectedKdSkpd || '-').toUpperCase();
      const namaStatus = (selectedStatusObj?.nm_status || selectedStatusObj?.status || selectedStatusObj?.nmstatus || '-').toUpperCase();
      
      doc.text(`SKPD: ${namaSkpd}`, 10, 18);
      doc.text(`STATUS: ${namaStatus} - TAHUN ${tahun}`, 10, 22);

      const tableRows = [];

      const appendStructureToRows = (struct) => {
        const { getItemKdRek, getItemNmRek, getItemUsulan, getItemJumlah, getItemKet, getItemSt } = struct.helpers;

        const totPenPend = struct.pendapatan.reduce((a, c) => a + (getItemUsulan(c) === 'Penambahan' ? getItemJumlah(c) : 0), 0);
        const totPengPend = struct.pendapatan.reduce((a, c) => a + (getItemUsulan(c) === 'Pengurangan' ? getItemJumlah(c) : 0), 0);
        
        tableRows.push([
          '1', '1', 'PENDAPATAN DAERAH', '',
          totPenPend ? formatAngkaIndo(totPenPend) : '',
          totPengPend ? formatAngkaIndo(totPengPend) : '',
          ''
        ]);

        struct.pendapatan.forEach(p => {
          tableRows.push([
            '', getItemKdRek(p), getItemNmRek(p), getItemKet(p),
            getItemUsulan(p) === 'Penambahan' ? formatAngkaIndo(getItemJumlah(p)) : '',
            getItemUsulan(p) === 'Pengurangan' ? formatAngkaIndo(getItemJumlah(p)) : '',
            getItemSt(p)
          ]);
        });

        tableRows.push([
          '2', '2', 'BELANJA DAERAH', '',
          struct.totalPenambahan ? formatAngkaIndo(struct.totalPenambahan) : '0,00',
          struct.totalPengurangan ? formatAngkaIndo(struct.totalPengurangan) : '0,00',
          ''
        ]);

        struct.belanjaSubgiat.forEach((sg, idx) => {
          tableRows.push([
            `2.${idx + 1}`, 
            sg.kdsubgiat, 
            { content: sg.nmsubgiat, colSpan: 5 }
          ]);

          sg.items.forEach(b => {
            tableRows.push([
              '', getItemKdRek(b), getItemNmRek(b), getItemKet(b),
              getItemUsulan(b) === 'Penambahan' ? formatAngkaIndo(getItemJumlah(b)) : '',
              getItemUsulan(b) === 'Pengurangan' ? formatAngkaIndo(getItemJumlah(b)) : '',
              getItemSt(b)
            ]);
          });
        });

        const totPenPemb = struct.pembiayaan.reduce((a, c) => a + (getItemUsulan(c) === 'Penambahan' ? getItemJumlah(c) : 0), 0);
        const totPengPemb = struct.pembiayaan.reduce((a, c) => a + (getItemUsulan(c) === 'Pengurangan' ? getItemJumlah(c) : 0), 0);
        
        tableRows.push([
          '3', '3', 'PEMBIAYAAN DAERAH', '',
          totPenPemb ? formatAngkaIndo(totPenPemb) : '',
          totPengPemb ? formatAngkaIndo(totPengPemb) : '',
          ''
        ]);

        struct.pembiayaan.forEach(pb => {
          tableRows.push([
            '', getItemKdRek(pb), getItemNmRek(pb), getItemKet(pb),
            getItemUsulan(pb) === 'Penambahan' ? formatAngkaIndo(getItemJumlah(pb)) : '',
            getItemUsulan(pb) === 'Pengurangan' ? formatAngkaIndo(getItemJumlah(pb)) : '',
            getItemSt(pb)
          ]);
        });
      };

      const cleanSelectedKd = normalize(selectedKdSkpd);
      const cleanDinkes = normalize(DINKES_KODE);

      if (cleanSelectedKd === cleanDinkes) {
        const totalSkpdStruct = buildReportStructure(filteredData);
        tableRows.push([
          '', 
          '', 
          { content: 'REKAPITULASI SKPD DINAS KESEHATAN (TOTAL GABUNGAN)', colSpan: 5 }
        ]);
        appendStructureToRows(totalSkpdStruct);

        listSubunitDinkes.forEach((sub, sIdx) => {
          const kodeSub = sub.kd_subunit || sub.kdsubunit;
          const namaSub = sub.nm_subunit || sub.nmsubunit;
          const subItems = filteredData.filter(d => normalize(d.kdsubunit || d.kd_subunit) === normalize(kodeSub));
          
          tableRows.push(['', '', '', '', '', '', '']);
          tableRows.push([
            `SUB ${sIdx + 1}`, 
            kodeSub, 
            { content: `SUBUNIT: ${namaSub.toUpperCase()}`, colSpan: 5 }
          ]);
          appendStructureToRows(buildReportStructure(subItems));
        });
      } else {
        appendStructureToRows(buildReportStructure(filteredData));
      }

      autoTable(doc, {
        startY: 26,
        head: [['No', 'KODE', 'URAIAN', 'KETERANGAN', 'PENAMBAHAN', 'PENGURANGAN', 'STATUS']],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.2, font: 'helvetica', textColor: [0, 0, 0] },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 32 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 32 },
          4: { halign: 'right', cellWidth: 28 },
          5: { halign: 'right', cellWidth: 28 },
          6: { halign: 'center', cellWidth: 18 }
        },
        didParseCell: function (data) {
          if (data.section === 'body') {
            const rowNo = String(data.row.cells[0]?.raw || '').trim();
            const rowKode = String(data.row.cells[1]?.raw || '').trim();
            const rowUraian = String(data.row.cells[2]?.raw || '').trim();

            const isHeaderRow = 
              rowNo === '1' || 
              rowNo === '2' || 
              rowNo === '3' || 
              rowNo.startsWith('2.') || 
              rowNo.startsWith('SUB') || 
              rowKode === '1' || 
              rowKode === '2' || 
              rowKode === '3' ||
              rowUraian.includes('REKAPITULASI');

            if (isHeaderRow) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 240, 240];
            }
          }
        }
      });

      doc.save(`LAPORAN_ASISTENSI_${selectedKdSkpd}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan pembuatan PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800">
        <div className="text-xs font-bold text-white uppercase flex items-center gap-2">
          <FileText size={16} className="text-blue-400" /> Frame Laporan Hasil Pembahasan Asistensi
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={downloadingPdf || !selectedKdSkpd}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer shadow disabled:opacity-50"
        >
          <Download size={13} /> {downloadingPdf ? 'Generating...' : 'Download PDF'}
        </button>
      </div>

      <div className="bg-white text-black p-6 rounded-xl border border-slate-300 text-xs space-y-4 overflow-x-auto shadow-md">
        <div className="text-center font-bold text-sm tracking-wide border-b border-black pb-2 uppercase">
          LAPORAN HASIL ASISTENSI APBD
        </div>
        {selectedKdSkpd ? (
          <TableReportView struct={buildReportStructure(filteredData)} />
        ) : (
          <div className="p-8 text-center text-slate-500 italic">
            -- Silakan Pilih SKPD Terlebih Dahulu Untuk Menampilkan Laporan --
          </div>
        )}
      </div>
    </div>
  );
}

// === TAMPILAN TABEL LAPORAN APBD ===
function TableReportView({ struct }) {
  const formatRupiah = (val) => {
    if (!val && val !== 0) return '';
    return Number(val).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const { getItemKdRek, getItemNmRek, getItemUsulan, getItemJumlah, getItemKet, getItemSt } = struct.helpers;

  const totPenPend = struct.pendapatan.reduce((a, c) => a + (getItemUsulan(c) === 'Penambahan' ? getItemJumlah(c) : 0), 0);
  const totPengPend = struct.pendapatan.reduce((a, c) => a + (getItemUsulan(c) === 'Pengurangan' ? getItemJumlah(c) : 0), 0);

  const totPenPemb = struct.pembiayaan.reduce((a, c) => a + (getItemUsulan(c) === 'Penambahan' ? getItemJumlah(c) : 0), 0);
  const totPengPemb = struct.pembiayaan.reduce((a, c) => a + (getItemUsulan(c) === 'Pengurangan' ? getItemJumlah(c) : 0), 0);

  return (
    <table className="w-full border-collapse border border-black text-left text-[11px]">
      <thead>
        <tr className="bg-slate-100 border-b border-black text-center font-bold">
          <th className="border border-black p-1.5 w-8">No</th>
          <th className="border border-black p-1.5 w-36">KODE</th>
          <th className="border border-black p-1.5">URAIAN</th>
          <th className="border border-black p-1.5">KETERANGAN</th>
          <th className="border border-black p-1.5 w-32 text-right">PENAMBAHAN</th>
          <th className="border border-black p-1.5 w-32 text-right">PENGURANGAN</th>
          <th className="border border-black p-1.5 w-24 text-center">STATUS</th>
        </tr>
      </thead>
      <tbody>
        <tr className="font-bold bg-slate-100/70">
          <td className="border border-black p-1 text-center">1</td>
          <td className="border border-black p-1 font-mono">1</td>
          <td className="border border-black p-1">PENDAPATAN DAERAH</td>
          <td className="border border-black p-1"></td>
          <td className="border border-black p-1 text-right">{totPenPend ? formatRupiah(totPenPend) : ''}</td>
          <td className="border border-black p-1 text-right">{totPengPend ? formatRupiah(totPengPend) : ''}</td>
          <td className="border border-black p-1 text-center"></td>
        </tr>
        {struct.pendapatan.map((item, idx) => (
          <tr key={`pend-${idx}`}>
            <td className="border border-black p-1 text-center"></td>
            <td className="border border-black p-1 font-mono">{getItemKdRek(item)}</td>
            <td className="border border-black p-1">{getItemNmRek(item)}</td>
            <td className="border border-black p-1">{getItemKet(item)}</td>
            <td className="border border-black p-1 text-right">{getItemUsulan(item) === 'Penambahan' ? formatRupiah(getItemJumlah(item)) : ''}</td>
            <td className="border border-black p-1 text-right">{getItemUsulan(item) === 'Pengurangan' ? formatRupiah(getItemJumlah(item)) : ''}</td>
            <td className="border border-black p-1 text-center">{getItemSt(item)}</td>
          </tr>
        ))}

        <tr className="font-bold bg-slate-100/70">
          <td className="border border-black p-1 text-center">2</td>
          <td className="border border-black p-1 font-mono">2</td>
          <td className="border border-black p-1">BELANJA DAERAH</td>
          <td className="border border-black p-1"></td>
          <td className="border border-black p-1 text-right">{struct.totalPenambahan ? formatRupiah(struct.totalPenambahan) : '0,00'}</td>
          <td className="border border-black p-1 text-right">{struct.totalPengurangan ? formatRupiah(struct.totalPengurangan) : '0,00'}</td>
          <td className="border border-black p-1 text-center"></td>
        </tr>
        {struct.belanjaSubgiat.map((sg, sIdx) => (
          <React.Fragment key={`sg-${sIdx}`}>
            <tr className="font-bold bg-slate-50">
              <td className="border border-black p-1 text-center">2.{sIdx + 1}</td>
              <td className="border border-black p-1 font-mono">{sg.kdsubgiat}</td>
              <td className="border border-black p-1" colSpan={5}>{sg.nmsubgiat}</td>
            </tr>
            {sg.items.map((b, bIdx) => (
              <tr key={`bel-${bIdx}`}>
                <td className="border border-black p-1 text-center"></td>
                <td className="border border-black p-1 font-mono">{getItemKdRek(b)}</td>
                <td className="border border-black p-1">{getItemNmRek(b)}</td>
                <td className="border border-black p-1">{getItemKet(b)}</td>
                <td className="border border-black p-1 text-right">{getItemUsulan(b) === 'Penambahan' ? formatRupiah(getItemJumlah(b)) : ''}</td>
                <td className="border border-black p-1 text-right">{getItemUsulan(b) === 'Pengurangan' ? formatRupiah(getItemJumlah(b)) : ''}</td>
                <td className="border border-black p-1 text-center">{getItemSt(b)}</td>
              </tr>
            ))}
          </React.Fragment>
        ))}

        <tr className="font-bold bg-slate-100/70">
          <td className="border border-black p-1 text-center">3</td>
          <td className="border border-black p-1 font-mono">3</td>
          <td className="border border-black p-1">PEMBIAYAAN DAERAH</td>
          <td className="border border-black p-1"></td>
          <td className="border border-black p-1 text-right">{totPenPemb ? formatRupiah(totPenPemb) : ''}</td>
          <td className="border border-black p-1 text-right">{totPengPemb ? formatRupiah(totPengPemb) : ''}</td>
          <td className="border border-black p-1 text-center"></td>
        </tr>
        {struct.pembiayaan.map((pb, pIdx) => (
          <tr key={`pemb-${pIdx}`}>
            <td className="border border-black p-1 text-center"></td>
            <td className="border border-black p-1 font-mono">{getItemKdRek(pb)}</td>
            <td className="border border-black p-1">{getItemNmRek(pb)}</td>
            <td className="border border-black p-1">{getItemKet(pb)}</td>
            <td className="border border-black p-1 text-right">{getItemUsulan(pb) === 'Penambahan' ? formatRupiah(getItemJumlah(pb)) : ''}</td>
            <td className="border border-black p-1 text-right">{getItemUsulan(pb) === 'Pengurangan' ? formatRupiah(getItemJumlah(pb)) : ''}</td>
            <td className="border border-black p-1 text-center">{getItemSt(pb)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}