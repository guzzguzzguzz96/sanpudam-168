"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ContactActions } from "@/components/ui/contact-actions";
import { Icon } from "@/components/ui/icons";

const desktopQuery = "(min-width: 64rem)";

function isCurrentRoute(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ className, item, pathname, onClick }) {
  const active = isCurrentRoute(pathname, item.href);
  const currentPage = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={`${className}${active ? " is-active" : ""}`}
      aria-current={currentPage ? "page" : undefined}
      onClick={onClick}
      prefetch={false}
    >
      {item.label}
    </Link>
  );
}

export function SiteNavigation({ navigation, contactActions = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const pathname = usePathname();

  const closeMenu = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, []);

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
        closeMenu();
      }
    }

    // The mobile menu is hidden at desktop widths; close it so the page
    // scroll lock does not persist after a resize or rotation.
    const desktop = window.matchMedia(desktopQuery);
    function handleViewportChange(event) {
      if (event.matches) {
        closeMenu(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    desktop.addEventListener("change", handleViewportChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      desktop.removeEventListener("change", handleViewportChange);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeMenu, isOpen]);

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
                <NavigationLink
                  className="site-navigation__link"
                  item={item}
                  pathname={pathname}
                />
              </li>
            ))}
          </ul>
        </nav>
        <ContactActions
          actions={contactActions}
          className="site-header__actions"
          compact
        />
      </div>

      <div className="mobile-navigation" onBlur={handleBlur}>
        <button
          ref={triggerRef}
          type="button"
          className="mobile-navigation__trigger"
          aria-expanded={isOpen}
          aria-controls="mobile-site-navigation"
          onClick={() => setIsOpen((open) => !open)}
        >
          <Icon name={isOpen ? "close" : "menu"} />
          <span>{isOpen ? "ปิดเมนู" : "เมนู"}</span>
        </button>
        {isOpen ? (
          <button
            type="button"
            className="mobile-navigation__backdrop"
            aria-label="ปิดเมนูหลัก"
            tabIndex="-1"
            onClick={() => closeMenu()}
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
                    className="mobile-navigation__link"
                    item={item}
                    pathname={pathname}
                    onClick={() => closeMenu()}
                  />
                </li>
              ))}
            </ul>
            <ContactActions
              actions={contactActions}
              className="mobile-navigation__actions"
              layout="stack"
            />
          </nav>
        </div>
      </div>
    </>
  );
}
