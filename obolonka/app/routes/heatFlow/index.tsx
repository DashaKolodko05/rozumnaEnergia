import type { Route } from "./+types";
import App from "./components/app";

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "Heat Flow Calculator" },
    ];
}

export default function HeatFlowHome() {
    return <App />;
}
