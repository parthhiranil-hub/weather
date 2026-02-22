// ─── API Module ───────────────────────────────────────────────────────────────
const API = (() => {
  const GEO_BASE   = 'https://geocoding-api.open-meteo.com/v1';
  const WX_BASE    = 'https://api.open-meteo.com/v1';
  const AQ_BASE    = 'https://air-quality-api.open-meteo.com/v1';
  const ARCH_BASE  = 'https://archive-api.open-meteo.com/v1';

  const CURRENT_VARS = [
    'temperature_2m','relative_humidity_2m','apparent_temperature',
    'is_day','precipitation','weather_code',
    'pressure_msl','surface_pressure','wind_speed_10m','wind_direction_10m',
    'wind_gusts_10m','visibility','dew_point_2m','uv_index','cloud_cover',
  ].join(',');

  const HOURLY_VARS = [
    'temperature_2m','precipitation_probability','precipitation',
    'weather_code','wind_speed_10m','wind_direction_10m',
    'apparent_temperature','relative_humidity_2m','uv_index',
    'visibility','dew_point_2m','cloud_cover',
  ].join(',');

  const DAILY_VARS = [
    'weather_code','temperature_2m_max','temperature_2m_min',
    'apparent_temperature_max','apparent_temperature_min',
    'sunrise','sunset','uv_index_max','precipitation_sum',
    'precipitation_probability_max','wind_speed_10m_max',
    'wind_direction_10m_dominant','shortwave_radiation_sum',
  ].join(',');

  const AQ_VARS = [
    'pm10','pm2_5','carbon_monoxide','nitrogen_dioxide',
    'sulphur_dioxide','ozone','aerosol_optical_depth',
    'european_aqi','us_aqi',
    'alder_pollen','birch_pollen','grass_pollen','mugwort_pollen','olive_pollen','ragweed_pollen',
  ].join(',');

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
  }

  // Geocoding — search cities
  async function searchCity(query, count = 8) {
    const url = `${GEO_BASE}/search?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`;
    const data = await fetchJSON(url);
    return data.results || [];
  }

  // Reverse geocode via lat/lon using timezone + data
  async function reverseGeocode(lat, lon) {
    // Open-Meteo doesn't have reverse geocoding directly, use nominatim
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    try {
      const data = await fetchJSON(url);
      return {
        name: data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'Unknown',
        country: data.address?.country || '',
        country_code: data.address?.country_code?.toUpperCase() || '',
        admin1: data.address?.state || '',
        latitude: lat,
        longitude: lon,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    } catch {
      return { name: 'Your Location', country: '', latitude: lat, longitude: lon };
    }
  }

  // Main forecast
  async function getWeather(lat, lon, timezone = 'auto') {
    const url = `${WX_BASE}/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=${CURRENT_VARS}` +
      `&hourly=${HOURLY_VARS}` +
      `&daily=${DAILY_VARS}` +
      `&timezone=${encodeURIComponent(timezone)}` +
      `&forecast_days=14&wind_speed_unit=kmh`;
    return fetchJSON(url);
  }

  // Air quality
  async function getAirQuality(lat, lon, timezone = 'auto') {
    const url = `${AQ_BASE}/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=${AQ_VARS}` +
      `&hourly=pm10,pm2_5,european_aqi,us_aqi` +
      `&timezone=${encodeURIComponent(timezone)}`;
    return fetchJSON(url);
  }

  // Historical (archive)
  async function getHistorical(lat, lon, startDate, endDate, timezone = 'auto') {
    const vars = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code';
    const url = `${ARCH_BASE}/archive?latitude=${lat}&longitude=${lon}` +
      `&daily=${vars}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&timezone=${encodeURIComponent(timezone)}`;
    return fetchJSON(url);
  }

  return { searchCity, reverseGeocode, getWeather, getAirQuality, getHistorical };
})();
