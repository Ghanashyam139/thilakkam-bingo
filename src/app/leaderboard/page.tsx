'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { 
  Trophy, 
  Crown, 
  Medal, 
  Star, 
  Sparkles, 
  CheckCircle2, 
  Flame,
  Radio,
  ArrowLeft,
  Tv
} from 'lucide-react';
import type { Player } from '@/lib/db';

export default function BigScreenLeaderboard() {
  const [top10, setTop10] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);

  // Initial fetch
  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          setTop10(data.top10 || []);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  // WebSocket for live updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.connect();

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('leaderboard-update', (data: Player[]) => {
      setTop10(data.slice(0, 10));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('leaderboard-update');
      socket.disconnect();
    };
  }, []);

  const firstPlace = top10[0];
  const secondPlace = top10[1];
  const thirdPlace = top10[2];
  const remainingPlayers = top10.slice(3, 10);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white flex flex-col relative overflow-x-hidden select-none selection:bg-[#FFDC47] selection:text-black">
      
      {/* Top Header Bar */}
      <header className="bg-[#0A0A0C]/90 backdrop-blur-md border-b-2 border-black sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-2xl bg-[#181820] hover:bg-[#222230] text-slate-300 hover:text-white border-2 border-[#2E2E3E] flex items-center justify-center transition-colors"
              title="Return to Game"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#FFDC47] text-black flex items-center justify-center font-black text-2xl shadow-neo-black-sm">
                ⚄
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    thilakkam <span className="text-[#FFDC47]">quest</span>
                  </h1>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-[#DF0586] text-white px-2.5 py-0.5 rounded-full border border-black shadow-neo-black-sm">
                    TV Broadcaster
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-semibold">Thilakkam Annual Day 2026 • Live Championship Standings</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#141418] border-2 border-black px-4 py-2 rounded-full shadow-neo-black-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-[#10B981] shadow-[0_0_10px_#10B981] animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                {socketConnected ? 'Live Broadcast Feed' : 'Connecting...'}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-[#16161D] px-3.5 py-2 rounded-full border border-[#272734] hidden md:inline-flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5 text-[#FFDC47]" /> Press F11 for Fullscreen
            </span>
          </div>
        </div>
      </header>

      {/* Signature Evolve Marquee Strip */}
      <div className="bg-[#7A3EE8] text-[#FFDC47] py-2 overflow-hidden border-b-2 border-black select-none font-black text-xs tracking-wider uppercase">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-8">
          <span>👑 LIVE STANDINGS</span>
          <span>✦ RANKED BY BINGO LINES</span>
          <span>✦ 5 IN A ROW SCORES A POINT</span>
          <span>🏆 TOURNAMENT PODIUM</span>
          <span>👑 LIVE STANDINGS</span>
          <span>✦ RANKED BY BINGO LINES</span>
          <span>✦ 5 IN A ROW SCORES A POINT</span>
          <span>🏆 TOURNAMENT PODIUM</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col justify-between gap-10">
        
        {/* PODIUM CARDS (Evolve Neo-Brutalist 3-Column Pedestal) */}
        <section className="w-full pt-10 sm:pt-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 lg:gap-8 items-end">
            
            {/* 🥈 2ND PLACE (Left / Runner Up - Magenta Accent) */}
            <div className="order-2 md:order-1 flex flex-col">
              {secondPlace ? (
                <div className="bg-[#141418] border-2 border-black rounded-[32px] p-6 text-center shadow-neo-magenta relative pt-8 flex flex-col items-center">
                  {/* Badge */}
                  <div className="absolute -top-6 w-12 h-12 rounded-2xl bg-[#DF0586] text-white border-2 border-black flex items-center justify-center font-black text-xl shadow-neo-black-sm">
                    <Medal className="w-6 h-6 fill-white" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#DF0586] bg-[#DF0586]/10 px-3 py-1 rounded-full border border-[#DF0586]/30">
                    2nd Place • Runner-Up
                  </span>
                  
                  <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight mt-3 truncate max-w-full">
                    {secondPlace.nickname || secondPlace.name}
                  </h2>
                  {secondPlace.department && (
                    <span className="text-xs font-bold text-slate-300 bg-[#22222E] px-3 py-0.5 rounded-full mt-2 border border-[#333344]">
                      {secondPlace.department}
                    </span>
                  )}

                  {/* Score pills */}
                  <div className="grid grid-cols-2 gap-2.5 w-full mt-5 pt-4 border-t-2 border-[#252533]">
                    <div className="bg-[#0B0B0E] border-2 border-black rounded-2xl p-2.5 shadow-neo-black-sm">
                      <span className="text-[9px] font-black uppercase text-[#FFDC47] block">Bingo Lines</span>
                      <span className="text-xl font-black text-white flex items-center justify-center gap-1 mt-0.5">
                        <Trophy className="w-4 h-4 text-[#FFDC47]" /> {secondPlace.bingo_score}
                      </span>
                    </div>
                    <div className="bg-[#0B0B0E] border-2 border-black rounded-2xl p-2.5 shadow-neo-black-sm">
                      <span className="text-[9px] font-black uppercase text-[#10B981] block">Approved</span>
                      <span className="text-xl font-black text-white flex items-center justify-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> {secondPlace.approved_count}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#141418] border-2 border-dashed border-[#2E2E3E] rounded-[32px] p-10 text-center text-xs text-slate-500 font-bold">
                  2nd Place Contender Awaited
                </div>
              )}
            </div>

            {/* 👑 1ST PLACE (Center / Champion - Sunny Evolve Yellow Hero) */}
            <div className="order-1 md:order-2 flex flex-col">
              {firstPlace ? (
                <div className="bg-[#FFDC47] text-black border-2 border-black rounded-[36px] p-7 text-center shadow-neo-black relative pt-10 flex flex-col items-center transform md:-translate-y-4">
                  {/* Crown Rank Badge */}
                  <div className="absolute -top-7 w-16 h-16 rounded-3xl bg-black text-[#FFDC47] border-2 border-black flex items-center justify-center font-black shadow-neo-black-sm z-10">
                    <Crown className="w-9 h-9 fill-[#FFDC47]" />
                  </div>

                  <span className="text-xs font-black uppercase tracking-widest bg-black text-[#FFDC47] px-3.5 py-1 rounded-full shadow-neo-black-sm flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Tournament Leader • 1st Place
                  </span>

                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-black mt-3 truncate max-w-full leading-tight">
                    {firstPlace.nickname || firstPlace.name}
                  </h2>
                  {firstPlace.department && (
                    <span className="text-xs font-extrabold uppercase tracking-wider text-black bg-black/10 px-3.5 py-1 rounded-full mt-2.5 border border-black/20">
                      {firstPlace.department}
                    </span>
                  )}

                  {/* Champion Metrics Box */}
                  <div className="grid grid-cols-2 gap-3 w-full mt-6 pt-4 border-t-2 border-black">
                    <div className="bg-black text-[#FFDC47] rounded-2xl p-3 shadow-neo-black-sm">
                      <span className="text-[10px] font-black uppercase tracking-widest block text-white/80">Bingo Lines</span>
                      <span className="text-2xl lg:text-3xl font-black flex items-center justify-center gap-1.5 mt-0.5">
                        <Trophy className="w-6 h-6 text-[#FFDC47]" /> {firstPlace.bingo_score}
                      </span>
                    </div>
                    <div className="bg-black text-[#10B981] rounded-2xl p-3 shadow-neo-black-sm">
                      <span className="text-[10px] font-black uppercase tracking-widest block text-white/80">Approved Tasks</span>
                      <span className="text-2xl lg:text-3xl font-black flex items-center justify-center gap-1.5 mt-0.5 text-[#10B981]">
                        <CheckCircle2 className="w-6 h-6" /> {firstPlace.approved_count}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#141418] border-2 border-dashed border-[#FFDC47] rounded-[36px] p-12 text-center text-sm text-[#FFDC47] font-black">
                  👑 Grand Champion Spot Open!
                </div>
              )}
            </div>

            {/* 🥉 3RD PLACE (Right - Purple Accent) */}
            <div className="order-3 flex flex-col">
              {thirdPlace ? (
                <div className="bg-[#141418] border-2 border-black rounded-[32px] p-6 text-center shadow-neo-purple relative pt-8 flex flex-col items-center">
                  <div className="absolute -top-6 w-12 h-12 rounded-2xl bg-[#7A3EE8] text-white border-2 border-black flex items-center justify-center font-black text-xl shadow-neo-black-sm">
                    <Medal className="w-6 h-6 fill-white" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#7A3EE8] bg-[#7A3EE8]/10 px-3 py-1 rounded-full border border-[#7A3EE8]/30">
                    3rd Place • Bronze
                  </span>

                  <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight mt-3 truncate max-w-full">
                    {thirdPlace.nickname || thirdPlace.name}
                  </h2>
                  {thirdPlace.department && (
                    <span className="text-xs font-bold text-slate-300 bg-[#22222E] px-3 py-0.5 rounded-full mt-2 border border-[#333344]">
                      {thirdPlace.department}
                    </span>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 w-full mt-5 pt-4 border-t-2 border-[#252533]">
                    <div className="bg-[#0B0B0E] border-2 border-black rounded-2xl p-2.5 shadow-neo-black-sm">
                      <span className="text-[9px] font-black uppercase text-[#FFDC47] block">Bingo Lines</span>
                      <span className="text-xl font-black text-white flex items-center justify-center gap-1 mt-0.5">
                        <Trophy className="w-4 h-4 text-[#FFDC47]" /> {thirdPlace.bingo_score}
                      </span>
                    </div>
                    <div className="bg-[#0B0B0E] border-2 border-black rounded-2xl p-2.5 shadow-neo-black-sm">
                      <span className="text-[9px] font-black uppercase text-[#10B981] block">Approved</span>
                      <span className="text-xl font-black text-white flex items-center justify-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> {thirdPlace.approved_count}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#141418] border-2 border-dashed border-[#2E2E3E] rounded-[32px] p-10 text-center text-xs text-slate-500 font-bold">
                  3rd Place Contender Awaited
                </div>
              )}
            </div>

          </div>
        </section>

        {/* RANKS 4 THROUGH 10 CONTESTANT LIST */}
        <section className="w-full">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#202028] mb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#FFDC47]" />
              <span>Contestant Standings • Ranks #4 to #10</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              Auto-refreshes via WebSocket
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {remainingPlayers.map((p, index) => {
              const rank = index + 4;
              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-[#141418] border-2 border-black hover:border-[#FFDC47] shadow-neo-black-sm transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#0B0B0E] border-2 border-black font-black text-sm text-[#FFDC47] flex items-center justify-center flex-shrink-0 shadow-neo-black-sm">
                      #{rank}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-white truncate">
                        {p.nickname || p.name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 truncate">
                        {p.department || 'Contestant'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-black text-[#FFDC47] flex items-center justify-end gap-1">
                      <Trophy className="w-3.5 h-3.5" /> {p.bingo_score}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 block">
                      {p.approved_count} tasks
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Empty slots for visual balance */}
            {Array.from({ length: Math.max(0, 7 - remainingPlayers.length) }).map((_, i) => (
              <div
                key={`empty_${i}`}
                className="p-4 rounded-2xl border-2 border-dashed border-[#262634] bg-[#0E0E12]/50 flex items-center justify-between text-slate-500 text-xs font-bold"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-[#141418] border border-[#262634] flex items-center justify-center text-slate-600 font-bold">
                    #{remainingPlayers.length + 4 + i}
                  </span>
                  <span>Challenger Awaiting</span>
                </div>
                <span className="text-[10px] uppercase text-slate-600">Open</span>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-[#0A0A0C] border-t-2 border-black py-4 px-6 text-center text-xs text-slate-500 font-semibold">
        Thilakkam Quest Live Tournament Broadcast • Built for Thilakkam Annual Day Challenge
      </footer>
    </div>
  );
}
