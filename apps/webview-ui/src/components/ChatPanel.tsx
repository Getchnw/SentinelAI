import React, { useState } from "react";

export function ChatPanel() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#0f1115] text-[#94a3b8] font-sans text-xs">
      
      {/* Header - SENTINEL AI */}
      <header className="px-4 py-4 border-b border-[#1e293b] flex justify-between items-center bg-[#0f1115]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-cyan-400 rounded-full"></div>
          <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 animate-gradient-x">
            SENTINEL AI
          </h1>
        </div>
        <div className="flex gap-2">
            <span className="px-2 py-1 bg-[#1a1d23] border border-blue-500/20 rounded-full text-[9px] text-blue-400 font-bold uppercase tracking-tighter">
              Scanner Active
            </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Section: Current Request */}
        <div>
          <div className="opacity-60 text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2 ml-1">Current Request</div>
          <div className="bg-[#1a1d23] p-4 rounded-xl border border-[#2d3748] text-gray-300 italic shadow-inner">
            "Scan this file for potential SQL Injection vulnerabilities..."
          </div>
        </div>

        {/* Section: Results */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <div className="text-[10px] uppercase tracking-widest font-bold text-[#0ea5e9]">Security Analysis Report</div>
             <span className="text-[10px] text-gray-500 font-mono">ID: #SENT-902</span>
          </div>

          {/* CARD 1: Vulnerability Finding */}
          <div className="relative overflow-hidden bg-[#161b22] rounded-xl border border-[#30363d] shadow-2xl transition-all hover:border-[#414853]">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 rounded-l-xl"></div>
            
            <div className="p-4 bg-[#21262d]/40 flex justify-between items-start pl-7">
               <div>
                  <h3 className="text-white font-bold text-sm mb-0.5">Potential SQL Injection</h3>
                  <p className="text-gray-500 text-[10px]">Rule: <span className="font-mono text-[#0ea5e9]">python.sql.injection-danger</span></p>
               </div>
               <span className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[9px] font-black tracking-tighter">CRITICAL</span>
            </div>
            
            <div className="p-4 space-y-3 pl-7 border-t border-[#30363d]/30">
              <p className="leading-relaxed text-[11px] text-gray-300">
                Found unparameterized input <code className="bg-black/50 px-1.5 py-0.5 rounded text-red-400 font-mono">user_input</code> being concatenated directly into a query string at <span className="text-white underline decoration-red-500/50 underline-offset-4 cursor-help">line 12</span>.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-800/50 text-slate-400 rounded-md text-[9px] font-medium border border-slate-700">OWASP A03:2021</span>
                <span className="px-2 py-1 bg-slate-800/50 text-slate-400 rounded-md text-[9px] font-medium border border-slate-700">CWE-89</span>
              </div>
            </div>
          </div>

          {/* CARD 2: Proposed Fix (เพิ่มปุ่ม Copy โค้ด) */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl">
             <div className="p-3 bg-[#21262d]/60 border-b border-[#30363d] flex justify-between items-center px-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-white font-bold text-[10px] uppercase tracking-wider">Proposed Security Patch</span>
                </div>
                {/* ปุ่ม Copy โค้ดแบบไอคอน */}
                <button className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white" title="Copy code">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
             </div>
             <div className="p-0 font-mono text-[11px]">
                <div className="bg-black/40 p-4 space-y-1">
                   <div className="text-red-400/60 flex gap-2"><span>-</span> <span>query = "SELECT * FROM users WHERE id = " + user_input</span></div>
                   <div className="text-green-400 flex gap-2"><span>+</span> <span>query = "SELECT * FROM users WHERE id = ?"</span></div>
                   <div className="text-green-400 flex gap-2"><span>+</span> <span>cursor.execute(query, (user_input,))</span></div>
                </div>
             </div>
             <div className="p-3 bg-[#1c2128]/50 border-t border-[#30363d] flex justify-end px-4">
                <button className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 shadow-lg shadow-green-900/20 active:scale-95">
                   <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                   Accept and Apply Fix
                </button>
             </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="relative w-14 h-14">
               <div className="absolute inset-0 border-4 border-[#0e639c]/20 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-[#0e639c] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-[#0ea5e9] animate-pulse font-black tracking-widest text-[10px]">AI ENGINE ANALYZING</p>
              <p className="text-gray-600 text-[9px]">Deep Scanning for OWASP Vulnerabilities...</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer - Professional Action Bar */}
      <footer className="p-4 border-t border-[#1e293b] bg-[#0f1115] shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        <div className="flex gap-3">
           <button 
             onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 2000);
             }}
             className="flex-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white py-2.5 rounded-lg font-bold transition-all active:scale-95"
           >
             Refresh Analysis
           </button>
           <button className="flex-1 bg-[#0e639c] hover:bg-[#1177bb] text-white py-2.5 rounded-lg font-bold shadow-lg shadow-blue-900/30 transition-all active:scale-95">
             Full Scan
           </button>
        </div>
      </footer>
    </div>
  );
}