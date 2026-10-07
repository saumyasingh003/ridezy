const steps = ["Booked", "Driver assigned", "On the way", "Completed"];

export default function RideProgress({
  current,
  eta,
}: {
  /** Index of the step in progress. Use steps.length when the trip is finished. */
  current: number;
  eta: number;
}) {
  const finished = current >= steps.length;
  const last = steps.length - 1;

  return (
    <section aria-label="Ride progress">
      {/* Header — matches the dashboard panel headers */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
            Ride status
          </p>
          <h2 className="mt-1.5 font-caslon text-2xl font-bold leading-none tracking-tight text-[#111111]">
            {finished ? "Trip Complete" : steps[current]}
          </h2>
          <div className="mt-3 h-[3px] w-10 bg-[#111111]" />
        </div>
        {!finished && (
          <p className="text-sm text-[#7A7A7A]">
            Driver arrives in <span className="font-semibold text-[#111111]">{eta} min</span>
          </p>
        )}
      </div>

      {/* Track */}
      <div className="relative mx-1 mt-8">
        {/* Base line + filled portion */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#E2E2E2]" />
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-[#111111] transition-all duration-500"
          style={{ width: `${(Math.min(current, last) / last) * 100}%` }}
        />

        <ol className="relative flex justify-between">
          {steps.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={step} aria-current={active ? "step" : undefined}>
                <span
                  className={`block h-2.5 w-2.5 rounded-full ${
                    done
                      ? "bg-[#111111]"
                      : active
                        ? "bg-white ring-2 ring-[#111111]"
                        : "bg-[#D9D9D9]"
                  }`}
                />
              </li>
            );
          })}
        </ol>
      </div>

      {/* Labels — each pinned under its own dot */}
      <div className="relative mx-1 mt-3 h-5 text-[11px] sm:text-xs" aria-hidden="true">
        {steps.map((step, i) => (
          <span
            key={step}
            className={`absolute top-0 whitespace-nowrap ${
              i <= current ? "font-semibold text-[#111111]" : "text-[#A3A3A3]"
            }`}
            style={{
              left: `${(i / last) * 100}%`,
              transform:
                i === 0 ? "translateX(-5px)" : i === last ? "translateX(calc(-100% + 5px))" : "translateX(-50%)",
            }}
          >
            {step}
          </span>
        ))}
      </div>
    </section>
  );
}
