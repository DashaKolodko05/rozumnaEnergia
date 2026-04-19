import React from 'react';
import { type AppNode, type NodeData } from './types';

interface ConfigFormProps {
    node: AppNode | null;
    onUpdate: (id: string, data: Partial<NodeData>) => void;
    onClose: () => void;
}

export function ConfigForm({ node, onUpdate, onClose }: ConfigFormProps) {
    const [formData, setFormData] = React.useState<NodeData | null>(null);

    React.useEffect(() => {
        if (node) {
            setFormData({ ...node.data });
        }
    }, [node]);

    if (!node) return null;

    const isHeat = node.type === 'heat';
    const accentColor = isHeat ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700';
    const ringColor = isHeat ? 'focus:ring-orange-500/20 focus:border-orange-500' : 'focus:ring-blue-500/20 focus:border-blue-500';
    const iconColor = isHeat ? 'text-orange-600' : 'text-blue-600';

    const handleChange = (field: keyof NodeData, value: any) => {
        setFormData(prev => prev ? ({
            ...prev,
            [field]: value
        }) : null);
    };

    const hasChanges = JSON.stringify(node.data) !== JSON.stringify(formData);

    const handleSave = () => {
        const updates: Partial<NodeData> = { label: formData?.label };
        if (isHeat && formData?.capacity !== '') {
            updates.capacity = Number(formData?.capacity);
        }
        onUpdate(node.id, updates);
        onClose();
    };

    // Скасування змін
    const handleCancel = () => {
        if (hasChanges) {
            if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-950/40 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">

                {/* Header with icon and title */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${isHeat ? 'bg-orange-100' : 'bg-blue-100'} flex items-center justify-center`}>
                            {isHeat ? (
                                <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            ) : (
                                <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                {isHeat ? 'Configure Heat Source' : 'Configure House'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {isHeat ? 'Adjust heat generation parameters' : 'Modify building properties'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div className="px-6 py-6 space-y-5">
                        {/* Label Field */}
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Display Name
                            </label>
                            <input
                                type="text"
                                className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl block px-4 py-2.5 outline-none transition-all focus:bg-white focus:ring-4 ${ringColor}`}
                                value={formData?.label || ''}
                                onChange={(e) => handleChange('label', e.target.value)}
                                placeholder="Enter display name"
                            />
                        </div>

                        {/* Capacity Field */}
                        {isHeat && (
                            <div className="space-y-2">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Capacity (kW)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl block px-4 py-2.5 outline-none transition-all focus:bg-white focus:ring-4 ${ringColor}`}
                                        value={formData?.capacity as number | string || ''}
                                        onChange={(e) => handleChange('capacity', e.target.value)}
                                        placeholder="Enter capacity in kW"
                                        step="0.1"
                                        min="0"
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <span className="text-gray-400 text-xs">kW</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    Thermal power output capacity
                                </p>
                            </div>
                        )}

                        {/* Read-only info fields */}
                        <div className="pt-2 space-y-3 border-t border-gray-100">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Node ID</span>
                                <span className="font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">
                                    {node.id.slice(0, 8)}...
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Node Type</span>
                                <span className={`font-medium ${isHeat ? 'text-orange-600' : 'text-blue-600'}`}>
                                    {isHeat ? 'Heat Source' : 'House'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer with buttons */}
                    <div className="flex gap-3 px-6 py-5 bg-gray-50 rounded-b-2xl border-t border-gray-100">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex-1 text-gray-700 font-medium rounded-xl text-sm px-4 py-2.5 transition-all hover:bg-gray-200 active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!hasChanges}
                            className={`flex-1 text-white font-medium rounded-xl text-sm px-4 py-2.5 shadow-sm transition-all active:scale-95 ${hasChanges
                                    ? `${accentColor} cursor-pointer`
                                    : 'bg-gray-400 cursor-not-allowed'
                                }`}
                        >
                            Save Changes
                        </button>
                    </div>

                    {hasChanges && (
                        <div className="px-6 pb-4">
                            <p className="text-xs text-orange-600 flex items-center gap-1">
                                <span>●</span> You have unsaved changes
                            </p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
