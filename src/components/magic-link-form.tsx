"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

type MagicLinkFormProps = {
  callbackUrl?: string;
  initialEmail?: string;
  title?: string;
};

export function MagicLinkForm({
  callbackUrl = "/home",
  initialEmail = "",
  title = "Sign in"
}: MagicLinkFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const response = await signIn("credentials", {
      email,
      redirect: false,
      callbackUrl
    });

    if (response?.ok) {
      setStatus("sent");
      window.location.href = callbackUrl;
      return;
    }

    setStatus("error");
  }

  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 10 }}>
      <label htmlFor="email" className="meta">
        {title}
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
        required
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 15
        }}
      />
      <button className="button primary" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Signing in..." : "Sign In"}
      </button>
      {status === "error" ? <p className="meta">Unable to sign in.</p> : null}
    </form>
  );
}
