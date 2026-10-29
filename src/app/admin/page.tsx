'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { 
  Check,
  Dices, 
  X, 
  Trophy, 
  Users, 
  Image as ImageIcon, 
  Clock, 
  AlertCircle,
  Loader2,
  ChevronRight,
  MessageSquare,
  Search,
  Grid,
  Eye,
  EyeOff,
  Star,
  CheckCircle2,
  Mail,
  RotateCw,
  Crown,
  Medal,
  Sparkles,
  Award,
  Maximize2,
  Tv,
  ExternalLink,
  ArrowLeft,
  HelpCircle,
  MapPin,
  KeyRound,
  Trash2,
  UserX,
  AlertTriangle,
  Lock,
  User,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import type { Player, PendingSubmission, RejectedSubmission, GridCell } from '@/lib/db';
import { formatDateTime } from '@/lib/dateUtils';

export default function AdminPage() {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [rejectedSubmissions, setRejectedSubmissions] = useState<RejectedSubmission[]>([]);
  const [feedTab, setFeedTab] = useState<'pending' | 'rejected'>('pending');
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<{ [key: string]: string }>({});
  const [showRejectInput, setShowRejectInput] = useState<{ [key: string]: boolean }>({});
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // User Grid Inspector State
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerGrid, setPlayerGrid] = useState<GridCell[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [inspectingCell, setInspectingCell] = useState<GridCell | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Tab State
  const [leaderboardTab, setLeaderboardTab] = useState<'top10' | 'all'>('top10');
  const [showTop10Modal, setShowTop10Modal] = useState(false);

  // Admin Account Reset & Recovery State
  const [targetAccountPlayer, setTargetAccountPlayer] = useState<Player | null>(null);
  const [accountActionModal, setAccountActionModal] = useState<'delete' | 'reset_password' | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('Confianz@2026');
  const [accountActionLoading, setAccountActionLoading] = useState(false);
  const [accountActionFeedback, setAccountActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Authentication State
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const selectedPlayerRef = useRef<Player | null>(null);
  useEffect(() => {
    selectedPlayerRef.current = selectedPlayer;
  }, [selectedPlayer]);

  const initDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/init');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.pendingSubmissions || []);
        setRejectedSubmissions(data.rejectedSubmissions || []);
        setLeaderboard(data.leaderboard || []);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      } else {
        console.error('Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Error fetching dashboard init:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check existing session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/check-auth');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            await initDashboard();
          } else {
            setIsAuthenticated(false);
            setLoading(false);
          }
        } else {
          setIsAuthenticated(false);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error checking admin auth:', err);
        setIsAuthenticated(false);
        setLoading(false);
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword) {
      setAuthError('Please enter both username and password.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
        setAdminPassword('');
        setAuthError(null);
        await initDashboard();
      } else {
        setAuthError(data.error || 'Invalid credentials. Access denied.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setAuthError('Network error connecting to login service.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setIsAuthenticated(false);
    setSubmissions([]);
    setLeaderboard([]);
    setSelectedPlayer(null);
  };

  // Socket listener for real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();
    if (!socket) return;

    socket.connect();
    socket.emit('join', 'admin');

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('new-submission', (data: PendingSubmission) => {
      setSubmissions((prev) => {
        if (prev.some((s) => s.player_id === data.player_id && s.tile_index === data.tile_index)) {
          return prev.map((s) =>
            s.player_id === data.player_id && s.tile_index === data.tile_index ? data : s
          );
        }
        return [data, ...prev];
      });

      // Remove from rejected if contestant retried
      setRejectedSubmissions((prev) =>
        prev.filter((s) => !(s.player_id === data.player_id && s.tile_index === data.tile_index))
      );

      if (selectedPlayerRef.current && selectedPlayerRef.current.id === data.player_id) {
        setPlayerGrid((prev) =>
          prev.map((c) =>
            c.tile_index === data.tile_index
              ? { ...c, status: 'pending', image_path: data.image_path || null, text_answer: data.text_answer || null, uploaded_at: data.uploaded_at, approved_at: null, rejection_reason: null }
              : c
          )
        );
      }
    });

    socket.on('leaderboard-update', (data: Player[]) => {
      setLeaderboard(data);
      if (selectedPlayerRef.current) {
        const updated = data.find((p) => p.id === selectedPlayerRef.current?.id);
        if (updated) {
          setSelectedPlayer(updated);
        }
      }
    });

    socket.on('submission-handled', (data: { playerId: string; tileIndex: number; status: string; uploadedAt?: string; approvedAt?: string; rejectionReason?: string | null; rejectionCount?: number; cell?: any }) => {
      setSubmissions((prev) =>
        prev.filter((s) => !(s.player_id === data.playerId && s.tile_index === data.tileIndex))
      );

      if (data.status === 'rejected' && data.cell) {
        setRejectedSubmissions((prev) => {
          const filtered = prev.filter((s) => !(s.player_id === data.playerId && s.tile_index === data.tileIndex));
          return [data.cell, ...filtered];
        });
      } else if (data.status === 'approved') {
        setRejectedSubmissions((prev) =>
          prev.filter((s) => !(s.player_id === data.playerId && s.tile_index === data.tileIndex))
        );
      }

      if (selectedPlayerRef.current && selectedPlayerRef.current.id === data.playerId) {
        setPlayerGrid((prev) =>
          prev.map((c) =>
            c.tile_index === data.tileIndex
              ? { 
                  ...c, 
                  status: data.status as any,
                  uploaded_at: data.uploadedAt !== undefined ? data.uploadedAt : c.uploaded_at,
                  approved_at: data.status === 'approved' ? (data.approvedAt || new Date().toISOString()) : null,
                  rejection_reason: data.status === 'rejected' ? (data.rejectionReason || null) : null,
                  rejection_count: data.rejectionCount !== undefined ? data.rejectionCount : (c.rejection_count || 0)
                }
              : c
          )
        );
      }

      setInspectingCell((prev) => {
        if (prev && selectedPlayerRef.current?.id === data.playerId && prev.tile_index === data.tileIndex) {
          return {
            ...prev,
            status: data.status as any,
            uploaded_at: data.uploadedAt !== undefined ? data.uploadedAt : prev.uploaded_at,
            approved_at: data.status === 'approved' ? (data.approvedAt || new Date().toISOString()) : null,
            rejection_reason: data.status === 'rejected' ? (data.rejectionReason || null) : null,
            rejection_count: data.rejectionCount !== undefined ? data.rejectionCount : (prev.rejection_count || 0)
          };
        }
        return prev;
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new-submission');
      socket.off('leaderboard-update');
      socket.off('submission-handled');
      socket.disconnect();
    };
  }, [isAuthenticated]);

  const handleInspectUserById = async (playerId: string) => {
    setLoadingGrid(true);
    setInspectingCell(null);

    try {
      const res = await fetch(`/api/admin/player-grid?id=${encodeURIComponent(playerId)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPlayer(data.player);
        setPlayerGrid(data.grid || []);
      } else {
        alert('Failed to load user bingo grid');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching user grid');
    } finally {
      setLoadingGrid(false);
    }
  };

  const handleInspectUser = (player: Player) => {
    setSelectedPlayer(player);
    handleInspectUserById(player.id);
  };

  const handleAction = async (
    playerId: string,
    tileIndex: number,
    status: 'approved' | 'rejected'
  ) => {
    const processKey = `${playerId}_${tileIndex}`;
    setProcessingId(processKey);

    const rejectionReason = rejectionReasons[processKey] || '';

    if (status === 'rejected' && !rejectionReason.trim()) {
      alert('Please specify a rejection reason.');
      setProcessingId(null);
      return;
    }

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          tileIndex,
          status,
          rejectionReason
        })
      });

      if (res.ok) {
        const data = await res.json();

        setSubmissions((prev) =>
          prev.filter((s) => !(s.player_id === playerId && s.tile_index === tileIndex))
        );

        const cellFromResponse = data.grid?.find((g: any) => g.tile_index === tileIndex);
        const resolvedApprovedAt = status === 'approved' 
          ? (cellFromResponse?.approved_at || new Date().toISOString()) 
          : null;

        if (status === 'rejected') {
          const subItem = submissions.find((s) => s.player_id === playerId && s.tile_index === tileIndex);
          const cellItem = cellFromResponse || playerGrid.find((c) => c.tile_index === tileIndex) || inspectingCell;
          const newRejectedItem: RejectedSubmission = {
            player_id: playerId,
            player_name: subItem?.player_name || selectedPlayer?.name || 'Player',
            player_nickname: subItem?.player_nickname || selectedPlayer?.nickname,
            player_department: subItem?.player_department || selectedPlayer?.department || '',
            tile_index: tileIndex,
            task_id: cellItem?.task_id || subItem?.task_id || 0,
            task_title: cellItem?.task_title || subItem?.task_title || '',
            task_description: cellItem?.task_description || subItem?.task_description || '',
            task_type: cellItem?.task_type || subItem?.task_type || 'photo',
            clue_image: cellItem?.clue_image || subItem?.clue_image || null,
            image_path: cellItem?.image_path || subItem?.image_path || null,
            text_answer: cellItem?.text_answer || subItem?.text_answer || null,
            uploaded_at: cellItem?.uploaded_at || subItem?.uploaded_at || new Date().toISOString(),
            rejection_reason: rejectionReason,
            rejection_count: cellItem?.rejection_count || 1
          };
          setRejectedSubmissions((prev) => [newRejectedItem, ...prev.filter((r) => !(r.player_id === playerId && r.tile_index === tileIndex))]);
        } else {
          setRejectedSubmissions((prev) => prev.filter((r) => !(r.player_id === playerId && r.tile_index === tileIndex)));
        }

        if (selectedPlayer && selectedPlayer.id === playerId) {
          setPlayerGrid((prev) =>
            prev.map((c) =>
              c.tile_index === tileIndex
                ? { 
                    ...c, 
                    status, 
                    approved_at: resolvedApprovedAt,
                    rejection_reason: status === 'rejected' ? rejectionReason : null 
                  }
                : c
            )
          );
          if (data.player) {
            setSelectedPlayer(data.player);
          }
        }

        if (inspectingCell && inspectingCell.tile_index === tileIndex) {
          setInspectingCell((prev) =>
            prev
              ? { 
                  ...prev, 
                  status, 
                  approved_at: resolvedApprovedAt,
                  rejection_reason: status === 'rejected' ? rejectionReason : null 
                }
              : null
          );
        }

        const newReasons = { ...rejectionReasons };
        delete newReasons[processKey];
        setRejectionReasons(newReasons);

        const newShowReject = { ...showRejectInput };
        delete newShowReject[processKey];
        setShowRejectInput(newShowReject);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Operation failed'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to submit action. Check console for details.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenDeleteAccountModal = (player: Player, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetAccountPlayer(player);
    setAccountActionFeedback(null);
    setAccountActionModal('delete');
  };

  const handleOpenResetPasswordModal = (player: Player, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetAccountPlayer(player);
    setNewPasswordInput('Confianz@2026');
    setAccountActionFeedback(null);
    setAccountActionModal('reset_password');
  };

  const handleExecuteAccountAction = async () => {
    if (!targetAccountPlayer || !accountActionModal) return;
    setAccountActionLoading(true);
    setAccountActionFeedback(null);

    try {
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: accountActionModal,
          playerId: targetAccountPlayer.id,
          newPassword: newPasswordInput.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (accountActionModal === 'delete') {
          setLeaderboard((prev) => prev.filter((p) => p.id !== targetAccountPlayer.id));
          if (selectedPlayer?.id === targetAccountPlayer.id) {
            setSelectedPlayer(null);
            setPlayerGrid([]);
          }
          setAccountActionFeedback({
            type: 'success',
            message: `Account released! ${targetAccountPlayer.email || targetAccountPlayer.nickname} has been deleted and can now be registered again.`
          });
          setTimeout(() => {
            setAccountActionModal(null);
            setTargetAccountPlayer(null);
            setAccountActionFeedback(null);
          }, 1800);
        } else if (accountActionModal === 'reset_password') {
          setAccountActionFeedback({
            type: 'success',
            message: `Password reset successfully! Temporary password: ${data.tempPassword}`
          });
        }
      } else {
        setAccountActionFeedback({
          type: 'error',
          message: data.error || 'Failed to complete account action'
        });
      }
    } catch (err) {
      console.error('Error executing account action:', err);
      setAccountActionFeedback({
        type: 'error',
        message: 'Network error communicating with server'
      });
    } finally {
      setAccountActionLoading(false);
    }
  };

  const getTileGridColor = (cell: GridCell) => {
    if (cell.tile_index === 12) {
      return 'bg-[#DF0586] border-2 border-black text-white font-black';
    }
    switch (cell.status) {
      case 'approved':
        return 'bg-[#FFDC47] border-2 border-black text-black font-black';
      case 'pending':
        return 'bg-[#2E2405] border-2 border-[#FFDC47] text-[#FFDC47] animate-pulse';
      case 'rejected':
        return 'bg-[#2E0B1B] border-2 border-[#DF0586] text-[#FF6699]';
      default:
        return 'bg-[#1C1C24] border-2 border-[#2E2E3E] text-slate-300 hover:border-[#FFDC47]';
    }
  };

  const filteredLeaderboard = leaderboard.filter((p) => {
    const q = userSearchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.nickname && p.nickname.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.department && p.department.toLowerCase().includes(q))
    );
  });

  if (authChecking || (loading && isAuthenticated)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0A0A0C] text-white min-h-screen">
        <div className="w-16 h-16 rounded-2xl bg-[#FFDC47] text-black flex items-center justify-center shadow-neo-yellow animate-bounce">
          <Dices className="w-8 h-8 text-black" />
        </div>
        <p className="mt-6 text-sm font-extrabold tracking-widest text-[#FFDC47] uppercase">
          {authChecking ? 'Verifying Admin Session...' : 'Booting Admin Console...'}
        </p>
      </div>
    );
  }

  // ADMIN LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col bg-[#0A0A0C] text-white min-h-screen selection:bg-[#FFDC47] selection:text-black relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full evolve-sunburst-subtle pointer-events-none opacity-40" />

        {/* Minimal Header */}
        <header className="p-4 sm:p-6 flex items-center justify-between max-w-6xl mx-auto w-full z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FFDC47] text-black flex items-center justify-center shadow-neo-black-sm">
              <Dices className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black tracking-tight text-white">
                  thilakkam <span className="text-[#FFDC47]">quest</span>
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider bg-black text-[#FFDC47] border border-[#2B2B38] px-2 py-0.5 rounded-full">
                  Admin Gateway
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold">Organizing Committee Portal</p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#181822] hover:bg-[#222230] border border-[#2D2D3E] text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Participant View</span>
          </Link>
        </header>

        {/* Centered Login Card */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 z-10">
          <div className="w-full max-w-md bg-[#141418] border-2 border-black rounded-[32px] p-6 sm:p-8 shadow-neo-yellow relative overflow-hidden">
            
            {/* Header Badge & Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDC47] text-black font-extrabold text-[10px] tracking-wider uppercase mb-3 shadow-neo-black-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-black" />
                Authorized Arbiters Only
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Control Room Login
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1.5">
                Enter your administrative credentials to review challenges and moderate contestant boards.
              </p>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="mb-5 p-3.5 rounded-2xl bg-[#EF4444]/15 border-2 border-[#EF4444]/40 text-[#EF4444] text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#FFDC47]" /> Admin Username
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter admin username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#0B0B0E] border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-600 outline-none font-medium text-sm transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#DF0586]" /> Admin Password
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-11 rounded-2xl bg-[#0B0B0E] border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-600 outline-none font-medium text-sm transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full mt-2 bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold py-4 px-6 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
              >
                {authSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-black" />
                    <span>Enter Control Room</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-[#232330] text-center">
              <p className="text-[10px] text-slate-500 font-medium">
                Confianz Thilakkam Annual Day • Internal Operations Portal
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0C] text-white min-h-screen selection:bg-[#FFDC47] selection:text-black">
      
      {/* Fullscreen Image Overlay */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-[#181820] border-2 border-black rounded-full hover:bg-black text-white cursor-pointer shadow-neo-yellow-sm"
            onClick={() => setFullscreenImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={fullscreenImage} 
            alt="Fullscreen preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-3xl border-2 border-black shadow-neo-yellow"
          />
        </div>
      )}

      {/* Header Bar */}
      <header className="border-b-2 border-black bg-[#0A0A0C]/90 p-3 sm:p-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#181820] hover:bg-[#222230] text-slate-300 hover:text-white border-2 border-[#2E2E3E] flex items-center justify-center transition-colors flex-shrink-0"
              title="Return to Game"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FFDC47] text-black flex items-center justify-center shadow-neo-black-sm flex-shrink-0">
              <Dices className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-white whitespace-nowrap">
                  thilakkam <span className="text-[#FFDC47]">quest</span>
                </h1>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-[#FFDC47] text-black px-2 sm:px-2.5 py-0.5 rounded-full border border-black shadow-neo-black-sm whitespace-nowrap">
                  Admin Console
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-semibold truncate sm:overflow-visible">
                Real-Time Challenge Moderation & Player Inspector
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link
              href="/leaderboard"
              target="_blank"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-[#181822] hover:bg-[#222230] border-2 border-black text-[#FFDC47] text-xs font-black shadow-neo-black-sm transition-all"
            >
              <Tv className="w-4 h-4 text-[#FFDC47]" />
              <span>Big Screen TV</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#141418] border-2 border-black px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full shadow-neo-black-sm">
              <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${socketConnected ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-red-500'}`} />
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-300 whitespace-nowrap">
                {socketConnected ? 'Live Feed' : 'Offline'}
              </span>
            </div>

            <button
              onClick={handleAdminLogout}
              title="Sign Out of Admin Console"
              className="flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-[#1C1215] hover:bg-[#EF4444] text-[#EF4444] hover:text-white border-2 border-black text-xs font-black shadow-neo-black-sm transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Screen */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT COLUMN: Approval & Moderation Feed (Col span 7) */}
        <section className="lg:col-span-7 flex flex-col min-h-[500px]">
          {/* Feed Tab Switcher */}
          <div className="flex flex-wrap items-center justify-between mb-3 sm:mb-4 border-b-2 border-[#202028] pb-2.5 sm:pb-3 gap-2">
            <div className="p-1 bg-[#141418] rounded-full border-2 border-black flex items-center gap-1 shadow-neo-black-sm">
              <button
                type="button"
                onClick={() => setFeedTab('pending')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  feedTab === 'pending'
                    ? 'bg-[#FFDC47] text-black shadow-neo-black-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pending ({submissions.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedTab('rejected')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  feedTab === 'rejected'
                    ? 'bg-[#DF0586] text-white shadow-neo-black-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Rejected ({rejectedSubmissions.length})</span>
              </button>
            </div>

            <span className="text-[10px] sm:text-xs px-2.5 py-1 rounded-full bg-[#141418] border border-[#2A2A38] text-slate-300 font-bold shadow-neo-black-sm flex-shrink-0 whitespace-nowrap">
              {feedTab === 'pending' ? `${submissions.length} Awaiting Review` : `${rejectedSubmissions.length} Rejected Records`}
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-190px)] pr-1.5 pb-8">
            {feedTab === 'pending' ? (
              submissions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#2A2A38] rounded-[32px] p-12 text-center bg-[#141418]/40 my-auto">
                <div className="w-14 h-14 rounded-2xl bg-[#FFDC47] text-black flex items-center justify-center shadow-neo-black-sm mb-3">
                  <CheckCircle2 className="w-7 h-7 text-black" />
                </div>
                <h3 className="text-base font-black text-white">All Caught Up!</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  No submissions waiting for review. New photo uploads will show up here instantly in real-time.
                </p>
              </div>
            ) : (
              submissions.map((sub) => {
                const processKey = `${sub.player_id}_${sub.tile_index}`;
                const isProcessing = processingId === processKey;
                const isRejecting = showRejectInput[processKey];

                return (
                  <div 
                    key={processKey} 
                    className="bg-[#141418] border-2 border-black rounded-[26px] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 shadow-neo-yellow relative transition-all"
                  >
                    {/* Media / Text Answer / Clue Container */}
                    <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                      {/* If task has a reference clue image, show it */}
                      {sub.clue_image && (
                        <div 
                          onClick={() => setFullscreenImage(sub.clue_image || null)}
                          className="w-full sm:w-36 h-32 sm:h-auto aspect-video sm:aspect-square rounded-2xl overflow-hidden border-2 border-black bg-black flex-shrink-0 cursor-pointer relative group/clue shadow-neo-black-sm"
                          title="Click to zoom reference clue"
                        >
                          <img 
                            src={sub.clue_image} 
                            alt="Reference Clue" 
                            className="w-full h-full object-cover group-hover/clue:scale-105 transition-transform"
                          />
                          <span className="absolute top-1.5 left-1.5 bg-[#DF0586] text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-black shadow-neo-black-sm flex items-center gap-1">
                            <ImageIcon className="w-2.5 h-2.5" /> Clue Photo
                          </span>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/clue:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black text-[#FFDC47]">
                            <Eye className="w-3.5 h-3.5 mr-1" /> Zoom Clue
                          </div>
                        </div>
                      )}

                      {/* Contestant's Submission (Answer or Photo) */}
                      {sub.task_type === 'question' || sub.text_answer ? (
                        <div className="w-full sm:w-56 p-4 rounded-2xl border-2 border-black bg-[#0B0B0E] flex-shrink-0 flex flex-col justify-between shadow-neo-black-sm self-stretch sm:self-auto min-h-[120px]">
                          <div>
                            <div className="flex items-center gap-1.5 text-[#FFDC47] text-[10px] font-black uppercase tracking-wider mb-2">
                              <HelpCircle className="w-3.5 h-3.5" /> Contestant's Answer
                            </div>
                            <p className="text-xs font-bold text-white whitespace-pre-wrap leading-relaxed line-clamp-6">
                              &quot;{sub.text_answer || 'No answer recorded'}&quot;
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold mt-2">Text Response Challenge</span>
                        </div>
                      ) : (
                        <div 
                          onClick={() => sub.image_path && setFullscreenImage(sub.image_path)}
                          className="w-full sm:w-44 h-40 sm:h-auto aspect-video sm:aspect-[4/3] rounded-2xl overflow-hidden border-2 border-black bg-black flex-shrink-0 cursor-pointer relative group/img shadow-neo-black-sm self-start"
                        >
                          <img 
                            src={sub.image_path || ''} 
                            alt="Scavenger upload" 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                          />
                          <span className="absolute top-1.5 left-1.5 bg-[#FFDC47] text-black text-[9px] font-black px-2 py-0.5 rounded-full border border-black shadow-neo-black-sm">
                            Submission
                          </span>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-xs font-black gap-1 text-[#FFDC47]">
                            <Eye className="w-4 h-4" /> Fullscreen
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Meta & Details */}
                    <div className="flex-1 flex flex-col justify-between min-w-0 gap-3">
                      <div className="space-y-2">
                        {/* Player name and details */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleInspectUserById(sub.player_id)}
                            className="text-base font-black text-white hover:text-[#FFDC47] flex items-center gap-1 cursor-pointer truncate max-w-full"
                          >
                            <span>{sub.player_nickname || sub.player_name}</span>
                            <ChevronRight className="w-4 h-4 text-[#FFDC47] flex-shrink-0" />
                          </button>
                          {sub.player_department ? (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#20202C] border border-[#2E2E3E] font-bold text-slate-300">
                              {sub.player_department}
                            </span>
                          ) : null}
                          {sub.rejection_count > 0 ? (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#DF0586] text-white border border-black font-black shadow-neo-black-sm">
                              ⚡ Retry Attempt (Final)
                            </span>
                          ) : null}
                          {sub.uploaded_at && (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#0B0B0E] border border-[#FFDC47]/40 text-[#FFDC47] font-bold flex items-center gap-1 shadow-neo-black-sm">
                              <Clock className="w-3 h-3 text-[#FFDC47]" />
                              <span>Submitted: {formatDateTime(sub.uploaded_at)}</span>
                            </span>
                          )}
                        </div>

                        {/* Task Title & Description */}
                        <div>
                          <h4 className="text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-black font-black bg-[#FFDC47] px-2.5 py-0.5 rounded-full border border-black">
                              {sub.task_type === 'question' ? 'Question #' : 'Tile #'}{sub.tile_index + 1}
                            </span>
                            <span className="truncate">{sub.task_title}</span>
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{sub.task_description}</p>
                        </div>
                      </div>

                      {/* Rejection Reason Form */}
                      {isRejecting && (
                        <div className="p-3.5 rounded-2xl bg-[#0B0B0E] border-2 border-[#DF0586] space-y-2.5 animate-slide-down">
                          <label className="text-[10px] font-black text-[#DF0586] uppercase flex items-center gap-1 tracking-wider">
                            <MessageSquare className="w-3 h-3" /> Rejection Reason (Required)
                          </label>
                          <input
                            type="text"
                            placeholder={sub.task_type === 'question' ? 'e.g. Incorrect answer / Incomplete explanation...' : 'e.g. Blurry photo / Incorrect subject...'}
                            value={rejectionReasons[processKey] || ''}
                            onChange={(e) =>
                              setRejectionReasons({
                                ...rejectionReasons,
                                ...{ [processKey]: e.target.value }
                              })
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl bg-black border-2 border-[#2F2F3D] text-white placeholder-slate-500 focus:outline-none focus:border-[#DF0586] text-xs font-bold"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAction(sub.player_id, sub.tile_index, 'rejected')}
                              disabled={isProcessing}
                              className="px-4 py-2 rounded-full bg-[#DF0586] hover:bg-[#c20475] text-white font-extrabold text-xs shadow-neo-black-sm cursor-pointer disabled:opacity-50"
                            >
                              Confirm Rejection
                            </button>
                            <button
                              onClick={() => {
                                const newShow = { ...showRejectInput };
                                newShow[processKey] = false;
                                setShowRejectInput(newShow);
                              }}
                              className="px-4 py-2 rounded-full bg-[#20202A] text-slate-300 font-extrabold text-xs cursor-pointer hover:bg-[#2A2A38]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Card Action Buttons */}
                      {!isRejecting && (
                        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t-2 border-[#202028] mt-auto">
                          <button
                            onClick={() => handleAction(sub.player_id, sub.tile_index, 'approved')}
                            disabled={isProcessing}
                            className="px-5 py-2.5 rounded-full bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-neo-black-sm active:translate-y-0.5 transition-all disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                            ) : (
                              <Check className="w-4 h-4 text-black" />
                            )}
                            {sub.task_type === 'question' ? 'Approve Answer' : 'Approve Photo'}
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectInput({
                                ...showRejectInput,
                                ...{ [processKey]: true }
                              });
                            }}
                            disabled={isProcessing}
                            className="px-5 py-2.5 rounded-full bg-[#20202A] border-2 border-black hover:bg-[#DF0586] hover:text-white text-slate-300 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-neo-black-sm active:translate-y-0.5 transition-all disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                          <button
                            onClick={() => handleInspectUserById(sub.player_id)}
                            className="ml-auto text-xs text-[#FFDC47] hover:underline font-extrabold flex items-center gap-1 px-3 py-2 cursor-pointer"
                          >
                            <Grid className="w-3.5 h-3.5" /> Inspect Grid
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
              /* REJECTED SUBMISSIONS LIST */
              rejectedSubmissions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#2A2A38] rounded-[32px] p-12 text-center bg-[#141418]/40 my-auto">
                  <div className="w-14 h-14 rounded-2xl bg-[#DF0586]/20 border-2 border-[#DF0586] text-[#DF0586] flex items-center justify-center shadow-neo-black-sm mb-3">
                    <CheckCircle2 className="w-7 h-7 text-[#DF0586]" />
                  </div>
                  <h3 className="text-base font-black text-white">No Rejected Challenges</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    None of the participant submissions are currently rejected. Rejected items and moderator reasons will appear here.
                  </p>
                </div>
              ) : (
                rejectedSubmissions.map((rej) => {
                  const processKey = `${rej.player_id}_${rej.tile_index}`;
                  const isProcessing = processingId === processKey;

                  return (
                    <div
                      key={processKey}
                      className="bg-[#141418] border-2 border-[#DF0586]/60 hover:border-[#DF0586] rounded-[26px] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 shadow-neo-black relative transition-all"
                    >
                      {/* Media / Text Answer / Clue Container */}
                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                        {/* Reference clue image if available */}
                        {rej.clue_image && (
                          <div
                            onClick={() => setFullscreenImage(rej.clue_image || null)}
                            className="w-full sm:w-36 h-32 sm:h-auto aspect-video sm:aspect-square rounded-2xl overflow-hidden border-2 border-black bg-black flex-shrink-0 cursor-pointer relative group/clue shadow-neo-black-sm"
                            title="Click to zoom reference clue"
                          >
                            <img
                              src={rej.clue_image}
                              alt="Reference Clue"
                              className="w-full h-full object-cover group-hover/clue:scale-105 transition-transform"
                            />
                            <span className="absolute top-1.5 left-1.5 bg-[#DF0586] text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-black shadow-neo-black-sm flex items-center gap-1">
                              <ImageIcon className="w-2.5 h-2.5" /> Clue Photo
                            </span>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/clue:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black text-[#FFDC47]">
                              <Eye className="w-3.5 h-3.5 mr-1" /> Zoom Clue
                            </div>
                          </div>
                        )}

                        {/* Contestant's Submission (Answer or Photo) */}
                        {rej.task_type === 'question' || rej.text_answer ? (
                          <div className="w-full sm:w-56 p-4 rounded-2xl border-2 border-black bg-[#0B0B0E] flex-shrink-0 flex flex-col justify-between shadow-neo-black-sm self-stretch sm:self-auto min-h-[120px]">
                            <div>
                              <div className="flex items-center gap-1.5 text-[#DF0586] text-[10px] font-black uppercase tracking-wider mb-2">
                                <HelpCircle className="w-3.5 h-3.5" /> Rejected Answer
                              </div>
                              <p className="text-xs font-bold text-white whitespace-pre-wrap leading-relaxed line-clamp-6">
                                &quot;{rej.text_answer || 'No answer recorded'}&quot;
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold mt-2">Text Response Challenge</span>
                          </div>
                        ) : (
                          <div
                            onClick={() => rej.image_path && setFullscreenImage(rej.image_path)}
                            className="w-full sm:w-44 h-40 sm:h-auto aspect-video sm:aspect-[4/3] rounded-2xl overflow-hidden border-2 border-black bg-black flex-shrink-0 cursor-pointer relative group/img shadow-neo-black-sm self-start"
                          >
                            {rej.image_path ? (
                              <img
                                src={rej.image_path}
                                alt="Rejected photo"
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-slate-600 font-bold">
                                No Photo
                              </div>
                            )}
                            <span className="absolute top-1.5 left-1.5 bg-[#DF0586] text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-black shadow-neo-black-sm">
                              Rejected Photo
                            </span>
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-xs font-black gap-1 text-[#FFDC47]">
                              <Eye className="w-4 h-4" /> Fullscreen
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Meta & Details */}
                      <div className="flex-1 flex flex-col justify-between min-w-0 gap-3">
                        <div className="space-y-2.5">
                          {/* Player name and details */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleInspectUserById(rej.player_id)}
                              className="text-base font-black text-white hover:text-[#FFDC47] flex items-center gap-1 cursor-pointer truncate max-w-full"
                            >
                              <span>{rej.player_nickname || rej.player_name}</span>
                              <ChevronRight className="w-4 h-4 text-[#FFDC47] flex-shrink-0" />
                            </button>
                            {rej.player_department ? (
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#20202C] border border-[#2E2E3E] font-bold text-slate-300">
                                {rej.player_department}
                              </span>
                            ) : null}
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#DF0586] text-white border border-black font-black shadow-neo-black-sm">
                              {rej.rejection_count >= 2 ? '⛔ Permanently Rejected' : `⚡ Retry ${rej.rejection_count} of 2`}
                            </span>
                          </div>

                          {/* Task Title & Description */}
                          <div>
                            <h4 className="text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-white font-black bg-[#DF0586] px-2.5 py-0.5 rounded-full border border-black">
                                {rej.task_type === 'question' ? 'Question #' : 'Tile #'}{rej.tile_index + 1}
                              </span>
                              <span className="truncate">{rej.task_title}</span>
                            </h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rej.task_description}</p>
                          </div>

                          {/* REJECTION REASON CARD */}
                          <div className="p-3.5 rounded-2xl bg-[#DF0586]/10 border-2 border-[#DF0586] space-y-1.5 shadow-neo-black-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black text-[#DF0586] uppercase flex items-center gap-1 tracking-wider">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Rejection Reason:
                              </span>
                              {rej.uploaded_at && (
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-[#FFDC47]" />
                                  {formatDateTime(rej.uploaded_at)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-white italic leading-relaxed whitespace-pre-wrap">
                              &quot;{rej.rejection_reason || 'No specific reason entered.'}&quot;
                            </p>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t-2 border-[#202028] mt-auto">
                          <button
                            onClick={() => handleAction(rej.player_id, rej.tile_index, 'approved')}
                            disabled={isProcessing}
                            className="px-5 py-2.5 rounded-full bg-[#10B981] hover:bg-[#059669] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-neo-black active:translate-y-0.5 transition-all disabled:opacity-50"
                          >
                            <Check className="w-4 h-4 text-black" />
                            Overturn & Approve
                          </button>
                          <button
                            onClick={() => handleInspectUserById(rej.player_id)}
                            className="ml-auto text-xs text-[#FFDC47] hover:underline font-extrabold flex items-center gap-1 px-3 py-2 cursor-pointer"
                          >
                            <Grid className="w-3.5 h-3.5" /> Inspect Grid
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Users List & Leaderboard (Col span 5) */}
        <section className="lg:col-span-5 flex flex-col min-h-[500px]">
          {/* Top Mode Bar */}
          <div className="flex items-center justify-between mb-3 border-b-2 border-[#202028] pb-3">
            <div className="p-1 bg-[#141418] rounded-full border-2 border-black flex items-center gap-1 shadow-neo-black-sm">
              <button
                type="button"
                onClick={() => setLeaderboardTab('top10')}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  leaderboardTab === 'top10'
                    ? 'bg-[#FFDC47] text-black shadow-neo-black-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Top 10</span>
              </button>
              <button
                type="button"
                onClick={() => setLeaderboardTab('all')}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  leaderboardTab === 'all'
                    ? 'bg-[#DF0586] text-white shadow-neo-black-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>All Players ({leaderboard.length})</span>
              </button>
            </div>
          </div>

          {leaderboardTab === 'top10' ? (
            // TOP 10 CONTESTANTS VIEW
            <div className="bg-[#141418] border-2 border-black rounded-[28px] p-5 shadow-neo-yellow flex flex-col flex-1 max-h-[calc(100vh-230px)] overflow-hidden">
              <div className="pb-3 border-b-2 border-[#202028] mb-3 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#FFDC47] flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-[#FFDC47]" />
                  <span>Championship Standings</span>
                </h3>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-black text-[#FFDC47] border border-black shadow-neo-black-sm">
                  {Math.min(leaderboard.length, 10)} Contestants
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {leaderboard.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-bold">
                    No registered players yet.
                  </div>
                ) : (
                  leaderboard.slice(0, 10).map((p, index) => {
                    const isSelected = selectedPlayer?.id === p.id;
                    const is1st = index === 0;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleInspectUser(p)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#FFDC47] text-black border-black shadow-neo-black-sm'
                            : is1st
                            ? 'bg-[#181822] text-white border-[#FFDC47] shadow-neo-yellow-sm'
                            : 'bg-[#101014] text-slate-200 border-[#22222E] hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 border-2 border-black shadow-neo-black-sm ${
                            is1st ? 'bg-[#FFDC47] text-black' : 'bg-[#22222E] text-white'
                          }`}>
                            {is1st ? <Crown className="w-4 h-4 fill-black" /> : `#${index + 1}`}
                          </div>

                          <div className="min-w-0">
                            <h4 className={`text-sm font-black truncate ${isSelected ? 'text-black' : is1st ? 'text-[#FFDC47]' : 'text-white'}`}>
                              {p.nickname || p.name}
                            </h4>
                            {p.department && (
                              <p className={`text-[10px] font-bold truncate ${isSelected ? 'text-black/70' : 'text-slate-400'}`}>
                                {p.department}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                            isSelected ? 'bg-black text-[#FFDC47]' : 'bg-[#22222E] text-[#FFDC47]'
                          }`}>
                            {p.bingo_score} L
                          </span>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            isSelected ? 'bg-black/10 text-black' : 'bg-[#22222E] text-slate-400'
                          }`}>
                            {p.approved_count} T
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            // ALL PLAYERS SEARCH VIEW
            <div className="bg-[#141418] border-2 border-black rounded-[28px] p-5 shadow-neo-yellow flex flex-col flex-1 max-h-[calc(100vh-230px)] overflow-hidden">
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search contestant by name, email, dept..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-black border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-500 text-xs font-bold outline-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredLeaderboard.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-bold">
                    No players found.
                  </div>
                ) : (
                  filteredLeaderboard.map((p, index) => {
                    const isSelected = selectedPlayer?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleInspectUser(p)}
                        className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#FFDC47] text-black border-black shadow-neo-black-sm'
                            : 'bg-[#101014] text-slate-200 border-[#22222E] hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-black text-[#FFDC47] flex items-center justify-center text-[10px] font-black">
                            #{index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-black text-sm truncate">{p.nickname || p.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{p.email || p.department}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-black text-[#FFDC47] bg-[#22222E] px-2.5 py-1 rounded-full">
                            {p.bingo_score}L
                          </span>
                          <button
                            type="button"
                            title="Reset Player Password"
                            onClick={(e) => handleOpenResetPasswordModal(p, e)}
                            className="p-1.5 rounded-lg bg-[#181822] hover:bg-[#2A2A38] text-slate-300 hover:text-[#FFDC47] border border-[#2D2D3E] transition-all cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Release Email / Delete Account"
                            onClick={(e) => handleOpenDeleteAccountModal(p, e)}
                            className="p-1.5 rounded-lg bg-[#181822] hover:bg-[#EF4444] text-slate-300 hover:text-white border border-[#2D2D3E] transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>

      </main>

      {/* MODAL: PLAYER 5x5 BINGO GRID INSPECTOR */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[990] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#141418] border-2 border-black rounded-[32px] shadow-neo-yellow overflow-hidden flex flex-col max-h-[92vh] animate-slide-up relative">
            
            {/* Modal Top Bar */}
            <div className="p-5 pb-4 bg-[#FFDC47] text-black border-b-2 border-black flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-black text-[#FFDC47] px-3 py-1 rounded-full shadow-neo-black-sm inline-block">
                  Contestant Board Inspector
                </span>
                <h3 className="text-2xl font-black text-black mt-2 leading-tight">
                  {selectedPlayer.nickname || selectedPlayer.name}
                </h3>
                {selectedPlayer.email && (
                  <p className="text-xs text-black/80 font-bold mt-0.5">{selectedPlayer.email}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleInspectUserById(selectedPlayer.id)}
                  title="Sync / Refresh grid"
                  className="w-9 h-9 bg-black text-[#FFDC47] rounded-full flex items-center justify-center shadow-neo-black-sm cursor-pointer"
                >
                  <RotateCw className={`w-4 h-4 ${loadingGrid ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    setSelectedPlayer(null);
                    setInspectingCell(null);
                  }}
                  className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center shadow-neo-black-sm cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: 5x5 Grid */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingGrid ? (
                <div className="py-16 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#FFDC47] mb-2" />
                  <p className="text-xs text-slate-400 font-bold">Loading player grid...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-2 aspect-square max-w-md mx-auto w-full bg-[#0B0B0E] p-3 rounded-[24px] border-2 border-black shadow-inner">
                    {playerGrid.map((cell) => {
                      const isFreeSpace = cell.tile_index === 12;
                      const hasImage = !!cell.image_path;

                      return (
                        <div
                          key={cell.tile_index}
                          onClick={() => setInspectingCell(cell)}
                          className={`w-full aspect-square flex flex-col items-center justify-between p-1 rounded-xl cursor-pointer border-2 transition-all duration-200 select-none overflow-hidden relative group/tile ${getTileGridColor(
                            cell
                          )}`}
                        >
                          {hasImage && !isFreeSpace && (
                            <img
                              src={cell.image_path!}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover/tile:opacity-40 transition-opacity"
                            />
                          )}

                          {isFreeSpace ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-1 z-10">
                              <Star className="w-5 h-5 text-white fill-white animate-spin-slow" />
                              <span className="text-[8px] font-black uppercase text-white">FREE</span>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col justify-between z-10 p-0.5">
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[8px] font-black">
                                  #{cell.tile_index + 1}
                                </span>
                                {cell.status === 'approved' && (
                                  <Star className="w-3.5 h-3.5 text-black fill-black" />
                                )}
                                {cell.status === 'pending' && (
                                  <Clock className="w-3 h-3 text-[#FFDC47]" />
                                )}
                                {cell.status === 'rejected' && (
                                  <AlertCircle className="w-3 h-3 text-[#DF0586]" />
                                )}
                              </div>

                              <p className="text-[7px] md:text-[8px] font-black leading-tight line-clamp-2 text-center">
                                {cell.task_title}
                              </p>

                              <div className="text-center">
                                <span className="text-[6px] uppercase font-black">
                                  {cell.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-center text-xs text-slate-400 font-bold">
                    Click any tile to inspect photo or perform approval/rejection.
                  </p>

                  {/* Account Security & Reset Section */}
                  <div className="pt-3 border-t border-[#262638] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-left w-full sm:w-auto">
                      <p className="text-[11px] font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#FFDC47]" /> Account Actions
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Reset password or release email for fresh registration.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={(e) => handleOpenResetPasswordModal(selectedPlayer, e)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 bg-[#1C1C28] hover:bg-[#282838] text-white border border-[#3A3A4E] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-[#FFDC47]" />
                        <span>Reset Password</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleOpenDeleteAccountModal(selectedPlayer, e)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 bg-[#EF4444]/15 hover:bg-[#EF4444] text-[#EF4444] hover:text-white border border-[#EF4444]/40 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Release Email</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NESTED MODAL: INSPECT SPECIFIC TILE */}
      {inspectingCell && selectedPlayer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141418] border-2 border-black rounded-[28px] shadow-neo-yellow overflow-hidden animate-slide-up relative">
            <button
              onClick={() => setInspectingCell(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-5 pb-4 border-b-2 border-black bg-[#FFDC47] text-black">
              <span className="text-[10px] font-black uppercase tracking-wider bg-black text-[#FFDC47] px-2.5 py-0.5 rounded-full">
                Tile #{inspectingCell.tile_index + 1}
              </span>
              <h3 className="text-xl font-black text-black mt-1">
                {inspectingCell.tile_index === 12 ? 'FREE SPACE' : inspectingCell.task_title}
              </h3>
              <p className="text-xs text-black/80 font-bold mt-0.5">
                {inspectingCell.task_description}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Status & Timestamp Strip */}
              <div className="p-3.5 rounded-2xl bg-[#0B0B0E] border-2 border-black shadow-neo-black-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Status:</span>
                  <div>
                    {inspectingCell.status === 'not_started' && (
                      <span className="text-[10px] font-black uppercase text-slate-400 bg-[#20202A] px-2.5 py-1 rounded-full">
                        Not Started
                      </span>
                    )}
                    {inspectingCell.status === 'pending' && (
                      <span className="text-[10px] font-black text-black bg-[#FFDC47] px-2.5 py-1 rounded-full flex items-center gap-1 shadow-neo-black-sm">
                        <Clock className="w-3 h-3" /> Under Review
                      </span>
                    )}
                    {inspectingCell.status === 'approved' && (
                      <span className="text-[10px] font-black text-black bg-[#10B981] px-2.5 py-1 rounded-full flex items-center gap-1 shadow-neo-black-sm">
                        <Check className="w-3 h-3" /> Approved & Verified
                      </span>
                    )}
                    {inspectingCell.status === 'rejected' && (
                      <span className="text-[10px] font-black text-white bg-[#DF0586] px-2.5 py-1 rounded-full flex items-center gap-1 shadow-neo-black-sm">
                        <X className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </div>
                </div>

                {(inspectingCell.uploaded_at || inspectingCell.approved_at) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#20202C]">
                    {inspectingCell.uploaded_at && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-6 rounded-full bg-[#FFDC47]/10 border border-[#FFDC47]/30 flex items-center justify-center flex-shrink-0 text-[#FFDC47]">
                          <Clock className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Submitted Time</span>
                          <span className="text-xs font-bold text-white truncate block">{formatDateTime(inspectingCell.uploaded_at)}</span>
                        </div>
                      </div>
                    )}
                    {inspectingCell.approved_at && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-6 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center flex-shrink-0 text-[#10B981]">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Approved Time</span>
                          <span className="text-xs font-bold text-[#10B981] truncate block">{formatDateTime(inspectingCell.approved_at)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rejection Reason Alert (if tile is currently rejected) */}
              {inspectingCell.status === 'rejected' && (
                <div className="p-3.5 bg-[#DF0586]/10 border-2 border-[#DF0586] rounded-2xl text-white text-xs font-bold space-y-1.5 shadow-neo-black-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[#DF0586] font-black uppercase text-[10px] tracking-wider">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Rejection Reason:
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#DF0586] text-white font-black">
                      {inspectingCell.rejection_count >= 2 ? 'Permanently Rejected' : `Attempt ${inspectingCell.rejection_count} of 2`}
                    </span>
                  </div>
                  <p className="italic text-white text-xs leading-relaxed whitespace-pre-wrap">
                    &quot;{inspectingCell.rejection_reason || 'No specific reason entered.'}&quot;
                  </p>
                  <span className="text-[10px] text-slate-400 block pt-1 border-t border-[#DF0586]/20">
                    {inspectingCell.rejection_count >= 2
                      ? 'Maximum retry limit reached for this challenge.'
                      : 'Contestant can retry this challenge 1 more time.'}
                  </span>
                </div>
              )}

              {/* Reference Clue Photo (if task has one) */}
              {inspectingCell.clue_image && (
                <div className="bg-[#0B0B0E] border-2 border-black rounded-2xl p-3 shadow-neo-black-sm space-y-2">
                  <div className="flex items-center gap-1.5 text-[#DF0586] text-[10px] font-black uppercase tracking-wider">
                    <ImageIcon className="w-3.5 h-3.5" /> Reference Clue Photo:
                  </div>
                  <div 
                    onClick={() => setFullscreenImage(inspectingCell.clue_image || null)}
                    className="aspect-video w-full rounded-xl overflow-hidden border border-[#2E2E3E] bg-black cursor-pointer relative group"
                  >
                    <img 
                      src={inspectingCell.clue_image} 
                      alt="Reference Clue" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black text-[#FFDC47]">
                      <Eye className="w-3.5 h-3.5 mr-1" /> Tap to Zoom Clue
                    </div>
                  </div>
                </div>
              )}

              {/* Submission preview (Text answer or photo) */}
              {inspectingCell.task_type === 'question' || inspectingCell.text_answer ? (
                <div className="p-4 rounded-2xl bg-[#0B0B0E] border-2 border-black shadow-neo-black-sm">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FFDC47] flex items-center gap-1.5 mb-2">
                    <HelpCircle className="w-3.5 h-3.5" /> Contestant's Answer:
                  </span>
                  <p className="text-sm font-bold text-white whitespace-pre-wrap leading-relaxed">
                    {inspectingCell.text_answer || 'No answer recorded yet for this question.'}
                  </p>
                </div>
              ) : inspectingCell.image_path ? (
                <div 
                  onClick={() => inspectingCell.image_path && setFullscreenImage(inspectingCell.image_path)}
                  className="rounded-2xl overflow-hidden border-2 border-black bg-black aspect-video relative group/img cursor-pointer shadow-neo-black-sm"
                >
                  <img
                    src={inspectingCell.image_path}
                    alt="Tile upload"
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-xs font-black gap-1 text-[#FFDC47]">
                    <Eye className="w-4 h-4" /> Fullscreen
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-[#282836] rounded-2xl bg-[#0B0B0E]">
                  <p className="text-xs text-slate-500 font-bold">No submission yet for this tile.</p>
                </div>
              )}

              {/* Action Buttons */}
              {inspectingCell.tile_index !== 12 && (inspectingCell.image_path || inspectingCell.text_answer) && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => handleAction(selectedPlayer.id, inspectingCell.tile_index, 'approved')}
                    className="flex-1 py-3 rounded-full bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-neo-black-sm active:translate-y-0.5 transition-all"
                  >
                    <Check className="w-4 h-4" /> {inspectingCell.task_type === 'question' ? 'Approve Answer' : 'Approve Tile'}
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:');
                      if (reason && reason.trim()) {
                        setRejectionReasons({
                          ...rejectionReasons,
                          ...{ [`${selectedPlayer.id}_${inspectingCell.tile_index}`]: reason.trim() }
                        });
                        handleAction(selectedPlayer.id, inspectingCell.tile_index, 'rejected');
                      }
                    }}
                    className="flex-1 py-3 rounded-full bg-[#DF0586] hover:bg-[#c20475] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-neo-black-sm active:translate-y-0.5 transition-all"
                  >
                    <X className="w-4 h-4" /> Reject Tile
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {accountActionModal === 'reset_password' && targetAccountPlayer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141418] border-2 border-black rounded-[28px] shadow-neo-yellow overflow-hidden animate-slide-up relative">
            <div className="p-5 pb-4 bg-[#FFDC47] text-black border-b-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-black text-[#FFDC47] flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-xl font-black text-black">Reset Player Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setAccountActionModal(null)}
                className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#0B0B0E] p-3.5 rounded-2xl border border-[#272738]">
                <p className="text-xs font-bold text-slate-300">Player: <span className="text-white font-black">{targetAccountPlayer.nickname || targetAccountPlayer.name}</span></p>
                <p className="text-xs font-bold text-slate-400 mt-0.5">Email: <span className="text-[#FFDC47] font-bold">{targetAccountPlayer.email}</span></p>
                {targetAccountPlayer.department && (
                  <p className="text-[11px] text-slate-400 mt-0.5">Dept: <span className="text-slate-200">{targetAccountPlayer.department}</span></p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
                  New Temporary Password
                </label>
                <input
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter temporary password"
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0B0E] border-2 border-[#262638] focus:border-[#FFDC47] text-white font-mono text-sm outline-none"
                />
                <p className="text-[10px] text-slate-400">
                  Share this temporary password with the contestant so they can log in immediately.
                </p>
              </div>

              {accountActionFeedback && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  accountActionFeedback.type === 'success'
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                    : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                }`}>
                  {accountActionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{accountActionFeedback.message}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAccountActionModal(null)}
                  disabled={accountActionLoading}
                  className="flex-1 py-3 rounded-full bg-[#1C1C24] hover:bg-[#252530] text-slate-300 font-bold text-xs cursor-pointer transition-all border border-[#2D2D3E]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAccountAction}
                  disabled={accountActionLoading || !newPasswordInput.trim()}
                  className="flex-1 py-3 rounded-full bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-neo-black-sm cursor-pointer transition-all disabled:opacity-50"
                >
                  {accountActionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Set Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE / RELEASE ACCOUNT */}
      {accountActionModal === 'delete' && targetAccountPlayer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141418] border-2 border-black rounded-[28px] shadow-neo-yellow overflow-hidden animate-slide-up relative">
            <div className="p-5 pb-4 bg-[#EF4444] text-white border-b-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-black text-[#EF4444] flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-xl font-black text-white">Release / Delete Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setAccountActionModal(null)}
                className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#1C1215] border border-[#EF4444]/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-[#EF4444] text-xs font-black uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Permanent Account Release</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You are about to delete the registration for <strong className="text-white">{targetAccountPlayer.nickname || targetAccountPlayer.name}</strong> (<span className="text-[#FFDC47]">{targetAccountPlayer.email}</span>).
                </p>
                <p className="text-[11px] text-slate-400">
                  This will wipe this board's progress and <strong className="text-white">immediately release this email address</strong> so the rightful employee can sign up fresh.
                </p>
              </div>

              {accountActionFeedback && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  accountActionFeedback.type === 'success'
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                    : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                }`}>
                  {accountActionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{accountActionFeedback.message}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAccountActionModal(null)}
                  disabled={accountActionLoading}
                  className="flex-1 py-3 rounded-full bg-[#1C1C24] hover:bg-[#252530] text-slate-300 font-bold text-xs cursor-pointer transition-all border border-[#2D2D3E]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAccountAction}
                  disabled={accountActionLoading}
                  className="flex-1 py-3 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-neo-black-sm cursor-pointer transition-all disabled:opacity-50"
                >
                  {accountActionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Yes, Release Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
