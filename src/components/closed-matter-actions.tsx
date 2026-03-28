"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  matterId: string;
};

export function ClosedMatterActions({ matterId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"reopen" | "delete" | null>(null);

  async function onReopen() {
    setBusy("reopen");
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" })
    });

    if (response.ok) {
      router.refresh();
      return;
    }

    setBusy(null);
  }

  async function onDelete() {
    const confirmed = window.confirm("Delete this closed matter permanently?");
    if (!confirmed) {
      return;
    }

    setBusy("delete");
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "DELETE"
    });

    if (response.ok) {
      router.refresh();
      return;
    }

    setBusy(null);
  }

  return (
    <div className="close-right">
      <button type="button" className="button btn-reopen" onClick={onReopen} disabled={busy !== null}>
        {busy === "reopen" ? (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ): (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 16.5C5 12.8505 7.0515 9.7084 10 8.29595C11.0674 7.78465 12.2523 7.5 13.5 7.5C18.1944 7.5 22 11.5294 22 16.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 14L5 16.5L2 12.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          )}
      </button>
      <button type="button" className="button btn-delete" onClick={onDelete} disabled={busy !== null}>
        {busy === "delete" ? (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg> 
          ):( 
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.687 6.21311L6.8 18.9761C6.89665 19.5604 7.19759 20.0914 7.6492 20.4745C8.10081 20.8576 8.67377 21.068 9.266 21.0681H12.614M19.312 6.21311L17.2 18.9761C17.1033 19.5604 16.8024 20.0914 16.3508 20.4745C15.8992 20.8576 15.3262 21.068 14.734 21.0681H11.386M10.022 11.1161V16.1651M13.978 11.1161V16.1651M2.75 6.21311H21.25M14.777 6.21311V4.43311C14.777 4.03528 14.619 3.65375 14.3377 3.37245C14.0564 3.09114 13.6748 2.93311 13.277 2.93311H10.723C10.3252 2.93311 9.94364 3.09114 9.66234 3.37245C9.38104 3.65375 9.223 4.03528 9.223 4.43311V6.21311H14.777Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            )}
      </button>
    </div>
  );
}
