import React, { useState, useEffect } from 'react';
import { 
  UserPlus, UserCheck, Shield, Key, Mail, Trash2, Edit3, 
  RefreshCw, Search, Cpu, Database, PlusCircle, Building2,
  FilePlus, Eye, EyeOff, User
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function UserAplikasi() {
  const [users, setUsers] = useState([]);
  const [skpdList, setSkpdList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // State Form Input / Edit
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    nama: '',
    password: '',
    status: 'SKPD',
    kd_skpd: '',
    nm_skpd: ''
  });

  // Fetch Data User dari tbluser
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tbluser')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      alert(`Gagal mengambil data user: ${error.message}`);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  // Fetch Data SKPD dari tblskpd
  const fetchSkpdList = async () => {
    const { data, error } = await supabase
      .from('tblskpd')
      .select('kd_skpd, nm_skpd')
      .order('kd_skpd', { ascending: true });

    if (error) {
      console.error('Gagal mengambil data SKPD:', error.message);
    } else if (data) {
      const uniqueSkpdMap = new Map();
      data.forEach(item => {
        if (item.nm_skpd && !uniqueSkpdMap.has(item.nm_skpd.trim().toUpperCase())) {
          uniqueSkpdMap.set(item.nm_skpd.trim().toUpperCase(), item);
        }
      });
      
      setSkpdList(Array.from(uniqueSkpdMap.values()));
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSkpdList();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSkpdChange = (e) => {
    const selectedKd = e.target.value;
    const selectedItem = skpdList.find(item => item.kd_skpd === selectedKd);
    
    setFormData({
      ...formData,
      kd_skpd: selectedKd,
      nm_skpd: selectedItem ? selectedItem.nm_skpd : ''
    });
  };

  // Reset Form / Tombol DATA BARU (Mengaktifkan Background Putih pada Mode Baru)
  const resetForm = () => {
    setFormData({ 
      email: '', 
      nama: '',
      password: '', 
      status: 'SKPD',
      kd_skpd: '',
      nm_skpd: ''
    });
    setIsEditing(false);
    setSelectedUser(null);
    setShowPassword(false);
  };

  // Pilih User dari Tabel
  const handleSelectUserFromTable = (item) => {
    setIsEditing(true);
    setSelectedUser(item);
    setShowPassword(false);
    setFormData({
      email: item.email || '',
      nama: item.nama || '',
      password: item.password || '',
      status: item.status || 'SKPD',
      kd_skpd: item.kd_skpd || '',
      nm_skpd: item.nm_skpd || ''
    });
  };

  // Class styling dinamis untuk input
  // Jika Mode Tambah Baru (!isEditing) -> background putih
  // Jika Mode Edit (isEditing) -> background dark bawaan
  const inputBgClass = !isEditing 
    ? 'bg-white text-slate-900 border-slate-300 focus:border-cyan-600 focus:ring-cyan-600 placeholder-slate-400 font-semibold' 
    : 'bg-slate-900/90 text-cyan-200 border-slate-800 focus:border-cyan-500 focus:ring-cyan-500 placeholder-slate-600';

  // 1. INSERT USER (AUTH + TBLUSER)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.nama) {
      alert('Email, Nama, dan Password wajib diisi!');
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (authError) throw authError;

      const { error: dbError } = await supabase
        .from('tbluser')
        .insert([
          { 
            nama: formData.nama.trim(),
            email: formData.email.trim(),
            password: formData.password,
            status: formData.status,
            kd_skpd: formData.kd_skpd,
            nm_skpd: formData.nm_skpd
          }
        ]);

      if (dbError) throw dbError;

      alert('User baru berhasil dibuat!');
      resetForm();
      fetchUsers();
    } catch (err) {
      alert(`Gagal membuat user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. UPDATE USER (UPDATE TBLUSER)
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setLoading(true);

    try {
      const updatePayload = {
        nama: formData.nama.trim(),
        email: formData.email.trim(),
        status: formData.status,
        kd_skpd: formData.kd_skpd,
        nm_skpd: formData.nm_skpd
      };

      if (formData.password) {
        updatePayload.password = formData.password;
      }

      const { error: dbError } = await supabase
        .from('tbluser')
        .update(updatePayload)
        .eq('id', selectedUser.id);

      if (dbError) throw dbError;

      alert('Data user berhasil diperbarui!');
      resetForm();
      fetchUsers();
    } catch (err) {
      alert(`Gagal mengupdate data user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. DELETE USER
  const handleDeleteUser = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Apakah Anda yakin ingin menghapus user ${item.nama || item.email}?`)) return;

    setLoading(true);

    try {
      const { error: dbError } = await supabase
        .from('tbluser')
        .delete()
        .eq('id', item.id);

      if (dbError) throw dbError;

      alert('User berhasil dihapus!');
      resetForm();
      fetchUsers();
    } catch (err) {
      alert(`Gagal menghapus user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ADMIN':
        return 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
      case 'TAPD':
        return 'bg-amber-950/60 border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]';
      default:
        return 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300';
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.nama && u.nama.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.status && u.status.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.nm_skpd && u.nm_skpd.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.kd_skpd && u.kd_skpd.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-cyan-500/30 pb-4">
        <div>
          <h2 className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 flex items-center gap-2">
            <Cpu className="text-cyan-400 animate-pulse" size={22} />
            MANAGEMENT USER APLIKASI
          </h2>
          <p className="text-[10px] text-slate-400 mt-1 tracking-wider uppercase">
            [ AUTH.USERS & TBLUSER INTEGRATED NODE CONTROL ]
          </p>
        </div>
        <div className="flex gap-2">
          {/*
          <button 
            onClick={resetForm} 
            className="px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900/60 text-emerald-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.15)] active:scale-95"
          >
            <PlusCircle size={14} />
            <span>DATA BARU</span>
          </button>  */}
                     
          <button 
            onClick={fetchUsers} 
            disabled={loading}
            className="px-3 py-1.5 bg-slate-900 border border-cyan-500/40 hover:bg-cyan-950/50 text-cyan-400 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-95"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>RE-SYNC DATA</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORM PANEL (LEFT) */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-cyan-500/30 p-5 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.08)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
              {isEditing ? <Edit3 size={16} /> : <UserPlus size={16} />}
              <span>{isEditing ? '//  EDIT USER SYSTEM' : '// REGISTER NEW USER'}</span>
            </div>
            
            <button
              type="button"
              onClick={resetForm}
              className="px-2 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/30 text-cyan-300 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Reset Form ke Input Data Baru"
            >
              <FilePlus size={14} />
              <span>+ TAMBAH BARU</span>
            </button>
          </div>

          <form onSubmit={isEditing ? handleUpdateUser : handleCreateUser} className="space-y-4">
            
            {/* INPUT EMAIL */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email System</label>
              <div className="relative">
                <Mail size={16} className={`absolute left-3 top-3 ${!isEditing ? 'text-slate-500' : 'text-slate-500'}`} />
                <input 
                  type="email" 
                  name="email"
                  required
                  disabled={isEditing}
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="user@domain.com"
                  className={`w-full border rounded-xl pl-10 pr-3 py-2.5 text-xs transition-all font-mono disabled:opacity-50 ${inputBgClass}`}
                />
              </div>
            </div>

            {/* INPUT NAMA */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama Lengkap</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-slate-500" />
                <input 
                  type="text" 
                  name="nama"
                  required
                  value={formData.nama}
                  onChange={handleInputChange}
                  placeholder="Masukkan nama pengguna"
                  className={`w-full border rounded-xl pl-10 pr-3 py-2.5 text-xs transition-all font-mono ${inputBgClass}`}
                />
              </div>
            </div>

            {/* INPUT PASSWORD */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isEditing ? 'Passkey / Password' : 'Passkey Auth'}
              </label>
              <div className="relative">
                <Key size={16} className="absolute left-3 top-3 text-slate-500" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  name="password"
                  required={!isEditing}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Masukkan password"
                  className={`w-full border rounded-xl pl-10 pr-10 py-2.5 text-xs transition-all font-mono ${inputBgClass}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-cyan-600 transition-colors focus:outline-none"
                  title={showPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* COMBO BOX STATUS */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role / Status Privilege</label>
              <div className="relative">
                <Shield size={16} className="absolute left-3 top-3 text-slate-500 z-10" />
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className={`w-full border rounded-xl pl-10 pr-3 py-2.5 text-xs transition-all font-mono cursor-pointer appearance-none ${inputBgClass}`}
                >
                  <option value="ADMIN" className={!isEditing ? 'bg-white text-slate-900 font-bold' : 'bg-slate-950 text-emerald-400'}>ADMIN (FULL ACCESS)</option>
                  <option value="TAPD" className={!isEditing ? 'bg-white text-slate-900 font-bold' : 'bg-slate-950 text-amber-400'}>TAPD (TIM ANGGARAN)</option>
                  <option value="SKPD" className={!isEditing ? 'bg-white text-slate-900 font-bold' : 'bg-slate-950 text-cyan-400'}>SKPD (RESTRICTED ACCESS)</option>
                </select>
              </div>
            </div>

            {/* COMBO BOX KODE SKPD */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kode SKPD</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-3 text-slate-500 z-10" />
                <select
                  name="kd_skpd"
                  value={formData.kd_skpd}
                  onChange={handleSkpdChange}
                  className={`w-full border rounded-xl pl-10 pr-3 py-2.5 text-xs transition-all font-mono cursor-pointer appearance-none ${inputBgClass}`}
                >
                  <option value="" className={!isEditing ? 'bg-white text-slate-400' : 'bg-slate-950 text-slate-500'}>-- Pilih SKPD --</option>
                  {skpdList.map((skpd) => (
                    <option key={skpd.kd_skpd} value={skpd.kd_skpd} className={!isEditing ? 'bg-white text-slate-900' : 'bg-slate-950 text-cyan-200'}>
                      {skpd.kd_skpd} - {skpd.nm_skpd}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* INPUT NAMA SKPD (READ ONLY) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nama SKPD</label>
              <input 
                type="text" 
                name="nm_skpd"
                readOnly
                value={formData.nm_skpd}
                placeholder="Otomatis terisi dari Kode SKPD"
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-400 placeholder-slate-600 focus:outline-none font-mono cursor-not-allowed"
              />
            </div>

            {/* BUTTONS ACTION */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserCheck size={14} />
                <span>{isEditing ? 'UPDATE DATA' : 'SAVE USER'}</span>
              </button>

              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  BATAL
                </button>
              )}
            </div>

          </form>
        </div>

        {/* TABLE PANEL (RIGHT) */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between backdrop-blur-md">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Database size={15} className="text-cyan-400" />
                <span>USER DIRECTORY LIST</span>
              </div>
              <div className="relative w-full sm:w-48">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Cari user / SKPD..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none transition-all font-mono"
                />
              </div>
            </div>

            {/* DATA TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-widest bg-slate-900/40">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">User & Email</th>
                    <th className="py-2.5 px-3">SKPD</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/80">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((item) => {
                      const isSelected = selectedUser?.id === item.id;
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => handleSelectUserFromTable(item)}
                          className={`transition-colors cursor-pointer group ${
                            isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : 'hover:bg-slate-900/50'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">#{item.id}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-cyan-200">{item.nama || '-'}</div>
                            <div className="text-[10px] text-slate-500">{item.email}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                            {item.kd_skpd ? (
                              <div>
                                <span className="text-cyan-400 font-bold">{item.kd_skpd}</span>
                                <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{item.nm_skpd}</div>
                              </div>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadge(item.status)}`}>
                              {item.status || 'SKPD'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectUserFromTable(item);
                                }}
                                className="p-1 rounded bg-slate-800 text-cyan-400 hover:bg-cyan-950 hover:border-cyan-500 border border-transparent transition-all cursor-pointer"
                                title="Edit User"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteUser(e, item)}
                                className="p-1 rounded bg-slate-800 text-red-400 hover:bg-red-950 hover:border-red-500 border border-transparent transition-all cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-6 text-slate-600 text-xs font-mono">
                        [ NO USER DATA FOUND ]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>TOTAL RECORDS: {filteredUsers.length}</span>
            <span>SECURE SYSTEM SYNC ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}