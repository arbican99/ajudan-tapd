import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart2, Layers, Users, Map as MapIcon, 
  Cpu, Terminal, Calendar, ChevronDown, ChevronRight, TrendingUp, ShoppingBag, Building2,
  Printer, Download, FileSpreadsheet, Settings, Eye
} from 'lucide-react';

const DINKES_KODE = '1.02.0.00.0.00.01.0000';

export default function ModulRealisasiBelanja() {
  // --- STATE MANAGEMENT ---
  const [skpdList, setSkpdList] = useState([]);
  const [tahunList, setTahunList] = useState([]);
  const [selectedSkpd, setSelectedSkpd] = useState('REKAP');
  const [selectedTahun, setSelectedTahun] = useState('ALL');
  
  const [activePage, setActivePage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [rawRealData, setRawRealData] = useState([]);
  const [mrekMap, setMrekMap] = useState(new window.Map());

  const [expandedSubgiat, setExpandedSubgiat] = useState({});
  const [expandedPerdin, setExpandedPerdin] = useState({});
  const [expandedBarang, setExpandedBarang] = useState({});
  
  // State Khusus Expand Dinas Kesehatan (2-Level Expansion)
  const [expandedSubunits, setExpandedSubunits] = useState({});
  const [expandedDinkesSubgiat, setExpandedDinkesSubgiat] = useState({});

  // State Pengaturan Cetakan (Google Sheets Style)
  const [printPaperSize, setPrintPaperSize] = useState('A4');
  const [printOrientation, setPrintOrientation] = useState('landscape');
  const [printMargin, setPrintMargin] = useState('normal');
  const [showGridlines, setShowGridlines] = useState(true);

  const printAreaRef = useRef(null);

  useEffect(() => {
    setActivePage(1);
    setExpandedSubunits({});
    setExpandedDinkesSubgiat({});
  }, [selectedSkpd]);

  useEffect(() => {
    ambilDataFilter();
  }, []);

  useEffect(() => {
    fetchMainData();
  }, [selectedSkpd, selectedTahun]);

  // --- 1. AMBIL DATA FILTER ---
  const ambilDataFilter = async () => {
    try {
      let semuaData = [];
      let page = 0;
      const tumpukanPerQuery = 1000;
      let masihAdaData = true;

      while (masihAdaData) {
        const dariBaris = page * tumpukanPerQuery;
        const sampaiBaris = dariBaris + tumpukanPerQuery - 1;

        const { data, error } = await supabase
          .from('data_realisasi')
          .select('Kode_Skpd, Nama_Skpd, tahun')
          .range(dariBaris, sampaiBaris);
        
        if (error) throw error;

        if (data && data.length > 0) {
          semuaData = [...semuaData, ...data];
          if (data.length < tumpukanPerQuery) {
            masihAdaData = false;
          } else {
            page++;
          }
        } else {
          masihAdaData = false;
        }
      }

      if (semuaData.length > 0) {
        const uniqueSkpd = [];
        const mapSkpd = new window.Map();
        const uniqueTahun = new Set();
        
        semuaData.forEach(item => {
          const kodeClean = item.Kode_Skpd ? item.Kode_Skpd.trim() : '';
          
          if (kodeClean && !mapSkpd.has(kodeClean)) {
            mapSkpd.set(kodeClean, true);
            uniqueSkpd.push({
              kode_skpd: kodeClean,
              nama_skpd: item.Nama_Skpd || 'Tanpa Nama SKPD'
            });
          }
          if (item.tahun) uniqueTahun.add(item.tahun.toString());
        });

        uniqueSkpd.sort((a, b) => a.kode_skpd.localeCompare(b.kode_skpd));
        setSkpdList(uniqueSkpd);
        setTahunList(Array.from(uniqueTahun).sort());
        
        if (uniqueTahun.size > 0) {
          setSelectedTahun(Array.from(uniqueTahun).sort().pop());
        }
      }
    } catch (err) {
      console.error("Gagal mengambil filter:", err.message);
    }
  };

  // --- 2. FETCH MAIN DATA ---
  const fetchMainData = async () => {
    setLoading(true);
    try {
      let semuaDataReal = [];
      let page = 0;
      const tumpukanPerQuery = 1000;
      let masihAdaData = true;

      while (masihAdaData) {
        const dariBaris = page * tumpukanPerQuery;
        const sampaiBaris = dariBaris + tumpukanPerQuery - 1;

        let queryReal = supabase
          .from('data_realisasi')
          .select('Kode_Skpd, Nama_Skpd, Kode_Subunit, Nama_Subunit, Kode_Rekening, Nama_Rekening, Anggaran, Realisasi, Kode_Subgiat, Nama_Subgiat, tahun');
        
        if (selectedSkpd !== 'REKAP') queryReal = queryReal.eq('Kode_Skpd', selectedSkpd);
        if (selectedTahun !== 'ALL') queryReal = queryReal.eq('tahun', parseInt(selectedTahun));
        
        const { data: realData, error: errorReal } = await queryReal.range(dariBaris, sampaiBaris);
        
        if (errorReal) throw errorReal;

        if (realData && realData.length > 0) {
          semuaDataReal = [...semuaDataReal, ...realData];
          if (realData.length < tumpukanPerQuery) {
            masihAdaData = false;
          } else {
            page++;
          }
        } else {
          masihAdaData = false;
        }
      }

      setRawRealData(semuaDataReal);

      const { data: mrekData, error: errorMrek } = await supabase.from('mrek').select('kdrek, nmrek');
      if (errorMrek) throw errorMrek;

      const newMrekMap = new window.Map();
      if (mrekData) mrekData.forEach(item => newMrekMap.set(item.kdrek.trim(), item.nmrek));
      setMrekMap(newMrekMap);

    } catch (err) {
      console.error("Gagal memuat pipeline data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizeKodeRekening = (kodeRaw) => {
    if (!kodeRaw) return '';
    const seg = kodeRaw.trim().split('.');
    if (seg.length >= 5) seg[4] = seg[4].padStart(3, '0');
    if (seg.length >= 6) seg[5] = seg[5].padStart(5, '0');
    return seg.join('.');
  };

  // --- 3. PROCESSED DATA MEMOIZATION ---
  const processedData = useMemo(() => {
    let totalPagu = 0, totalReal = 0;
    let opPagu = 0, opReal = 0;
    let modPagu = 0, modReal = 0;
    let ttPagu = 0, ttReal = 0;
    let trPagu = 0, trReal = 0;
    
    let pegPagu = 0, pegReal = 0;
    let perdinPagu = 0, perdinReal = 0;
    let barangPagu = 0, barangReal = 0;

    const globalLeafMap = new window.Map();
    const mapPage2Tree = new window.Map();
    const mapPage4Tree = new window.Map();
    const mapPage5Tree = new window.Map();

    rawRealData.forEach(item => {
      const ang = parseFloat(item.Anggaran) || 0;
      const rea = parseFloat(item.Realisasi) || 0;
      const kodeRek = normalizeKodeRekening(item.Kode_Rekening);
      const kodeSubgiat = item.Kode_Subgiat || 'UNMAPPED';
      const namaSubgiat = item.Nama_Subgiat || 'Tanpa Nama Subkegiatan';

      totalPagu += ang;
      totalReal += rea;

      if (kodeRek.startsWith('5.1')) { opPagu += ang; opReal += rea; }
      else if (kodeRek.startsWith('5.2')) { modPagu += ang; modReal += rea; }
      else if (kodeRek.startsWith('5.3')) { ttPagu += ang; ttReal += rea; }
      else if (kodeRek.startsWith('5.4')) { trPagu += ang; trReal += rea; }

      if (kodeRek.startsWith('5.1.01')) { pegPagu += ang; pegReal += rea; }
      if (kodeRek.startsWith('5.1.02.04')) { perdinPagu += ang; perdinReal += rea; }
      if (kodeRek.startsWith('5.1.02.01')) { barangPagu += ang; barangReal += rea; }

      if (kodeRek) {
        if (!globalLeafMap.has(kodeRek)) globalLeafMap.set(kodeRek, { anggaran: 0, realisasi: 0 });
        const target = globalLeafMap.get(kodeRek);
        target.anggaran += ang;
        target.realisasi += rea;
      }

      if (kodeSubgiat) {
        if (!mapPage2Tree.has(kodeSubgiat)) {
          mapPage2Tree.set(kodeSubgiat, { kode: kodeSubgiat, nama: namaSubgiat, anggaran: 0, realisasi: 0, children: new window.Map() });
        }
        const subgiatNode = mapPage2Tree.get(kodeSubgiat);
        subgiatNode.anggaran += ang;
        subgiatNode.realisasi += rea;

        if (!subgiatNode.children.has(kodeRek)) {
          subgiatNode.children.set(kodeRek, { kode: kodeRek, nama: mrekMap.get(kodeRek) || item.Nama_Rekening || '-', anggaran: 0, realisasi: 0 });
        }
        const childNode = subgiatNode.children.get(kodeRek);
        childNode.anggaran += ang;
        childNode.realisasi += rea;
      }

      if (kodeRek.startsWith('5.1.02.04')) {
        if (!mapPage4Tree.has(kodeSubgiat)) {
          mapPage4Tree.set(kodeSubgiat, { kode: kodeSubgiat, nama: namaSubgiat, anggaran: 0, realisasi: 0, children: new window.Map() });
        }
        const perdinNode = mapPage4Tree.get(kodeSubgiat);
        perdinNode.anggaran += ang;
        perdinNode.realisasi += rea;

        if (!perdinNode.children.has(kodeRek)) {
          perdinNode.children.set(kodeRek, { kode: kodeRek, nama: mrekMap.get(kodeRek) || item.Nama_Rekening || '-', anggaran: 0, realisasi: 0 });
        }
        const childNode = perdinNode.children.get(kodeRek);
        childNode.anggaran += ang;
        childNode.realisasi += rea;
      }

      if (kodeRek.startsWith('5.1.02.01')) {
        if (!mapPage5Tree.has(kodeSubgiat)) {
          mapPage5Tree.set(kodeSubgiat, { kode: kodeSubgiat, nama: namaSubgiat, anggaran: 0, realisasi: 0, children: new window.Map() });
        }
        const barangNode = mapPage5Tree.get(kodeSubgiat);
        barangNode.anggaran += ang;
        barangNode.realisasi += rea;

        if (!barangNode.children.has(kodeRek)) {
          barangNode.children.set(kodeRek, { kode: kodeRek, nama: mrekMap.get(kodeRek) || item.Nama_Rekening || '-', anggaran: 0, realisasi: 0 });
        }
        const childNode = barangNode.children.get(kodeRek);
        childNode.anggaran += ang;
        childNode.realisasi += rea;
      }
    });

    const hierarchicalRekapMap = new window.Map();

    globalLeafMap.forEach((dataNilai, kodeRekening) => {
      const seg = kodeRekening.split('.');
      const prefixes = [];

      if (seg.length >= 1) prefixes.push(seg[0]); 
      if (seg.length >= 2) prefixes.push(`${seg[0]}.${seg[1]}`); 
      if (seg.length >= 3) prefixes.push(`${seg[0]}.${seg[1]}.${seg[2]}`); 
      if (seg.length >= 4) prefixes.push(`${seg[0]}.${seg[1]}.${seg[2]}.${seg[3]}`); 
      if (seg.length >= 5) prefixes.push(`${seg[0]}.${seg[1]}.${seg[2]}.${seg[3]}.${seg[4]}`); 
      if (seg.length >= 6) prefixes.push(`${seg[0]}.${seg[1]}.${seg[2]}.${seg[3]}.${seg[4]}.${seg[5]}`); 

      prefixes.forEach(pfx => {
        if (pfx.startsWith('5')) {
          if (!hierarchicalRekapMap.has(pfx)) {
            hierarchicalRekapMap.set(pfx, { kode: pfx, nama: mrekMap.get(pfx) || '-', anggaran: 0, realisasi: 0 });
          }
          const node = hierarchicalRekapMap.get(pfx);
          node.anggaran += dataNilai.anggaran;
          node.realisasi += dataNilai.realisasi;
        }
      });
    });

    const arrPage1 = Array.from(hierarchicalRekapMap.values()).sort((a, b) => a.kode.localeCompare(b.kode));
    
    const arrPage2 = Array.from(mapPage2Tree.values()).map(node => {
      const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.kode.localeCompare(b.kode));
      return { ...node, children: sortedChildren };
    });
    
    const arrPage4 = Array.from(mapPage4Tree.values()).map(node => {
      const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.kode.localeCompare(b.kode));
      return { ...node, children: sortedChildren };
    });

    const arrPage5 = Array.from(mapPage5Tree.values()).map(node => {
      const sortedChildren = Array.from(node.children.values()).sort((a, b) => a.kode.localeCompare(b.kode));
      return { ...node, children: sortedChildren };
    });

    return {
      stats: {
        rekap: { anggaran: totalPagu, realisasi: totalReal },
        operasi: { anggaran: opPagu, realisasi: opReal },
        modal: { anggaran: modPagu, realisasi: modReal },
        takTerduga: { anggaran: ttPagu, realisasi: ttReal },
        transfer: { anggaran: trPagu, realisasi: trReal },
        pegawai: { anggaran: pegPagu, realisasi: pegReal },
        perdin: { anggaran: perdinPagu, realisasi: perdinReal },
        barang: { anggaran: barangPagu, realisasi: barangReal }
      },
      page1: arrPage1,
      page2: arrPage2,
      page3: arrPage1.filter(item => item.kode.startsWith('5.1.01')),
      page4: arrPage4,
      page5: arrPage5
    };
  }, [rawRealData, mrekMap]);

  // --- 4. DATA GROUPING SUBUNIT KHUSUS (UNTUK PAGE DINAS KESEHATAN) ---
  const subunitGroupedData = useMemo(() => {
    if (selectedSkpd !== DINKES_KODE) return [];

    const mapSubunits = new window.Map();

    rawRealData.forEach(item => {
      const kodeSubunit = item.Kode_Subunit ? item.Kode_Subunit.trim() : 'UNMAPPED_SUBUNIT';
      const namaSubunit = item.Nama_Subunit ? item.Nama_Subunit.trim() : 'Tanpa Nama Subunit';
      const ang = parseFloat(item.Anggaran) || 0;
      const rea = parseFloat(item.Realisasi) || 0;
      const kodeRek = normalizeKodeRekening(item.Kode_Rekening);
      const kodeSubgiat = item.Kode_Subgiat || 'UNMAPPED';
      const namaSubgiat = item.Nama_Subgiat || 'Tanpa Nama Subkegiatan';

      let passFilter = false;
      if (activePage === 2) passFilter = true; 
      else if (activePage === 3 && kodeRek.startsWith('5.1.01')) passFilter = true; 
      else if (activePage === 4 && kodeRek.startsWith('5.1.02.04')) passFilter = true; 
      else if (activePage === 5 && kodeRek.startsWith('5.1.02.01')) passFilter = true; 

      if (!passFilter) return;

      if (!mapSubunits.has(kodeSubunit)) {
        mapSubunits.set(kodeSubunit, {
          kodeSubunit,
          namaSubunit,
          totalAnggaran: 0,
          totalRealisasi: 0,
          subgiatMap: new window.Map()
        });
      }

      const subNode = mapSubunits.get(kodeSubunit);
      subNode.totalAnggaran += ang;
      subNode.totalRealisasi += rea;

      if (!subNode.subgiatMap.has(kodeSubgiat)) {
        subNode.subgiatMap.set(kodeSubgiat, {
          kode: kodeSubgiat,
          nama: namaSubgiat,
          anggaran: 0,
          realisasi: 0,
          childrenMap: new window.Map()
        });
      }
      const sgNode = subNode.subgiatMap.get(kodeSubgiat);
      sgNode.anggaran += ang;
      sgNode.realisasi += rea;

      if (!sgNode.childrenMap.has(kodeRek)) {
        sgNode.childrenMap.set(kodeRek, {
          kode: kodeRek,
          nama: mrekMap.get(kodeRek) || item.Nama_Rekening || '-',
          anggaran: 0,
          realisasi: 0
        });
      }
      const rekNode = sgNode.childrenMap.get(kodeRek);
      rekNode.anggaran += ang;
      rekNode.realisasi += rea;
    });

    return Array.from(mapSubunits.values()).map(sub => ({
      ...sub,
      subgiatList: Array.from(sub.subgiatMap.values()).map(sg => ({
        ...sg,
        children: Array.from(sg.childrenMap.values()).sort((a, b) => a.kode.localeCompare(b.kode))
      })).sort((a, b) => a.kode.localeCompare(b.kode))
    })).sort((a, b) => a.kodeSubunit.localeCompare(b.kodeSubunit));
  }, [rawRealData, selectedSkpd, activePage, mrekMap]);

  // --- 5. DATA UNTUK CETAK (SUPPORT MULTI-LEVEL DINKES SUBUNIT) ---
  const cetakReportTree = useMemo(() => {
    const skpdGroup = new window.Map();

    rawRealData.forEach(item => {
      const kodeSkpd = item.Kode_Skpd ? item.Kode_Skpd.trim() : 'UNMAPPED';
      const namaSkpd = item.Nama_Skpd ? item.Nama_Skpd.trim() : 'Tanpa Nama SKPD';
      const kodeSubunit = item.Kode_Subunit ? item.Kode_Subunit.trim() : kodeSkpd;
      const namaSubunit = item.Nama_Subunit ? item.Nama_Subunit.trim() : namaSkpd;
      const kodeSubgiat = item.Kode_Subgiat ? item.Kode_Subgiat.trim() : 'UNMAPPED_SUBGIAT';
      const namaSubgiat = item.Nama_Subgiat ? item.Nama_Subgiat.trim() : 'Tanpa Nama Subkegiatan';
      const kodeRek = normalizeKodeRekening(item.Kode_Rekening);
      const namaRek = mrekMap.get(kodeRek) || item.Nama_Rekening || 'Tanpa Nama Rekening';
      
      const ang = parseFloat(item.Anggaran) || 0;
      const rea = parseFloat(item.Realisasi) || 0;

      if (!skpdGroup.has(kodeSkpd)) {
        skpdGroup.set(kodeSkpd, {
          kode: kodeSkpd,
          nama: namaSkpd,
          anggaran: 0,
          realisasi: 0,
          subunitMap: new window.Map()
        });
      }

      const skpdNode = skpdGroup.get(kodeSkpd);
      skpdNode.anggaran += ang;
      skpdNode.realisasi += rea;

      if (!skpdNode.subunitMap.has(kodeSubunit)) {
        skpdNode.subunitMap.set(kodeSubunit, {
          kode: kodeSubunit,
          nama: namaSubunit,
          anggaran: 0,
          realisasi: 0,
          subgiatMap: new window.Map()
        });
      }

      const subNode = skpdNode.subunitMap.get(kodeSubunit);
      subNode.anggaran += ang;
      subNode.realisasi += rea;

      if (!subNode.subgiatMap.has(kodeSubgiat)) {
        subNode.subgiatMap.set(kodeSubgiat, {
          kode: kodeSubgiat,
          nama: namaSubgiat,
          anggaran: 0,
          realisasi: 0,
          rekeningMap: new window.Map()
        });
      }

      const sgNode = subNode.subgiatMap.get(kodeSubgiat);
      sgNode.anggaran += ang;
      sgNode.realisasi += rea;

      if (!sgNode.rekeningMap.has(kodeRek)) {
        sgNode.rekeningMap.set(kodeRek, {
          kode: kodeRek,
          nama: namaRek,
          anggaran: 0,
          realisasi: 0
        });
      }

      const rkNode = sgNode.rekeningMap.get(kodeRek);
      rkNode.anggaran += ang;
      rkNode.realisasi += rea;
    });

    return Array.from(skpdGroup.values()).map(skpd => ({
      ...skpd,
      subunitList: Array.from(skpd.subunitMap.values()).map(sub => ({
        ...sub,
        subgiatList: Array.from(sub.subgiatMap.values()).map(sg => ({
          ...sg,
          rekeningList: Array.from(sg.rekeningMap.values()).sort((a, b) => a.kode.localeCompare(b.kode))
        })).sort((a, b) => a.kode.localeCompare(b.kode))
      })).sort((a, b) => a.kode.localeCompare(b.kode))
    })).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [rawRealData, mrekMap]);

  // --- 6. MATRIKS GRAFIK BATANG SKPD ---
  const page5SkpdMatrix = useMemo(() => {
    const skpdMap = new window.Map();

    rawRealData.forEach(item => {
      const targetKode = item.Kode_Skpd ? item.Kode_Skpd.trim() : 'UNMAPPED';
      const targetNama = item.Nama_Skpd ? item.Nama_Skpd.trim() : 'Tanpa Nama SKPD';
      
      const ang = parseFloat(item.Anggaran) || 0;
      const rea = parseFloat(item.Realisasi) || 0;
      const kodeRek = normalizeKodeRekening(item.Kode_Rekening);

      if (!skpdMap.has(targetKode)) {
        skpdMap.set(targetKode, {
          kode: targetKode,
          nama: targetNama,
          totalAng: 0, totalReal: 0,
          pegawaiAng: 0, pegawaiReal: 0,
          perdinAng: 0, perdinReal: 0,
          modalAng: 0, modalReal: 0
        });
      }

      const row = skpdMap.get(targetKode);
      row.totalAng += ang;
      row.totalReal += rea;

      if (kodeRek.startsWith('5.1.01')) { row.pegawaiAng += ang; row.pegawaiReal += rea; }
      if (kodeRek.startsWith('5.1.02.04')) { row.perdinAng += ang; row.perdinReal += rea; }
      if (kodeRek.startsWith('5.2')) { row.modalAng += ang; row.modalReal += rea; }
    });

    return Array.from(skpdMap.values()).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [rawRealData]);

  const toggleSubgiat = (id) => setExpandedSubgiat(prev => ({ ...prev, [id]: !prev[id] }));
  const togglePerdin = (id) => setExpandedPerdin(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleBarang = (id) => setExpandedBarang(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSubunit = (kodeSubunit) => setExpandedSubunits(prev => ({ ...prev, [kodeSubunit]: !prev[kodeSubunit] }));
  const toggleDinkesSubgiat = (key) => setExpandedDinkesSubgiat(prev => ({ ...prev, [key]: !prev[key] }));

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
  };

  const formatAngkaIndo = (angka) => {
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(angka || 0);
  };

  const hitungPersen = (anggaran, realisasi) => {
    if (!anggaran) return '0.00%';
    return `${((realisasi / anggaran) * 100).toFixed(2)}%`;
  };

  const hitungPersenAngka = (anggaran, realisasi) => {
    if (!anggaran) return '0,00';
    return ((realisasi / anggaran) * 100).toFixed(2).replace('.', ',');
  };

  // --- HANDLER CETAK DAN EKSPOR ---
  const handlePrintPDF = () => {
    window.print();
  };

  const handleExportXLS = () => {
    if (!printAreaRef.current) return;
    const tableHTML = printAreaRef.current.innerHTML;
    const blob = new Blob([`
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Laporan APBD</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; }
          th, td { border: 1px solid #000; padding: 4px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
        </style>
      </head>
      <body>
        ${tableHTML}
      </body>
      </html>
    `], { type: 'application/vnd.ms-excel' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LAPORAN_REALISASI_ANGGARAN_${selectedTahun}_${new Date().getTime()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // --- COMPONENT DONUT CHART ---
  const RenderPieChart = ({ title, anggaran, realisasi, colorNeon, glowClass, totalRekapPagu }) => {
    const safeAnggaran = anggaran || 0;
    const safeRealisasi = realisasi || 0;
    
    const persen = safeAnggaran > 0 ? (safeRealisasi / safeAnggaran) * 100 : 0;
    const radius = 40; 
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(persen, 100) / 100) * circumference;
    const sisa = safeAnggaran - safeRealisasi;
    const proporsiPagu = totalRekapPagu > 0 ? (safeAnggaran / totalRekapPagu) * 100 : 0;

    return (
      <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-5 relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.8)] min-h-[175px] w-full">
        <div className={`absolute top-0 left-0 w-full h-[2px] ${glowClass}`}></div>
        
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="text-white font-black uppercase tracking-widest text-[9px] mb-2 block md:hidden">
            {title}
          </div>
          <div className="relative w-28 h-28 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.2)]">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r={radius} className="stroke-slate-800/80 fill-none" strokeWidth="9" />
              <circle 
                cx="55" cy="55" r={radius} 
                className={`${colorNeon} fill-none transition-all duration-1000`} 
                strokeWidth="9" 
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-mono leading-tight">
              <span className="text-[16px] font-black text-white">{persen.toFixed(0)}%</span>
              <span className="text-[6px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">CAPAIAN</span>
            </div>
          </div>
        </div>

        <div className="flex-1 font-mono text-[11px] w-full space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
          <div className="text-white font-black uppercase tracking-widest text-[10px] hidden md:flex items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${glowClass} inline-block`}></span>
              {title}
            </div>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">PAGU:</span> 
            <span className="text-cyan-400 font-bold whitespace-nowrap">{formatRupiah(safeAnggaran)}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">REAL:</span> 
            <span className="text-emerald-400 font-black whitespace-nowrap">{formatRupiah(safeRealisasi)}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">SISA:</span> 
            <span className="text-amber-500 font-bold whitespace-nowrap">{formatRupiah(sisa)}</span>
          </div>
          {title !== "Total Rekap" && (
            <div className="flex justify-between items-center gap-4 border-t border-slate-900 pt-1 text-[10px]">
              <span className="text-yellow-400 font-bold">% PAGU:</span> 
              <span className="text-yellow-400 font-black whitespace-nowrap bg-yellow-950/40 px-1.5 py-0.5 rounded border border-yellow-900/40">
                {proporsiPagu.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const RenderHorizontalHeaderBar = () => {
    let targetAnggaran = processedData.stats.rekap.anggaran;
    let targetRealisasi = processedData.stats.rekap.realisasi;
    let contextTitle = "TOTAL REKAPITULASI BELANJA DAERAH";

    if (selectedSkpd !== 'REKAP') {
      if (activePage === 3) {
        targetAnggaran = processedData.stats.pegawai.anggaran;
        targetRealisasi = processedData.stats.pegawai.realisasi;
        contextTitle = "MATRIKS KHUSUS: BELANJA PEGAWAI (KODE 5.1.01)";
      } else if (activePage === 4) {
        targetAnggaran = processedData.stats.perdin.anggaran;
        targetRealisasi = processedData.stats.perdin.realisasi;
        contextTitle = "MATRIKS KHUSUS: PERJALANAN DINAS (KODE 5.1.02.04)";
      } else if (activePage === 5) {
        targetAnggaran = processedData.stats.barang.anggaran;
        targetRealisasi = processedData.stats.barang.realisasi;
        contextTitle = "MATRIKS KHUSUS: BELANJA BARANG (KODE 5.1.02.01)";
      }
    }

    const persen = targetAnggaran > 0 ? (targetRealisasi / targetAnggaran) * 100 : 0;

    return (
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-black border-2 border-amber-500/20 p-5 rounded-2xl space-y-3.5 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center font-mono text-[10px] gap-2 tracking-wider">
          <div className="flex items-center gap-2 font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
            <Cpu size={13} className="animate-pulse text-amber-400" /> 
            {contextTitle}
          </div>
          <div className="text-slate-400 text-[11px]">
            PAGU SEKTORAL: <span className="text-white font-bold">{formatRupiah(targetAnggaran)}</span> | 
            REALISASI: <span className="text-yellow-400 font-black drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] pl-1">{formatRupiah(targetRealisasi)}</span>
          </div>
        </div>
        <div className="relative h-7 bg-slate-950 rounded-xl border-2 border-slate-800 p-0.5 overflow-hidden flex items-center shadow-[inset_0_0_15px_rgba(0,0,0,0.9)]">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.8)] transition-all duration-1000 flex items-center justify-end pr-3 font-mono text-[10px] text-slate-950 font-black tracking-widest"
            style={{ width: `${Math.min(persen, 100)}%` }}
          >
            {persen > 8 && `${persen.toFixed(2)}% CAPAIAN`}
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER DINKES EXPANDING SUBROWS COMPONENT (SUBUNIT -> SUBKEGIATAN -> REKENING) ---
  const renderDinkesSubrowsView = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-[11px] border-collapse">
          <thead>
            <tr className="bg-slate-900/90 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
              <th className="p-4 border-r border-slate-900 w-12 text-center">#</th>
              <th className="p-4 border-r border-slate-900 w-52 text-center">Kode Subunit</th>
              <th className="p-4 border-r border-slate-900 text-center">Rekapitulasi Unit / Nama Subunit</th>
              <th className="p-4 text-center border-r border-slate-900">Pagu Anggaran</th>
              <th className="p-4 text-center border-r border-slate-900">Realisasi Keuangan</th>
              <th className="p-4 text-center border-r border-slate-900">Sisa Pagu</th>
              <th className="p-4 text-center">Capaian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/80">
            {subunitGroupedData.map((sub, sIdx) => {
              const isSubunitExpanded = !!expandedSubunits[sub.kodeSubunit];
              const sisaSubunit = sub.totalAnggaran - sub.totalRealisasi;

              return (
                <React.Fragment key={sIdx}>
                  {/* LEVEL 1: BARIS UTAMA REKAPITULASI SUBUNIT */}
                  <tr 
                    onClick={() => toggleSubunit(sub.kodeSubunit)}
                    className="bg-slate-950/90 hover:bg-cyan-950/40 border-l-4 border-cyan-400 cursor-pointer text-cyan-200 font-bold transition-all"
                  >
                    <td className="p-3.5 text-center border-r border-slate-900">
                      {isSubunitExpanded ? (
                        <ChevronDown size={15} className="text-cyan-400 inline-block" />
                      ) : (
                        <ChevronRight size={15} className="text-cyan-400 inline-block" />
                      )}
                    </td>
                    <td className="p-3.5 border-r border-slate-900 font-mono text-cyan-400 font-black">{sub.kodeSubunit}</td>
                    <td className="p-3.5 border-r border-slate-900 flex items-center gap-2">
                      <Building2 size={14} className="text-cyan-400 flex-shrink-0" />
                      <span className="text-slate-100 font-black tracking-wide uppercase">{sub.namaSubunit}</span>
                    </td>
                    <td className="p-3.5 text-right border-r border-slate-900 text-slate-300 font-bold">{formatRupiah(sub.totalAnggaran)}</td>
                    <td className="p-3.5 text-right border-r border-slate-900 text-emerald-400 font-black">{formatRupiah(sub.totalRealisasi)}</td>
                    <td className="p-3.5 text-right border-r border-slate-900 text-amber-500 font-bold">{formatRupiah(sisaSubunit)}</td>
                    <td className="p-3.5 text-center font-black text-cyan-300 bg-cyan-950/20">{hitungPersen(sub.totalAnggaran, sub.totalRealisasi)}</td>
                  </tr>

                  {/* LEVEL 2: EXPAND SUBUNIT -> DAFTAR SUBKEGIATAN */}
                  {isSubunitExpanded && (
                    <tr>
                      <td colSpan={7} className="p-3 bg-slate-900/60 border-y border-cyan-900/50">
                        <div className="pl-4 pr-2 py-2 space-y-2">
                          <div className="text-[10px] font-bold text-cyan-400 tracking-wider flex items-center gap-2 uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 inline-block animate-pulse"></span>
                            DAFTAR SUBKEGIATAN: {sub.namaSubunit}
                          </div>

                          <table className="w-full text-left font-mono text-[10px] border-collapse bg-slate-950/90 rounded-lg overflow-hidden border border-slate-800">
                            <thead>
                              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[9px] uppercase tracking-wider font-black">
                                <th className="p-2.5 border-r border-slate-800 w-10 text-center">#</th>
                                <th className="p-2.5 border-r border-slate-800 text-center w-48">Kode Rekening / Subkegiatan</th>
                                <th className="p-2.5 border-r border-slate-800 text-center">Nomenklatur Uraian Kerja</th>
                                <th className="p-2.5 text-center border-r border-slate-800 w-36">Pagu</th>
                                <th className="p-2.5 text-center border-r border-slate-800 w-36">Realisasi</th>
                                <th className="p-2.5 text-center border-r border-slate-800 w-36">Sisa</th>
                                <th className="p-2.5 text-center w-24">% Capaian</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900">
                              {sub.subgiatList.map((sg, sgIdx) => {
                                const sgKey = `${sub.kodeSubunit}_${sg.kode}`;
                                const isSgExpanded = !!expandedDinkesSubgiat[sgKey];

                                return (
                                  <React.Fragment key={sgIdx}>
                                    {/* BARIS SUBKEGIATAN */}
                                    <tr 
                                      onClick={() => toggleDinkesSubgiat(sgKey)}
                                      className="bg-slate-900/50 hover:bg-indigo-950/40 cursor-pointer font-bold text-indigo-300 border-l-2 border-indigo-400 transition-all"
                                    >
                                      <td className="p-2 text-center border-r border-slate-800">
                                        {isSgExpanded ? (
                                          <ChevronDown size={13} className="text-indigo-400 inline-block" />
                                        ) : (
                                          <ChevronRight size={13} className="text-indigo-400 inline-block" />
                                        )}
                                      </td>
                                      <td className="p-2 border-r border-slate-800 text-indigo-400 font-black">{sg.kode}</td>
                                      <td className="p-2 border-r border-slate-800 font-bold">{sg.nama.toUpperCase()}</td>
                                      <td className="p-2 text-right border-r border-slate-800 text-slate-300">{formatRupiah(sg.anggaran)}</td>
                                      <td className="p-2 text-right border-r border-slate-800 text-emerald-400 font-bold">{formatRupiah(sg.realisasi)}</td>
                                      <td className="p-2 text-right border-r border-slate-800 text-amber-500">{formatRupiah(sg.anggaran - sg.realisasi)}</td>
                                      <td className="p-2 text-center text-cyan-400 font-black">{hitungPersen(sg.anggaran, sg.realisasi)}</td>
                                    </tr>

                                    {/* LEVEL 3: EXPAND SUBKEGIATAN -> DAFTAR REKENING */}
                                    {isSgExpanded && sg.children.map((ch, chIdx) => (
                                      <tr key={chIdx} className="bg-slate-950 hover:bg-slate-900/80 text-slate-300 text-[9.5px]">
                                        <td className="p-2 text-center border-r border-slate-800 text-slate-600">&bull;</td>
                                        <td className="p-2 pl-6 border-r border-slate-800 text-slate-500 font-medium">{ch.kode}</td>
                                        <td className="p-2 pl-6 border-r border-slate-800 text-slate-300 font-normal">&bull; {ch.nama}</td>
                                        <td className="p-2 text-right border-r border-slate-800 text-slate-400">{formatRupiah(ch.anggaran)}</td>
                                        <td className="p-2 text-right border-r border-slate-800 text-emerald-400/80">{formatRupiah(ch.realisasi)}</td>
                                        <td className="p-2 text-right border-r border-slate-800 text-slate-500">{formatRupiah(ch.anggaran - ch.realisasi)}</td>
                                        <td className="p-2 text-center text-cyan-400 font-bold">{hitungPersen(ch.anggaran, ch.realisasi)}</td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // --- RENDER PAGE CETAK DATA (SUBROW SPECIFIC FOR DINAS KESEHATAN) ---
  const renderCetakDataView = () => {
    return (
      <div className="space-y-6">
        {/* CSS CETAKAN MEDIA PRINT */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #area-cetak-print, #area-cetak-print * {
              visibility: visible;
            }
            #area-cetak-print {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
            @page {
              size: ${printPaperSize} ${printOrientation};
              margin: ${printMargin === 'sembarang' ? '5mm' : printMargin === 'narrow' ? '8mm' : printMargin === 'wide' ? '25mm' : '12mm'};
            }
          }
        `}</style>

        {/* SETTINGS PANEL (GOOGLE SHEETS STYLE) */}
        <div className="no-print bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Settings className="text-amber-400 animate-spin" size={18} />
              <h3 className="font-mono text-sm font-black text-amber-400 uppercase tracking-widest">
                PENGATURAN CETAKAN & EKSPOR LAPORAN
              </h3>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={handlePrintPDF}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-mono text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Printer size={15} />
                <span>CETAK / PDF</span>
              </button>
              <button
                onClick={handleExportXLS}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>EKSPOR KE EXCEL (.XLS)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            {/* PAPER SIZE */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Ukuran Kertas</label>
              <select
                value={printPaperSize}
                onChange={(e) => setPrintPaperSize(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg p-2 text-cyan-300 font-bold focus:outline-none"
              >
                <option value="A4">A4 (210 x 297 mm)</option>
                <option value="Letter">Letter (8.5 x 11 in)</option>
                <option value="Legal">Legal (8.5 x 14 in)</option>
                <option value="F4">F4 / Folio (215 x 330 mm)</option>
              </select>
            </div>

            {/* ORIENTATION */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Orientasi Kertas</label>
              <select
                value={printOrientation}
                onChange={(e) => setPrintOrientation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg p-2 text-cyan-300 font-bold focus:outline-none"
              >
                <option value="landscape">Landscape (Mendatar)</option>
                <option value="portrait">Portrait (Tegak)</option>
              </select>
            </div>

            {/* MARGIN */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Margin Halaman</label>
              <select
                value={printMargin}
                onChange={(e) => setPrintMargin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg p-2 text-cyan-300 font-bold focus:outline-none"
              >
                <option value="normal">Normal (12 mm)</option>
                <option value="narrow">Sempit / Narrow (8 mm)</option>
                <option value="wide">Lebar / Wide (25 mm)</option>
              </select>
            </div>

            {/* GRIDLINES TOGGLE */}
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200">
                <input
                  type="checkbox"
                  checked={showGridlines}
                  onChange={(e) => setShowGridlines(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 cursor-pointer w-4 h-4"
                />
                <span className="font-bold text-[11px]">Tampilkan Garis Kisi (Gridlines)</span>
              </label>
            </div>
          </div>
        </div>

        {/* PREVIEW CONTAINER */}
        <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-6 overflow-x-auto shadow-2xl flex justify-center">
          <div 
            id="area-cetak-print"
            ref={printAreaRef}
            className={`bg-white text-black font-sans shadow-2xl p-8 rounded min-w-[900px] max-w-[1200px] transition-all`}
            style={{ width: '100%' }}
          >
            {/* FORMAT HEADER JUDUL LAPORAN */}
            <div className="text-center font-bold font-sans uppercase mb-6 space-y-1 text-black">
              <h2 className="text-base tracking-wide border-b-2 border-black pb-1 inline-block">
                LAPORAN REALISASI ANGGARAN
              </h2>
              <h3 className="text-sm tracking-wide">
                TAHUN ANGGARAN {selectedTahun === 'ALL' ? '2026' : selectedTahun}
              </h3>
            </div>

            {/* TABEL FORMAT CETAKAN BERSTRUKTUR SUBROW SUBUNIT (KHUSUS DINKES) */}
            <table className={`w-full text-[11px] font-sans border-collapse ${showGridlines ? 'border border-black' : ''}`}>
              <thead>
                {/* BARIS HEADER 1 */}
                <tr className="bg-gray-100 font-bold text-center text-black">
                  <th className="border border-black p-2 w-12" rowSpan={2}>No</th>
                  <th className="border border-black p-2 w-44" rowSpan={2}>Kode</th>
                  <th className="border border-black p-2" rowSpan={2}>Keterangan</th>
                  <th className="border border-black p-2 w-40" rowSpan={2}>Usulan Perubahan<br/>APBD</th>
                  <th className="border border-black p-2" colSpan={2}>Realisasi SPJ</th>
                  <th className="border border-black p-2 w-40" rowSpan={2}>Sisa APBD</th>
                </tr>
                {/* BARIS HEADER 2 */}
                <tr className="bg-gray-100 font-bold text-center text-black">
                  <th className="border border-black p-1.5 w-32">Rp</th>
                  <th className="border border-black p-1.5 w-16">%</th>
                </tr>
                {/* BARIS PENOMORAN KOLOM 1, 2, 3, 5, 7, 8 = 5 - 7 */}
                <tr className="bg-gray-50 font-bold text-center text-black text-[10px]">
                  <td className="border border-black p-1">1</td>
                  <td className="border border-black p-1">2</td>
                  <td className="border border-black p-1">3</td>
                  <td className="border border-black p-1">5</td>
                  <td className="border border-black p-1" colSpan={2}>7</td>
                  <td className="border border-black p-1">8 = 5 - 7</td>
                </tr>
              </thead>
              <tbody>
                {cetakReportTree.map((skpd, skpdIdx) => {
                  const noUtama = skpdIdx + 1;
                  const sisaSkpd = skpd.anggaran - skpd.realisasi;

                  return (
                    <React.Fragment key={skpdIdx}>
                      {/* BARIS 1: SKPD UTAMA */}
                      <tr className="font-bold bg-white text-black">
                        <td className="border border-black p-1.5 text-center">{noUtama}</td>
                        <td className="border border-black p-1.5">{skpd.kode}</td>
                        <td className="border border-black p-1.5 uppercase">{skpd.nama}</td>
                        <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(skpd.anggaran)}</td>
                        <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(skpd.realisasi)}</td>
                        <td className="border border-black p-1.5 text-center whitespace-nowrap">{hitungPersenAngka(skpd.anggaran, skpd.realisasi)}</td>
                        <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(sisaSkpd)}</td>
                      </tr>

                      {/* ITERASI SUBUNIT (TERMASUK DINAS KESEHATAN & SUBUNITNYA) */}
                      {skpd.subunitList.map((sub, subIdx) => {
                        const noSubunit = `${noUtama}.${subIdx + 1}`;
                        const sisaSubunit = sub.anggaran - sub.realisasi;
                        const isDinkesSubunit = skpd.kode === DINKES_KODE;

                        return (
                          <React.Fragment key={subIdx}>
                            {/* BARIS SUBUNIT (JIKA KHUSUS DINKES / JIKA SUBUNIT TERLIRIK BEDA DENGAN SKPD UTAMA) */}
                            {isDinkesSubunit && (
                              <tr className="font-bold bg-white text-black">
                                <td className="border border-black p-1.5 text-center">{noSubunit}</td>
                                <td className="border border-black p-1.5">{sub.kode}</td>
                                <td className="border border-black p-1.5 uppercase">{sub.nama}</td>
                                <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(sub.anggaran)}</td>
                                <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(sub.realisasi)}</td>
                                <td className="border border-black p-1.5 text-center whitespace-nowrap">{hitungPersenAngka(sub.anggaran, sub.realisasi)}</td>
                                <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(sisaSubunit)}</td>
                              </tr>
                            )}

                            {/* BARIS SUBKEGIATAN */}
                            {sub.subgiatList.map((sg, sgIdx) => {
                              const noSubgiat = isDinkesSubunit 
                                ? `${noSubunit}.${sgIdx + 1}` 
                                : `${noUtama}.${sgIdx + 1}`;
                              const sisaSg = sg.anggaran - sg.realisasi;

                              return (
                                <React.Fragment key={sgIdx}>
                                  {/* BARIS SUBKEGIATAN (2.1.1, 2.2.1, DST) */}
                                  <tr className="font-bold bg-white text-black">
                                    <td className="border border-black p-1.5 text-center">{noSubgiat}</td>
                                    <td className="border border-black p-1.5">{sg.kode}</td>
                                    <td className="border border-black p-1.5">{sg.nama}</td>
                                    <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(sg.anggaran)}</td>
                                    <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(sg.realisasi)}</td>
                                    <td className="border border-black p-1.5 text-center whitespace-nowrap">{hitungPersenAngka(sg.anggaran, sg.realisasi)}</td>
                                    <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(sisaSg)}</td>
                                  </tr>

                                  {/* BARIS RINCIAN REKENING */}
                                  {sg.rekeningList.map((rk, rkIdx) => {
                                    const sisaRk = rk.anggaran - rk.realisasi;

                                    return (
                                      <tr key={rkIdx} className="bg-white text-black">
                                        <td className="border border-black p-1.5 text-center"></td>
                                        <td className="border border-black p-1.5 text-gray-700">{rk.kode}</td>
                                        <td className="border border-black p-1.5 pl-4">{rk.nama}</td>
                                        <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(rk.anggaran)}</td>
                                        <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(rk.realisasi)}</td>
                                        <td className="border border-black p-1.5 text-center whitespace-nowrap">{hitungPersenAngka(rk.anggaran, rk.realisasi)}</td>
                                        <td className="border border-black p-1.5 text-right whitespace-nowrap">{formatAngkaIndo(sisaRk)}</td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
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
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-slate-100 p-1">
      
      {/* FILTER CONTROL PANEL */}
      <div className="no-print flex flex-col sm:flex-row gap-4 bg-slate-950/90 border-2 border-cyan-500/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.05)] backdrop-blur-md">
        <div className="flex-1 space-y-1">
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-widest pl-1">
            <Terminal size={11} className="text-cyan-400 animate-pulse" />
            FILTER DATA COMPONENT (SKPD)
          </label>
          <select
            value={selectedSkpd}
            onChange={(e) => setSelectedSkpd(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none cursor-pointer"
          >
            <option value="REKAP">» REKAPITULASI BELANJA DAERAH</option>
            {skpdList.map((skpd, i) => (
              <option key={i} value={skpd.kode_skpd}>» {skpd.kode_skpd} - {skpd.nama_skpd}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-48 space-y-1">
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-widest pl-1">
            <Calendar size={11} className="text-cyan-400" />
            TAHUN ANGGARAN
          </label>
          <select
            value={selectedTahun}
            onChange={(e) => setSelectedTahun(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">» SEMUA TAHUN</option>
            {tahunList.map((th, i) => (
              <option key={i} value={th}>» TAHUN {th}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CORE DONUT CHARTS ROW */}
      <div className="no-print grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <RenderPieChart title="Total Rekap" anggaran={processedData.stats.rekap.anggaran} realisasi={processedData.stats.rekap.realisasi} colorNeon="stroke-cyan-400" glowClass="bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Operasi" anggaran={processedData.stats.operasi.anggaran} realisasi={processedData.stats.operasi.realisasi} colorNeon="stroke-indigo-400" glowClass="bg-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Pegawai" anggaran={processedData.stats.pegawai.anggaran} realisasi={processedData.stats.pegawai.realisasi} colorNeon="stroke-teal-400" glowClass="bg-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Barang" anggaran={processedData.stats.barang.anggaran} realisasi={processedData.stats.barang.realisasi} colorNeon="stroke-fuchsia-400" glowClass="bg-fuchsia-400 shadow-[0_0_15px_rgba(232,121,249,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Perjalanan Dinas" anggaran={processedData.stats.perdin.anggaran} realisasi={processedData.stats.perdin.realisasi} colorNeon="stroke-yellow-400" glowClass="bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
        <RenderPieChart title="Belanja Modal" anggaran={processedData.stats.modal.anggaran} realisasi={processedData.stats.modal.realisasi} colorNeon="stroke-amber-400" glowClass="bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.8)]" totalRekapPagu={processedData.stats.rekap.anggaran} />
      </div>

      {/* INTERACTIVE DYNAMIC PAGE TABS */}
      {selectedSkpd === 'REKAP' ? (
        <div className="no-print flex gap-2 bg-slate-900/90 p-2 border border-amber-500/30 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.6)]">
          {[
            { id: 1, label: 'PAGE 1: MATRIKS REALISASI BELANJA SKPD', icon: BarChart2, color: 'from-amber-500 to-yellow-400' },
            { id: 2, label: 'PAGE 2: REKAP KONSOLIDASI AKUN TOTAL', icon: Layers, color: 'from-cyan-400 to-blue-500' },
            { id: 6, label: 'PAGE CETAK DATA', icon: Printer, color: 'from-emerald-400 to-teal-500' }
          ].map((page) => {
            const Icon = page.icon;
            const isSelected = activePage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-mono text-[10px] font-black tracking-widest transition-all duration-200 border-2 cursor-pointer ${
                  isSelected
                    ? `bg-gradient-to-r ${page.color} border-white text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.6)] scale-[1.01]`
                    : 'border-slate-700 text-slate-400 hover:text-white bg-slate-950/40 hover:bg-slate-900'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-slate-950 stroke-[3]' : 'text-slate-400'} />
                <span>{page.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="no-print flex flex-wrap gap-2 bg-slate-900/90 p-2 border border-slate-700 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.6)]">
          {[
            { id: 1, label: 'REKAP AKUN', icon: Layers },
            { id: 2, label: 'SUBKEGIATAN', icon: BarChart2 },
            { id: 3, label: 'BL. PEGAWAI', icon: Users },
            { id: 5, label: 'BL. BARANG', icon: ShoppingBag },
            { id: 4, label: 'PERJALANAN DINAS', icon: MapIcon },
            { id: 6, label: 'CETAK DATA', icon: Printer }
          ].map((page) => {
            const Icon = page.icon;
            const isSelected = activePage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-mono text-[10px] font-black tracking-widest transition-all duration-200 border-2 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 border-white text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.8)] scale-[1.02]'
                    : 'border-cyan-400/60 text-cyan-300 hover:text-white hover:border-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50'
                }`}
              >
                <Icon size={13} className={isSelected ? 'text-slate-950 stroke-[3]' : 'text-cyan-400'} />
                <span className="whitespace-nowrap">{page.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* CONTENT DATA WINDOW */}
      <div className="space-y-4">
        {activePage !== 6 && <RenderHorizontalHeaderBar />}

        <div className="bg-slate-950/95 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-4">
          {loading ? (
            <div className="p-16 text-center text-xs font-mono text-cyan-400 font-bold tracking-[0.3em] flex flex-col items-center justify-center gap-3">
              <Cpu className="animate-spin text-cyan-400" size={22} />
              <span>SYNCHRONIZING REKAPITULASI MASTER SCHEMATIC...</span>
            </div>
          ) : (
            <div>
              {/* PAGE CETAK DATA (ACTIVE PAGE = 6) */}
              {activePage === 6 ? (
                renderCetakDataView()
              ) : (
                <>
                  {/* JIKA DINAS KESEHATAN DAN ACTIVE PAGE BUKAN REKAP AKUN (ACTIVE PAGE !== 1) */}
                  {selectedSkpd === DINKES_KODE && activePage !== 1 ? (
                    renderDinkesSubrowsView()
                  ) : (
                    /* STANDAR VIEW UNTUK SKPD LAIN, REKAP, SERTA PAGE REKAP AKUN DINAS KESEHATAN */
                    <div>
                      {selectedSkpd === 'REKAP' && (
                        <div>
                          {activePage === 1 && (
                            <div className="space-y-6 p-2 font-mono">
                              <div className="text-[14px] font-bold text-white tracking-wider mb-2 flex items-center gap-2">
                                <TrendingUp size={14} className="text-amber-400" />
                                MATRIKS REALISASI BELANJA DAERAH
                              </div>
                              
                              <div className="space-y-6">
                                {page5SkpdMatrix.map((skpd, idx) => {
                                  const pctRealisasi = skpd.totalAng > 0 ? (skpd.totalReal / skpd.totalAng) * 100 : 0;
                                  
                                  return (
                                    <div key={idx} className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-2">
                                      <div className="flex justify-between items-end text-[10px] text-slate-300 font-bold">
                                        <span className="text-sky-400 font-black tracking-wide max-w-xs md:max-w-xl text-justify leading-normal block drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]">
                                          {skpd.kode} - {skpd.nama.toUpperCase()}
                                        </span>
                                        <span className="text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
                                          CAPAIAN: <span className="text-emerald-400 font-black">{hitungPersen(skpd.totalAng, skpd.totalReal)}</span>
                                        </span>
                                      </div>
                                      
                                      <div className="flex justify-between font-mono text-[9px] px-0.5">
                                        <div className="text-slate-400">PAGU: <span className="text-cyan-400 font-bold">{formatRupiah(skpd.totalAng)}</span></div>
                                        <div className="text-slate-300">REALISASI: <span className="text-yellow-400 font-black">{formatRupiah(skpd.totalReal)}</span></div>
                                      </div>

                                      <div className="w-full bg-cyan-950/40 h-5 rounded-lg overflow-hidden border border-cyan-800/60 p-0.5 relative shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
                                        <div 
                                          className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 rounded shadow-[0_0_12px_rgba(234,179,8,0.6)] transition-all duration-1000"
                                          style={{ width: `${Math.min(pctRealisasi, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {activePage === 2 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left font-mono text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                                    <th className="p-4 border-r border-slate-900 text-center">Kode Rekening</th>
                                    <th className="p-4 border-r border-slate-900 text-center">Struktur Nomenklatur Konsolidasi Total Daerah</th>
                                    <th className="p-4 text-center border-r border-slate-900">Total Pagu</th>
                                    <th className="p-4 text-center border-r border-slate-900">Total Realisasi</th>
                                    <th className="p-4 text-center border-r border-slate-900">Sisa Anggaran</th>
                                    <th className="p-4 text-center">Capaian</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-900/80">
                                  {processedData.page1.map((row, index) => {
                                    const level = row.kode.split('.').length;
                                    const isParent = level <= 3;
                                    return (
                                      <tr key={index} className={`hover:bg-cyan-950/20 transition-colors group ${isParent ? 'bg-slate-950 font-black text-cyan-300' : 'text-slate-200'}`}>
                                        <td className={`p-3.5 whitespace-nowrap border-r border-slate-900 font-bold ${isParent ? 'text-cyan-400' : 'text-slate-500'}`}>{row.kode}</td>
                                        <td className="p-3.5 border-r border-slate-900 text-justify text-slate-100 whitespace-normal leading-relaxed block w-full" style={{ paddingLeft: `${level * 12}px` }}>
                                          {isParent ? row.nama.toUpperCase() : row.nama}
                                        </td>
                                        <td className="p-3.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(row.anggaran)}</td>
                                        <td className="p-3.5 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(row.realisasi)}</td>
                                        <td className="p-3.5 text-right border-r border-slate-900 text-amber-500/90">{formatRupiah(row.anggaran - row.realisasi)}</td>
                                        <td className="p-3.5 text-center font-black text-cyan-400 bg-cyan-950/10">{hitungPersen(row.anggaran, row.realisasi)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedSkpd !== 'REKAP' && (
                        <div className="overflow-x-auto">
                          {activePage === 1 && (
                            <table className="w-full text-left font-mono text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                                  <th className="p-4 border-r border-slate-900 text-center">Kode Rekening</th>
                                  <th className="p-4 border-r border-slate-900 text-center">Struktur Nomenklatur Rekening</th>
                                  <th className="p-4 text-center border-r border-slate-900">Pagu Anggaran</th>
                                  <th className="p-4 text-center border-r border-slate-900">Realisasi Keuangan</th>
                                  <th className="p-4 text-center border-r border-slate-900">Sisa Anggaran</th>
                                  <th className="p-4 text-center">Capaian</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900/80">
                                {processedData.page1.map((row, index) => {
                                  const level = row.kode.split('.').length;
                                  const isParent = level <= 3;
                                  return (
                                    <tr key={index} className={`hover:bg-cyan-950/20 transition-colors group ${isParent ? 'bg-slate-950 font-black text-cyan-300' : 'text-slate-200'}`}>
                                      <td className={`p-3.5 whitespace-nowrap border-r border-slate-900 font-bold ${isParent ? 'text-cyan-400' : 'text-slate-500'}`}>{row.kode}</td>
                                      <td className="p-3.5 border-r border-slate-900 text-justify text-slate-100 whitespace-normal leading-relaxed block w-full" style={{ paddingLeft: `${level * 12}px` }}>
                                        {isParent ? row.nama.toUpperCase() : row.nama}
                                      </td>
                                      <td className="p-3.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(row.anggaran)}</td>
                                      <td className="p-3.5 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(row.realisasi)}</td>
                                      <td className="p-3.5 text-right border-r border-slate-900 text-amber-500/90">{formatRupiah(row.anggaran - row.realisasi)}</td>
                                      <td className="p-3.5 text-center font-black text-cyan-400 bg-cyan-950/10">{hitungPersen(row.anggaran, row.realisasi)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}

                          {activePage === 2 && (
                            <table className="w-full text-left font-mono text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                                  <th className="p-4 border-r border-slate-900 w-48 text-center">Kode Identifikasi</th>
                                  <th className="p-4 border-r border-slate-900 text-center">Nomenklatur Kerja (Subkegiatan &rarr; Rekening)</th>
                                  <th className="p-4 text-center border-r border-slate-900">Pagu Anggaran</th>
                                  <th className="p-4 text-center border-r border-slate-900">Realisasi</th>
                                  <th className="p-4 text-center border-r border-slate-900">Sisa Pagu</th>
                                  <th className="p-4 text-center">Capaian</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900/60">
                                {processedData.page2.map((subgiat, idx) => {
                                  const isExpanded = !!expandedSubgiat[subgiat.kode];
                                  return (
                                    <React.Fragment key={idx}>
                                      <tr 
                                        onClick={() => toggleSubgiat(subgiat.kode)}
                                        className="bg-slate-950/60 hover:bg-indigo-950/30 border-l-4 border-indigo-500 cursor-pointer text-indigo-300 font-bold transition-all"
                                      >
                                        <td className="p-3 border-r border-slate-900 tracking-wide font-black">{subgiat.kode}</td>
                                        <td className="p-3 border-r border-slate-900 flex items-center gap-2 text-justify text-slate-100 whitespace-normal leading-relaxed">
                                          {isExpanded ? <ChevronDown size={14} className="text-indigo-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-indigo-400 flex-shrink-0" />}
                                          <span>{subgiat.nama.toUpperCase()}</span>
                                        </td>
                                        <td className="p-3 text-right border-r border-slate-900 text-slate-400">{formatRupiah(subgiat.anggaran)}</td>
                                        <td className="p-3 text-right border-r border-slate-900 text-emerald-400 font-black">{formatRupiah(subgiat.realisasi)}</td>
                                        <td className="p-3 text-right border-r border-slate-900 text-amber-500">{formatRupiah(subgiat.anggaran - subgiat.realisasi)}</td>
                                        <td className="p-3 text-center font-black text-indigo-400 bg-indigo-950/10">{hitungPersen(subgiat.anggaran, subgiat.realisasi)}</td>
                                      </tr>
                                      {isExpanded && subgiat.children.map((child, cIdx) => (
                                        <tr key={cIdx} className="bg-slate-900/20 hover:bg-slate-900/50 text-slate-300 text-[10px]">
                                          <td className="p-2.5 pl-6 border-r border-slate-900 text-slate-500 font-medium">{child.kode}</td>
                                          <td className="p-2.5 pl-10 border-r border-slate-900 text-justify text-slate-400 whitespace-normal leading-relaxed">
                                            &bull; {child.nama}
                                          </td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(child.anggaran)}</td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-emerald-400/80">{formatRupiah(child.realisasi)}</td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-slate-500">{formatRupiah(child.anggaran - child.realisasi)}</td>
                                          <td className="p-2.5 text-center text-cyan-400 font-bold">{hitungPersen(child.anggaran, child.realisasi)}</td>
                                        </tr>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}

                          {activePage === 3 && (
                            <table className="w-full text-left font-mono text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                                  <th className="p-4 border-r border-slate-900 text-center">Kode Objek &rarr; Subrincian</th>
                                  <th className="p-4 border-r border-slate-900 text-center">Uraian Komponen Belanja Pegawai</th>
                                  <th className="p-4 text-center border-r border-slate-900">Anggaran</th>
                                  <th className="p-4 text-center border-r border-slate-900">Realisasi</th>
                                  <th className="p-4 text-center border-r border-slate-900">Sisa Anggaran</th>
                                  <th className="p-4 text-center">Persen</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900/60 text-slate-200">
                                {processedData.page3.map((row, index) => (
                                  <tr key={index} className="hover:bg-cyan-950/20 transition-colors group">
                                    <td className="p-3.5 text-cyan-400 font-bold whitespace-nowrap border-r border-slate-900">{row.kode}</td>
                                    <td className="p-3.5 border-r border-slate-900 text-justify text-slate-100 whitespace-normal leading-relaxed">{row.nama}</td>
                                    <td className="p-3.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(row.anggaran)}</td>
                                    <td className="p-3.5 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(row.realisasi)}</td>
                                    <td className="p-3.5 text-right border-r border-slate-900 text-amber-500">{formatRupiah(row.anggaran - row.realisasi)}</td>
                                    <td className="p-3.5 text-center font-black text-cyan-400 bg-cyan-950/10">{hitungPersen(row.anggaran, row.realisasi)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {activePage === 4 && (
                            <table className="w-full text-left font-mono text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                                  <th className="p-4 border-r border-slate-900 w-48 text-center">Kode Objek</th>
                                  <th className="p-4 border-r border-slate-900 text-center">Komponen Kerja Perjalanan Dinas (Akun 5.1.02.04)</th>
                                  <th className="p-4 text-center border-r border-slate-900">Anggaran</th>
                                  <th className="p-4 text-center border-r border-slate-900">Realisasi</th>
                                  <th className="p-4 text-center border-r border-slate-900">Sisa Pagu</th>
                                  <th className="p-4 text-center">Persen</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900/60">
                                {processedData.page4.map((perdin, idx) => {
                                  const isExpanded = !!expandedPerdin[perdin.kode];
                                  return (
                                    <React.Fragment key={idx}>
                                      <tr 
                                        onClick={() => togglePerdin(perdin.kode)}
                                        className="bg-slate-950 hover:bg-amber-950/20 border-l-4 border-amber-500 cursor-pointer text-amber-400 font-bold transition-all"
                                      >
                                        <td className="p-3 border-r border-slate-900 text-slate-500">{perdin.kode}</td>
                                        <td className="p-3 border-r border-slate-900 flex items-center gap-2 text-justify text-slate-200 whitespace-normal leading-relaxed">
                                          {isExpanded ? <ChevronDown size={14} className="text-amber-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-amber-400 flex-shrink-0" />}
                                          <span>{perdin.nama.toUpperCase()}</span>
                                        </td>
                                        <td className="p-3 text-right border-r border-slate-900 text-slate-400">{formatRupiah(perdin.anggaran)}</td>
                                        <td className="p-3 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(perdin.realisasi)}</td>
                                        <td className="p-3 text-right border-r border-slate-900 text-slate-500">{formatRupiah(perdin.anggaran - perdin.realisasi)}</td>
                                        <td className="p-3 text-center font-black text-amber-400 bg-amber-950/10">{hitungPersen(perdin.anggaran, perdin.realisasi)}</td>
                                      </tr>
                                      {isExpanded && perdin.children && perdin.children.map((child, cIdx) => (
                                        <tr key={cIdx} className="bg-slate-900/40 text-[10px] text-slate-300">
                                          <td className="p-2.5 pl-6 border-r border-slate-900 text-slate-500">{child.kode}</td>
                                          <td className="p-2.5 pl-10 border-r border-slate-900 text-justify text-amber-300/80 whitespace-normal leading-relaxed">
                                            &bull; {child.nama}
                                          </td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(child.anggaran)}</td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-emerald-400/80">{formatRupiah(child.realisasi)}</td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-slate-600">{formatRupiah(child.anggaran - child.realisasi)}</td>
                                          <td className="p-2.5 text-center font-bold text-emerald-400">{hitungPersen(child.anggaran, child.realisasi)}</td>
                                        </tr>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}

                          {activePage === 5 && (
                            <table className="w-full text-left font-mono text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-slate-900/80 border-b-2 border-slate-800 text-slate-300 text-[10px] tracking-widest font-black uppercase">
                                  <th className="p-4 border-r border-slate-900 w-48 text-center">Kode Unit</th>
                                  <th className="p-4 border-r border-slate-900 text-center">Komponen Kerja Belanja Barang (Akun 5.1.02.01)</th>
                                  <th className="p-4 text-center border-r border-slate-900">Anggaran</th>
                                  <th className="p-4 text-center border-r border-slate-900">Realisasi</th>
                                  <th className="p-4 text-center border-r border-slate-900">Sisa Pagu</th>
                                  <th className="p-4 text-center">Persen</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900/60">
                                {processedData.page5.map((barang, idx) => {
                                  const isExpanded = !!expandedBarang[barang.kode];
                                  return (
                                    <React.Fragment key={idx}>
                                      <tr 
                                        onClick={() => toggleBarang(barang.kode)}
                                        className="bg-slate-950 hover:bg-fuchsia-950/20 border-l-4 border-fuchsia-500 cursor-pointer text-fuchsia-300 font-bold transition-all"
                                      >
                                        <td className="p-3 border-r border-slate-900 text-slate-500">{barang.kode}</td>
                                        <td className="p-3 border-r border-slate-900 flex items-center gap-2 text-justify text-slate-200 whitespace-normal leading-relaxed">
                                          {isExpanded ? <ChevronDown size={14} className="text-fuchsia-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-fuchsia-400 flex-shrink-0" />}
                                          <span>{barang.nama.toUpperCase()}</span>
                                        </td>
                                        <td className="p-3 text-right border-r border-slate-900 text-slate-400">{formatRupiah(barang.anggaran)}</td>
                                        <td className="p-3 text-right border-r border-slate-900 text-emerald-400 font-bold">{formatRupiah(barang.realisasi)}</td>
                                        <td className="p-3 text-right border-r border-slate-900 text-slate-500">{formatRupiah(barang.anggaran - barang.realisasi)}</td>
                                        <td className="p-3 text-center font-black text-fuchsia-400 bg-fuchsia-950/10">{hitungPersen(barang.anggaran, barang.realisasi)}</td>
                                      </tr>
                                      {isExpanded && barang.children && barang.children.map((child, cIdx) => (
                                        <tr key={cIdx} className="bg-slate-900/40 text-[10px] text-slate-300">
                                          <td className="p-2.5 pl-6 border-r border-slate-900 text-slate-500">{child.kode}</td>
                                          <td className="p-2.5 pl-10 border-r border-slate-900 text-justify text-fuchsia-300/80 whitespace-normal leading-relaxed">
                                            &bull; {child.nama}
                                          </td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-slate-400">{formatRupiah(child.anggaran)}</td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-emerald-400/80">{formatRupiah(child.realisasi)}</td>
                                          <td className="p-2.5 text-right border-r border-slate-900 text-slate-600">{formatRupiah(child.anggaran - child.realisasi)}</td>
                                          <td className="p-2.5 text-center font-bold text-emerald-400">{hitungPersen(child.anggaran, child.realisasi)}</td>
                                        </tr>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}