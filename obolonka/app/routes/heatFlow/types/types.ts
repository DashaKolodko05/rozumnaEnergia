import type { Node } from '@xyflow/react';


export interface BaseNodeData extends Record<string, unknown> {
    label: string;
    type: string;
}

export interface PipeParams {
    lPipe: number;          // Довжина труби (м)
    dOutPipe: number;       // Зовнішній діаметр (м)
    sWallPipe: number;      // Товщина стінки (м)
    kThermalPipe: number;   // Коефіцієнт теплопровідності
    epsilonPipe: number;    // Ступінь чорноти
    vFlowPipe: number;      // Швидкість потоку (м/с)
}

export interface ConnectionStats {
    totalHouses: number;
    totalHeaters: number;
    connectedHouses: number;
    totalConnections: number;
}


export interface HeatSourceNodeData extends BaseNodeData {
    type: 'heat';
    pumpParams?: {
        qCop235: number; // Номінальна теплова потужність
        cop235: number; //Коефіцієнт перетворення енергії при t outside=2℃ та t water in tank=35℃
        electricPower: number; // Електрична потужність ( кВт)
    };
}

export interface TankNodeData extends BaseNodeData {
    type: 'tank';
    vTank: number; // Об'єм води в баку (л)
    kLostTank: number; // Коефіцієнт тепловтрат баку на 1 ºС (кВт*час/℃)
    tWaterNorm: number; // Номінальна температура води в баку (℃)
    deltaMax: number; // Максимальне позитивне відхилення температури (℃)
    deltaMin: number; // Максимальне негативне відхилення температури (℃)
}

export interface HouseNodeData extends BaseNodeData, PipeParams {
    type: 'house';
    connectedHeaters: AppNode[];

    // поля температур
    tOutside: number;
    tWaterCold: number;
    tBasement: number;
}

export type NodeData = HouseNodeData | HeatSourceNodeData | TankNodeData;

export type AppNode = Node<NodeData>;


export const isHeatNode = (node: AppNode): node is Node<HeatSourceNodeData> => {
    return node.type === 'heat';
};

export const isHeatPump = (node: AppNode): node is Node<HeatSourceNodeData> & { data: { pumpParams: NonNullable<HeatSourceNodeData['pumpParams']> } } => {
    return node.type === 'heat' && 'pumpParams' in node.data && !!node.data.pumpParams;
};

export const isHouseNode = (node: AppNode): node is Node<HouseNodeData> => {
    return node.type === 'house';
};

export const isTankNode = (node: AppNode): node is Node<TankNodeData> => {
    return node.type === 'tank';
};
