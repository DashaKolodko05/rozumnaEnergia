import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/kotiSivu.tsx"),
    route("sivuKaksi", "routes/sivuKaksi/index.tsx"),
    route("func_stab_Troian", "routes/functional_stability_Troian/index.tsx"),

    route("heat-flow", "routes/heatFlow/index.tsx"),

    route("sinusInvertor", "routes/sinusInvertor/index.jsx"),

    route("Monitoring_Monastyrnyi", "routes/Monitoring_Monastyrnyi/App.tsx"),
    route("Monitoring_Monastyrnyi/analytics/:type", "routes/Monitoring_Monastyrnyi/components/AnalyticsPage.tsx"),
    route("Monitoring_Monastyrnyi/comparison", "routes/Monitoring_Monastyrnyi/components/ComparisonPage.tsx"),

    route("iot-gateway", "routes/iotGateway/index.jsx"),
    
    route("cryptomonitoring_Hubin", "routes/cryptomonitoring_Hubin/index.jsx"),

] satisfies RouteConfig;
