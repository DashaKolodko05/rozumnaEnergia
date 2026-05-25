import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../services/api";
import "./css/index.css";
import "./css/style.css";
// Компонент для показу помилки
function ErrorPopup({ message }) {
    return (
        <div className="error-popup">
            <p>{message}</p>
            <button onClick={() => window.history.back()}>Назад</button>
        </div>
    );
}

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [sensor, setSensor] = useState("");
    const [sortBy, setSortBy] = useState("timestamp");
    const [order, setOrder] = useState("asc");
    const [privateKey, setPrivateKey] = useState("");
    const [fileContent, setFileContent] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        loadLogs();
    }, [sensor, sortBy, order]);

    async function loadLogs() {
        try {
            const res = await api.get("/logs", {
                params: { sensor, sort_by: sortBy, order }
            });

            if (res.data.error) {
                setError(res.data.error);
                return;
            }

            setLogs(res.data);
        } catch {
            setError("Помилка завантаження логів");
        }
    }

    async function exportLogs(e) {
        e.preventDefault();
        try {
            const res = await api.post(
                "/export_logs",
                { user_private_key: privateKey },
                { responseType: "blob" }
            );

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "logs.json");
            document.body.appendChild(link);
            link.click();
        } catch {
            alert("Помилка експорту");
        }
    }

    async function verifyImport(e) {
        e.preventDefault();
        try {
            const res = await api.post("/verify_import", {
                file_content: fileContent
            });
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
            <h2>Логи</h2>

            <form>
                <label>Фільтр датчика</label>
                <select value={sensor} onChange={(e) => setSensor(e.target.value)}>
                    <option value="">Всі</option>
                    <option value="INA226">INA226</option>
                    <option value="PZEM017">PZEM017</option>
                </select>
            </form>

            <table border="1">
                <thead>
                    <tr>
                        <th
                            onClick={() => {
                                setSortBy("timestamp");
                                setOrder(order === "asc" ? "desc" : "asc");
                            }}
                        >
                            Дата
                        </th>
                        <th
                            onClick={() => {
                                setSortBy("sensor");
                                setOrder(order === "asc" ? "desc" : "asc");
                            }}
                        >
                            Датчик
                        </th>
                        <th
                            onClick={() => {
                                setSortBy("data");
                                setOrder(order === "asc" ? "desc" : "asc");
                            }}
                        >
                            Дані
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log, index) =>
                        log.error ? (
                            <tr key={index}>
                                <td colSpan="3">{log.error}</td>
                            </tr>
                        ) : (
                            <tr key={index}>
                                <td data-label="Дата">{log.timestamp}</td>
                                <td data-label="Датчик">{log.sensor}</td>
                                <td data-label="Дані">
                                    {Object.entries(log.data).map(([k, v]) => (
                                        <div key={k}>
                                            {k}: {v}
                                        </div>
                                    ))}
                                </td>
                            </tr>
                        )
                    )}
                </tbody>
            </table>

            <h3>Експорт логів</h3>
            <form onSubmit={exportLogs}>
                <input
                    type="text"
                    placeholder="Приватний ключ"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                />
                <button type="submit">Експорт</button>
            </form>

            <h3>Перевірка імпорту</h3>
            <form onSubmit={verifyImport}>
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
