import React, { useCallback, useState } from "react";
import Background from "./components/Background.jsx";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import DiscoverCarousel from "./components/DiscoverCarousel.jsx";
import MobileMenu from "./components/MobileMenu.jsx";
import AuthModal from "./components/AuthModal.jsx";

export default function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const submitAuth = useCallback((currentMode) => {
    alert(currentMode === "signup" ? "Account created (demo)!" : "Logged in (demo)!");
    setModalOpen(false);
  }, []);

  return (
    <>
      <Background />

      <main className="page">
        <section className="card" aria-label="DineSmart landing">
          <Nav
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
      />
    </>
  );
}
