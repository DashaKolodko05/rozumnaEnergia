import React, { useState, useEffect } from 'react';

import { API_BASE_URL } from "consts";

export default function ScenariosTab() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScen, setSelectedScen] = useState<number | null>(null);
  const [scenDevices, setScenDevices] = useState([]);
  const [equipment, setEquipment] = useState([]);

  // Стан для створення нового сценарію
  const [newScenName, setNewScenName] = useState("");

  // Стан форми приладів
  const [devForm, setDevForm] = useState({ eq_id: '', cab_len: '15', cab_sq: '2.5', cab_mat: 'Мідь', prio: 3, hours: [] as number[] });
  
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);

  const fetchScenarios = () => fetch(`${API_BASE_URL}:6028/api/scenarios`).then(r => r.json()).then(setScenarios);
  
  useEffect(() => { 
    fetchScenarios(); 
    fetch(`${API_BASE_URL}:6028/api/equipment`).then(r => r.json()).then(d => { 
      setEquipment(d); 
      if (d.length) setDevForm(f => ({ ...f, eq_id: d[0].id })); 
    }); 
  }, []);

  // --- НОВІ ФУНКЦІЇ ДЛЯ СЦЕНАРІЇВ ---
  const handleCreateScenario = async () => {
    if (!newScenName.trim()) return alert("❌ Введіть назву нового сценарію!");
    await fetch(`${API_BASE_URL}:6028/api/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newScenName, v_min: 198.0, v_max: 253.0 }) // Стандартні межі напруги
    });
    setNewScenName("");
    fetchScenarios();
  };

  const handleDeleteScenario = async (id: number, name: string) => {
    if (confirm(`Ви впевнені, що хочете видалити сценарій "${name}" та всі його прилади?`)) {
      await fetch(`${API_BASE_URL}:6028/api/scenarios/${id}`, { method: 'DELETE' });
      if (selectedScen === id) {
        setSelectedScen(null);
        setScenDevices([]);
      }
      fetchScenarios();
    }
  };
  // -----------------------------------

  const loadScenDevices = (id: number) => {
    setSelectedScen(id);
    fetch(`${API_BASE_URL}:6028/api/scenarios/${id}/devices`).then(r => r.json()).then(setScenDevices);
    handleCancel();
  };

  const toggleHour = (h: number) => {
    setDevForm(prev => ({
      ...prev, hours: prev.hours.includes(h) ? prev.hours.filter(x => x !== h) : [...prev.hours, h].sort((a, b) => a - b)
    }));
  };

  const formatHour = (h: number) => {
    const hours = Math.floor(h).toString().padStart(2, '0');
    const mins = h % 1 === 0 ? '00' : '30';
    return `${hours}:${mins}`;
  };

  const validateForm = () => {
    if (!selectedScen) return "❌ Оберіть сценарій зі списку зліва!";
    if (devForm.hours.length === 0) return "❌ Оберіть хоча б одну годину роботи!";
    if (Number(devForm.cab_len) <= 0) return "❌ Довжина кабелю має бути більшою за нуль!";
    if (Number(devForm.cab_sq) <= 0) return "❌ Переріз кабелю має бути більшим за нуль!";
    return null;
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) return alert(error);

    const payload = {
      equipment_id: Number(devForm.eq_id),
      hours: devForm.hours,
      cab_len: Number(devForm.cab_len),
      cab_sq: Number(devForm.cab_sq),
      cab_mat: devForm.cab_mat,
      priority: Number(devForm.prio)
    };

    if (editingLinkId) {
      await fetch(`${API_BASE_URL}:6028/api/devices/${editingLinkId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API_BASE_URL}:6028/api/scenarios/${selectedScen}/devices`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    loadScenDevices(selectedScen as number);
    handleCancel();
  };

  const handleEdit = (device: any) => {
    setEditingLinkId(device.link_id);
    const matchedEq = equipment.find((e: any) => e.name === device.name);

    setDevForm({
      eq_id: matchedEq ? matchedEq.id : equipment[0]?.id,
      cab_len: device.cab_len.toString(),
      cab_sq: device.cab_sq.toString(),
      cab_mat: device.cab_mat,
      prio: device.priority,
      hours: device.working_hours || []
    });
  };

  const handleCancel = () => {
    setEditingLinkId(null);
    setDevForm({ eq_id: equipment[0]?.id || '', cab_len: '15', cab_sq: '2.5', cab_mat: 'Мідь', prio: 3, hours: [] });
  };

  const removeDev = async (link_id: number, name: string) => {
    if (confirm(`Видалити прилад "${name}" з цього сценарію?`)) {
      await fetch(`${API_BASE_URL}:6028/api/devices/${link_id}`, { method: 'DELETE' });
      if (editingLinkId === link_id) handleCancel();
      loadScenDevices(selectedScen as number);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* 1 КОЛОНКА: СПИСОК СЦЕНАРІЇВ */}
      <div className="bg-white p-4 rounded-lg shadow h-fit flex flex-col">
        <h2 className="text-lg font-bold mb-4 text-gray-800">📂 Сценарії</h2>
        
        <ul className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto">
          {scenarios.map((s: any) => (
            <li 
              key={s.id} 
              className={`flex justify-between items-center p-3 rounded-lg cursor-pointer font-medium transition duration-150 shadow-sm border
                ${selectedScen === s.id ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-50 hover:bg-blue-50 border-gray-200 text-gray-700'}`}
              onClick={() => loadScenDevices(s.id)}
            >
              <span className="truncate pr-2">{s.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteScenario(s.id, s.name); }}
                className={`text-sm font-bold px-2 py-1 rounded transition ${selectedScen === s.id ? 'text-white hover:bg-red-500' : 'text-red-500 hover:bg-red-100'}`}
                title="Видалити сценарій"
              >
                ✕
              </button>
            </li>
          ))}
          {scenarios.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Немає сценаріїв</p>}
        </ul>

        {/* Форма створення нового сценарію */}
        <div className="mt-auto pt-4 border-t border-gray-200">
          <label className="block text-xs font-bold text-gray-500 mb-1">Створити новий</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Назва..." 
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none text-sm"
              value={newScenName} 
              onChange={e => setNewScenName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateScenario()}
            />
            <button 
              onClick={handleCreateScenario} 
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded transition shadow"
              title="Додати сценарій"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 3 КОЛОНКИ: ФОРМА ТА ТАБЛИЦЯ */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* ФОРМА ДОДАВАННЯ/РЕДАГУВАННЯ */}
        <div className={`bg-white p-6 rounded-lg shadow border-t-4 ${editingLinkId ? 'border-orange-500' : 'border-green-500'} ${!selectedScen && 'opacity-50 pointer-events-none'}`}>
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            {editingLinkId ? "✏️ Редагування приладу у сценарії" : "➕ Додати прилад у сценарій"}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">Оберіть прилад <span className="text-red-500">*</span></label>
              <select disabled={editingLinkId !== null} className={`w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none ${editingLinkId ? 'bg-gray-100 text-gray-500' : ''}`} value={devForm.eq_id} onChange={e => setDevForm({ ...devForm, eq_id: e.target.value })}>
                {equipment.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.model})</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Категорія важливості</label>
              <select className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" value={devForm.prio} onChange={e => setDevForm({ ...devForm, prio: Number(e.target.value) })}>
                <option value={1}>1 - Критична</option>
                <option value={2}>2 - Необхідна</option>
                <option value={3}>3 - Звичайна</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Кабель (Матеріал)</label>
              <select className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" value={devForm.cab_mat} onChange={e => setDevForm({ ...devForm, cab_mat: e.target.value })}>
                <option value="Мідь">Мідь</option>
                <option value="Алюміній">Алюміній</option>
              </select>
            </div>

            <div className="flex space-x-2">
              <div className="w-1/2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Довжина (м)</label>
                <input type="number" min="1" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" value={devForm.cab_len} onChange={e => setDevForm({ ...devForm, cab_len: e.target.value })} />
              </div>
              <div className="w-1/2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Переріз (мм^2)</label>
                <input type="number" min="0.5" step="0.5" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-300 outline-none" value={devForm.cab_sq} onChange={e => setDevForm({ ...devForm, cab_sq: e.target.value })} />
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-bold text-gray-700">Оберіть години роботи <span className="text-red-500">*</span></label>
              <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">Обрано: {devForm.hours.length} слотів</span>
            </div>
            <div className="flex flex-wrap gap-2 bg-gray-50 p-3 rounded-lg border">
              {Array.from({ length: 48 }).map((_, i) => {
                const h = i * 0.5;
                const isSelected = devForm.hours.includes(h);
                return (
                  <button 
                    key={h} 
                    onClick={() => toggleHour(h)} 
                    className={`text-xs px-2 py-1.5 rounded border font-medium transition-colors
                      ${isSelected ? 'bg-green-500 text-white border-green-600 shadow-inner' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-200'}`}
                  >
                    {formatHour(h)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex space-x-3">
            <button onClick={handleSave} className={`px-6 py-2 text-white font-bold rounded shadow transition ${editingLinkId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}>
              {editingLinkId ? "Зберегти зміни" : "Додати прилад"}
            </button>
            {editingLinkId && (
              <button onClick={handleCancel} className="px-6 py-2 bg-gray-300 text-gray-800 font-bold rounded hover:bg-gray-400 transition">
                Скасувати
              </button>
            )}
          </div>
        </div>

        {/* ТАБЛИЦЯ ПРИЛАДІВ У СЦЕНАРІЇ */}
        <div className="bg-white p-6 rounded-lg shadow overflow-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            {selectedScen ? "Список приладів у поточному сценарії" : "👈 Спочатку оберіть сценарій зліва"}
          </h2>
          
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm border-b-2 border-gray-300">
                <th className="p-3">Назва</th>
                <th className="p-3 text-center">Категорія важливості</th>
                <th className="p-3">Параметри кабелю</th>
                <th className="p-3">Години роботи</th>
                <th className="p-3 text-center">Дії</th>
              </tr>
            </thead>
            <tbody>
              {scenDevices.map((d: any) => (
                <tr key={d.link_id} className={`border-b transition duration-150 ${editingLinkId === d.link_id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                  <td className="p-3 font-bold text-gray-800">{d.name}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${d.priority === 1 ? 'bg-red-100 text-red-700' : d.priority === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {d.priority}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    <span className="font-semibold">{d.cab_mat}</span>, {d.cab_len} м, {d.cab_sq} мм²
                  </td>
                  <td className="p-3 text-xs text-gray-600 max-w-xs break-words">
                    {d.working_hours.length > 0 
                      ? d.working_hours.slice(0, 5).map(formatHour).join(', ') + (d.working_hours.length > 5 ? ` ... (ще ${d.working_hours.length - 5})` : '')
                      : <span className="text-red-500 font-bold">Не задано</span>
                    }
                  </td>
                  <td className="p-3 text-center space-x-3">
                    <button onClick={() => handleEdit(d)} className="text-blue-500 font-bold hover:text-blue-700">Ред.</button>
                    <button onClick={() => removeDev(d.link_id, d.name)} className="text-red-500 font-bold hover:text-red-700">Вид.</button>
                  </td>
                </tr>
              ))}
              {scenDevices.length === 0 && selectedScen && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">У цьому сценарії ще немає приладів.</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}