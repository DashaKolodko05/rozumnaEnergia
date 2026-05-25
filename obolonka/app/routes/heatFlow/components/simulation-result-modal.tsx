import React, { useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { exportToCSV, exportToJSON, exportToPDF, exportToTXT, exportToXLSX } from '../services/file-output';

// Тип даних для одного кроку симуляції
interface ChartDataPoint {
    time: number;
    vWater: number;
    qSource: number;
    qWaterHeating: number;
    deltaQTank: number;
    tTank: number;
    tPipeOut: number;
    qPipeLoss: number;
    qTankLoss: number;
    sourceOn: number;
    cop: number;
}

interface Props {
    isOpen: boolean;
    data: ChartDataPoint[] | null;
    onClose: () => void;
}

const SimulationResultsModal: React.FC<Props> = ({ isOpen, data, onClose }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-semibold text-gray-800">
                        Результати симуляції
                    </h2>


                    <div className="flex items-center gap-2 relative">

                        {/* Гамбургер */}
                        <button
                            onClick={() => setIsMenuOpen(prev => !prev)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        {/* Dropdown */}
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">

                                <button
                                    onClick={() => exportToJSON(data)}
                                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm transition"
                                >
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeWidth="2" d="M4 4h16v16H4z" />
                                        <path strokeWidth="2" d="M8 8h8M8 12h6M8 16h4" />
                                    </svg>
                                    Зберегти як JSON
                                </button>

                                <button
                                    onClick={() => exportToCSV(data ?? [])}
                                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm transition"
                                >
                                    <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeWidth="2" d="M4 4h16v16H4z" />
                                        <path strokeWidth="2" d="M4 9h16M9 4v16" />
                                    </svg>
                                    Зберегти як CSV
                                </button>

                                <button
                                    onClick={() => exportToTXT(data ?? [])}
                                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm transition"
                                >
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeWidth="2" d="M4 4h16v16H4z" />
                                        <path strokeWidth="2" d="M8 8h8M8 12h8M8 16h8" />
                                    </svg>
                                    Зберегти як TXT
                                </button>

                                <button
                                    onClick={() => exportToXLSX(data ?? [])}
                                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm transition"
                                >
                                    <svg
                                        className="w-4 h-4 text-green-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeWidth="2" d="M4 4h16v16H4z" />
                                        <path strokeWidth="2" d="M4 9h16M9 4v16" />
                                    </svg>

                                    Зберегти як XLSX

                                </button>

                                {/* DOES NOT WORK */}
                                {/* <button
                                    onClick={() => exportToPDF('simulation-results')}
                                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm transition"
                                >
                                    <svg
                                        className="w-4 h-4 text-blue-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeWidth="2" d="M4 4h16v16H4z" />
                                        <path strokeWidth="2" d="M8 8h8M8 12h8M8 16h8" />
                                    </svg>

                                    Зберегти як PDF
                                </button> */}


                                <div className="border-t" />

                                <button
                                    onClick={onClose}
                                    className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm"
                                >
                                    Закрити
                                </button>
                            </div>
                        )}

                        {/* Закрити */}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                        >
                            Закрити
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div id="simulation-results" className="bg-white text-black flex-1 overflow-y-auto px-6 py-6">
                    {!data ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">

                            {/* Spinner */}
                            <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />

                            <p className="text-sm">Завантаження результатів...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Витрати води */}
                            <ChartContainer title="Витрати води">
                                <div className="h-72">
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <YAxis label={{ value: "V (м³)", angle: -90, position: 'insideLeft' }} />
                                        <XAxis
                                            dataKey="time"
                                            label={{
                                                value: "t (години)",
                                                position: "insideBottom",
                                                offset: -5
                                            }}
                                        />
                                        <Legend wrapperStyle={{ bottom: -5 }} />
                                        <Tooltip />
                                        <Line dataKey="vWater" stroke="#3b82f6" dot={false} name="Обʼєм" />
                                    </LineChart>
                                </div>
                            </ChartContainer>

                            {/* Температури */}
                            <ChartContainer title="Температури">
                                <div className="h-72">
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <YAxis label={{ value: "T (°C)", angle: -90, position: 'insideLeft' }} />
                                        <XAxis
                                            dataKey="time"
                                            label={{
                                                value: "t (години)",
                                                position: "insideBottom",
                                                offset: -5
                                            }}
                                        />
                                        <Legend wrapperStyle={{ bottom: -5 }} />
                                        <Tooltip />
                                        <Line dataKey="tTank" stroke="#1053b9" dot={false} strokeWidth={2} name="T баку" />
                                        <Line dataKey="tPipeOut" stroke="#d46306" dot={false} strokeWidth={2} name="T труба" />
                                    </LineChart>
                                </div>
                            </ChartContainer>

                            {/* Теплові потоки */}
                            <ChartContainer title="Теплові потоки">
                                <div className="h-72">
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <YAxis label={{ value: "Q (кДж)", angle: -90, position: 'insideLeft' }} />
                                        <XAxis
                                            dataKey="time"
                                            label={{
                                                value: "t (години)",
                                                position: "insideBottom",
                                                offset: -5
                                            }}
                                        />
                                        <Legend wrapperStyle={{ bottom: -5 }} />
                                        <Tooltip />
                                        <Line dataKey="qSource" stroke="#f59e0b" dot={false} name="Джерело" />
                                        <Line dataKey="qWaterHeating" stroke="#ef4444" dot={false} name="Споживання" />
                                        <Line dataKey="deltaQTank" stroke="#3b82f6" dot={false} name="ΔQ баку" />
                                    </LineChart>
                                </div>
                            </ChartContainer>

                            {/* Втрати */}
                            <ChartContainer title="Теплові втрати">
                                <div className="h-72">
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <YAxis label={{ value: "Q (кДж)", angle: -90, position: 'insideLeft' }} />
                                        <XAxis
                                            dataKey="time"
                                            label={{
                                                value: "t (години)",
                                                position: "insideBottom",
                                                offset: -5
                                            }}
                                        />
                                        <Legend wrapperStyle={{ bottom: -5 }} />
                                        <Tooltip />
                                        <Line dataKey="qPipeLoss" stroke="#55a1f7" dot={false} name="Труба" />
                                        <Line dataKey="qTankLoss" stroke="#64748b" dot={false} name="Бак" />
                                    </LineChart>
                                </div>
                            </ChartContainer>

                            {/* Стан */}
                            <ChartContainer title="Стан джерела">
                                <div className="h-56">
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <YAxis domain={[0, 1]} ticks={[0, 1]} />
                                        <XAxis
                                            dataKey="time"
                                            label={{
                                                value: "t (години)",
                                                position: "insideBottom",
                                                offset: -5
                                            }}
                                        />
                                        <Legend wrapperStyle={{ bottom: -5 }} />
                                        <Tooltip />
                                        <Line dataKey="sourceOn" stroke="#22c55e" dot={false} strokeWidth={2} name="ON/OFF" />
                                    </LineChart>
                                </div>
                            </ChartContainer>

                            {/* COP */}
                            <ChartContainer title="COP теплового насоса">
                                <div className="h-56">
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <YAxis />
                                        <XAxis
                                            dataKey="time"
                                            label={{
                                                value: "t (години)",
                                                position: "insideBottom",
                                                offset: -5
                                            }}
                                        />
                                        <Legend wrapperStyle={{ bottom: -5 }} />
                                        <Tooltip />
                                        <Line dataKey="cop" stroke="#8b5cf6" dot={false} name="COP" />
                                    </LineChart>
                                </div>
                            </ChartContainer>

                        </div>
                    )}

                </div>
            </div>
        </div >
    );
};

// Допоміжний компонент для контейнера графіка
const ChartContainer: React.FC<{ title: string; children: React.ReactElement }> = ({ title, children }) => (
    <div className="bg-gray-50 p-4 rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wider">{title}</h3>
        <ResponsiveContainer width="100%" height={250}>
            {children}
        </ResponsiveContainer>
    </div>
);

export default SimulationResultsModal;
