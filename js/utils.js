// ─── Utils Module ────────────────────────────────────────────────────────────
const UTILS = (() => {

    // ── Unit Conversions ──────────────────────────────────────────────────────
    const cToF = c => (c * 9 / 5 + 32);
    const fToC = f => ((f - 32) * 5 / 9);
    const kmhToMph = v => v * 0.621371;
    const mphToKmh = v => v * 1.60934;
    const kmToMi = v => v * 0.621371;

    function formatTemp(c, unit) {
        if (unit === 'F') return `${Math.round(cToF(c))}°F`;
        return `${Math.round(c)}°C`;
    }

    function formatWind(kmh, unit) {
        if (unit === 'F') return `${Math.round(kmhToMph(kmh))} mph`;
        return `${Math.round(kmh)} km/h`;
    }

    function formatVis(km, unit) {
        if (unit === 'F') return `${(kmToMi(km)).toFixed(1)} mi`;
        return `${km.toFixed(1)} km`;
    }

    // ── Wind Bearing ──────────────────────────────────────────────────────────
    function windBearing(deg) {
        if (deg == null) return '–';
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return dirs[Math.round(deg / 22.5) % 16];
    }

    // ── WMO Weather Code → Icon + Label ──────────────────────────────────────
    const WMO_MAP = {
        0: ['☀️', 'Clear sky'],
        1: ['🌤️', 'Mainly clear'],
        2: ['⛅', 'Partly cloudy'],
        3: ['☁️', 'Overcast'],
        45: ['🌫️', 'Fog'],
        48: ['🌫️', 'Icy fog'],
        51: ['🌦️', 'Light drizzle'],
        53: ['🌦️', 'Drizzle'],
        55: ['🌧️', 'Heavy drizzle'],
        61: ['🌧️', 'Slight rain'],
        63: ['🌧️', 'Moderate rain'],
        65: ['🌧️', 'Heavy rain'],
        71: ['🌨️', 'Slight snow'],
        73: ['🌨️', 'Moderate snow'],
        75: ['❄️', 'Heavy snow'],
        77: ['🌨️', 'Snow grains'],
        80: ['🌦️', 'Slight showers'],
        81: ['🌧️', 'Moderate showers'],
        82: ['⛈️', 'Violent showers'],
        85: ['🌨️', 'Slight snow showers'],
        86: ['🌨️', 'Heavy snow showers'],
        95: ['⛈️', 'Thunderstorm'],
        96: ['⛈️', 'Thunderstorm w/ hail'],
        99: ['⛈️', 'Thunderstorm w/ heavy hail'],
    };

    function getWeatherIcon(code, isDay = 1) {
        if (code === 0 && isDay === 0) return ['🌙', 'Clear night'];
        if (code === 1 && isDay === 0) return ['🌙', 'Mainly clear'];
        return WMO_MAP[code] || ['🌡️', 'Unknown'];
    }

    // ── UV Index ──────────────────────────────────────────────────────────────
    function uviDescription(uvi) {
        if (uvi < 3) return { label: 'Low', color: '#4caf50' };
        if (uvi < 6) return { label: 'Moderate', color: '#ff9800' };
        if (uvi < 8) return { label: 'High', color: '#ff5722' };
        if (uvi < 11) return { label: 'Very High', color: '#9c27b0' };
        return { label: 'Extreme', color: '#4a148c' };
    }

    // ── AQI ───────────────────────────────────────────────────────────────────
    function aqiInfo(aqi) {
        if (aqi == null) return { label: 'N/A', color: '#aaa', level: 0 };
        if (aqi <= 20) return { label: 'Good', color: '#4caf50', level: 1 };
        if (aqi <= 40) return { label: 'Fair', color: '#8bc34a', level: 2 };
        if (aqi <= 60) return { label: 'Moderate', color: '#ff9800', level: 3 };
        if (aqi <= 80) return { label: 'Poor', color: '#ff5722', level: 4 };
        if (aqi <= 100) return { label: 'Very Poor', color: '#f44336', level: 5 };
        return { label: 'Extremely Poor', color: '#4a148c', level: 6 };
    }

    // ── Pollen Level ──────────────────────────────────────────────────────────
    function pollenLevel(val) {
        if (val == null) return { label: 'N/A', color: '#aaa' };
        if (val < 10) return { label: 'Low', color: '#4caf50' };
        if (val < 30) return { label: 'Moderate', color: '#ff9800' };
        if (val < 80) return { label: 'High', color: '#ff5722' };
        return { label: 'Very High', color: '#9c27b0' };
    }

    // ── Date / Time Formatting ────────────────────────────────────────────────
    function formatTime12(isoStr, tz) {
        return new Date(isoStr).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
        });
    }

    function formatHour(isoStr, tz) {
        return new Date(isoStr).toLocaleTimeString('en-US', {
            hour: 'numeric', hour12: true, timeZone: tz,
        });
    }

    function formatShortDate(isoStr, tz) {
        return new Date(isoStr).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
        });
    }

    function formatDay(isoStr, tz) {
        const d = new Date(isoStr);
        const today = new Date();
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const dStr = d.toDateString();
        if (dStr === today.toDateString()) return 'Today';
        if (dStr === tomorrow.toDateString()) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
    }

    function formatFullDate(tz) {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz,
        });
    }

    function formatLocalTime(tz) {
        return new Date().toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
        });
    }

    // ── Lifestyle Scores ──────────────────────────────────────────────────────
    function lifestyleScore(type, weather) {
        const { wind, precip, temp, uvi, code } = weather;
        const rainy = precip > 2 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
        const stormy = [95, 96, 99].includes(code);
        const snowy = [71, 73, 75, 77, 85, 86].includes(code);
        let score = 10;
        if (stormy) return 0;

        if (type === 'running') {
            if (rainy) score -= 4; if (snowy) score -= 5;
            if (wind > 30) score -= 2; if (temp < 0 || temp > 35) score -= 2;
            if (uvi > 8) score -= 1;
        } else if (type === 'cycling') {
            if (rainy) score -= 5; if (snowy) score -= 7;
            if (wind > 20) score -= 3; if (temp < 5 || temp > 38) score -= 2;
        } else if (type === 'gardening') {
            if (rainy) score -= 3; if (snowy) score -= 8;
            if (wind > 40) score -= 2; if (temp < 5 || temp > 40) score -= 2;
        } else if (type === 'outdoor') {
            if (rainy) score -= 4; if (snowy) score -= 5;
            if (wind > 35) score -= 2; if (temp < 0 || temp > 38) score -= 2;
            if (uvi > 9) score -= 1;
        } else if (type === 'beach') {
            if (rainy) score -= 6; if (temp < 22) score -= 3; if (wind > 25) score -= 2;
            if (uvi < 3 || uvi > 9) score -= 1;
        }
        return Math.max(0, Math.min(10, score));
    }

    // ── Smart AI Summary ──────────────────────────────────────────────────────
    function generateSummary(current, daily, hourly, unit) {
        const [icon, label] = getWeatherIcon(current.weather_code, current.is_day);
        const t = Math.round(current.temperature_2m);
        const ft = Math.round(current.apparent_temperature);
        const humid = current.relative_humidity_2m;
        const wind = Math.round(current.wind_speed_10m);
        const uvi = current.uv_index;

        const warnCodes = [65, 82, 95, 96, 99];
        const rainCodes = [51, 53, 55, 61, 63, 80, 81];

        let summary = `<strong>${icon} Currently ${label}</strong> with a temperature of ${formatTemp(t, unit)}, `;
        summary += `feeling like ${formatTemp(ft, unit)}. `;

        if (current.relative_humidity_2m > 80) summary += `Humidity is high at ${humid}%. `;
        if (wind > 30) summary += `Strong winds at ${formatWind(wind, unit)}. `;
        if (uvi >= 8) summary += `☀️ Extreme UV index — wear sunscreen! `;

        if (daily) {
            const todayCode = daily.weather_code[0];
            const todayHigh = Math.round(daily.temperature_2m_max[0]);
            const todayLow = Math.round(daily.temperature_2m_min[0]);
            summary += `<br>Today's high: ${formatTemp(todayHigh, unit)}, low: ${formatTemp(todayLow, unit)}. `;

            if (warnCodes.includes(todayCode)) summary += `⚠️ <strong>Severe weather expected today</strong> — stay safe indoors. `;
            else if (rainCodes.includes(todayCode)) summary += `🌂 Expect rainfall today — carry an umbrella. `;
        }

        if (hourly) {
            const now = new Date();
            const upcoming = hourly.time
                .map((t, i) => ({ t: new Date(t), pp: hourly.precipitation_probability[i], code: hourly.weather_code[i] }))
                .filter(h => h.t > now).slice(0, 12);

            const rainNext = upcoming.find(h => h.pp > 60);
            if (rainNext) {
                const hrs = Math.round((rainNext.t - now) / 3600000);
                if (hrs < 1) summary += `🌧️ Rain expected imminently! `;
                else if (hrs < 6) summary += `🌧️ Rain likely in the next ${hrs} hour${hrs > 1 ? 's' : ''}. `;
            } else {
                summary += `Skies should remain mostly ${current.cloud_cover < 50 ? 'clear' : 'cloudy'} in the coming hours. `;
            }
        }

        return summary;
    }

    // ── Dew Point Comfort ────────────────────────────────────────────────────
    function dewPointComfort(dp) {
        if (dp < 10) return 'Very Dry';
        if (dp < 13) return 'Dry';
        if (dp < 16) return 'Comfortable';
        if (dp < 18) return 'Slightly Humid';
        if (dp < 21) return 'Humid';
        if (dp < 24) return 'Very Humid';
        return 'Oppressive';
    }

    // ── Country Flag Emoji ────────────────────────────────────────────────────
    function countryFlag(code) {
        if (!code || code.length !== 2) return '';
        return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
    }

    // ── Pressure Trend Label ──────────────────────────────────────────────────
    function pressureTrend(msl) {
        if (msl > 1020) return { label: 'High — Clear skies likely', icon: '↑' };
        if (msl > 1013) return { label: 'Normal', icon: '→' };
        return { label: 'Low — Stormy possible', icon: '↓' };
    }

    // ── Sunrise/Sunset Progress ───────────────────────────────────────────────
    function dayProgress(sunrise, sunset) {
        const now = Date.now();
        const sr = new Date(sunrise).getTime();
        const ss = new Date(sunset).getTime();
        if (now < sr) return 0;
        if (now > ss) return 100;
        return Math.round(((now - sr) / (ss - sr)) * 100);
    }

    return {
        cToF, fToC, kmhToMph, kmToMi,
        formatTemp, formatWind, formatVis,
        windBearing, getWeatherIcon,
        uviDescription, aqiInfo, pollenLevel,
        formatTime12, formatHour, formatShortDate, formatDay, formatFullDate, formatLocalTime,
        lifestyleScore, generateSummary, dewPointComfort, countryFlag, pressureTrend, dayProgress,
    };
})();
