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
      <nav className="bg-lime-200 p-4 flex flex-wrap gap-6 items-center rounded-md shadow-sm">
        <NavLink className="font-bold hover:text-lime-700 transition" to="sivuKaksi">
          toineen sivuun
        </NavLink >
        
        <NavLink 
          className="font-bold text-blue-800 bg-white px-4 py-2 rounded shadow hover:bg-blue-50 hover:text-blue-600 transition" 
          to="func_stab_Troian"
        >
          $ Smart Energy EMS (Троян)
        </NavLink>
        <NavLink className="font-bold hover:text-lime-700 transition" to="Monitoring_Monastyrnyi">
          Моніторинг (Монастирний)
        </NavLink >
      <nav className="bg-lime-200 p-4 mb-4 flex gap-4">
        <NavLink className="font-bold" to="sivuKaksi">
          toineen sivuun
        </NavLink >
        <NavLink className="font-bold" to="heat-flow">
          Heat Flow
        </NavLink >

         <NavLink className="font-bold hover:text-lime-700 transition" to="Battery_Kolodko">
          Аккумулятор (Колодько)
        </NavLink >
        </nav>
      </nav>

      <h1 className="text-4xl mb-4 mt-6">
        Це головна сторінка
      </h1>
      <h2 className="text-xl text-gray-700">
        вона поки ще порожня, бо я не до кінця уявляю як саме її треба оформити, але тут є панель навігації, у неї власне і треба додавати посилання на свої частини роботи
      </h2>
    </div>
  );
}
