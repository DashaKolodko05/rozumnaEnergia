interface Stats {
    totalHouses: number;
    totalHeaters: number;
    totalConnections: number;
    connectedHouses: number;
}

interface Props {
    stats: Stats;
    onStartSimulation: () => void;
}

export const StatusBar: React.FC<Props> = ({ stats, onStartSimulation }) => {
    const progress = (stats.connectedHouses / (stats.totalHouses || 1)) * 100;
    const isComplete = stats.connectedHouses === stats.totalHouses;

    return (
        <div className="flex flex-wrap items-center justify-center gap-x-8 px-3 py-2 bg-white border-b border-gray-200 shadow-md shrink-0">

            {/* Button */}
            <button
                onClick={onStartSimulation}
                className="ml-4 flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6 py-2 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 group"
            >
                <span className="text-sm font-bold uppercase tracking-wider">
                    Запустити симуляцію
                </span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </button>

            <StatItem color="bg-blue-500" label="Ксть будинків" value={stats.totalHouses} />
            <StatItem color="bg-orange-500" label="Ксть джерел тепла" value={stats.totalHeaters} />
            <StatItem color="bg-gray-400" label="Ксть з'єднань" value={stats.totalConnections} />

            {/* Progress */}
            <div className="flex items-center gap-2 bg-gray-50 px-5 py-1 rounded-xl border border-gray-100 min-w-fit">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                    Статус підключення
                </span>

                <div className="flex items-baseline gap-1">
                    <span className={`text-base font-bold ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>
                        {stats.connectedHouses}
                    </span>
                    <span className="text-base text-gray-300">/</span>
                    <span className="text-base text-gray-500">{stats.totalHouses}</span>
                </div>

                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-500 transition-all duration-700"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

const StatItem: React.FC<{
    color: string;
    label: string;
    value: number;
}> = ({ color, label, value }) => (
    <div className="flex items-center gap-3 whitespace-nowrap">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-gray-500 uppercase text-[11px] tracking-wider">{label}</span>
        <span className="font-medium text-gray-900 text-base">{value}</span>
    </div>
);
