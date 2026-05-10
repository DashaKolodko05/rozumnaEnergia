import '@xyflow/react/dist/style.css';
import '../css/edge.css';
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
import { type ConnectionStats, type AppNode, type NodeData, isHouseNode } from '../types/types';
import { createNodeData, nodeTypes } from './nodes';
import { ConfigForm } from './forms';
import { EmptyCanvasHint, SelectionHint } from './hints';
import { logSystemTree, runSimulation, type ChartDataPoint } from '../services/simulations';
import SimulationResultsModal from './simulation-result-modal';
import { StatusBar } from './status-bar';

const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: false,
    interactionWidth: 25,
    style: { stroke: '#e37e69', strokeWidth: 2 },
    markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#e37e69',
    },
};

interface FlowCanvasProps {
    sidebarWidth: number;
    minWidth: number;
}

export function FlowCanvas({ sidebarWidth, minWidth }: FlowCanvasProps): React.ReactElement {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<AppNode, Edge> | null>(null);

    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [nodeForConfig, setNodeForConfig] = useState<AppNode | null>(null);

    const [simulationData, setSimulationData] = useState<ChartDataPoint[] | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);

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

            // Перевіряємо, чи вже є вхідне з'єднання у цільової ноди
            const isTargetOccupied = edges.some((edge) => edge.target === params.target);

            // Правила валідації
            const isHeatToTank = sourceNode?.type === 'heat' && targetNode?.type === 'tank';
            const isTankToHouse = sourceNode?.type === 'tank' && targetNode?.type === 'house';

            // 1. ПЕРЕВІРКА ТИПІВ: Тільки Heat -> Tank або Tank -> House
            if (!isHeatToTank && !isTankToHouse) {
                console.warn('Недопустимий тип з’єднання. Баки підключаються до будинків, а джерела — до баків.');
                return;
            }

            // 2. ПЕРЕВІРКА КІЛЬКОСТІ: Тільки одне вхідне з'єднання
            if (isTargetOccupied) {
                console.warn(`Цей ${targetNode?.type} вже має підключене джерело.`);
                return;
            }

            // Якщо перевірки пройдено — створюємо лінію
            const edgeColor = sourceNode?.type === 'heat' ? '#e37e69' : '#10b981';

            const newEdge: Edge = {
                ...params,
                id: `edge-${params.source}-${params.target}`,
                type: 'smoothstep',
                animated: true,
                style: { stroke: edgeColor, strokeWidth: 2 },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: edgeColor,
                },
            };

            setEdges((eds) => {
                const updatedEdges = addEdge(newEdge, eds);
                updateHouseConnections(updatedEdges);
                return updatedEdges;
            });
        },
        [nodes, edges, setEdges, updateHouseConnections]
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

            // const newNode: AppNode = {
            //     id: `${type}-${Date.now()}`,
            //     type,
            //     position,
            //     data: createNodeData(type, nodes.length + 1),
            // };

            setNodes((nds) => {
                if (type === 'house' && nds.some(n => n.type === 'house')) {
                    console.warn('Будинок вже існує');
                    return nds;
                }

                const newNode: AppNode = {
                    id: `${type}-${Date.now()}`,
                    type,
                    position,
                    data: createNodeData(type, nds.length + 1),
                };

                return [...nds, newNode];
            });
        },
        [reactFlowInstance, nodes.length, setNodes]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: AppNode) => {
        setSelectedNode((prevSelected: AppNode | null) => {
            if (prevSelected?.id === node.id) {
                return null;
            }
            return node;
        });
    }, []);

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

        setIsConfigOpen(false);
        setNodeForConfig(null);
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


    const onNodeDoubleClick = (_: React.MouseEvent, node: AppNode) => {
        setNodeForConfig(node);
        setIsConfigOpen(true);
    };

    const stats = getConnectionStats();

    const handleStartSimulation = () => {
        // 1. перевірка
        if (stats.connectedHouses < stats.totalHouses) {
            alert("Підключіть всі будинки до джерел тепла та/або бака перед запуском симуляції.");
            return;
        }

        logSystemTree(nodes, edges);

        if (stats.connectedHouses < stats.totalHouses) {
            alert("Увага: Не всі будинки підключені!");
        }

        // 1. Знаходимо будинок (точка входу)
        const house = nodes.find(isHouseNode);
        if (!house) {
            alert('Будинок не знайдено!');
            throw new Error("House node not found");
        }

        // 2. Шукаємо танк, підключений до будинку
        const edgeToHouse = edges.find(e => e.target === house.id);
        const tankNode = nodes.find(n => n.id === edgeToHouse?.source && n.type === 'tank');

        if (!tankNode) {
            // Якщо танк не обов'язковий, можна просто логувати,
            // але для розрахунків краще зупинити процес
            throw new Error("До будинку не підключено бак-акумулятор!");
        }

        // 3. Шукаємо джерело тепла, підключене до танка
        const edgeToTank = edges.find(e => e.target === tankNode.id);
        const heatPump = nodes.find(n => n.id === edgeToTank?.source && n.type === 'heat');

        if (!heatPump) {
            alert('До бака не підключено джерело тепла!');
            throw new Error("До бака не підключено джерело тепла!");
        }


        setIsSimulating(true);

        const result = runSimulation(
            house,
            tankNode,
            heatPump,
            100,   // 100 годин
            1,     // крок 1 година
        );

        setSimulationData(result);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100%',
            overflow: 'hidden'
        }}>
            <StatusBar
                stats={stats}
                onStartSimulation={handleStartSimulation}
            />

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
                    onNodeDoubleClick={onNodeDoubleClick}

                    onEdgesChange={onEdgesChange}
                    onEdgesDelete={onEdgesDelete}
                    onConnect={onConnect}
                    defaultEdgeOptions={defaultEdgeOptions}

                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}

                    deleteKeyCode={["Backspace", "Delete"]}
                    selectionKeyCode="Shift"
                    multiSelectionKeyCode="Shift"
                    fitView

                    nodeTypes={nodeTypes}
                    nodeOrigin={[0.5, 0.5]}
                    connectionRadius={50}
                // connectionMode={ConnectionMode.Loose}
                >
                    <Background color="#adb8c594" gap={15} size={2} />

                    {/* Hints */}
                    <EmptyCanvasHint />
                    <SelectionHint />

                    <Controls />
                </ReactFlow>

                {isConfigOpen && nodeForConfig && (
                    <ConfigForm
                        node={nodeForConfig}
                        onUpdate={(nodeId, data) => updateNodeData(nodeId, data)}
                        onClose={() => {
                            setIsConfigOpen(false);
                            setNodeForConfig(null);
                        }}
                    />
                )}


                <SimulationResultsModal
                    isOpen={isSimulating}
                    data={simulationData}
                    onClose={() => {
                        setIsSimulating(false);
                        setSimulationData(null);
                    }}
                />
            </div>
        </div>
    );
}
