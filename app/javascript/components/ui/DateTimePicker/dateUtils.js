/**
 * Date utility functions for DateTimePicker.
 * All functions use LOCAL time to avoid timezone-related bugs.
 */

/**
 * Create a Date object representing the given year/month/day at midnight LOCAL time.
 * This is the safe way to create a date for a specific calendar day.
 * 
 * @param {number} year - Full year (e.g., 2026)
 * @param {number} monthIndex - Month index (0-11, where 0 = January)
 * @param {number} day - Day of month (1-31)
 * @returns {Date} Date object at midnight local time
 */
export function createLocalDate(year, monthIndex, day) {
  return new Date(year, monthIndex, day);
}

/**
 * Parse a "YYYY-MM-DD" string into a Date object at midnight LOCAL time.
 * This avoids timezone issues that can occur with `new Date(string)`.
 * 
 * @param {string} dateString - Date string in "YYYY-MM-DD" format
 * @returns {Date|null} Date object at midnight local time, or null if invalid
 */
export function parseLocalDateString(dateString) {
  if (!dateString) return null;
  
  const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // Convert to 0-indexed
  const day = parseInt(match[3], 10);
  
  const date = createLocalDate(year, month, day);
  
  // Validate the date is reasonable
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

/**
 * Format a Date object as "YYYY-MM-DD" string using LOCAL time.
 * This ensures the correct calendar day is preserved regardless of timezone.
 *
 * @param {Date} date - Date object
 * @returns {string} Formatted date string, or empty string if invalid
 */
export function formatLocalDateToString(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  
  // Use local time getters to preserve the calendar day
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Create a Date object from a "YYYY-MM-DD" string at midnight LOCAL time.
 * This avoids the timezone shift that occurs with `new Date(string)` which
 * interprets the string as UTC.
 *
 * @param {string} dateString - Date string in "YYYY-MM-DD" format
 * @returns {Date|null} Date object at midnight local time, or null if invalid
 */
export function createDateFromString(dateString) {
  return parseLocalDateString(dateString);
}

/**
 * Check if two Date objects represent the same calendar day (ignoring time).
 * Uses LOCAL time for comparison.
 * 
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if both dates represent the same calendar day
 */
export function isSameLocalDate(date1, date2) {
  if (!date1 || !date2) return false;
  
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Create a Date object for today at midnight LOCAL time.
 * 
 * @returns {Date} Today's date at midnight local time
 */
export function getTodayLocal() {
  const now = new Date();
  return createLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Create a Date object for tomorrow at midnight LOCAL time.
 * 
 * @returns {Date} Tomorrow's date at midnight local time
 */
export function getTomorrowLocal() {
  const today = getTodayLocal();
  return createLocalDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );
}

/**
 * Get the Sunday-Saturday week containing the given date, at midnight LOCAL time.
 *
 * @param {Date} referenceDate - Any date within the week
 * @param {number} weekOffset - Weeks to shift (0 = this week, 1 = next week)
 * @returns {{start: Date, end: Date}} Sunday (start) and Saturday (end) of the week
 */
export function getWeekRange(referenceDate, weekOffset = 0) {
  // getDay() is 0 for Sunday, so it's the number of days since the week began
  const start = createLocalDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - referenceDate.getDay() + weekOffset * 7
  );
  const end = createLocalDate(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start, end };
}

/**
 * Parse a date-time string into a Date object with LOCAL time.
 * Handles formats like "2026-09-26T15:30" or ISO strings.
 * Preserves the local date and time without timezone conversion.
 * 
 * @param {string} dateTimeString - Date-time string
 * @returns {Date|null} Date object with local date/time, or null if invalid
 */
export function parseLocalDateTimeString(dateTimeString) {
  if (!dateTimeString) return null;
  
  // Try to match "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm" format
  const match = String(dateTimeString).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2})(:(\d{2}))?$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    let hour = parseInt(match[4], 10);
    const minute = match[6] ? parseInt(match[6], 10) : 0;
    
    const date = new Date(year, month, day, hour, minute, 0, 0);
    
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  }
  
  // Try ISO format
  try {
    const date = new Date(dateTimeString);
    if (!Number.isNaN(date.getTime())) {
      // Return local date/time components
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes()
      );
    }
  } catch (e) {
    // Fall through to null
  }
  
  return null;
}

/**
 * Format a Date object as "YYYY-MM-DDTHH:mm" using LOCAL time.
 * This preserves the local date and time for storage in controlled values.
 *
 * @param {Date} date - Date object
 * @returns {string} Formatted date-time string, or empty string if invalid
 */
export function formatLocalDateTimeToString(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Format a Date for display like "Wednesday, September 26, 2026 at 3:30 PM".
 *
 * @param {Date} date - Date object
 * @returns {string} Formatted display string, or empty string if invalid
 */
export function getFormattedDateTimeDisplay(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const weekday = weekdays[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  // Convert to 12-hour format
  let hour = date.getHours();
  const minute = date.getMinutes();
  const isPM = hour >= 12;
  hour = hour % 12 || 12;
  const amPm = isPM ? 'PM' : 'AM';
  
  return `${weekday}, ${monthName} ${day}, ${year} at ${hour}:${String(minute).padStart(2, '0')} ${amPm}`;
}

/**
 * Given a local Date, return a new Date at the top of the next hour.
 * Examples: 3:02 PM → 4:00 PM, 11:45 PM → 12:00 AM (next day)
 * Uses LOCAL time only, no timezone conversion.
 *
 * @param {Date} now - Current local date/time
 * @returns {Date} Date at the top of the next hour
 */
export function getNextHourLocal(now) {
  if (!now || Number.isNaN(now.getTime())) return null;
  
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const hour = now.getHours();
  
  // Calculate next hour (and potentially next day)
  const nextHour = hour + 1;
  
  if (nextHour < 24) {
    // Same day, next hour
    return new Date(year, month, day, nextHour, 0, 0, 0);
  } else {
    // Next day, midnight
    const nextDay = createLocalDate(year, month, day + 1);
    return new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 0, 0, 0, 0);
  }
}
