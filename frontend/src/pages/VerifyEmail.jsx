import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );
        const data = await response.json();
        if (data.message && data.message.toLowerCase().includes("verified")) {
          if (data.token) {
            await acceptSession({ token: data.token, user: data.user });
          }
          const role = data.user?.role;
          const redirect =
            role === "admin"
              ? "/admin/dashboard"
              : role === "owner"
                ? "/owner/profile?onboarding=1"
                : "/user/profile";
          if (role === "owner") {
            localStorage.setItem("owner_onboarding", "1");
          }
          setStatus("success");
          setMessage("Redirecting you now...");
          navigate(redirect, { replace: true });
          return;
        }
        setStatus("error");
        setMessage(data.message || "Verification failed.");
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    };

    verify();
  }, [searchParams, navigate]);

  return (
    <div className="verifyEmail">
      <div className="verifyEmail__card">
        {status === "verifying" && (
          <div className="verifyEmail__state">
            <div className="verifyEmail__spinner" aria-hidden="true" />
            <h2 className="verifyEmail__title">Verifying your email</h2>
            <p className="verifyEmail__text">Please wait a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="verifyEmail__state">
            <div className="verifyEmail__icon verifyEmail__icon--success">✓</div>
            <h2 className="verifyEmail__title verifyEmail__title--success">Email verified</h2>
            <p className="verifyEmail__text">{message}</p>
            <button type="button" className="btn btn--gold" onClick={() => (window.location.href = "/")}>
              Go to Home
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="verifyEmail__state">
            <div className="verifyEmail__icon verifyEmail__icon--error">✕</div>
            <h2 className="verifyEmail__title verifyEmail__title--error">Verification failed</h2>
            <p className="verifyEmail__text">{message}</p>
            <button type="button" className="btn btn--gold" onClick={() => navigate("/")}>
              Go Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
