import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../services/api";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from "chart.js";
import { Line } from "react-chartjs-2";
import "./css/index.css";
import "./css/style.css";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

// Компонент для показу помилки
function ErrorPopup({ message }) {
    return (
        <div className="error-popup">
            <p>{message}</p>
            <button onClick={() => window.history.back()}>Назад</button>
        </div>
    );
}

export default function Stats() {
    const [sensor, setSensor] = useState("INA226");
    const [statsData, setStatsData] = useState({});
    const [logs, setLogs] = useState([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [privateKey, setPrivateKey] = useState("");
    const [fileContent, setFileContent] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        try {
            const res = await api.get("/stats", {
                params: { sensor, start_date: startDate, end_date: endDate }
            });

            if (res.data.error) {
                setError(res.data.error);
                return;
            }

            setStatsData(res.data.stats_data);
            setLogs(res.data.logs);
        } catch {
            setError("Помилка статистики");
        }
    }

    function getPeakTypes(data) {
        const filtered = data.filter(v => v !== null);
        const min = Math.min(...filtered);
        const max = Math.max(...filtered);

        return data.map(v => {
            if (v === null) return "normal";
            if (v === min) return "min";
            if (v === max) return "max";
            return "normal";
        });
    }

    const colors = ["#e8751a", "#c51350", "#8a1253", "#fda403"];

    const datasets = Object.keys(statsData).map((param, index) => {
        const data = logs.map(log => log[param] ?? null);
        const peakTypes = getPeakTypes(data);

        return {
            label: param,
            data,
            borderColor: colors[index % colors.length],
            tension: 0.3,
            pointRadius: peakTypes.map(t => (t === "normal" ? 3 : 6)),
            pointBackgroundColor: peakTypes.map(t => {
                if (t === "min") return "blue";
                if (t === "max") return "red";
                return colors[index % colors.length];
            }),
            fill: false
        };
    });

    async function exportStats(e) {
        e.preventDefault();
        try {
            const res = await api.post(
                "/export_stats",
                { sensor, start_date: startDate, end_date: endDate, user_private_key: privateKey },
                { responseType: "blob" }
            );

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "stats.json");
            document.body.appendChild(link);
            link.click();
        } catch {
            alert("Помилка експорту");
        }
    }

    async function verifyStats(e) {
        e.preventDefault();
        try {
            const res = await api.post("/verify_stats_import", { file_content: fileContent });
            alert(res.data.message);
        } catch {
            alert("Помилка перевірки");
        }
    }

    // Якщо є помилка — показуємо ErrorPopup
    if (error) {
        return (
            <>
                <Navbar />
                <ErrorPopup message={error} />
            </>
        );
    }

    return (
        <>
            <Navbar />
            <h2>Статистика</h2>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    loadStats();
                }}
            >
                <select value={sensor} onChange={(e) => setSensor(e.target.value)}>
                    <option value="INA226">INA226</option>
                    <option value="PZEM017">PZEM017</option>
                </select>

                <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

                <button type="submit">Аналізувати</button>
            </form>

            <table border="1">
                <thead>
                    <tr>
                        <th>Параметр</th>
                        <th>Середнє</th>
                        <th>Мінімум</th>
                        <th>Максимум</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(statsData).map(([param, values]) => (
                        <tr key={param}>
                            <td>{param}</td>
                            <td>{values.avg}</td>
                            <td>{values.min}</td>
                            <td>{values.max}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="chart-container">
                <Line
                    data={{
                        labels: logs.map(log => log.timestamp),
                        datasets
                    }}
                />
            </div>

            <h3>Експорт статистики</h3>
            <form onSubmit={exportStats}>
                <input
                    type="text"
                    placeholder="Приватний ключ"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                />
                <button type="submit">Експорт</button>
            </form>

            <h3>Перевірка імпорту</h3>
            <form onSubmit={verifyStats}>
                <textarea
                    rows="8"
                    className="textarea-field"
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                />
                <button type="submit">Перевірити</button>
            </form>
        </>
    );
}
