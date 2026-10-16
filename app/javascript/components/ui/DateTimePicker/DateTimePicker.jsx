import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import CalendarPanel from "./CalendarPanel";
import { 
  createLocalDate, 
  parseLocalDateString, 
  getTodayLocal, 
  getTomorrowLocal,
  parseLocalDateTimeString,
  formatLocalDateTimeToString,
  getFormattedDateTimeDisplay,
  getNextHourLocal,
  getWeekRange
} from "./dateUtils";
import { CalendarDays } from "lucide-react";
import { inputClass } from "../styles";

// Normalize a value (Date or date/date-time string) to a valid local Date, or null
const toLocalDate = (input) => {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input);
  }
  return parseLocalDateTimeString(input) || parseLocalDateString(input);
};

/**
 * DateTimePicker - A reusable date/time picker component.
 *
 * Public API:
 * - pickerType: "date" | "date-range" | "date-time" | "time"
 * - pickerDefault: "today" | "tomorrow" (ignored for "time" type)
 * - backgroundColor: hex color string
 * - primaryColor: hex color string
 * - secondaryColor: hex color string
 * - value: the committed selected value(s)
 * - onChange: callback fired when selection is confirmed
 */
export default function DateTimePicker({
  pickerType = "date",
  pickerDefault = "today",
  backgroundColor = "#F1F5F9",
  primaryColor = "var(--color-accent)",
  secondaryColor = "var(--color-accent-soft)",
  value,
  onChange,
  invalid = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Portal and positioning refs/state
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const [popupPosition, setPopupPosition] = useState(null);
  
  // Internal selection state (temporary until confirmed)
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedRange, setSelectedRange] = useState({ start: null, end: null });
  const [selectedTime, setSelectedTime] = useState(null);
  
  // Date-time mode: separate hour/minute state for time selection
  const [dateTimeHour, setDateTimeHour] = useState(0);
  const [dateTimeMinute, setDateTimeMinute] = useState(0);
  
  // Initialize defaults on mount
  useEffect(() => {
    const defaultDate = getDefaultDate();
    if (pickerType === "date-range") {
      setSelectedRange(defaultDate);
    } else {
      setSelectedDate(defaultDate);
    }
  }, []); // Only run on mount

  // Calculate popup position when opened, update on scroll
  useEffect(() => {
    if (!isOpen) return;
    
    const updatePosition = () => {
      if (!triggerRef.current) return;
      
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const gap = 8; // Small gap between trigger and popup
      
      // Use trigger's width as the popup width (calendar matches input width)
      const popupWidth = triggerRect.width;
      // Estimate popup height for edge detection
      const estimatedPopupHeight = 300;
      
      // Calculate document coordinates by adding scroll offset
      const docTop = triggerRect.top + window.scrollY;
      const docLeft = triggerRect.left + window.scrollX;
      
      // Calculate initial position below trigger, aligned to left edge
      let top = docTop + triggerRect.height + gap;
      let left = docLeft;
      
      // Adjust for right edge - shift left if popup would overflow
      const availableWidthRight = document.documentElement.clientWidth - docLeft;
      if (availableWidthRight < popupWidth) {
        // Shift left to fit, but don't go negative
        const overflow = popupWidth - availableWidthRight;
        left = Math.max(0, docLeft - overflow);
      }
      
      // Adjust for bottom edge - open above trigger if not enough space
      const availableHeightBelow = document.documentElement.clientHeight - docTop;
      if (availableHeightBelow < estimatedPopupHeight) {
        // Open above the trigger
        top = docTop - estimatedPopupHeight - gap;
      }
      
      setPopupPosition({ top, left, width: popupWidth });
    };
    
    // Calculate on next frame to ensure layout is settled
    const frameId = requestAnimationFrame(updatePosition);
    
    // Set up scroll handler to update position
    const handleScroll = () => {
      requestAnimationFrame(updatePosition);
    };
    
    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  // Close without committing when clicking outside the trigger and popup.
  // Uncommitted changes are discarded because the selection re-initializes on open.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (popupRef.current?.contains(event.target)) return;
      setIsOpen(false);
      setPopupPosition(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  // Initialize temporary selection when picker opens
  useEffect(() => {
    if (isOpen) {
      // If we have a committed value, use it as the starting point
      const parsedValue = pickerType === "date-time" ? toLocalDate(value) : null;
      if (value && (pickerType !== "date-time" || parsedValue)) {
        if (pickerType === "date-range") {
          // For date-range, initialize selectedRange from committed value
          setSelectedRange({ start: value.start, end: value.end });
        } else if (pickerType === "time") {
          // For time-only, initialize from committed value
          setSelectedTime(value);
        } else if (pickerType === "date-time") {
          // For date-time, split the combined value into date + hour/minute
          setSelectedDate(createLocalDate(parsedValue.getFullYear(), parsedValue.getMonth(), parsedValue.getDate()));
          setDateTimeHour(parsedValue.getHours());
          setDateTimeMinute(parsedValue.getMinutes());
        } else {
          setSelectedDate(toLocalDate(value));
        }
      } else {
        // Otherwise use the default
        const defaultDate = getDefaultDate();
        if (pickerType === "date-range") {
          setSelectedRange(defaultDate);
        } else if (pickerType === "time") {
          // For time-only with no value, use top of next hour
          setSelectedTime(getNextHourDate());
        } else if (pickerType === "date-time") {
          // For date-time with no value, use the default day and next hour
          setSelectedDate(defaultDate);
          const nextHour = getNextHourLocal(new Date());
          setDateTimeHour(nextHour.getHours());
          setDateTimeMinute(0);
        } else {
          setSelectedDate(defaultDate);
        }
      }
    }
  }, [isOpen, pickerType]);

  // Get default date based on pickerDefault prop
  const getDefaultDate = () => {
    if (pickerType === "date-range") {
      // For date-range, return current week range (Sunday-Saturday)
      return getWeekRange(getTodayLocal());
    }
    
    if (pickerDefault === "tomorrow") {
      return getTomorrowLocal();
    }
    
    return getTodayLocal();
  };

  // Get next hour (for "time" type default)
  // Always returns top of the next hour with minutes=0, seconds=0, milliseconds=0
  // Examples: 3:02 PM → 4:00 PM, 3:59 PM → 4:00 PM, 11:45 PM → 12:00 AM (next day)
  const getNextHourDate = () => {
    const now = new Date();
    // Set to top of current hour first
    now.setMinutes(0, 0, 0);
    // Then add one hour (handles midnight wrap correctly)
    now.setHours(now.getHours() + 1);
    return now;
  };

  // Handle picker close and commit selection
  const handleConfirm = () => {
    let newValue;

    if (pickerType === "date") {
      newValue = selectedDate;
    } else if (pickerType === "time") {
      // For time-only, return just the time portion
      newValue = selectedTime;
    } else if (pickerType === "date-time") {
      if (!selectedDate) return;
      // Combine date and time into a single Date object
      newValue = new Date(selectedDate);
      newValue.setHours(dateTimeHour, dateTimeMinute, 0, 0);
    } else if (pickerType === "date-range") {
      // Validate that both start and end exist
      if (selectedRange.start && selectedRange.end) {
        // Normalize the range so start <= end
        if (selectedRange.start <= selectedRange.end) {
          newValue = { ...selectedRange };
        } else {
          // Swap if needed
          newValue = { start: selectedRange.end, end: selectedRange.start };
        }
      } else {
        // Incomplete range - don't commit
        return;
      }
    } else {
      newValue = null;
    }
    
    onChange?.(newValue);
    setIsOpen(false);
    setPopupPosition(null);
  };

  // Handle time picker reset (recalculate to top of next hour based on CURRENT time)
  const handleTimeReset = () => {
    const nextHour = getNextHourDate();
    setSelectedTime(nextHour);
  };

  // Handle date selection change
  const handleDateChange = (dateOrRange) => {
    if (pickerType === "date-range") {
      // Check if this is a range object from preset buttons
      if (dateOrRange && typeof dateOrRange === "object" && dateOrRange.start && dateOrRange.end) {
        // This is a preset range selection
        setSelectedRange({ start: dateOrRange.start, end: dateOrRange.end });
      } else {
        // This is a single date selection
        const date = dateOrRange;
        // Two-click range selection logic
        if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
          // No start set, or complete range exists - start new range
          setSelectedRange({ start: date, end: null });
        } else if (selectedRange.start && !selectedRange.end) {
          // Start is set, this is the end selection
          setSelectedRange({ start: selectedRange.start, end: date });
        }
      }
    } else if (pickerType === "date-time") {
      // For date-time, only update the temporary selection; the ✓ button commits date + time
      setSelectedDate(dateOrRange);
    } else {
      // For single date selection, update internal state AND immediately notify parent
      setSelectedDate(dateOrRange);
      // Immediately call onChange so the controlled field updates
      onChange?.(dateOrRange);
    }
  };

  // Handle hour/minute change in date-time mode (temporary, doesn't commit)
  const handleDateTimeChange = ({ hour, minute }) => {
    setDateTimeHour(hour);
    setDateTimeMinute(minute);
  };

  // Handle time selection change (temporary, doesn't commit)
  const handleTimeChange = (time) => {
    setSelectedTime(time);
  };

  // Handle time picker confirmation (commits selection and closes)
  const handleTimeConfirm = () => {
    // Commit the current selectedTime and close picker
    if (selectedTime) {
      onChange?.(selectedTime);
    }
    setIsOpen(false);
    setPopupPosition(null);
  };

  // Format display value for trigger
  const formatDisplayValue = () => {
    // Handle time-only
    if (pickerType === "time") {
      if (!(value instanceof Date)) return "Pick a time";
      const hours = value.getHours();
      const minutes = value.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHour = hours % 12 || 12; // Convert to 1-12 format
      const displayMinutes = minutes.toString().padStart(2, "0");
      return `${displayHour}:${displayMinutes} ${ampm}`;
    }
    
    // Handle date-time
    if (pickerType === "date-time") {
      const parsedDate = toLocalDate(value);
      if (!parsedDate) return "Pick a date and time";
      return getFormattedDateTimeDisplay(parsedDate);
    }
    
    // For date/date-range: use committed value if available, otherwise fall back to internal selection
    // This ensures the display shows the default date (today/tomorrow) or any date the user has
    // selected via calendar click or preset buttons, even before they click Apply/Checkmark.
    const displayValue = value || (pickerType === "date-range" ? selectedRange : selectedDate);
    
    if (!displayValue) return "Pick a date";
    
    // Handle date-range
    if (pickerType === "date-range" && displayValue.start && displayValue.end) {
      const startOpts = { month: "short", day: "numeric" };
      const endOpts = { month: "short", day: "numeric", year: "numeric" };
      const startStr = displayValue.start.toLocaleDateString("en-US", startOpts);
      const endStr = displayValue.end.toLocaleDateString("en-US", endOpts);
      return `${startStr} - ${endStr}`;
    }
    
    if (pickerType === "date-range") return "Pick a date range";

    // Format as full date (e.g., "Monday, January 15, 2024")
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    const displayDate = toLocalDate(displayValue);
    if (!displayDate) return "Pick a date";
    return displayDate.toLocaleDateString("en-US", options);
  };

  // Theme styles
  const themeStyles = {
    backgroundColor,
    primaryColor,
    secondaryColor,
  };

  return (
    <div ref={triggerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-invalid={invalid || undefined}
        className={`${inputClass} relative pl-9 text-left hover:bg-slate-50 dark:hover:bg-neutral-800 ${
          invalid ? "!border-red-400 focus:!ring-red-500 dark:!border-red-500/70" : ""
        }`}
      >
        <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        {formatDisplayValue()}
      </button>

      {/* Picker Panel - Rendered via portal for proper positioning */}
      {isOpen && popupPosition && (
        createPortal(
          <div
            ref={popupRef}
            className="datetime-picker-popup z-10 shadow-lg rounded-4xl overflow-hidden"
            style={{
              position: 'absolute',
              top: popupPosition.top,
              left: popupPosition.left,
            }}
          >
            <div
              className="bg-neutral-200 dark:bg-neutral-800"
            >
              <CalendarPanel
                pickerType={pickerType}
                selectedDate={selectedDate}
                selectedRange={selectedRange}
                selectedTime={selectedTime}
                dateTimeHour={dateTimeHour}
                dateTimeMinute={dateTimeMinute}
                onDateChange={handleDateChange}
                onConfirm={handleConfirm}
                onTimeChange={handleTimeChange}
                onTimeConfirm={handleTimeConfirm}
                onTimeReset={handleTimeReset}
                onDateTimeChange={handleDateTimeChange}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
              />
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
}
