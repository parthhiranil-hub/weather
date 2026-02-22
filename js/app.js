// ─── Main App ─────────────────────────────────────────────────────────────────
const APP = (() => {
    // ── State ────────────────────────────────────────────────────────────────
    let state = {
        location: null,   // { name, country, country_code, latitude, longitude, timezone }
        weather: null,
        airQuality: null,
        unit: localStorage.getItem('wx_unit') || 'C',        // 'C' or 'F'
        theme: localStorage.getItem('wx_theme') || 'dark',
        favorites: JSON.parse(localStorage.getItem('wx_favorites') || '[]'),
        recents: JSON.parse(localStorage.getItem('wx_recents') || '[]'),
        loading: false,
        searchTimer: null,
        locPermission: localStorage.getItem('wx_loc_permission') || null, // 'granted' | 'denied' | 'skipped'
    };

    // ── DOM references ────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    // ── Init ─────────────────────────────────────────────────────────────────
    function init() {
        applyTheme(state.theme);
        applyUnit(state.unit);
        bindEvents();
        renderFavoritesBar();
        renderRecentSearches();

        // First visit → show permission modal; returning visit → use saved choice
        if (!state.locPermission) {
            showPermissionModal();
        } else if (state.locPermission === 'granted') {
            detectLocation();
        } else {
            // denied or skipped previously → just load default
            loadDefault();
        }
    }

    // ── Permission Modal ──────────────────────────────────────────────────────
    function showPermissionModal() {
        const modal = $('loc-permission-modal');
        if (modal) modal.classList.add('visible');
    }

    function hidePermissionModal() {
        const modal = $('loc-permission-modal');
        if (modal) modal.classList.remove('visible');
    }

    // ── Location Detection (Non-Blocking) ─────────────────────────────────────
    // Strategy: immediately load default city so UI is never frozen,
    // then silently attempt GPS in background and swap if successful.
    function detectLocation(silent = false) {
        // Warn if on file:// — geolocation requires http(s)
        if (location.protocol === 'file:') {
            showPermissionStatus('denied',
                '⚠️ GPS requires a web server. Open via Live Server or http:// for location to work. Showing New York as default.'
            );
            loadDefault();
            return;
        }

        if (!navigator.geolocation) {
            showPermissionStatus('denied', 'Geolocation is not supported by your browser.');
            loadDefault();
            return;
        }

        // If not silent (first try), load default immediately so the page shows weather fast
        if (!silent && !state.weather) {
            loadDefault(); // loads in background (non-blocking)
        }

        // Show a subtle GPS spinner on the button
        setGpsBtnState('loading');

        // Pre-check permission state via Permissions API (no native prompt)
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then(result => {
                if (result.state === 'denied') {
                    // Already denied at browser level — don't hang, fail fast
                    state.locPermission = 'denied';
                    localStorage.setItem('wx_loc_permission', 'denied');
                    setGpsBtnState('denied');
                    showPermissionStatus('denied',
                        '🚫 Location blocked in browser settings. To enable: click the 🔒 icon in the address bar → Allow Location.'
                    );
                    return;
                }
                // 'granted' or 'prompt' — proceed
                requestGPS();
            }).catch(() => requestGPS()); // Permissions API not fully supported
        } else {
            requestGPS();
        }
    }

    function requestGPS() {
        const GPS_TIMEOUT = 10000; // 10s

        navigator.geolocation.getCurrentPosition(
            async pos => {
                const { latitude, longitude, accuracy } = pos.coords;
                state.locPermission = 'granted';
                localStorage.setItem('wx_loc_permission', 'granted');
                setGpsBtnState('granted');

                // Show a subtle success toast
                showPermissionStatus('granted',
                    `📍 Location detected (±${Math.round(accuracy)}m accuracy). Loading your weather…`
                );

                try {
                    const loc = await API.reverseGeocode(latitude, longitude);
                    loc.latitude = loc.latitude || latitude;
                    loc.longitude = loc.longitude || longitude;
                    loc.timezone = loc.timezone || 'auto';
                    await loadWeather(loc);
                } catch {
                    // Reverse geocode failed — use raw coords with a generic label
                    await loadWeather({
                        name: 'My Location',
                        country: '',
                        country_code: '',
                        latitude,
                        longitude,
                        timezone: 'auto',
                    });
                }
            },
            err => {
                setGpsBtnState('denied');
                const msgs = {
                    1: '🚫 Location access denied. To enable: click the 🔒 icon in your browser address bar → Allow Location.',
                    2: '📡 Location signal unavailable. Try moving closer to a window or enabling Wi-Fi.',
                    3: '⏱️ Location request timed out. Try again or search manually.',
                };
                showPermissionStatus('denied', msgs[err.code] || 'Location error. Please search for your city manually.');
                state.locPermission = 'denied';
                localStorage.setItem('wx_loc_permission', 'denied');
                // Only load default if no weather is yet loaded
                if (!state.weather) loadDefault();
            },
            { timeout: GPS_TIMEOUT, enableHighAccuracy: true, maximumAge: 60000 }
        );
    }

    // ── GPS Button State ──────────────────────────────────────────────────────
    function setGpsBtnState(status) {
        const btn = $('gps-btn');
        if (!btn) return;
        btn.classList.remove('gps-loading', 'gps-granted', 'gps-denied');
        if (status === 'loading') {
            btn.classList.add('gps-loading');
            btn.title = 'Detecting location…';
        } else if (status === 'granted') {
            btn.classList.add('gps-granted');
            btn.title = 'Location active — click to refresh';
        } else {
            btn.classList.add('gps-denied');
            btn.title = 'Location denied — click to retry';
        }
    }

    // ── Permission Status Banner ──────────────────────────────────────────────
    function showPermissionStatus(type, message) {
        const el = $('loc-status-bar');
        if (!el) return;
        el.textContent = message;
        el.className = `loc-status-bar ${type} visible`;
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => el.classList.remove('visible'), 7000);
    }


    async function loadDefault() {
        await loadWeather({ name: 'New York', country: 'United States', country_code: 'US', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' });
    }

    // ── Core Load ─────────────────────────────────────────────────────────────
    async function loadWeather(loc) {
        showLoading(true);
        state.location = loc;

        try {
            const [wx, aq] = await Promise.all([
                API.getWeather(loc.latitude, loc.longitude, loc.timezone || 'auto'),
                API.getAirQuality(loc.latitude, loc.longitude, loc.timezone || 'auto').catch(() => null),
            ]);
            state.weather = wx;
            state.airQuality = aq;

            renderAll();
            addToRecents(loc);
            MAPS.init(loc.latitude, loc.longitude);
            MAPS.invalidate();
        } catch (err) {
            showError('Failed to load weather data. Please check your connection.');
            console.error(err);
        } finally {
            showLoading(false);
        }
    }

    // ── Render All ────────────────────────────────────────────────────────────
    function renderAll() {
        const { weather: wx, airQuality: aq, location: loc, unit } = state;
        const cur = wx.current;
        const daily = wx.daily;
        const hourly = wx.hourly;
        const tz = wx.timezone;

        renderHeader(loc, cur, tz);
        renderCurrentWeather(cur, unit);
        renderHourly(hourly, tz, unit);
        renderDailyForecast(daily, tz, unit);
        renderWindCard(cur, unit);
        renderSunriseSunset(daily, tz);
        renderUVI(cur, daily);
        renderHumidityDewPoint(cur);
        renderPressure(cur);
        renderVisibility(cur, unit);
        renderAirQuality(aq);
        renderLifestyleScores(cur);
        renderSmartSummary(cur, daily, hourly, unit);
        renderCharts(hourly, daily, tz, unit);
    }

    // ── Header / Location ─────────────────────────────────────────────────────
    function renderHeader(loc, cur, tz) {
        const flag = UTILS.countryFlag(loc.country_code || '');
        const [icon] = UTILS.getWeatherIcon(cur.weather_code, cur.is_day);
        $('loc-name').textContent = loc.name;
        $('loc-country').textContent = `${flag} ${loc.country || ''}`;
        $('loc-time').textContent = UTILS.formatLocalTime(tz);
        $('loc-date').textContent = UTILS.formatFullDate(tz);
        $('loc-coords').textContent = `${loc.latitude.toFixed(2)}°N, ${loc.longitude.toFixed(2)}°E`;
        $('header-condition-icon').textContent = icon;

        // Favorite button state
        const isFav = state.favorites.some(f => f.name === loc.name && f.country === loc.country);
        $('fav-btn').innerHTML = isFav ? '★' : '☆';
        $('fav-btn').title = isFav ? 'Remove from favorites' : 'Add to favorites';

        // Dynamic background gradient
        updateBg(cur.weather_code, cur.is_day);
    }

    function updateBg(code, isDay) {
        const body = document.body;
        let cls = isDay ? 'bg-day-clear' : 'bg-night';
        if ([2, 3].includes(code)) cls = isDay ? 'bg-day-cloudy' : 'bg-night';
        if ([45, 48].includes(code)) cls = 'bg-fog';
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) cls = 'bg-rain';
        if ([71, 73, 75, 77, 85, 86].includes(code)) cls = 'bg-snow';
        if ([95, 96, 99].includes(code)) cls = 'bg-storm';
        body.className = body.className.replace(/\bbg-\S+/g, '').trim();
        body.classList.add(cls);
    }

    // ── Current Weather ───────────────────────────────────────────────────────
    function renderCurrentWeather(cur, unit) {
        const [icon, label] = UTILS.getWeatherIcon(cur.weather_code, cur.is_day);
        $('current-icon').textContent = icon;
        $('current-condition').textContent = label;
        $('current-temp').textContent = UTILS.formatTemp(cur.temperature_2m, unit);
        $('current-feels').textContent = `Feels like ${UTILS.formatTemp(cur.apparent_temperature, unit)}`;
        $('current-humidity').textContent = `${cur.relative_humidity_2m}%`;
        $('current-cloud').textContent = `${cur.cloud_cover}%`;
        $('current-precip').textContent = `${cur.precipitation} mm`;
    }

    // ── Hourly Forecast ───────────────────────────────────────────────────────
    function renderHourly(hourly, tz, unit) {
        const container = $('hourly-scroll');
        if (!container) return;
        const now = new Date();
        const items = hourly.time
            .map((t, i) => ({ t: new Date(t), i }))
            .filter(h => h.t >= now)
            .slice(0, 48);

        container.innerHTML = items.map(({ t, i }) => {
            const [icon] = UTILS.getWeatherIcon(hourly.weather_code[i]);
            const temp = UTILS.formatTemp(hourly.temperature_2m[i], unit);
            const pp = hourly.precipitation_probability[i] || 0;
            return `
        <div class="hourly-card">
          <div class="hourly-time">${UTILS.formatHour(hourly.time[i], tz)}</div>
          <div class="hourly-icon">${icon}</div>
          <div class="hourly-temp">${temp}</div>
          <div class="hourly-pp ${pp > 50 ? 'rainy' : ''}">💧${pp}%</div>
        </div>`;
        }).join('');
    }

    // ── Daily Forecast ────────────────────────────────────────────────────────
    function renderDailyForecast(daily, tz, unit) {
        const container = $('daily-cards');
        if (!container) return;
        container.innerHTML = daily.time.map((t, i) => {
            const [icon, label] = UTILS.getWeatherIcon(daily.weather_code[i]);
            const hi = UTILS.formatTemp(daily.temperature_2m_max[i], unit);
            const lo = UTILS.formatTemp(daily.temperature_2m_min[i], unit);
            const pp = daily.precipitation_probability_max[i] || 0;
            const day = UTILS.formatDay(t + 'T00:00:00', tz);
            const hiRaw = daily.temperature_2m_max[i];
            const loRaw = daily.temperature_2m_min[i];
            const pct = Math.round(((hiRaw - loRaw) / 20) * 100);
            return `
        <div class="daily-card">
          <div class="daily-day">${day}</div>
          <div class="daily-icon">${icon}</div>
          <div class="daily-label">${label}</div>
          <div class="daily-pp">${pp}% 🌧️</div>
          <div class="daily-temps">
            <span class="lo">${lo}</span>
            <div class="temp-bar"><div class="temp-bar-fill" style="width:${Math.min(100, pct)}%"></div></div>
            <span class="hi">${hi}</span>
          </div>
        </div>`;
        }).join('');
    }

    // ── Wind Card ─────────────────────────────────────────────────────────────
    function renderWindCard(cur, unit) {
        const dir = UTILS.windBearing(cur.wind_direction_10m);
        const spd = UTILS.formatWind(cur.wind_speed_10m, unit);
        const gst = UTILS.formatWind(cur.wind_gusts_10m, unit);
        $('wind-speed').textContent = spd;
        $('wind-dir').textContent = `${dir} (${cur.wind_direction_10m}°)`;
        $('wind-gusts').textContent = gst;
        const arrow = $('wind-arrow');
        if (arrow) arrow.style.transform = `rotate(${cur.wind_direction_10m}deg)`;
    }

    // ── Sunrise / Sunset ──────────────────────────────────────────────────────
    function renderSunriseSunset(daily, tz) {
        const sr = daily.sunrise[0];
        const ss = daily.sunset[0];
        $('sunrise-time').textContent = UTILS.formatTime12(sr, tz);
        $('sunset-time').textContent = UTILS.formatTime12(ss, tz);

        const pct = UTILS.dayProgress(sr, ss);
        // Animate SVG arc
        const sunDot = $('sun-dot');
        if (sunDot) {
            // Sun moves along a half-circle: left (0°) → top (90°) → right (180°)
            const angle = (pct / 100) * Math.PI;
            const cx = 50 + 45 * Math.cos(Math.PI - angle);
            const cy = 50 - 45 * Math.sin(Math.PI - angle);
            sunDot.setAttribute('cx', cx);
            sunDot.setAttribute('cy', cy);
        }
        $('day-length').textContent = (() => {
            const ms = new Date(ss) - new Date(sr);
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            return `${h}h ${m}m`;
        })();
    }

    // ── UV Index ──────────────────────────────────────────────────────────────
    function renderUVI(cur, daily) {
        const uvi = cur.uv_index ?? daily?.uv_index_max?.[0] ?? 0;
        const { label, color } = UTILS.uviDescription(uvi);
        $('uvi-value').textContent = uvi.toFixed(1);
        $('uvi-label').textContent = label;
        $('uvi-label').style.color = color;
        const bar = $('uvi-bar-fill');
        if (bar) { bar.style.width = `${Math.min(100, (uvi / 12) * 100)}%`; bar.style.background = color; }
    }

    // ── Humidity / Dew Point ──────────────────────────────────────────────────
    function renderHumidityDewPoint(cur) {
        $('humidity-value').textContent = `${cur.relative_humidity_2m}%`;
        const dp = cur.dew_point_2m;
        $('dewpoint-value').textContent = `${dp?.toFixed(1) ?? '–'}°C`;
        $('dewpoint-comfort').textContent = UTILS.dewPointComfort(dp);
        const bar = $('humidity-bar-fill');
        if (bar) bar.style.width = `${cur.relative_humidity_2m}%`;
    }

    // ── Pressure ──────────────────────────────────────────────────────────────
    function renderPressure(cur) {
        const msl = cur.pressure_msl;
        const { label, icon } = UTILS.pressureTrend(msl);
        $('pressure-value').textContent = `${msl?.toFixed(0) ?? '–'} hPa`;
        $('pressure-trend').textContent = `${icon} ${label}`;
    }

    // ── Visibility ────────────────────────────────────────────────────────────
    function renderVisibility(cur, unit) {
        const km = (cur.visibility || 0) / 1000;
        $('visibility-value').textContent = UTILS.formatVis(km, unit);

        let quality = 'Excellent';
        if (km < 1) quality = 'Very Poor';
        else if (km < 4) quality = 'Poor';
        else if (km < 10) quality = 'Moderate';
        else if (km < 20) quality = 'Good';
        $('visibility-quality').textContent = quality;
        const bar = $('vis-bar-fill');
        if (bar) bar.style.width = `${Math.min(100, (km / 50) * 100)}%`;
    }

    // ── Air Quality ───────────────────────────────────────────────────────────
    function renderAirQuality(aq) {
        if (!aq?.current) {
            $('aq-section').style.opacity = '0.5';
            $('aqi-value').textContent = 'N/A';
            return;
        }
        $('aq-section').style.opacity = '1';
        const aqi = aq.current.european_aqi ?? aq.current.us_aqi;
        const { label, color } = UTILS.aqiInfo(aqi);
        $('aqi-value').textContent = aqi ?? 'N/A';
        $('aqi-label').textContent = label;
        $('aqi-label').style.color = color;
        const bar = $('aqi-bar-fill');
        if (bar) { bar.style.width = `${Math.min(100, (aqi / 150) * 100)}%`; bar.style.background = color; }

        // Pollutants
        const c = aq.current;
        $('pm25-val').textContent = c.pm2_5?.toFixed(1) ?? '–';
        $('pm10-val').textContent = c.pm10?.toFixed(1) ?? '–';
        $('o3-val').textContent = c.ozone?.toFixed(1) ?? '–';
        $('no2-val').textContent = c.nitrogen_dioxide?.toFixed(1) ?? '–';
        $('so2-val').textContent = c.sulphur_dioxide?.toFixed(1) ?? '–';
        $('co-val').textContent = c.carbon_monoxide?.toFixed(0) ?? '–';

        // Pollen
        renderPollen(c);
    }

    function renderPollen(c) {
        const types = [
            { id: 'grass-pollen', val: c.grass_pollen, label: '🌿 Grass' },
            { id: 'birch-pollen', val: c.birch_pollen, label: '🌳 Birch' },
            { id: 'alder-pollen', val: c.alder_pollen, label: '🌲 Alder' },
            { id: 'ragweed-pollen', val: c.ragweed_pollen, label: '🌾 Ragweed' },
            { id: 'mugwort-pollen', val: c.mugwort_pollen, label: '🌻 Mugwort' },
            { id: 'olive-pollen', val: c.olive_pollen, label: '🫒 Olive' },
        ];
        types.forEach(({ id, val, label }) => {
            const el = $(id);
            if (!el) return;
            const { label: lvl, color } = UTILS.pollenLevel(val);
            el.innerHTML = `<span>${label}</span><span style="color:${color}">${lvl}</span>`;
        });
    }

    // ── Lifestyle Scores ──────────────────────────────────────────────────────
    function renderLifestyleScores(cur) {
        const weather = {
            wind: cur.wind_speed_10m,
            precip: cur.precipitation,
            temp: cur.temperature_2m,
            uvi: cur.uv_index,
            code: cur.weather_code,
        };
        const activities = ['running', 'cycling', 'gardening', 'outdoor', 'beach'];
        const icons = { running: '🏃', cycling: '🚴', gardening: '🌱', outdoor: '🏕️', beach: '🏖️' };
        activities.forEach(act => {
            const score = UTILS.lifestyleScore(act, weather);
            const el = $(`score-${act}`);
            if (!el) return;
            const pct = score * 10;
            const color = score >= 7 ? '#4caf50' : score >= 4 ? '#ff9800' : '#f44336';
            el.innerHTML = `
        <div class="score-header">
          <span>${icons[act]} ${act.charAt(0).toUpperCase() + act.slice(1)}</span>
          <span style="color:${color};font-weight:700">${score}/10</span>
        </div>
        <div class="score-bar"><div class="score-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
        });
    }

    // ── Smart Summary ─────────────────────────────────────────────────────────
    function renderSmartSummary(cur, daily, hourly, unit) {
        const el = $('smart-summary-text');
        if (el) el.innerHTML = UTILS.generateSummary(cur, daily, hourly, unit);
    }

    // ── Charts ────────────────────────────────────────────────────────────────
    function renderCharts(hourly, daily, tz, unit) {
        // Hourly — next 48 hours
        const now = new Date();
        const h48 = hourly.time
            .map((t, i) => ({ t: new Date(t), i }))
            .filter(h => h.t >= now)
            .slice(0, 48);

        const hLabels = h48.map(({ t, i }) => UTILS.formatHour(hourly.time[i], tz));
        const hTemps = h48.map(({ i }) => hourly.temperature_2m[i]);
        const hFeels = h48.map(({ i }) => hourly.apparent_temperature[i]);
        const hProb = h48.map(({ i }) => hourly.precipitation_probability[i] || 0);
        const hPrecip = h48.map(({ i }) => hourly.precipitation[i] || 0);

        CHARTS.renderHourlyTemp(hLabels, hTemps, hFeels, unit);
        CHARTS.renderHourlyPrecip(hLabels, hProb, hPrecip);

        // Weekly chart
        const wLabels = daily.time.map(t => UTILS.formatDay(t + 'T00:00:00', tz));
        CHARTS.renderWeekly(wLabels, daily.temperature_2m_max, daily.temperature_2m_min, unit);
    }

    // ── Historical Lookup ─────────────────────────────────────────────────────
    async function loadHistorical() {
        const startEl = $('hist-start');
        const endEl = $('hist-end');
        if (!startEl?.value || !endEl?.value) { alert('Please select both start and end dates.'); return; }
        const loc = state.location;
        if (!loc) return;

        $('hist-table-body').innerHTML = `<tr><td colspan="6" style="text-align:center">Loading…</td></tr>`;
        try {
            const data = await API.getHistorical(loc.latitude, loc.longitude, startEl.value, endEl.value, loc.timezone || 'auto');
            renderHistoricalTable(data.daily);
        } catch {
            $('hist-table-body').innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger)">Failed to load historical data.</td></tr>`;
        }
    }

    function renderHistoricalTable(daily) {
        const tbody = $('hist-table-body');
        if (!daily?.time?.length) {
            tbody.innerHTML = `<tr><td colspan="6">No data found.</td></tr>`;
            return;
        }
        tbody.innerHTML = daily.time.map((t, i) => {
            const [icon, label] = UTILS.getWeatherIcon(daily.weather_code[i]);
            return `
        <tr>
          <td>${t}</td>
          <td>${icon} ${label}</td>
          <td>${UTILS.formatTemp(daily.temperature_2m_max[i], state.unit)}</td>
          <td>${UTILS.formatTemp(daily.temperature_2m_min[i], state.unit)}</td>
          <td>${daily.precipitation_sum[i]?.toFixed(1) ?? '–'} mm</td>
          <td>${UTILS.formatWind(daily.wind_speed_10m_max[i], state.unit)}</td>
        </tr>`;
        }).join('');
    }

    // ── Favorites ─────────────────────────────────────────────────────────────
    function toggleFavorite() {
        const loc = state.location;
        if (!loc) return;
        const idx = state.favorites.findIndex(f => f.name === loc.name && f.country === loc.country);
        if (idx > -1) {
            state.favorites.splice(idx, 1);
        } else {
            state.favorites.unshift({ name: loc.name, country: loc.country, country_code: loc.country_code, latitude: loc.latitude, longitude: loc.longitude, timezone: loc.timezone });
            if (state.favorites.length > 10) state.favorites.pop();
        }
        localStorage.setItem('wx_favorites', JSON.stringify(state.favorites));
        renderFavoritesBar();
        if (state.location) renderHeader(state.location, state.weather?.current, state.weather?.timezone);
    }

    function renderFavoritesBar() {
        const bar = $('favorites-bar');
        if (!bar) return;
        if (!state.favorites.length) { bar.innerHTML = '<span class="empty-fav">No favorite cities yet. Click ☆ to add one.</span>'; return; }
        bar.innerHTML = state.favorites.map(f => `
      <button class="fav-city-btn" data-lat="${f.latitude}" data-lon="${f.longitude}"
        data-name="${f.name}" data-country="${f.country}" data-cc="${f.country_code || ''}" data-tz="${f.timezone || 'auto'}">
        ${UTILS.countryFlag(f.country_code || '')} ${f.name}
      </button>`).join('');
        bar.querySelectorAll('.fav-city-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const loc = { name: btn.dataset.name, country: btn.dataset.country, country_code: btn.dataset.cc, latitude: +btn.dataset.lat, longitude: +btn.dataset.lon, timezone: btn.dataset.tz };
                loadWeather(loc);
            });
        });
    }

    // ── Recent Searches ───────────────────────────────────────────────────────
    function addToRecents(loc) {
        state.recents = state.recents.filter(r => r.name !== loc.name || r.country !== loc.country);
        state.recents.unshift({ name: loc.name, country: loc.country, country_code: loc.country_code || '', latitude: loc.latitude, longitude: loc.longitude, timezone: loc.timezone || 'auto' });
        if (state.recents.length > 8) state.recents.pop();
        localStorage.setItem('wx_recents', JSON.stringify(state.recents));
        renderRecentSearches();
    }

    function renderRecentSearches() {
        const el = $('recent-searches');
        if (!el) return;
        if (!state.recents.length) { el.innerHTML = ''; return; }
        el.innerHTML = state.recents.map(r => `
      <button class="recent-btn" data-lat="${r.latitude}" data-lon="${r.longitude}"
        data-name="${r.name}" data-country="${r.country}" data-cc="${r.country_code || ''}" data-tz="${r.timezone || 'auto'}">
        🕐 ${r.name}${r.country ? ', ' + r.country : ''}
      </button>`).join('');
        el.querySelectorAll('.recent-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const loc = { name: btn.dataset.name, country: btn.dataset.country, country_code: btn.dataset.cc, latitude: +btn.dataset.lat, longitude: +btn.dataset.lon, timezone: btn.dataset.tz };
                loadWeather(loc);
                $('search-dropdown').classList.remove('open');
            });
        });
    }

    // ── Search ────────────────────────────────────────────────────────────────
    async function handleSearch(query) {
        if (!query || query.trim().length < 2) {
            $('search-results').innerHTML = '';
            return;
        }
        try {
            const results = await API.searchCity(query.trim());
            renderSearchResults(results);
        } catch {
            $('search-results').innerHTML = '<div class="no-results">Search failed. Try again.</div>';
        }
    }

    function renderSearchResults(results) {
        const el = $('search-results');
        if (!results.length) { el.innerHTML = '<div class="no-results">No cities found.</div>'; return; }
        el.innerHTML = results.map(r => {
            const flag = UTILS.countryFlag(r.country_code || '');
            const admin = r.admin1 ? `, ${r.admin1}` : '';
            return `
        <div class="search-result-item" data-lat="${r.latitude}" data-lon="${r.longitude}"
          data-name="${r.name}" data-country="${r.country || ''}" data-cc="${r.country_code || ''}" data-tz="${r.timezone || 'auto'}">
          <span class="result-flag">${flag}</span>
          <span class="result-name">${r.name}${admin}</span>
          <span class="result-country">${r.country || ''}</span>
          <span class="result-coords">${r.latitude?.toFixed(2)}°, ${r.longitude?.toFixed(2)}°</span>
        </div>`;
        }).join('');
        el.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const loc = { name: item.dataset.name, country: item.dataset.country, country_code: item.dataset.cc, latitude: +item.dataset.lat, longitude: +item.dataset.lon, timezone: item.dataset.tz };
                loadWeather(loc);
                $('search-input').value = '';
                $('search-results').innerHTML = '';
                $('search-dropdown').classList.remove('open');
            });
        });
    }

    // ── Theme ─────────────────────────────────────────────────────────────────
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const btn = $('theme-toggle');
        if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('wx_theme', state.theme);
        applyTheme(state.theme);
    }

    // ── Unit ──────────────────────────────────────────────────────────────────
    function applyUnit(unit) {
        const btn = $('unit-toggle');
        if (btn) btn.textContent = unit === 'C' ? '°C / °F' : '°F / °C';
    }

    function toggleUnit() {
        state.unit = state.unit === 'C' ? 'F' : 'C';
        localStorage.setItem('wx_unit', state.unit);
        applyUnit(state.unit);
        if (state.weather) renderAll();
    }

    // ── Loading / Error ───────────────────────────────────────────────────────
    function showLoading(show) {
        state.loading = show;
        const overlay = $('loading-overlay');
        if (overlay) overlay.classList.toggle('hidden', !show);
    }

    function showError(msg) {
        const el = $('error-toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 5000);
    }

    // ── Events ────────────────────────────────────────────────────────────────
    function bindEvents() {
        // Theme toggle
        $('theme-toggle')?.addEventListener('click', toggleTheme);

        // Unit toggle
        $('unit-toggle')?.addEventListener('click', toggleUnit);

        // GPS button — reset stored choice, then silently re-detect
        $('gps-btn')?.addEventListener('click', () => {
            state.locPermission = null;
            localStorage.removeItem('wx_loc_permission');
            detectLocation(/* silent */ true); // don't reload default if weather already showing
        });

        // Location permission modal buttons
        $('loc-allow-btn')?.addEventListener('click', () => {
            hidePermissionModal();
            state.locPermission = 'granted';
            detectLocation();
        });
        $('loc-deny-btn')?.addEventListener('click', () => {
            hidePermissionModal();
            state.locPermission = 'denied';
            localStorage.setItem('wx_loc_permission', 'denied');
            loadDefault();
        });
        $('loc-skip-btn')?.addEventListener('click', () => {
            hidePermissionModal();
            state.locPermission = 'skipped';
            localStorage.setItem('wx_loc_permission', 'skipped');
            loadDefault();
        });

        // Favorite
        $('fav-btn')?.addEventListener('click', toggleFavorite);

        // Search input
        const searchInput = $('search-input');
        const dropdown = $('search-dropdown');
        searchInput?.addEventListener('input', e => {
            clearTimeout(state.searchTimer);
            const q = e.target.value.trim();
            if (q.length >= 2) {
                dropdown.classList.add('open');
                state.searchTimer = setTimeout(() => handleSearch(q), 350);
            } else {
                dropdown.classList.remove('open');
                $('search-results').innerHTML = '';
            }
        });

        searchInput?.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2) dropdown.classList.add('open');
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('.search-container')) {
                dropdown.classList.remove('open');
            }
        });

        // Keyboard search on Enter
        searchInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') handleSearch(e.target.value);
        });

        // Historical load
        $('hist-load-btn')?.addEventListener('click', loadHistorical);

        // Map layer toggles
        $$('.map-layer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.map-layer-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                MAPS.switchLayer(btn.dataset.layer);
            });
        });

        // Tab navigation
        $$('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                $$('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                $$('.tab-panel').forEach(p => p.classList.remove('active'));
                $(`tab-${tab}`)?.classList.add('active');
                if (tab === 'map') MAPS.invalidate();
            });
        });

        // Set historical date defaults
        const today = new Date();
        const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
        const toStr = d => d.toISOString().split('T')[0];
        const histEnd = $('hist-end'); if (histEnd) histEnd.value = toStr(today);
        const histStart = $('hist-start'); if (histStart) histStart.value = toStr(weekAgo);

        // Live clock update
        setInterval(() => {
            if (state.location && state.weather) {
                const tz = state.weather.timezone;
                const timeEl = $('loc-time');
                if (timeEl) timeEl.textContent = UTILS.formatLocalTime(tz);
            }
        }, 60000);
    }

    return { init };
})();

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => APP.init());
