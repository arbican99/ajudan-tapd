import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, Save, X, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function ModulTahapanApbd() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form States
  const [editId, setEditId] = useState(null);
  const [kdStatus, setKdStatus] = useState('');
  const [statusName, setStatusName] = useState('');

  useEffect(() => {
    fetchStatuses();
  }, []);

  // 1. READ: Ambil Data dari tblstatus
  const fetchStatuses = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('tblstatus')
        .select('*')
        .order('kd_status', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg(`Gagal memuat data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. CREATE / UPDATE: Simpan Data Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!kdStatus.trim() || !statusName.trim()) {
      alert('Semua bidang input wajib diisi.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');

    try {
      if (editId) {
        // Mode Perbarui (Update)
        const { error } = await supabase
          .from('tblstatus')
          .update({ kd_status: kdStatus.trim(), status: statusName.trim() })
          .eq('id', editId);

        if (error) throw error;
        alert('Data tahapan berhasil diperbarui.');
      } else {
        // Mode Tambah Baru (Create)
        const { error } = await supabase
          .from('tblstatus')
          .insert([{ kd_status: kdStatus.trim(), status: statusName.trim() }]);

        if (error) throw error;
        alert('Data tahapan baru berhasil disimpan.');
      }

      // Reset input form & refresh list
      resetForm();
      fetchStatuses();
    } catch (err) {
      console.error(err);
      setErrorMsg(`Gagal menyimpan data: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. DELETE: Hapus Baris Status
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus tahapan "${title}"?`)) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('tblstatus')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Data tahapan berhasil dihapus.');
      fetchStatuses();
    } catch (err) {
      console.error(err);
      alert(`Gagal menghapus: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Pemicu Pengeditan
  const startEdit = (item) => {
    setEditId(item.id);
    setKdStatus(item.kd_status);
    setStatusName(item.status);
  };

  const resetForm = () => {
    setEditId(null);
    setKdStatus('');
    setStatusName('');
  };

  return (
    <div className="font-mono text-xs text-slate-300 space-y-6">
      
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>LOG ERROR: {errorMsg}</span>
        </div>
      )}

      {/* FORM ENTRI DATA (Aksen Judul Kuning Emas, Tombol Biru Neon) */}
      <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-5 shadow-[0_0_20px_rgba(245,158,11,0.05)]">
        <h3 className="text-amber-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          {editId ? <Edit2 size={13} /> : <Plus size={13} />}
          {editId ? 'Form Edit Tahapan APBD' : 'Form Input Tahapan APBD (Manual Entry)'}
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          
          {/* INPUT KODE STATUS */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-amber-400/70 uppercase tracking-widest font-bold">Kode Status</label>
            <input 
              type="text"
              placeholder="Contoh: 001, 002, 003"
              value={kdStatus}
              onChange={(e) => setKdStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-white placeholder-slate-600 outline-none transition-colors font-sans"
            />
          </div>

          {/* INPUT NAMA STATUS TAHAPAN */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-amber-400/70 uppercase tracking-widest font-bold">Nama Status Tahapan</label>
            <input 
              type="text"
              placeholder="Contoh: APBD Murni, APBD Perubahan"
              value={statusName}
              onChange={(e) => setStatusName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-white placeholder-slate-600 outline-none transition-colors font-sans"
            />
          </div>

          {/* TOMBOL AKSI (Ubah ke Biru Neon / Cyan) */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={actionLoading}
              className="flex-1 bg-cyan-500 hover:bg-cyan-400 border border-cyan-300 text-slate-950 py-2 px-4 rounded-lg font-black flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-40 font-mono text-xs cursor-pointer active:scale-95"
            >
              <Save size={13} className="stroke-[2.5]" />
              <span>{editId ? 'PERBARUI NODE' : 'SIMPAN DATA'}</span>
            </button>

            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 py-2 px-3 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                title="Batalkan Edit"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* TABEL DATA HASIL INPUT */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
            Database Log // Repository tblstatus
          </span>
          <button 
            onClick={fetchStatuses}
            disabled={loading}
            className="px-2 py-1 border border-slate-800 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>REFRESH</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-3 w-16 text-center border-r border-slate-800/40 text-slate-500">ID</th>
                <th className="p-3 border-r border-slate-800/40 text-amber-400">Kode Status (`kd_status`)</th>
                <th className="p-3 border-r border-slate-800/40 text-amber-400">Status Tahapan (`status`)</th>
                <th className="p-3 text-center w-24 text-slate-500">Aksi Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-500 animate-pulse">// MENGAKSES REPOSITORI DATA STATUS...</td>
                </tr>
              ) : statuses.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-500">// BELUM ADA DATA STATUS YANG DIINPUT</td>
                </tr>
              ) : (
                statuses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 text-center border-r border-slate-900 text-slate-600 font-sans">{item.id}</td>
                    <td className="p-3 border-r border-slate-900 text-white font-sans font-medium tracking-wider">{item.kd_status}</td>
                    <td className="p-3 border-r border-slate-900 text-white font-sans font-medium uppercase">{item.status}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => startEdit(item)}
                          className="text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                          title="Ubah Data"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id, item.status)}
                          className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Hapus Data"
                        >
                          <Trash2 size={13} />
                        </button>
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
  );
}