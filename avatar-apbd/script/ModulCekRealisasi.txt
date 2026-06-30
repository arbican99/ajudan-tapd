import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, AlertTriangle, Printer, ChevronDown, ChevronRight, Folder, FileText, ArrowRightLeft, ShieldCheck, Landmark, Percent, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function ModulCekRealisasi() {
  const [listTahapan, setListTahapan] = useState([]);
  const [listSkpd, setListSkpd] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // State Filter Pengunci
  const [selectedTahapan, setSelectedTahapan] = useState('');
  const [selectedSkpd, setSelectedSkpd] = useState(''); 
  const [namaFile, setNamaFile] = useState('');
  
  // State Output Hasil Komparasi Utama
  const [realisasiTree, setRealisasiTree] = useState({});
  const [expandedNodes, setExpandedNodes] = useState({});
  const [summaryData, setSummaryData] = useState(null);
  const [reportGenerated, setReportGenerated] = useState(false);

  // State Output Analisis Kepatuhan Makro (Mandatory, SPM, Urusan)
  const [complianceData, setComplianceData] = useState({
    mandatory: {
      pendidikan: { total_usulan: 0, total_anggaran: 0, total_realisasi: 0, subgiat: [] },
      kesehatan: { total_usulan: 0, total_anggaran: 0, total_realisasi: 0, subgiat: [] },
      infrastruktur: { total_usulan: 0, total_anggaran: 0, total_realisasi: 0, subgiat: [] }
    },
    spm: { total_usulan: 0, total_anggaran: 0, total_realisasi: 0, subgiat: [] },
    urusan: {}
  });

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const { data: statusData } = await supabase.from('tblstatus').select('*').order('kd_status');
      setListTahapan(statusData || []);

      const { data: skpdData } = await supabase.from('tblskpd').select('*');
      const cleanedSkpd = (skpdData || []).map(item => {
        const rawCode = String(item.kd_skpd || '').trim();
        const parts = rawCode.split('.');
        const mainSkpdCode = parts.slice(0, 6).join('.'); 
        let namaResmi = String(item.nm_skpd || 'Unit Perangkat Daerah').trim();
        if (namaResmi.toUpperCase().includes('DINAS KESEHATAN')) namaResmi = 'DINAS KESEHATAN';
        return { ...item, kd_skpd_utama: mainSkpdCode, display_nama: namaResmi };
      });

      const uniqueSkpdInduk = cleanedSkpd.filter((value, index, self) =>
        index === self.findIndex((t) => t.kd_skpd_utama === value.kd_skpd_utama)
      ).sort((a, b) => a.kd_skpd_utama.localeCompare(b.kd_skpd_utama));

      setListSkpd(uniqueSkpdInduk);
    } catch (err) {
      console.error('Gagal sinkronisasi data master:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (key) => {
    setExpandedNodes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUploadExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!selectedTahapan || !selectedSkpd) {
      alert('PERINGATAN: Silakan tentukan Status Tahapan APBD dan SKPD Induk terlebih dahulu sebelum mengunggah berkas!');
      e.target.value = null;
      setNamaFile('');
      setReportGenerated(false);
      return;
    }

    setNamaFile(file.name);
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData = XLSX.utils.sheet_to_json(ws);
        if (rawData.length === 0) {
          alert('File Excel kosong atau format tidak sesuai.');
          setLoading(false);
          return;
        }

        await prosesKomparasiRkaRealisasi(rawData);
      } catch (err) {
        alert('Gagal memproses file Excel.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsBinaryString(file);
  };

  const hitungPersentaseDeviasi = (nilaiBaru, nilaiLama) => {
    if (!nilaiLama || nilaiLama === 0) return 0;
    return ((nilaiBaru - nilaiLama) / nilaiLama) * 100;
  };

  const prosesKomparasiRkaRealisasi = async (dataRows) => {
    const tahunBerjalan = 2026; 
    const tahunLalu = tahunBerjalan - 1;

    const objekTahapan = listTahapan.find(t => String(t.id) === String(selectedTahapan));
    const labelTahapan = objekTahapan ? String(objekTahapan.status).toUpperCase() : '';
    const isMurniApbd = labelTahapan.includes('APBD') && !labelTahapan.includes('PERUBAHAN');

    let rincianTahunDitarik = [tahunLalu];
    if (!isMurniApbd) {
      rincianTahunDitarik.push(tahunBerjalan); 
    }

    const { data: dbRealisasi, error } = await supabase
      .from('data_realisasi') 
      .select('*')
      .in('tahun', rincianTahunDitarik)
      .ilike('Kode_Skpd', `${selectedSkpd}%`);

    if (error) {
      console.error("Gagal mengambil histori data_realisasi:", error);
    }

    const historiNamaMap = {};
    if (dbRealisasi && dbRealisasi.length > 0) {
      dbRealisasi.forEach(item => {
        const namaSubKey = String(item.Nama_Subgiat || '').trim().toUpperCase();
        const namaRekKey = String(item.Nama_Rekening || '').trim().toUpperCase();
        const nominalAnggaran = parseFloat(item.Anggaran || 0);
        const nominalRealisasi = parseFloat(item.Realisasi || 0);

        if (namaSubKey) {
          if (!historiNamaMap[namaSubKey]) {
            historiNamaMap[namaSubKey] = {
              total_anggaran_histori: 0,
              total_realisasi_histori: 0,
              rekening: {}
            };
          }
          historiNamaMap[namaSubKey].total_anggaran_histori += nominalAnggaran;
          historiNamaMap[namaSubKey].total_realisasi_histori += nominalRealisasi;

          if (namaRekKey) {
            if (!historiNamaMap[namaSubKey].rekening[namaRekKey]) {
              historiNamaMap[namaSubKey].rekening[namaRekKey] = { anggaran: 0, realisasi: 0 };
            }
            historiNamaMap[namaSubKey].rekening[namaRekKey].anggaran += nominalAnggaran;
            historiNamaMap[namaSubKey].rekening[namaRekKey].realisasi += nominalRealisasi;
          }
        }
      });
    }

    let totalUsulanRkaGlobal = 0;
    let totalAnggaranHistoriGlobal = 0;
    let totalRealisasiHistoriGlobal = 0;
    let totalKasusEfisiensi = 0;
    const treeGroup = {};

    let mandatoryTmp = {
      pendidikan: { total_usulan: 0, total_anggaran: 0, total_realisasi: 0, subgiat: {} },
      kesehatan: { total_usulan: 0, total_anggaran: 0, total_realisasi: 0, subgiat: {} },
      infrastruktur: { total_usulan: 0, total_anggaran: 0, total_realisasi: 0, subgiat: {} }
    };
    let spmTmp = { total_usulan: 0, total_anggaran: 0, total_realisasi: 0, subgiat: {} };
    const urusanGroupTmp = {};

    dataRows.forEach((row) => {
      const rawSkpdExcel = String(row['Kode SKPD'] || row['KODE SKPD'] || '').trim();
      const skpdParts = rawSkpdExcel.split('.');
      const skpdIndukExcel = skpdParts.slice(0, 6).join('.');

      if (skpdIndukExcel !== selectedSkpd) return; 

      const subKegId = String(row['Kode Sub Kegiatan'] || row['KODE SUB KEGIATAN'] || '').trim();
      const namaSub = String(row['Nama Sub Kegiatan'] || row['NAMA SUB KEGIATAN'] || '').trim();
      const namaSubUpper = namaSub.toUpperCase();
      
      const rekId = String(row['Kode Rekening'] || row['KODE REKENING'] || '').trim();
      const namaRek = String(row['Nama Rekening'] || row['NAMA REKENING'] || '').trim();
      const namaRekUpper = namaRek.toUpperCase();
      
      const nominalUsulan = parseFloat(row['Anggaran'] || row['ANGGARAN'] || row['Jumlah'] || row['JUMLAH'] || 0);

      if (!namaSub) return;

      totalUsulanRkaGlobal += nominalUsulan;
      const historiSub = historiNamaMap[namaSubUpper] || { total_anggaran_histori: 0, total_realisasi_histori: 0 };

      // 1. Urusan Bidang Pemetaan
      const urusanCode = subKegId.split('.').slice(0, 2).join('.');
      const namaUrusanRow = String(row['Nama Urusan'] || row['NAMA URUSAN'] || 'Urusan Pemerintahan').trim();
      if (urusanCode && urusanCode !== 'N/A') {
        if (!urusanGroupTmp[urusanCode]) {
          urusanGroupTmp[urusanCode] = { nama: namaUrusanRow, total: 0, subgiat: {} };
        }
        urusanGroupTmp[urusanCode].total += nominalUsulan;
        if (!urusanGroupTmp[urusanCode].subgiat[namaSubUpper]) {
          urusanGroupTmp[urusanCode].subgiat[namaSubUpper] = {
            kode: subKegId, nama: namaSub, usulan: 0, anggaran: historiSub.total_anggaran_histori, realisasi: historiSub.total_realisasi_histori
          };
        }
        urusanGroupTmp[urusanCode].subgiat[namaSubUpper].usulan += nominalUsulan;
      }

      // 2. Mandatory Spending Pemetaan
      let kategoriMandatory = null;
      if (urusanCode === '1.01') kategoriMandatory = 'pendidikan';
      else if (urusanCode === '1.02') kategoriMandatory = 'kesehatan';
      else if (rekId.startsWith('5.2') && (urusanCode === '1.03' || urusanCode === '1.04')) kategoriMandatory = 'infrastruktur';

      if (kategoriMandatory) {
        if (!mandatoryTmp[kategoriMandatory].subgiat[namaSubUpper]) {
          mandatoryTmp[kategoriMandatory].subgiat[namaSubUpper] = {
            kode: subKegId, nama: namaSub, usulan: 0, anggaran: historiSub.total_anggaran_histori, realisasi: historiSub.total_realisasi_histori
          };
        }
        mandatoryTmp[kategoriMandatory].subgiat[namaSubUpper].usulan += nominalUsulan;
      }

      // 3. SPM Pemetaan
      const isSpm = row['SPM'] || row['Spm'] || row['spm'] || row['Indikator SPM'];
      if (isSpm && String(isSpm).toLowerCase() !== 'tidak' && String(isSpm).trim() !== '') {
        if (!spmTmp.subgiat[namaSubUpper]) {
          spmTmp.subgiat[namaSubUpper] = {
            kode: subKegId, nama: namaSub, usulan: 0, anggaran: historiSub.total_anggaran_histori, realisasi: historiSub.total_realisasi_histori
          };
        }
        spmTmp.subgiat[namaSubUpper].usulan += nominalUsulan;
      }

      // Main Table Treeview
      if (!treeGroup[namaSubUpper]) {
        totalAnggaranHistoriGlobal += historiSub.total_anggaran_histori;
        totalRealisasiHistoriGlobal += historiSub.total_realisasi_histori;

        treeGroup[namaSubUpper] = {
          kd_sub_kegiatan_tampil: subKegId || 'N/A',
          nama_sub_kegiatan: namaSub,
          total_pagu_usulan: 0,
          total_anggaran_histori: historiSub.total_anggaran_histori,
          total_realisasi_histori: historiSub.total_realisasi_histori,
          rekeningRows: {},
          subErrors: []
        };
      }
      treeGroup[namaSubUpper].total_pagu_usulan += nominalUsulan;

      if (!treeGroup[namaSubUpper].rekeningRows[namaRekUpper]) {
        const historiRek = (historiNamaMap[namaSubUpper] && historiNamaMap[namaSubUpper].rekening[namaRekUpper]) 
          ? historiNamaMap[namaSubUpper].rekening[namaRekUpper] : { anggaran: 0, realisasi: 0 };

        treeGroup[namaSubUpper].rekeningRows[namaRekUpper] = {
          kd_rekening_tampil: rekId || 'N/A',
          nama_rekening: namaRek || 'Tanpa Nama Rekening',
          jumlah_usulan: 0,
          anggaran_histori: historiRek.anggaran,
          realisasi_histori: historiRek.realisasi
        };
      }
      treeGroup[namaSubUpper].rekeningRows[namaRekUpper].jumlah_usulan += nominalUsulan;
    });

    // Konsolidasi Nilai Akhir Kategori Makro
    Object.keys(mandatoryTmp).forEach(kat => {
      Object.keys(mandatoryTmp[kat].subgiat).forEach(key => {
        const item = mandatoryTmp[kat].subgiat[key];
        mandatoryTmp[kat].total_usulan += item.usulan;
        mandatoryTmp[kat].total_anggaran += item.anggaran;
        mandatoryTmp[kat].total_realisasi += item.realisasi;
      });
      mandatoryTmp[kat].subgiat = Object.values(mandatoryTmp[kat].subgiat);
    });

    Object.keys(spmTmp.subgiat).forEach(key => {
      const item = spmTmp.subgiat[key];
      spmTmp.total_usulan += item.usulan;
      spmTmp.total_anggaran += item.anggaran;
      spmTmp.total_realisasi += item.realisasi;
    });
    spmTmp.subgiat = Object.values(spmTmp.subgiat);

    // Rule Validasi Lonjakan Ekstrem
    Object.keys(treeGroup).forEach((key) => {
      const subNode = treeGroup[key];
      if (subNode.total_realisasi_histori > 0 && subNode.total_pagu_usulan > (subNode.total_realisasi_histori * 1.5)) {
        const prs = (((subNode.total_pagu_usulan - subNode.total_realisasi_histori) / subNode.total_realisasi_histori) * 100).toFixed(1);
        subNode.subErrors.push(`⚠️ Lonjakan Pagu: Usulan RKA melonjak +${prs}% jauh di atas riwayat penyerapan riil.`);
        totalKasusEfisiensi++;
      }
    });

    setSummaryData({ totalRka: totalUsulanRkaGlobal, totalTemuan: totalKasusEfisiensi });
    setComplianceData({ mandatory: mandatoryTmp, spm: spmTmp, urusan: urusanGroupTmp });
    setRealisasiTree(treeGroup);
    setReportGenerated(true);
  };

  return (
    <div className="font-mono text-xs text-slate-200 space-y-6 p-4">
      
      {/* AREA FILTER PANEL UTAMA */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-slate-300">
        <h3 className="text-amber-400 font-bold uppercase tracking-wider mb-5 flex items-center gap-2 text-sm">
          <ArrowRightLeft size={16} /> Verifikasi RKA Anggaran & Analisis Komparasi Lapisan Urusan Makro
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-amber-400/80 uppercase font-bold mb-1">Status Tahapan APBD</label>
              <select value={selectedTahapan} onChange={(e) => setSelectedTahapan(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs font-sans outline-none">
                <option value="" className="text-slate-400 bg-slate-950">-- PILIH TAHAPAN APBD --</option>
                {listTahapan.map((t) => <option key={t.id} value={t.id} className="text-white bg-slate-950">[{t.kd_status}] {t.status}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-amber-400/80 uppercase font-bold mb-1">Perangkat Daerah / SKPD Induk</label>
              <select value={selectedSkpd} onChange={(e) => setSelectedSkpd(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs font-sans outline-none">
                <option value="" className="text-slate-400 bg-slate-950">-- PILIH SKPD INDUK UTAMA --</option>
                {listSkpd.map((s, i) => <option key={i} value={s.kd_skpd_utama} className="text-white bg-slate-950">[{s.kd_skpd_utama}] {s.display_nama}</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex flex-col space-y-3">
            <div className="relative border-2 border-dashed border-slate-800 hover:border-amber-500/40 rounded-lg p-5 bg-slate-950 flex flex-col items-center justify-center flex-1 min-h-[90px]">
              <input type="file" accept=".xlsx, .xls" onChange={handleUploadExcel} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={loading} />
              <FileSpreadsheet size={20} className="text-amber-400 mb-1" />
              <span className="font-sans font-bold text-white text-[11px]">{loading ? 'MEMPROSES VERIFIKASI RIWAYAT...' : 'UNGGAH BERKAS USULAN RKA'}</span>
              {namaFile && <div className="mt-1.5 text-amber-400 text-[10px] bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded truncate">{namaFile}</div>}
            </div>
            
            {reportGenerated && summaryData && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 flex items-center justify-between text-amber-400 animate-fadeIn">
                <span className="text-[10px] uppercase font-bold tracking-wider font-mono">TOTAL USULAN RKA CURRENT:</span>
                <span className="text-sm font-bold font-sans text-white">Rp {summaryData.totalRka.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HASIL LAPORAN MACRO */}
      {reportGenerated && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="text-xs font-bold text-amber-400 uppercase tracking-widest border-l-4 border-amber-500 pl-2">
            I. Evaluasi Keselarasan Anggaran Makro & Analisis Komparatif Histori
          </div>

          <div className="grid grid-cols-1 gap-6">
            
            {/* 1. SEKTOR MANDATORY SPENDING */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
              <div className="flex items-center gap-2 text-white font-bold border-b border-slate-800 pb-2 text-[11px] uppercase tracking-wider">
                <Landmark size={14} className="text-indigo-400" /> Histori Komparasi Sub-Kegiatan Penopang Mandatory Spending
              </div>
              
              {Object.keys(complianceData.mandatory).every(k => complianceData.mandatory[k].subgiat.length === 0) ? (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-[11px] flex items-center gap-2 font-sans">
                  <Info size={14} className="text-amber-500" />
                  <span>Keterangan: Tidak ditemukan sub-kegiatan penopang Mandatory Spending.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.keys(complianceData.mandatory).map((kategori) => {
                    const dataKat = complianceData.mandatory[kategori];
                    if (dataKat.subgiat.length === 0) return null;
                    return (
                      <div key={kategori} className="border border-slate-800 rounded-lg p-3 bg-black">
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase text-white mb-2 border-b border-slate-800 pb-1">
                          <span className="text-indigo-300">Kategori Fungsi: {kategori}</span>
                          <span className="font-sans text-[10px] text-slate-300">Total: Rp {dataKat.total_usulan.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="text-[10px] text-slate-200 border-b border-slate-700 uppercase font-mono font-bold">
                                <th className="py-2">Kode / Nama Sub-Kegiatan</th>
                                <th className="py-2 text-right text-cyan-200">Histori Anggaran</th>
                                <th className="py-2 text-right text-emerald-200">Histori Realisasi</th>
                                <th className="py-2 text-right text-white">Usulan RKA</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-[11px] text-slate-300">
                              {dataKat.subgiat.map((sub, i) => (
                                  <tr key={i} className="hover:bg-slate-900/40 font-sans">
                                    <td className="py-2 max-w-sm truncate text-white font-medium"><span className="text-amber-400 font-mono font-bold mr-1">[{sub.kode}]</span> {sub.nama}</td>
                                    <td className="py-2 text-right text-cyan-200 font-mono">Rp {sub.anggaran.toLocaleString('id-ID')}</td>
                                    <td className="py-2 text-right text-emerald-200 font-mono">Rp {sub.realisasi.toLocaleString('id-ID')}</td>
                                    <td className="py-2 text-right text-white font-bold font-mono">Rp {sub.usulan.toLocaleString('id-ID')}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. TABEL STANDAR PELAYANAN MINIMAL (SPM) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
              <div className="flex items-center gap-2 text-white font-bold border-b border-slate-800 pb-2 text-[11px] uppercase tracking-wider">
                <ShieldCheck size={14} className="text-teal-400" /> Histori Komparasi Sub-Kegiatan Penanda Standar Pelayanan Minimal (SPM)
              </div>
              
              {complianceData.spm.subgiat.length === 0 ? (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-[11px] flex items-center gap-2 font-sans">
                  <Info size={14} className="text-amber-500" />
                  <span>Keterangan: Tidak ditemukan sub-kegiatan penanda SPM.</span>
                </div>
              ) : (
                <div className="overflow-x-auto bg-black p-3 rounded-lg border border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] text-slate-200 border-b border-slate-700 uppercase font-mono font-bold">
                        <th className="py-2">Kode / Nama Sub-Kegiatan Atribusi SPM</th>
                        <th className="py-2 text-right text-cyan-200">Histori Anggaran</th>
                        <th className="py-2 text-right text-emerald-200">Histori Realisasi</th>
                        <th className="py-2 text-right text-white">Usulan RKA Baru</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px] text-slate-300 font-sans">
                      {complianceData.spm.subgiat.map((sub, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="py-2 max-w-xl truncate text-white font-medium"><span className="text-amber-400 font-mono font-bold mr-1">[{sub.kode}]</span> {sub.nama}</td>
                            <td className="py-2 text-right text-cyan-200 font-mono">Rp {sub.anggaran.toLocaleString('id-ID')}</td>
                            <td className="py-2 text-right text-emerald-200 font-mono">Rp {sub.realisasi.toLocaleString('id-ID')}</td>
                            <td className="py-2 text-right text-white font-bold font-mono">Rp {sub.usulan.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. DISTRIBUSI KODE URUSAN BIDANG */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
              <div className="flex items-center gap-2 text-white font-bold border-b border-slate-800 pb-2 text-[11px] uppercase tracking-wider">
                <Percent size={14} className="text-amber-400" /> Distribusi Matriks Komparatif Per Sub-Kegiatan di Tiap Bidang Urusan
              </div>
              
              <div className="space-y-4">
                {Object.keys(complianceData.urusan).map((kodeUrusan) => {
                  const urusanItem = complianceData.urusan[kodeUrusan];
                  const subGiatList = Object.values(urusanItem.subgiat);
                  return (
                    <div key={kodeUrusan} className="border border-slate-800 rounded-lg p-3 bg-black">
                      <div className="text-[11px] font-bold text-white mb-2 bg-slate-900 px-2 py-1 rounded border-l-4 border-amber-500 flex justify-between items-center">
                        <span>[{kodeUrusan}] {urusanItem.nama}</span>
                        <span className="text-amber-400 font-mono text-[10px] font-bold">Total Pagu: Rp {urusanItem.total.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[9px] text-slate-200 border-b border-slate-700 uppercase font-mono font-bold">
                              <th className="py-1.5">Nama Sub-Kegiatan</th>
                              <th className="py-1.5 text-right text-cyan-200">Histori Angg</th>
                              <th className="py-1.5 text-right text-emerald-200">Histori Real</th>
                              <th className="py-1.5 text-right text-white">Usulan RKA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40 text-[10px] text-slate-300 font-sans">
                            {subGiatList.map((sub, idx) => (
                                <tr key={idx} className="hover:bg-slate-900/40">
                                  <td className="py-1.5 max-w-sm truncate text-white font-medium"><span className="text-amber-400 font-mono font-bold">[{sub.kode.split('.').pop()}]</span> {sub.nama}</td>
                                  <td className="py-1.5 text-right text-cyan-200 font-mono">Rp {sub.anggaran.toLocaleString('id-ID')}</td>
                                  <td className="py-1.5 text-right text-emerald-200 font-mono">Rp {sub.realisasi.toLocaleString('id-ID')}</td>
                                  <td className="py-1.5 text-right text-white font-bold font-mono">Rp {sub.usulan.toLocaleString('id-ID')}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MAIN TREEVIEW REPORT TABLE */}
      {reportGenerated && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg animate-fadeIn">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-white uppercase tracking-wider font-bold block">
                II. Detil RKA Tingkat Komponen Rekening Belanja
              </span>
              <span className="text-[9px] text-slate-400 font-sans">Kode Unit Terpilih: <strong className="text-white">{selectedSkpd}</strong></span>
            </div>
            <button onClick={() => window.print()} className="px-3 py-1.5 border border-slate-700 bg-slate-950 text-slate-300 flex items-center gap-1.5 rounded-lg text-[11px] cursor-pointer hover:bg-slate-800 hover:text-white transition-colors font-sans font-medium">
              <Printer size={12} />
              <span>CETAK REPORT</span>
            </button>
          </div>

          <div className="p-2 space-y-3 bg-slate-950">
            {Object.keys(realisasiTree).map((namaSubKey) => {
              const subNode = realisasiTree[namaSubKey];
              const isOpen = expandedNodes[namaSubKey];
              const adaPeringatan = subNode.subErrors.length > 0;
              
              const devAnggaranSubgiat = hitungPersentaseDeviasi(subNode.total_pagu_usulan, subNode.total_anggaran_histori);
              const devRealisasiSubgiat = hitungPersentaseDeviasi(subNode.total_pagu_usulan, subNode.total_realisasi_histori);

              return (
                <div key={namaSubKey} className={`border rounded-lg overflow-hidden bg-slate-900 ${adaPeringatan ? 'border-amber-500/50 shadow-md' : 'border-slate-800'}`}>
                  
                  <div onClick={() => toggleNode(namaSubKey)} className="p-3 flex items-center justify-between cursor-pointer bg-slate-900 hover:bg-slate-800/60 border-b border-slate-800/60">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                      <Folder size={14} className="text-amber-400 shrink-0" />
                      <div className="truncate w-full">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0 truncate">
                            <span className="text-amber-400 font-bold text-[10px] font-sans">[{subNode.kd_sub_kegiatan_tampil}]</span>
                            <span className="text-white uppercase text-[11px] font-sans font-bold tracking-wide truncate">{subNode.nama_sub_kegiatan}</span>
                          </div>
                          {/* OPTIMALISASI BADGE PERBANDINGAN: BIRU DIUBAH KE SKY-300 AGAR LEBIH MENYALA DAN NYAMAN DI MATA */}
                          <div className="flex gap-1.5 shrink-0 font-sans text-[10px] font-bold">
                            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/80">
                              vs Angg: {subNode.total_anggaran_histori === 0 ? 'BARU' : `${devAnggaranSubgiat >= 0 ? '+' : ''}${devAnggaranSubgiat.toFixed(1)}%`}
                            </span>
                            <span className={`px-2 py-0.5 rounded ${subNode.total_realisasi_histori === 0 ? 'bg-sky-950 text-sky-300 border border-sky-700/80' : devRealisasiSubgiat >= 0 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                              vs Real: {subNode.total_realisasi_histori === 0 ? 'BARU' : `${devRealisasiSubgiat >= 0 ? '+' : ''}${devRealisasiSubgiat.toFixed(1)}%`}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2 items-center text-[10px]">
                          <span className="text-slate-300">Usulan RKA Baru: <strong className="text-white font-mono">Rp {subNode.total_pagu_usulan.toLocaleString('id-ID')}</strong></span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-300">Histori Anggaran: <strong className="text-cyan-200 font-mono">Rp {subNode.total_anggaran_histori.toLocaleString('id-ID')}</strong></span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-300">Histori Realisasi: <strong className="text-emerald-200 font-mono">Rp {subNode.total_realisasi_histori.toLocaleString('id-ID')}</strong></span>
                        </div>
                        {adaPeringatan && (
                          <div className="mt-2 space-y-1">
                            {subNode.subErrors.map((err, errIdx) => (
                              <div key={errIdx} className="text-[10px] text-amber-200 bg-amber-950 border border-amber-900/60 p-2 rounded flex items-start gap-1.5 font-sans max-w-2xl">
                                <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KONTEN TABEL RINCIAN KOMPONEN REKENING */}
                  {isOpen && (
                    /* LATAR BELAKANG DIUBAH MENJADI HITAM PEKAT (BG-BLACK) UNTUK KONTRAS MAKSIMAL */
                    <div className="bg-black divide-y divide-slate-900 pl-6 pr-4 py-2">
                      
                      <div className="grid grid-cols-12 gap-4 py-3 text-[10px] text-slate-300 font-bold uppercase tracking-wider border-b border-slate-800 px-3 items-center font-mono">
                        <div className="col-span-4 text-slate-400">Nama Kode Rekening (RKA)</div>
                        <div className="col-span-2 text-right text-cyan-200">Histori Anggaran</div>
                        <div className="col-span-2 text-right text-emerald-200">Histori Realisasi</div>
                        <div className="col-span-2 text-right text-white">Usulan Baru</div>
                        <div className="col-span-2 text-center text-amber-400">% Histori</div>
                      </div>

                      {Object.keys(subNode.rekeningRows).map((namaRekKey) => {
                        const rekRow = subNode.rekeningRows[namaRekKey];
                        const devAnggaranRekening = hitungPersentaseDeviasi(rekRow.jumlah_usulan, rekRow.anggaran_histori);
                        const devRealisasiRekening = hitungPersentaseDeviasi(rekRow.jumlah_usulan, rekRow.realisasi_histori);
                        return (
                          <div key={namaRekKey} className="grid grid-cols-12 gap-4 py-3 px-3 text-[11px] hover:bg-slate-900/80 transition-colors items-center rounded-md my-0.5 text-slate-300">
                            
                            <div className="col-span-4 flex items-start gap-2.5 min-w-0">
                              <FileText size={13} className="text-slate-500 mt-0.5 shrink-0" />
                              <div className="truncate">
                                <span className="text-amber-400 text-[10px] font-mono block mb-0.5 font-bold">{rekRow.kd_rekening_tampil}</span>
                                <span className="text-slate-200 font-sans tracking-wide block whitespace-normal break-words">{rekRow.nama_rekening}</span>
                              </div>
                            </div>
                            
                            {/* ANGKA TEXT-CYAN-200 DAN TEXT-EMERALD-200 (TINGKAT KECERAHAN TERTINGGI / SANGAT KONTRAS) */}
                            <div className="col-span-2 text-right text-cyan-200 font-mono font-bold">Rp {rekRow.anggaran_histori.toLocaleString('id-ID')}</div>
                            <div className="col-span-2 text-right text-emerald-200 font-mono font-bold">Rp {rekRow.realisasi_histori.toLocaleString('id-ID')}</div>
                            <div className="col-span-2 text-right text-white font-bold font-mono">Rp {rekRow.jumlah_usulan.toLocaleString('id-ID')}</div>
                            
                            {/* BADGE BG-NEUTRAL-950 DENGAN TEKS VARIANT 300 YANG LEBIH CERAH & MENYALA */}
                            <div className="col-span-2 flex flex-col gap-1 items-center justify-center font-sans text-[9px] font-bold">
                              <span className={`w-20 text-center py-0.5 rounded border bg-neutral-950 ${rekRow.anggaran_histori === 0 ? 'text-slate-400 border-slate-800' : devAnggaranRekening >= 0 ? 'text-rose-300 border-rose-900' : 'text-emerald-300 border-emerald-900'}`}>
                                A: {rekRow.anggaran_histori === 0 ? 'BARU' : `${devAnggaranRekening >= 0 ? '+' : ''}${devAnggaranRekening.toFixed(1)}%`}
                              </span>
                              <span className={`w-20 text-center py-0.5 rounded border bg-neutral-950 ${rekRow.realisasi_histori === 0 ? 'text-slate-400 border-slate-800' : devRealisasiRekening >= 0 ? 'text-rose-300 border-rose-900' : 'text-emerald-300 border-emerald-900'}`}>
                                R: {rekRow.realisasi_histori === 0 ? 'BARU' : `${devRealisasiRekening >= 0 ? '+' : ''}${devRealisasiRekening.toFixed(1)}%`}
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
      )}

    </div>
  );
}