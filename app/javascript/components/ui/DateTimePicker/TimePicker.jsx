/**
 * TimePicker - A compact time selection component.
 *
 * Props:
 * - value: Date object representing the selected time (temporary, not yet committed)
 * - onChange: callback when time is changed (temporary, does NOT commit to parent)
 * - onConfirm: callback when user confirms the selection (commits and closes picker)
 * - onReset: callback for reset button (recalculates to next hour)
 * - primaryColor: theme color for selected/highlighted elements
 * - secondaryColor: theme color for borders/backgrounds
 * - showActionBar: whether to show Reset and ✓ buttons (time-only mode)
 */
export default function TimePicker({ value, onChange, onConfirm, onReset, primaryColor, secondaryColor, showActionBar }) {
  // No internal state needed - this is a controlled component
  // All state lives in DateTimePicker's selectedTime
  
  // Extract time values from the value prop (controlled)
  const getFormattedTimeParts = () => {
    if (!value) return null;
    
    const hours24 = value.getHours();
    const minutes = value.getMinutes();
    
    // Convert to 12-hour format
    const period = hours24 >= 12 ? "PM" : "AM";
    // Convert: 0→12, 1-11→1-11, 12→12, 13-23→1-11
    let displayHour = hours24 % 12;
    if (displayHour === 0) displayHour = 12;
    
    return {
      hour: displayHour,
      minute: minutes,
      period: period
    };
  };

  const timeParts = getFormattedTimeParts();
  
  // Helper to create new Date with updated hour
  const updateTime = (newHour12, newMinute, newPeriod) => {
    if (!value) return;
    
    const result = new Date(value);
    
    // Convert 12-hour to 24-hour
    let hours24;
    if (newHour12 === 12) {
      hours24 = newPeriod === "AM" ? 0 : 12;
    } else {
      hours24 = newPeriod === "AM" ? newHour12 : newHour12 + 12;
    }
    
    result.setHours(hours24, newMinute, 0, 0);
    onChange(result);
  };

  // Handle hour change
  const handleHourChange = (newHour) => {
    const currentMinutes = timeParts?.minute || 0;
    const currentPeriod = timeParts?.period || "AM";
    updateTime(newHour, currentMinutes, currentPeriod);
  };

  // Handle minute change (stepper)
  const handleMinuteChange = (delta) => {
    const currentHour12 = timeParts?.hour || 12;
    const currentMinutes = timeParts?.minute || 0;
    const currentPeriod = timeParts?.period || "AM";
    
    let newMinute = currentMinutes + delta;
    if (newMinute < 0) newMinute = 59;
    if (newMinute > 59) newMinute = 0;
    
    updateTime(currentHour12, newMinute, currentPeriod);
  };

  // Handle AM/PM toggle
  const handlePeriodToggle = () => {
    const currentHour12 = timeParts?.hour || 12;
    const currentMinutes = timeParts?.minute || 0;
    const newPeriod = timeParts?.period === "AM" ? "PM" : "AM";
    updateTime(currentHour12, currentMinutes, newPeriod);
  };

  // Handle reset - call parent's reset handler
  const handleResetClick = () => {
    onReset?.();
  };

  // Generate hour options (1-12)
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);

  // Format minute with leading zero
  const formatMinute = (min) => min.toString().padStart(2, "0");

  // Format hour with leading zero if needed (for consistent display)
  const formatHour = (hour) => hour.toString().padStart(2, "0");

  return (
    <div className="time-picker">
      {/* Action bar for time-only mode */}
      {showActionBar && (
        <div className="time-picker-actions flex justify-between items-center mb-4" 
             style={{ borderColor: secondaryColor }}>
          <button
            type="button"
            onClick={handleResetClick}
            className="time-picker-reset-btn px-4 py-2 text-sm font-medium rounded-md border hover:bg-gray-50 transition-colors"
            style={{ borderColor: secondaryColor }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="time-picker-confirm-btn px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 transition-opacity flex items-center justify-center w-12 h-12"
            style={{ backgroundColor: primaryColor }}
          >
            ✓
          </button>
        </div>
      )}

      {/* Compact time display */}
      <div className="time-picker-display" style={{ borderColor: secondaryColor }}>
        {/* Hour display */}
        <div className="time-picker-display-value time-picker-display-hour">
          {formatHour(timeParts?.hour || 12)}
        </div>
        
        <span className="time-picker-display-separator">:</span>
        
        {/* Minute display with stepper */}
        <div className="time-picker-display-value time-picker-display-minute">
          <button 
            type="button" 
            onClick={() => handleMinuteChange(1)}
            className="time-picker-stepper time-picker-stepper-up" 
            aria-label="Increase minute"
          >
            ↑
          </button>
          {formatMinute(timeParts?.minute || 0)}
          <button 
            type="button" 
            onClick={() => handleMinuteChange(-1)}
            className="time-picker-stepper time-picker-stepper-down" 
            aria-label="Decrease minute"
          >
            ↓
          </button>
        </div>
        
        {/* AM/PM toggle */}
        <button
          type="button"
          onClick={handlePeriodToggle}
          className="time-picker-display-period"
          style={{ backgroundColor: primaryColor }}
        >
          {timeParts?.period || "AM"}
        </button>
      </div>

      {/* Hour selection cards */}
      <div className="time-picker-hours-grid">
        {hours.map((hour) => (
          <button
            key={hour}
            type="button"
            onClick={() => handleHourChange(hour)}
            className={`time-picker-hour-card ${
              timeParts?.hour === hour ? "time-picker-hour-card-selected" : ""
            }`}
            style={{
              backgroundColor: timeParts?.hour === hour ? primaryColor : "transparent",
              borderColor: secondaryColor,
            }}
          >
            {hour}
          </button>
        ))}
      </div>
    </div>
  );
}
