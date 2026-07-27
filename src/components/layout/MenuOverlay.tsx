"use client";

import { useEffect } from "react";

import { useScrollLock } from "@/lib/scroll/LenisProvider";
import UIButton from "@/components/ui/button";

type MenuItem = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

type MenuOverlayProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly menuItems: readonly MenuItem[];
  readonly containerRef?: never;
};

export default function MenuOverlay({
  isOpen,
  onClose,
  menuItems,
}: MenuOverlayProps) {
  const { lock } = useScrollLock();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const releaseLock = lock();

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const overlay = document.getElementById("site-menu-overlay");
    const closeButton = document.getElementById("menu-overlay-close");

    const getFocusableElements = () =>
      overlay
        ? Array.from(
            overlay.querySelectorAll<HTMLElement>(
              "a[href], button, [tabindex]:not([tabindex='-1'])",
            ),
          ).filter((element) => !element.hasAttribute("disabled"))
        : [];

    const focusFirst = () => {
      const focusables = getFocusableElements();
      const target = focusables[0];
      if (target) {
        target.focus();
      } else {
        closeButton?.focus();
      }
    };

    const releaseScroll = () => {
      document.body.style.overflow = "";
    };

    const lockScroll = () => {
      document.body.style.overflow = "hidden";
    };

    const restoreFocus = () => {
      if (previousActiveElement?.focus) {
        previousActiveElement.focus();
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = getFocusableElements();
      if (focusables.length === 0) {
        event.preventDefault();
        closeButton?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    lockScroll();
    focusFirst();
    document.addEventListener("keydown", onDocumentKeyDown);

    return () => {
      releaseLock();
      document.removeEventListener("keydown", onDocumentKeyDown);
      releaseScroll();
      restoreFocus();
    };
  }, [isOpen, onClose, lock]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      id="site-menu-overlay"
      className="menu-overlay is-open"
      role="dialog"
      aria-modal="true"
      aria-label="Main site menu"
    >
      <div className="menu-overlay__inner">
        <div className="menu-overlay__top">
          <p className="menu-overlay__title">Menu</p>
          <button
            id="menu-overlay-close"
            className="menu-close-button"
            type="button"
            aria-label="Close menu"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <nav aria-label="Main menu">
          <ul className="menu-overlay__list">
            {menuItems.map((item) => (
              <li key={item.id}>
                <UIButton
                  href={item.href}
                  variant="subtle"
                  size="lg"
                  onClick={onClose}
                >
                  {item.label}
                </UIButton>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <button
        className="menu-overlay__scrim"
        type="button"
        aria-label="Close menu"
        onClick={onClose}
      />
    </div>
  );
}
