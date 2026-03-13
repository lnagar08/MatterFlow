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
              <span className="brand-matter">MATTER</span>
              <span className="brand-flow">FLOW</span>
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
              Flow Control
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
              MatterFlows
            </Link>
          </nav>

          <div className="app-nav-right">
            <form action="/home" method="get">
              <label className="search-wrap">
                <span className="search-icon" aria-hidden="true">
                  🔍
                </span>
                <input className="input top-search" name="q" placeholder="Search matters..." />
              </label>
            </form>
            <AdminDropdown userName={userName} />
          </div>
        </div>

        {mobileOpen ? (
          <div className="mobile-nav">
            <Link href="/home">Flow Control</Link>
            <Link href="/penalty-box">Flow Breakdown</Link>
            <Link href="/rules">Flow Controls</Link>
            <Link href="/templates">MatterFlows</Link>
            <Link href="/matters/new">New Matter</Link>
            <Link href="/matters/closed">Closed</Link>
            <Link href="/matters/archived">Archived</Link>
            <Link href="/settings/users">Users</Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
