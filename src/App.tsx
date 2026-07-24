import React from 'react';
import MyGoals from './pages/MyGoals';

export default function App() {
  return (
    <div className="min-h-screen bg-[#040406] text-[#ececf3] flex flex-col selection:bg-[#00ff88]/30 selection:text-white">
      <main className="flex-grow">
        <MyGoals />
      </main>
      
      {/* Visual footer */}
      <footer className="bg-[#08080c] border-t border-zinc-900 py-8 text-center text-[10px] text-zinc-500 font-mono tracking-wide uppercase">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p>&copy; 2026 LearnApp</p>
        </div>
      </footer>
    </div>
  );
}
