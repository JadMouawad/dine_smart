import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // "verifying" | "success" | "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    fetch(`${API_BASE}/auth/verify-email?token=${token}`, { method: "GET" })
      .then((res) => res.json())
      .then((data) => {
        if (data.message && data.message.toLowerCase().includes("verified")) {
          setStatus("success");
          setMessage("Your email has been verified! You can now log in.");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [searchParams]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "Arial, sans-serif",
      background: "#f9f9f9",
      padding: "20px"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "12px",
        padding: "40px",
        maxWidth: "420px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
      }}>
        {status === "verifying" && (
          <>
            <h2>Verifying your email...</h2>
            <p style={{ color: "#666" }}>Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h2 style={{ color: "#16a34a" }}>Email Verified!</h2>
            <p style={{ color: "#666" }}>{message}</p>
            <button
              onClick={() => navigate("/")}
              style={{
                marginTop: "24px",
                padding: "12px 24px",
                background: "#d4a017",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: "600"
              }}
            >
              Go to Login
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>❌</div>
            <h2 style={{ color: "#dc2626" }}>Verification Failed</h2>
            <p style={{ color: "#666" }}>{message}</p>
            <button
              onClick={() => navigate("/")}
              style={{
                marginTop: "24px",
                padding: "12px 24px",
                background: "#d4a017",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: "600"
              }}
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
