import React, { type ReactElement } from 'react';
import { Handle, Position, useNodes, type NodeProps } from '@xyflow/react';
import type { NodeData } from './types';

// House Node Component
export function HouseNode({ data }: NodeProps): ReactElement {
    const allNodes = useNodes();
    const { label, connectedHeaters = [] } = data as unknown as NodeData;

    const connectedLabels = connectedHeaters.map(id => {
        const sourceNode = allNodes.find(n => n.id === id);
        return sourceNode?.data?.label || id;
    });

    return (
        <div style={{
            padding: '10px',
            background: '#f0f7ff',
            borderRadius: '6px',
            border: '1px solid #007acc',
            minWidth: '150px',
            position: 'relative',
            fontSize: '13px'
        }}>
            <Handle type="target" position={Position.Left} style={{ borderRadius: '2px' }} />

            <div style={{ fontWeight: 'bold', color: '#007acc' }}>
                HOUSE: {label}
            </div>

            {connectedHeaters.length > 0 && (
                <div style={{ fontSize: '11px', color: '#444' }}>
                    Sources: {connectedLabels.join(', ')}
                </div>
            )}
        </div>
    );
}

// Heat Node Component
export function HeatNode({ data }: NodeProps): ReactElement {
    const { label } = data as unknown as NodeData;

    return (
        <div style={{
            padding: '10px',
            background: '#fff5f2',
            borderRadius: '6px',
            border: '1px solid #e34c26',
            minWidth: '150px',
            position: 'relative',
            fontSize: '13px'
        }}>
            <div style={{ fontWeight: 'bold', color: '#e34c26' }}>
                HEAT SRC: {label}
            </div>

            <Handle type="source" position={Position.Right} style={{ borderRadius: '2px', background: '#e34c26' }} />
        </div>
    );
}

// Node types export
export const nodeTypes = {
    house: HouseNode,
    heat: HeatNode,
};
