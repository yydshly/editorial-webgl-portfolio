"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import MenuOverlay from "@/components/layout/MenuOverlay";
import UIButton from "@/components/ui/button";

type NavItem = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

type HeaderProps = {
  readonly brandName: string;
  readonly navItems: readonly NavItem[];
};

export default function Header({ brandName, navItems }: HeaderProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="brand">
            <span className="brand__name">{brandName}</span>
          </Link>
          <nav className="site-header__desktop-nav" aria-label="Primary">
            <ul className="site-header__desktop-list">
              {navItems.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="site-header__desktop-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="site-header__actions">
            <UIButton href="#news" variant="ghost" size="sm">
              Updates
            </UIButton>
            <button
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="site-menu-overlay"
              aria-label="Open navigation menu"
              className="menu-button"
              onClick={openMenu}
            >
              Menu
            </button>
          </div>
        </div>
      </header>
      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={closeMenu}
        menuItems={navItems}
      />
    </>
  );
  }
