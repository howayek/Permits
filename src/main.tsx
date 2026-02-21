import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/lib/auth";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import ProtectedRoute from "@/components/ui/ProtectedRoute"; // (kept if needed for future protected routes)
import Index from "@/pages/Index";
import AuthLogin from "@/pages/AuthLogin";
import Dashboard from "@/pages/Dashboard";
import ApplyIndex from "@/pages/ApplyIndex";
import ApplyPermitTypes from "@/pages/ApplyPermitTypes";
import ApplyStepper from "@/pages/ApplyStepper";
import "./index.css";
import Header from "@/components/ui/Header";
import GovLogin from "@/pages/GovLogin";
import GovDashboard from "@/pages/GovDashboard";
import OwnedPermits from "@/pages/OwnedPermits";
import GovDatabase from "@/pages/GovDatabase";
import VerifyPermit from "@/pages/VerifyPermit";
import ProvideInfo from "@/pages/ProvideInfo"; // NEW route for user supplemental info

const queryClient = new QueryClient();

(window as any).__APP_MOUNTED__ = true;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Header />
            <Routes>
              {/* Public / Landing */}
              <Route path="/" element={<Index />} />
              <Route path="/auth/login" element={<AuthLogin />} />
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Citizen */}
              <Route path="/my-permits" element={<OwnedPermits />} />
              <Route path="/applications/:id/provide-info" element={<ProvideInfo />} />

              {/* Apply Flow */}
              <Route path="/apply" element={<ApplyIndex />} />
              <Route path="/apply/:municipalityId" element={<ApplyPermitTypes />} />
              <Route path="/apply/:municipalityId/:permitType" element={<ApplyStepper />} />

              {/* Government */}
              <Route path="/gov/login" element={<GovLogin />} />
              <Route path="/gov" element={<GovDashboard />} />
              <Route path="/gov/database" element={<GovDatabase />} />

              {/* Public Permit Verification */}
              <Route path="/permits/:permitId" element={<VerifyPermit />} />
            </Routes>
          </QueryClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);