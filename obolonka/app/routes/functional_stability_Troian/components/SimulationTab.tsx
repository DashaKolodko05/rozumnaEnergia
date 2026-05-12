import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

import { API_BASE_URL } from "consts";

export default function SimulationTab() {
  const [scenarios, setScenarios] = useState([]);
  
  const [simConfig, setSimConfig] = useState({ 
    scen_id: '', 
    type: 'Батарея', 
    v_nom: 230, 
    p_max: 6000, 
    cap_mode: 'Wh', 
    cap: 5120, 
    batt_v: 51.0, 
    limit: 20,
    soc_q3: 50,
    soc_q2: 30
  });
  
  const [simData, setSimData] = useState<any>(null);
  const [advisorData, setAdvisorData] = useState<any>(null);
  const [confirmedCuts, setConfirmedCuts] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [editingCutId, setEditingCutId] = useState<number | null>(null);

  // СХОВИЩЕ ДЛЯ ГОДИН
  const [originalHoursCache, setOriginalHoursCache] = useState<any>({});

  useEffect(() => { 
    fetch(`${API_BASE_URL}:6028/api/scenarios`).then(r => r.json()).then(d => { 
      setScenarios(d); 
      if(d.length) setSimConfig(c => ({...c, scen_id: d[0].id})); 
    }); 
  }, []);

  const formatHour = (h: number) => {
    const hours = Math.floor(h).toString().padStart(2, '0');
    const mins = h % 1 === 0 ? '00' : '30';
    return `${hours}:${mins}`;
  };

  const validateConfig = () => {
    if (!simConfig.scen_id) return "❌ Оберіть сценарій!";
    if (simConfig.v_nom <= 0) return "❌ Напруга мережі має бути > 0!";
    if (simConfig.type === 'Батарея') {
      if (simConfig.p_max <= 0) return "❌ Потужність інвертора має бути > 0!";
      if (simConfig.cap <= 0) return "❌ Ємність АКБ має бути > 0!";
      if (simConfig.cap_mode === 'Ah' && simConfig.batt_v <= 0) return "❌ Напруга АКБ має бути > 0!";
      if (simConfig.limit < 0 || simConfig.limit > 100) return "❌ Ліміт розряду має бути від 0 до 100%!";
      if (simConfig.soc_q3 < 0 || simConfig.soc_q3 > 100) return "❌ Ліміт для 3 черги має бути від 0 до 100%!";
      if (simConfig.soc_q2 < 0 || simConfig.soc_q2 > 100) return "❌ Ліміт для 2 черги має бути від 0 до 100%!";
    }
    return null;
  };

  const getFinalCapacityWh = () => {
    return simConfig.cap_mode === 'Ah' ? simConfig.cap * simConfig.batt_v : simConfig.cap;
  };

  // ФУНКЦІЯ ОТРИМАННЯ ОРИГІНАЛЬНОГО ГРАФІКА
  const getOriginalWorkingHours = (s: any) => {
    const uId = s.link_id || s.id;
    let hw = originalHoursCache[uId] || s.working_hours || s.hours;

    if (typeof hw === 'string') {
      try { hw = JSON.parse(hw); } catch(e) {
        hw = hw.replace(/[\[\]'"]/g, '').split(',').map((n: string) => Number(n.trim())).filter((n: number) => !isNaN(n));
      }
    }

    if (Array.isArray(hw) && hw.length > 0) {
      return hw.map(Number);
    }
    
    // Якщо взагалі нічого не знайшли — повертаємо 48 годин як запобіжник
    return Array.from({ length: 48 }).map((_, i) => i * 0.5);
  };

  const runSimulation = async () => {
    const error = validateConfig();
    if (error) return alert(error);

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}:6028/api/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenario_id: Number(simConfig.scen_id), 
          source_type: simConfig.type, 
          v_nom: Number(simConfig.v_nom), 
          p_max: Number(simConfig.p_max), 
          capacity_wh: getFinalCapacityWh(), 
          batt_limit: Number(simConfig.limit), 
          soc_q3: Number(simConfig.soc_q3), 
          soc_q2: Number(simConfig.soc_q2) 
        })
      });
      const result = await res.json();
      
      if(result.status === 'success') {
        const formatted = result.data.Hour.map((h: number, i: number) => ({
          time: formatHour(h),
          Power: result.data.Total_P[i],
          Voltage: result.data.V_outlet[i],
          SoC: result.data.SoC[i],
          Status: result.data.Status[i]
        }));
        setSimData(formatted);
      } else alert(result.detail);
    } catch (e) {
      alert("Помилка підключення до ядра симуляції.");
    } finally {
      setLoading(false);
    }
  };

  const runAdvisor = async () => {
    const error = validateConfig();
    if (error) return alert(error);

    setLoading(true);

    // ПЕРЕХОПЛЮВАЧ
    let originalMap: any = {};
    try {
      const devRes = await fetch(`${API_BASE_URL}:6028/api/scenarios/${simConfig.scen_id}/devices`);
      if (devRes.ok) {
        const devicesList = await devRes.json();
        devicesList.forEach((d: any) => {
          const id = d.link_id || d.id || d.device_id;
          if (id) originalMap[id] = d.working_hours || [];
        });
        console.log("✅ Перехоплені години з бази:", originalMap);
        setOriginalHoursCache(originalMap);
      }
    } catch (err) {
      console.warn("Не вдалося підтягнути години в обхід", err);
    }

    // ОСНОВНИЙ ЗАПИТ ДО РАДНИКА
    try {
      const res = await fetch(`${API_BASE_URL}:6028/api/advisor`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenario_id: Number(simConfig.scen_id), 
          source_type: "Батарея", 
          v_nom: Number(simConfig.v_nom), 
          p_max: Number(simConfig.p_max), 
          capacity_wh: getFinalCapacityWh(), 
          batt_limit: Number(simConfig.limit) 
        })
      });
      const result = await res.json();
      if(result.status === 'success') {
        let suggsArray = result.suggestions || [];
        
        if (!Array.isArray(suggsArray)) {
          suggsArray = Object.entries(suggsArray).map(([key, val]: any) => ({ ...val, id: Number(key) }));
        }
        
        if(suggsArray.length === 0) return alert("✅ Сценарій ідеальний! Відключень не потрібно.");
        
        setAdvisorData({ ...result, suggestions: suggsArray });
        
        const initialCuts: any = {};
        suggsArray.forEach((s: any) => {
          const cuts = s.final_cuts || s.suggested_cuts || [];
          initialCuts[s.link_id || s.id] = cuts;
        });
        setConfirmedCuts(initialCuts);
        setEditingCutId(null);
      }
    } catch (e) {
      alert("Помилка Радника. Перевірте з'єднання з бекендом.");
    } finally {
      setLoading(false);
    }
  };

  const applyAdvisor = async () => {
    await fetch(`${API_BASE_URL}:6028/api/advisor/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: Number(simConfig.scen_id), confirmed_cuts: confirmedCuts })
    });
    alert("✅ Оптимізацію застосовано! Графік приладів у базі змінено.");
    setAdvisorData(null);
    runSimulation();
  };

  const CustomPowerTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border shadow-lg rounded-lg text-sm">
          <p className="font-bold text-gray-800 border-b pb-1 mb-1">Час: {label}</p>
          <p className="text-orange-500 font-bold">Потужність: {data.Power.toFixed(2)} Вт</p>
          <p className="text-gray-600 mt-1">Статус: <span className={`font-bold ${data.Status === 'Норма' ? 'text-green-600' : 'text-red-500'}`}>{data.Status}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
      
      {/* ПАНЕЛЬ НАЛАШТУВАНЬ */}
      <div className="bg-white p-6 rounded-lg shadow border-t-4 border-green-500 h-fit space-y-4">
        <h2 className="text-xl font-bold text-gray-800">Налаштування симуляції</h2>
        
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Сценарій</label>
          <select className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" value={simConfig.scen_id} onChange={e => setSimConfig({...simConfig, scen_id: e.target.value})}>
            {scenarios.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Джерело живлення</label>
          <div className="flex bg-gray-100 p-1 rounded">
            <button onClick={() => setSimConfig({...simConfig, type: 'Мережа'})} className={`flex-1 text-sm py-1 rounded transition ${simConfig.type === 'Мережа' ? 'bg-white shadow font-bold text-blue-600' : 'text-gray-500'}`}>Мережа</button>
            <button onClick={() => setSimConfig({...simConfig, type: 'Батарея'})} className={`flex-1 text-sm py-1 rounded transition ${simConfig.type === 'Батарея' ? 'bg-white shadow font-bold text-green-600' : 'text-gray-500'}`}>Батарея</button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Номінальна напруга (В)</label>
          <input type="number" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" value={simConfig.v_nom} onChange={e => setSimConfig({...simConfig, v_nom: Number(e.target.value)})} />
        </div>

        {simConfig.type === 'Батарея' && (
          <div className="space-y-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Макс. потужність інвертора (Вт)</label>
              <input type="number" min="1" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none text-orange-600 font-bold" value={simConfig.p_max} onChange={e => setSimConfig({...simConfig, p_max: Number(e.target.value)})} />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Одиниці ємності АКБ</label>
              <div className="flex bg-gray-100 p-1 rounded mb-2">
                <button onClick={() => setSimConfig({...simConfig, cap_mode: 'Wh'})} className={`flex-1 text-xs py-1 rounded transition ${simConfig.cap_mode === 'Wh' ? 'bg-white shadow font-bold' : ''}`}>Ват-години (Wh)</button>
                <button onClick={() => setSimConfig({...simConfig, cap_mode: 'Ah'})} className={`flex-1 text-xs py-1 rounded transition ${simConfig.cap_mode === 'Ah' ? 'bg-white shadow font-bold' : ''}`}>Ампер-години (Ah)</button>
              </div>
              <input type="number" min="1" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" placeholder="Ємність" value={simConfig.cap} onChange={e => setSimConfig({...simConfig, cap: Number(e.target.value)})} />
            </div>

            {simConfig.cap_mode === 'Ah' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Напруга акумулятора (В)</label>
                <input type="number" min="1" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" value={simConfig.batt_v} onChange={e => setSimConfig({...simConfig, batt_v: Number(e.target.value)})} />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Ліміт повного розряду (до %)</label>
              <input type="number" min="0" max="100" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" value={simConfig.limit} onChange={e => setSimConfig({...simConfig, limit: Number(e.target.value)})} />
            </div>

            <div className="grid grid-cols-2 gap-2 bg-yellow-50 p-2 rounded border border-yellow-200">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">Вимкнути 3 чергу при &lt; (%)</label>
                <input type="number" className="w-full border p-1.5 text-sm rounded" value={simConfig.soc_q3} onChange={e => setSimConfig({...simConfig, soc_q3: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">Вимкнути 2 чергу при &lt; (%)</label>
                <input type="number" className="w-full border p-1.5 text-sm rounded" value={simConfig.soc_q2} onChange={e => setSimConfig({...simConfig, soc_q2: Number(e.target.value)})} />
              </div>
            </div>

            <button onClick={runAdvisor} disabled={loading} className="w-full bg-orange-500 text-white font-bold py-3 rounded shadow hover:bg-orange-600 mt-4 transition">
              {loading ? "⏳ Аналіз..." : "🛠️ Радник: Оптимізувати"}
            </button>
          </div>
        )}

        <button onClick={runSimulation} disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded shadow hover:bg-green-700 mt-2 transition">
          {loading ? "⏳ Розрахунок..." : "📈 Побудувати графіки"}
        </button>
      </div>

      {/* ПАНЕЛЬ ГРАФІКІВ */}
      <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow flex flex-col space-y-8">
        {simData ? (
          <>
            <div className="h-72 w-full border-b pb-8">
              <h3 className="font-bold text-center text-gray-700 mb-4">Динаміка споживання потужності (Вт)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={simData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="time" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} tickFormatter={(val) => val.toFixed(2)} />
                  <Tooltip content={<CustomPowerTooltip />} />
                  <Legend />
                  <Bar dataKey="Power" name="Сумарна Потужність" fill="#F59E0B" />
                  {simConfig.type === 'Батарея' && <ReferenceLine y={simConfig.p_max} stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: 'Ліміт інвертора', fill: 'red', fontSize: 12 }} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="h-72 w-full">
              <h3 className="font-bold text-center text-gray-700 mb-4">Стан електромережі та залишок заряду акумулятора</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="time" tick={{fontSize: 12}} />
                  
                  <YAxis yAxisId="left" domain={[0, 250]} tick={{fontSize: 12}} tickFormatter={(val) => val.toFixed(2)} />
                  {simConfig.type === 'Батарея' && <YAxis yAxisId="right" orientation="right" domain={[0, 105]} tick={{fontSize: 12}} tickFormatter={(val) => val.toFixed(2)} />}
                  
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
                    formatter={(value: number, name: string) => [value.toFixed(2), name === 'SoC' ? 'Заряд АКБ (%)' : name]}
                    labelFormatter={(label) => `Час: ${label}`}
                  />
                  <Legend />
                  
                  <Line yAxisId="left" type="monotone" dataKey="Voltage" name="Напруга мережі (В)" stroke="#2563EB" strokeWidth={2} dot={false} />
                  {simConfig.type === 'Батарея' && (
                    <>
                      <Line yAxisId="right" type="stepAfter" dataKey="SoC" name="Заряд батареї (%)" stroke="#10B981" strokeWidth={2} dot={false} />
                      <ReferenceLine yAxisId="right" y={simConfig.limit} stroke="darkgreen" strokeDasharray="3 3" />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
            <span className="text-6xl">📊</span>
            <p>Налаштуйте параметри зліва та натисніть "Побудувати графіки"</p>
          </div>
        )}
      </div>

      {/* МОДАЛЬНЕ ВІКНО РАДНИКА */}
      {advisorData && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">🛠️ Інтерактивний Радник Оптимізації</h2>
            
            <div className="mb-6 bg-gray-50 p-4 rounded-lg border">
              {advisorData.battery_info?.shortage ? (
                <p className="text-red-600 font-bold mb-1">🔴 Дефіцит енергії! Сценарій споживає більше, ніж є в АКБ.</p>
              ) : (
                <p className="text-orange-600 font-bold mb-1">⚠️ Виявлено пікове перевантаження інвертора!</p>
              )}
              <p className="text-sm text-gray-600">Оберіть прилади нижче, яким Радник пропонує змінити графік роботи.</p>
            
              {/* Загальний лічильник економії */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-green-600 font-bold text-lg">
                  📉 Загальна економія: -{
                    advisorData.suggestions.reduce((sum: number, s: any) => {
                      const uId = s.link_id || s.id;
                      const cCuts = confirmedCuts[uId] || [];
                      const origWorking = getOriginalWorkingHours(s);
                      
                      // Рахуємо ТІЛЬКИ ті відключення, які реально були робочими годинами
                      const validCuts = cCuts.filter((h: number) => origWorking.includes(h));
                      const oCuts = s.final_cuts || s.suggested_cuts || [];
                      const p = Number(s.p_nom) || Number(s.p) || (oCuts.length > 0 ? (Number(s.energy_saved_wh) / (oCuts.length * 0.5)) : 0);
                      
                      return sum + (validCuts.length * p * 0.5);
                    }, 0).toFixed(1)
                  } Вт·год
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {advisorData.suggestions.map((s: any) => {
                const uniqueId = s.link_id || s.id;
                const currentCuts = confirmedCuts[uniqueId] || [];
                const isSelected = currentCuts.length > 0;
                const isEditing = editingCutId === uniqueId;
                
                const origWorking = getOriginalWorkingHours(s);
                const validCuts = currentCuts.filter((h: number) => origWorking.includes(h));
                
                const origCuts = s.final_cuts || s.suggested_cuts || [];
                const p_nom = Number(s.p_nom) || Number(s.p) || (origCuts.length > 0 ? (Number(s.energy_saved_wh) / (origCuts.length * 0.5)) : 0);
                const energySaved = validCuts.length * p_nom * 0.5;
                
                const allDaySlots = Array.from({ length: 48 }).map((_, i) => i * 0.5);

                return (
                  <div key={uniqueId} className={`p-4 border-2 rounded-lg transition-colors ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    
                    <div className="flex justify-between items-center">
                      <label className="flex items-center space-x-3 font-bold cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500" checked={isSelected} 
                          onChange={(e) => {
                            setConfirmedCuts((prev: any) => {
                              const newCuts = { ...prev };
                              if(e.target.checked) newCuts[uniqueId] = s.final_cuts || s.suggested_cuts || [];
                              else delete newCuts[uniqueId];
                              return newCuts;
                            });
                          }} 
                        />
                        <span className="text-gray-800">[{s.priority || s.pri} черга] {s.name}</span>
                      </label>
                      <button type="button" onClick={(e) => { e.preventDefault(); setEditingCutId(isEditing ? null : uniqueId); }} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition">
                        {isEditing ? "Сховати" : "✏️ Редагувати"}
                      </button>
                    </div>

                    {isSelected && !isEditing && (
                      <div className="mt-3 ml-8 text-sm text-gray-700 bg-white p-3 rounded border border-orange-200">
                        <p>⚡ Реальна економія: <span className="font-bold text-green-600">-{energySaved.toFixed(2)} Вт·год</span></p>
                        <p className="mt-1">⏱ Відключено активних слотів: 
                          <span className="font-mono bg-gray-100 px-1 rounded ml-1">
                            {validCuts.length > 0 ? validCuts.map(formatHour).join(', ') : "Немає (у цей час прилад і так не працював)"}
                          </span>
                        </p>
                      </div>
                    )}

                    {isEditing && (
                      <div className="mt-4 ml-8 p-4 bg-white border border-blue-200 rounded-lg shadow-inner">
                        <p className="text-sm font-bold mb-1 text-gray-800">Ручне налаштування годин роботи:</p>
                        <p className="text-xs text-gray-500 mb-3">
                          <span className="inline-block w-3 h-3 bg-green-400 border border-green-600 rounded-full mr-1"></span> Працює
                          <span className="inline-block w-3 h-3 bg-red-500 border border-red-700 rounded-full ml-3 mr-1"></span> Відключено вручну
                          <span className="inline-block w-3 h-3 bg-red-50 border border-red-200 rounded-full ml-3 mr-1"></span> Не працює за планом
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          {allDaySlots.map((h: number) => {
                            const isOriginallyWorking = origWorking.includes(h);
                            const isCut = currentCuts.includes(h);
                            
                            // Якщо прилад в цей час за планом НЕ ПРАЦЮВАВ - малюємо неактивну бліду кнопку
                            if (!isOriginallyWorking) {
                              return (
                                <div key={h} title="Вимкнено за графіком" className="text-xs px-3 py-1.5 rounded border-2 font-bold shadow-sm bg-red-50 text-red-300 border-red-100 cursor-not-allowed opacity-70">
                                  {formatHour(h)}
                                </div>
                              );
                            }

                            // Якщо прилад працює за планом, даємо можливість його "відрізати"
                            return (
                              <button 
                                key={h} 
                                type="button" 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmedCuts((prev: any) => {
                                    const existingCuts = prev[uniqueId] || [];
                                    const alreadyCut = existingCuts.includes(h);
                                    let updatedCuts;
                                    if (alreadyCut) {
                                      updatedCuts = existingCuts.filter((x: number) => x !== h);
                                    } else {
                                      updatedCuts = [...existingCuts, h].sort((a: number, b: number) => a - b);
                                    }
                                    
                                    const newConfirmed = { ...prev };
                                    if (updatedCuts.length === 0) delete newConfirmed[uniqueId];
                                    else newConfirmed[uniqueId] = updatedCuts;
                                    return newConfirmed;
                                  });
                                }}
                                className={`text-xs px-3 py-1.5 rounded border-2 font-bold transition shadow-sm
                                  ${isCut ? 'bg-red-500 text-white border-red-600 shadow-inner scale-95' : 'bg-green-100 text-green-800 border-green-400 hover:bg-green-200 hover:scale-105'}`}
                              >
                                {formatHour(h)}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-4 pt-3 border-t flex justify-between items-center text-sm">
                          <span>Вже зекономлено: <span className="font-bold text-green-600">-{energySaved.toFixed(2)} Вт·год</span></span>
                          <span className="text-gray-500 font-bold">{validCuts.length} слотів відключено</span>
                        </div>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>
            
            <div className="flex space-x-4 pt-4 border-t">
              <button type="button" onClick={applyAdvisor} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow">
                Застосувати оптимізацію
              </button>
              <button type="button" onClick={() => setAdvisorData(null)} className="px-6 bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition">
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
