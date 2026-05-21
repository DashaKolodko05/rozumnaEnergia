import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function IotGateway() {
  const [data, setData] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [status, setStatus] = useState('ОФЛАЙН');
  const [power, setPower] = useState({ solar: 0, battery: 0 });

  const fetchData = async () => {
    try {
      const response = await axios.get('http://77.47.192.6:6006/api/v1/telemetry/latest?limit=50'); 
      const rawData = response.data;
      
      if (!rawData || rawData.length === 0) return;

      // 1. Оновлюємо таблицю
      setTableData(rawData);

      // 2. Готуємо дані для графіка
      const reversedForChart = [...rawData].reverse().map(item => ({
        ...item,
        formattedTime: new Date(item.ts * 1000).toLocaleTimeString('uk-UA')
      }));
      setData(reversedForChart);

      // 3. Рахуємо ОНЛАЙН/ОФЛАЙН
      const latest = rawData[0];
      const nowSeconds = Math.floor(Date.now() / 1000);
      if ((nowSeconds - latest.ts) < 15) {
        setStatus('ОНЛАЙН');
      } else {
        setStatus('ОФЛАЙН');
      }

      // 4. Рахуємо потужність (Вт)
      setPower({
        solar: (latest.solar_v * latest.solar_a).toFixed(2),
        battery: (latest.bat_v * latest.bat_a).toFixed(2)
      });

    } catch (error) {
      console.error("Помилка при завантаженні даних:", error);
      setStatus('ОФЛАЙН');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  //Функція для генерації CSV під Excel
  const exportTableToCSV = () => {
    let csv = [];
    let bom = "\uFEFF"; 
    let headers = ["Timestamp", "Solar_V", "Solar_A", "Battery_V", "Battery_A"];
    csv.push(headers.join(";")); 
    
    tableData.forEach(item => {
      let fullDateString = new Date(item.ts * 1000).toLocaleString('uk-UA');
      let row = [fullDateString, item.solar_v, item.solar_a, item.bat_v, item.bat_a].map(cell => {
        let formattedCell = cell.toString().replace(/\./g, ',');
        return '"' + formattedCell + '"';
      });
      csv.push(row.join(";")); 
    });

    let csvFile = new Blob([bom + csv.join("\n")], {type: "text/csv;charset=utf-8;"});
    let downloadLink = document.createElement("a");
    downloadLink.download = "telemetry_export.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div style={{ padding: '20px', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", backgroundColor: '#F3F4F6', minHeight: '100vh', color: '#1F2937' }}>
      
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px 30px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span role="img" aria-label="zap">⚡</span> Smart Energy Dashboard
        </h1>
        <button 
          onClick={exportTableToCSV}
          style={{ padding: '10px 20px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
        >
          📥 Експорт CSV
        </button>
      </div>

      {/* Картки зі статусом та потужністю */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        
        {/* Картка Статусу */}
        <div style={{ flex: '1', backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: status === 'ОНЛАЙН' ? '5px solid #10B981' : '5px solid #EF4444', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '5px' }}>Статус системи</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: status === 'ОНЛАЙН' ? '#10B981' : '#EF4444' }}>
            {status}
          </div>
        </div>

        {/* Картка Потужності Сонця */}
        <div style={{ flex: '1', backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: '5px solid #F59E0B', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '5px' }}>Потужність Сонця</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937' }}>{power.solar} <span style={{fontSize: '16px', color: '#6B7280'}}>Вт</span></div>
        </div>

        {/* Картка Потужності Батареї */}
        <div style={{ flex: '1', backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: '5px solid #3B82F6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '5px' }}>Потужність Батареї</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937' }}>{power.battery} <span style={{fontSize: '16px', color: '#6B7280'}}>Вт</span></div>
        </div>

      </div>

      {/* Графік */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#6B7280' }}>Моніторинг Напруги (V)</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="formattedTime" stroke="#6B7280" tick={{fontSize: 12}} />
            <YAxis stroke="#6B7280" tick={{fontSize: 12}} />
            <Tooltip contentStyle={{ borderRadius: '8px' }} />
            <Legend />
            <Line type="monotone" dataKey="solar_v" stroke="#F59E0B" name="Сонце (V)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="bat_v" stroke="#3B82F6" name="Батарея (V)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Таблиця */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#6B7280' }}>Останні показники</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB', color: '#6B7280' }}>
                <th style={{ padding: '10px' }}>Час</th>
                <th style={{ padding: '10px' }}>Сонце (V)</th>
                <th style={{ padding: '10px' }}>Сонце (A)</th>
                <th style={{ padding: '10px' }}>Батарея (V)</th>
                <th style={{ padding: '10px' }}>Батарея (A)</th>
              </tr>
            </thead>
            <tbody>
              {tableData.slice(0, 10).map((row, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '10px' }}>{new Date(row.ts * 1000).toLocaleString('uk-UA')}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#F59E0B' }}>{row.solar_v}</td>
                  <td style={{ padding: '10px', color: '#6B7280' }}>{row.solar_a}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#3B82F6' }}>{row.bat_v}</td>
                  <td style={{ padding: '10px', color: '#6B7280' }}>{row.bat_a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default IotGateway;