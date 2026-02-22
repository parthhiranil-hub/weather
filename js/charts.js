// ─── Charts Module (Chart.js) ─────────────────────────────────────────────────
const CHARTS = (() => {
    let hourlyTempChart = null;
    let hourlyPrecipChart = null;
    let weeklyChart = null;

    function destroyChart(c) { if (c) { try { c.destroy(); } catch (e) { } } }

    const commonOptions = (unit) => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                labels: { color: 'var(--text-primary)', font: { family: 'Inter', size: 12 } },
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.75)',
                titleColor: '#fff', bodyColor: '#ddd',
                padding: 10, cornerRadius: 8,
            },
        },
        scales: {
            x: {
                ticks: { color: 'var(--text-secondary)', maxRotation: 0, maxTicksLimit: 12 },
                grid: { color: 'rgba(128,128,128,0.15)' },
            },
            y: {
                ticks: { color: 'var(--text-secondary)' },
                grid: { color: 'rgba(128,128,128,0.15)' },
            },
        },
    });

    // Hourly temperature line chart (48 hours)
    function renderHourlyTemp(labels, temps, feelsLike, unit) {
        destroyChart(hourlyTempChart);
        const ctx = document.getElementById('hourly-temp-chart');
        if (!ctx) return;
        hourlyTempChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: `Temp (°${unit === 'F' ? 'F' : 'C'})`,
                        data: unit === 'F' ? temps.map(UTILS.cToF).map(Math.round) : temps.map(Math.round),
                        borderColor: '#ff6b35',
                        backgroundColor: 'rgba(255,107,53,0.15)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                    },
                    {
                        label: `Feels Like`,
                        data: unit === 'F' ? feelsLike.map(UTILS.cToF).map(Math.round) : feelsLike.map(Math.round),
                        borderColor: '#4ecdc4',
                        backgroundColor: 'rgba(78,205,196,0.08)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        borderDash: [5, 4],
                        pointRadius: 2,
                    },
                ],
            },
            options: {
                ...commonOptions(unit),
                plugins: {
                    ...commonOptions(unit).plugins,
                    title: { display: false },
                },
            },
        });
    }

    // Hourly precipitation probability bar chart (48 hours)
    function renderHourlyPrecip(labels, probabilities, precipAmounts) {
        destroyChart(hourlyPrecipChart);
        const ctx = document.getElementById('hourly-precip-chart');
        if (!ctx) return;
        hourlyPrecipChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Rain Probability (%)',
                        data: probabilities,
                        backgroundColor: 'rgba(66,153,225,0.7)',
                        borderColor: '#4299e1',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Precipitation (mm)',
                        data: precipAmounts,
                        type: 'line',
                        borderColor: '#e54d7a',
                        backgroundColor: 'rgba(229,77,122,0.12)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        yAxisID: 'y1',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: 'var(--text-primary)', font: { family: 'Inter', size: 12 } } },
                    tooltip: { backgroundColor: 'rgba(0,0,0,0.75)', titleColor: '#fff', bodyColor: '#ddd', padding: 10, cornerRadius: 8 },
                },
                scales: {
                    x: { ticks: { color: 'var(--text-secondary)', maxRotation: 0, maxTicksLimit: 12 }, grid: { color: 'rgba(128,128,128,0.15)' } },
                    y: { position: 'left', min: 0, max: 100, ticks: { color: '#4299e1', callback: v => v + '%' }, grid: { color: 'rgba(128,128,128,0.15)' } },
                    y1: { position: 'right', min: 0, ticks: { color: '#e54d7a', callback: v => v + 'mm' }, grid: { drawOnChartArea: false } },
                },
            },
        });
    }

    // 14-Day min/max temperature chart
    function renderWeekly(labels, highs, lows, unit) {
        destroyChart(weeklyChart);
        const ctx = document.getElementById('weekly-chart');
        if (!ctx) return;
        const conv = unit === 'F' ? v => Math.round(UTILS.cToF(v)) : v => Math.round(v);
        weeklyChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: `High (°${unit === 'F' ? 'F' : 'C'})`,
                        data: highs.map(conv),
                        borderColor: '#ff6b35',
                        backgroundColor: 'rgba(255,107,53,0.15)',
                        borderWidth: 2.5,
                        fill: '+1',
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#ff6b35',
                    },
                    {
                        label: `Low (°${unit === 'F' ? 'F' : 'C'})`,
                        data: lows.map(conv),
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66,153,225,0.10)',
                        borderWidth: 2.5,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#4299e1',
                    },
                ],
            },
            options: commonOptions(unit),
        });
    }

    return { renderHourlyTemp, renderHourlyPrecip, renderWeekly };
})();
