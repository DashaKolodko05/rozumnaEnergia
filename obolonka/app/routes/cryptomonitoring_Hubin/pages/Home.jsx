import { useState } from "react";

import Navbar from "../components/Navbar";

import api from "../services/api";
import "./css/index.css";
import "./css/style.css";

export default function Home() {

    const [serverPublicKey, setServerPublicKey] = useState("");

    const [userPrivateKey, setUserPrivateKey] = useState("");

    async function submitKeys(e) {

        e.preventDefault();

        try {

            const res = await api.post(
                "/set_keys",
                {
                    server_public_key: serverPublicKey,
                    user_private_key: userPrivateKey
                }
            );

            console.log(res.data);

            alert(res.data.message);

        } catch (err) {

            console.log(err);

            console.log(err.response);

            console.log(err.response?.data);

            alert(
                err.response?.data?.error ||
                "Виникла помилка"
            );
        }
    }

    return (
        <>
            <Navbar />

            <h1>
                Вітаємо у системі моніторингу
            </h1>

            <form onSubmit={submitKeys}>

                <input
                    type="text"
                    placeholder="Публічний ключ сервера"
                    value={serverPublicKey}
                    onChange={(e) =>
                        setServerPublicKey(
                            e.target.value
                        )
                    }
                />

                <input
                    type="text"
                    placeholder="Приватний ключ користувача"
                    value={userPrivateKey}
                    onChange={(e) =>
                        setUserPrivateKey(
                            e.target.value
                        )
                    }
                />

                <button type="submit">
                    Встановити ключі
                </button>

            </form>
        </>
    );
}