import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Navbar() {

    const navigate = useNavigate();

    async function handleLogout() {

        try {

            await api.get("/logout");

            navigate("/login");

        } catch {

            alert("Помилка виходу");
        }
    }

    return (
        <nav>
            <ul style={{
                listStyle: "none",
                display: "flex",
                gap: "20px",
                padding: 0
            }}>
                <li>
                    <Link to="/">
                        Головна
                    </Link>
                </li>

                <li>
                    <Link to="/monitor">
                        Моніторинг
                    </Link>
                </li>

                <li>
                    <Link to="/logs">
                        Логи
                    </Link>
                </li>

                <li>
                    <Link to="/stats">
                        Статистика
                    </Link>
                </li>

                <li>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                            fontWeight: "bold"
                        }}
                    >
                        Вихід
                    </button>
                </li>
            </ul>
        </nav>
    );
}