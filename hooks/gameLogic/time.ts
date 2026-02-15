export const parseGameTimeParts = (input?: string) => {
    if (!input) return null;
    const dayMatch = input.match(/第?(\d+)日/);
    const timeMatch = input.match(/(\d{1,2}):(\d{2})/);
    if (!dayMatch || !timeMatch) return null;
    const day = parseInt(dayMatch[1], 10);
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    if ([day, hour, minute].some(n => Number.isNaN(n))) return null;
    return { day, hour, minute };
};

export const parseGameTime = (input?: string) => {
    return gameTimeToMinutes(input);
};

export const gameTimeToMinutes = (input?: string) => {
    const parts = parseGameTimeParts(input);
    if (!parts) return null;
    return parts.day * 24 * 60 + parts.hour * 60 + parts.minute;
};

export const formatGameTime = (day: number, hour: number, minute: number) => {
    const h = Math.max(0, Math.min(23, hour));
    const m = Math.max(0, Math.min(59, minute));
    return `第${day}日 ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const advanceGameTimeByMinutes = (currentTime: string, minutes: number) => {
    const parts = parseGameTimeParts(currentTime);
    if (!parts || !Number.isFinite(minutes)) return { time: currentTime, dayDelta: 0 };
    const total = parts.day * 24 * 60 + parts.hour * 60 + parts.minute + minutes;
    const nextDay = Math.max(1, Math.floor(total / (24 * 60)));
    const remainder = total - nextDay * 24 * 60;
    const hour = Math.floor(remainder / 60);
    const minute = remainder % 60;
    const dayDelta = nextDay - parts.day;
    return { time: formatGameTime(nextDay, hour, minute), dayDelta };
};

export const advanceDateString = (dateStr: string, dayDelta: number): string => {
    // Expects YYYY-MM-DD format
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateStr;
    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + dayDelta);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    return `${newYear}-${newMonth}-${newDay}`;
};
