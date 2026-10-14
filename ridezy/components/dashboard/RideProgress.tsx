import type { RideStatus } from "@/lib/rideApi";

const steps = ["Finding driver", "Driver assigned", "Driver arrived", "On trip", "Completed"];

/** Backend ride status → index of the step in progress (steps.length = finished). */
export function stepForStatus(status: RideStatus): number {
  switch (status) {
    case "SEARCHING":
      return 0;
    case "DRIVER_ASSIGNED":
    case "DRIVER_ARRIVING":
      return 1;
    case "DRIVER_ARRIVED":
      return 2;
    case "RIDE_STARTED":
      return 3;
    default:
      return steps.length;
  }
}

export default function RideProgress({
  current,
  note,
}: {
  /** Index of the step in progress. Use steps.length when the trip is finished. */
  current: number;
  /** Short status line shown on the right, e.g. "Searching for 1 min". */
  note?: string;
}) {
  const finished = current >= steps.length;
  const last = steps.length - 1;

  return (
    <section aria-label="Ride progress">
      {/* Header: the current step is shown by the track below, not repeated as a title */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">Ride status</p>
        {!finished && note && <p className="text-xs text-[#7A7A7A]">{note}</p>}
      </div>

      {/* Track */}
      <div className="relative mx-1 mt-4">
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
      <div className="relative mx-1 mt-2 h-4 text-[11px] sm:text-xs" aria-hidden="true">
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
