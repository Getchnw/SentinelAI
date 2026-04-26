import { useState } from "react";

export function ChatPanel() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="shell">
      <header>
        <h1>SentinelAI</h1>
        <p>Secure code assistant for vulnerabilities and safe fixes</p>
      </header>

      <section className="chat-box">
        <div className="bubble user">Scan this snippet and propose a safe fix.</div>
        <div className="bubble ai">
          {loading ? "Analyzing with AI..." : "Findings and fix preview will appear here."}
        </div>
      </section>

      <footer>
        <button
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1000);
          }}
        >
          Simulate Scan
        </button>
      </footer>
    </div>
  );
}
