import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { 
  Activity, 
  ShieldCheck, 
  Wallet, 
  Database, 
  Clock, 
  Zap, 
  Thermometer, 
  Gauge, 
  Table, 
  AlertTriangle,
  Cpu,
  Server,
  Monitor
} from 'lucide-react';
import {API_BASE_URL} from "../../../consts"
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function BatteryManagement() {
  const [data, setData] = useState(null);
  const [dbRows, setDbRows] = useState(null);
  const [range, setRange] = useState('day'); 
  const [hist, setHist] = useState(null);

  const BACKEND_URL =`${API_BASE_URL}:6005`; // 'http://localhost:6005'

  const fetchData = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/data`);
      const telemetryJson = await res.json();
      setData(telemetryJson);
      
      const dbRes = await fetch(`${BACKEND_URL}/api/db/raw`);
      const sqlRowsJson = await dbRes.json();
      setDbRows(sqlRowsJson);

      const hRes = await fetch(`${BACKEND_URL}/api/history/${range}`);
      const historyJson = await hRes.json();
      setHist(historyJson);
    } catch (e) { 
      console.error("BMS Sync Error"); 
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 2500);
    return () => clearInterval(timer);
  }, [range]);

  const sendCmd = async (c) => {
    await fetch(`${BACKEND_URL}/api/cmd/${c}`, { method: 'POST' });
    fetchData();
  };

  if (!data || !hist) return (
    <div className="bg-[#111827] min-h-screen text-blue-500 flex flex-col items-center justify-center font-mono">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h2 className="text-2xl font-black animate-pulse uppercase tracking-[0.3em]">BMS_SYSTEM_BOOTING</h2>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111827] text-slate-300 font-sans p-4 text-[10px] uppercase tracking-wider select-none">
      <div className="max-w-[1700px] mx-auto bg-[#1f2937] border border-slate-700 p-8 shadow-2xl rounded-[2rem]">
        
        <header className="flex justify-between items-center mb-10 border-b border-slate-700 pb-6">
           <div className="flex items-center gap-6">
              <div className="bg-blue-600 text-white px-5 py-2 font-black text-sm rounded shadow-lg uppercase italic">
                VARTA BMS ANALYTICS PRO v6.5
              </div>
              <div className="flex gap-8 text-slate-400 font-bold items-center">
                 <div className="flex items-center gap-2 text-xs">
                    <Server size={14} className="text-blue-500" />
                    <span>ВУЗОЛ: SMART_LAB_05 (PORT: 6005)</span>
                 </div>
                 <div className="bg-slate-800/50 px-4 py-1.5 rounded-lg border border-slate-700">
                    <span className="text-blue-400 font-bold italic px-2">РЕЖИМ: {data.telemetry.mode}</span>
                 </div>
              </div>
           </div>
           <div className="bg-slate-800 px-6 py-2.5 rounded-full border border-slate-700 flex items-center gap-4">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
              <span className="text-emerald-500 font-black">SQL_DB: ПІДКЛЮЧЕНО</span>
              <span className="text-slate-500 ml-4 font-mono font-bold text-sm tracking-normal">
                {new Date().toLocaleTimeString()}
              </span>
           </div>
        </header>

        <div className="grid grid-cols-12 gap-8 mb-10">
           {/* ГРАФІК ЗЛІВА */}
           <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl h-[670px] relative">
                 <div className="flex justify-between items-center mb-10">
                    <p className="text-slate-400 font-black flex items-center gap-3 text-[11px] tracking-widest uppercase">
                       <Activity size={18} className="text-blue-500" /> АНАЛІТИКА ТЕЛЕМЕТРІЇ
                    </p>
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
                       {[['day', '24Г'], ['week', '7Д'], ['month', '30Д']].map(([k, l]) => (
                          <button key={k} onClick={() => setRange(k)} className={`px-4 py-2 rounded-lg text-[9px] font-black transition ${range === k ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
                             {l}
                          </button>
                       ))}
                    </div>
                 </div>
                 <div className="h-[500px]">
                    <Line data={{ labels: hist.labels, datasets: [ { label: 'V', data: hist.voltage, borderColor: '#3b82f6', borderWidth: 3, fill: true, tension: 0.35, pointRadius: 3 }, { label: '%', data: hist.soc, borderColor: '#10b981', borderDash: [5, 5], tension: 0.3, pointRadius: 0 } ] }} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 11, max: 14 } }, plugins: { legend: { position: 'bottom' } } }} />
                 </div>
              </div>
           </div>

           {/* ЦЕНТР (ЗАРЯД) */}
           <div className="col-span-12 lg:col-span-4 space-y-6 text-center">
              <div className="bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl">
                 <p className="text-slate-500 mb-6 font-black uppercase text-[11px]">ПОТОЧНИЙ СТАН <Monitor size={16} className="inline ml-2 text-blue-500"/></p>
                 <div className="text-9xl font-black text-white mb-6 tracking-tighter">{data.telemetry.soc}%</div>
                 <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden mb-8 border border-slate-700">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-emerald-400 shadow-[0_0_20px_rgba(59,130,246,0.6)]" style={{width: data.telemetry.soc + '%'}}></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50">
                       <p className="text-slate-600 mb-2 font-bold uppercase italic text-[9px]">НАПРУГА</p>
                       <p className="text-4xl text-white font-black">{data.telemetry.v}V</p>
                    </div>
                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50">
                       <p className="text-slate-600 mb-2 font-bold uppercase italic text-[9px]">СТРУМ</p>
                       <p className={data.telemetry.i < 0 ? 'text-4xl font-black text-orange-500' : 'text-4xl font-black text-emerald-500'}>{data.telemetry.i}A</p>
                    </div>
                 </div>
              </div>

              {/* БАНКИ */}
              <div className="bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl">
                 <p className="text-slate-500 mb-6 font-black uppercase text-[10px] tracking-widest text-left underline decoration-blue-900 decoration-4">ДЕТАЛЬНА ДІАГНОСТИКА БАНОК</p>
                 <table className="w-full text-left text-[11px] border-separate border-spacing-y-2">
                    <tbody>
                       {data.cells.map((v, i) => (
                          <tr key={i} className="bg-slate-900/40 hover:bg-blue-600/5 transition rounded-xl">
                             <td className="py-3 pl-6 font-black text-slate-500">БАНКА_0{i+1}</td>
                             <td className="py-3 text-center text-blue-400 font-black">{v}V</td>
                             <td className="py-3 text-right pr-6 text-emerald-600 font-black italic">99.8% OK</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           {/* СПРАВА (ЕКОНОМІКА + КНОПКИ) */}
           <div className="col-span-12 lg:col-span-4 space-y-6 flex flex-col">
              <div className="grid grid-cols-2 gap-6 text-center">
                 <div className="bg-slate-800 border border-slate-700 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-blue-400 mb-4 font-black uppercase text-[9px]">ЕКОНОМІЯ <Wallet size={12} className="inline ml-1"/></p>
                    <div className="text-4xl font-black text-white">{data.uah} <span className="text-xs text-slate-600 uppercase">грн</span></div>
                 </div>
                 <div className="bg-slate-800 border border-slate-700 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-emerald-500 mb-4 font-black uppercase text-[9px]">ЗНОС <ShieldCheck size={12} className="inline ml-1"/></p>
                    <div className="text-4xl font-black text-white">99.9%</div>
                 </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-xl">
                 <p className="text-slate-500 mb-6 font-black uppercase text-[10px] italic">КЕРУВАННЯ ТА БЕЗПЕКА</p>
                 <div className="space-y-4">
                    <button onClick={() => sendCmd('charge')} className="w-full bg-blue-600 text-black py-4 rounded-xl hover:bg-blue-500 transition font-black uppercase text-[10px]">Примусовий заряд</button>
                    <button onClick={() => sendCmd('auto')} className="w-full bg-slate-700 border border-slate-600 py-3 rounded-xl hover:bg-slate-600 transition font-bold uppercase text-white">Автоматичний режим</button>
                    <button onClick={() => sendCmd('stop')} className="w-full bg-red-900/10 border border-red-900/40 py-3 rounded-xl hover:bg-red-800 transition font-bold text-red-500 flex items-center justify-center gap-2 uppercase tracking-widest"><AlertTriangle size={14}/> Emergency Stop</button>
                 </div>
              </div>

              <div className="bg-black/40 border border-slate-800 p-8 rounded-[2.5rem] flex-1 flex flex-col overflow-hidden shadow-inner">
                 <p className="text-[10px] text-slate-700 font-black mb-4 uppercase tracking-[0.3em] border-b border-slate-800 pb-3">SQL TRANSACTION CONSOLE</p>
                 <div className="space-y-3 font-mono text-[9px] overflow-y-auto flex-1 scrollbar-hide pr-2">
                    {data.logs.map((l, i) => <div key={i} className="flex gap-4 border-l-2 border-blue-900/30 pl-4 uppercase font-bold"><span className="text-blue-900">[{l.t}]</span> <span>{l.m}</span></div>)}
                 </div>
              </div>
           </div>
        </div>

        {/* НИЖНІ ПАНЕЛІ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
           <div className="bg-slate-800 border border-slate-700 p-8 flex items-center gap-8 rounded-[2rem] shadow-xl border-l-4 border-l-orange-500">
              <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500"><Thermometer size={32}/></div>
              <div><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Температура</p><p className="text-3xl font-black text-white">{data.telemetry.temp}°C</p></div>
           </div>
           <div className="bg-slate-800 border border-slate-700 p-8 flex items-center gap-8 rounded-[2rem] shadow-xl border-l-4 border-l-blue-500">
              <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500"><Clock size={32}/></div>
              <div><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Автономність</p><p className="text-3xl font-black text-blue-400">14.1 ГОД.</p></div>
           </div>
           <div className="bg-slate-800 border border-slate-700 p-8 flex items-center gap-8 rounded-[2rem] shadow-xl border-l-4 border-l-emerald-500">
              <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500"><Gauge size={32}/></div>
              <div><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Ефективність</p><p className="text-3xl font-black text-white">98.4%</p></div>
           </div>
        </div>

        {/* SQL EXPLORER */}
        <div className="mt-12 bg-black border border-blue-900/20 p-10 rounded-[3rem] shadow-2xl relative">
           <p className="text-blue-500 font-black flex items-center gap-5 uppercase tracking-[0.4em] text-xs mb-8 border-b border-slate-800 pb-6"><Table size={22} className="text-blue-400 animate-pulse"/> SQL DATABASE EXPLORER (SOURCE: BMS.db)</p>
           <div className="overflow-x-auto h-[350px] scrollbar-hide border border-slate-900/50 rounded-2xl bg-slate-950/30">
              <table className="w-full text-left text-[10px] border-collapse">
                 <thead className="sticky top-0 z-10 bg-slate-900 text-slate-500 border-b border-slate-800 uppercase font-black tracking-widest">
                    <tr>{dbRows?.columns.map(col => <th key={col} className="p-5">{col}</th>)}</tr>
                 </thead>
                 <tbody className="font-mono divide-y divide-slate-900">
                    {dbRows?.data.map((row, i) => (<tr key={i} className="hover:bg-blue-600/5 transition"><td className="p-5 text-blue-900 font-black">{row[0]}</td>{row.slice(1).map((cell, j) => <td key={j} className="p-5 text-slate-400 font-bold uppercase">{cell}</td>)}</tr>))}
                 </tbody>
              </table>
           </div>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-800 flex justify-between text-[9px] font-black text-slate-700 uppercase tracking-[0.6em] items-center opacity-60">
           <div className="flex items-center gap-4"><Cpu size={14}/><span>BMS Analytics Engine v6.5 FINAL BUILD</span></div>
           <span>KPI SmartEnergy_Lab UNIT_05</span>
        </footer>
      </div>
    </div>
  );
}

export default BatteryManagement;