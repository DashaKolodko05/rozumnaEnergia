import { useState, useEffect } from 'react';
import { useParams} from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { NavLink } from "react-router";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const AnalyticsPage = () => {
    const { type } = useParams();
    const [data, setData] = useState([]);
    const [range, setRange] = useState('1h');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hiddenKeys, setHiddenKeys] = useState<Record<string, boolean>>({});

    const toggleKey = (e: any) => {
        const { dataKey } = e;
        setHiddenKeys(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    };

    const configs: any = {
        solar: { title: 'Сонячна генерація', v: 'solar_v', i: 'solar_i', colorV: '#f59e0b', colorI: '#10b981' },
        charge: { title: 'Енергія на виході з MPPT ', v: 'charge_v', i: 'charge_i', colorV: '#3b82f6', colorI: '#8b5cf6' },
        discharge: { title: 'Загальне споживання в системі', v: 'discharge_v', i: 'discharge_i', colorV: '#ef4444', colorI: '#6366f1' },
        production: { title: 'Генерація vs споживання енергії', v: 'solar_p', i: 'discharge_p', colorV: '#f59e0b', colorI: '#f43f5e', vName: 'Сонячна енергія (Вт)', iName: 'Споживана енергія (Вт)', unitV: 'Вати (Вт)', unitI: 'Вати (Вт)' },
    };
    const config = configs[type || 'solar'];

    useEffect(() => {
        setLoading(true);
        setError(null);
        let url = '';
        if (range === 'last30') {
            url = `http://localhost:3000/api/history?limit=30`;
        } else {
            const win = range === '5m' ? '10s' :
                        range === '15m' ? '30s' :
                        range === '1h' ? '2m' :
                        range === '24h' ? '45m' :
                        range === '7d' ? '6h' :
                        range === '30d' ? '1d' : '1m';
            url = `http://localhost:3000/api/history?range=${range}&window=${win}`;
            if (range === "30d")
                url += "&offset=10h";
        }

        const MAX_ANALYTICS_POINTS = 100;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch data');
                return res.json();
            })
            .then(json => {
                const processedData = json.map((d: any) => {
                    const date = new Date(d.time);
                    return {
                        ...d,
                        displayTime: date.toLocaleString([], { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: (range === '5m' || range === '15m' || range === 'last30') ? '2-digit' : undefined,
                            day: (range.includes('d')) ? '2-digit' : undefined,
                            month: (range.includes('d')) ? '2-digit' : undefined
                        })
                    };
                });
                

                setData(processedData.slice(-MAX_ANALYTICS_POINTS));
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setError(err.message || 'Помилка отримання даних');
                setLoading(false);
            });
    }, [range, type]);

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <NavLink to="/Monitoring_Monastyrnyi/" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold">
                    <ArrowLeft size={20} /> Повернутися назад
                </NavLink>

                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-slate-800">
                            {config.title}
                            <span className="text-slate-500"> (збережені дані)</span>
                        </h2>
                        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
                            {[
                                { label: '5 хв', value: '5m' },
                                { label: '15 хв', value: '15m' },
                                { label: '1 год', value: '1h' },
                                { label: '24 год', value: '24h' },
                                { label: '7 дн', value: '7d' },
                                { label: '30 днів', value: '30d' }
                            ].map(r => (
                                <button key={r.value} onClick={() => setRange(r.value)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${range === r.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[450px] w-full relative">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                                <RefreshCw className="animate-spin text-indigo-600" size={32} />
                            </div>
                        )}

                        {error && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-red-500 bg-white/80 backdrop-blur-sm rounded-xl">
                                <p className="font-bold text-lg mb-2">Сталася помилка під час отримання даних. Перевірте роботу сервера</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        )}

                        {!loading && !error && data.length === 0 && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl">
                                <p className="font-bold text-lg">Немає даних</p>
                                <p className="text-sm">Спробуйте змінити часовий період</p>
                            </div>
                        )}

                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} accessibilityLayer>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="displayTime" tick={{fontSize: 10}} minTickGap={30} />
                                <YAxis 
                                    yAxisId="left" 
                                    tick={{fontSize: 10, fill: '#64748b'}} 
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['auto', 'auto']}
                                    label={{ value: config.unitV || 'Вольти', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b', fontWeight: 'bold' } }}
                                />
                                <YAxis 
                                    yAxisId="right" 
                                    orientation="right" 
                                    tick={{fontSize: 10, fill: '#64748b'}} 
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['auto', 'auto']}
                                    label={{ value: config.unitI || 'Ампери', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#64748b', fontWeight: 'bold' } }}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend onClick={toggleKey} verticalAlign="top" height={36}/>
                                <Area 
                                    hide={hiddenKeys[config.v]} 
                                    yAxisId="left" 
                                    type="monotone" 
                                    dataKey={config.v} 
                                    name={config.vName || "Напруга (В)"}
                                    stroke={config.colorV} 
                                    fill="none" 
                                    fillOpacity={0} 
                                    strokeWidth={3} 
                                    animationDuration={500}
                                    dot={{ r: 2, fill: config.colorV, strokeWidth: 0 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                                <Area 
                                    hide={hiddenKeys[config.i]} 
                                    yAxisId="right" 
                                    type="monotone" 
                                    dataKey={config.i} 
                                    name={config.iName || "Струм (А)"}
                                    stroke={config.colorI} 
                                    fill="none" 
                                    fillOpacity={0} 
                                    strokeWidth={3} 
                                    animationDuration={500}
                                    dot={{ r: 2, fill: config.colorI, strokeWidth: 0 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;