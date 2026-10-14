import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";

const linkGroups = [
  {
    title: "Company",
    links: ["About Us", "Careers", "Blog", "Press"],
  },
  {
    title: "Support",
    links: ["Help Center", "Safety", "Contact Us", "Partner with Us"],
  },
  {
    title: "Legal",
    links: ["Terms & Conditions", "Privacy Policy", "Cookie Policy"],
  },
];

const socials = [
  {
    label: "LinkedIn",
    path: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z",
  },
  {
    label: "Instagram",
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38A5.86 5.86 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12a5.86 5.86 0 0 0 2.13 1.39c.76.29 1.64.5 2.91.55C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.12-1.38 5.86 5.86 0 0 0 1.39-2.13c.29-.76.5-1.64.55-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.12A5.86 5.86 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z",
  },
  {
    label: "X",
    path: "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z",
  },
  {
    label: "YouTube",
    path: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z",
  },
];

export default function Footer() {
  return (
    <footer className="w-full bg-[#FFFDF6] pt-10 sm:pt-14">
      <div className="w-full">
        {/* ==================================================
            DOWNLOAD BANNER
        =================================================== */}
        <div
          className="
            relative
            overflow-hidden
            flex
            items-center
            bg-[#CDD09B]
            bg-[url('/footer-cta-banner.webp')]
            bg-cover
            bg-left
            bg-no-repeat
            px-7
            py-9
            sm:px-10
            sm:py-11
            md:bg-right
            lg:aspect-[2046/379]
            lg:px-14
            lg:py-0
          "
        >
          <div className="relative z-10 max-w-md">
            <h2 className="font-caslon text-3xl sm:text-4xl font-bold tracking-tight text-[#111111]">
              Ready to Ride?
            </h2>
            <p className="mt-2 text-sm sm:text-[15px] leading-6 text-[#3F4537]">
              Track your rides, payments and trips — all in one place.
            </p>

            <Link
              href="/dashboard"
              className="
                group
                mt-6
                inline-flex
                items-center
                gap-2.5
                rounded-xl
                bg-[#111111]
                px-6
                py-3.5
                text-[15px]
                font-semibold
                text-white
                shadow-[0_8px_18px_-8px_rgba(0,0,0,0.5)]
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:bg-black
              "
            >
              <LayoutDashboard size={18} strokeWidth={2} />
              Explore Dashboard
              <ArrowRight
                size={16}
                strokeWidth={2.25}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>

        {/* ==================================================
            LINKS
        =================================================== */}
        <div
          className="
            grid
            grid-cols-2
            px-4
            sm:px-6
            lg:px-8
            gap-x-8
            gap-y-10
            py-12
            sm:grid-cols-3
            lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]
          "
        >
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <a href="#" className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#214D2A]" fill="currentColor" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
              </svg>
              <span className="text-2xl font-bold tracking-[-0.03em] text-[#111111]">
                Ridezy
              </span>
            </a>
          
            <address className="mt-4 ml-3 max-w-[240px] border-l-2 border-[#214D2A]/20 pl-3 text-[13px] not-italic leading-5 text-[#7A7A75]">
              4th Floor, Prestige Tech Park,
              <br />
              Outer Ring Road, Marathahalli,
              <br />
              Bengaluru, Karnataka 560103
            </address>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-[#111111]">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="
                        relative
                        text-sm
                        text-[#686863]
                        transition-colors
                        duration-200
                        after:absolute
                        after:-bottom-0.5
                        after:left-0
                        after:h-[1.5px]
                        after:w-full
                        after:origin-left
                        after:scale-x-0
                        after:rounded-full
                        after:bg-[#214D2A]
                        after:transition-transform
                        after:duration-300
                        after:ease-out
                        hover:text-[#214D2A]
                        hover:after:scale-x-100
                        focus-visible:text-[#214D2A]
                        focus-visible:outline-none
                        focus-visible:after:scale-x-100
                        active:after:scale-x-100
                      "
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Social + copyright */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 lg:justify-self-end">
            <div className="flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-full
                    text-[#111111]
                    transition-colors
                    duration-200
                    hover:bg-[#E5E9CA]
                    hover:text-[#214D2A]
                  "
                >
                  <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="currentColor">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
            <p className="mt-4 text-sm text-[#686863] lg:text-right">
              © {new Date().getFullYear()} Ridezy. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
