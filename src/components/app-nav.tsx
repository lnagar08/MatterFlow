"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminDropdown } from "@/components/admin-dropdown";

type AppNavProps = {
  active?: "home" | "penalty" | "new" | "closed" | "archived" | "templates" | "users" | "rules";
  userName?: string | null;
};

export function AppNav({ active, userName }: AppNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [penaltyCount, setPenaltyCount] = useState(0);
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({
    home: null,
    penalty: null,
    rules: null,
    templates: null
  });
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0, visible: false });
  const activeTopNav = useMemo(
    () => (active === "home" || active === "penalty" || active === "rules" || active === "templates" ? active : undefined),
    [active]
  );

  function moveIndicator(key?: "home" | "penalty" | "rules" | "templates") {
    if (!key || !navRef.current) {
      setIndicatorStyle((previous) => ({ ...previous, visible: false }));
      return;
    }
    const target = linkRefs.current[key];
    if (!target) return;
    const navRect = navRef.current.getBoundingClientRect();
    const linkRect = target.getBoundingClientRect();
    const computed = window.getComputedStyle(target);
    const padLeft = Number.parseFloat(computed.paddingLeft || "0") || 0;
    const padRight = Number.parseFloat(computed.paddingRight || "0") || 0;
    const innerWidth = Math.max(24, linkRect.width - padLeft - padRight);
    setIndicatorStyle({
      left: linkRect.left - navRect.left + padLeft,
      width: innerWidth,
      visible: true
    });
  }

  useLayoutEffect(() => {
    let raf = 0;
    const snapToActive = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => moveIndicator(activeTopNav));
    };

    snapToActive();
    const onResize = () => snapToActive();
    window.addEventListener("resize", onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [activeTopNav]);

  useEffect(() => {
    let mounted = true;
    async function loadPenaltyCount() {
      try {
        const response = await fetch("/api/penalty-box/count", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { count?: number };
        if (!mounted) return;
        setPenaltyCount(Math.max(0, Number(data.count ?? 0)));
      } catch {
        // ignore
      }
    }
    void loadPenaltyCount();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="app-shell">
      <div className="app-nav">
        <div className="app-nav-top">
          <div className="app-nav-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileOpen((value) => !value)}
            >
              ☰
            </button>
            <Link href="/home" className="home-brand">
              <span className="brand-matter">FLOW</span>
              <span className="brand-flow">GUARDIAN</span>
            </Link>
          </div>

          <nav
            className="app-nav-center"
            ref={navRef}
            onMouseLeave={() => requestAnimationFrame(() => moveIndicator(activeTopNav))}
            onBlur={() => requestAnimationFrame(() => moveIndicator(activeTopNav))}
          >
            <span
              className={`nav-underline ${indicatorStyle.visible ? "visible" : ""}`}
              style={{ width: indicatorStyle.width, transform: `translateX(${indicatorStyle.left}px)` }}
            />
            <Link
              ref={(element) => {
                linkRefs.current.home = element;
              }}
              className={`button top-tab ${active === "home" ? "primary" : ""}`}
              href="/home"
              onMouseEnter={() => moveIndicator("home")}
              onFocus={() => moveIndicator("home")}
            >
              Home
            </Link>
            <Link
              ref={(element) => {
                linkRefs.current.penalty = element;
              }}
              className={`button top-tab ${active === "penalty" ? "primary" : ""}`}
              href="/penalty-box"
              onMouseEnter={() => moveIndicator("penalty")}
              onFocus={() => moveIndicator("penalty")}
            >
              Flow Breakdown
              {penaltyCount > 0 ? <span className="nav-alert-badge">{penaltyCount}</span> : null}
            </Link>
            <Link
              ref={(element) => {
                linkRefs.current.rules = element;
              }}
              className={`button top-tab ${active === "rules" ? "primary" : ""}`}
              href="/rules"
              onMouseEnter={() => moveIndicator("rules")}
              onFocus={() => moveIndicator("rules")}
            >
              Flow Controls
            </Link>
            <Link
              ref={(element) => {
                linkRefs.current.templates = element;
              }}
              className={`button top-tab ${active === "templates" ? "primary" : ""}`}
              href="/templates"
              onMouseEnter={() => moveIndicator("templates")}
              onFocus={() => moveIndicator("templates")}
            >
              FlowGuardians
            </Link>
          </nav>

          <div className="app-nav-right">
            <form action="/home" method="get">
              <label className="search-wrap">
                <span className="search-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.5653 21.3498C10.8278 21.3498 9.12928 20.8346 7.68459 19.8692C6.23991 18.9039 5.11391 17.5319 4.449 15.9267C3.78408 14.3214 3.61011 12.555 3.94908 10.8509C4.28805 9.1468 5.12474 7.58146 6.35334 6.35286C7.58195 5.12425 9.14729 4.28756 10.8514 3.94859C12.5555 3.60962 14.3219 3.78359 15.9272 4.44851C17.5324 5.11342 18.9044 6.23942 19.8697 7.6841C20.835 9.12879 21.3503 10.8273 21.3503 12.5648C21.3503 13.7185 21.123 14.8608 20.6816 15.9267C20.2401 16.9925 19.593 17.961 18.7772 18.7767C17.9614 19.5925 16.993 20.2396 15.9272 20.6811C14.8613 21.1226 13.7189 21.3498 12.5653 21.3498ZM12.5653 5.54146C11.1808 5.54146 9.82743 5.952 8.67629 6.72117C7.52514 7.49034 6.62793 8.58359 6.09812 9.86267C5.56831 11.1418 5.42968 12.5492 5.69978 13.9071C5.96988 15.265 6.63656 16.5122 7.61553 17.4912C8.5945 18.4702 9.84178 19.1369 11.1996 19.407C12.5575 19.6771 13.965 19.5384 15.2441 19.0086C16.5231 18.4788 17.6164 17.5816 18.3856 16.4304C19.1547 15.2793 19.5653 13.9259 19.5653 12.5415C19.5653 10.6849 18.8278 8.90446 17.515 7.59171C16.2023 6.27895 14.4218 5.54146 12.5653 5.54146Z" fill="black"/>
                  <path d="M23.3336 24.2081C23.2187 24.2087 23.1047 24.1862 22.9986 24.1422C22.8924 24.0981 22.7961 24.0333 22.7153 23.9515L17.8969 19.1331C17.7424 18.9673 17.6582 18.7479 17.6622 18.5212C17.6662 18.2945 17.7581 18.0782 17.9184 17.9179C18.0787 17.7576 18.295 17.6658 18.5217 17.6618C18.7484 17.6578 18.9677 17.7419 19.1336 17.8965L23.9519 22.7148C24.1158 22.8789 24.2078 23.1013 24.2078 23.3331C24.2078 23.565 24.1158 23.7874 23.9519 23.9515C23.8712 24.0333 23.7749 24.0981 23.6687 24.1422C23.5625 24.1862 23.4486 24.2087 23.3336 24.2081Z" fill="black"/>
                  </svg>

                </span>
                <input className="input top-search" name="q" placeholder="Search matters..." />
              </label>
            </form>
            <AdminDropdown />
          </div>
        </div>

        {mobileOpen ? (
          <div className="mobile-nav">
            <Link href="/home">Home</Link>
            <Link href="/penalty-box">Flow Breakdown</Link>
            <Link href="/rules">Flow Controls</Link>
            <Link href="/templates">FlowGuardians</Link>
           
          </div>
        ) : null}
      </div>
    </header>
  );
}
