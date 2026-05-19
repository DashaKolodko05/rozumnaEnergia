import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from "react-router";
import {
    Sun, Battery, Zap, Activity, TrendingUp, Gauge, ArrowBigRightDashIcon,
    BarChart2
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {StatCard, ConsumerCard, IngestorCard} from "./DashboardCards.tsx"
import VAGraph from "./VAGraph.tsx";
import type { ConsumerDevice } from "../types.ts";


export const Dashboard = ({history, status, devices, isMqttConnected, ingestorInfo, isSimulatorOn, isSimulatorPending, onToggleSimulator}: any) => {
    const [hiddenKeys, setHiddenKeys] = useState<Record<string, boolean>>({});

    const toggleKey = (e: any) => {
        const {dataKey} = e;
        setHiddenKeys(prev => ({...prev, [dataKey]: !prev[dataKey]}));
    };

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8 w-full bg-slate-50 font-sans">
            <NavLink to="/" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors">
                <ArrowLeft size={20} /> Повернутися на головну
            </NavLink>
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SmartEnergy <span
                            className="text-indigo-600">Lab</span></h1>
                        <p className="text-slate-500 text-sm">Моніторинг мережі в реальному часі</p>
                    </div>

                    <NavLink
                        to='/Monitoring_Monastyrnyi/comparison'
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg
                        shadow-indigo-100 hover:bg-indigo-600 transition-all active:scale-95 cursor-pointer">
                        <BarChart2 size={18} />
                        Відстеження даних
                    </NavLink>
                </div>
                <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${isMqttConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    <div
                        className={`w-2.5 h-2.5 rounded-full ${isMqttConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                    {isMqttConnected ? 'Система Онлайн (актуальні дані)' : 'Система Офлайн (Лише минулі збережені дані)'}
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <StatCard title="Сонячна генерація" value={status.solarPower} unit="Вт" icon={Sun} color="bg-amber-500"/>
                <StatCard title="Загальне споживання енергії" value={status.dischargePower} unit="Вт" icon={Zap} color="bg-rose-500"/>
                <StatCard title="Заряд батареї" value={status.batteryCharge} unit="%" icon={Battery}
                          color="bg-emerald-500"/>
                <StatCard title="Ефективність MPPT-контролера" value={status.mpptEfficiency} unit="%" icon={TrendingUp}
                          color="bg-indigo-500"/>
            </div>
            <IngestorCard data={ingestorInfo} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div
                    className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-transform hover:scale-[1.01]">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">Генерація vs Споживання енергії</h2>
                        <NavLink to="/Monitoring_Monastyrnyi/analytics/production">
                            <ArrowBigRightDashIcon
                                className="cursor-pointer text-orange-600 self-end border rounded-lg hover:bg-emerald-500 hover:text-slate-800 transition-transform hover:scale-110"
                                size={24}/>
                        </NavLink>

                    </div>

                    <div className="h-75 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="time" tick={{fill: '#94a3b8', fontSize: 10}} minTickGap={60}/>
                                <YAxis tick={{fill: '#94a3b8', fontSize: 12}}/>
                                <Tooltip contentStyle={{
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}/>
                                <Legend verticalAlign="bottom" height={36} iconType="circle" onClick={toggleKey}/>
                                <Area hide={hiddenKeys['consumption']}
                                      isAnimationActive={false}
                                      type="monotone"
                                      dataKey="consumption"
                                      stroke="#f43f5e"
                                      fillOpacity={0}
                                      fill="#f43f5e"
                                      strokeWidth={3}
                                      name="Споживання (Вт)"/>
                                <Area hide={hiddenKeys['solar']}
                                      isAnimationActive={false}
                                      type="monotone"
                                      dataKey="solar"
                                      stroke="#f59e0b"
                                      fillOpacity={0}
                                      fill="#f59e0b"
                                      strokeWidth={3}
                                      name="Сонячна генерація (Вт)"/>
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div
                    className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-8">
                    <Gauge size={80} className="text-indigo-500"/>
                    <div className="text-center">
                        <p className="text-slate-400 font-bold uppercase text-[10px]">Напруга в системі</p>
                        <h2 className="text-5xl font-black text-slate-800">{status.dischargeV.toFixed(1)} В</h2>
                        <p className="text-slate-400 font-medium">{status.dischargeA.toFixed(2)} A (струм)</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="transition-transform hover:scale-[1.02]">
                    <VAGraph title="Сонячні панелі" icon="☀️" data={history} vKey="solar_v" iKey="solar_i" vColor="#f59e0b"
                             iColor="#10b981" onClickMoveTo='/Monitoring_Monastyrnyi/analytics/solar'/>
                </div>
                <div className="transition-transform hover:scale-[1.02]">
                    <VAGraph title="MPPT" icon="🔋" data={history} vKey="charge_v" iKey="charge_i" vColor="#3b82f6"
                             iColor="#8b5cf6" onClickMoveTo='/Monitoring_Monastyrnyi/analytics/charge'/>
                </div>
                <div className="transition-transform hover:scale-[1.02]">
                    <VAGraph title="Споживання" icon="⚡" data={history} vKey="discharge_v" iKey="discharge_i" vColor="#ef4444"
                             iColor="#6366f1" onClickMoveTo='/Monitoring_Monastyrnyi/analytics/discharge'/>
                </div>
            </div>

            <section className="space-y-4 pb-8">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity size={24} className="text-indigo-600"/> Пристрої в системі
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {devices.map((device: ConsumerDevice) => (<ConsumerCard key={device.id} device={device} />))}
                </div>
            </section>

            <footer className="pt-8 border-t border-slate-200">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Симуляція ESP32</h3>
                        <p className="text-slate-500 text-sm">Керування віртуальним генератором даних</p>
                    </div>
                    <button
                        onClick={onToggleSimulator}
                        disabled={isSimulatorPending}
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all active:scale-95 cursor-pointer shadow-lg ${
                            isSimulatorPending
                            ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                            : isSimulatorOn 
                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-100' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100'
                        }`}
                    >
                        <Zap size={20} className={isSimulatorOn || isSimulatorPending ? 'animate-pulse' : ''} />
                        {isSimulatorPending ? 'Обробка...' : isSimulatorOn ? 'Вимкнути симуляцію' : 'Увімкнути симуляцію'}
                    </button>
                </div>
            </footer>
        </div>
    );
};