'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { compressImage } from '@/lib/compression';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trophy, 
  Star, 
  X, 
  Loader2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogOut, 
  Sparkles, 
  ArrowRight,
  Smile,
  RefreshCw,
  Check,
  Flame,
  Zap,
  Info,
  Layers,
  ChevronRight,
  Award,
  HelpCircle,
  MessageSquare,
  Send,
  MapPin,
  Maximize2,
  Compass
} from 'lucide-react';
import type { Player, GridCell } from '@/lib/db';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function PlayerPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Nickname State
  const [nickname, setNickname] = useState('');
  const [nicknameSuggestions, setNicknameSuggestions] = useState<string[]>([]);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [loadingPresets, setLoadingPresets] = useState(false);
  const nicknameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active View Tab: 'grid' | 'rules' | 'quickLeaderboard'
  const [activeTab, setActiveTab] = useState<'grid' | 'rules' | 'leaderboard'>('grid');
  const [leaderboardMini, setLeaderboardMini] = useState<Player[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Bingo & Upload State
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fullscreenClue, setFullscreenClue] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load player from localStorage on mount
  useEffect(() => {
    async function loadPlayer() {
      if (typeof window !== 'undefined' && window.location.search.includes('logout=true')) {
        localStorage.removeItem('photo_bingo_player_id');
        setPlayer(null);
        setGrid([]);
        setLoading(false);
        if (window.history.replaceState) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        return;
      }

      const storedId = localStorage.getItem('photo_bingo_player_id');
      if (storedId) {
        try {
          const res = await fetch(`/api/player?id=${encodeURIComponent(storedId)}`);
          if (res.ok) {
            const data = await res.json();
            setPlayer(data.player);
            setGrid(data.grid);
          } else {
            localStorage.removeItem('photo_bingo_player_id');
          }
        } catch (err) {
          console.error('Error loading player session:', err);
          addToast('Network error loading session', 'error');
        }
      }
      setLoading(false);
    }
    loadPlayer();
  }, []);

  const fetchNicknameSuggestions = async () => {
    setLoadingPresets(true);
    try {
      const res = await fetch('/api/auth/nicknames');
      if (res.ok) {
        const data = await res.json();
        setNicknameSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to load nickname suggestions', err);
    } finally {
      setLoadingPresets(false);
    }
  };

  useEffect(() => {
    if (authMode === 'signup' && nicknameSuggestions.length === 0) {
      fetchNicknameSuggestions();
    }
  }, [authMode, nicknameSuggestions.length]);

  const checkNicknameAvailability = async (name: string) => {
    const clean = name.trim();
    if (!clean || clean.length < 2) {
      setNicknameStatus('idle');
      setCheckingNickname(false);
      return;
    }
    setCheckingNickname(true);
    try {
      const res = await fetch(`/api/auth/nicknames?check=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        setNicknameStatus(data.available ? 'available' : 'taken');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingNickname(false);
    }
  };

  const handleNicknameChange = (value: string) => {
    setNickname(value);
    if (!value.trim()) {
      setNicknameStatus('idle');
      setCheckingNickname(false);
      return;
    }
    setCheckingNickname(true);
    if (nicknameCheckTimeoutRef.current) {
      clearTimeout(nicknameCheckTimeoutRef.current);
    }
    nicknameCheckTimeoutRef.current = setTimeout(() => {
      checkNicknameAvailability(value);
    }, 250);
  };

  const handleSelectPreset = (preset: string) => {
    setNickname(preset);
    setNicknameStatus('available');
    if (nicknameCheckTimeoutRef.current) {
      clearTimeout(nicknameCheckTimeoutRef.current);
    }
  };

  // Fetch mini leaderboard for the in-app tab
  const fetchMiniLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboardMini(data.top10 || []);
      }
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leaderboard' && leaderboardMini.length === 0) {
      fetchMiniLeaderboard();
    }
  }, [activeTab, leaderboardMini.length]);

  // Socket connection effect
  useEffect(() => {
    if (!player) return;

    const socket = getSocket();
    if (!socket) return;

    socket.connect();
    socket.emit('join', `player-${player.id}`);

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('grid-update', (data: {
      tileIndex: number;
      status: 'pending' | 'approved' | 'rejected';
      imagePath?: string;
      textAnswer?: string | null;
      rejectionReason?: string;
      rejectionCount?: number;
      score: number;
      approvedCount: number;
    }) => {
      setGrid((prevGrid) =>
        prevGrid.map((cell) => {
          if (cell.tile_index === data.tileIndex) {
            return {
              ...cell,
              status: data.status,
              image_path: data.imagePath !== undefined ? data.imagePath : cell.image_path,
              text_answer: data.textAnswer !== undefined ? data.textAnswer : cell.text_answer,
              rejection_reason: data.rejectionReason !== undefined ? data.rejectionReason : cell.rejection_reason,
              rejection_count: data.rejectionCount !== undefined ? data.rejectionCount : (cell.rejection_count || 0)
            };
          }
          return cell;
        })
      );

      setSelectedCell((prev) => {
        if (prev && prev.tile_index === data.tileIndex) {
          return {
            ...prev,
            status: data.status,
            image_path: data.imagePath !== undefined ? data.imagePath : prev.image_path,
            text_answer: data.textAnswer !== undefined ? data.textAnswer : prev.text_answer,
            rejection_reason: data.rejectionReason !== undefined ? data.rejectionReason : prev.rejection_reason,
            rejection_count: data.rejectionCount !== undefined ? data.rejectionCount : (prev.rejection_count || 0)
          };
        }
        return prev;
      });

      setPlayer((prevPlayer) => {
        if (!prevPlayer) return null;
        return {
          ...prevPlayer,
          bingo_score: data.score,
          approved_count: data.approvedCount
        };
      });

      if (data.status === 'approved') {
        addToast(`★ Challenge ${data.tileIndex + 1} approved! Star awarded! Score: ${data.score}`, 'success');
      } else if (data.status === 'rejected') {
        const canRetry = (data.rejectionCount || 1) < 2;
        if (canRetry) {
          addToast(`⚠️ Task ${data.tileIndex + 1} rejected: ${data.rejectionReason || 'Please review guidelines'}. 1 retry left!`, 'error');
        } else {
          addToast(`🚫 Task ${data.tileIndex + 1} rejected: ${data.rejectionReason || 'No retries left'}. Maximum attempts used.`, 'error');
        }
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('grid-update');
      socket.disconnect();
    };
  }, [player]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      addToast('Please enter both your email and password', 'error');
      return;
    }
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const data = await res.json();
      if (res.ok && data.player) {
        localStorage.setItem('photo_bingo_player_id', data.player.id);
        setPlayer(data.player);
        setGrid(data.grid || []);
        addToast(`Welcome back, ${data.player.nickname || data.player.name}! ✦`, 'success');
        setPassword('');
      } else {
        addToast(data.error || 'Login failed. Check your credentials.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Network error during login', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      addToast('Please enter both your email and password', 'error');
      return;
    }
    if (!nickname.trim()) {
      addToast('Please choose a creative nickname', 'error');
      return;
    }
    if (nicknameStatus === 'taken') {
      addToast('This nickname is taken! Choose another one.', 'error');
      return;
    }
    if (password.length < 4) {
      addToast('Password must be at least 4 characters', 'error');
      return;
    }
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          nickname: nickname.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.player) {
        localStorage.setItem('photo_bingo_player_id', data.player.id);
        setPlayer(data.player);
        setGrid(data.grid || []);
        addToast(`Welcome to the Quest, ${data.player.nickname || data.player.name}! ⚡`, 'success');
        setPassword('');
        setNickname('');
      } else {
        addToast(data.error || 'Registration failed', 'error');
        if (data.error && data.error.toLowerCase().includes('nickname')) {
          setNicknameStatus('taken');
          fetchNicknameSuggestions();
        }
      }
    } catch (err) {
      console.error(err);
      addToast('Network error during registration', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('photo_bingo_player_id');
    setPlayer(null);
    setGrid([]);
    setSelectedCell(null);
    addToast('Logged out successfully', 'info');
  };

  const handleCellClick = (cell: GridCell) => {
    setSelectedCell(cell);
    setImageFile(null);
    setImagePreview(null);
    setTextAnswer(cell.text_answer || '');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!selectedCell || !player) return;
    const isQuestion = selectedCell.task_type === 'question';

    if (isQuestion) {
      if (!textAnswer.trim()) {
        addToast('Please enter an answer before submitting.', 'error');
        return;
      }
    } else {
      if (!imageFile) {
        addToast('Please select or capture a photo first.', 'error');
        return;
      }
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('playerId', player.id);
      formData.append('tileIndex', selectedCell.tile_index.toString());

      if (isQuestion) {
        formData.append('textAnswer', textAnswer.trim());
      } else if (imageFile) {
        const compressedBlob = await compressImage(imageFile, 1200, 1200, 0.75);
        const uploadFile = new File([compressedBlob], imageFile.name, {
          type: 'image/jpeg'
        });
        formData.append('image', uploadFile);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const prevStatus = selectedCell.status;
        const newImagePath = data.imagePath || selectedCell.image_path;
        const newTextAnswer = data.textAnswer !== undefined ? data.textAnswer : (isQuestion ? textAnswer.trim() : selectedCell.text_answer);

        setGrid((prevGrid) =>
          prevGrid.map((c) => {
            if (c.tile_index === selectedCell.tile_index) {
              return {
                ...c,
                status: 'pending',
                image_path: newImagePath,
                text_answer: newTextAnswer,
                rejection_reason: null
              };
            }
            return c;
          })
        );

        setSelectedCell((prev) => {
          if (prev && prev.tile_index === selectedCell.tile_index) {
            return {
              ...prev,
              status: 'pending',
              image_path: newImagePath,
              text_answer: newTextAnswer,
              rejection_reason: null
            };
          }
          return null;
        });

        setImageFile(null);
        setImagePreview(null);

        if (isQuestion) {
          if (prevStatus === 'pending') {
            addToast('Answer updated! Re-submitted for review. 🔄', 'info');
          } else if (prevStatus === 'rejected') {
            addToast('Retry answer submitted! Awaiting review (Final attempt). 🎯', 'info');
          } else {
            addToast('Answer submitted! Waiting for moderator approval. ⚡', 'info');
          }
        } else {
          if (prevStatus === 'pending') {
            addToast('Photo updated! Re-submitted for review. 🔄', 'info');
          } else if (prevStatus === 'rejected') {
            addToast('Retry photo uploaded! Awaiting review (Final attempt). 🎯', 'info');
          } else {
            addToast('Photo submitted! Waiting for moderator approval. ⚡', 'info');
          }
        }
      } else {
        const errData = await res.json();
        addToast(errData.error || 'Submission failed', 'error');
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Error submitting challenge', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0A0A0C] text-white min-h-screen">
        <div className="w-16 h-16 rounded-2xl bg-[#FFDC47] text-black font-black flex items-center justify-center text-3xl shadow-neo-yellow animate-bounce">
          ⚄
        </div>
        <p className="mt-6 text-sm font-extrabold tracking-widest text-[#FFDC47] uppercase">
          Loading Thilakkam Quest...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0C] text-white relative min-h-screen selection:bg-[#FFDC47] selection:text-black">
      
      {/* Toast Manager */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-2xl flex items-center gap-3 border-2 pointer-events-auto backdrop-blur-xl transition-all duration-300 shadow-neo-black ${
              toast.type === 'success'
                ? 'bg-[#FFDC47] text-[#0A0A0C] border-black font-bold'
                : toast.type === 'error'
                ? 'bg-[#DF0586] text-white border-black font-bold'
                : 'bg-[#18181F] text-[#FFDC47] border-[#2A2A38] font-bold'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-black" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0 text-white" />}
            {toast.type === 'info' && <Clock className="w-5 h-5 flex-shrink-0 text-[#FFDC47]" />}
            <span className="text-xs leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* EVOLVE TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-[#0A0A0C]/90 backdrop-blur-md border-b border-[#202028]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo in Evolve typography & styling */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[#FFDC47] text-black flex items-center justify-center font-black text-xl shadow-neo-black-sm group-hover:rotate-6 transition-transform">
              ⚄
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-white">thilakkam</span>
              <span className="font-extrabold text-xl tracking-tight text-[#FFDC47]">quest</span>
            </div>
          </Link>

          {/* Right Header Navigation Items */}
          <div className="flex items-center gap-3">
            {/* Live Indicator Pill */}
            <div className="flex items-center gap-2 bg-[#141418] border border-[#272732] px-3 py-1.5 rounded-full shadow-sm">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-[#EF4444]'}`} />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                {socketConnected ? 'Live Quest' : 'Connecting'}
              </span>
            </div>


            {player ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#DF0586] px-3 py-1.5 rounded-full bg-[#141418] hover:bg-[#1E1E26] border border-[#272732] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* CONTINUOUS MARQUEE TICKER (Signature Evolve vibrant strip) */}
      <div className="bg-[#7A3EE8] text-[#FFDC47] py-2 overflow-hidden border-y-2 border-black select-none font-extrabold text-xs tracking-wider uppercase">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-8">
          <span>✦ THILAKKAM QUEST ✦</span>
          <span>⚡ CAPTURE THE MOMENTS</span>
          <span>★ 5-IN-A-ROW FOR BINGO</span>
          <span>⚡ COMPETE ON LIVE LEADERBOARD</span>
          <span>✦ THILAKKAM ANNUAL DAY 2026</span>
          <span>★ SNAP • UPLOAD • CONQUER</span>
          <span>✦ THILAKKAM QUEST ✦</span>
          <span>⚡ CAPTURE THE MOMENTS</span>
          <span>★ 5-IN-A-ROW FOR BINGO</span>
          <span>⚡ COMPETE ON LIVE LEADERBOARD</span>
          <span>✦ THILAKKAM ANNUAL DAY 2026</span>
          <span>★ SNAP • UPLOAD • CONQUER</span>
        </div>
      </div>

      {/* MAIN VIEW AREA */}
      {!player ? (
        // WELCOME / AUTHENTICATION SCREEN (Evolve Inspired Hero & Sign in)
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
          
          {/* Subtle Sunburst Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full evolve-sunburst-subtle pointer-events-none" />

          {/* Hero Intro Heading */}
          <div className="text-center max-w-2xl mx-auto mb-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFDC47] text-black font-extrabold text-xs tracking-wider uppercase mb-4 shadow-neo-black-sm">
              <Sparkles className="w-4 h-4 text-black" />
              Thilakkam Annual Day Challenge
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
              Ready to Be <span className="text-[#FFDC47]">Remarkable?</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base font-medium mt-3.5 max-w-lg mx-auto leading-relaxed">
              Snap hilarious moments, complete Thilakkam challenges, achieve 5-in-a-row Bingo lines, and climb the live podium.
            </p>
          </div>

          {/* Auth Card with Evolve Neo-Brutalist Frame */}
          <div className="w-full max-w-md bg-[#141418] border-2 border-black rounded-[28px] p-6 sm:p-8 shadow-neo-yellow relative z-10">
            
            {/* Pill Mode Switcher (Evolve segmented pill buttons) */}
            <div className="grid grid-cols-2 p-1.5 bg-[#0B0B0E] rounded-full border border-[#272732] mb-6">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`py-2.5 text-xs font-extrabold rounded-full transition-all duration-150 cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-[#FFDC47] text-black shadow-neo-black-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`py-2.5 text-xs font-extrabold rounded-full transition-all duration-150 cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-[#DF0586] text-white shadow-neo-black-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {authMode === 'login' ? (
              // LOGIN FORM
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#FFDC47]" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl bg-[#0B0B0E] border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-500 outline-none font-medium text-sm transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#DF0586]" /> Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3.5 pr-11 rounded-2xl bg-[#0B0B0E] border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-500 outline-none font-medium text-sm transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Evolve Solid Pill Button with Arrow */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full mt-4 bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold py-4 px-6 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Quest</span>
                      <ArrowRight className="w-4 h-4 text-black" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              // SIGN UP FORM
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Nickname Input & Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Smile className="w-3.5 h-3.5 text-[#FFDC47]" /> Player Nickname
                    </label>
                    {nicknameStatus === 'available' && (
                      <span className="text-[10px] font-extrabold text-black bg-[#FFDC47] px-2 py-0.5 rounded-full border border-black flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ready
                      </span>
                    )}
                    {nicknameStatus === 'taken' && (
                      <span className="text-[10px] font-extrabold text-white bg-[#DF0586] px-2 py-0.5 rounded-full border border-black flex items-center gap-1">
                        <X className="w-3 h-3" /> Taken
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={35}
                      placeholder="e.g. Turbo Tourist, Pixel Master..."
                      value={nickname}
                      onChange={(e) => handleNicknameChange(e.target.value)}
                      className={`w-full px-4 py-3.5 pr-11 rounded-2xl bg-[#0B0B0E] border-2 text-white placeholder-slate-500 outline-none font-medium text-sm transition-all shadow-inner ${
                        nicknameStatus === 'available'
                          ? 'border-[#10B981]'
                          : nicknameStatus === 'taken'
                          ? 'border-[#DF0586]'
                          : 'border-[#2A2A38] focus:border-[#FFDC47]'
                      }`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                      {checkingNickname ? (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                      ) : nicknameStatus === 'available' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      ) : nicknameStatus === 'taken' ? (
                        <AlertCircle className="w-4 h-4 text-[#DF0586]" />
                      ) : null}
                    </div>
                  </div>

                  {/* Fun Preset Nicknames Pill Carousel */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#FFDC47]" /> Tap to pick:
                      </span>
                      <button
                        type="button"
                        onClick={fetchNicknameSuggestions}
                        disabled={loadingPresets}
                        className="text-[10px] font-bold text-[#FFDC47] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${loadingPresets ? 'animate-spin' : ''}`} />
                        <span>Shuffle</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {nicknameSuggestions.map((name) => {
                        const isSelected = nickname.toLowerCase() === name.toLowerCase();
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handleSelectPreset(name)}
                            className={`text-xs font-bold px-3 py-1 rounded-full transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-[#FFDC47] text-black border-black shadow-neo-black-sm scale-105'
                                : 'bg-[#181820] hover:bg-[#20202C] text-slate-300 border-[#2A2A38]'
                            }`}
                          >
                            {isSelected ? '★ ' : ''}{name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#FFDC47]" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl bg-[#0B0B0E] border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-500 outline-none font-medium text-sm transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#DF0586]" /> Password (Min 4 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      placeholder="Create password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3.5 pr-11 rounded-2xl bg-[#0B0B0E] border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-500 outline-none font-medium text-sm transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full mt-4 bg-[#DF0586] hover:bg-[#c20475] text-white font-extrabold py-4 px-6 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Quest & Start Board</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        // ACTIVE GAME EXPERIENCE (Dashboard & 5x5 Bingo Grid)
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 z-10 pb-16">
          
          {/* PLAYER STATUS HERO BANNER (Evolve Signature Card) */}
          <div className="bg-[#141418] border-2 border-black rounded-[26px] p-5 sm:p-6 mb-5 shadow-neo-yellow relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-[#FFDC47] text-black px-2.5 py-0.5 rounded-full border border-black shadow-neo-black-sm">
                    Contestant
                  </span>
                  {player.department ? (
                    <span className="text-[11px] font-bold text-slate-300 bg-[#22222E] px-2.5 py-0.5 rounded-full border border-[#333344]">
                      {player.department}
                    </span>
                  ) : null}
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>{player.nickname || player.name}</span>
                  <span className="text-xl">⚡</span>
                </h1>
                {player.email && (
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{player.email}</p>
                )}
              </div>

              {/* Score Badges in Punchy High-Contrast Boxes */}
              <div className="flex items-center gap-3">
                <div className="bg-[#0B0B0E] border-2 border-black rounded-2xl px-4 py-2.5 text-center shadow-neo-black-sm min-w-[90px]">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#FFDC47] block">Bingo Lines</span>
                  <span className="text-2xl font-black text-white flex items-center justify-center gap-1 mt-0.5">
                    <Trophy className="w-5 h-5 text-[#FFDC47]" />
                    {player.bingo_score}
                  </span>
                </div>
                <div className="bg-[#0B0B0E] border-2 border-black rounded-2xl px-4 py-2.5 text-center shadow-neo-black-sm min-w-[90px]">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#10B981] block">Approved</span>
                  <span className="text-2xl font-black text-white flex items-center justify-center gap-1 mt-0.5">
                    <Star className="w-5 h-5 text-[#FFDC47] fill-[#FFDC47]" />
                    {player.approved_count}<span className="text-slate-500 text-xs font-bold">/24</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TAB BAR (Evolve Segmented Control: Board, Quick Leaderboard, Rules) */}
          <div className="flex items-center justify-center p-1 bg-[#141418] border-2 border-black rounded-full mb-6 shadow-neo-black-sm">
            <button
              onClick={() => setActiveTab('grid')}
              className={`flex-1 py-2.5 px-3 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'grid'
                  ? 'bg-[#FFDC47] text-black shadow-neo-black-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚄ Bingo Board</span>
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 py-2.5 px-3 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'leaderboard'
                  ? 'bg-[#DF0586] text-white shadow-neo-black-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Standings</span>
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex-1 py-2.5 px-3 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'rules'
                  ? 'bg-[#7A3EE8] text-white shadow-neo-black-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Rules</span>
            </button>
          </div>

          {/* TAB 1: 5x5 BINGO GRID */}
          {activeTab === 'grid' && (
            <div className="flex-1 flex flex-col items-center">
              {/* The 5x5 Grid Container */}
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full aspect-square bg-[#141418] p-3 sm:p-4 rounded-[30px] border-2 border-black shadow-neo-yellow relative">
                {grid.map((cell) => {
                  const isFreeSpace = cell.tile_index === 12;
                  const isApproved = cell.status === 'approved';
                  const isPending = cell.status === 'pending';
                  const isRejected = cell.status === 'rejected';

                  return (
                    <div
                      key={cell.tile_index}
                      onClick={() => handleCellClick(cell)}
                      className={`w-full aspect-square flex flex-col items-center justify-center p-1 sm:p-2 text-center rounded-2xl cursor-pointer select-none overflow-hidden relative evolve-pressable transition-all duration-200 ${
                        isFreeSpace
                          ? 'bg-[#DF0586] text-white border-2 border-black shadow-neo-black-sm font-black'
                          : isApproved
                          ? 'bg-[#FFDC47] text-black border-2 border-black shadow-neo-black-sm'
                          : isPending
                          ? 'bg-[#2E2405] text-[#FFDC47] border-2 border-[#FFDC47] animate-pulse'
                          : isRejected
                          ? 'bg-[#2E0B1B] text-[#FF6699] border-2 border-[#DF0586]'
                          : 'bg-[#1C1C24] hover:bg-[#252532] text-slate-200 border-2 border-[#2E2E3E] hover:border-[#FFDC47]'
                      }`}
                    >
                      {/* FREE SPACE CELL */}
                      {isFreeSpace ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
                          <Star className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white animate-spin-slow" />
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider leading-none">
                            FREE
                          </span>
                        </div>
                      ) : isApproved ? (
                        // APPROVED CELL (Evolve Sunny Yellow with star badge)
                        <div className="flex-1 flex flex-col items-center justify-center relative w-full h-full">
                          <span className="absolute top-0.5 left-1 text-[9px] font-black text-black/60">
                            #{cell.tile_index + 1}
                          </span>
                          <div className="flex flex-col items-center justify-center">
                            <Star className="w-6 h-6 sm:w-7 sm:h-7 text-black fill-black" />
                            <span className="text-[8px] sm:text-[9px] font-black uppercase text-black tracking-wider mt-0.5">
                              STAR
                            </span>
                          </div>
                        </div>
                      ) : (
                        // OTHER CELL STATES (Number prominently centered)
                        <div className="flex-1 flex flex-col items-center justify-center relative w-full h-full">
                          <span className="text-xl sm:text-2xl font-black transition-all">
                            {cell.tile_index + 1}
                          </span>

                          

                          {/* Mini status indicator */}
                          <div className="absolute bottom-0.5 right-1">
                            {isPending && <Clock className="w-3.5 h-3.5 text-[#FFDC47]" />}
                            {isRejected && <AlertCircle className="w-3.5 h-3.5 text-[#DF0586]" />}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Helper legend */}
              <div className="w-full flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 text-[11px] font-extrabold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#FFDC47] border border-black shadow-neo-black-sm" />
                  Approved (Star)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#2E2405] border border-[#FFDC47]" />
                  Under Review
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#2E0B1B] border border-[#DF0586]" />
                  Rejected (Retry)
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: IN-APP STANDINGS / MINI LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="bg-[#141418] border-2 border-black rounded-[28px] p-5 sm:p-6 shadow-neo-yellow">
              <div className="flex items-center justify-between pb-4 border-b border-[#262633] mb-4">
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#FFDC47]" />
                    <span>Top Contestants</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Ranked by completed Bingo lines & verified tasks</p>
                </div>
              </div>

              {loadingLeaderboard ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FFDC47]" />
                  <span className="text-xs text-slate-400 font-bold mt-2">Loading standings...</span>
                </div>
              ) : leaderboardMini.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-medium">
                  No scores posted yet! Complete your first challenge to claim 1st place!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {leaderboardMini.map((p, idx) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                        idx === 0
                          ? 'bg-[#FFDC47] text-black border-black shadow-neo-black-sm'
                          : idx === 1
                          ? 'bg-[#1C1C24] text-white border-slate-400 shadow-neo-black-sm'
                          : idx === 2
                          ? 'bg-[#1C1C24] text-white border-[#DF0586] shadow-neo-black-sm'
                          : 'bg-[#101014] text-slate-200 border-[#22222E]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                          idx === 0 ? 'bg-black text-[#FFDC47]' : 'bg-[#22222E] text-white'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div>
                          <p className={`font-black text-sm ${idx === 0 ? 'text-black' : 'text-white'}`}>
                            {p.nickname || p.name}
                          </p>
                          {p.department && (
                            <p className={`text-[10px] font-bold ${idx === 0 ? 'text-black/70' : 'text-slate-400'}`}>
                              {p.department}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                          idx === 0 ? 'bg-black text-[#FFDC47]' : 'bg-[#22222E] text-[#FFDC47]'
                        }`}>
                          {p.bingo_score} Lines
                        </span>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                          idx === 0 ? 'bg-black/10 text-black' : 'bg-[#22222E] text-slate-400'
                        }`}>
                          {p.approved_count} Tasks
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RULES & QUEST GUIDE */}
          {activeTab === 'rules' && (
            <div className="bg-[#141418] border-2 border-black rounded-[28px] p-5 sm:p-7 shadow-neo-yellow space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#252532]">
                <div className="w-10 h-10 rounded-2xl bg-[#7A3EE8] text-white flex items-center justify-center font-black text-lg shadow-neo-black-sm">
                  📜
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">How to Win Thilakkam Quest</h3>
                  <p className="text-xs text-slate-400">Rules & guidelines for Thilakkam Annual Day</p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-medium text-slate-300">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#0B0B0E] border border-[#272732]">
                  <span className="w-6 h-6 rounded-full bg-[#FFDC47] text-black font-black flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="font-extrabold text-white text-sm mb-0.5">Explore & Complete Challenges</h4>
                    <p className="text-slate-400">Tap on any numbered square on your 5×5 board to reveal its secret challenge. Depending on the challenge, snap a live photo or type your answer to prove you finished it!</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#0B0B0E] border border-[#272732]">
                  <span className="w-6 h-6 rounded-full bg-[#DF0586] text-white font-black flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="font-extrabold text-white text-sm mb-0.5">Real-Time Moderator Review</h4>
                    <p className="text-slate-400">Our event moderators review photos and text answers live. Once approved, you earn a gold star on that tile.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#0B0B0E] border border-[#272732]">
                  <span className="w-6 h-6 rounded-full bg-[#7A3EE8] text-white font-black flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="font-extrabold text-white text-sm mb-0.5">Score Bingo Lines</h4>
                    <p className="text-slate-400">Every 5 completed tiles in a horizontal line, vertical line, or diagonal gives you 1 Bingo Point. The center #13 is a FREE tile for everyone!</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#0B0B0E] border border-[#272732]">
                  <span className="w-6 h-6 rounded-full bg-[#10B981] text-black font-black flex items-center justify-center flex-shrink-0">
                    4
                  </span>
                  <div>
                    <h4 className="font-extrabold text-white text-sm mb-0.5">Retries Policy</h4>
                    <p className="text-slate-400">If a photo or answer is rejected by the moderator, you receive 1 retry attempt to submit a clearer photo or revised answer. Make it count!</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TASK DETAIL & SUBMISSION MODAL (Evolve Style Bottom Sheet / Modal) */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-[#141418] border-2 border-black rounded-t-[32px] sm:rounded-[32px] shadow-neo-yellow overflow-hidden animate-slide-up relative max-h-[92vh] flex flex-col">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedCell(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer z-20"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Top Banner (Evolve Yellow Header) */}
            <div className="p-6 pb-5 bg-[#FFDC47] text-black border-b-2 border-black relative">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-black text-[#FFDC47] px-3 py-1 rounded-full shadow-neo-black-sm inline-flex items-center gap-1.5">
                  {selectedCell.tile_index === 12 ? (
                    '★ FREE SPACE'
                  ) : selectedCell.task_type === 'question' ? (
                    <>
                      <HelpCircle className="w-3 h-3 text-[#FFDC47]" />
                      <span>QUESTION #{selectedCell.tile_index + 1}</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3 h-3 text-[#FFDC47]" />
                      <span>PHOTO TASK #{selectedCell.tile_index + 1}</span>
                    </>
                  )}
                </span>
              </div>
              <h3 className="text-2xl font-black text-black mt-2 leading-tight">
                {selectedCell.tile_index === 12 ? 'Free Bingo Space' : selectedCell.task_title}
              </h3>
              <p className="text-xs text-black/80 font-bold mt-1 max-w-md">
                {selectedCell.tile_index === 12
                  ? 'Automatically unlocked & approved for every single player!'
                  : selectedCell.task_description}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {selectedCell.tile_index === 12 ? (
                // Free Space Screen
                <div className="py-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-[#DF0586] text-white flex items-center justify-center shadow-neo-black mb-3">
                    <Star className="w-8 h-8 fill-white" />
                  </div>
                  <h4 className="text-lg font-black text-white">Always Free & Active</h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    This square is yours by default to help form horizontal, vertical, and diagonal Bingos!
                  </p>
                </div>
              ) : (
                <>
                  {/* Status Strip */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0B0B0E] border-2 border-[#252532]">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Status</span>
                    <div>
                      {selectedCell.status === 'not_started' && (
                        <span className="text-xs font-black text-slate-300 uppercase bg-[#20202A] px-2.5 py-1 rounded-full">
                          Not Started
                        </span>
                      )}
                      {selectedCell.status === 'pending' && (
                        <span className="text-xs font-black text-black bg-[#FFDC47] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-neo-black-sm">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Under Review</span>
                        </span>
                      )}
                      {selectedCell.status === 'approved' && (
                        <span className="text-xs font-black text-black bg-[#10B981] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-neo-black-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approved & Verified</span>
                        </span>
                      )}
                      {selectedCell.status === 'rejected' && (
                        <span className="text-xs font-black text-white bg-[#DF0586] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-neo-black-sm">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{selectedCell.rejection_count >= 2 ? 'Permanently Rejected' : 'Rejected (1 Retry Left)'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* LOCATION CLUE PHOTO CARD (Show when task has a clue image) */}
                  {selectedCell.clue_image && (
                    <div className="bg-[#0B0B0E] border-2 border-black rounded-[24px] p-4 shadow-neo-yellow relative overflow-hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 rounded-full h-2 bg-[#FFDC47]" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#FFDC47]">
                            Reference Clue Photo
                          </span>
                        </div>
                      </div>

                      {/* Clue Photo Preview with Tap to Zoom */}
                      <div 
                        onClick={() => setFullscreenClue(selectedCell.clue_image || null)}
                        className="aspect-video w-full rounded-2xl overflow-hidden border-2 border-black bg-black relative group cursor-pointer shadow-neo-black-sm"
                      >
                        <img 
                          src={selectedCell.clue_image} 
                          alt="Mystery Location Clue" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs font-black text-[#FFDC47] backdrop-blur-[2px]">
                          <Maximize2 className="w-4 h-4" /> Tap to Zoom Clue Photo
                        </div>
                        <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-extrabold px-2.5 py-1 rounded-full border border-white/20">
                          🔍 Tap to Zoom
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                        {selectedCell.task_type === 'question'
                          ? '🔍 Track down this spot or inspect the clue photo above, then type your answer below!'
                          : '📸 Track down this exact place at the venue and snap a selfie or photo with it!'}
                      </p>
                    </div>
                  )}

                  {/* Hidden Input for Camera/File Upload (Photo challenges only) */}
                  {selectedCell.task_type !== 'question' && (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  )}

                  {/* PENDING REVIEW STATE */}
                  {selectedCell.status === 'pending' && (
                    <div className="space-y-3.5">
                      <div className="p-3 bg-[#FFDC47]/10 border-2 border-[#FFDC47] rounded-2xl text-[#FFDC47] text-xs font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>Submitted! Awaiting moderator verification. You can modify your submission before review.</span>
                      </div>

                      {selectedCell.task_type === 'question' ? (
                        // Question pending review box
                        <div className="space-y-3">
                          <div className="p-4 rounded-2xl bg-[#0B0B0E] border-2 border-black shadow-neo-black-sm">
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#FFDC47] block mb-1">
                              Your Submitted Answer:
                            </span>
                            <p className="text-sm font-bold text-white whitespace-pre-wrap">
                              {selectedCell.text_answer || textAnswer}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-400 block">Edit / Revise Answer:</label>
                            <textarea
                              rows={3}
                              value={textAnswer}
                              onChange={(e) => setTextAnswer(e.target.value)}
                              placeholder="Update your answer..."
                              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#0B0B0E] border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-500 outline-none text-xs font-medium resize-none shadow-inner"
                            />
                            <button
                              type="button"
                              onClick={handleUpload}
                              disabled={uploading || !textAnswer.trim() || textAnswer.trim() === selectedCell.text_answer}
                              className="w-full bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold py-3 px-4 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                            >
                              {uploading ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                                  <span>Updating Answer...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 text-black" />
                                  <span>Update Answer</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Photo pending review
                        <>
                          <div className="rounded-2xl overflow-hidden border-2 border-black bg-black aspect-video relative flex items-center justify-center shadow-neo-black-sm">
                            {imagePreview ? (
                              <>
                                <img src={imagePreview} alt="New Selection" className="w-full h-full object-cover" />
                                <span className="absolute top-2 left-2 bg-[#FFDC47] text-black text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-neo-black-sm">
                                  New Photo Selected
                                </span>
                              </>
                            ) : selectedCell.image_path ? (
                              <img src={selectedCell.image_path} alt="Submission" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs text-slate-500 font-bold">Preview not available</span>
                            )}
                          </div>

                          {imagePreview ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setImageFile(null);
                                  setImagePreview(null);
                                }}
                                disabled={uploading}
                                className="w-1/3 py-3 px-3 rounded-full bg-[#22222E] hover:bg-[#2C2C3A] text-slate-300 font-extrabold text-xs transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="w-2/3 bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold py-3 px-4 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                              >
                                {uploading ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5" /> Replace Photo
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={triggerFileSelect}
                              className="w-full py-3.5 px-4 rounded-full bg-[#20202A] hover:bg-[#2A2A38] border-2 border-[#333344] text-slate-200 font-extrabold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                              <Camera className="w-4 h-4 text-[#FFDC47]" />
                              <span>Retake / Change Photo</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* REJECTED STATE */}
                  {selectedCell.status === 'rejected' && (
                    <div className="space-y-3.5">
                      {selectedCell.rejection_reason && (
                        <div className="p-3.5 rounded-2xl bg-[#DF0586]/15 border-2 border-[#DF0586] text-white text-xs">
                          <p className="font-black uppercase text-[10px] tracking-wider text-[#FFDC47] mb-1">
                            Moderator Reason:
                          </p>
                          <p className="font-semibold italic">&quot;{selectedCell.rejection_reason}&quot;</p>
                        </div>
                      )}

                      {selectedCell.rejection_count >= 2 ? (
                        <div className="p-4 rounded-2xl bg-[#0B0B0E] border-2 border-[#DF0586] text-center space-y-2">
                          <AlertCircle className="w-7 h-7 text-[#DF0586] mx-auto" />
                          <h4 className="text-sm font-black text-white">Retries Exhausted</h4>
                          <p className="text-xs text-slate-400">
                            You have used your 1 permitted retry on this challenge. This tile is now locked.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3 bg-[#FFDC47]/10 border-2 border-[#FFDC47] rounded-2xl text-[#FFDC47] text-xs font-bold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 flex-shrink-0" />
                            <span>
                              {selectedCell.task_type === 'question'
                                ? 'You have 1 retry remaining! Provide a revised answer below.'
                                : 'You have 1 retry remaining! Snap a clearer photo that meets the challenge.'}
                            </span>
                          </div>

                          {selectedCell.task_type === 'question' ? (
                            <div className="space-y-3">
                              <textarea
                                rows={4}
                                value={textAnswer}
                                onChange={(e) => setTextAnswer(e.target.value)}
                                placeholder="Type your revised answer here..."
                                className="w-full px-4 py-3 rounded-2xl bg-[#0B0B0E] border-2 border-[#DF0586] focus:border-[#FFDC47] text-white placeholder-slate-500 outline-none text-xs font-medium resize-none shadow-inner"
                              />
                              <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading || !textAnswer.trim()}
                                className="w-full bg-[#DF0586] hover:bg-[#c20475] text-white font-extrabold py-3.5 px-4 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                              >
                                {uploading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    <span>Submitting Retry...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 text-white" />
                                    <span>Submit Final Retry Answer</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <>
                              {imagePreview ? (
                                <div className="space-y-3">
                                  <div className="rounded-2xl overflow-hidden border-2 border-black bg-black aspect-video relative">
                                    <img src={imagePreview} alt="Retry Preview" className="w-full h-full object-cover" />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="w-full bg-[#DF0586] hover:bg-[#c20475] text-white font-extrabold py-3.5 px-4 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                                  >
                                    {uploading ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Uploading Retry...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="w-4 h-4" /> Submit Final Retry
                                      </>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={triggerFileSelect}
                                  className="border-2 border-dashed border-[#FFDC47] hover:bg-[#FFDC47]/5 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                                >
                                  <div className="w-12 h-12 rounded-full bg-[#FFDC47] text-black flex items-center justify-center shadow-neo-black-sm">
                                    <Camera className="w-6 h-6" />
                                  </div>
                                  <p className="text-xs font-black text-white">Take Photo or Upload for Retry</p>
                                  <p className="text-[10px] text-slate-400">Make sure the subject is clearly visible</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* APPROVED STATE */}
                  {selectedCell.status === 'approved' && (
                    <div className="space-y-3.5">
                      <div className="p-3 bg-[#10B981]/15 border-2 border-[#10B981] rounded-2xl text-white text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                        <span>Challenge verified by moderator! Star awarded to your board.</span>
                      </div>

                      {selectedCell.task_type === 'question' ? (
                        <div className="p-4 rounded-2xl bg-[#0B0B0E] border-2 border-[#10B981] shadow-neo-black-sm">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#10B981] block mb-1">
                            Verified Answer:
                          </span>
                          <p className="text-sm font-bold text-white whitespace-pre-wrap">
                            {selectedCell.text_answer || textAnswer}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl overflow-hidden border-2 border-black bg-black aspect-video relative flex items-center justify-center shadow-neo-black-sm">
                          {selectedCell.image_path ? (
                            <img src={selectedCell.image_path} alt="Approved Photo" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-slate-500 font-bold">Image preview unavailable</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* NOT STARTED STATE */}
                  {selectedCell.status === 'not_started' && (
                    <div className="space-y-4">
                      {selectedCell.task_type === 'question' ? (
                        // Question answer input
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-wider text-[#FFDC47] flex items-center gap-1.5">
                              <HelpCircle className="w-4 h-4 text-[#FFDC47]" />
                              <span>Your Answer:</span>
                            </label>
                            <textarea
                              rows={4}
                              value={textAnswer}
                              onChange={(e) => setTextAnswer(e.target.value)}
                              placeholder="Type your answer here..."
                              className="w-full px-4 py-3.5 rounded-2xl bg-[#0B0B0E] border-2 border-[#2A2A38] focus:border-[#FFDC47] text-white placeholder-slate-500 outline-none text-xs font-medium resize-none shadow-inner transition-colors"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleUpload}
                            disabled={uploading || !textAnswer.trim()}
                            className="w-full bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold py-3.5 px-4 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                          >
                            {uploading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-black" />
                                <span>Submitting Answer...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4 text-black" />
                                <span>Submit Answer ⚡</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        // Photo upload input
                        <>
                          {imagePreview ? (
                            <div className="space-y-3">
                              <div className="rounded-2xl overflow-hidden border-2 border-black bg-black aspect-video relative shadow-neo-black-sm">
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setImageFile(null);
                                    setImagePreview(null);
                                  }}
                                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="w-full bg-[#FFDC47] hover:bg-[#ffe366] text-black font-extrabold py-3.5 px-4 rounded-full shadow-neo-black active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                              >
                                {uploading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                                    <span>Uploading & Compressing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4 text-black" />
                                    <span>Submit Challenge Photo</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={triggerFileSelect}
                              className="border-2 border-dashed border-[#2F2F3D] hover:border-[#FFDC47] hover:bg-[#FFDC47]/5 rounded-[24px] p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5"
                            >
                              <div className="w-14 h-14 rounded-2xl bg-[#FFDC47] text-black flex items-center justify-center shadow-neo-black-sm">
                                <Camera className="w-7 h-7" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-white">Snap Live Photo or Choose File</p>
                                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Automatic image compression applied</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN CLUE PHOTO OVERLAY */}
      {fullscreenClue && (
        <div 
          className="fixed inset-0 bg-black/95 z-[99999] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setFullscreenClue(null)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-[#181820] border-2 border-black rounded-full hover:bg-black text-white cursor-pointer shadow-neo-yellow-sm"
            onClick={() => setFullscreenClue(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-3xl w-full flex flex-col items-center">
            <div className="mb-3 px-4 py-1.5 rounded-full bg-[#DF0586] text-white border-2 border-black text-xs font-black shadow-neo-black-sm flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Clue Photo: Find This Spot
            </div>
            <img 
              src={fullscreenClue} 
              alt="Mystery Location Clue Fullscreen" 
              className="max-w-full max-h-[75vh] object-contain rounded-3xl border-2 border-black shadow-neo-yellow"
            />
            <p className="text-center text-xs text-slate-300 font-bold mt-3 bg-black/80 px-4 py-2 rounded-full border border-[#222]">
              Tap anywhere or press X to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
