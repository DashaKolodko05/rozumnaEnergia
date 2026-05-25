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

function ErrorPopup({ message }) {
    return (
        <div className="error-popup">
            <p>{message}</p>
            <button onClick={() => window.history.back()}>Назад</button>
        </div>
    );
}

export default function Monitor() {
    const [data, setData] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const res = await api.get("/monitor");
            if (res.data.error) {
                setError(res.data.error);
                return;
            }
            setData(res.data);
        } catch {
            setError("Помилка завантаження даних");
        }
    }

    if (error) {
        return (
            <>
                <Navbar />
                <ErrorPopup message={error} />
            </>
        );
    }

    const inaLabels = data.map(entry => entry.INA226?.timestamp);
    const inaPmax = data.map(entry => entry.INA226?.Pmax);
    const inaVoc = data.map(entry => entry.INA226?.Voc);
    const inaIsc = data.map(entry => entry.INA226?.Isc);

    const pzemLabels = data.map(entry => entry.PZEM017?.timestamp);
    const pzemVoltage = data.map(entry => entry.PZEM017?.Voltage);
    const pzemCurrent = data.map(entry => entry.PZEM017?.Current);
    const pzemPower = data.map(entry => entry.PZEM017?.Power);

    return (
        <>
            <Navbar />
            <h2>Моніторинг даних</h2>

            <div className="chart-container">
                <Line
                    data={{
                        labels: inaLabels,
                        datasets: [
                            { label: "Pmax", data: inaPmax, borderColor: "red", fill: false },
                            { label: "Voc", data: inaVoc, borderColor: "blue", fill: false },
                            { label: "Isc", data: inaIsc, borderColor: "green", fill: false }
                        ]
                    }}
                    options={{ plugins: { title: { display: true, text: "INA226 Дані" } } }}
                />
            </div>

            <div className="chart-container">
                <Line
                    data={{
                        labels: pzemLabels,
                        datasets: [
                            { label: "Voltage", data: pzemVoltage, borderColor: "orange", fill: false },
                            { label: "Current", data: pzemCurrent, borderColor: "purple", fill: false },
                            { label: "Power", data: pzemPower, borderColor: "brown", fill: false }
                        ]
                    }}
                    options={{ plugins: { title: { display: true, text: "PZEM017 Дані" } } }}
                />
            </div>
        </>
    );
}
