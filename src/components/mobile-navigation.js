"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="mobile-navigation">
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
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <nav
        id="mobile-site-navigation"
        className="mobile-navigation__panel"
        aria-label="เมนูหลักสำหรับอุปกรณ์พกพา"
        hidden={!isOpen}
      >
        <ul className="mobile-navigation__list">
          {siteConfig.navigation.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="site-navigation__link"
                onClick={() => setIsOpen(false)}
                prefetch={false}
              >
                {item.label}
              </Link>
            </li>
          ))}
          {siteConfig.lineInquiryUrl ? (
            <li>
              <Button
                href={siteConfig.lineInquiryUrl}
                className="mobile-navigation__line"
              >
                สอบถามผ่าน LINE
              </Button>
            </li>
          ) : null}
        </ul>
      </nav>
    </div>
  );
}
