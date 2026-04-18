import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Patients from "./pages/Patients";
import ChestXRay from "./pages/ChestXRay";
import BoneXRay from "./pages/BoneXRay";
import BrainMRI from "./pages/BrainMRI";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import LandingPage from "./pages/LandingPage/LandingPage";

import Sidebar from "./components/Sidebar";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? <Navigate to="/chat" /> : children;
}

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">{children}</div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="/chat"    element={<Chat />} />
        <Route path="/login"   element={<Login />} />
        <Route path="/signup"  element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/history"
          element={
            <PrivateRoute>
              <Layout>
                <History />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <PrivateRoute>
              <Layout>
                <Patients />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/chest"
          element={
            <PrivateRoute>
              <Layout>
                <ChestXRay />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/bone"
          element={
            <PrivateRoute>
              <Layout>
                <BoneXRay />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/brain"
          element={
            <PrivateRoute>
              <Layout>
                <BrainMRI />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
