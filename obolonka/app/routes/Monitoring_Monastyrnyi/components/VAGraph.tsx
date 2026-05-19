import React, {useState} from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {ArrowBigRightDashIcon} from "lucide-react"
import { NavLink } from "react-router";

interface VAGraphProps {
    title: string;
    data: any[];
    vKey: string; // ключ для напруги (V)
    iKey: string; // ключ для струму (A)
    vColor: string;
    iColor: string;
    icon: string;
    onClickMoveTo: string;
}

const VAGraph: React.FC<VAGraphProps> = ({ title, data, vKey, iKey, vColor, iColor, icon, onClickMoveTo }) => {
    const [hiddenKeys, setHiddenKeys] = useState<Record<string, boolean>>({});
    data = data.map(d => ({
        ...d,
        [vKey]: d[vKey] ?? 0,
        [iKey]: d[iKey] ?? 0
    }));
    const toggleKey = (e: any) => {
        const { dataKey } = e;
        setHiddenKeys(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 w-full flex flex-col items-center">
            <div className="flex items-center gap-2 mb-6 w-full justify-between">
                <div className="flex items-center gap-2 justify-start">
                    <span className="text-xl">{icon}</span>
                    <h3 className="text-xl font-bold text-slate-800">{title}: В & A</h3>
                </div>
                <NavLink to={onClickMoveTo} >
                    <ArrowBigRightDashIcon className="cursor-pointer text-indigo-500 self-end border rounded-lg hover:bg-blue-100 hover:text-rose-700 transition-transform hover:scale-110" size={24}/>
                </NavLink>
            </div>

            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{fill: '#94a3b8', fontSize: 10}}
                            minTickGap={30}
                        />

                        {/* Права вісь для Струму (A) — адаптивна */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{fill: iColor, fontSize: 10, fontWeight: 'bold'}}
                            domain={['auto', 'auto']} // Автоматичний масштаб навколо значень
                            width={35}
                        />


                        {/* Ліва вісь для Напруги (V) — адаптивна */}
                        <YAxis
                            yAxisId="left"
                            orientation="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{fill: vColor, fontSize: 10, fontWeight: 'bold'}}
                            domain={['auto', 'auto']}
                            width={35}
                        />

                        <Tooltip
                            contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" onClick={toggleKey} />

                        <Area
                            hide={hiddenKeys[vKey]}
                            yAxisId="left" // Прив'язка до лівої осі
                            type="monotone"
                            dataKey={vKey}
                            name="Напруга (В)"
                            stroke={vColor}
                            strokeWidth={3}
                            fillOpacity={0}
                            fill="none"
                            connectNulls={true}
                            animationDuration={500}
                        />
                        <Area
                            hide={hiddenKeys[iKey]}
                            yAxisId="right" // Прив'язка до правої осі
                            type="monotone"
                            dataKey={iKey}
                            name="Струм (А)"
                            stroke={iColor}
                            strokeWidth={3}
                            fillOpacity={0}
                            fill="none"
                            connectNulls={true}
                            animationDuration={500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default VAGraph;