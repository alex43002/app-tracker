import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Alerts } from "./pages/Alerts";
import { Dashboard } from "./pages/Dashboard";
import { Jobs } from "./pages/Jobs";
import { Match } from "./pages/Match";
import { Discovery } from "./pages/Discovery";
import { Compare } from "./pages/Compare";
import { Stories } from "./pages/Stories";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import { AuthGuard } from "./components/common/AuthGuard";
import { UserProvider } from "./store/UserProvider";

/** Auth-gated route wrapper that also provides the shared current-user store. */
function Protected({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <UserProvider>{children}</UserProvider>
    </AuthGuard>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route
          path="/"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />

        <Route
          path="/jobs"
          element={
            <Protected>
              <Jobs />
            </Protected>
          }
        />

        <Route
          path="/match"
          element={
            <Protected>
              <Match />
            </Protected>
          }
        />

        <Route
          path="/discover"
          element={
            <Protected>
              <Discovery />
            </Protected>
          }
        />

        <Route
          path="/compare"
          element={
            <Protected>
              <Compare />
            </Protected>
          }
        />

        <Route
          path="/alerts"
          element={
            <Protected>
              <Alerts />
            </Protected>
          }
        />

        <Route
          path="/stories"
          element={
            <Protected>
              <Stories />
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
