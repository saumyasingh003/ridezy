"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowRight,
} from "lucide-react";

interface CustomDateRangePickerProps {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  onApply: (from: string, to: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CustomDateRangePicker({
  fromDate,
  toDate,
  onApply,
  className = "",
}: CustomDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Staged selection before user clicks Apply
  const [selectedFrom, setSelectedFrom] = useState(fromDate);
  const [selectedTo, setSelectedTo] = useState(toDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Month currently viewed in calendar
  const initialView = fromDate ? new Date(fromDate + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());

  // Selecting state: null = not started or completed, 'setting_to' = clicked from, now picking to
  const [pickingStep, setPickingStep] = useState<"from" | "to">("from");

  // Keep in sync with external props
  useEffect(() => {
    setSelectedFrom(fromDate);
    setSelectedTo(toDate);
  }, [fromDate, toDate]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedFrom(fromDate);
        setSelectedTo(toDate);
        setHoverDate(null);
        setPickingStep("from");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, fromDate, toDate]);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar matrix calculation
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays: {
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
  }[] = [];

  // Prev month padding
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
    calendarDays.push({
      dateStr: toIsoDate(d),
      dayNum: daysInPrevMonth - i,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewYear, viewMonth, d);
    calendarDays.push({
      dateStr: toIsoDate(dateObj),
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill grid (total multiples of 7)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(viewYear, viewMonth + 1, i);
    calendarDays.push({
      dateStr: toIsoDate(d),
      dayNum: i,
      isCurrentMonth: false,
    });
  }

  const handleDayClick = (dateStr: string) => {
    if (pickingStep === "from") {
      setSelectedFrom(dateStr);
      setSelectedTo(dateStr);
      setPickingStep("to");
    } else {
      if (dateStr < selectedFrom) {
        setSelectedTo(selectedFrom);
        setSelectedFrom(dateStr);
      } else {
        setSelectedTo(dateStr);
      }
      setPickingStep("from");
    }
  };

  const handlePresetSelect = (daysAgo: number) => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - daysAgo);

    const fromStr = toIsoDate(past);
    const toStr = toIsoDate(today);

    setSelectedFrom(fromStr);
    setSelectedTo(toStr);
    setViewYear(past.getFullYear());
    setViewMonth(past.getMonth());
    setPickingStep("from");
  };

  const handleApply = () => {
    const finalFrom = selectedFrom <= selectedTo ? selectedFrom : selectedTo;
    const finalTo = selectedFrom <= selectedTo ? selectedTo : selectedFrom;
    onApply(finalFrom, finalTo);
    setIsOpen(false);
  };

  const isToday = (dateStr: string) => toIsoDate(new Date()) === dateStr;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button displaying current date range */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
            isOpen
              ? "bg-stone-100 border-black text-black ring-1 ring-black"
              : "bg-white border-stone-200 text-stone-800 hover:border-stone-400 hover:bg-stone-50"
          }`}
          title="Open Custom Calendar"
        >
          <CalendarIcon className="w-3.5 h-3.5 text-stone-600 shrink-0" />
          <span className="font-mono text-stone-900">
            {formatDisplayDate(selectedFrom) || "Select Start"}
          </span>
          <ArrowRight className="w-3 h-3 text-stone-400 shrink-0" />
          <span className="font-mono text-stone-900">
            {formatDisplayDate(selectedTo) || "Select End"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleApply}
          className="px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          Apply
        </button>
      </div>

      {/* Popover Calendar Modal */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 lg:right-0 lg:left-auto top-full mt-2 z-50 w-[320px] sm:w-[340px] bg-white rounded-2xl border border-stone-200 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
          {/* Quick Presets Strip */}
          <div className="flex items-center justify-between gap-1 pb-3 mb-3 border-b border-stone-100 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Quick Ranges:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePresetSelect(7)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              >
                7D
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(14)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              >
                14D
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(30)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              >
                30D
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(90)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              >
                90D
              </button>
            </div>
          </div>

          {/* Month / Year Navigation */}
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="font-caslon text-base font-bold text-stone-900">
                {MONTH_NAMES[viewMonth]}
              </span>
              <span className="font-mono text-xs font-semibold text-stone-500">
                {viewYear}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-black transition-colors cursor-pointer"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-black transition-colors cursor-pointer"
                aria-label="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="text-[10px] font-bold uppercase tracking-wider text-stone-400 py-1"
              >
                {w}
              </span>
            ))}
          </div>

          {/* Day Cells Matrix */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
              const isStart = selectedFrom === dateStr;
              const isEnd = selectedTo === dateStr;
              const inRange =
                selectedFrom &&
                selectedTo &&
                dateStr >= selectedFrom &&
                dateStr <= selectedTo;

              const isHovered =
                pickingStep === "to" &&
                selectedFrom &&
                hoverDate &&
                dateStr >= selectedFrom &&
                dateStr <= hoverDate;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDayClick(dateStr)}
                  onMouseEnter={() => setHoverDate(dateStr)}
                  className={`h-8 w-8 mx-auto rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer relative ${
                    !isCurrentMonth
                      ? "text-stone-300 hover:text-stone-500"
                      : "text-stone-800"
                  } ${
                    isStart || isEnd
                      ? "bg-black text-white font-bold shadow-xs hover:bg-black"
                      : inRange || isHovered
                      ? "bg-stone-100 text-stone-900 font-semibold"
                      : "hover:bg-stone-100"
                  } ${
                    isToday(dateStr) && !isStart && !isEnd
                      ? "ring-1 ring-stone-900 font-bold"
                      : ""
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Bottom Selected Range Preview & Actions */}
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
            <div className="text-[11px] text-stone-500 truncate">
              {pickingStep === "to" ? (
                <span className="text-stone-900 font-semibold animate-pulse">
                  Click to set end date
                </span>
              ) : (
                <span>
                  <strong className="text-stone-900 font-mono">
                    {formatDisplayDate(selectedFrom)}
                  </strong>
                  {" — "}
                  <strong className="text-stone-900 font-mono">
                    {formatDisplayDate(selectedTo)}
                  </strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedFrom(fromDate);
                  setSelectedTo(toDate);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1.5 text-xs text-stone-600 hover:text-black hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Check className="w-3 h-3" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
