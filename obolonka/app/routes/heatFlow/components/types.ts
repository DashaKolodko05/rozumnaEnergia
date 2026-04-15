import type { Node } from '@xyflow/react';

export interface NodeData extends Record<string, unknown> {
    label: string;
    connectedHeaters?: string[];
}

export type AppNode = Node<NodeData>;

export interface ConnectionStats {
    totalHouses: number;
    totalHeaters: number;
    connectedHouses: number;
    totalConnections: number;
}
