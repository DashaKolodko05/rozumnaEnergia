import { useEffect, useState } from "react";
import type { Route } from "./+types/index";

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "二番目!" },
    ];
}

export default function Home() {
    const [luku, setLuku] = useState(0);

    const [text, setText] = useState("Warten Sie bitte, bis das Ladung fertig ist...");
    useEffect(() => {
        fetch("http://localhost:3000/dva").then((d) => {
            d.json().then((j) => {
                setText(j[0].kirje)
            })
        })
    }, [])

    return <div className="p-4">
        <h1 className="text-4xl mb-4">
            це друга сторінка
        </h1>
        <h2 className="text-2xl mb-4">
            voimme kuvitella, että tässä sivussa tapahtuu jokin hyödyllistä
        </h2>

        <button className="border-1 p-1 bg-gray-200 rounded-sm mb-1" onClick={() => { setLuku(luku + 1) }}>
            це кнопка, яка проводить умовно корисну дію
        </button>
        <p>
            結果: {luku}
        </p>

        <p>wiadomość: {text}</p>
    </div>;
}
