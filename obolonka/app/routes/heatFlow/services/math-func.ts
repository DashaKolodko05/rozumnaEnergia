export const CP_WATER = 4.187; // кДж/(кг·°C)
export const RHO_WATER = 1000;  // кг/м3
export const SIGMA = 5.67e-8;   // Постійна Стефана-Больцмана
export const LAMBDA_WATER = 0.665; // Вт/(м·К) - теплопровідність води при 20°C

export const copTable = [
    [0,  -25,  -15,  -7,   -5,   0,    2,    7,    12,   20], // tOutside
    [30, 1.60, 1.85, 2.10, 2.20, 2.36, 2.55, 2.90, 3.20, 3.80],
    [35, 1.50, 1.75, 2.00, 2.10, 2.26, 2.45, 2.80, 3.10, 3.65],
    [45, 1.30, 1.50, 1.70, 1.80, 1.95, 2.10, 2.40, 2.70, 3.20],
    [55, 1.10, 1.25, 1.40, 1.45, 1.55, 1.70, 1.90, 2.15, 2.50],
];

/**
 * Функція отримання COP для будь-яких температур
 * @param tW - поточна температура води в баку
 * @param tO - поточна температура зовні
 * @param copTable - таблиця COP
 */
export const getCOP = (tW: number, tO: number, copTable: number[][]): number => {
    const tOutsides = copTable[0].slice(1);
    const tWaters = copTable.slice(1).map(row => row[0]);

    // 1. Обмежуємо вхідні дані межами таблиці (щоб не було помилок)
    const currentTW = Math.max(tWaters[0], Math.min(tWaters[tWaters.length - 1], tW));
    const currentTO = Math.max(tOutsides[0], Math.min(tOutsides[tOutsides.length - 1], tO));

    // 2. Знаходимо індекси найближчих значень (m1 та m2)
    const findNeighbors = (val: number, arr: number[]) => {
        for (let i = 0; i < arr.length - 1; i++) {
            if (val <= arr[i + 1]) return { idx1: i, idx2: i + 1 };
        }
        return { idx1: arr.length - 2, idx2: arr.length - 1 };
    };

    const nO = findNeighbors(currentTO, tOutsides);
    const nW = findNeighbors(currentTW, tWaters);

    // 3. Отримуємо 4 опорні точки (прямокутник навколо цільового значення)
    const q11 = copTable[nW.idx1 + 1][nO.idx1 + 1]; // [tW1, tO1]
    const q12 = copTable[nW.idx1 + 1][nO.idx2 + 1]; // [tW1, tO2]
    const q21 = copTable[nW.idx2 + 1][nO.idx1 + 1]; // [tW2, tO1]
    const q22 = copTable[nW.idx2 + 1][nO.idx2 + 1]; // [tW2, tO2]

    // 4. Лінійна інтерполяція по осі tOutside (горизонтальна)
    const interpolate = (x: number, x1: number, x2: number, y1: number, y2: number) =>
        y1 + (x - x1) * (y2 - y1) / (x2 - x1);

    const copAtTW1 = interpolate(currentTO, tOutsides[nO.idx1], tOutsides[nO.idx2], q11, q12);
    const copAtTW2 = interpolate(currentTO, tOutsides[nO.idx1], tOutsides[nO.idx2], q21, q22);

    // 5. Фінальна інтерполяція по осі tWater (вертикальна)
    return interpolate(currentTW, tWaters[nW.idx1], tWaters[nW.idx2], copAtTW1, copAtTW2);
};


// ============================================
// 1. ОБЧИСЛЕННЯ КІЛЬКОСТІ ТЕПЛОТИ, ЩО ВИРОБЛЯЄТЬСЯ ДЖЕРЕЛОМ (Q source)
// ============================================
export function calculateHeatSource(
    sourceEnabled: boolean,
    tOutside: number,
    tTankWater: number,
    copTable: any,
    qCop235: number,
    cop235: number,
    deltaTime: number
): number {
    if (!sourceEnabled) return 0;

    const cop = getCOP(tOutside, tTankWater, copTable);
    return (qCop235 / cop235) * cop * deltaTime;
}

// ============================================
// 3. ОБЧИСЛЕННЯ ВТРАТ КІЛЬКОСТІ ТЕПЛОТИ БАКОМ (Q tank lost)
// ============================================
export function calculateTankHeatLoss(
    tTankWater: number,
    tOutside: number,
    kLostTank: number,
    deltaTime: number
): number {
    return (tTankWater - tOutside) * kLostTank * deltaTime;
}

// Кінематична в'язкість води обчислюється за формулою
export function calculateKinematicViscosityWater(tTankWater: number): number {
    return 1.78e-6 / (1 + 0.0337 * tTankWater + 0.000221 * Math.pow(tTankWater, 2));
}

/**
 * Температуропровідність води (alpha)
 * @param tWater температура води (°C)
 * @returns alpha (м²/с)
 */
export function getAlphaWater(tWater: number): number {
    return 1.32e-7 * (1 + 0.003 * tWater);
}

/**
 * Число Рейнольдса (Re)
 * @param vFlow швидкість потоку (м/с)
 * @param d діаметр труби (м)
 * @param nu кінематична в'язкість (м²/с)
 */
export function getReynolds(vFlow: number, d: number, nu: number): number {
    if (nu === 0) return 0; // захист від ділення на 0
    return (vFlow * d) / nu;
}

/**
 * Критерій Нуссельта (Nu) для турбулентного потоку в трубі
 * @param re число Рейнольдса
 * @param pr число Прандтля
 */
export function getNusselt(re: number, pr: number): number {
    if (re <= 0 || pr <= 0) return 0;

    return 0.023 * Math.pow(re, 0.8) * Math.pow(pr, 0.4);
}

/**
 * Коефіцієнт тепловіддачі з внутрішнього боку труби (alphaIn)
 * @param nusselt критерій Нуссельта
 * @param lambda теплопровідність рідини (Вт/(м·К))
 * @param d діаметр труби (м)
 */
export function getAlphaIn(nusselt: number, d: number): number {
    if (d <= 0) return 0;
    return (nusselt * LAMBDA_WATER) / d;
}

/**
 * Внутрішній тепловий опір труби (R_in)
 * @param alphaIn коеф. тепловіддачі (Вт/(м²·К))
 * @param d внутрішній діаметр труби (м)
 * @param l довжина труби (м)
 */
export function getInternalResistance(
    alphaIn: number,
    d: number,
    l: number
): number {
    if (alphaIn <= 0 || d <= 0 || l <= 0) return 0;
    const area = Math.PI * d * l;
    return 1 / (alphaIn * area);
}

/**
 * Тепловий опір стінки труби (R_thermal)
 * @param dIn внутрішній діаметр (м)
 * @param dOut зовнішній діаметр (м)
 * @param k теплопровідність матеріалу труби (Вт/(м·К))
 * @param l довжина труби (м)
 */
export function getPipeThermalResistance(
    dIn: number,
    dOut: number,
    k: number,
    l: number
): number {
    if (dIn <= 0 || dOut <= dIn || k <= 0 || l <= 0) return 0;
    const ratio = dOut / dIn;
    const denominator = 2 * Math.PI * k * l;

    return Math.log(ratio) / denominator;
}

/**
 * Радіаційний тепловий потік (qRad)
 * @param epsilon коеф. випромінювання (0..1)
 * @param tSurface температура поверхні (°C)
 * @param tEnv температура середовища (°C)
 * @param sigma стала Стефана-Больцмана (Вт/(м²·К⁴))
 */
export function getRadiationHeatFlow(
    epsilon: number,
    tSurface: number,
    tEnv: number,
    area?: number
): number {
    const T1 = 273.15 + tSurface;
    const T2 = 273.15 + tEnv;

    const q = epsilon * SIGMA * (T1 ** 4 - T2 ** 4);

    return area ? q * area : q;
}


/**
 * Ефективний коефіцієнт радіаційної тепловіддачі (alphaRad)
 * @param qRad радіаційний тепловий потік (Вт/м²)
 * @param tSurface температура поверхні (°C)
 * @param tEnv температура середовища (°C)
 */
export function getAlphaRadiation(
    qRad: number,
    tSurface: number,
    tEnv: number
): number {
    const deltaT = tSurface - tEnv;

    if (Math.abs(deltaT) < 1e-6) return 0; // захист від ділення на ~0

    return qRad / deltaT;
}

/**
 * Кінематична в'язкість повітря (nu_air)
 * @param tAir температура повітря (°C)
 */
export function getAirKinematicViscosity(tAir: number): number {
    return 1.48e-5 / (1 + 0.003 * tAir + 0.000221 * Math.pow(tAir, 2));
}

/**
 * Теплопровідність повітря (λ_air)
 * @param tAir температура повітря (°C)
 */
export function getAirThermalConductivity(tAir: number): number {
    return 0.0257 * (1 + 0.003 * tAir + 0.000221 * Math.pow(tAir, 2));
}

/**
 * Зовнішній коефіцієнт тепловіддачі труби (alphaOut)
 * @param nuAir кінематична в'язкість повітря
 * @param lambdaAir теплопровідність повітря
 * @param dOut зовнішній діаметр труби
 */
export function getAlphaOut(
    nuAir: number,
    lambdaAir: number,
    dOut: number
): number {
    if (dOut <= 0) return 0;

    return (nuAir * lambdaAir) / dOut;
}


/**
 * Зовнішній тепловий опір труби (конвекція + радіація)
 * @param alphaOut коеф. конвективної тепловіддачі
 * @param alphaRad коеф. радіаційної тепловіддачі
 * @param dOut зовнішній діаметр труби (м)
 * @param l довжина труби (м)
 */
export function getExternalResistance(
    alphaOut: number,
    alphaRad: number,
    dOut: number,
    l: number
): number {
    const alphaTotal = alphaOut + alphaRad;

    if (alphaTotal <= 0 || dOut <= 0 || l <= 0) return 0;

    const area = Math.PI * dOut * l;

    return 1 / (alphaTotal * area);
}

/**
 * Загальний тепловий опір труби
 * @param rIn внутрішній опір
 * @param rPipe опір стінки труби
 * @param rOut зовнішній опір
 */
export function getTotalThermalResistance(
    rIn: number,
    rPipe: number,
    rOut: number
): number {
    return rIn + rPipe + rOut;
}

/**
 * Втрати тепла через трубу (Q_loss)
 * @param tHot температура теплоносія (°C)
 * @param tCold температура оточення (°C)
 * @param rTotal загальний тепловий опір (K/W)
 * @param dt крок часу (с або інша одиниця, як у тебе в моделі)
 */
export function getPipeHeatLoss(
    tHot: number,
    tCold: number,
    rTotal: number,
    dt: number
): number {
    if (rTotal <= 0) return 0;

    const deltaT = tHot - tCold;

    return (deltaT / rTotal) * dt;
}

/**
 * Температура на виході з труби
 * @param tIn температура на вході (°C)
 * @param qLoss втрати потужності (Вт або Дж/с)
 * @param vFlow об'ємна витрата (м³/с)
 * @param cp теплоємність води (кДж/(кг·°C))
 * @param rho густина води (кг/м³)
 */
export function getPipeOutletTemperature(
    tIn: number,
    qLoss: number,
    vFlow: number,
    cp: number
): number {
    const massFlow = vFlow * RHO_WATER; // кг/с

    if (massFlow <= 0 || cp <= 0) return tIn;

    const deltaT = qLoss / (massFlow * cp);

    return tIn - deltaT;
}

/**
 * Зміна енергії в баку (ΔQ)
 * @param sourceEnabled чи працює джерело тепла
 * @param qSource тепло від джерела
 * @param qWaterHeating споживання води
 * @param qTankLoss втрати бака
 * @param qPipeLoss втрати труби
 */
export function getTankDeltaQ(
    sourceEnabled: boolean,
    qSource: number,
    qWaterHeating: number,
    qTankLoss: number,
    qPipeLoss: number
): number {
    const qIn = sourceEnabled ? qSource : 0;
    const qOut = qWaterHeating + qTankLoss + qPipeLoss;

    return qIn - qOut;
}

/**
 * Оновлення температури води в баку
 * @param tCurrent поточна температура (°C)
 * @param deltaQ зміна теплоти (кДж або Дж — залежно від моделі)
 * @param volume об'єм бака (м³)
 */
export function updateTankTemperature(
    tCurrent: number,
    deltaQ: number,
    volume: number
): number {
    return tCurrent + deltaQ / (CP_WATER * volume);
}
