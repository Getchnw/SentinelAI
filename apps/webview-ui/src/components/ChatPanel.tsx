import React, { useState } from "react";

export function ChatPanel() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#0f1115] text-[#94a3b8] font-sans text-xs">
      {/* Header - Minimalist & Sleek */}
      <header className="px-4 py-3 border-b border-[#1e293b] flex justify-between items-center bg-[#0f1115] sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-[#0e639c] rounded-full"></div>
          <h1 className="text-sm font-bold text-white tracking-tight">SENTNEL AI <span className="text-[#0e639c]">v0.1</span></h1>
        </div>
        <div className="flex gap-2">
            <span className="px-2 py-0.5 bg-[#1a1d23] border border-[#2d3748] rounded text-[10px] text-gray-400">Scanner Active</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Input Prompt Visual */}
        <div className="opacity-60 text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Current Request</div>
        <div className="bg-[#1a1d23] p-3 rounded-lg border border-[#2d3748] text-gray-300 italic">
          "Scan this file for potential SQL Injection vulnerabilities..."
        </div>

        {/* The Result Card Group */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
             <div className="text-[10px] uppercase tracking-widest font-bold text-[#0ea5e9]">Security Analysis Report</div>
             <span className="text-[10px] text-gray-500">Request ID: #SENT-902</span>
          </div>

          {/* CARD 1: Vulnerability Finding */}
          <div className="bg-[#161b22] border-l-4 border-red-500 rounded-r-lg border-y border-r border-[#30363d] overflow-hidden shadow-xl">
            <div className="p-4 bg-[#21262d]/50 flex justify-between items-start">
               <div>
                  <h3 className="text-white font-bold text-sm mb-1">Potential SQL Injection</h3>
                  <p className="text-gray-400 text-[11px]">Rule ID: <span className="font-mono text-[#0ea5e9]">python.sql.injection-danger</span></p>
               </div>
               <span className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[10px] font-bold">CRITICAL</span>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="leading-relaxed">
                Found unparameterized input <code className="bg-[#000] px-1 rounded text-red-400">user_input</code> being concatenated directly into a query string at <span className="text-white underline">line 12</span>.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 bg-gray-800 rounded text-[10px]">OWASP A03:2021</span>
                <span className="px-2 py-0.5 bg-gray-800 rounded text-[10px]">CWE-89</span>
              </div>
            </div>
          </div>

          {/* CARD 2: Proposed Fix (Diff View Style) */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden shadow-xl">
             <div className="p-3 bg-[#21262d]/50 border-b border-[#30363d] flex justify-between items-center">
                <span className="text-white font-bold text-[10px] uppercase tracking-wider">Proposed Security Patch</span>
                <span className="text-green-500 text-[10px]">Ready to apply</span>
             </div>
             <div className="p-0 font-mono text-[11px]">
                {/* Simulated Diff UI */}
                <div className="bg-[#000] p-4 space-y-1">
                   <div className="text-red-400 opacity-50">- query = "SELECT * FROM users WHERE id = " + user_input</div>
                   <div className="text-green-400">+ query = "SELECT * FROM users WHERE id = ?"</div>
                   <div className="text-green-400">+ cursor.execute(query, (user_input,))</div>
                </div>
             </div>
             <div className="p-3 bg-[#1c2128] border-t border-[#30363d] flex justify-end">
                <button className="bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded text-[11px] font-bold transition-all flex items-center gap-2">
                   <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                   Accept and Apply Fix
                </button>
             </div>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <div className="relative w-12 h-12">
               <div className="absolute inset-0 border-4 border-[#0e639c]/20 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-[#0e639c] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-[#0ea5e9] animate-pulse font-bold tracking-tighter">AI ENGINE ANALYZING...</p>
          </div>
        )}
      </main>

      {/* Footer - Professional Action Bar */}
      <footer className="p-4 border-t border-[#1e293b] bg-[#0f1115]">
        <div className="flex gap-2">
           <button 
             onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 2000);
             }}
             className="flex-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white py-2 rounded font-bold transition-all"
           >
             Refresh Analysis
           </button>
           <button className="flex-1 bg-[#0e639c] hover:bg-[#1177bb] text-white py-2 rounded font-bold shadow-lg shadow-blue-900/20 transition-all">
             Full Scan
           </button>
        </div>
      </footer>
    </div>
  );
}
