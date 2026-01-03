import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Alerts } from "./pages/Alerts";
import { Dashboard } from "./pages/Dashboard";
import { Jobs } from "./pages/Jobs";
import Login from "./pages/Login";
import { AuthGuard } from "./components/common/AuthGuard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />

        <Route
          path="/jobs"
          element={
            <AuthGuard>
              <Jobs />
            </AuthGuard>
          }
        />

        <Route
          path="/alerts"
          element={
            <AuthGuard>
              <Alerts />
            </AuthGuard>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
