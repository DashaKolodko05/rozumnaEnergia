import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/600.css';
import '@fontsource/roboto/700.css';
import { useState, useEffect, type JSX } from 'react';
import '@xyflow/react/dist/style.css';
import { Sidebar } from './sidebar';
import { FlowCanvas } from './flow-canvas';

export default function App(): JSX.Element {const [sidebarWidth, setSidebarWidth] = useState(300);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('sidebar-width');
        if (saved) setSidebarWidth(parseInt(saved, 10));
        setIsMounted(true);
    }, []);

    if (!isMounted) return (
        <div className="flex w-screen h-screen justify-center items-center">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div style={{
            display: 'flex',
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            margin: 0,
            padding: 0
        }}>
            <Sidebar width={sidebarWidth} minWidth={sidebarWidth} setWidth={setSidebarWidth} />

            <main style={{
                flexGrow: 1,
                height: '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <FlowCanvas sidebarWidth={sidebarWidth} minWidth={sidebarWidth} />
            </main>
        </div>
    );
}
