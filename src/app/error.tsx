"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: Props) {
  return (
    <main style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ marginBottom: 16 }}>{error.message || "Unexpected application error."}</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
