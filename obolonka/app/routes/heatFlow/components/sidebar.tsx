import React, { useState, useCallback, useEffect, type ReactElement } from 'react';
import '@xyflow/react/dist/style.css';

interface SidebarProps {
    width: number;
    setWidth: (width: number) => void;
}

export function Sidebar({ width, setWidth }: SidebarProps): ReactElement {
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
                if (newWidth > 150 && newWidth < 600) {
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
            style={{
                width: `${width}px`,
                minWidth: `${width}px`,
                background: '#f8f9fa',
                borderRight: '1px solid #e0e0e0',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 15px',
                boxSizing: 'border-box',
                height: '100%',
            }}
        >
            <div
                style={{
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    userSelect: 'none',
                }}
            >
                Node Library
            </div>

            <div
                draggable
                onDragStart={(e) => onDragStart(e, 'house')}
                style={nodeStyle}
            >
                <span>🏠</span> House
            </div>

            <div
                draggable
                onDragStart={(e) => onDragStart(e, 'heat')}
                style={nodeStyle}
            >
                <span>🔥</span> Heat Source
            </div>

            {/* Resizer */}
            <div
                onMouseDown={startResizing}
                style={{
                    width: '20px',
                    cursor: 'col-resize',
                    position: 'absolute',
                    right: '-10px',
                    top: 0,
                    bottom: 0,
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                <div
                    style={{
                        width: '6px',
                        height: '24px',
                        borderRadius: '3px',
                        background: isResizing ? '#2196f3' : '#ccc',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-around',
                        padding: '2px 0',
                        transition: 'background 0.2s',
                    }}
                >
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            style={{
                                width: '2px',
                                height: '2px',
                                background: '#fff',
                                borderRadius: '50%',
                                margin: '0 auto',
                            }}
                        />
                    ))}
                </div>
            </div>
        </aside>
    );
}


const nodeStyle: React.CSSProperties = {
    marginBottom: 12,
    cursor: 'grab',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    userSelect: 'none',
};
