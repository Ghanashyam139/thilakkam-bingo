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
  MapPin
} from 'lucide-react';
import type { Player, PendingSubmission, GridCell } from '@/lib/db';

export default function AdminPage() {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
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

  const selectedPlayerRef = useRef<Player | null>(null);
  useEffect(() => {
    selectedPlayerRef.current = selectedPlayer;
  }, [selectedPlayer]);

  // Fetch initial dashboard state
  useEffect(() => {
    async function initDashboard() {
      try {
        const res = await fetch('/api/admin/init');
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data.pendingSubmissions || []);
          setLeaderboard(data.leaderboard || []);
        } else {
          console.error('Failed to fetch dashboard data');
        }
      } catch (err) {
        console.error('Error fetching dashboard init:', err);
      } finally {
        setLoading(false);
      }
    }
    initDashboard();
  }, []);

  // Socket listener for real-time updates
  useEffect(() => {
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

      if (selectedPlayerRef.current && selectedPlayerRef.current.id === data.player_id) {
        setPlayerGrid((prev) =>
          prev.map((c) =>
            c.tile_index === data.tile_index
              ? { ...c, status: 'pending', image_path: data.image_path || null, uploaded_at: data.uploaded_at }
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

    socket.on('submission-handled', (data: { playerId: string; tileIndex: number; status: string }) => {
      setSubmissions((prev) =>
        prev.filter((s) => !(s.player_id === data.playerId && s.tile_index === data.tileIndex))
      );

      if (selectedPlayerRef.current && selectedPlayerRef.current.id === data.playerId) {
        setPlayerGrid((prev) =>
          prev.map((c) =>
            c.tile_index === data.tileIndex
              ? { ...c, status: data.status as any }
              : c
          )
        );
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new-submission');
      socket.off('leaderboard-update');
      socket.off('submission-handled');
      socket.disconnect();
    };
  }, []);

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

        if (selectedPlayer && selectedPlayer.id === playerId) {
          setPlayerGrid((prev) =>
            prev.map((c) =>
              c.tile_index === tileIndex
                ? { ...c, status, rejection_reason: status === 'rejected' ? rejectionReason : null }
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
              ? { ...prev, status, rejection_reason: status === 'rejected' ? rejectionReason : null }
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0A0A0C] text-white min-h-screen">
        <div className="w-16 h-16 rounded-2xl bg-[#FFDC47] text-black flex items-center justify-center shadow-neo-yellow animate-bounce">
          <Dices className="w-8 h-8 text-black" />
        </div>
        <p className="mt-6 text-sm font-extrabold tracking-widest text-[#FFDC47] uppercase">
          Booting Admin Console...
        </p>
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
          </div>
        </div>
      </header>

      {/* Main Split Screen */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT COLUMN: Approval Feed (Col span 7) */}
        <section className="lg:col-span-7 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-3 sm:mb-4 border-b-2 border-[#202028] pb-2.5 sm:pb-3 gap-2">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FFDC47] flex-shrink-0" />
              <span className="truncate">Pending Submissions</span>
            </h2>
            <span className="text-[10px] sm:text-xs px-2.5 py-1 rounded-full bg-[#FFDC47] text-black border border-black font-black shadow-neo-black-sm flex-shrink-0 whitespace-nowrap">
              {submissions.length} Awaiting Review
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-190px)] pr-1.5 pb-8">
            {submissions.length === 0 ? (
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

                        <span className="text-xs font-black text-[#FFDC47] bg-[#22222E] px-2.5 py-1 rounded-full">
                          {p.bingo_score} Lines
                        </span>
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
    </div>
  );
}
