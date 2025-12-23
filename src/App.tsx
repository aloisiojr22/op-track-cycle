import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import MainLayout from "@/components/layout/MainLayout";
import Auth from "@/pages/Auth";
import Activities from "@/pages/Activities";
import History from "@/pages/History";
import Pending from "@/pages/Pending";
import Chat from "@/pages/Chat";
import Logs from "@/pages/Logs";
import AdminPanel from "@/pages/admin/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to="/activities" replace />} />
                <Route path="dashboard" element={<Navigate to="/activities" replace />} />
                <Route path="activities" element={<Activities />} />
                <Route path="history" element={<History />} />
                <Route path="pending" element={<Pending />} />
                <Route path="chat" element={<Chat />} />
                <Route path="logs" element={<Logs />} />
                <Route path="admin" element={<AdminPanel />} />
                <Route path="admin/*" element={<AdminPanel />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
