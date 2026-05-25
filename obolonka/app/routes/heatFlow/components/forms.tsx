import React from 'react';
import { isHeatPump, isHouseNode, isTankNode, type AppNode, type NodeData } from '../types/types';

interface ConfigFormProps {
    node: AppNode | null;
    onUpdate: (id: string, data: Partial<NodeData>) => void;
    onClose: () => void;
}

export function ConfigForm({ node, onUpdate, onClose }: ConfigFormProps) {
    const [formData, setFormData] = React.useState<NodeData | null>(null);
    const [isOpen, setIsOpen] = React.useState(false);


    React.useEffect(() => {
        if (node) {
            console.log('ConfigForm Data:', {
                id: node.id,
                type: node.type,
                data: node.data
            });
            setFormData({ ...node.data });
            setTimeout(() => setIsOpen(true), 10);
        } else {
            setIsOpen(false);
        }
    }, [node]);

    if (!node || !formData) return null;

    const isHeat = isHeatPump(node as any) || node.type === 'heatPump';
    const isTank = isTankNode(node as any) || node.type === 'tank';
    const isHouse = isHouseNode(node as any) || node.type === 'house';

    console.log('ConfigForm Data Raw:', {
        id: node.id,
        data: node.data,
        type: node.type
    });

    console.log('Node Type Check:', {
        isHeat,
        isTank,
        isHouse,
        computedType: isHeat ? 'HEAT' : isTank ? 'TANK' : isHouse ? 'HOUSE' : 'UNKNOWN'
    });


    const handleChange = (field: string, value: any, nestedField?: string) => {
        console.log(` Input Change: [${field}]${nestedField ? '.' + nestedField : ''} ->`, value);

        setFormData(prev => {
            if (!prev) return null;
            let newData;
            if (nestedField) {
                newData = {
                    ...prev,
                    [field]: { ...((prev as any)[field] || {}), [nestedField]: value }
                };
            } else {
                newData = { ...prev, [field]: value };
            }

            // Логуємо стан після оновлення для перевірки імутабельності
            console.log(' New Form State:', newData);
            return newData as NodeData;
        });
    };

    const hasChanges = JSON.stringify(node.data) !== JSON.stringify(formData);

    const handleSave = () => {
        console.log(' Saving Data:', {
            nodeId: node.id,
            payload: formData
        });

        if (Object.keys(formData).length === 0) {
            console.error(' CRITICAL: Attempting to save empty formData!');
            return;
        }

        onUpdate(node.id, formData);
        handleClose();
    };

    const handleClose = () => {
        console.log('Closing Form');
        setIsOpen(false);
        setTimeout(() => onClose(), 200);
    };

    const handleCancel = () => {
        if (hasChanges && !confirm('You have unsaved changes. Are you sure?')) return;
        handleClose();
    };

    const accentColor = isHeat ? 'from-orange-500 to-orange-600' : isTank ? 'from-emerald-500 to-emerald-600' : 'from-blue-500 to-blue-600';
    const ringColor = isHeat ? 'focus:ring-orange-500/20 focus:border-orange-500' : isTank ? 'focus:ring-emerald-500/20 focus:border-emerald-500' : 'focus:ring-blue-500/20 focus:border-blue-500';
    const iconColor = isHeat ? 'text-orange-600' : isTank ? 'text-emerald-600' : 'text-blue-600';
    const iconBg = isHeat ? 'bg-orange-100' : isTank ? 'bg-emerald-100' : 'bg-blue-100';


    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 transition-opacity duration-200"
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(8px)',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none'
            }}
            onClick={handleCancel}
        >
            <div
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl transition-all duration-250"
                style={{
                    transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
                    opacity: isOpen ? 1 : 0,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
                            {isHeat ? (
                                <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            ) : isTank ? (
                                <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {/* Tank Body */}
                                    <rect x="6" y="3" width="12" height="18" rx="2" strokeWidth={2} />
                                    {/* Liquid level or internal coil */}
                                    <path strokeLinecap="round" strokeWidth={2} d="M6 15h12M9 7h6M9 11h6" />
                                </svg>
                            ) : (
                                <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                {isHeat ? 'Джерлло тепла' : isTank ? 'Водяний бак' : 'Будинок'} Конфігурація
                            </h3>
                        </div>
                    </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex flex-col h-full max-h-[70vh]">
                    <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
                        {/* Display Name */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Назва</label>
                            <input
                                type="text"
                                className={`w-full bg-gray-50 border border-gray-200 text-sm rounded-xl px-4 py-2.5 outline-none transition-all focus:bg-white focus:ring-4 ${ringColor}`}
                                value={formData.label || ''}
                                onChange={(e) => handleChange('label', e.target.value)}
                            />
                        </div>

                        {isHeat && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                                    <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">
                                        Технічні характеристики теплового насоса
                                    </h4>
                                </div>

                                <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                                    <table className="w-full text-left border-collapse bg-white">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-10">№</th>
                                                <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Назва величини</th>
                                                <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-24">Позначення</th>
                                                <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-32">Значення</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {/* Рядок 1: Теплова потужність */}
                                            <tr>
                                                <td className="px-3 py-2.5 text-xs text-gray-500 text-center">1</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">
                                                    Номінальна теплова потужність при COP 2/35 (кВт)
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-orange-600 font-bold">
                                                    Q_COP
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full bg-orange-50/30 border border-orange-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-500 transition-colors"
                                                        value={(formData as any).pumpParams?.qCop235 || ''}
                                                        onChange={(e) => handleChange('pumpParams', Number(e.target.value), 'qCop235')}
                                                    />
                                                </td>
                                            </tr>

                                            {/* Рядок 2: COP */}
                                            <tr>
                                                <td className="px-3 py-2.5 text-xs text-gray-500 text-center">2</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">
                                                    Коефіцієнт перетворення енергії
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-orange-600 font-bold">
                                                    COP
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full bg-orange-50/30 border border-orange-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-500 transition-colors"
                                                        value={(formData as any).pumpParams?.cop235 || ''}
                                                        onChange={(e) => handleChange('pumpParams', Number(e.target.value), 'cop235')}
                                                    />
                                                </td>
                                            </tr>

                                            {/* Рядок 3: Електрична потужність */}
                                            <tr>
                                                <td className="px-3 py-2.5 text-xs text-gray-500 text-center">3</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">
                                                    Електрична потужність (кВт)
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-orange-600 font-bold">
                                                    P_el
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full bg-orange-50/30 border border-orange-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-orange-500 transition-colors"
                                                        value={(formData as any).pumpParams?.electricPower || ''}
                                                        onChange={(e) => handleChange('pumpParams', Number(e.target.value), 'electricPower')}
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {isTank && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                    <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">
                                        Характеристики теплоакумулюючого бака
                                    </h4>
                                </div>

                                <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                                    <table className="w-full text-left border-collapse bg-white">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-10 text-center">№</th>
                                                <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Назва величини</th>
                                                <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-24">Позн.</th>
                                                <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-32">Значення</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {/* Рядок 4: Об'єм */}
                                            <tr>
                                                <td className="px-3 py-2.5 text-xs text-gray-500 text-center">4</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">
                                                    Об'єм води в баку (л)
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-emerald-600 font-bold">
                                                    V_tank
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        className="w-full bg-emerald-50/30 border border-emerald-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-500 transition-colors"
                                                        value={(formData as any).vTank || ''}
                                                        onChange={(e) => handleChange('vTank', Number(e.target.value))}
                                                    />
                                                </td>
                                            </tr>

                                            {/* Рядок 5: Коефіцієнт тепловтрат */}
                                            <tr>
                                                <td className="px-3 py-2.5 text-xs text-gray-500 text-center">5</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">
                                                    Коефіцієнт тепловтрат баку на 1℃ (кВт·год/℃)
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-emerald-600 font-bold">
                                                    K_lost tank
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        className="w-full bg-emerald-50/30 border border-emerald-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-500 transition-colors"
                                                        value={(formData as any).kLostTank || ''}
                                                        onChange={(e) => handleChange('kLostTank', Number(e.target.value))}
                                                    />
                                                </td>
                                            </tr>

                                            {/* Рядок 6: Номінальна температура */}
                                            <tr>
                                                <td className="px-3 py-2.5 text-xs text-gray-500 text-center">6</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">
                                                    Номінальна температура води в баку (℃)
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-emerald-600 font-bold">
                                                    t_water
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        className="w-full bg-emerald-50/30 border border-emerald-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-500 transition-colors"
                                                        value={(formData as any).tWaterNorm || ''}
                                                        onChange={(e) => handleChange('tWaterNorm', Number(e.target.value))}
                                                    />
                                                </td>
                                            </tr>

                                            {/* Рядок 7: Delta Max */}
                                            <tr>
                                                <td className="px-3 py-2.5 text-xs text-gray-500 text-center">7</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">
                                                    Максимальне позитивне відхилення температури (℃)
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-emerald-600 font-bold">
                                                    Delta_max
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        className="w-full bg-emerald-50/30 border border-emerald-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-500 transition-colors"
                                                        value={(formData as any).deltaMax || ''}
                                                        onChange={(e) => handleChange('deltaMax', Number(e.target.value))}
                                                    />
                                                </td>
                                            </tr>

                                            {/* Рядок 8: Delta Min */}
                                            <tr>
                                                <td className="px-3 py-2.5 text-xs text-gray-500 text-center">8</td>
                                                <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">
                                                    Максимальне негативне відхилення температури (℃)
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-mono text-emerald-600 font-bold">
                                                    Delta_min
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="number"
                                                        className="w-full bg-emerald-50/30 border border-emerald-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-500 transition-colors"
                                                        value={(formData as any).deltaMin || ''}
                                                        onChange={(e) => handleChange('deltaMin', Number(e.target.value))}
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {isHouse && (
                            <div className="space-y-6">
                                {/* Секція Трубопроводу */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                        <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">
                                            Параметри циркуляційної труби
                                        </h4>
                                    </div>

                                    <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                                        <table className="w-full text-left border-collapse bg-white">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-10 text-center">№</th>
                                                    <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Назва величини</th>
                                                    <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-24">Позн.</th>
                                                    <th className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase w-32">Значення</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {/* Рядок 9: Довжина */}
                                                <tr>
                                                    <td className="px-3 py-2.5 text-xs text-gray-500 text-center">9</td>
                                                    <td className="px-3 py-2.5 text-xs text-gray-700 font-medium">Довжина труби (м)</td>
                                                    <td className="px-3 py-2.5 text-xs font-mono text-blue-600 font-bold">L_pipe</td>
                                                    <td className="px-3 py-2.5">
                                                        <input type="number" className="w-full bg-blue-50/30 border border-blue-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500 transition-colors"
                                                            value={(formData as any).lPipe || ''} onChange={(e) => handleChange('lPipe', Number(e.target.value))} />
                                                    </td>
                                                </tr>
                                                {/* Рядок 10: Діаметр */}
                                                <tr>
                                                    <td className="px-3 py-2.5 text-xs text-gray-500 text-center">10</td>
                                                    <td className="px-3 py-2.5 text-xs text-gray-700 font-medium">Зовнішній діаметр труби (м)</td>
                                                    <td className="px-3 py-2.5 text-xs font-mono text-blue-600 font-bold">D_out_pipe</td>
                                                    <td className="px-3 py-2.5">
                                                        <input type="number" step="0.001" className="w-full bg-blue-50/30 border border-blue-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500 transition-colors"
                                                            value={(formData as any).dOutPipe || ''} onChange={(e) => handleChange('dOutPipe', Number(e.target.value))} />
                                                    </td>
                                                </tr>
                                                {/* Рядок 11: Стінка */}
                                                <tr>
                                                    <td className="px-3 py-2.5 text-xs text-gray-500 text-center">11</td>
                                                    <td className="px-3 py-2.5 text-xs text-gray-700 font-medium">Товщина стінки труби (м)</td>
                                                    <td className="px-3 py-2.5 text-xs font-mono text-blue-600 font-bold">S_wall_pipe</td>
                                                    <td className="px-3 py-2.5">
                                                        <input type="number" step="0.001" className="w-full bg-blue-50/30 border border-blue-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500 transition-colors"
                                                            value={(formData as any).sWallPipe || ''} onChange={(e) => handleChange('sWallPipe', Number(e.target.value))} />
                                                    </td>
                                                </tr>
                                                {/* Рядок 12: Теплопровідність */}
                                                <tr>
                                                    <td className="px-3 py-2.5 text-xs text-gray-500 text-center">12</td>
                                                    <td className="px-3 py-2.5 text-xs text-gray-700 font-medium leading-tight">Коефіцієнт теплопроводності матеріалу</td>
                                                    <td className="px-3 py-2.5 text-xs font-mono text-blue-600 font-bold">K_thermal</td>
                                                    <td className="px-3 py-2.5">
                                                        <input type="number" step="0.01" className="w-full bg-blue-50/30 border border-blue-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500 transition-colors"
                                                            value={(formData as any).kThermalPipe || ''} onChange={(e) => handleChange('kThermalPipe', Number(e.target.value))} />
                                                    </td>
                                                </tr>
                                                {/* Рядок 13: Ступінь чорноти */}
                                                <tr>
                                                    <td className="px-3 py-2.5 text-xs text-gray-500 text-center">13</td>
                                                    <td className="px-3 py-2.5 text-xs text-gray-700 font-medium">Ступінь чорноти поверхні</td>
                                                    <td className="px-3 py-2.5 text-xs font-mono text-blue-600 font-bold">epsilon_pipe</td>
                                                    <td className="px-3 py-2.5">
                                                        <input type="number" step="0.01" className="w-full bg-blue-50/30 border border-blue-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500 transition-colors"
                                                            value={(formData as any).epsilonPipe || ''} onChange={(e) => handleChange('epsilonPipe', Number(e.target.value))} />
                                                    </td>
                                                </tr>
                                                {/* Рядок 14: Швидкість */}
                                                <tr>
                                                    <td className="px-3 py-2.5 text-xs text-gray-500 text-center">14</td>
                                                    <td className="px-3 py-2.5 text-xs text-gray-700 font-medium">Швидкість потоку води (м/год)</td>
                                                    <td className="px-3 py-2.5 text-xs font-mono text-blue-600 font-bold">V_flow</td>
                                                    <td className="px-3 py-2.5">
                                                        <input type="number" step="0.1" className="w-full bg-blue-50/30 border border-blue-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-blue-500 transition-colors"
                                                            value={(formData as any).vFlowPipe || ''} onChange={(e) => handleChange('vFlowPipe', Number(e.target.value))} />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Секція Температур */}
                                <div className="space-y-4 mt-6">
                                    <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">
                                        Температурні умови
                                    </h4>
                                    <div className="overflow-hidden border border-gray-200 rounded-xl">
                                        <table className="w-full text-left bg-white">
                                            <tbody className="divide-y divide-gray-100">
                                                <tr>
                                                    <td className="px-3 py-2 text-xs text-gray-500 w-10 text-center">15</td>
                                                    <td className="px-3 py-2 text-xs text-gray-700">Температура повітря (℃)</td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            className="w-full bg-sky-50/30 border border-sky-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-sky-500"
                                                            value={(formData as any).tOutside ?? ''}
                                                            onChange={(e) => handleChange('tOutside', Number(e.target.value))}
                                                        />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-2 text-xs text-gray-500 text-center">16</td>
                                                    <td className="px-3 py-2 text-xs text-gray-700">Температура хол. води (℃)</td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            className="w-full bg-sky-50/30 border border-sky-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-sky-500"
                                                            value={(formData as any).tWaterCold ?? ''}
                                                            onChange={(e) => handleChange('tWaterCold', Number(e.target.value))}
                                                        />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-2 text-xs text-gray-500 text-center">17</td>
                                                    <td className="px-3 py-2 text-xs text-gray-700">Температура підвалу (℃)</td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            className="w-full bg-sky-50/30 border border-sky-100 rounded-lg px-2 py-1 text-sm outline-none focus:border-sky-500"
                                                            value={(formData as any).tBasement ?? ''}
                                                            onChange={(e) => handleChange('tBasement', Number(e.target.value))}
                                                        />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 px-6 py-5 bg-gray-50 rounded-b-2xl border-t border-gray-100">
                        <button type="button" onClick={handleCancel} className="flex-1 text-gray-700 font-medium rounded-xl text-sm px-4 py-2.5 hover:bg-gray-200 transition-all">
                            Відмінити
                        </button>
                        <button
                            type="submit"
                            disabled={!hasChanges}
                            className={`flex-1 text-white font-medium rounded-xl text-sm px-4 py-2.5 transition-all ${hasChanges ? `bg-gradient-to-r ${accentColor} shadow-md active:scale-95` : 'bg-gray-400 opacity-60 cursor-not-allowed'}`}
                        >
                            Зберегти зміни
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
