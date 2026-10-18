"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

function isCurrentRoute(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ item, pathname, onClick }) {
  const active = isCurrentRoute(pathname, item.href);
  const currentPage = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={`site-navigation__link${active ? " is-active" : ""}`}
      aria-current={currentPage ? "page" : undefined}
      onClick={onClick}
      prefetch={false}
    >
      {item.label}
    </Link>
  );
}

export function SiteNavigation({ navigation, lineInquiryUrl }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector("a")?.focus({ preventScroll: true });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function handleBlur(event) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setIsOpen(false);
  }

  return (
    <>
      <div className="site-header__desktop">
        <nav aria-label="เมนูหลัก">
          <ul className="site-navigation__list">
            {navigation.map((item) => (
              <li key={item.href}>
                <NavigationLink item={item} pathname={pathname} />
              </li>
            ))}
          </ul>
        </nav>
        {lineInquiryUrl ? (
          <Button href={lineInquiryUrl} variant="secondary">
            สอบถามผ่าน LINE
          </Button>
        ) : null}
      </div>

      <div className="mobile-navigation" onBlur={handleBlur}>
        <button
          ref={triggerRef}
          type="button"
          className="mobile-navigation__trigger"
          aria-label={isOpen ? "ปิดเมนูหลัก" : "เปิดเมนูหลัก"}
          aria-expanded={isOpen}
          aria-controls="mobile-site-navigation"
          onClick={() => setIsOpen((open) => !open)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
          >
            {isOpen ? (
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
        {isOpen ? (
          <button
            type="button"
            className="mobile-navigation__backdrop"
            aria-label="ปิดเมนูหลัก"
            tabIndex="-1"
            onClick={() => {
              setIsOpen(false);
              triggerRef.current?.focus({ preventScroll: true });
            }}
          />
        ) : null}
        <div
          ref={panelRef}
          id="mobile-site-navigation"
          className="mobile-navigation__panel"
          hidden={!isOpen}
        >
          <nav aria-label="เมนูหลักสำหรับอุปกรณ์พกพา">
            <ul className="mobile-navigation__list">
              {navigation.map((item) => (
                <li key={item.href}>
                  <NavigationLink
                    item={item}
                    pathname={pathname}
                    onClick={() => {
                      setIsOpen(false);
                      triggerRef.current?.focus({ preventScroll: true });
                    }}
                  />
                </li>
              ))}
              {lineInquiryUrl ? (
                <li>
                  <Button
                    href={lineInquiryUrl}
                    className="mobile-navigation__line"
                  >
                    สอบถามผ่าน LINE
                  </Button>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
