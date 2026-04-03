import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/lib/auth";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import Header from "@/components/ui/Header";
import { Toaster } from "@/components/ui/toaster";

import Index from "@/pages/Index";
import AuthLogin from "@/pages/AuthLogin";
import Dashboard from "@/pages/Dashboard";
import ApplyIndex from "@/pages/ApplyIndex";
import ApplyPermitTypes from "@/pages/ApplyPermitTypes";
import ApplyStepper from "@/pages/ApplyStepper";
import OwnedPermits from "@/pages/OwnedPermits";
import ProvideInfo from "@/pages/ProvideInfo";
import GovDashboard from "@/pages/GovDashboard";
import GovDatabase from "@/pages/GovDatabase";
import GovAdmin from "@/pages/GovAdmin";
import VerifyPermit from "@/pages/VerifyPermit";
import NotFound from "@/pages/NotFound";

import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Toaster />
            <Header />
            <Routes>
              {/* ── Public ─────────────────────────────────── */}
              <Route path="/" element={<Index />} />
              <Route path="/auth/login" element={<AuthLogin />} />
              <Route path="/apply" element={<ApplyIndex />} />
              <Route path="/apply/:municipalityId" element={<ApplyPermitTypes />} />

              {/* ── Citizen (authenticated) ─────────────────── */}
              <Route
                path="/apply/:municipalityId/:permitType"
                element={
                  <ProtectedRoute>
                    <ApplyStepper />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-permits"
                element={
                  <ProtectedRoute>
                    <OwnedPermits />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applications/:id/provide-info"
                element={
                  <ProtectedRoute>
                    <ProvideInfo />
                  </ProtectedRoute>
                }
              />

              {/* ── Government (role-gated) ─────────────────── */}
              <Route
                path="/gov"
                element={
                  <ProtectedRoute requiredRoles={["government", "developer", "admin", "clerk"]}>
                    <GovDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gov/database"
                element={
                  <ProtectedRoute requiredRoles={["government", "developer", "admin", "clerk"]}>
                    <GovDatabase />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gov/admin"
                element={
                  <ProtectedRoute requiredRoles={["government", "developer", "admin"]}>
                    <GovAdmin />
                  </ProtectedRoute>
                }
              />

              {/* ── Public Verification ──────────────────────── */}
              <Route path="/permits/:permitId" element={<VerifyPermit />} />

              {/* ── Catch-all ────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </QueryClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
