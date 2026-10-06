"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Users, UserPlus, BarChart3, LogOut, CheckCircle, RefreshCcw, Download, LayoutDashboard, Menu, Bell, Search, Vote, Trash2 } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [voters, setVoters] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Custom Voter Generation State
  const [showVoterModal, setShowVoterModal] = useState(false);
  const [voterPrefix, setVoterPrefix] = useState("");
  const [voterCount, setVoterCount] = useState(36);

  // Candidate CRUD State
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<any>(null);
  const [candidateForm, setCandidateForm] = useState<any>({ number: "", name: "", vision: "", mission: "", image_url: "" });

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    if (!localStorage.getItem("admin_auth")) {
      router.push("/admin");
      return;
    }
    fetchData();
    
    // Subscribe to real-time changes
    const subscription = supabase
      .channel('voters_channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'voters' }, (payload) => {
        setVoters(prev => prev.map(v => v.id === payload.new.id ? { ...v, ...payload.new } : v));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voters' }, (payload) => {
        setVoters(prev => {
          const newArr = [...prev, payload.new];
          return newArr.sort((a, b) => a.username.localeCompare(b.username));
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'voters' }, (payload) => {
        setVoters(prev => prev.filter(v => v.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [router]);

  const fetchData = async () => {
    // Supabase limits select to 1000 rows by default. We fetch all in chunks if needed.
    let allVoters: any[] = [];
    let count = 1000;
    let from = 0;
    let to = 999;
    
    while (count === 1000) {
      const { data, error } = await supabase
        .from("voters")
        .select("*")
        .range(from, to);
        
      if (data) {
        allVoters = [...allVoters, ...data];
        count = data.length;
      } else {
        break;
      }
      from += 1000;
      to += 1000;
    }

    const { data: candidatesRes } = await supabase.from("candidates").select("*").order("number", { ascending: true });

    // Sort voters logically (e.g. by username)
    allVoters.sort((a, b) => a.username.localeCompare(b.username));

    setVoters(allVoters);
    if (candidatesRes) setCandidates(candidatesRes);
    setLoading(false);
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerateCustomAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterPrefix || voterCount < 1) return;
    
    setGenerating(true);
    const newAccounts: any[] = [];
    
    for (let s = 1; s <= voterCount; s++) {
      const studentNum = s.toString().padStart(2, "0");
      const username = `${voterPrefix}-${studentNum}`;
      newAccounts.push({ username, password: generateRandomPassword(), has_voted: false });
    }

    try {
      const chunkSize = 500;
      for (let i = 0; i < newAccounts.length; i += chunkSize) {
        const chunk = newAccounts.slice(i, i + chunkSize);
        const { error } = await supabase.from("voters").insert(chunk);
        if (error) throw error;
      }
      alert(`Berhasil membuat ${newAccounts.length} akun untuk kelas ${voterPrefix}!`);
      setShowVoterModal(false);
      setVoterPrefix("");
      fetchData();
    } catch (error: any) {
      alert("Terjadi kesalahan saat generate akun: " + error.message);
    }
    setGenerating(false);
  };

  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCandidate) {
      const { error } = await supabase.from("candidates").update(candidateForm).eq("id", editingCandidate.id);
      if (error) alert("Error update: " + error.message);
      else alert("Berhasil update kandidat!");
    } else {
      const { error } = await supabase.from("candidates").insert(candidateForm);
      if (error) alert("Error tambah: " + error.message);
      else alert("Berhasil tambah kandidat!");
    }
    setShowCandidateModal(false);
    fetchData();
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!window.confirm("Yakin hapus kandidat ini?")) return;
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) alert("Error hapus: " + error.message);
    else {
      alert("Berhasil hapus kandidat!");
      fetchData();
    }
  };

  const handleResetAccounts = async () => {
    if (voters.length === 0) return;
    const confirm1 = window.confirm("PERINGATAN! Apakah Anda benar-benar yakin ingin MENGHAPUS SEMUA AKUN pemilih?");
    if (!confirm1) return;
    const confirm2 = window.prompt('Ketik "HAPUS" untuk melanjutkan:');
    if (confirm2 !== "HAPUS") {
      alert("Proses dibatalkan.");
      return;
    }

    setDeleting(true);
    try {
      // Supabase requires a filter to delete all. We use neq on an impossible uuid.
      const { error } = await supabase
        .from("voters")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;
      alert("Semua akun pemilih berhasil dihapus!");
      setVoters([]);
      setCurrentPage(1);
    } catch (error: any) {
      alert("Gagal menghapus data. Pastikan Anda sudah menjalankan ulang file database.sql untuk izin hapus (DELETE policy). Error: " + error.message);
    }
    setDeleting(false);
  };

  const exportAccountsToCSV = () => {
    if (voters.length === 0) return;
    
    const headers = ["Username", "Password", "Status Voting"];
    const csvData = voters.map(v => `${v.username},${v.password},${v.has_voted ? 'Sudah' : 'Belum'}`);
    
    const csvContent = [headers.join(","), ...csvData].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `akun_pemilos_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_auth");
    router.push("/admin");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9]">
        <div className="w-12 h-12 border-4 border-[#3C50E0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalVoters = voters.length;
  const votedCount = voters.filter(v => v.has_voted).length;
  const unvotedCount = totalVoters - votedCount;
  const votePercentage = totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0;

  const candidateVotes = candidates.map(c => {
    return {
      ...c,
      votes: voters.filter(v => v.voted_for === c.id).length
    };
  });

  // Filter Logic
  const filteredVoters = voters.filter(v => 
    v.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Pagination Logic
  const totalPages = Math.ceil(filteredVoters.length / itemsPerPage);
  const currentVoters = filteredVoters.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F1F5F9] text-[#1c2434] font-satoshi">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 z-9998 bg-black/50 lg:hidden"
        />
      )}

      {/* Sidebar (TailAdmin Style) */}
      <aside className={`absolute left-0 top-0 z-9999 flex h-screen w-72 flex-col overflow-y-hidden bg-[#24303F] duration-300 ease-linear lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5 h-20 border-b border-[#2E3A47]">
          <div className="flex items-center gap-3 mt-4">
            <div className="bg-[#3C50E0] p-1.5 rounded-md">
              <Vote className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">Pemilos Admin</h1>
          </div>
        </div>
        
        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          <nav className="mt-5 py-4 px-4 lg:mt-9 lg:px-6">
            <div>
              <h3 className="mb-4 ml-4 text-sm font-semibold text-[#8A99AF]">MENU UTAMA</h3>
              <ul className="mb-6 flex flex-col gap-1.5">
                <li>
                  <button onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }} className={`group relative flex w-full items-center gap-2.5 rounded-sm px-4 py-2 font-medium duration-300 ease-in-out hover:bg-[#333A48] text-[#DEE4EE] ${activeTab === 'overview' ? 'bg-[#333A48]' : ''}`}>
                    <LayoutDashboard className="w-5 h-5" />
                    Dashboard
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab('accounts'); setSidebarOpen(false); }} className={`group relative flex w-full items-center gap-2.5 rounded-sm px-4 py-2 font-medium duration-300 ease-in-out hover:bg-[#333A48] text-[#DEE4EE] ${activeTab === 'accounts' ? 'bg-[#333A48]' : ''}`}>
                    <Users className="w-5 h-5" />
                    Manajemen Akun
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab('candidates'); setSidebarOpen(false); }} className={`group relative flex w-full items-center gap-2.5 rounded-sm px-4 py-2 font-medium duration-300 ease-in-out hover:bg-[#333A48] text-[#DEE4EE] ${activeTab === 'candidates' ? 'bg-[#333A48]' : ''}`}>
                    <UserPlus className="w-5 h-5" />
                    Manajemen Kandidat
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </aside>

      {/* Content Area */}
      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        
        {/* Header (TailAdmin Style) */}
        <header className="sticky top-0 z-999 flex w-full bg-white drop-shadow-1 h-20 border-b border-[#E2E8F0]">
          <div className="flex flex-grow items-center justify-between px-4 py-4 shadow-2 md:px-6 2xl:px-11">
            <div className="flex items-center gap-2 sm:gap-4 lg:hidden">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="block rounded-sm border border-[#E2E8F0] bg-white p-1.5 shadow-sm">
                <Menu className="w-5 h-5" />
              </button>
            </div>
            
            <div className="hidden sm:block">
              {/* Optional header search could go here */}
            </div>

            <div className="flex items-center gap-3 2xsm:gap-7 ml-auto">
              <div className="flex items-center gap-4">
                <span className="hidden text-right lg:block">
                  <span className="block text-sm font-medium text-[#1c2434]">Osis MPK</span>
                  <span className="block text-xs text-[#64748B]">Admin</span>
                </span>
                <span className="h-10 w-10 rounded-full bg-[#3C50E0] flex items-center justify-center text-white font-bold">
                  OM
                </span>
                <button onClick={handleLogout} className="text-[#64748B] hover:text-[#DC3545] transition-colors ml-2">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 md:p-6 2xl:p-10">
          
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Data Stats */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5 mb-8">
                
                <div className="tailadmin-card p-6">
                  <div className="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-[#F1F5F9] text-[#3C50E0]">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <h4 className="text-2xl font-bold text-[#1c2434]">{totalVoters}</h4>
                      <span className="text-sm font-medium text-[#64748B]">Total Pemilih (Akun)</span>
                    </div>
                  </div>
                </div>

                <div className="tailadmin-card p-6">
                  <div className="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-[#F1F5F9] text-[#10B981]">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <h4 className="text-2xl font-bold text-[#1c2434]">{votedCount}</h4>
                      <span className="text-sm font-medium text-[#64748B]">Sudah Memilih</span>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-[#10B981]">
                      {votePercentage}%
                    </span>
                  </div>
                </div>

                <div className="tailadmin-card p-6">
                  <div className="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-[#F1F5F9] text-[#DC3545]">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <h4 className="text-2xl font-bold text-[#1c2434]">{unvotedCount}</h4>
                      <span className="text-sm font-medium text-[#64748B]">Belum Memilih</span>
                    </div>
                  </div>
                </div>

                <div className="tailadmin-card p-6 border-t-4 border-t-[#F59E0B]">
                  <div className="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-[#F1F5F9] text-[#F59E0B]">
                    <RefreshCcw className="h-6 w-6 animate-spin-slow" />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <h4 className="text-2xl font-bold text-[#1c2434]">Live</h4>
                      <span className="text-sm font-medium text-[#64748B]">Status Server</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Charts & Vote Counts */}
              <div className="tailadmin-card p-6 xl:p-7.5">
                <h4 className="mb-6 text-xl font-bold text-[#1c2434]">Perolehan Suara Sementara</h4>
                
                <div className="flex flex-col gap-6">
                  {candidateVotes.map((candidate) => {
                    const percentage = votedCount > 0 ? Math.round((candidate.votes / votedCount) * 100) : 0;
                    return (
                      <div key={candidate.id} className="flex flex-col md:flex-row items-center gap-6 border-b border-[#E2E8F0] pb-6 last:border-0 last:pb-0">
                        <div className="flex w-full md:w-1/3 items-center gap-4">
                          <div className="h-16 w-16 rounded-full overflow-hidden border border-[#E2E8F0] bg-gray-100 flex-shrink-0">
                            {candidate.image_url ? (
                              <img src={candidate.image_url} alt="Kandidat" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-[#64748B] font-bold text-xl">{candidate.number}</div>
                            )}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-[#3C50E0]">Paslon {candidate.number}</span>
                            <h5 className="text-lg font-bold text-[#1c2434]">{candidate.name}</h5>
                          </div>
                        </div>
                        
                        <div className="flex w-full md:w-2/3 items-center gap-5">
                          <div className="w-full bg-[#E2E8F0] rounded-full h-4">
                            <div className="bg-[#3C50E0] h-4 rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                          </div>
                          <div className="flex flex-col text-right min-w-[80px]">
                            <span className="font-bold text-xl text-[#1c2434]">{candidate.votes}</span>
                            <span className="text-sm font-medium text-[#64748B]">{percentage}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
              
              <div className="tailadmin-card p-6.5">
                
                {/* Header Actions */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-[#E2E8F0] pb-4 mb-4">
                  <div>
                    <h3 className="font-bold text-[#1c2434] text-lg">Manajemen Akun Pemilih</h3>
                    <p className="text-sm font-medium text-[#64748B]">Total: {totalVoters} Akun terdaftar</p>
                  </div>
                  <div className="flex flex-wrap gap-3 w-full xl:w-auto">
                    <button 
                      onClick={exportAccountsToCSV}
                      className="inline-flex items-center justify-center gap-2.5 rounded-md border border-[#E2E8F0] py-2 px-4 text-center font-medium text-[#1c2434] hover:bg-gray-50 flex-1 xl:flex-none"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                    <button 
                      onClick={() => setShowVoterModal(true)}
                      className="inline-flex items-center justify-center gap-2.5 rounded-md bg-[#3C50E0] py-2 px-4 text-center font-medium text-white hover:bg-opacity-90 flex-1 xl:flex-none"
                    >
                      <UserPlus className="w-4 h-4" />
                      Buat Akun Kelas
                    </button>
                    <button 
                      onClick={handleResetAccounts}
                      disabled={deleting}
                      className="inline-flex items-center justify-center gap-2.5 rounded-md bg-[#DC3545] py-2 px-4 text-center font-medium text-white hover:bg-opacity-90 disabled:opacity-50 flex-1 xl:flex-none"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting ? "Menghapus..." : "Hapus Semua"}
                    </button>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                  <div className="relative w-full sm:w-80">
                    <button className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Search className="w-4.5 h-4.5 text-[#8A99AF]" />
                    </button>
                    <input 
                      type="text" 
                      placeholder="Cari kelas atau username... (ex: X-TKR)" 
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1); // Reset page on search
                      }}
                      className="w-full rounded-md border border-[#E2E8F0] bg-transparent py-2 pl-10 pr-4 font-medium outline-none focus:border-[#3C50E0]" 
                    />
                  </div>
                  <div className="text-sm font-medium text-[#64748B]">
                    Menampilkan {filteredVoters.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredVoters.length)} dari {filteredVoters.length} hasil
                  </div>
                </div>

                {/* Table */}
                <div className="max-w-full overflow-x-auto border border-[#E2E8F0] rounded-md">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-[#F1F5F9] text-left text-xs uppercase tracking-wider">
                        <th className="min-w-[50px] py-3 px-4 font-bold text-[#1c2434] border-b border-[#E2E8F0]">No</th>
                        <th className="min-w-[150px] py-3 px-4 font-bold text-[#1c2434] border-b border-[#E2E8F0]">Username / Kelas</th>
                        <th className="min-w-[150px] py-3 px-4 font-bold text-[#1c2434] border-b border-[#E2E8F0]">Password</th>
                        <th className="min-w-[120px] py-3 px-4 font-bold text-[#1c2434] border-b border-[#E2E8F0]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentVoters.map((v, idx) => (
                        <tr key={v.id} className="border-b border-[#E2E8F0] hover:bg-[#F9FAFB]">
                          <td className="py-3 px-4 text-[#1c2434]">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                          <td className="py-3 px-4 text-[#1c2434] font-medium font-mono">{v.username}</td>
                          <td className="py-3 px-4 text-[#64748B] font-mono">{v.password}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-xs font-semibold ${
                              v.has_voted ? 'bg-[#10B981] text-[#10B981]' : 'bg-[#DC3545] text-[#DC3545]'
                            }`}>
                              {v.has_voted ? 'Sudah Memilih' : 'Belum Memilih'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredVoters.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-10 px-4 text-center">
                            <p className="text-[#64748B] font-medium">Data tidak ditemukan.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-4 mt-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded border border-[#E2E8F0] py-1 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-medium text-[#1c2434]">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded border border-[#E2E8F0] py-1 px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Candidates Tab */}
          {activeTab === 'candidates' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
              <div className="tailadmin-card p-6.5">
                <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-4 mb-4">
                  <h3 className="font-bold text-[#1c2434] text-lg">Manajemen Kandidat</h3>
                  <button onClick={() => {
                    setEditingCandidate(null);
                    setCandidateForm({ number: "", name: "", vision: "", mission: "", image_url: "" });
                    setShowCandidateModal(true);
                  }} className="inline-flex items-center gap-2 rounded-md bg-[#3C50E0] py-2 px-4 text-white font-medium hover:bg-opacity-90">
                    <UserPlus className="w-4 h-4" />
                    Tambah Kandidat
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {candidates.map(c => (
                    <div key={c.id} className="border border-[#E2E8F0] rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between">
                       <div>
                         <div className="h-40 w-full rounded-lg overflow-hidden bg-gray-100 mb-4 border border-[#E2E8F0]">
                           {c.image_url ? (
                             <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                           ) : (
                             <div className="h-full w-full flex items-center justify-center text-[#64748B] font-bold text-4xl">{c.number}</div>
                           )}
                         </div>
                         <h4 className="font-bold text-[#1c2434] text-lg mb-1">Paslon {c.number}: {c.name}</h4>
                         <div className="text-sm text-[#64748B] mb-4 line-clamp-3"><strong>Visi:</strong> {c.vision}</div>
                       </div>
                       <div className="flex gap-2 mt-auto">
                          <button onClick={() => { setEditingCandidate(c); setCandidateForm(c); setShowCandidateModal(true); }} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-md font-medium transition-colors">Edit</button>
                          <button onClick={() => handleDeleteCandidate(c.id)} className="flex-1 bg-[#DC3545] hover:bg-red-700 text-white py-2 rounded-md font-medium transition-colors">Hapus</button>
                       </div>
                    </div>
                  ))}
                  {candidates.length === 0 && (
                    <div className="col-span-full py-10 text-center text-[#64748B]">Belum ada kandidat yang ditambahkan.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Voter Generation Modal */}
          {showVoterModal && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4 text-[#1c2434]">Buat Akun Kelas Custom</h3>
                <form onSubmit={handleGenerateCustomAccounts}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#1c2434] mb-1">Prefix Kelas (contoh: X-TKR-1)</label>
                    <input required type="text" value={voterPrefix} onChange={(e) => setVoterPrefix(e.target.value)} className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-[#1c2434] focus:outline-none focus:border-[#3C50E0]" />
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#1c2434] mb-1">Jumlah Siswa</label>
                    <input required type="number" min="1" value={voterCount} onChange={(e) => setVoterCount(parseInt(e.target.value))} className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-[#1c2434] focus:outline-none focus:border-[#3C50E0]" />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowVoterModal(false)} className="px-4 py-2 border border-[#E2E8F0] rounded-md text-[#64748B] font-medium hover:bg-gray-50">Batal</button>
                    <button type="submit" disabled={generating} className="px-4 py-2 bg-[#3C50E0] rounded-md text-white font-medium hover:bg-opacity-90 disabled:opacity-50">{generating ? "Memproses..." : "Generate"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Candidate Modal */}
          {showCandidateModal && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4 animate-in fade-in overflow-y-auto py-10">
              <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 my-auto">
                <h3 className="text-xl font-bold mb-4 text-[#1c2434]">{editingCandidate ? "Edit Kandidat" : "Tambah Kandidat"}</h3>
                <form onSubmit={handleSaveCandidate}>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                     <div>
                       <label className="block text-sm font-medium text-[#1c2434] mb-1">Nomor Urut</label>
                       <input required type="number" value={candidateForm.number} onChange={e => setCandidateForm({...candidateForm, number: e.target.value})} className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-[#1c2434] focus:outline-none focus:border-[#3C50E0]" />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-[#1c2434] mb-1">Nama Kandidat</label>
                       <input required type="text" value={candidateForm.name} onChange={e => setCandidateForm({...candidateForm, name: e.target.value})} className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-[#1c2434] focus:outline-none focus:border-[#3C50E0]" />
                     </div>
                   </div>
                   <div className="mb-4">
                     <label className="block text-sm font-medium text-[#1c2434] mb-1">URL Foto (Opsional)</label>
                     <input type="text" value={candidateForm.image_url} onChange={e => setCandidateForm({...candidateForm, image_url: e.target.value})} className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-[#1c2434] focus:outline-none focus:border-[#3C50E0]" />
                   </div>
                   <div className="mb-4">
                     <label className="block text-sm font-medium text-[#1c2434] mb-1">Visi</label>
                     <textarea required value={candidateForm.vision} onChange={e => setCandidateForm({...candidateForm, vision: e.target.value})} className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-[#1c2434] h-20 focus:outline-none focus:border-[#3C50E0]"></textarea>
                   </div>
                   <div className="mb-6">
                     <label className="block text-sm font-medium text-[#1c2434] mb-1">Misi</label>
                     <textarea required value={candidateForm.mission} onChange={e => setCandidateForm({...candidateForm, mission: e.target.value})} className="w-full border border-[#E2E8F0] rounded-md px-3 py-2 text-[#1c2434] h-24 focus:outline-none focus:border-[#3C50E0]"></textarea>
                   </div>
                   <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowCandidateModal(false)} className="px-4 py-2 border border-[#E2E8F0] rounded-md text-[#64748B] font-medium hover:bg-gray-50">Batal</button>
                    <button type="submit" className="px-4 py-2 bg-[#3C50E0] rounded-md text-white font-medium hover:bg-opacity-90">Simpan</button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
