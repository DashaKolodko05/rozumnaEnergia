import { useState, useEffect } from 'react';
import { NavLink } from "react-router";
import { ArrowLeft, RefreshCw, Calendar, Settings2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {HISTORY_API_URL} from "../local_consts"

const ComparisonPage = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Стандартний діапазон - останні 24 год
    const now = new Date(Date.now() + 3*60*60*1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000 + 3*60*60*1000);
    
    const [startTime, setStartTime] = useState(yesterday.toISOString().slice(0, 16));
    const [endTime, setEndTime] = useState(now.toISOString().slice(0, 16));
    
    const [selectedParams, setSelectedParams] = useState(['solar_p', 'discharge_p']);

    const isInvalidRange = new Date(startTime) >= new Date(endTime);

    const availableParams = [
        { id: 'solar_p', name: 'Згенерована сонячна енергія (Вт)', color: '#f59e0b' },
        { id: 'discharge_p', name: 'Споживана енергія (Вт)', color: '#f43f5e' },
        { id: 'solar_v', name: 'Напргуга сонячних панелей (В)', color: '#10b981' },
        { id: 'solar_i', name: 'Струм сонячних панелей (A)', color: '#3b82f6' },
        { id: 'battery_charge', name: 'Заряд батареї (%)', color: '#5c3ca1' },
        { id: 'charge_v', name: 'Напруга від MPTT-Контролера/Напруга батареї (В)', color: '#8b5cf6' },
        { id: 'charge_i', name: 'Струм від MPTT-Контролера (A)', color: '#6366f1' },
        { id: 'discharge_v', name: 'Загальна напруга споживачів (В)', color: '#ef4444' },
        { id: 'discharge_i', name: 'Загальний струм споживачів (A)', color: '#ec4899' },

        { id: 'dev1_v', name: 'Напруга приладу 1 (В)', color: '#cc243e' },
        { id: 'dev1_i', name: 'Струм приладу 1 (A)', color: '#800a1e' },
        { id: 'dev1_p', name: 'Потужність приладу 1 (Вт)', color: '#802e4e' },

        { id: 'dev2_v', name: 'Напруга приладу 2 (В)', color: '#3082d9' },
        { id: 'dev2_i', name: 'Струм приладу 2 (A)', color: '#040c93' },
        { id: 'dev2_p', name: 'Потужність приладу 2 (Вт)', color: '#82acd0' },

        { id: 'dev3_v', name: 'Напруга приладу 3 (В)', color: '#97c435' },
        { id: 'dev3_i', name: 'Струм приладу 3 (A)', color: '#5e7e04' },
        { id: 'dev3_p', name: 'Потужність приладу 3 (Вт)', color: '#dce78a' },
    ];

    const fetchData = () => {
        setLoading(true);
        setError(null);
        const startIso = new Date(startTime).toISOString();
        const endIso = new Date(endTime).toISOString();

        // Динамічне обчислення розміру вікна на основі тривалості періоду
        const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
        let window = '';
        if (durationMs <= 2 * 60 * 1000) window = '5s';
        else if (durationMs <= 10 * 60 * 1000) window = '20s';
        else if (durationMs <= 20 * 60 * 1000) window = '30s';
        else if (durationMs <= 30 * 60 * 1000) window = '1m';
        else if (durationMs <= 60 * 60 * 1000) window = '1m20s';
        else if (durationMs <= 4 * 60 * 60 * 1000) window = '10m';
        else if (durationMs <= 8 * 60 * 60 * 1000) window = '20m';
        else if (durationMs <= 16 * 60 * 60 * 1000) window = '40m';
        else if (durationMs <= 24 * 60 * 60 * 1000) window = '50m';
        else if (durationMs <= 3 * 24 * 60 * 60 * 1000) window = '2h';
        else if (durationMs <= 7 * 24 * 60 * 60 * 1000) window = '5h';
        else if (durationMs <= 15 * 24 * 60 * 60 * 1000) window = '9h';
        else if (durationMs <= 30 * 24 * 60 * 60 * 1000) window = '1d';
        else if (durationMs <= 6 * 30 * 24 * 60 * 60 * 1000) window = '5d';
        else if (durationMs <= 365 * 24 * 60 * 60 * 1000) window = '10d';
        else window = "1mo"

        let url = `${HISTORY_API_URL}?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}&window=${window}`;
        if(durationMs >= 24 * 60 * 60 * 1000)
            url += "&offset=10h"

        const MAX_COMPARISON_POINTS = 150;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('Сталася помилка під час отримання даних. Перевірте роботу сервера');
                return res.json();
            })
            .then(json => {
                const processedData = json.map((d: any) => ({
                    ...d,
                    displayTime: new Date(d.time).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'UTC',
                    })
                }));
                setData(processedData.slice(-MAX_COMPARISON_POINTS));
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setError(err.message || 'Сталася помилка під час отримання даних. Перевірте роботу сервера');
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleParam = (id: string) => {
        setSelectedParams(prev => {
            if (prev.includes(id)) {
                return prev.filter(p => p !== id);
            }
            if (prev.length < 2) {
                return [...prev, id];
            }
            // Якщо вже обрано 2 параметри, то замінити останній
            return [prev[0], id];
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <NavLink to="/Monitoring_Monastyrnyi/" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors">
                    <ArrowLeft size={20} /> Повернутися назад
                </NavLink>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Панель контролю */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 text-slate-800 font-bold">
                                <Settings2 size={20} className="text-indigo-600" />
                                <h3>Параметри</h3>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {availableParams.map(param => (
                                    <button
                                        key={param.id}
                                        onClick={() => toggleParam(param.id)}
                                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                                            selectedParams.includes(param.id)
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                : 'bg-white border-transparent text-slate-500 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{param.name}</span>
                                            {selectedParams.includes(param.id) && (
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: param.color }} />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 space-y-4">
                                <div className="flex items-center gap-2 text-slate-800 font-bold">
                                    <Calendar size={20} className="text-indigo-600" />
                                    <h3>Обрати часовий проміжок</h3>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Початок</label>
                                        <input
                                            type="datetime-local"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-100 border-none text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Кінець</label>
                                        <input
                                            type="datetime-local"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-100 border-none text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={fetchData}
                                        disabled={loading || isInvalidRange}
                                        title={isInvalidRange ? "Дата/час початку має бути раніше, ніж дата/час кінця" : ""}
                                        className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                                            isInvalidRange 
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                                            : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 active:scale-95'
                                        }`}
                                    >
                                        {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Оновити діаграму'}
                                    </button>
                                    {isInvalidRange && (
                                        <p className="text-[10px] text-red-500 font-bold text-center mt-1">
                                            Дата/час початку має бути раніше, ніж дата/час кінця
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Панель діаграми */}
                    <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm relative min-h-[500px]">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-3xl">
                                <RefreshCw className="animate-spin text-indigo-600" size={32} />
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-slate-800">Огляд і порівняння параметрів</h2>
                            <div className="flex gap-4">
                                {selectedParams.map(paramId => {
                                    const p = availableParams.find(ap => ap.id === paramId);
                                    return (
                                        <div key={paramId} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p?.color }} />
                                            <span className="text-xs font-bold text-slate-500">{p?.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="h-[400px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="displayTime"
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        minTickGap={50}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                    />
                                    {selectedParams.length > 1 && (
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            domain={['auto', 'auto']}
                                        />
                                    )}
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '15px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Legend />
                                    {selectedParams.map((paramId, index) => {
                                        const p = availableParams.find(ap => ap.id === paramId);
                                        return (
                                            <Line
                                                key={paramId}
                                                yAxisId={index === 0 ? "left" : "right"}
                                                type="monotone"
                                                dataKey={paramId}
                                                name={p?.name}
                                                stroke={p?.color}
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                                animationDuration={500}
                                            />
                                        );
                                    })}
                                </LineChart>
                            </ResponsiveContainer>
                            
                            {error && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-red-500 bg-white/80 backdrop-blur-sm rounded-xl text-center p-4">
                                    <p className="font-bold text-lg mb-2">Сталася помилка під час завантаження даних. Перевірте сервер!</p>
                                    <p className="text-sm">{error}</p>
                                </div>
                            )}

                            {data.length === 0 && !loading && !error && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl">
                                    <Calendar size={48} strokeWidth={1} />
                                    <p className="font-medium">Не знайдено даних для заданого періоду. Спробуйте змінити часові межі</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComparisonPage;
