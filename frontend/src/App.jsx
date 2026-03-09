import React, { useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import { useAuth } from "./auth/AuthContext.jsx";

import Background from "./components/Background.jsx";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import DiscoverCarousel from "./components/DiscoverCarousel.jsx";
import MobileMenu from "./components/MobileMenu.jsx";
import AuthModal from "./components/AuthModal.jsx";

import OwnerShell from "./pages/owner/OwnerShell.jsx";
import UserShell from "./pages/User/UserShell.jsx";
import AdminShell from "./pages/admin/AdminShell.jsx";
import AdminAccessPage from "./pages/admin/AdminAccessPage.jsx";
import UserSearch from "./pages/User/UserSearch.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import AdminRoute from "./routes/AdminRoute.jsx";

function AppContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [mobileOpen, setMobileOpen] = useState(false);
  const [landingView, setLandingView] = useState("full");
  const [searchPresetCuisine, setSearchPresetCuisine] = useState("");
  const [searchPresetToken, setSearchPresetToken] = useState(0);

  const { user, loading, logout } = useAuth();

  const openModal = useCallback((nextMode) => {
    setMode(nextMode);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);
  const toggleMode = useCallback(() => {
    setMode((m) => (m === "signup" ? "login" : "signup"));
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const location = useLocation();

  const goToSection = useCallback((view, id) => {
    setLandingView(view);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (!hash) return;
    if (hash === "search") goToSection("search", "search");
    else if (hash === "discover" || hash === "hero") goToSection("full", hash);
  }, [location.hash, goToSection]);

  return (
    <>
      <Background />

      <main className="page">
        <section className="card" aria-label="DineSmart landing">
          <Nav
            user={user}
            loading={loading}
            onLogout={logout}
            onLogin={() => openModal("login")}
            onSignup={() => openModal("signup")}
            onOpenMobile={openMobile}
            onGoSearch={() => goToSection("search", "search")}
            onGoDiscover={() => goToSection("full", "discover")}
            onGoHero={() => goToSection("full", "hero")}
          />

          {landingView === "full" && (
            <>
              <section id="hero">
                <Hero onGettingStarted={() => openModal("signup")} />
              </section>
              <section id="discover">
                <DiscoverCarousel
                  onSelectCuisine={(cuisineLabel) => {
                    setSearchPresetCuisine(cuisineLabel);
                    setSearchPresetToken((prev) => prev + 1);
                    goToSection("search", "search");
                  }}
                />
              </section>
            </>
          )}

          <section id="search">
            {landingView === "search" && (
              <UserSearch
                isGuest={!user}
                onRequireSignup={() => openModal("signup")}
                onSearchActiveChange={(active) => {
                  if (active) setLandingView("search");
                }}
                initialCuisine={searchPresetCuisine}
                initialCuisineToken={searchPresetToken}
              />
            )}
          </section>
        </section>
      </main>

      <MobileMenu
        isOpen={mobileOpen}
        onClose={closeMobile}
        user={user}
        loading={loading}
        onLogout={logout}
        onLogin={() => {
          closeMobile();
          openModal("login");
        }}
        onSignup={() => {
          closeMobile();
          openModal("signup");
        }}
      />

      <AuthModal isOpen={modalOpen} mode={mode} onClose={closeModal} onToggleMode={toggleMode} />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />

      {/* Email verification */}
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Owner area */}
      <Route path="/owner/profile" element={<OwnerShell />} />
      <Route path="/owner/*" element={<OwnerShell />} />

      {/* Admin area */}
      <Route path="/admin/auth" element={<AdminAccessPage />} />
      <Route
        path="/admin/dashboard"
        element={
          <AdminRoute>
            <AdminShell />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminShell />
          </AdminRoute>
        }
      />

      {/* User area */}
      <Route path="/explore" element={<UserShell initialActive="explore" />} />
      <Route path="/user/profile" element={<UserShell />} />
      <Route path="/user/*" element={<UserShell />} />
    </Routes>
  );
}
