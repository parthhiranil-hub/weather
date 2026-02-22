// ─── Maps Module (Leaflet) ────────────────────────────────────────────────────
const MAPS = (() => {
    let map = null;
    let baseLayer = null;
    let currentOverlay = null;
    let userMarker = null;

    const OVERLAYS = {
        temp: {
            label: '🌡️ Temperature',
            url: 'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=demo',
            // Use Rainviewer tiles instead (free, no key)
            urlFree: null,
        },
        precipitation: {
            label: '🌧️ Precipitation',
            urlFree: 'https://tilecache.rainviewer.com/v2/coverage/0/256/{z}/{x}/{y}/2/1_1.png',
        },
        clouds: {
            label: '☁️ Clouds',
            urlFree: null,
        },
        wind: {
            label: '💨 Wind',
            urlFree: null,
        },
    };

    function init(lat, lon) {
        const container = document.getElementById('weather-map');
        if (!container) return;

        if (map) {
            map.setView([lat, lon], 8);
            if (userMarker) userMarker.setLatLng([lat, lon]);
            return;
        }

        map = L.map('weather-map', { zoomControl: true }).setView([lat, lon], 8);

        baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        // User location marker
        userMarker = L.circleMarker([lat, lon], {
            radius: 10,
            fillColor: '#ff6b35',
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9,
        }).addTo(map).bindPopup('📍 Your Location');

        // Try to add RainViewer precipitation overlay
        tryAddRainViewer();
    }

    function tryAddRainViewer() {
        // Fetch RainViewer latest frame
        fetch('https://api.rainviewer.com/public/weather-maps.json')
            .then(r => r.json())
            .then(data => {
                const frames = data.radar?.past;
                if (!frames || !frames.length || !map) return;
                const latest = frames[frames.length - 1];
                const url = `${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;
                if (currentOverlay) { map.removeLayer(currentOverlay); }
                currentOverlay = L.tileLayer(url, { opacity: 0.6, attribution: 'RainViewer' }).addTo(map);
            })
            .catch(() => {/* silently fail */ });
    }

    function switchLayer(type) {
        if (!map) return;
        if (currentOverlay) { map.removeLayer(currentOverlay); currentOverlay = null; }
        if (!type || type === 'none') return;
        if (type === 'precipitation') {
            tryAddRainViewer();
            return;
        }
    }

    function setCenter(lat, lon) {
        if (!map) return;
        map.setView([lat, lon], 8);
        if (userMarker) userMarker.setLatLng([lat, lon]);
        else {
            userMarker = L.circleMarker([lat, lon], {
                radius: 10, fillColor: '#ff6b35', color: '#fff', weight: 3, opacity: 1, fillOpacity: 0.9,
            }).addTo(map).bindPopup('📍 Your Location');
        }
    }

    function invalidate() {
        if (map) setTimeout(() => map.invalidateSize(), 300);
    }

    return { init, switchLayer, setCenter, invalidate };
})();
