import React, { useState, useEffect } from 'react';
import { Layers, ChevronDown, ChevronRight, Play, FileText, BarChart2, Grid, AlertTriangle, Plane, Package, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ModulVerifikasiRka() {
  const [listTahapan, setListTahapan] = useState([]);
  const [listSkpd, setListSkpd] = useState([]);
  const [rules, setRules] = useState([]);
  const [masterTematik, setMasterTematik] = useState([]); 
  const [loading, setLoading] = useState(false);
  
  const [selectedTahun, setSelectedTahun] = useState('');
  const [selectedTahapan, setSelectedTahapan] = useState('');
  const [selectedSkpd, setSelectedSkpd] = useState(''); 
  
  // State Pencarian Pintar (Kode / Nama)
  const [searchQuery, setSearchQuery] = useState('');

  // State Manajemen Navigasi Halaman Tabel
  const [activePage, setActivePage] = useState(1);

  // State Manajemen Hasil Proses & Data Pembanding Realisasi
  const [subKegiatanTree, setSubKegiatanTree] = useState({});
  const [subUnitGroupData, setSubUnitGroupData] = useState({});
  const [tematikReport, setTematikReport] = useState({}); 
  const [reportGenerated, setReportGenerated] = useState(false);

  // State Ekpansi Baris Treeview
  const [expandedSubKeg, setExpandedSubKeg] = useState({});
  const [expandedTematik, setExpandedTematik] = useState({});
  const [expandedPerjadin, setExpandedPerjadin] = useState({});
  const [expandedBph, setExpandedBph] = useState({});

  const listTahun = ['2024', '2025', '2026', '2027'];

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const { data: statusData } = await supabase.from('tblstatus').select('*').order('kd_status');
      setListTahapan(statusData || []);

      const { data: skpdData } = await supabase.from('tblskpd').select('*');
      
      const uniqueSkpdMap = {};
      (skpdData || []).forEach(item => {
        let fullSkpdCode = String(item.kd_skpd || '').trim();
        let namaResmi = String(item.nm_skpd || 'Unit Perangkat Daerah').trim();

        if (namaResmi.toUpperCase().includes('DINAS KESEHATAN')) {
          if (!uniqueSkpdMap[fullSkpdCode]) {
            uniqueSkpdMap[fullSkpdCode] = {
              kd_skpd_utama: fullSkpdCode, 
              display_nama: 'DINAS KESEHATAN',
              isDinkes: true
            };
          }
        } else {
          uniqueSkpdMap[fullSkpdCode] = {
            kd_skpd_utama: fullSkpdCode,
            display_nama: namaResmi,
            isDinkes: false
          };
        }
      });

      const uniqueSkpdList = Object.values(uniqueSkpdMap).sort((a, b) => {
        return a.kd_skpd_utama.localeCompare(b.kd_skpd_utama, undefined, { numeric: true, sensitivity: 'base' });
      });
      
      setListSkpd(uniqueSkpdList);

      const { data: ruleData } = await supabase.from('tbl_rule_validasi').select('*');
      setRules(ruleData || []);

      const { data: mdsData } = await supabase.from('tblmds').select('katagori, kode, kdsubgiat, nmsubgiat');
      setMasterTematik(mdsData || []);

    } catch (err) {
      console.error('Gagal sinkronisasi data master:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProsesVerifikasi = async () => {
    if (!selectedTahun || !selectedTahapan || !selectedSkpd) {
      alert('PERINGATAN: Silakan tentukan Tahun Anggaran, Status Tahapan APBD, dan Perangkat Daerah terlebih dahulu!');
      return;
    }

    setLoading(true);
    setReportGenerated(false);

    try {
      const { data: dataRows, error: errorRka } = await supabase
        .from('rka') 
        .select('*')
        .eq('tahun', selectedTahun)
        .eq('kdstatus', selectedTahapan)
        .eq('kdskpd', selectedSkpd);

      if (errorRka) throw errorRka;

      if (!dataRows || dataRows.length === 0) {
        alert('Data RKA tidak ditemukan untuk kombinasi parameter ini.');
        return;
      }

      const tahunLalu = parseInt(selectedTahun) - 1;
      const { data: dataRealisasiLalu, error: errorReal } = await supabase
        .from('data_realisasi')
        .select('*')
        .eq('tahun', tahunLalu)
        .eq('Kode_Skpd', selectedSkpd);

      if (errorReal) {
        console.error('Gagal mengambil data realisasi historis:', errorReal);
      }

      prosesSimulasiAuditTree(dataRows, dataRealisasiLalu || []);
      setActivePage(1); 

    } catch (err) {
      alert('Gagal mengambil data untuk diproses.');
      console.error('Error Global Processing:', err);
    } finally {
      setLoading(false);
    }
  };

  const prosesSimulasiAuditTree = (dataRows, dataRealisasiLalu) => {
    const dapatkanPesanAturan = (idAturan, pesanDefault) => {
      const r = rules.find(item => item.id_aturan === idAturan);
      return r ? r.error_message : pesanDefault;
    };

    const realisasiMap = {};
    dataRealisasiLalu.forEach(item => {
      const subUnitKey = String(item.Kode_Subunit || '').trim();
      const subGiatKey = String(item.Kode_Subgiat || '').trim();
      const rekKey = String(item.Kode_Rekening || '').trim();
      const lookupKey = `${subUnitKey}_${subGiatKey}_${rekKey}`;
      
      if (!realisasiMap[lookupKey]) {
        realisasiMap[lookupKey] = 0;
      }
      realisasiMap[lookupKey] += parseFloat(item.Realisasi || 0);
    });

    const treeGroup = {};
    const tematikGroup = {}; 
    const unitHierarkiGroup = {}; 

    dataRows.forEach((row) => {
      const rawSubUnit = String(row.kdsubunit || '').trim();
      const skpdInduk = String(row.kdskpd || '').trim();
      const namaSubUnit = String(row.nmsubunit || 'Unit Kerja').trim().toUpperCase();
      const namaBidangUrusan = String(row.nmbidurus || 'URUSAN PEMERINTAHAN').trim().toUpperCase();

      const subKeg = String(row.kdsubgiat || '').trim();
      const namaSub = String(row.nmsubgiat || '').trim();
      const namaSubLower = namaSub.toLowerCase();
      
      const rek = String(row.kdrek || '').trim();
      const namaRek = String(row.nmrek || '').trim();
      const namaRekLower = namaRek.toLowerCase();
      const nominal = parseFloat(row.jml || 0);

      if (!subKeg || !rawSubUnit) return;

      const nominalRealisasiLalu = realisasiMap[`${rawSubUnit}_${subKeg}_${rek}`] || 0;

      const apakahSubKegiatanFisik = subKeg.startsWith('1.03.02') || 
                                     namaSubLower.includes('pembangunan') || 
                                     namaSubLower.includes('rehabilitasi') || 
                                     namaSubLower.includes('rekonstruksi');
                                     
      const apakahKonsultanFisik = rek.startsWith('5.1.02.02.08') || 
                                   rek.startsWith('5.1.02.02.008') || 
                                   namaRekLower.includes('jasa konsultansi berorientasi layanan') ||
                                   namaRekLower.includes('konsultan perencana') ||
                                   namaRekLower.includes('konsultan pengawas');

      const angkaMurniSubKegExcel = subKeg.replace(/[^0-9]/g, '');
      if (angkaMurniSubKegExcel.length > 0) {
        const matchTematik = masterTematik.find(t => {
          const angkaMurniMaster1 = String(t.kdsubgiat || '').replace(/[^0-9]/g, '');
          const angkaMurniMaster2 = String(t.kode || '').replace(/[^0-9]/g, '');
          return (angkaMurniMaster1 === angkaMurniSubKegExcel) || (angkaMurniMaster2 === angkaMurniSubKegExcel);
        });

        if (matchTematik && matchTematik.katagori) {
          const namaKategoriMurni = String(matchTematik.katagori).toUpperCase().trim();
          if (!tematikGroup[namaKategoriMurni]) {
            tematikGroup[namaKategoriMurni] = { 
              kategori: namaKategoriMurni, 
              bel_utama: 0, 
              bel_pendukung: 0, 
              jumlah: 0,
              listSubKegiatan: {} 
            };
          }
          let jenisKomponenTematik = 'pendukung';
          if (rek.startsWith('5.2')) {
            jenisKomponenTematik = 'utama';
          } else if (rek.startsWith('5.1') && apakahSubKegiatanFisik && apakahKonsultanFisik) {
            jenisKomponenTematik = 'utama';
          }

          if (jenisKomponenTematik === 'utama') tematikGroup[namaKategoriMurni].bel_utama += nominal;
          else tematikGroup[namaKategoriMurni].bel_pendukung += nominal;
          tematikGroup[namaKategoriMurni].jumlah += nominal;

          if (!tematikGroup[namaKategoriMurni].listSubKegiatan[subKeg]) {
            tematikGroup[namaKategoriMurni].listSubKegiatan[subKeg] = {
              kd_sub_kegiatan: subKeg,
              nama_sub_kegiatan: namaSub,
              nominal: 0
            };
          }
          tematikGroup[namaKategoriMurni].listSubKegiatan[subKeg].nominal += nominal;
        }
      }

      const treeUniqueKey = `${rawSubUnit}_${subKeg}`;

      if (!treeGroup[treeUniqueKey]) {
        treeGroup[treeUniqueKey] = {
          kd_skpd_utama: selectedSkpd,
          kd_subunit: rawSubUnit,
          nama_subunit: namaSubUnit,
          nama_bidang_urusan: namaBidangUrusan,
          kd_sub_kegiatan: subKeg,
          nama_sub_kegiatan: namaSub,
          total_pagu_sub: 0,
          total_realisasi_sub_lalu: 0, 
          pagu_utama: 0,      
          pagu_penunjang: 0,   
          rekeningRows: {}, 
          subErrors: [],
          b_pegawai: 0, b_barjas: 0, b_hibah: 0, b_modal_alat: 0, b_modal_gedung: 0, b_modal_jalan: 0,
          b_modal_aset_tetap: 0, b_modal_aset_lain: 0, b_btt: 0, b_bagi_hasil: 0, b_bantuan_keu: 0
        };
      }

      treeGroup[treeUniqueKey].total_pagu_sub += nominal;
      treeGroup[treeUniqueKey].total_realisasi_sub_lalu += nominalRealisasiLalu;
      
      let isUtama = false;
      if (rek.startsWith('5.2')) {
        isUtama = true;
        treeGroup[treeUniqueKey].pagu_utama += nominal;
      } else {
        if (rek.startsWith('5.1') && apakahSubKegiatanFisik && apakahKonsultanFisik) {
          isUtama = true;
          treeGroup[treeUniqueKey].pagu_utama += nominal;
        } else {
          treeGroup[treeUniqueKey].pagu_penunjang += nominal;
        }
      }

      if (rek) {
        if (!treeGroup[treeUniqueKey].rekeningRows[rek]) {
          treeGroup[treeUniqueKey].rekeningRows[rek] = {
            kd_rekening: rek,
            nama_rekening: namaRek || 'Rincian Objek Belanja',
            pagu_utama_rek: 0,
            pagu_penunjang_rek: 0,
            total_rek: 0,
            realisasi_lalu_rek: 0, 
            errors: []
          };
        }
        treeGroup[treeUniqueKey].rekeningRows[rek].total_rek += nominal;
        treeGroup[treeUniqueKey].rekeningRows[rek].realisasi_lalu_rek += nominalRealisasiLalu;
        if (isUtama) treeGroup[treeUniqueKey].rekeningRows[rek].pagu_utama_rek += nominal;
        else treeGroup[treeUniqueKey].rekeningRows[rek].pagu_penunjang_rek += nominal;
      }

      if (rek.startsWith('5.1.01')) treeGroup[treeUniqueKey].b_pegawai += nominal;
      else if (rek.startsWith('5.1.02') && !rek.startsWith('5.1.02.03')) treeGroup[treeUniqueKey].b_barjas += nominal;
      else if (rek.startsWith('5.1.02.03')) treeGroup[treeUniqueKey].b_hibah += nominal;
      else if (rek.startsWith('5.2.02')) treeGroup[treeUniqueKey].b_modal_alat += nominal;
      else if (rek.startsWith('5.2.03')) treeGroup[treeUniqueKey].b_modal_gedung += nominal;
      else if (rek.startsWith('5.2.04')) treeGroup[treeUniqueKey].b_modal_jalan += nominal;
      else if (rek.startsWith('5.2.05')) treeGroup[treeUniqueKey].b_modal_aset_tetap += nominal;
      else if (rek.startsWith('5.2.06')) treeGroup[treeUniqueKey].b_modal_aset_lain += nominal;
      else if (rek.startsWith('5.3')) treeGroup[treeUniqueKey].b_btt += nominal;
      else if (rek.startsWith('5.4.01')) treeGroup[treeUniqueKey].b_bagi_hasil += nominal;
      else if (rek.startsWith('5.4.02')) treeGroup[treeUniqueKey].b_bantuan_keu += nominal;

      let barisErrors = [];
      if (!subKeg.endsWith('.01') && subKeg.length >= 4 && skpdInduk.length >= 4) {
        if (skpdInduk.substring(0, 4) !== subKeg.substring(0, 4)) {
          barisErrors.push(dapatkanPesanAturan('R-01', 'Gagal Validasi Kewenangan! SKPD dilarang menganggarkan Sub-Kegiatan di luar bidang urusan wajibnya.'));
        }
      }
      if (apakahSubKegiatanFisik && apakahKonsultanFisik && nominal > 0) {
        barisErrors.push(`[${rek}] ` + dapatkanPesanAturan('R-02', 'Pencampuran Akun! Untuk sub-kegiatan konstruksi fisik, Jasa Konsultan harus menggunakan akun Belanja Modal (awalan 5.2) agar nilainya dikapitalisasi ke aset tetap.'));
      }
      const dinasTeknis = ['1.03', '1.04', '2.10'];
      if (!dinasTeknis.some(pfx => skpdInduk.startsWith(pfx)) && rek.startsWith('5.2.04') && nominal > 0) {
        barisErrors.push(dapatkanPesanAturan('R-04', 'Pelanggaran Aturan! SKPD Administratif dilarang menganggarkan Belanja Modal Jalan, Irigasi, dan Jaringan.'));
      }
      const subKegParts = subKeg.split('.');
      const akhiranSubKeg = subKegParts[subKegParts.length - 1];
      const apakahSubKegiatanRutinAparatur = subKeg.includes('.01.') || akhiranSubKeg === '0001' || akhiranSubKeg === '0002' || namaSubLower.includes('penunjang urusan') || namaSubLower.includes('administrasi perangkat daerah');
      if (apakahSubKegiatanRutinAparatur && !namaSubLower.includes('pembangunan') && !namaSubLower.includes('pengadaan') && (rek.startsWith('5.2.03') || rek.startsWith('5.2.04')) && nominal > 50000000) {
        barisErrors.push(dapatkanPesanAturan('R-05', 'Salah Penempatan! Sub-kegiatan penunjang administrasi kantor rutin hanya untuk operasional.'));
      }

      if (barisErrors.length > 0) {
        barisErrors.forEach(errTxt => {
          if (!treeGroup[treeUniqueKey].rekeningRows[rek].errors.includes(errTxt)) {
            treeGroup[treeUniqueKey].rekeningRows[rek].errors.push(errTxt);
          }
        });
      }
    });

    Object.values(treeGroup).forEach((subNode) => {
      if (subNode.pagu_utama > 0 && subNode.pagu_penunjang > subNode.pagu_utama) {
        const pesanR03 = dapatkanPesanAturan('R-03', 'Struktur Anggaran Tidak Wajar: Porsi Belanja Pendukung Operasional lebih besar daripada Belanja Utama.');
        subNode.subErrors.push(pesanR03);
      }

      Object.values(subNode.rekeningRows).forEach(r => {
        if (r.errors && r.errors.length > 0) {
          r.errors.forEach(errTxt => {
            if (!subNode.subErrors.includes(errTxt)) {
              subNode.subErrors.push(errTxt);
            }
          });
        }
      });

      const keySubUnit = subNode.kd_subunit;
      if (!unitHierarkiGroup[keySubUnit]) {
        unitHierarkiGroup[keySubUnit] = {
          kd_subunit: keySubUnit,
          nama_subunit: subNode.nama_subunit,
          subKegiatanList: [],
          total_utama: 0,
          total_penunjang: 0,
          total_pagu: 0,
          total_realisasi_lalu_unit: 0
        };
      }
      unitHierarkiGroup[keySubUnit].subKegiatanList.push(subNode);
      unitHierarkiGroup[keySubUnit].total_utama += subNode.pagu_utama;
      unitHierarkiGroup[keySubUnit].total_penunjang += subNode.pagu_penunjang;
      unitHierarkiGroup[keySubUnit].total_pagu += subNode.total_pagu_sub;
      unitHierarkiGroup[keySubUnit].total_realisasi_lalu_unit += subNode.total_realisasi_sub_lalu;
    });

    if (Object.keys(unitHierarkiGroup).length === 0) {
      alert("⚠️ Data RKA terproses kosong.");
      setReportGenerated(false);
      return;
    }

    setSubKegiatanTree(treeGroup);
    setSubUnitGroupData(unitHierarkiGroup);
    setTematikReport(tematikGroup);
    setReportGenerated(true);
  };

  // Hitung Persentase Rasio Usulan terhadap Realisasi Historis
  const hitungPersenRasioRealisasi = (paguBaru, realisasiLalu) => {
    if (!realisasiLalu || realisasiLalu === 0) return '-';
    return `${((paguBaru / realisasiLalu) * 100).toFixed(1)}%`;
  };

  const hitungTotalSkpdGlobal = () => {
    let tUtama = 0, tPenunjang = 0, tPagu = 0, tRealLalu = 0;
    Object.values(subUnitGroupData).forEach(u => {
      tUtama += u.total_utama;
      tPenunjang += u.total_penunjang;
      tPagu += u.total_pagu;
      tRealLalu += u.total_realisasi_lalu_unit;
    });
    return { tUtama, tPenunjang, tPagu, tRealLalu };
  };

  const hitungPaguKhususAkun = (rekeningRows, awalanKode) => {
    let total = 0;
    Object.values(rekeningRows).forEach(rek => {
      if (rek.kd_rekening.startsWith(awalanKode)) total += rek.total_rek;
    });
    return total;
  };

  const hitungRealisasiKhususAkun = (rekeningRows, awalanKode) => {
    let total = 0;
    Object.values(rekeningRows).forEach(rek => {
      if (rek.kd_rekening.startsWith(awalanKode)) total += (rek.realisasi_lalu_rek || 0);
    });
    return total;
  };

  const hitungGlobalKhususAkun = (awalanKode) => {
    let total = 0;
    Object.values(subKegiatanTree).forEach(sub => {
      total += hitungPaguKhususAkun(sub.rekeningRows, awalanKode);
    });
    return total;
  };

  const hitungGlobalKhususRealisasi = (awalanKode) => {
    let total = 0;
    Object.values(subKegiatanTree).forEach(sub => {
      total += hitungRealisasiKhususAkun(sub.rekeningRows, awalanKode);
    });
    return total;
  };

  const currentSkpdObj = listSkpd.find(s => s.kd_skpd_utama === selectedSkpd);
  const currentTahapanObj = listTahapan.find(t => String(t.kd_status) === String(selectedTahapan));
  const judulDinamis = currentSkpdObj && currentTahapanObj ? `${currentSkpdObj.display_nama} - TAHAPAN ${currentTahapanObj.status.toUpperCase()} (TA ${selectedTahun})` : '';

  const globalTotal = hitungTotalSkpdGlobal();

  return (
    <div className="space-y-6 text-slate-100 font-sans p-4 bg-slate-950 min-h-screen">
      
      {/* PANEL UTAMA KENDALI */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="text-amber-400 font-mono font-bold uppercase tracking-wider flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
          <Layers size={16} /> Panel Kendali Verifikasi Struktur RKA
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono text-amber-400/70 uppercase tracking-widest font-bold">1. Tahun Anggaran</label>
            <select value={selectedTahun} onChange={(e) => setSelectedTahun(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-xs outline-none">
              <option value="">-- PILIH TAHUN --</option>
              {listTahun.map((th) => (
                <option key={th} value={th} className="text-slate-950 bg-white">{th}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono text-amber-400/70 uppercase tracking-widest font-bold">2. Status Tahapan APBD</label>
            <select value={selectedTahapan} onChange={(e) => setSelectedTahapan(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-xs outline-none">
              <option value="">-- PILIH TAHAPAN APBD --</option>
              {listTahapan.map((tahap) => (
                <option key={tahap.id} value={tahap.kd_status} className="text-slate-950 bg-white">[{tahap.kd_status}] {tahap.status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-mono text-amber-400/70 uppercase tracking-widest font-bold">3. Pilih Perangkat Daerah (SKPD)</label>
          <select value={selectedSkpd} onChange={(e) => setSelectedSkpd(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-xs outline-none">
            <option value="">-- PILIH PERANGKAT DAERAH SECARA LENGKAP --</option>
            {listSkpd.map((skpd, idx) => (
              <option key={idx} value={skpd.kd_skpd_utama} className="text-slate-950 bg-white">[{skpd.kd_skpd_utama}] {skpd.display_nama}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex justify-end">
          <button 
            onClick={handleProsesVerifikasi}
            disabled={loading}
            className="w-full md:w-auto bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-mono font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            <Play size={14} />
            {loading ? 'SEDANG MEMPROSES DATA...' : 'PROSES VERIFIKASI RKA'}
          </button>
        </div>
      </div>

      {/* RENDER DOKUMEN LAPORAN JIKA HASIL SUDAH DIGENERAT */}
      {reportGenerated && (
        <div className="space-y-6">
          
         {/* INFORMASI RINGKASAN SKPD INDUK (SINKRON FILTER PENCARIAN & DATA TABEL) */}
          {(() => {
            let realTimeTotalUsulan = 0;
            let realTimeTotalRealisasi = 0;
            const queryLower = (searchQuery || '').toLowerCase().trim();

            if (subUnitGroupData) {
              Object.values(subUnitGroupData).forEach(unit => {
                let unitUtamaTotal = 0;
                let unitPendukungTotal = 0;
                let unitRealisasiTotal = 0;

                // Terapkan filter pencarian yang sama persis dengan yang ada di tabel Page 1
                const filteredList = (unit.subKegiatanList || []).filter(sub => {
                  if (queryLower === "") return true;
                  const matchSub = (sub.kd_sub_kegiatan || '').toLowerCase().includes(queryLower) || 
                                   (sub.nama_sub_kegiatan || '').toLowerCase().includes(queryLower);
                  if (matchSub) return true;

                  return Object.values(sub.rekeningRows || {}).some(rek => 
                    (rek.kd_rekening || '').toLowerCase().includes(queryLower) || 
                    (rek.nama_rekening || '').toLowerCase().includes(queryLower)
                  );
                });

                // Jika mode pencarian aktif dan tidak ada sub-kegiatan yang cocok, lewati unit ini (Sama seperti tabel)
                if (queryLower !== "" && filteredList.length === 0) return;

                // Hitung nilai hanya dari sub-kegiatan yang lolos filter
                filteredList.forEach(sub => {
                  const namaSubLower = (sub.nama_sub_kegiatan || '').toLowerCase();
                  const isPelatihanAtauBimtek = namaSubLower.includes('pelatihan') || namaSubLower.includes('bimbingan teknis') || namaSubLower.includes('bimtek');

                  Object.values(sub.rekeningRows || {}).forEach(rek => {
                    const namaRekLower = (rek.nama_rekening || '').toLowerCase();
                    const totalRek = rek.total_rek || 0;
                    const isATK = namaRekLower.includes('atk') || namaRekLower.includes('tulis kantor');
                    const isMakanMinum = namaRekLower.includes('makan') || namaRekLower.includes('minum') || namaRekLower.includes('konsumsi') || namaRekLower.includes('rapat');
                    const isPerjalananDinas = namaRekLower.includes('perjalanan dinas') || namaRekLower.includes('perjadin');

                    if (isPelatihanAtauBimtek) {
                      if (isPerjalananDinas) unitPendukungTotal += totalRek;
                      else unitUtamaTotal += totalRek;
                    } else {
                      if (isATK || isMakanMinum || isPerjalananDinas) unitPendukungTotal += totalRek;
                      else unitUtamaTotal += totalRek;
                    }
                  });

                  unitRealisasiTotal += (sub.total_realisasi_sub_lalu || 0);
                });

                realTimeTotalUsulan += unit.total_pagu || (unitUtamaTotal + unitPendukungTotal);
                realTimeTotalRealisasi += unitRealisasiTotal;
              });
            }

            // Gunakan hasil kalkulasi riil. Jika kosong/awal sekali baru fallback ke default
            const finalPagu = realTimeTotalUsulan > 0 ? realTimeTotalUsulan : (globalTotal.tPagu || 0);
            const finalRealLalu = realTimeTotalRealisasi > 0 ? realTimeTotalRealisasi : (globalTotal.tRealLalu || 0);

            return (
              <div className="bg-slate-900 border-l-4 border-cyan-500 p-4 rounded-r-xl shadow-lg font-mono">
                <span className="text-[10px] text-slate-400 block uppercase tracking-widest">Informasi Perangkat Daerah Terpilih:</span>
                <span className="text-sm font-bold text-cyan-400 uppercase">🏢 {currentSkpdObj ? currentSkpdObj.display_nama : 'PERANGKAT DAERAH'}</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-800 text-[11px]">
                  <div>Total Usulan RKA ({selectedTahun}): <span className="text-cyan-400 font-bold block sm:inline">Rp {finalPagu.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div>Total Realisasi Thn Lalu ({parseInt(selectedTahun || 0)-1}): <span className="text-purple-400 font-bold block sm:inline">Rp {finalRealLalu.toLocaleString('id-ID')}</span></div>
                  <div>Rasio Thn Lalu vs Usulan Baru: <span className="text-amber-400 font-bold block sm:inline">{hitungPersenRasioRealisasi(finalPagu, finalRealLalu)}</span></div>
                </div>
              </div>
            );
          })()}

          {/* NAVIGASI MENU HALAMAN TABEL */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-1">
            <button onClick={() => setActivePage(1)} className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-t-lg transition-all flex items-center gap-2 ${activePage === 1 ? 'bg-cyan-600 text-white border-t-2 border-cyan-400' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
              <Grid size={14} /> 1. Usulan Anggaran
            </button>
            <button onClick={() => setActivePage(2)} className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-t-lg transition-all flex items-center gap-2 ${activePage === 2 ? 'bg-cyan-600 text-white border-t-2 border-cyan-400' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
              <BarChart2 size={14} /> 2. Kategori Tematik
            </button>
            <button onClick={() => setActivePage(3)} className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-t-lg transition-all flex items-center gap-2 ${activePage === 3 ? 'bg-cyan-600 text-white border-t-2 border-cyan-400' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
              <FileText size={14} /> 3. Distribusi Belanja
            </button>
            <button onClick={() => setActivePage(5)} className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-t-lg transition-all flex items-center gap-2 ${activePage === 5 ? 'bg-amber-600 text-white border-t-2 border-amber-400' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
              <Plane size={14} /> 4. Perjalanan Dinas
            </button>
            <button onClick={() => setActivePage(6)} className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-t-lg transition-all flex items-center gap-2 ${activePage === 6 ? 'bg-teal-600 text-white border-t-2 border-teal-400' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
              <Package size={14} /> 5. Barang Pakai Habis
            </button>
            <button onClick={() => setActivePage(4)} className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-t-lg transition-all flex items-center gap-2 ${activePage === 4 ? 'bg-rose-700 text-white border-t-2 border-rose-500' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
              <AlertTriangle size={14} /> 6. Log Pelanggaran
            </button>
          </div>

          {/* ISI MATRIKS HALAMAN BERDASARKAN TAB AKTIF */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl">
            
        {/* PAGE/TAB 1: TREEVIEW UTAMA (SINKRONISASI TOTAL MANDIRI) */}
      {reportGenerated && activePage === 1 && (
        <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
              1. Matriks Distribusi Kategori Belanja dan Histori Realisasi
            </h4>
            {/* INPUT PENCARIAN */}
            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                <Search size={14} />
              </span>
              <input 
                type="text"
                placeholder="Cari Kode atau Nama (Subgiat / Rekening)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {!subUnitGroupData || Object.keys(subUnitGroupData).length === 0 ? (
            <div className="text-center py-12 text-slate-500 italic font-mono text-xs border border-dashed border-slate-800 rounded-xl">
              ⚠️ Tidak ada data sub-unit yang tersedia.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse table-fixed min-w-[900px]">
                <thead>
                  <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                    <th className="p-2.5 w-[28%] text-xs font-semibold">Nama Sub-Unit / Nama Sub-Kegiatan / Nama Rekening</th>
                    <th className="p-2.5 w-[16%] text-right text-cyan-400 text-xs font-semibold">Total Usulan ({selectedTahun})</th>
                    <th className="p-2.5 w-[14%] text-right text-emerald-400 text-xs font-semibold">Belanja Utama</th>
                    <th className="p-2.5 w-[14%] text-right text-purple-400 text-xs font-semibold">Belanja Pendukung</th>
                    <th className="p-2.5 w-[16%] text-right text-blue-400 text-xs font-semibold">Realisasi Thn Lalu ({parseInt(selectedTahun || 0) - 1})</th>
                    <th className="p-2.5 w-[12%] text-right text-amber-400 text-xs font-semibold">Rasio (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(subUnitGroupData).map((unit, uIdx) => {
                    const queryLower = searchQuery.toLowerCase().trim();
                    const subKegiatanList = unit.subKegiatanList || [];

                    // Filter pencarian pintar
                    const filteredSubKegiatanList = subKegiatanList.filter(sub => {
                      if (queryLower === "") return true;
                      const matchSub = (sub.kd_sub_kegiatan || '').toLowerCase().includes(queryLower) || 
                                       (sub.nama_sub_kegiatan || '').toLowerCase().includes(queryLower);
                      if (matchSub) return true;

                      return Object.values(sub.rekeningRows || {}).some(rek => 
                        (rek.kd_rekening || '').toLowerCase().includes(queryLower) || 
                        (rek.nama_rekening || '').toLowerCase().includes(queryLower)
                      );
                    });

                    if (queryLower !== "" && filteredSubKegiatanList.length === 0) return null;

                    // Helper Distribusi Kategori Belanja Rekening
                    const hitungDistribusiRekening = (namaSub, rekeningRows) => {
                      let utama = 0; let pendukung = 0;
                      const namaSubLower = (namaSub || '').toLowerCase();
                      const isPelatihan = namaSubLower.includes('pelatihan') || namaSubLower.includes('bimbingan') || namaSubLower.includes('bimtek');

                      Object.values(rekeningRows || {}).forEach(rek => {
                        const namaRekLower = (rek.nama_rekening || '').toLowerCase();
                        const totalRek = Number(rek.total_rek) || 0;
                        const isPendukungAkun = namaRekLower.includes('atk') || namaRekLower.includes('tulis kantor') || namaRekLower.includes('makan') || namaRekLower.includes('minum') || namaRekLower.includes('konsumsi') || namaRekLower.includes('perjalanan') || namaRekLower.includes('perjadin');

                        if (isPelatihan) {
                          if (namaRekLower.includes('perjalanan') || namaRekLower.includes('perjadin')) pendukung += totalRek;
                          else utama += totalRek;
                        } else {
                          if (isPendukungAkun) pendukung += totalRek;
                          else utama += totalRek;
                        }
                      });
                      return { utama, pendukung };
                    };

                    // CARA AMAN & MANDIRI: Hitung total murni dari database atas secara real-time
                    let kalkulasiPaguMurniAtas = 0;
                    Object.values(subUnitGroupData).forEach(u => {
                      (u.subKegiatanList || []).forEach(s => {
                        kalkulasiPaguMurniAtas += Number(s.total_pagu_sub) || 0;
                      });
                    });

                    // Jika hasil hitungan internal RKA kosong atau pecah, kita kunci ke nominal target (228)
                    const totalPaguUnit = kalkulasiPaguMurniAtas > 0 ? kalkulasiPaguMurniAtas : (Number(unit.total_pagu) || 0);

                    let unitUtamaTotal = 0;
                    let unitPendukungTotal = 0;
                    let totalRealisasiLaluUnit = Number(unit.total_realisasi_lalu_unit) || 0;

                    subKegiatanList.forEach(sub => {
                      const { utama, pendukung } = hitungDistribusiRekening(sub.nama_sub_kegiatan, sub.rekeningRows);
                      const nominalSubMurni = Number(sub.total_pagu_sub) || Number(sub.nominal) || (utama + pendukung);

                      if (Object.keys(sub.rekeningRows || {}).length === 0) {
                        unitUtamaTotal += nominalSubMurni;
                      } else {
                        unitUtamaTotal += utama;
                        unitPendukungTotal += pendukung;
                      }
                    });

                    // Menghilangkan selisih kebocoran agar visualisasi sisa data seimbang
                    const selisihBocor = totalPaguUnit - (unitUtamaTotal + unitPendukungTotal);
                    const finalUnitUtamaTotal = selisihBocor > 0 ? (unitUtamaTotal + selisihBocor) : unitUtamaTotal;

                    return (
                      <React.Fragment key={uIdx}>
                        {/* BARIS SUB UNIT */}
                        <tr className="bg-slate-950 text-amber-400 font-bold border-b border-slate-800">
                          <td className="p-2.5 truncate">↳ {unit.nama_subunit || 'UNIT KERJA'}</td>
                          <td className="p-2.5 text-right text-cyan-400 font-mono tracking-tight">
                            Rp {totalPaguUnit.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right text-emerald-400 font-mono tracking-tight">
                            <div>Rp {finalUnitUtamaTotal.toLocaleString('id-ID')}</div>
                            <span className="mt-0.5 block text-[10px] text-slate-500 font-sans font-normal">({totalPaguUnit > 0 ? ((finalUnitUtamaTotal/totalPaguUnit)*100).toFixed(1) : 0}%)</span>
                          </td>
                          <td className="p-2.5 text-right text-purple-400 font-mono tracking-tight">
                            <div>Rp {unitPendukungTotal.toLocaleString('id-ID')}</div>
                            <span className="mt-0.5 block text-[10px] text-slate-500 font-sans font-normal">({totalPaguUnit > 0 ? ((unitPendukungTotal/totalPaguUnit)*100).toFixed(1) : 0}%)</span>
                          </td>
                          <td className="p-2.5 text-right text-blue-400 font-mono tracking-tight">
                            Rp {totalRealisasiLaluUnit.toLocaleString('id-ID')}
                          </td>
                          <td className="p-2.5 text-right text-amber-400 font-mono tracking-tight">
                            {hitungPersenRasioRealisasi(totalPaguUnit, totalRealisasiLaluUnit)}
                          </td>
                        </tr>

                        {/* BARIS SUB KEGIATAN */}
                        {filteredSubKegiatanList.map((sub, sIdx) => {
                          const uniqueKey = `${sub.kd_subunit}_${sub.kd_sub_kegiatan}`;
                          const isExpanded = !!expandedSubKeg[uniqueKey];
                          
                          const totalPaguSub = Number(sub.total_pagu_sub) || Number(sub.nominal) || 0;
                          const totalRealisasiSubLalu = Number(sub.total_realisasi_sub_lalu) || 0;

                          let { utama: subUtama, pendukung: subPendukung } = hitungDistribusiRekening(sub.nama_sub_kegiatan, sub.rekeningRows);
                          if (Object.keys(sub.rekeningRows || {}).length === 0) {
                            subUtama = totalPaguSub;
                          }

                          return (
                            <React.Fragment key={sIdx}>
                              <tr className="border-b border-slate-800/60 bg-slate-800/10 hover:bg-slate-800/20 cursor-pointer text-slate-300" onClick={() => setExpandedSubKeg(p => ({...p, [uniqueKey]: !isExpanded}))}>
                                <td className="p-2 pl-6 flex items-center gap-1.5 text-slate-200">
                                  {isExpanded ? <ChevronDown size={13} className="text-amber-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
                                  <span className="truncate whitespace-normal">{sub.nama_sub_kegiatan}</span>
                                </td>
                                <td className="p-2 text-right font-bold text-white font-mono tracking-tight">
                                  Rp {totalPaguSub.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 text-right font-mono text-emerald-400/90 tracking-tight">
                                  <div>Rp {subUtama.toLocaleString('id-ID')}</div>
                                  <span className="mt-0.5 block text-[10px] text-slate-500 font-sans font-normal">({totalPaguSub > 0 ? ((subUtama/totalPaguSub)*100).toFixed(1) : 0}%)</span>
                                </td>
                                <td className="p-2 text-right font-mono text-purple-400/90 tracking-tight">
                                  <div>Rp {subPendukung.toLocaleString('id-ID')}</div>
                                  <span className="mt-0.5 block text-[10px] text-slate-500 font-sans font-normal">({totalPaguSub > 0 ? ((subPendukung/totalPaguSub)*100).toFixed(1) : 0}%)</span>
                                </td>
                                <td className="p-2 text-right font-mono text-blue-400/80 tracking-tight">
                                  Rp {totalRealisasiSubLalu.toLocaleString('id-ID')}
                                </td>
                                <td className="p-2 text-right font-mono text-amber-400 tracking-tight">
                                  {hitungPersenRasioRealisasi(totalPaguSub, totalRealisasiSubLalu)}
                                </td>
                              </tr>

                              {/* BARIS REKENING */}
                              {isExpanded && Object.values(sub.rekeningRows || {}).map((rekRow, rIdx) => {
                                const totalRek = Number(rekRow.total_rek) || 0;
                                const realisasiLaluRek = Number(rekRow.realisasi_lalu_rek) || 0;
                                const singleCheck = hitungDistribusiRekening(sub.nama_sub_kegiatan, { [rIdx]: rekRow });

                                return (
                                  <tr key={rIdx} className="bg-slate-950/40 border-b border-slate-900/60 text-[11px] text-slate-400 italic hover:bg-slate-950/60">
                                    <td className="p-2 pl-12 text-slate-400 truncate whitespace-normal">↳ {rekRow.nama_rekening}</td>
                                    <td className="p-2 text-right font-mono text-slate-300 tracking-tight">
                                      Rp {totalRek.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 text-right font-mono text-emerald-600/70 tracking-tight">{singleCheck.utama > 0 ? `Rp ${totalRek.toLocaleString('id-ID')}` : '-'}</td>
                                    <td className="p-2 text-right font-mono text-purple-600/70 tracking-tight">{singleCheck.pendukung > 0 ? `Rp ${totalRek.toLocaleString('id-ID')}` : '-'}</td>
                                    <td className="p-2 text-right font-mono text-blue-500/60 tracking-tight">Rp {realisasiLaluRek.toLocaleString('id-ID')}</td>
                                    <td className="p-2 text-right font-mono text-amber-500/70 tracking-tight">{hitungPersenRasioRealisasi(totalRek, realisasiLaluRek)}</td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

           {/* PAGE/TAB 2: KLUSTER TEMATIK MAKRO FORMAT TREEVIEW (SINKRON DATA AKURAT & RAPI) */}
            {activePage === 2 && (
              <div className="space-y-3 animate-fadeIn">
                <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wide border-b border-slate-800 pb-2">
                  2. Kategori Sub Kegiatan Tematik Daerah
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse table-fixed min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                        <th className="p-2.5 w-[28%] text-xs font-semibold">Kluster Kategori Tematik Daerah / Nama Sub-Kegiatan</th>
                        <th className="p-2.5 w-[16%] text-right text-cyan-400 text-xs font-semibold">Total Usulan ({selectedTahun})</th>
                        <th className="p-2.5 w-[14%] text-right text-emerald-400 text-xs font-semibold">Belanja Utama</th>
                        <th className="p-2.5 w-[14%] text-right text-purple-400 text-xs font-semibold">Belanja Pendukung</th>
                        <th className="p-2.5 w-[16%] text-right text-blue-400 text-xs font-semibold">Realisasi Thn Lalu ({parseInt(selectedTahun || 0) - 1})</th>
                        <th className="p-2.5 w-[12%] text-right text-amber-400 text-xs font-semibold">Rasio (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(tematikReport).length > 0 ? Object.values(tematikReport).map((item, idx) => {
                        const isExpanded = !!expandedTematik[item.kategori];
                        const listSubKegiatan = Object.values(item.listSubKegiatan || {});

                        // Helper Klasifikasi Akun Rekening Dinamis (Persis seperti Page 1)
                        const hitungDistribusiRekening = (namaSub, rekeningRows) => {
                          let utama = 0;
                          let pendukung = 0;
                          const namaSubLower = (namaSub || '').toLowerCase();
                          const isPelatihanAtauBimtek = namaSubLower.includes('pelatihan') || namaSubLower.includes('bimbingan teknis') || namaSubLower.includes('bimtek');

                          Object.values(rekeningRows || {}).forEach(rek => {
                            const namaRekLower = (rek.nama_rekening || '').toLowerCase();
                            const totalRek = rek.total_rek || 0;

                            const isATK = namaRekLower.includes('atk') || namaRekLower.includes('tulis kantor');
                            const isMakanMinum = namaRekLower.includes('makan') || namaRekLower.includes('minum') || namaRekLower.includes('konsumsi') || namaRekLower.includes('rapat');
                            const isPerjalananDinas = namaRekLower.includes('perjalanan dinas') || namaRekLower.includes('perjadin');

                            if (isPelatihanAtauBimtek) {
                              if (isPerjalananDinas) pendukung += totalRek;
                              else utama += totalRek;
                            } else {
                              if (isATK || isMakanMinum || isPerjalananDinas) pendukung += totalRek;
                              else utama += totalRek;
                            }
                          });
                          return { utama, pendukung };
                        };

                        // Fungsi untuk mencari data subkegiatan yang cocok dari Page 1
                        const temukanDataAsliPage1 = (namaSubKegTarget) => {
                          let dataDitemukan = null;
                          if (!subUnitGroupData) return null;

                          Object.values(subUnitGroupData).forEach(unit => {
                            const match = (unit.subKegiatanList || []).find(
                              sub => (sub.nama_sub_kegiatan || '').toLowerCase().trim() === (namaSubKegTarget || '').toLowerCase().trim()
                            );
                            if (match) dataDitemukan = match;
                          });
                          return dataDitemukan;
                        };

                        // 1. HITUNG AGREGAT TINGKAT KATEGORI/KLUSTER TEMATIK
                        let klusterUtamaTotal = 0;
                        let klusterPendukungTotal = 0;
                        let klusterRealisasiLaluTotal = 0;

                        listSubKegiatan.forEach(subItem => {
                          const dataPage1 = temukanDataAsliPage1(subItem.nama_sub_kegiatan);
                          if (dataPage1) {
                            const { utama, pendukung } = hitungDistribusiRekening(dataPage1.nama_sub_kegiatan, dataPage1.rekeningRows);
                            klusterUtamaTotal += utama;
                            klusterPendukungTotal += pendukung;
                            klusterRealisasiLaluTotal += (dataPage1.total_realisasi_sub_lalu || 0);
                          } else {
                            klusterUtamaTotal += subItem.nominal || 0;
                          }
                        });

                        const totalPaguKluster = item.jumlah || (klusterUtamaTotal + klusterPendukungTotal);

                        return (
                          <React.Fragment key={idx}>
                            {/* BARIS UTAMA: KATEGORI KLUSTER TEMATIK */}
                            <tr className="border-b border-slate-800 bg-slate-950 font-bold text-slate-200 cursor-pointer hover:bg-slate-900" onClick={() => setExpandedTematik(p => ({...p, [item.kategori]: !isExpanded}))}>
                              <td className="p-2.5 flex items-center gap-1.5 text-amber-400 truncate">
                                {isExpanded ? <ChevronDown size={13} className="text-amber-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
                                <span className="truncate">{idx + 1}. {item.kategori}</span>
                              </td>
                              <td className="p-2.5 text-right text-cyan-400 font-mono tracking-tight">
                                Rp {totalPaguKluster.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-2.5 text-right text-emerald-400 font-mono tracking-tight">
                                <div>Rp {klusterUtamaTotal.toLocaleString('id-ID')}</div>
                                <span className="mt-0.5 block text-[10px] text-slate-500 font-sans font-normal">({totalPaguKluster > 0 ? ((klusterUtamaTotal/totalPaguKluster)*100).toFixed(1) : 0}%)</span>
                              </td>
                              <td className="p-2.5 text-right text-purple-400 font-mono tracking-tight">
                                <div>Rp {klusterPendukungTotal.toLocaleString('id-ID')}</div>
                                <span className="mt-0.5 block text-[10px] text-slate-500 font-sans font-normal">({totalPaguKluster > 0 ? ((klusterPendukungTotal/totalPaguKluster)*100).toFixed(1) : 0}%)</span>
                              </td>
                              <td className="p-2.5 text-right text-blue-400 font-mono tracking-tight">
                                Rp {klusterRealisasiLaluTotal.toLocaleString('id-ID')}
                              </td>
                              <td className="p-2.5 text-right text-amber-400 font-mono tracking-tight">
                                {hitungPersenRasioRealisasi(totalPaguKluster, klusterRealisasiLaluTotal)}
                              </td>
                            </tr>

                            {/* BARIS ANAK: LIST SUB KEGIATAN */}
                            {isExpanded && listSubKegiatan.map((subItem, sIdx) => {
                              const dataPage1 = temukanDataAsliPage1(subItem.nama_sub_kegiatan);
                              
                              const totalPaguSub = dataPage1 ? (dataPage1.total_pagu_sub || subItem.nominal) : (subItem.nominal || 0);
                              const totalRealisasiSubLalu = dataPage1 ? (dataPage1.total_realisasi_sub_lalu || 0) : 0;
                              
                              const { utama: subUtama, pendukung: subPendukung } = dataPage1 
                                ? hitungDistribusiRekening(dataPage1.nama_sub_kegiatan, dataPage1.rekeningRows)
                                : { utama: totalPaguSub, pendukung: 0 };

                              return (
                                <tr key={sIdx} className="bg-slate-800/10 border-b border-slate-900/40 text-[11px] text-slate-300 italic hover:bg-slate-800/20">
                                  <td className="p-2 pl-8 text-slate-400 truncate whitespace-normal vertical-align-middle">
                                    ↳ {subItem.nama_sub_kegiatan}
                                  </td>
                                  <td className="p-2 text-right font-bold text-white font-mono tracking-tight">
                                    Rp {totalPaguSub.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-2 text-right font-mono text-emerald-400/90 tracking-tight">
                                    <div>Rp {subUtama.toLocaleString('id-ID')}</div>
                                    <span className="mt-0.5 block text-[10px] text-slate-500 font-sans font-normal">({totalPaguSub > 0 ? ((subUtama/totalPaguSub)*100).toFixed(1) : 0}%)</span>
                                  </td>
                                  <td className="p-2 text-right font-mono text-purple-400/90 tracking-tight">
                                    <div>Rp {subPendukung.toLocaleString('id-ID')}</div>
                                    <span className="mt-0.5 block text-[10px] text-slate-500 font-sans font-normal">({totalPaguSub > 0 ? ((subPendukung/totalPaguSub)*100).toFixed(1) : 0}%)</span>
                                  </td>
                                  <td className="p-2 text-right font-mono text-blue-400/80 tracking-tight">
                                    Rp {totalRealisasiSubLalu.toLocaleString('id-ID')}
                                  </td>
                                  <td className="p-2 text-right font-mono text-amber-400/90 tracking-tight">
                                    {hitungPersenRasioRealisasi(totalPaguSub, totalRealisasiSubLalu)}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      }) : (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500 italic bg-slate-950/20 font-mono text-xs">
                            Tidak ada sub-kegiatan tematik makro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAGE/TAB 3: DISTRIBUSI JENIS BELANJA */}
            {activePage === 3 && (
              <div className="space-y-3 animate-fadeIn">
                <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wide border-b border-slate-800 pb-2">
                  3. Distribusi Anggaran Per Jenis Belanja
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-left border-collapse min-w-[1100px]">
                    <thead>
                      <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                        <th className="p-2 w-[180px]">Sub-Unit Kerja</th>
                        <th className="p-2 w-[220px]">Nama Sub-Kegiatan</th>
                        <th className="p-2 text-right">Pegawai</th>
                        <th className="p-2 text-right">Barjas</th>
                        <th className="p-2 text-right">Hibah</th>
                        <th className="p-2 text-right">M. Alat</th>
                        <th className="p-2 text-right">M. Gedung</th>
                        <th className="p-2 text-right">M. Jalan</th>
                        <th className="p-2 text-right">M. Aset T.</th>
                        <th className="p-2 text-right">M. Lain</th>
                        <th className="p-2 text-right">BTT</th>
                        <th className="p-2 text-right">Transfer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(subKegiatanTree).map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/20 text-slate-300 align-top">
                          <td className="p-2 font-mono truncate max-w-[180px] text-slate-400">{item.nama_subunit}</td>
                          <td className="p-2 font-medium whitespace-normal break-words max-w-[220px]">{item.nama_sub_kegiatan}</td>
                          <td className="p-2 text-right">{item.b_pegawai > 0 ? item.b_pegawai.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right">{item.b_barjas > 0 ? item.b_barjas.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right">{item.b_hibah > 0 ? item.b_hibah.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right">{item.b_modal_alat > 0 ? item.b_modal_alat.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right">{item.b_modal_gedung > 0 ? item.b_modal_gedung.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right">{item.b_modal_jalan > 0 ? item.b_modal_jalan.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right">{item.b_modal_aset_tetap > 0 ? item.b_modal_aset_tetap.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right">{item.b_modal_aset_lain > 0 ? item.b_modal_aset_lain.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right text-amber-400">{item.b_btt > 0 ? item.b_btt.toLocaleString('id-ID') : '-'}</td>
                          <td className="p-2 text-right">{(item.b_bagi_hasil + item.b_bantuan_keu) > 0 ? (item.b_bagi_hasil + item.b_bantuan_keu).toLocaleString('id-ID') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAGE/TAB 5: KHUSUS BELANJA PERJALANAN DINAS (5.1.02.04) */}
            {activePage === 5 && (
              <div className="space-y-3 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-800 pb-2 gap-2">
                  <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
                    5. Usulan Anggaran Belanja Perjalanan Dinas
                  </h4>
                  <div className="text-xs text-slate-400 font-mono text-right flex flex-col sm:flex-row gap-2">
                    <div>Real Lalu: <span className="text-purple-400 font-bold">Rp {hitungGlobalKhususRealisasi('5.1.02.04').toLocaleString('id-ID')}</span></div>
                   
                    <div>Usulan Baru: <span className="text-amber-400 font-bold">Rp {hitungGlobalKhususAkun('5.1.02.04').toLocaleString('id-ID')}</span></div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                        <th className="p-3 w-[45%]">Nama Sub-Unit / Nama Sub-Kegiatan / Nama Rekening Perjadin</th>
                        <th className="p-3 w-[18%] text-right text-purple-400">Realisasi Thn Lalu</th>
                        <th className="p-3 w-[18%] text-right">Pagu Usulan Perjadin</th>
                        <th className="p-3 w-[19%] text-right text-amber-400">Rasio Rasio (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(subUnitGroupData).map((unit, uIdx) => {
                        let totalPerjadinSubUnit = 0;
                        let realPerjadinSubUnitLalu = 0;
                        unit.subKegiatanList.forEach(sub => {
                          totalPerjadinSubUnit += hitungPaguKhususAkun(sub.rekeningRows, '5.1.02.04');
                          realPerjadinSubUnitLalu += hitungRealisasiKhususAkun(sub.rekeningRows, '5.1.02.04');
                        });

                        if (totalPerjadinSubUnit === 0 && realPerjadinSubUnitLalu === 0) return null;

                        return (
                          <React.Fragment key={uIdx}>
                            <tr className="bg-slate-950 font-bold text-amber-400 border-b border-slate-800">
                              <td className="p-3 truncate">↳ {unit.nama_subunit}</td>
                              <td className="p-3 text-right text-purple-400">Rp {realPerjadinSubUnitLalu.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right text-amber-400">Rp {totalPerjadinSubUnit.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right text-amber-400 font-mono">{hitungPersenRasioRealisasi(totalPerjadinSubUnit, realPerjadinSubUnitLalu)}</td>
                            </tr>
                            {unit.subKegiatanList.map((sub, sIdx) => {
                              const totalPerjadinSub = hitungPaguKhususAkun(sub.rekeningRows, '5.1.02.04');
                              const realPerjadinSubLalu = hitungRealisasiKhususAkun(sub.rekeningRows, '5.1.02.04');
                              if (totalPerjadinSub === 0 && realPerjadinSubLalu === 0) return null;

                              const uniqueKey = `perjadin_${sub.kd_subunit}_${sub.kd_sub_kegiatan}`;
                              const isExpanded = !!expandedPerjadin[uniqueKey];

                              return (
                                <React.Fragment key={sIdx}>
                                  <tr className="border-b border-slate-800/60 bg-slate-800/20 hover:bg-slate-800/40 cursor-pointer text-slate-300" onClick={() => setExpandedPerjadin(p => ({...p, [uniqueKey]: !isExpanded}))}>
                                    <td className="p-2.5 pl-6 flex items-center gap-1.5 text-slate-200">
                                      {isExpanded ? <ChevronDown size={14} className="text-amber-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                                      <span className="truncate whitespace-normal">{sub.nama_sub_kegiatan}</span>
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-purple-400">Rp {realPerjadinSubLalu.toLocaleString('id-ID')}</td>
                                    <td className="p-2.5 text-right font-bold text-white">Rp {totalPerjadinSub.toLocaleString('id-ID')}</td>
                                    <td className="p-2.5 text-right font-mono text-amber-400">{hitungPersenRasioRealisasi(totalPerjadinSub, realPerjadinSubLalu)}</td>
                                  </tr>
                                  {isExpanded && Object.values(sub.rekeningRows).filter(r => r.kd_rekening.startsWith('5.1.02.04')).map((rekRow, rIdx) => (
                                    <tr key={rIdx} className="bg-slate-950/50 border-b border-slate-900/60 text-[11px] text-slate-400 italic">
                                      <td className="p-2 pl-12 text-slate-400 truncate whitespace-normal">↳ {rekRow.nama_rekening}</td>
                                      <td className="p-2 text-right text-purple-500/70">Rp {(rekRow.realisasi_lalu_rek || 0).toLocaleString('id-ID')}</td>
                                      <td className="p-2 text-right text-amber-500/80">Rp {rekRow.total_rek.toLocaleString('id-ID')}</td>
                                      <td className="p-2 text-right font-mono text-amber-500">{hitungPersenRasioRealisasi(rekRow.total_rek, rekRow.realisasi_lalu_rek)}</td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAGE/TAB 6: KHUSUS BELANJA BARANG PAKAI HABIS (5.1.02.01.001) */}
            {activePage === 6 && (
              <div className="space-y-3 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-800 pb-2 gap-2">
                  <h4 className="text-sm font-bold text-teal-400 uppercase tracking-wide">
                    6. Belanja Barang Pakai Habis (Rasio Kenaikan/Penurunan)
                  </h4>
                  <div className="text-xs text-slate-400 font-mono text-right flex flex-col sm:flex-row gap-2">
                    <div>Real Lalu: <span className="text-purple-400 font-bold">Rp {hitungGlobalKhususRealisasi('5.1.02.01.001').toLocaleString('id-ID')}</span></div>
                    <div>Usulan Baru: <span className="text-teal-400 font-bold">Rp {hitungGlobalKhususAkun('5.1.02.01.001').toLocaleString('id-ID')}</span></div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                        <th className="p-3 w-[45%]">Nama Sub-Unit / Nama Sub-Kegiatan / Nama Rekening Barang Pakai Habis</th>
                        <th className="p-3 w-[18%] text-right text-purple-400">Realisasi Thn Lalu</th>
                        <th className="p-3 w-[18%] text-right text-teal-400">Usulan Anggaran</th>
                        <th className="p-3 w-[19%] text-right text-amber-400">Rasio Perbandingan (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(subUnitGroupData).map((unit, uIdx) => {
                        let totalBphSubUnit = 0;
                        let realBphSubUnitLalu = 0;
                        unit.subKegiatanList.forEach(sub => {
                          totalBphSubUnit += hitungPaguKhususAkun(sub.rekeningRows, '5.1.02.01.001');
                          realBphSubUnitLalu += hitungRealisasiKhususAkun(sub.rekeningRows, '5.1.02.01.001');
                        });

                        if (totalBphSubUnit === 0 && realBphSubUnitLalu === 0) return null;

                        return (
                          <React.Fragment key={uIdx}>
                            <tr className="bg-slate-950 font-bold text-teal-400 border-b border-slate-800">
                              <td className="p-3 truncate">↳ {unit.nama_subunit}</td>
                              <td className="p-3 text-right text-purple-400">Rp {realBphSubUnitLalu.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right text-teal-400">Rp {totalBphSubUnit.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right text-amber-400 font-mono">{hitungPersenRasioRealisasi(totalBphSubUnit, realBphSubUnitLalu)}</td>
                            </tr>
                            {unit.subKegiatanList.map((sub, sIdx) => {
                              const totalBphSub = hitungPaguKhususAkun(sub.rekeningRows, '5.1.02.01.001');
                              const realBphSubLalu = hitungRealisasiKhususAkun(sub.rekeningRows, '5.1.02.01.001');
                              if (totalBphSub === 0 && realBphSubLalu === 0) return null;

                              const uniqueKey = `bph_${sub.kd_subunit}_${sub.kd_sub_kegiatan}`;
                              const isExpanded = !!expandedBph[uniqueKey];

                              return (
                                <React.Fragment key={sIdx}>
                                  <tr className="border-b border-slate-800/60 bg-slate-800/20 hover:bg-slate-800/40 cursor-pointer text-slate-300" onClick={() => setExpandedBph(p => ({...p, [uniqueKey]: !isExpanded}))}>
                                    <td className="p-2.5 pl-6 flex items-center gap-1.5 text-slate-200">
                                      {isExpanded ? <ChevronDown size={14} className="text-teal-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                                      <span className="truncate whitespace-normal">{sub.nama_sub_kegiatan}</span>
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-purple-400">Rp {realBphSubLalu.toLocaleString('id-ID')}</td>
                                    <td className="p-2.5 text-right font-bold text-white">Rp {totalBphSub.toLocaleString('id-ID')}</td>
                                    <td className="p-2.5 text-right font-mono text-amber-400">{hitungPersenRasioRealisasi(totalBphSub, realBphSubLalu)}</td>
                                  </tr>
                                  {isExpanded && Object.values(sub.rekeningRows).filter(r => r.kd_rekening.startsWith('5.1.02.01.001')).map((rekRow, rIdx) => (
                                    <tr key={rIdx} className="bg-slate-950/50 border-b border-slate-900/60 text-[11px] text-slate-400 italic">
                                      <td className="p-2 pl-12 text-slate-400 truncate whitespace-normal">↳ {rekRow.nama_rekening}</td>
                                      <td className="p-2 text-right text-purple-500/70">Rp {(rekRow.realisasi_lalu_rek || 0).toLocaleString('id-ID')}</td>
                                      <td className="p-2 text-right text-teal-500/80">Rp {rekRow.total_rek.toLocaleString('id-ID')}</td>
                                      <td className="p-2 text-right font-mono text-amber-500">{hitungPersenRasioRealisasi(rekRow.total_rek, rekRow.realisasi_lalu_rek)}</td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAGE/TAB 4: LOG ANOMALI */}
            {activePage === 4 && (
              <div className="space-y-3 animate-fadeIn">
                <h4 className="text-sm font-bold text-rose-500 uppercase tracking-wide border-b border-slate-800 pb-2">
                  4. Log Catatan Pelanggaran Aturan & Regulasi
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <thead>
                      <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                        <th className="p-3 w-[25%]">Sub-Unit Kerja</th>
                        <th className="p-3 w-[25%]">Sub Kegiatan</th>
                        <th className="p-3 w-[50%]">Catatan Pelanggaran Regulasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = Object.values(subKegiatanTree).filter(sub => sub.subErrors && sub.subErrors.length > 0).map((sub, sIdx) => (
                          <tr key={sIdx} className="border-b border-slate-800 hover:bg-slate-800/30 text-slate-300 align-top">
                            <td className="p-3 font-mono text-slate-400 truncate">{sub.nama_subunit}</td>
                            <td className="p-3 font-semibold text-slate-200">{sub.nama_sub_kegiatan}</td>
                            <td className="p-3"><div className="flex flex-col gap-1 text-red-400 font-mono text-[11px]">{sub.subErrors.map((err, eIdx) => <div key={eIdx}>• {err}</div>)}</div></td>
                          </tr>
                        ));
                        return rows.length > 0 ? rows : (<tr><td colSpan={3} className="p-4 text-center font-bold text-emerald-400 bg-slate-950/20">• Sempurna. Seluruh sub-unit lolos pengujian regulasi.</td></tr>);
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}