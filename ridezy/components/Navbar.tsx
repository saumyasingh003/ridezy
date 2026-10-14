"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header
      className="
        absolute
        inset-x-0
        top-0
        z-30
        w-full
      "
    >
      <nav
        aria-label="Main"
        className="
          flex
          w-full
          items-center
          justify-between
          px-6
          py-5
          sm:px-10
          lg:px-14
        "
      >
        {/* Logo */}
        <Link
          href="/"
          aria-label="Ridezy home"
          className="flex items-center gap-2"
        >
          <span
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              bg-[#214D2A]
              text-white
              shadow-[0_6px_16px_rgba(33,77,42,0.25)]
            "
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
            </svg>
          </span>
          <span className="text-xl font-bold tracking-[-0.03em] text-[#111111]">
            Ridezy
          </span>
        </Link>

        {/* Links & CTA */}
        <div className="flex items-center gap-3">
          <ul
            className="
              flex
              items-center
              gap-1
              rounded-full
              border
              border-white/60
              bg-white/70
              p-1
              shadow-[0_4px_20px_rgba(0,0,0,0.06)]
              backdrop-blur-md
            "
          >
            {navLinks.map((link) => {
              const isActive = pathname === link.href;

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`
                      block
                      rounded-full
                      px-5
                      py-2
                      text-sm
                      font-semibold
                      transition-colors
                      duration-200
                      ${
                        isActive
                          ? "bg-[#111111] text-white"
                          : "text-[#3F4537] hover:bg-[#E5E9CA] hover:text-[#214D2A]"
                      }
                    `}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </header>
  );
}
