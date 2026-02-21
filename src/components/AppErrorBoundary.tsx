import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: unknown };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error("[AppErrorBoundary] Uncaught error:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      this.state.error instanceof Error
        ? this.state.error.message
        : typeof this.state.error === "string"
          ? this.state.error
          : "Unknown error";

    return (
      <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui, -apple-system" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>App crashed on startup</h1>
        <p style={{ marginBottom: 12 }}>
          This usually happens when required environment variables are missing or the app can’t reach Supabase.
        </p>
        <pre
          style={{
            background: "#f5f5f5",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            padding: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message}
        </pre>
        <p style={{ marginTop: 12, marginBottom: 12 }}>
          Fix: copy <code>env.example</code> → <code>.env.local</code>, set{" "}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart{" "}
          <code>npm run dev</code>.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #d4d4d4",
            background: "white",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

