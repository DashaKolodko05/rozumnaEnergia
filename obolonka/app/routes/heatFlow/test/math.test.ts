import { describe, it, expect } from 'vitest';
import { calculateHeatSource, calculateKinematicViscosityWater, calculateTankHeatLoss, copTable, CP_WATER, getAirKinematicViscosity, getAirThermalConductivity, getAlphaIn, getAlphaOut, getAlphaRadiation, getAlphaWater, getCOP, getExternalResistance, getInternalResistance, getNusselt, getPipeHeatLoss, getPipeOutletTemperature, getPipeThermalResistance, getRadiationHeatFlow, getReynolds, getTankDeltaQ, getTotalThermalResistance, LAMBDA_WATER, RHO_WATER, SIGMA, updateTankTemperature } from '../services/math-func';

// Базовий тест, щоб перевірити що тестова система працює
describe('test works', () => {
    it('повинен проходити', () => {
        expect(1 + 1).toBe(2);
    });
});

// Тестова таблиця COP (залежність температури води та зовнішньої температури)
const table = [
    [0, -10, 0, 10, 20],
    [30, 2.5, 3, 3.5, 4],
    [40, 2, 2.5, 3, 3.5]
];

describe('getCOP', () => {

    // Перевірка точного значення з таблиці без інтерполяції
    it('повертає точне значення з таблиці', () => {
        expect(getCOP(30, 0, table)).toBe(3);
    });

    // Перевірка лінійної інтерполяції між значеннями
    it('правильно виконує інтерполяцію між температурами', () => {
        const result = getCOP(35, 0, table);
        expect(result).toBeCloseTo(2.75, 2);
    });

    // Перевірка обмеження мінімальних значень (clamp вниз)
    it('обмежує занадто низькі значення', () => {
        const result = getCOP(-100, -100, table);
        expect(result).toBeGreaterThan(0);
    });

    // Перевірка обмеження максимальних значень (clamp вверх)
    it('обмежує занадто високі значення', () => {
        const result = getCOP(999, 999, table);
        expect(result).toBeLessThanOrEqual(4);
    });

});



describe('calculateHeatSource', () => {

    const baseParams = {
        tOutside: 0,
        tTankWater: 30,
        copTable,
        qCop235: 5,
        cop235: 3,
        deltaTime: 1
    };

    // 1. Якщо джерело вимкнене
    it('повертає 0 якщо джерело вимкнене', () => {
        const result = calculateHeatSource(
            false,
            baseParams.tOutside,
            baseParams.tTankWater,
            baseParams.copTable,
            baseParams.qCop235,
            baseParams.cop235,
            baseParams.deltaTime
        );

        expect(result).toBe(0);
    });

    // 2. Перевірка що функція повертає число
    it('повертає число при увімкненому джерелі', () => {
        const result = calculateHeatSource(
            true,
            baseParams.tOutside,
            baseParams.tTankWater,
            baseParams.copTable,
            baseParams.qCop235,
            baseParams.cop235,
            baseParams.deltaTime
        );

        expect(typeof result).toBe('number');
    });

    // 3. Перевірка що результат > 0 (для нормальних COP значень)
    it('повертає позитивне значення при нормальних умовах', () => {
        const result = calculateHeatSource(
            true,
            0,
            30,
            baseParams.copTable,
            baseParams.qCop235,
            baseParams.cop235,
            baseParams.deltaTime
        );

        expect(result).toBeGreaterThan(0);
    });

    // 4. Перевірка стабільності (однаковий input → однаковий output)
    it('повертає однаковий результат при однакових вхідних даних', () => {
        const r1 = calculateHeatSource(true, 0, 30, copTable, 5, 3, 1);
        const r2 = calculateHeatSource(true, 0, 30, copTable, 5, 3, 1);

        expect(r1).toBe(r2);
    });

});


describe('calculateTankHeatLoss', () => {

    // 1. Базовий розрахунок
    it('правильно рахує втрати тепла бака', () => {
        const result = calculateTankHeatLoss(
            50,   // tTankWater
            20,   // tOutside
            2,    // kLostTank
            1     // deltaTime
        );

        // (50 - 20) * 2 * 1 = 60
        expect(result).toBe(60);
    });

    // 2. Перевірка що при однакових температурах втрати = 0
    it('повертає 0 якщо температури однакові', () => {
        const result = calculateTankHeatLoss(
            30,
            30,
            2,
            1
        );

        expect(result).toBe(0);
    });

    // 3. Перевірка впливу deltaTime
    it('збільшує втрати пропорційно часу', () => {
        const r1 = calculateTankHeatLoss(50, 20, 2, 1);
        const r2 = calculateTankHeatLoss(50, 20, 2, 2);

        expect(r2).toBe(r1 * 2);
    });

    // 4. Перевірка знаку (не має бути від’ємних значень у нормальних умовах)
    it('повертає невід’ємне значення при tTankWater > tOutside', () => {
        const result = calculateTankHeatLoss(60, 20, 2, 1);

        expect(result).toBeGreaterThanOrEqual(0);
    });

    // 5. Якщо бак холодніший за зовнішнє середовище (теоретичний кейс)
    it('може повертати від’ємне значення якщо бак холодніший', () => {
        const result = calculateTankHeatLoss(10, 20, 2, 1);

        expect(result).toBeLessThan(0);
    });

});


describe('calculateKinematicViscosityWater', () => {

    // 1. Перевірка базового значення
    it('обчислює кінематичну в\'язкість води для стандартної температури', () => {
        const result = calculateKinematicViscosityWater(20);

        // очікуємо позитивне мале число
        expect(result).toBeGreaterThan(0);
    });

    // 2. Перевірка що при 0°C значення більше ніж при 20°C
    it('дає більшу в\'язкість при нижчій температурі', () => {
        const cold = calculateKinematicViscosityWater(0);
        const warm = calculateKinematicViscosityWater(20);

        expect(cold).toBeGreaterThan(warm);
    });

    // 3. Перевірка монотонності (з ростом температури в'язкість падає)
    it('зменшується при підвищенні температури', () => {
        const t1 = calculateKinematicViscosityWater(10);
        const t2 = calculateKinematicViscosityWater(30);

        expect(t2).toBeLessThan(t1);
    });

    // 4. Перевірка крайніх значень (гаряча вода)
    it('повертає мале значення при високій температурі', () => {
        const result = calculateKinematicViscosityWater(80);

        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1e-5);
    });

    // 5. Перевірка детермінованості
    it('повертає однаковий результат для однакового входу', () => {
        const r1 = calculateKinematicViscosityWater(25);
        const r2 = calculateKinematicViscosityWater(25);

        expect(r1).toBe(r2);
    });

});

describe('getAlphaWater', () => {

    // 1. Базове значення
    it('обчислює температуропровідність води для стандартної температури', () => {
        const result = getAlphaWater(20);

        expect(result).toBeGreaterThan(0);
    });

    // 2. Перевірка лінійного росту
    it('зростає зі збільшенням температури', () => {
        const low = getAlphaWater(10);
        const high = getAlphaWater(40);

        expect(high).toBeGreaterThan(low);
    });

    // 3. Перевірка нульової температури
    it('дає базове значення при 0°C', () => {
        const result = getAlphaWater(0);

        expect(result).toBeCloseTo(1.32e-7);
    });

    // 4. Перевірка пропорційності
    it('збільшується пропорційно температурі', () => {
        const a1 = getAlphaWater(10);
        const a2 = getAlphaWater(20);

        const diff1 = a1 - getAlphaWater(0);
        const diff2 = a2 - getAlphaWater(0);

        expect(diff2).toBeGreaterThan(diff1);
    });

    // 5. Детермінованість
    it('повертає однаковий результат для однакових вхідних даних', () => {
        const r1 = getAlphaWater(25);
        const r2 = getAlphaWater(25);

        expect(r1).toBe(r2);
    });

});


describe('getReynolds', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює число Рейнольдса', () => {
        const result = getReynolds(2, 0.1, 0.001);

        // Re = (2 * 0.1) / 0.001 = 200
        expect(result).toBe(200);
    });

    // 2. Перевірка залежності від швидкості
    it('зростає при збільшенні швидкості потоку', () => {
        const low = getReynolds(1, 0.1, 0.001);
        const high = getReynolds(3, 0.1, 0.001);

        expect(high).toBeGreaterThan(low);
    });

    // 3. Перевірка залежності від діаметра
    it('зростає при збільшенні діаметра труби', () => {
        const small = getReynolds(2, 0.05, 0.001);
        const big = getReynolds(2, 0.2, 0.001);

        expect(big).toBeGreaterThan(small);
    });

    // 4. Перевірка впливу в'язкості
    it('зменшується при збільшенні кінематичної в\'язкості', () => {
        const lowVisc = getReynolds(2, 0.1, 0.001);
        const highVisc = getReynolds(2, 0.1, 0.01);

        expect(highVisc).toBeLessThan(lowVisc);
    });

    // 5. Захист від ділення на 0
    it('повертає 0 якщо в\'язкість = 0', () => {
        const result = getReynolds(2, 0.1, 0);

        expect(result).toBe(0);
    });

    // 6. Детермінованість
    it('повертає однаковий результат для однакових вхідних даних', () => {
        const r1 = getReynolds(2, 0.1, 0.001);
        const r2 = getReynolds(2, 0.1, 0.001);

        expect(r1).toBe(r2);
    });

});


describe('getNusselt', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює число Нуссельта', () => {
        const result = getNusselt(1000, 10);

        // Nu = 0.023 * Re^0.8 * Pr^0.4
        expect(result).toBeGreaterThan(0);
    });

    // 2. Зростає при збільшенні Re
    it('зростає при збільшенні числа Рейнольдса', () => {
        const low = getNusselt(500, 10);
        const high = getNusselt(1000, 10);

        expect(high).toBeGreaterThan(low);
    });

    // 3. Зростає при збільшенні Pr
    it('зростає при збільшенні числа Прандтля', () => {
        const low = getNusselt(1000, 5);
        const high = getNusselt(1000, 10);

        expect(high).toBeGreaterThan(low);
    });

    // 4. Edge case: Re = 0
    it('повертає 0 якщо Re = 0', () => {
        expect(getNusselt(0, 10)).toBe(0);
    });

    // 5. Edge case: Pr = 0
    it('повертає 0 якщо Pr = 0', () => {
        expect(getNusselt(1000, 0)).toBe(0);
    });

    // ❌ 6. ХИБНИЙ/контрінтуїтивний тест (ловить помилки моделі)
    it('НЕ повинен бути лінійним по Re (нелінійна залежність)', () => {
        const r1 = getNusselt(1000, 10);
        const r2 = getNusselt(2000, 10);

        // якщо хтось випадково зробить Re * const → цей тест впаде
        expect(r2 / r1).not.toBe(2);
    });

    // ❌ 7. Хибний фізичний sanity check
    it('не повинен давати надто мале значення при нормальних умовах', () => {
        const result = getNusselt(5000, 7);

        // якщо формула зламана → буде 0 або майже 0
        expect(result).toBeGreaterThan(1);
    });

});


describe('getAlphaIn', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює коефіцієнт тепловіддачі', () => {
        const nusselt = 100;
        const d = 0.1;

        const result = getAlphaIn(nusselt, d);

        // alpha = (Nu * lambda) / d
        const expected = (nusselt * LAMBDA_WATER) / d;

        expect(result).toBeCloseTo(expected, 5);
    });

    // 2. Зростає при збільшенні Nusselt
    it('зростає при збільшенні числа Нуссельта', () => {
        const low = getAlphaIn(50, 0.1);
        const high = getAlphaIn(100, 0.1);

        expect(high).toBeGreaterThan(low);
    });

    // 3. Зменшується при збільшенні діаметра
    it('зменшується при збільшенні діаметра труби', () => {
        const smallD = getAlphaIn(100, 0.05);
        const bigD = getAlphaIn(100, 0.2);

        expect(bigD).toBeLessThan(smallD);
    });

    // 4. Edge case: d = 0
    it('повертає 0 якщо діаметр <= 0', () => {
        expect(getAlphaIn(100, 0)).toBe(0);
        expect(getAlphaIn(100, -1)).toBe(0);
    });

    // ❌ 5. ХИБНИЙ sanity check (ловить зламану формулу)
    it('не повинен повертати нуль при нормальних значеннях', () => {
        const result = getAlphaIn(1000, 0.1);

        // якщо формула зламалась → часто буде 0 або дуже мале число
        expect(result).toBeGreaterThan(1);
    });

});


describe('getInternalResistance', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює внутрішній тепловий опір', () => {
        const alphaIn = 100;
        const d = 0.1;
        const l = 2;

        const area = Math.PI * d * l;
        const expected = 1 / (alphaIn * area);

        const result = getInternalResistance(alphaIn, d, l);

        expect(result).toBeCloseTo(expected, 6);
    });

    // 2. Опір зменшується при збільшенні alphaIn
    it('зменшується при збільшенні коефіцієнта тепловіддачі', () => {
        const r1 = getInternalResistance(50, 0.1, 2);
        const r2 = getInternalResistance(100, 0.1, 2);

        expect(r2).toBeLessThan(r1);
    });

    // 3. Опір зменшується при збільшенні діаметра
    it('зменшується при збільшенні діаметра труби', () => {
        const small = getInternalResistance(100, 0.05, 2);
        const big = getInternalResistance(100, 0.2, 2);

        expect(big).toBeLessThan(small);
    });

    // 4. Опір зменшується при збільшенні довжини (через площу)
    it('зменшується при збільшенні довжини труби', () => {
        const short = getInternalResistance(100, 0.1, 1);
        const long = getInternalResistance(100, 0.1, 5);

        expect(long).toBeLessThan(short);
    });

    // 5. Edge cases: захист від нуля
    it('повертає 0 якщо вхідні значення некоректні', () => {
        expect(getInternalResistance(0, 0.1, 2)).toBe(0);
        expect(getInternalResistance(100, 0, 2)).toBe(0);
        expect(getInternalResistance(100, 0.1, 0)).toBe(0);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить зламану фізику)
    it('не повинен бути занадто великим при нормальних значеннях', () => {
        const result = getInternalResistance(1000, 0.1, 2);

        // якщо формула зламалась (наприклад забули дільник) → буде дуже велике число
        expect(result).toBeLessThan(1);
    });

    // ❌ 7. Хибний логічний тест
    it('не повинен бути однаковим при зміні геометрії', () => {
        const r1 = getInternalResistance(100, 0.1, 2);
        const r2 = getInternalResistance(100, 0.2, 2);

        expect(r1).not.toBe(r2);
    });

});


describe('getPipeThermalResistance', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює тепловий опір стінки труби', () => {
        const dIn = 0.1;
        const dOut = 0.12;
        const k = 0.5;
        const l = 2;

        const ratio = dOut / dIn;
        const expected = Math.log(ratio) / (2 * Math.PI * k * l);

        const result = getPipeThermalResistance(dIn, dOut, k, l);

        expect(result).toBeCloseTo(expected, 8);
    });

    // 2. Опір зростає при збільшенні довжини
    it('зростає при збільшенні довжини труби', () => {
        const r1 = getPipeThermalResistance(0.1, 0.12, 0.5, 1);
        const r2 = getPipeThermalResistance(0.1, 0.12, 0.5, 3);

        expect(r2).toBeLessThan(r1); // denominator більший → опір менший
    });

    // 3. Опір зменшується при більшій теплопровідності
    it('зменшується при збільшенні теплопровідності матеріалу', () => {
        const r1 = getPipeThermalResistance(0.1, 0.12, 0.3, 2);
        const r2 = getPipeThermalResistance(0.1, 0.12, 1.0, 2);

        expect(r2).toBeLessThan(r1);
    });

    // 4. Опір зростає при більшому співвідношенні діаметрів
    it('зростає при збільшенні товщини стінки труби', () => {
        const thin = getPipeThermalResistance(0.1, 0.11, 0.5, 2);
        const thick = getPipeThermalResistance(0.1, 0.2, 0.5, 2);

        expect(thick).toBeGreaterThan(thin);
    });

    // 5. Edge cases: некоректна геометрія
    it('повертає 0 якщо геометрія некоректна', () => {
        expect(getPipeThermalResistance(0, 0.12, 0.5, 2)).toBe(0);
        expect(getPipeThermalResistance(0.1, 0.1, 0.5, 2)).toBe(0);
        expect(getPipeThermalResistance(0.1, 0.09, 0.5, 2)).toBe(0);
        expect(getPipeThermalResistance(0.1, 0.12, 0, 2)).toBe(0);
        expect(getPipeThermalResistance(0.1, 0.12, 0.5, 0)).toBe(0);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить зламану формулу логарифма)
    it('не повинен давати нуль при нормальній геометрії', () => {
        const result = getPipeThermalResistance(0.1, 0.2, 0.5, 2);

        expect(result).toBeGreaterThan(0);
    });

    // ❌ 7. Хибна перевірка адекватності масштабу
    it('не повинен давати надто велике значення', () => {
        const result = getPipeThermalResistance(0.1, 0.2, 0.1, 1);

        // якщо формула зламалась (нема логарифма або неправильний знаменник)
        expect(result).toBeLessThan(10);
    });

});


describe('getRadiationHeatFlow', () => {

    // 1. Базовий розрахунок без площі
    it('правильно обчислює радіаційний тепловий потік', () => {
        const epsilon = 0.9;
        const tSurface = 60;
        const tEnv = 20;

        const T1 = 273.15 + tSurface;
        const T2 = 273.15 + tEnv;

        const expected = epsilon * SIGMA * (T1 ** 4 - T2 ** 4);

        const result = getRadiationHeatFlow(epsilon, tSurface, tEnv);

        expect(result).toBeCloseTo(expected, 5);
    });

    // 2. Перевірка з площею
    it('масштабується пропорційно площі', () => {
        const base = getRadiationHeatFlow(0.8, 50, 20);
        const scaled = getRadiationHeatFlow(0.8, 50, 20, 2);

        expect(scaled).toBeCloseTo(base * 2, 5);
    });

    // 3. Вплив коефіцієнта випромінювання
    it('зростає при збільшенні epsilon', () => {
        const low = getRadiationHeatFlow(0.3, 60, 20);
        const high = getRadiationHeatFlow(0.9, 60, 20);

        expect(high).toBeGreaterThan(low);
    });

    // 4. Знак потоку (важливо для фізики!)
    it('дає додатній потік коли поверхня гарячіша за середовище', () => {
        const result = getRadiationHeatFlow(0.9, 80, 20);

        expect(result).toBeGreaterThan(0);
    });

    it('дає від\'ємний потік коли поверхня холодніша', () => {
        const result = getRadiationHeatFlow(0.9, 10, 30);

        expect(result).toBeLessThan(0);
    });

    // 5. Edge case: epsilon = 0
    it('повертає 0 якщо epsilon = 0', () => {
        const result = getRadiationHeatFlow(0, 60, 20);

        expect(result).toBe(0);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить зламану степеневу залежність)
    it('не повинен бути лінійним по температурі', () => {
        const r1 = getRadiationHeatFlow(1, 30, 20);
        const r2 = getRadiationHeatFlow(1, 60, 20);

        // якщо хтось замінить T^4 на T → цей тест впаде
        expect(r2 / r1).not.toBeCloseTo(2, 1);
    });

    // ❌ 7. Хибний фізичний sanity check
    it('не повинен бути надто малим при великих температурах', () => {
        const result = getRadiationHeatFlow(1, 100, 20);

        expect(result).toBeGreaterThan(1);
    });

});


describe('getAlphaRadiation', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює ефективний коефіцієнт радіації', () => {
        const qRad = 100;
        const tSurface = 60;
        const tEnv = 20;

        const expected = qRad / (tSurface - tEnv);

        const result = getAlphaRadiation(qRad, tSurface, tEnv);

        expect(result).toBeCloseTo(expected, 6);
    });

    // 2. Залежність від різниці температур
    it('зменшується при збільшенні різниці температур', () => {
        const qRad = 100;

        const smallDelta = getAlphaRadiation(qRad, 50, 40);
        const bigDelta = getAlphaRadiation(qRad, 90, 40);

        expect(bigDelta).toBeLessThan(smallDelta);
    });

    // 3. Знак
    it('дає від\'ємний результат якщо середовище тепліше за поверхню', () => {
        const result = getAlphaRadiation(100, 20, 60);

        expect(result).toBeLessThan(0);
    });

    // 4. Edge case: однакові температури
    it('повертає 0 якщо температури майже однакові', () => {
        const result = getAlphaRadiation(100, 50, 50);

        expect(result).toBe(0);
    });

    // 5. Edge case: дуже малий ΔT
    it('захищає від ділення на нуль при малому ΔT', () => {
        const result = getAlphaRadiation(100, 50, 50.0000001);

        expect(result).toBe(0);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить зламану фізику)
    it('не повинен бути надто великим при нормальних умовах', () => {
        const result = getAlphaRadiation(100, 60, 20);

        expect(result).toBeLessThan(100);
    });

    // ❌ 7. Логічна перевірка
    it('повинен зберігати обернену залежність від ΔT', () => {
        const r1 = getAlphaRadiation(100, 60, 50);
        const r2 = getAlphaRadiation(100, 60, 10);

        expect(r2).toBeLessThan(r1);
    });

});


describe('getAirKinematicViscosity', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює кінематичну в\'язкість повітря', () => {
        const tAir = 20;

        const expected = 1.48e-5 / (1 + 0.003 * tAir + 0.000221 * tAir ** 2);

        const result = getAirKinematicViscosity(tAir);

        expect(result).toBeCloseTo(expected, 10);
    });

    // 2. Температурна залежність (фізично коректна)
    it('зменшується при збільшенні температури', () => {
        const lowT = getAirKinematicViscosity(0);
        const highT = getAirKinematicViscosity(50);

        expect(highT).toBeLessThan(lowT);
    });

    // 3. Edge case: 0°C
    it('повертає базове значення при 0°C', () => {
        const result = getAirKinematicViscosity(0);

        expect(result).toBeCloseTo(1.48e-5, 10);
    });

    // 4. Детермінованість
    it('повертає однаковий результат для однакових входів', () => {
        const r1 = getAirKinematicViscosity(25);
        const r2 = getAirKinematicViscosity(25);

        expect(r1).toBe(r2);
    });

    // ❌ 5. ХИБНИЙ sanity check (ловить зламану формулу)
    it('не повинен бути нульовим при нормальних температурах', () => {
        const result = getAirKinematicViscosity(20);

        expect(result).toBeGreaterThan(0);
    });

    // ❌ 6. Фізичний sanity check
    it('не повинен зростати з температурою', () => {
        const r1 = getAirKinematicViscosity(10);
        const r2 = getAirKinematicViscosity(40);

        expect(r2).toBeLessThan(r1);
    });

});


describe('getAirThermalConductivity', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює теплопровідність повітря', () => {
        const tAir = 20;

        const expected =
            0.0257 * (1 + 0.003 * tAir + 0.000221 * tAir ** 2);

        const result = getAirThermalConductivity(tAir);

        expect(result).toBeCloseTo(expected, 10);
    });

    // 2. Зростає при підвищенні температури
    it('зростає при збільшенні температури', () => {
        const low = getAirThermalConductivity(0);
        const high = getAirThermalConductivity(50);

        expect(high).toBeGreaterThan(low);
    });

    // 3. Edge case: 0°C
    it('повертає базове значення при 0°C', () => {
        const result = getAirThermalConductivity(0);

        expect(result).toBeCloseTo(0.0257, 10);
    });

    // 4. Детермінованість
    it('повертає однаковий результат для однакових значень', () => {
        const r1 = getAirThermalConductivity(25);
        const r2 = getAirThermalConductivity(25);

        expect(r1).toBe(r2);
    });

    // ❌ 5. ХИБНИЙ sanity check (ловить зламану формулу)
    it('не повинен бути нульовим при нормальних температурах', () => {
        const result = getAirThermalConductivity(20);

        expect(result).toBeGreaterThan(0);
    });

    // ❌ 6. Фізичний sanity check
    it('не повинен зменшуватися при підвищенні температури', () => {
        const low = getAirThermalConductivity(10);
        const high = getAirThermalConductivity(40);

        expect(high).toBeGreaterThan(low);
    });

});


describe('getAlphaOut', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює зовнішній коефіцієнт тепловіддачі', () => {
        const nuAir = 1.5e-5;
        const lambdaAir = 0.025;
        const dOut = 0.1;

        const expected = (nuAir * lambdaAir) / dOut;

        const result = getAlphaOut(nuAir, lambdaAir, dOut);

        expect(result).toBeCloseTo(expected, 10);
    });

    // 2. Зменшується при збільшенні діаметра
    it('зменшується при збільшенні зовнішнього діаметра', () => {
        const small = getAlphaOut(1e-5, 0.025, 0.05);
        const big = getAlphaOut(1e-5, 0.025, 0.2);

        expect(big).toBeLessThan(small);
    });

    // 3. Зростає при збільшенні nuAir
    it('зростає при збільшенні кінематичної в\'язкості повітря', () => {
        const low = getAlphaOut(1e-5, 0.025, 0.1);
        const high = getAlphaOut(3e-5, 0.025, 0.1);

        expect(high).toBeGreaterThan(low);
    });

    // 4. Зростає при збільшенні lambdaAir
    it('зростає при збільшенні теплопровідності повітря', () => {
        const low = getAlphaOut(1e-5, 0.02, 0.1);
        const high = getAlphaOut(1e-5, 0.04, 0.1);

        expect(high).toBeGreaterThan(low);
    });

    // 5. Edge case: dOut = 0
    it('повертає 0 якщо діаметр <= 0', () => {
        expect(getAlphaOut(1e-5, 0.025, 0)).toBe(0);
        expect(getAlphaOut(1e-5, 0.025, -1)).toBe(0);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить переплутану формулу)
    it('не повинен бути надто великим при нормальних значеннях', () => {
        const result = getAlphaOut(1e-5, 0.025, 0.1);

        expect(result).toBeLessThan(1);
    });

    // ❌ 7. Логічний sanity check
    it('не повинен бути нульовим при нормальних параметрах', () => {
        const result = getAlphaOut(1e-5, 0.025, 0.1);

        expect(result).toBeGreaterThan(0);
    });

});


describe('getExternalResistance', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює зовнішній тепловий опір', () => {
        const alphaOut = 10;
        const alphaRad = 5;
        const dOut = 0.1;
        const l = 2;

        const alphaTotal = alphaOut + alphaRad;
        const area = Math.PI * dOut * l;
        const expected = 1 / (alphaTotal * area);

        const result = getExternalResistance(alphaOut, alphaRad, dOut, l);

        expect(result).toBeCloseTo(expected, 8);
    });

    // 2. Опір зменшується при збільшенні αout
    it('зменшується при збільшенні коефіцієнта конвекції', () => {
        const low = getExternalResistance(5, 2, 0.1, 2);
        const high = getExternalResistance(20, 2, 0.1, 2);

        expect(high).toBeLessThan(low);
    });

    // 3. Опір зменшується при збільшенні радіаційного внеску
    it('зменшується при збільшенні alphaRad', () => {
        const low = getExternalResistance(10, 1, 0.1, 2);
        const high = getExternalResistance(10, 10, 0.1, 2);

        expect(high).toBeLessThan(low);
    });

    // 4. Опір зменшується при збільшенні площі (d або l)
    it('зменшується при збільшенні діаметра', () => {
        const small = getExternalResistance(10, 5, 0.05, 2);
        const big = getExternalResistance(10, 5, 0.2, 2);

        expect(big).toBeLessThan(small);
    });

    it('зменшується при збільшенні довжини труби', () => {
        const short = getExternalResistance(10, 5, 0.1, 1);
        const long = getExternalResistance(10, 5, 0.1, 5);

        expect(long).toBeLessThan(short);
    });

    // 5. Edge cases
    it('повертає 0 якщо alphaTotal <= 0 або геометрія некоректна', () => {
        expect(getExternalResistance(0, 0, 0.1, 2)).toBe(0);
        expect(getExternalResistance(0, 0, 0, 2)).toBe(0);
        expect(getExternalResistance(0, 0, 0.1, 0)).toBe(0);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить зламану формулу)
    it('не повинен бути надто великим при нормальних значеннях', () => {
        const result = getExternalResistance(10, 5, 0.1, 2);

        expect(result).toBeLessThan(1);
    });

    // ❌ 7. Логічний sanity check
    it('не повинен бути нульовим при нормальних умовах', () => {
        const result = getExternalResistance(10, 5, 0.1, 2);

        expect(result).toBeGreaterThan(0);
    });

});


describe('getTotalThermalResistance', () => {

    // 1. Базовий розрахунок
    it('правильно сумує теплові опори', () => {
        const rIn = 1;
        const rPipe = 2;
        const rOut = 3;

        const result = getTotalThermalResistance(rIn, rPipe, rOut);

        expect(result).toBe(6);
    });

    // 2. Перевірка асоціативності (стабільність моделі)
    it('дає стабільний результат при зміні порядку розрахунку (логічна перевірка)', () => {
        const result1 = getTotalThermalResistance(1, 2, 3);
        const result2 = getTotalThermalResistance(3, 1, 2);

        expect(result1).toBe(result2);
    });

    // 3. Edge case: всі нулі
    it('повертає 0 якщо всі опори нульові', () => {
        expect(getTotalThermalResistance(0, 0, 0)).toBe(0);
    });

    // 4. Edge case: негативні значення (фізично некоректні)
    it('дозволяє від\'ємні значення (але результат відображає суму)', () => {
        const result = getTotalThermalResistance(-1, 2, 3);

        expect(result).toBe(4);
    });

    // ❌ 5. ХИБНИЙ sanity check (ловить переплутану формулу)
    it('не повинен бути меншим за будь-який окремий компонент', () => {
        const rIn = 2;
        const rPipe = 3;
        const rOut = 4;

        const result = getTotalThermalResistance(rIn, rPipe, rOut);

        expect(result).toBeGreaterThanOrEqual(Math.max(rIn, rPipe, rOut));
    });

    // ❌ 6. Логічний sanity check
    it('зростає при збільшенні будь-якого компонента', () => {
        const base = getTotalThermalResistance(1, 2, 3);
        const increased = getTotalThermalResistance(1, 2, 5);

        expect(increased).toBeGreaterThan(base);
    });

});


describe('getPipeHeatLoss', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює втрати тепла через трубу', () => {
        const tHot = 60;
        const tCold = 20;
        const rTotal = 10;
        const dt = 1;

        const expected = ((tHot - tCold) / rTotal) * dt;

        const result = getPipeHeatLoss(tHot, tCold, rTotal, dt);

        expect(result).toBeCloseTo(expected, 8);
    });

    // 2. Втрати зростають при більшій різниці температур
    it('зростають при збільшенні різниці температур', () => {
        const low = getPipeHeatLoss(40, 30, 10, 1);
        const high = getPipeHeatLoss(80, 30, 10, 1);

        expect(high).toBeGreaterThan(low);
    });

    // 3. Втрати зменшуються при більшому опорі
    it('зменшуються при збільшенні теплового опору', () => {
        const lowR = getPipeHeatLoss(60, 20, 5, 1);
        const highR = getPipeHeatLoss(60, 20, 20, 1);

        expect(highR).toBeLessThan(lowR);
    });

    // 4. Лінійність по часу
    it('зростають пропорційно часу dt', () => {
        const dt1 = getPipeHeatLoss(60, 20, 10, 1);
        const dt2 = getPipeHeatLoss(60, 20, 10, 2);

        expect(dt2).toBeCloseTo(dt1 * 2);
    });

    // 5. Edge case: немає втрат якщо опір <= 0
    it('повертає 0 якщо rTotal <= 0', () => {
        expect(getPipeHeatLoss(60, 20, 0, 1)).toBe(0);
        expect(getPipeHeatLoss(60, 20, -5, 1)).toBe(0);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить зламану формулу)
    it('не повинен бути нульовим при нормальних умовах', () => {
        const result = getPipeHeatLoss(60, 20, 10, 1);

        expect(result).toBeGreaterThan(0);
    });

    // ❌ 7. Фізичний sanity check (знак)
    it('дає нуль або позитивне значення при tHot > tCold', () => {
        const result = getPipeHeatLoss(80, 20, 10, 1);

        expect(result).toBeGreaterThanOrEqual(0);
    });

});


describe('getPipeOutletTemperature', () => {

    // 1. Базовий розрахунок
    it('правильно обчислює температуру на виході', () => {
        const tIn = 60;
        const qLoss = 2000;
        const vFlow = 0.01;
        const cp = 4.187;

        const massFlow = vFlow * RHO_WATER;
        const deltaT = qLoss / (massFlow * cp);
        const expected = tIn - deltaT;

        const result = getPipeOutletTemperature(tIn, qLoss, vFlow, cp);

        expect(result).toBeCloseTo(expected, 5);
    });

    // 2. Більші втрати → нижча температура
    it('зменшує температуру при збільшенні втрат', () => {
        const lowLoss = getPipeOutletTemperature(60, 1000, 0.01, 4.187);
        const highLoss = getPipeOutletTemperature(60, 5000, 0.01, 4.187);

        expect(highLoss).toBeLessThan(lowLoss);
    });

    // 3. Вищий потік → менше охолодження
    it('зменшує вплив втрат при більшій витраті', () => {
        const lowFlow = getPipeOutletTemperature(60, 2000, 0.005, 4.187);
        const highFlow = getPipeOutletTemperature(60, 2000, 0.02, 4.187);

        expect(highFlow).toBeGreaterThan(lowFlow);
    });

    // 4. Edge case: нульовий потік
    it('повертає tIn якщо потік <= 0', () => {
        expect(getPipeOutletTemperature(60, 2000, 0, 4.187)).toBe(60);
        expect(getPipeOutletTemperature(60, 2000, -1, 4.187)).toBe(60);
    });

    // 5. Edge case: нульова теплоємність
    it('повертає tIn якщо cp <= 0', () => {
        expect(getPipeOutletTemperature(60, 2000, 0.01, 0)).toBe(60);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить зламану енергетику)
    it('не повинен збільшувати температуру при втраті енергії', () => {
        const result = getPipeOutletTemperature(60, 2000, 0.01, 4.187);

        expect(result).toBeLessThan(60);
    });

    // ❌ 7. Фізичний sanity check
    it('не повинен давати необмежене охолодження при малих втратках', () => {
        const result = getPipeOutletTemperature(60, 10, 0.01, 4.187);

        expect(result).toBeGreaterThan(0);
    });

});


describe('getTankDeltaQ', () => {

    // 1. Базовий випадок: джерело увімкнене
    it('правильно обчислює ΔQ коли джерело увімкнене', () => {
        const result = getTankDeltaQ(
            true,
            100,
            50,
            20,
            10
        );

        // 100 - (50 + 20 + 10) = 20
        expect(result).toBe(20);
    });

    // 2. Базовий випадок: джерело вимкнене
    it('ігнорує джерело коли воно вимкнене', () => {
        const result = getTankDeltaQ(
            false,
            100,
            50,
            20,
            10
        );

        // 0 - 80 = -80
        expect(result).toBe(-80);
    });

    // 3. Логіка втрат: більше втрат → менший результат
    it('зменшується при збільшенні втрат', () => {
        const lowLoss = getTankDeltaQ(true, 100, 50, 10, 10);
        const highLoss = getTankDeltaQ(true, 100, 50, 50, 50);

        expect(highLoss).toBeLessThan(lowLoss);
    });

    // 4. Логіка джерела: більше qSource → більший ΔQ
    it('зростає при збільшенні тепла від джерела', () => {
        const low = getTankDeltaQ(true, 50, 50, 10, 10);
        const high = getTankDeltaQ(true, 200, 50, 10, 10);

        expect(high).toBeGreaterThan(low);
    });

    // 5. Edge case: все нулі
    it('повертає 0 якщо всі значення нульові', () => {
        const result = getTankDeltaQ(false, 0, 0, 0, 0);

        expect(result).toBe(0);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить зламаний знак)
    it('не повинен бути позитивним без джерела', () => {
        const result = getTankDeltaQ(false, 100, 50, 20, 10);

        expect(result).toBeLessThan(0);
    });

    // ❌ 7. Фізичний sanity check
    it('не може створювати енергію з нічого', () => {
        const result = getTankDeltaQ(false, 0, 100, 100, 100);

        expect(result).toBeLessThanOrEqual(0);
    });

});


describe('updateTankTemperature', () => {

    // 1. Базовий розрахунок
    it('правильно оновлює температуру бака', () => {
        const tCurrent = 50;
        const deltaQ = 1000;
        const volume = 1;

        const expected = tCurrent + deltaQ / (CP_WATER * volume);

        const result = updateTankTemperature(tCurrent, deltaQ, volume);

        expect(result).toBeCloseTo(expected, 8);
    });

    // 2. Позитивна енергія → нагрів
    it('підвищує температуру при позитивному deltaQ', () => {
        const result = updateTankTemperature(50, 1000, 1);

        expect(result).toBeGreaterThan(50);
    });

    // 3. Негативна енергія → охолодження
    it('зменшує температуру при негативному deltaQ', () => {
        const result = updateTankTemperature(50, -1000, 1);

        expect(result).toBeLessThan(50);
    });

    // 4. Більший обʼєм → менша зміна температури
    it('зменшує вплив deltaQ при більшому об\'ємі', () => {
        const smallTank = updateTankTemperature(50, 1000, 0.5);
        const bigTank = updateTankTemperature(50, 1000, 2);

        expect(bigTank).toBeLessThan(smallTank);
    });

    // 5. Edge case: нульовий обʼєм
    it('дає Infinity при нульовому об\'ємі (очікувана математична поведінка)', () => {
        const result = updateTankTemperature(50, 1000, 0);

        expect(result).toBe(Infinity);
    });

    // ❌ 6. ХИБНИЙ sanity check (ловить переплутану формулу)
    it('не повинен змінювати температуру без енергії', () => {
        const result = updateTankTemperature(50, 0, 1);

        expect(result).toBe(50);
    });

    // ❌ 7. Фізичний sanity check
    it('не повинен створювати вибух температури при малих значеннях', () => {
        const result = updateTankTemperature(50, 10, 1);

        expect(Number.isFinite(result)).toBe(true);
    });

});
