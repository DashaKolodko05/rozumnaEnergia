import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {

    const isLogged = localStorage.getItem("auth") === "true";

    if (!isLogged) {

        return <Navigate to="/login" />;
    }

    return children;
}