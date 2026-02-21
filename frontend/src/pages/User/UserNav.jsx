import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";

export default function UserNav({ active, onChange, avatarSrc, onLogout }) {
    const [pillScrolled, setPillScrolled] = useState(false);

    useEffect(() => {
        function onScroll() {
            setPillScrolled(window.scrollY > 10);
        }
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    function tabClass(tab) {
        return tab === active ? "is-active" : "";
    }

    return (
        <header className="nav">
            <a className="brand" href="#">
                <span className="brand__mark">
                    <img src={logo} className="logo-img" alt="Logo" />
                </span>
            </a>

            <div className={`nav__pill ${pillScrolled ? "nav__pill--scrolled" : ""}`}>
                <nav className="nav__links userNavLinks">
                    <a
                        href="#"
                        className={tabClass("search")}
                        onClick={(e) => {
                            e.preventDefault();
                            onChange("search");
                        }}
                    >
                        Search
                    </a>

                    <a
                        href="#"
                        className={tabClass("reservations")}
                        onClick={(e) => {
                            e.preventDefault();
                            onChange("reservations");
                        }}
                    >
                        Reservations
                    </a>

                    <a
                        href="#"
                        className={tabClass("diney")}
                        onClick={(e) => {
                            e.preventDefault();
                            onChange("diney");
                        }}
                    >
                        Diney
                    </a>
                </nav>

                <div className="nav__actions userNav__actions">
                    <button
                        className="userAvatar"
                        type="button"
                        aria-label="Open user profile"
                        onClick={(e) => {
                            e.preventDefault();
                            onChange("profile");
                        }}
                    >
                        {avatarSrc ? (
                            <img className="userAvatar__img" src={avatarSrc} alt="User avatar" />
                        ) : (
                            <span className="userAvatar__fallback">U</span>
                        )}
                    </button>

                    <button className="btn btn--ghost" type="button" onClick={onLogout}>
                        Log out
                    </button>
                </div>

                <button className="nav__burger" type="button" aria-label="Open menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </header>
    );
}