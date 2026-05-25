import { useState } from "react";

import { useNavigate } from "react-router-dom";

import api from "../services/api";
import "./css/index.css";
import "./css/style.css";

export default function Login() {

    const navigate = useNavigate();

    const [password, setPassword] = useState("");

    const [signature, setSignature] = useState("");

    async function handleLogin(e) {

        e.preventDefault();

        try {

            const res = await api.post("/login", {
                password,
                signature
            });

            if (res.data.success) {

                localStorage.setItem("auth", "true");

                navigate("/");

            } else {

                alert(res.data.message);
            }

        } catch {

            alert("Помилка авторизації");
        }
    }

    return (
        <div>

            <h2>Авторизація</h2>

            <form onSubmit={handleLogin}>

                <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <input
                    type="text"
                    placeholder="Цифровий підпис"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                />

                <button type="submit">
                    Увійти
                </button>

            </form>

        </div>
    );
}