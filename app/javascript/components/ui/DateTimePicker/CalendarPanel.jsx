import { useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import "../../../styles/datetime-picker.css";
import { createLocalDate, getTodayLocal, getNextHourLocal, getWeekRange } from "./dateUtils";
import TimePicker from "./TimePicker";


/**
 * CalendarPanel - Container that holds the calendar and time picker.
 *
 * This component orchestrates the layout of date selection (via react-calendar)
 * and time selection (via TimePicker).
 *
 * Props:
 * - pickerType: "date" | "date-range" | "date-time" | "time"
 * - selectedDate: currently selected date
 * - selectedRange: currently selected range { start, end }
 * - selectedTime: currently selected time
 * - dateTimeHour: hour for date-time mode (0-23)
 * - dateTimeMinute: minute for date-time mode (0-59)
 * - onDateChange: callback when date is selected (temporary, doesn't commit)
 * - onConfirm: callback to confirm and commit the selection (closes picker)
 * - onTimeChange: callback when time is selected (temporary, doesn't commit)
 * - onTimeConfirm: callback when time selection is confirmed (commits and closes picker)
 * - onTimeReset: callback for time picker reset button
 * - onDateTimeChange: callback when date-time hour/minute changes
 * - primaryColor: theme color for primary actions
 * - secondaryColor: theme color for secondary elements
 */
export default function CalendarPanel({
  pickerType,
  selectedDate,
  selectedRange,
  selectedTime,
  dateTimeHour,
  dateTimeMinute,
  onDateChange,
  onConfirm,
  onTimeChange,
  onTimeConfirm,
  onTimeReset,
  onDateTimeChange,
  primaryColor,
  secondaryColor,
}) {
  // Track the calendar's current view date for navigation
  const [calendarValue, setCalendarValue] = useState(new Date());
  
  // Update calendar view when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setCalendarValue(selectedDate);
    }
  }, [selectedDate]);

  // Dark mode detection - apply dark class to calendar wrapper
  const wrapperRef = useRef(null);
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const updateDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark');
      wrapperRef.current.setAttribute('data-dark', isDark ? 'true' : 'false');
    };
    
    updateDarkMode();
    
    // Watch for theme changes
    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Determine which sections to show based on pickerType
  const showCalendar = pickerType === "date" || pickerType === "date-range" || pickerType === "date-time";
  const showTimePicker = pickerType === "time";
  const isTimeOnly = pickerType === "time";

  // Date-time controls: fall back to 0 when hour/minute aren't set yet
  const hour24 = dateTimeHour ?? 0;
  const minute = dateTimeMinute ?? 0;
  const isPM = hour24 >= 12;
  const hasSelectedDate = selectedDate instanceof Date;

  // Step the hour within the current AM/PM half so the period is preserved
  const stepHour = (delta) => {
    const newHour = (isPM ? 12 : 0) + ((hour24 % 12) + delta + 12) % 12;
    onDateTimeChange?.({ hour: newHour, minute });
  };

  const stepMinute = (delta) => {
    onDateTimeChange?.({ hour: hour24, minute: (minute + delta + 60) % 60 });
  };

  const togglePeriod = () => {
    onDateTimeChange?.({ hour: (hour24 + 12) % 24, minute });
  };

  // Helper: Check if a date falls within the selected range (inclusive)
  const isDateInRange = (date, start, end) => {
    if (!start || !end) return false;
    const check = new Date(date);
    check.setHours(0, 0, 0, 0);
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    return check >= s && check <= e;
  };

  // Helper: Check if two dates are equal (ignoring time)
  const isSameDate = (date1, date2) => {
    if (!date1 || !date2) return false;
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  // Action bar presets are active when the current selection matches what they would pick
  const todayLocal = getTodayLocal();
  const tomorrowLocal = createLocalDate(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate() + 1);
  const isSameRange = (range, week) =>
    isSameDate(range?.start, week.start) && isSameDate(range?.end, week.end);

  // Handle date selection from calendar
  const handleCalendarChange = (date) => {
    onDateChange(date);
    // For date-range, navigate calendar to show the selected date
    if (pickerType === "date-range") {
      setCalendarValue(date);
    }
  };

  // Handle Today preset button
  const handleToday = () => {
    const today = getTodayLocal();
    onDateChange(today);
    setCalendarValue(today);
    // For date-time mode, also initialize time to next hour if not already set
    if (pickerType === "date-time" && onDateTimeChange) {
      const nextHour = getNextHourLocal(new Date());
      onDateTimeChange({
        hour: nextHour.getHours(),
        minute: 0
      });
    }
  };

  // Handle Tomorrow preset button
  const handleTomorrow = () => {
    const today = getTodayLocal();
    const tomorrow = createLocalDate(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );
    onDateChange(tomorrow);
    setCalendarValue(tomorrow);
    // For date-time mode, also initialize time to next hour if not already set
    if (pickerType === "date-time" && onDateTimeChange) {
      const nextHour = getNextHourLocal(new Date());
      onDateTimeChange({
        hour: nextHour.getHours(),
        minute: 0
      });
    }
  };

  // Handle This Week preset button (date-range only)
  const handleThisWeek = () => {
    onDateChange(getWeekRange(getTodayLocal()));
  };

  // Handle Next Week preset button (date-range only)
  const handleNextWeek = () => {
    onDateChange(getWeekRange(getTodayLocal(), 1));
  };

  const actionBarPresets = pickerType === "date-range"
    ? [
        { label: "This Week", onClick: handleThisWeek, isActive: isSameRange(selectedRange, getWeekRange(todayLocal)) },
        { label: "Next Week", onClick: handleNextWeek, isActive: isSameRange(selectedRange, getWeekRange(todayLocal, 1)) },
      ]
    : [
        { label: "Today", onClick: handleToday, isActive: hasSelectedDate && isSameDate(selectedDate, todayLocal) },
        { label: "Tomorrow", onClick: handleTomorrow, isActive: hasSelectedDate && isSameDate(selectedDate, tomorrowLocal) },
      ];

  return (
    <div className="p-3">
      {showCalendar && (
        <div className="" style={{ "--calendar-primary": primaryColor, "--calendar-secondary": secondaryColor }}>
          {/* Action bar - Today/Tomorrow (or This Week/Next Week for date-range) + ✓ apply */}
          <div className="datetime-picker-action-bar-shadow ">
            <div className="datetime-picker-action-bar">
              {actionBarPresets.map(({ label, onClick, isActive }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className={`datetime-picker-action-btn${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                >
                  {isActive && <span className="datetime-picker-action-dot" aria-hidden="true" />}
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={onConfirm}
                className="datetime-picker-confirm-btn"
                title="Apply selection"
              >
                <Check size={10} strokeWidth={3.5} />
              </button>
            </div>
          </div>

      {/* Time selection section for date-time mode */}
      {pickerType === "date-time" && (
        <div className="datetime-picker-time-section">
          <div className="datetime-picker-time-header">Time</div>
          <div className="datetime-picker-time-controls">
            {/* Hour controls */}
            <div className="datetime-picker-time-control">
              <button
                type="button"
                className="datetime-picker-time-arrow datetime-picker-time-arrow-up"
                onClick={() => stepHour(-1)}
              >
                <ChevronRight size={14} strokeWidth={3} style={{ transform: "rotate(-90deg)" }} />
              </button>
              <div className="datetime-picker-time-value">
                {hour24 % 12 || 12}
              </div>
              <button
                type="button"
                className="datetime-picker-time-arrow datetime-picker-time-arrow-down"
                onClick={() => stepHour(1)}
              >
                <ChevronRight size={14} strokeWidth={3} style={{ transform: "rotate(90deg)" }} />
              </button>
            </div>

            <span className="datetime-picker-time-separator">:</span>

            {/* Minute controls */}
            <div className="datetime-picker-time-control">
              <button
                type="button"
                className="datetime-picker-time-arrow datetime-picker-time-arrow-up"
                onClick={() => stepMinute(-15)}
              >
                <ChevronRight size={14} strokeWidth={3} style={{ transform: "rotate(-90deg)" }} />
              </button>
              <div className="datetime-picker-time-value">
                {String(minute).padStart(2, "0")}
              </div>
              <button
                type="button"
                className="datetime-picker-time-arrow datetime-picker-time-arrow-down"
                onClick={() => stepMinute(15)}
              >
                <ChevronRight size={14} strokeWidth={3} style={{ transform: "rotate(90deg)" }} />
              </button>
            </div>

            {/* AM/PM controls */}
            <div className="datetime-picker-time-control">
              <button
                type="button"
                className="datetime-picker-time-arrow datetime-picker-time-arrow-up"
                onClick={togglePeriod}
              >
                <ChevronRight size={14} strokeWidth={3} style={{ transform: "rotate(-90deg)" }} />
              </button>
              <div className="datetime-picker-time-value">
                {isPM ? "PM" : "AM"}
              </div>
              <button
                type="button"
                className="datetime-picker-time-arrow datetime-picker-time-arrow-down"
                onClick={togglePeriod}
              >
                <ChevronRight size={14} strokeWidth={3} style={{ transform: "rotate(90deg)" }} />
              </button>
            </div>
          </div>
        </div>
      )}

           {/* Calendar */}
          <div ref={wrapperRef} className="react-calendar-wrapper" style={{ "--calendar-primary": primaryColor, "--calendar-secondary": secondaryColor }}>
            <Calendar
              value={hasSelectedDate ? selectedDate : null}
              onChange={handleCalendarChange}
              calendarType="gregory"
              tileClassName={({ date }) => {
                // For date-range: determine range-related classes
                if (pickerType === "date-range" && selectedRange) {
                  const isStart = selectedRange.start && isSameDate(date, selectedRange.start);
                  const isEnd = selectedRange.end && isSameDate(date, selectedRange.end);
                  const inRange = selectedRange.start && selectedRange.end && isDateInRange(date, selectedRange.start, selectedRange.end);

                  if (isStart) return "range-start-tile";
                  if (isEnd) return "range-end-tile";
                  if (inRange) return "range-between-tile";
                }

                // For single date selection
                const isSelected = hasSelectedDate &&
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();

                // Determine if this is today
                const today = new Date();
                const isToday = 
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear();

                return isSelected ? "selected-tile" : isToday ? "today-tile" : "";
              }}
              tileContent={({ date, view }) => {
                if (view !== "month") return null;

                // For date-range: render range indicators
                if (pickerType === "date-range" && selectedRange) {
                  const isStart = selectedRange.start && isSameDate(date, selectedRange.start);
                  const isEnd = selectedRange.end && isSameDate(date, selectedRange.end);
                  const inRange = selectedRange.start && selectedRange.end && isDateInRange(date, selectedRange.start, selectedRange.end);

                  if (isStart || isEnd || inRange) {
                    return (
                      <div className="tile-content">
                        {isStart && (
                          <span
                            className="range-start-indicator"
                          />
                        )}
                        {isEnd && (
                          <span
                            className="range-end-indicator"
                          />
                        )}
                      </div>
                    );
                  }
                }

                // Determine styling for single date selection
                const isSelected = hasSelectedDate &&
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();

                const today = new Date();
                const isToday =
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear();

                return (
                  <div className="tile-content">
                    {isSelected ? (
                      <span
                        className="selected-indicator"
                        style={{ backgroundColor: primaryColor }}
                      />
                    ) : isToday ? (
                      <span
                        className="today-indicator"
                        style={{ borderColor: primaryColor }}
                      />
                    ) : null}
                  </div>
                );
              }}
              next2Label={null}
              prev2Label={null}
              nextLabel={<ChevronRight size={22} strokeWidth={3} />}
              prevLabel={<ChevronLeft size={22} strokeWidth={3} />}
            />
          </div>
        </div>
      )}

      {showTimePicker && (
        <div className="">
          <TimePicker
            value={selectedTime}
            onChange={onTimeChange}
            onConfirm={onTimeConfirm}
            onReset={onTimeReset}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            showActionBar={isTimeOnly}
          />
        </div>
      )}
    </div>
  );
}
