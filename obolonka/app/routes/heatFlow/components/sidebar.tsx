import '@xyflow/react/dist/style.css';
import React, { useState, useCallback, useEffect, type ReactElement } from 'react';

interface SidebarProps {
    width: number;
    minWidth: number;
    setWidth: (width: number) => void;
}

export function Sidebar({ width, minWidth, setWidth }: SidebarProps): ReactElement {
    const [isResizing, setIsResizing] = useState<boolean>(false);

    const startResizing = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback(
        (e: MouseEvent): void => {
            if (isResizing) {
                const newWidth = e.clientX;
                if (newWidth > minWidth && newWidth < 600) {
                    setWidth(newWidth);
                    localStorage.setItem('sidebar-width', newWidth.toString());
                }
            }
        },
        [isResizing, setWidth]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string): void => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside
            className="relative flex flex-col h-full border-r border-slate-200 bg-slate-50 transition-[width] duration-75"
            style={{ width: `${width}px`, minWidth: `${minWidth}px` }}
        >
            {/* Header */}
            <div className="px-5 py-6 flex items-center gap-2 select-none">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <h2 className="text-[11px] font-black uppercase tracking-[1.5px] text-slate-400">
                    Бібліотека вузлів
                </h2>
            </div>

            {/* Scrollable Container for Cards */}
            <div className="flex-1 px-4 overflow-y-auto flex flex-col gap-3 pb-6">

                {/* Heat Source Card */}
                <div
                    draggable
                    onDragStart={(e) => onDragStart(e, 'heat')}
                    className="group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-orange-400 hover:shadow-md transition-all duration-200"
                >
                    <div className="flex items-center justify-center w-10 h-10 bg-orange-50 rounded-lg text-orange-600 group-hover:scale-110 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.5 3.5 6.5 1.5 2 1 4.5-1 6.5A2.5 2.5 0 0 1 12 20a2.5 2.5 0 0 1-3.5-5.5z" />
                        </svg>
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-sm font-bold text-slate-700 leading-tight">Тепловий насос</span>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Джерело тепла</span>
                    </div>
                </div>

                {/* Storage Tank Card*/}
                <div
                    draggable
                    onDragStart={(e) => onDragStart(e, 'tank')}
                    className="group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-emerald-400 hover:shadow-md transition-all duration-200"
                >
                    <div className="flex items-center justify-center w-10 h-10 bg-emerald-50 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="2" width="14" height="20" rx="2" />
                            <line x1="5" y1="7" x2="19" y2="7" />
                            <line x1="5" y1="17" x2="19" y2="17" />
                        </svg>
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-sm font-bold text-slate-700 leading-tight">Резервуар води</span>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Резервуар</span>
                    </div>
                </div>

                {/* House Card */}
                <div
                    draggable
                    onDragStart={(e) => onDragStart(e, 'house')}
                    className="group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all duration-200"
                >
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-sm font-bold text-slate-700 leading-tight">Будинок</span>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Споживач</span>
                    </div>
                </div>
            </div>

            {/* Resizer Handle */}
            <div
                onMouseDown={startResizing}
                className={`
                    absolute top-0 bottom-0 right-0
                    w-[9px] cursor-col-resize
                    flex items-center justify-center
                    z-10
                `}>
                <div
                    className={`
                    w-[4px] h-full transition-colors
                    ${isResizing ? 'bg-blue-600' : 'bg-gray-300 hover:bg-blue-400'}
                `}/>
            </div>
        </aside>
    );
}
