import { NavLink } from "react-router";
import type { Route } from "./+types/kotiSivu";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Se on kotisivu!" },
  ];
}

export default function Home() {


  return (
    <div className="p-4">
      <nav className="bg-lime-200 p-4 mb-4 flex gap-4">
        <NavLink className="font-bold" to="sivuKaksi">
          toineen sivuun
        </NavLink >
        <NavLink className="font-bold" to="heat-flow">
          Heat Flow
        </NavLink >
      </nav>
      <h1 className="text-4xl mb-4">
        Це головна сторінка
      </h1>
      <h2 className="text-xl">
        вона поки ще порожня, бо я не до кінця уявляю як саме її треба оформити, але тут є панель навігації, у неї власне і треба додавати посилання на свої частини роботи
      </h2>

    </div>
  );
}
