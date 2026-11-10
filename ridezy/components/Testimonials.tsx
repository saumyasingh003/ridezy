import Image from "next/image";
import { Star, Quote } from "lucide-react";

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  avatar: string;
}

const testimonials: Testimonial[] = [
  {
    name: "Ananya S.",
    role: "Daily commuter",
    quote:
      "Super convenient and reliable! I reach my office on time every day with Ridezy.",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    name: "Rohit K.",
    role: "Bike rider",
    quote:
      "Affordable and safe. The bikes are my go-to for quick rides around the city.",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    name: "Priya M.",
    role: "Weekend explorer",
    quote:
      "Love the clean interface and fast service. Highly recommended!",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
  },
];

export default function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-title"
      className="relative w-full overflow-hidden bg-[#FFFDF6] py-16 sm:py-20"
    >

      <div className="relative mx-auto max-w-7xl px-4 sm:px-10 lg:px-14">
        {/* Header */}
        <div className="text-center">
          <h2
            id="testimonials-title"
            className="font-caslon text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111]"
          >
            What Our Riders Say
          </h2>
          <p className="mt-2 sm:mt-3 text-xs sm:text-base text-[#686863]">
            Trusted by millions across the country.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-5 md:grid-cols-3 lg:gap-6">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="
                group
                relative
                flex
                gap-3.5
                sm:gap-4
                rounded-2xl
                sm:rounded-3xl
                border
                border-[#EDEDE8]
                bg-white
                p-4
                sm:p-6
                shadow-[0_1px_2px_rgba(0,0,0,0.03)]
                transition-all
                duration-300
                hover:-translate-y-1
                hover:shadow-[0_20px_40px_-16px_rgba(33,77,42,0.2)]
              "
            >
              <Quote
                aria-hidden="true"
                size={24}
                className="absolute right-4 top-4 text-[#E5E9CA] transition-colors duration-300 group-hover:text-[#C9D3A4]"
              />

              {/* Avatar */}
              <Image
                src={t.avatar}
                alt={t.name}
                width={56}
                height={56}
                className="h-11 w-11 sm:h-14 sm:w-14 shrink-0 rounded-full object-cover ring-4 ring-[#F3F4E5]"
              />

              <div className="min-w-0">
                <blockquote className="pr-4 sm:pr-6 text-xs sm:text-[15px] leading-5 sm:leading-6 text-[#3F4537]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <figcaption className="mt-3 sm:mt-4">
                  <p className="text-xs sm:text-sm font-bold text-[#111111]">{t.name}</p>
                  <p className="text-[11px] sm:text-xs text-[#8A8A84]">{t.role}</p>
                  <div
                    className="mt-2 flex gap-0.5"
                    aria-label="Rated 5 out of 5"
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={15}
                        className="fill-[#F5B301] text-[#F5B301]"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
