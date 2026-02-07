import React, { useCallback, useState } from "react";
import Background from "./components/Background.jsx";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import DiscoverCarousel from "./components/DiscoverCarousel.jsx";
import MobileMenu from "./components/MobileMenu.jsx";
import AuthModal from "./components/AuthModal.jsx";
import { useAuth } from "./auth/AuthContext.jsx";

export default function App() {
  const { user, loading, login, register, logout } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [mobileOpen, setMobileOpen] = useState(false);

  // (optional) show errors from server in modal
  const [authError, setAuthError] = useState("");

  const openModal = useCallback((nextMode) => {
    setAuthError("");
    setMode(nextMode);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setAuthError("");
  }, []);

  const toggleMode = useCallback(() => {
    setAuthError("");
    setMode((m) => (m === "signup" ? "login" : "signup"));
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  // Auth flow: connects AuthModal form submission to AuthContext (login/register)

  // IMPORTANT: AuthModal must call onSubmit with the form values:
  // onSubmit({ email, password, name? })
  const submitAuth = useCallback(
    async ({ email, password, name }) => {
      setAuthError("");

      try {
        if (mode === "login") {
          await login(email, password);
        } else {
          await register(name, email, password);
        }

        // success
        setModalOpen(false);
      } catch (e) {
        setAuthError(e?.message || "Authentication failed");
      }
    },
    [mode, login, register]
  );

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
          />

          <Hero onGettingStarted={() => openModal("signup")} />

          <DiscoverCarousel />
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

      <AuthModal
        isOpen={modalOpen}
        mode={mode}
        onClose={closeModal}
        onToggleMode={toggleMode}
        onSubmit={submitAuth}
        error={authError}
      />
    </>
  );
}