import '@xyflow/react/dist/style.css';
import React, { useCallback, useRef, useState } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    addEdge,
    useNodesState,
    useEdgesState,
    type Connection,
    type Edge,
    MarkerType,
    type ReactFlowInstance,
} from '@xyflow/react';
import { ConfigForm } from './forms';
import type { ConnectionStats, AppNode, NodeData } from './types';
import { createNodeData, nodeTypes } from './nodes';

interface FlowCanvasProps {
    sidebarWidth: number;
}

export function FlowCanvas({ sidebarWidth }: FlowCanvasProps): React.ReactElement {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<AppNode, Edge> | null>(null);

    const updateHouseConnections = useCallback((currentEdges: Edge[]) => {
        setNodes((nds) => {
            return nds.map((node) => {
                if (node.type === 'house') {
                    const connectedEdges = currentEdges.filter(
                        (edge) => edge.target === node.id
                    );

                    const connectedHeaters = connectedEdges.map((edge) => edge.source);

                    return {
                        ...node,
                        data: {
                            ...node.data,
                            connectedHeaters,
                        } as typeof node.data,
                    } as AppNode;
                }
                return node;
            });
        });
    }, [setNodes]);

    const onConnect = useCallback(
        (params: Connection) => {
            const sourceNode = nodes.find((n) => n.id === params.source);
            const targetNode = nodes.find((n) => n.id === params.target);

            if (sourceNode?.type === 'heat' && targetNode?.type === 'house') {
                const newEdge: Edge = {
                    ...params,
                    id: `edge-${params.source}-${params.target}`,
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#e37e69', strokeWidth: 2 },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#e37e69',
                    },
                };

                setEdges((eds) => {
                    const updatedEdges = addEdge(newEdge, eds);
                    updateHouseConnections(updatedEdges);
                    return updatedEdges;
                });
            } else {
                alert('Можна з\'єднувати тільки Джерело тепла з Будинком!');
            }
        },
        [nodes, setEdges, updateHouseConnections]
    );

    const onEdgesDelete = useCallback(
        (deletedEdges: Edge[]) => {
            setEdges((eds) => {
                const updatedEdges = eds.filter(
                    (edge) => !deletedEdges.some((de) => de.id === edge.id)
                );
                updateHouseConnections(updatedEdges);
                return updatedEdges;
            });
        },
        [setEdges, updateHouseConnections]
    );

    const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();

            if (!reactFlowInstance) return;

            const type = event.dataTransfer.getData('application/reactflow');
            if (!type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: AppNode = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: createNodeData(type, nodes.length + 1),
            };

            setNodes((nds) => [...nds, newNode]);
        },
        [reactFlowInstance, nodes.length, setNodes]
    );

    const onNodeClick = (_: React.MouseEvent, node: AppNode) => {
        setSelectedNode(node);
    };

    const updateNodeData = useCallback((nodeId: string, newData: Partial<NodeData>) => {
        console.log('Updating node:', nodeId, newData);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...newData
                        } as NodeData
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

    const getConnectionStats = useCallback((): ConnectionStats => {
        const houses = nodes.filter((n) => n.type === 'house');
        const heaters = nodes.filter((n) => n.type === 'heat');

        const connectedHouses = houses.filter(
            (h) => Array.isArray(h.data.connectedHeaters) && h.data.connectedHeaters.length > 0
        ).length;

        return {
            totalHouses: houses.length,
            totalHeaters: heaters.length,
            connectedHouses,
            totalConnections: edges.length,
        };
    }, [nodes, edges]);

    const stats = getConnectionStats();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100%',
            overflow: 'hidden'
        }}>
            <div className="flex flex-wrap items-center justify-center gap-x-8
            px-3 py-2 bg-white border-b border-gray-200 shadow-md shrink-0">
                {/* Статистика будинків */}
                <div className="flex items-center gap-3 group whitespace-nowrap">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-gray-500 uppercase text-[11px] tracking-wider">Houses</span>
                    <span className="font-medium text-gray-900 text-base">{stats.totalHouses}</span>
                </div>

                {/* Статистика джерел тепла */}
                <div className="flex items-center gap-3 group whitespace-nowrap">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-gray-500 uppercase text-[11px] tracking-wider">Heat Sources</span>
                    <span className="font-medium text-gray-900 text-base">{stats.totalHeaters}</span>
                </div>

                {/* Статистика з'єднань */}
                <div className="flex items-center gap-3 group whitespace-nowrap">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    <span className="text-gray-500 uppercase text-[11px] tracking-wider">Connections</span>
                    <span className="font-medium text-gray-900 text-base">{stats.totalConnections}</span>
                </div>

                {/* Прогрес підключення */}
                <div className="flex items-center gap-2 bg-gray-50 px-5 py-1 rounded-xl border border-gray-100 min-w-fit">
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Status</span>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-base font-bold ${stats.connectedHouses === stats.totalHouses ? 'text-green-600' : 'text-blue-600'}`}>
                            {stats.connectedHouses}
                        </span>
                        <span className="text-base text-gray-300">/</span>
                        <span className="text-base text-gray-500">{stats.totalHouses}</span>
                    </div>

                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 transition-all duration-700"
                            style={{ width: `${(stats.connectedHouses / (stats.totalHouses || 1)) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            <div
                style={{
                    flex: 1,
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden'
                }}
                ref={reactFlowWrapper}
            >
                <ReactFlow<AppNode>
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onNodeClick={onNodeClick}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onEdgesDelete={onEdgesDelete}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    nodeOrigin={[0.5, 0.5]}
                    connectionRadius={50}
                    // connectionMode={ConnectionMode.Loose}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#e37e69', strokeWidth: 2 },
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                            color: '#e37e69',
                        },
                    }}
                >
                    <Background />
                    <Controls />
                </ReactFlow>

                {/* Відображаємо форму, якщо обрано ноду */}
                {selectedNode && (
                    <ConfigForm
                        node={selectedNode}
                        onUpdate={updateNodeData}
                        onClose={() => setSelectedNode(null)}
                    />
                )}
            </div>
        </div>
    );
}
