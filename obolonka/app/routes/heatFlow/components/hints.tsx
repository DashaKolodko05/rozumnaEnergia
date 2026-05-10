import { useEdges, useNodes } from '@xyflow/react';

export function EmptyCanvasHint() {
    const nodes = useNodes();

    if (nodes.length > 0) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-100/40 via-transparent to-transparent" />

            <div className="relative flex flex-col items-center gap-6 max-w-[320px] animate-in fade-in duration-1000">

                <div className="relative">

                    <div className="relative w-20 h-20 backdrop-blur-sm rounded-3xl border border-slate-200 flex items-center justify-center shadow-m animate-pulse">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-slate-400">
                            <rect width="18" height="18" x="3" y="3" rx="3" strokeDasharray="4 3" />
                            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
                        </svg>
                    </div>
                </div>

                <div className="text-center space-y-3">
                    <h3 className="text-slate-500 font-bold text-xs tracking-[0.25em] uppercase opacity-80">
                        Canvas Ready
                    </h3>
                    <div className="space-y-1">
                        <p className="text-slate-400 text-sm font-medium">
                            Drag & drop nodes to begin
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SelectionHint() {
    const edges = useEdges();
    const nodes = useNodes();

    const selectedEdges = edges.filter((e) => e.selected);
    const selectedNodes = nodes.filter((n) => n.selected);
    const hasSelection = selectedEdges.length > 0 || selectedNodes.length > 0;

    const selectedCount = selectedEdges.length + selectedNodes.length;
    const isMultiple = selectedCount > 1;

    return (
        <div
            className={`
                fixed bottom-4 right-4 z-[1000] pointer-events-none select-none
                transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${hasSelection
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-4 scale-90'}
            `}
        >
            <div className="bg-white/80 backdrop-blur-md text-gray-900 px-3 py-1.5 rounded-full shadow-lg border border-gray-200 flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                    {/* Delete key */}
                    <kbd className="min-w-[20px] px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-medium text-gray-900 shadow-sm">
                        Del
                    </kbd>

                    <span className="text-gray-400 text-[10px]">/</span>

                    {/* Backspace key */}
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-medium text-gray-900 shadow-sm flex items-center justify-center">
                        <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                            <line x1="18" y1="9" x2="12" y2="15" />
                            <line x1="12" y1="9" x2="18" y2="15" />
                        </svg>
                    </kbd>

                    <span className="text-gray-700 ml-0.5 font-medium">
                        щоб видалити {isMultiple ? `${selectedCount} елементів` :
                                   selectedNodes.length === 1 ? 'ноду' :
                                   selectedEdges.length === 1 ? 'ребро' : 'елемент'}
                    </span>
                </div>
            </div>
        </div>
    );
}
