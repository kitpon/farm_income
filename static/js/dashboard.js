// Dashboard Javascript Logic for Thailand Agricultural Intelligence

document.addEventListener('DOMContentLoaded', () => {
    // State
    let dashboardData = null;
    let charts = {};

    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const refreshBtn = document.getElementById('refresh-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const lastUpdatedSpan = document.getElementById('last-updated-time');

    // Chart Style Constants from color_style.txt
    const COLORS = {
        darkGrey: '#3F4C54',
        red: '#C33B32',
        vino: '#760E3A',
        gold: '#A89983',
        steelGrey: '#DBE0E4',
        orange: '#E67E22',
    };

    const CHART_FONTS = {
        family: 'Sarabun, sans-serif',
        titleFamily: 'Kanit, sans-serif',
        headerSize: 18,
        subheaderSize: 12,
        tickSize: 14,
        axisSize: 14,
        valueSize: 13
    };

    // Register ChartDataLabels plugin if available and set global defaults safely
    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }
    
    Chart.defaults.font = {
        family: CHART_FONTS.family,
        size: CHART_FONTS.tickSize
    };

    // Safe legend font default
    if (Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
        Chart.defaults.plugins.legend.labels.font = {
            family: CHART_FONTS.family,
            size: CHART_FONTS.tickSize
        };
    }

    // Safe tooltip font defaults
    if (Chart.defaults.plugins.tooltip) {
        Chart.defaults.plugins.tooltip.titleFont = {
            family: CHART_FONTS.titleFamily,
            size: CHART_FONTS.tickSize
        };
        Chart.defaults.plugins.tooltip.bodyFont = {
            family: CHART_FONTS.family,
            size: CHART_FONTS.valueSize
        };
    }

    // Safe datalabels defaults
    if (Chart.defaults.plugins.datalabels) {
        Chart.defaults.plugins.datalabels.font = {
            family: CHART_FONTS.family,
            size: CHART_FONTS.valueSize,
            weight: 'bold'
        };
        Chart.defaults.plugins.datalabels.display = false; // Disabled by default, enabled selectively
    }

    // Initialize Dashboard
    init();

    function init() {
        // Fetch Initial Data
        fetchData();

        // Setup Event Listeners
        setupTabNavigation();
        setupRefreshButton();
        setupCropsSelector();
        setupProductionSelector();
        setupOverviewToggle();
    }

    // Fetch data from backend
    async function fetchData(isRefresh = false) {
        showLoading(true);
        const url = isRefresh ? '/api/refresh' : '/api/dashboard-data';
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const result = await response.json();
            dashboardData = result.data;
            lastUpdatedSpan.textContent = result.last_updated;
            
            // Populate dashboard
            updateKPIs();
            renderAllCharts();
            updateInsights();
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            alert('ไม่สามารถโหลดข้อมูลจาก API ได้ในขณะนี้ ระบบจะแสดงผลจากหน่วยความจำแคช หรือกรุณาลองใหม่อีกครั้ง');
        } finally {
            showLoading(false);
        }
    }

    function showLoading(show) {
        if (show) {
            loadingOverlay.style.opacity = '1';
            loadingOverlay.style.pointerEvents = 'auto';
            refreshBtn.querySelector('i').classList.add('icon-rotate-animation');
        } else {
            loadingOverlay.style.opacity = '0';
            loadingOverlay.style.pointerEvents = 'none';
            refreshBtn.querySelector('i').classList.remove('icon-rotate-animation');
        }
    }

    // Tab Navigation setup
    function setupTabNavigation() {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                
                // Toggle active buttons
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Toggle active panes
                tabPanes.forEach(pane => {
                    if (pane.id === targetTab) {
                        pane.classList.add('active');
                    } else {
                        pane.classList.remove('active');
                    }
                });

                // Trigger resize for charts in the active tab to render properly
                setTimeout(() => {
                    Object.values(charts).forEach(chart => {
                        if (chart) chart.resize();
                    });
                }, 50);
            });
        });
    }

    // Refresh Button Event
    function setupRefreshButton() {
        refreshBtn.addEventListener('click', () => {
            fetchData(true);
        });
    }

    // Selectors setup
    function setupCropsSelector() {
        const cropSelect = document.getElementById('crop-select');
        cropSelect.addEventListener('change', () => {
            renderCropChart(cropSelect.value);
        });
    }

    function setupProductionSelector() {
        const prodSelect = document.getElementById('prod-crop-select');
        prodSelect.addEventListener('change', () => {
            renderProductionChart(prodSelect.value);
        });
    }

    // Update KPIs at the top
    function updateKPIs() {
        if (!dashboardData) return;

        // 1. Production Index
        const prodList = dashboardData.production_index || [];
        if (prodList.length > 0) {
            // Data is sorted descending by date (latest first)
            const latest = prodList[0];
            const prev = prodList[1] || latest;
            const latestVal = latest.production_index;
            const prevVal = prev.production_index;
            const momPercent = ((latestVal - prevVal) / prevVal * 100).toFixed(2);
            
            document.getElementById('kpi-production-val').textContent = latestVal.toFixed(2);
            setChangeIndicator(document.getElementById('kpi-production-change'), momPercent, 'MoM');
        }

        // 2. Price Index
        const priceList = dashboardData.price_index || [];
        if (priceList.length > 0) {
            const latest = priceList[0];
            const prev = priceList[1] || latest;
            const latestVal = latest.price_index;
            const prevVal = prev.price_index;
            const momPercent = ((latestVal - prevVal) / prevVal * 100).toFixed(2);

            document.getElementById('kpi-price-val').textContent = latestVal.toFixed(2);
            setChangeIndicator(document.getElementById('kpi-price-change'), momPercent, 'MoM');
        }

        // 3. Farm Income Index (calculated)
        const incomeList = dashboardData.farm_income_index || [];
        if (incomeList.length > 0) {
            const latest = incomeList[0];
            const prev = incomeList[1] || latest;
            const latestVal = latest.farm_income_index;
            const prevVal = prev.farm_income_index;
            const momPercent = ((latestVal - prevVal) / prevVal * 100).toFixed(2);

            document.getElementById('kpi-income-val').textContent = latestVal.toFixed(2);
            setChangeIndicator(document.getElementById('kpi-income-change'), momPercent, 'MoM');
        }

        // 4. Pork Price (Live Pig)
        const porkWeeklyList = dashboardData.weekly_pork || [];
        if (porkWeeklyList.length > 0) {
            const latest = porkWeeklyList[0];
            const prev = porkWeeklyList[1] || latest;
            const latestVal = parseFloat(latest.value);
            const prevVal = parseFloat(prev.value);
            const wowPercent = ((latestVal - prevVal) / prevVal * 100).toFixed(2);

            document.getElementById('kpi-pork-val').textContent = `${latestVal.toFixed(2)} บาท/กก.`;
            setChangeIndicator(document.getElementById('kpi-pork-change'), wowPercent, 'WoW');
        }
    }

    function setChangeIndicator(element, percent, type = 'MoM') {
        const isUp = percent >= 0;
        const arrow = isUp ? '↑' : '↓';
        const className = isUp ? 'up' : 'down';
        const plusSign = isUp ? '+' : '';
        
        element.className = `kpi-change ${className}`;
        element.innerHTML = `<i class="fa-solid ${isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${plusSign}${percent}% ${type}`;
    }

    // Helper to format Thai date (Year TH month)
    const monthNamesTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    
    function formatThaiMonthYear(yearTH, monthStr) {
        const monthIdx = parseInt(monthStr, 10) - 1;
        return `${monthNamesTH[monthIdx]} ${yearTH}`;
    }

    // Render all charts
    function renderAllCharts() {
        if (!dashboardData) return;

        renderOverviewChart();
        renderOverviewChangesChart();
        renderPorkChart();
        renderPorkBuffaloChart();
        
        const cropSelect = document.getElementById('crop-select');
        renderCropChart(cropSelect.value);

        const prodSelect = document.getElementById('prod-crop-select');
        renderProductionChart(prodSelect.value);
        
        renderLimeChart();
    }

    // 1. Overview Chart (Macro Indices)
    function renderOverviewChart() {
        const ctx = document.getElementById('overviewChart').getContext('2d');
        
        // Reverse array to show chronological order (left to right)
        const rawData = [...(dashboardData.farm_income_index || [])].reverse();
        
        // Take last 36 months to prevent crowding
        const data = rawData.slice(-36);
        
        const labels = data.map(item => formatThaiMonthYear(item.year_th, item.month));
        const prodValues = data.map(item => item.production_index);
        const priceValues = data.map(item => item.price_index);
        const incomeValues = data.map(item => item.farm_income_index);

        if (charts.overview) charts.overview.destroy();

        charts.overview = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'ดัชนีผลผลิตสินค้าเกษตร',
                        data: prodValues,
                        borderColor: COLORS.darkGrey,
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointRadius: 3,
                        tension: 0.2
                    },
                    {
                        label: 'ดัชนีราคาสินค้าเกษตร',
                        data: priceValues,
                        borderColor: COLORS.red,
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointRadius: 3,
                        tension: 0.2
                    },
                    {
                        label: 'ดัชนีรายได้เกษตรกร',
                        data: incomeValues,
                        borderColor: COLORS.vino,
                        backgroundColor: 'transparent',
                        borderWidth: 4,
                        pointRadius: 4,
                        pointBackgroundColor: COLORS.vino,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        }
                    },
                    tooltip: {
                        titleFont: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.tickSize },
                        bodyFont: { family: CHART_FONTS.family, size: CHART_FONTS.valueSize }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize },
                            maxTicksLimit: 12
                        },
                        title: {
                            display: true,
                            text: 'เดือน/ปี พ.ศ.',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    },
                    y: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: 'ค่าดัชนี (ปีฐาน 2563 = 100)',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    }
                }
            }
        });
    }

    // 2. Pork Price Chart (Weekly vs Monthly)
    function renderPorkChart() {
        const ctx = document.getElementById('porkChart').getContext('2d');
        
        // Process weekly data
        const weeklyData = [...(dashboardData.weekly_pork || [])].reverse();
        // Process monthly data
        const monthlyData = [...(dashboardData.monthly_pork || [])].reverse();
        
        // Slice to fit neatly
        const wSlice = weeklyData.slice(-30);
        const mSlice = monthlyData.slice(-12);

        // Labels for weekly (Week no/Month/Year)
        const weeklyLabels = wSlice.map(item => `สัปดาห์ที่ ${item.week} ของเดือน ${formatThaiMonthYear(item.year_th, item.month)}`);
        const weeklyValues = wSlice.map(item => parseFloat(item.value));

        if (charts.pork) charts.pork.destroy();

        charts.pork = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeklyLabels,
                datasets: [
                    {
                        label: 'ราคารายสัปดาห์ (บาท/กก.)',
                        data: weeklyValues,
                        borderColor: COLORS.orange,
                        backgroundColor: 'rgba(230, 126, 34, 0.05)',
                        fill: true,
                        borderWidth: 3,
                        pointRadius: 4,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        }
                    },
                    tooltip: {
                        titleFont: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.tickSize },
                        bodyFont: { family: CHART_FONTS.family, size: CHART_FONTS.valueSize }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: 11 }, // smaller ticks because text is long
                            maxTicksLimit: 8
                        },
                        title: {
                            display: true,
                            text: 'สัปดาห์ที่บันทึกข้อมูล',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    },
                    y: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: 'ราคาหน้าฟาร์ม (บาท/กิโลกรัม)',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    }
                }
            }
        });

        // Update Pork Info Cards
        if (weeklyValues.length > 0) {
            const latestVal = weeklyValues[weeklyValues.length - 1];
            document.getElementById('pork-latest-val').textContent = `${latestVal.toFixed(2)} บาท/กก.`;
            
            const maxVal = Math.max(...weeklyValues);
            const minVal = Math.min(...weeklyValues);
            document.getElementById('pork-max-val').textContent = `${maxVal.toFixed(2)} บาท/กก.`;
            document.getElementById('pork-min-val').textContent = `${minVal.toFixed(2)} บาท/กก.`;
        }
        
        if (mSlice.length > 0) {
            const latestMonthly = parseFloat(mSlice[mSlice.length - 1].value);
            document.getElementById('pork-monthly-val').textContent = `${latestMonthly.toFixed(2)} บาท/กก.`;
        }
    }

    // 3. Pork vs Buffalo Chart (Dual Y-Axis)
    function renderPorkBuffaloChart() {
        const ctx = document.getElementById('porkBuffaloChart').getContext('2d');
        
        const porkData = [...(dashboardData.weekly_pork || [])].reverse().slice(-24);
        const buffaloData = [...(dashboardData.weekly_buffalo || [])].reverse().slice(-24);
        
        // Group by (year, month, week) to align dates
        const alignedLabels = [];
        const porkValues = [];
        const buffaloValues = [];

        porkData.forEach(pItem => {
            const match = buffaloData.find(bItem => 
                bItem.year_th === pItem.year_th && 
                bItem.month === pItem.month && 
                bItem.week === pItem.week
            );
            if (match) {
                alignedLabels.push(`W${pItem.week} ${formatThaiMonthYear(pItem.year_th, pItem.month)}`);
                porkValues.push(parseFloat(pItem.value));
                buffaloValues.push(parseFloat(match.value));
            }
        });

        if (charts.porkBuffalo) charts.porkBuffalo.destroy();

        charts.porkBuffalo = new Chart(ctx, {
            type: 'line',
            data: {
                labels: alignedLabels,
                datasets: [
                    {
                        label: 'ราคาสุกร (แกนซ้าย - บาท/กก.)',
                        data: porkValues,
                        borderColor: COLORS.orange,
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'ราคากระบือ ขนาดกลาง (แกนขวา - บาท/ตัว)',
                        data: buffaloValues,
                        borderColor: COLORS.gold,
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointRadius: 4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        }
                    },
                    tooltip: {
                        titleFont: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.tickSize },
                        bodyFont: { family: CHART_FONTS.family, size: CHART_FONTS.valueSize }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: 12 },
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: 'ราคาสุกรมีชีวิต (บาท/กิโลกรัม)',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false // only want the grid lines for one axis
                        },
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: 'ราคากระบือขนาดกลาง (บาท/ตัว)',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    }
                }
            }
        });
    }

    // 4. Crop Chart (Key Crops)
    function renderCropChart(cropType) {
        const ctx = document.getElementById('cropChart').getContext('2d');
        const badge = document.getElementById('crop-unit-badge');
        const title = document.getElementById('crop-chart-title');
        const tableBody = document.querySelector('#crop-products-table tbody');

        let dataKey = `weekly_${cropType}`;
        let rawData = [...(dashboardData[dataKey] || [])].reverse();
        
        // Take last 30 entries
        let data = rawData.slice(-30);

        if (data.length === 0) {
            if (charts.crop) charts.crop.destroy();
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center">ไม่มีข้อมูลสำหรับสินค้ากลุ่มนี้</td></tr>`;
            return;
        }

        // Identify unique products
        const uniqueProducts = [...new Set(data.map(item => item.product_name))];
        const unit = data[0].unit;
        badge.textContent = unit;
        title.textContent = `แนวโน้มราคา ${data[0].commod}`;

        // Group data values by product
        const datasets = [];
        const labelsSet = new Set();
        
        // Create full list of week labels
        data.forEach(item => {
            labelsSet.add(`W${item.week} ${formatThaiMonthYear(item.year_th, item.month)}`);
        });
        const labels = Array.from(labelsSet);

        // Color mapper for datasets
        const datasetColors = [COLORS.vino, COLORS.gold, COLORS.darkGrey, COLORS.red, COLORS.orange];
        
        uniqueProducts.forEach((prod, idx) => {
            // Find values chronologically
            const prodData = data.filter(item => item.product_name === prod);
            const values = labels.map(label => {
                // Find matching item by week label
                const item = prodData.find(d => `W${d.week} ${formatThaiMonthYear(d.year_th, d.month)}` === label);
                return item ? parseFloat(item.value) : null;
            });

            datasets.push({
                label: prod,
                data: values,
                borderColor: datasetColors[idx % datasetColors.length],
                backgroundColor: 'transparent',
                borderWidth: 3,
                pointRadius: 4,
                spanGaps: true
            });
        });

        if (charts.crop) charts.crop.destroy();

        charts.crop = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        }
                    },
                    tooltip: {
                        titleFont: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.tickSize },
                        bodyFont: { family: CHART_FONTS.family, size: CHART_FONTS.valueSize }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: 12 },
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: `ราคาเฉลี่ย (${unit})`,
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    }
                }
            }
        });

        // Update detailed table
        tableBody.innerHTML = '';
        uniqueProducts.forEach(prod => {
            const prodData = data.filter(item => item.product_name === prod);
            if (prodData.length > 0) {
                const latestVal = parseFloat(prodData[prodData.length - 1].value);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${prod}</td>
                    <td class="text-right font-weight-bold" style="font-family: var(--font-header); font-weight:600; font-size: 15px;">
                        ${latestVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td style="color: var(--text-muted); font-size:12px;">${unit}</td>
                `;
                tableBody.appendChild(row);
            }
        });
        
        // Add insights text
        updateCropInsights(cropType, data);
    }

    // 5. Production Chart (Annual Crops stats)
    function renderProductionChart(cropName) {
        const ctx = document.getElementById('productionChart').getContext('2d');
        const dataKey = `production_${cropName === 'ข้าว' ? 'rice' : 
                                  cropName === 'ยางพารา' ? 'rubber' : 
                                  cropName === 'มันสำปะหลัง' ? 'cassava' : 
                                  cropName === 'ข้าวโพดเลี้ยงสัตว์' ? 'corn' : 'oilpalm'}`;

        const rawData = [...(dashboardData[dataKey] || [])].reverse();
        
        if (rawData.length === 0) {
            if (charts.production) charts.production.destroy();
            return;
        }

        const labels = rawData.map(item => `ปี ${item.year_th}`);
        const areaPlanted = rawData.map(item => parseFloat(item.area_plant));
        const areaHarvested = rawData.map(item => parseFloat(item.area_harvest));
        const production = rawData.map(item => parseFloat(item.production));
        
        // Yield is yield_harvest (ผลผลิตต่อไร่เก็บเกี่ยว)
        const yieldHarvest = rawData.map(item => parseFloat(item.yield_harvest));

        if (charts.production) charts.production.destroy();

        charts.production = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'ผลผลิตรวม (ตัน)',
                        data: production,
                        backgroundColor: COLORS.vino,
                        borderColor: COLORS.vino,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'พื้นที่เพาะปลูก (ไร่)',
                        data: areaPlanted,
                        backgroundColor: COLORS.steelGrey,
                        borderColor: COLORS.darkGrey,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'ผลผลิตต่อไร่เก็บเกี่ยว (กก./ไร่)',
                        data: yieldHarvest,
                        type: 'line',
                        borderColor: COLORS.red,
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointRadius: 4,
                        yAxisID: 'y1',
                        datalabels: {
                            display: true,
                            align: 'top',
                            anchor: 'end',
                            color: COLORS.red,
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.valueSize, weight: 'bold' }
                        }
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        }
                    },
                    tooltip: {
                        titleFont: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.tickSize },
                        bodyFont: { family: CHART_FONTS.family, size: CHART_FONTS.valueSize }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: 'ปริมาณผลผลิต (ตัน) / พื้นที่เพาะปลูก (ไร่)',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: 'ผลผลิตเฉลี่ยต่อไร่ (กก./ไร่)',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    }
                }
            }
        });

        // Update Side Cards
        const latest = rawData[rawData.length - 1];
        if (latest) {
            document.getElementById('prod-total-val').textContent = `${parseFloat(latest.production).toLocaleString()} ตัน`;
            document.getElementById('prod-harvest-area-val').textContent = `${parseFloat(latest.area_harvest).toLocaleString()} ไร่`;
            document.getElementById('prod-yield-val').textContent = `${parseFloat(latest.yield_harvest).toLocaleString()} กก./ไร่`;

            // Insights text
            const insightsBox = document.getElementById('production-insights');
            insightsBox.innerHTML = `
                <div class="insight-paragraph">
                    ในปีเพาะปลูกล่าสุด <strong>พ.ศ. ${latest.year_th}</strong> การเพาะปลูก <strong>${latest.commod}</strong> ในประเทศไทยมีผลผลิตรวมประมาณ <strong>${parseFloat(latest.production).toLocaleString()} ตัน</strong> บนพื้นที่เก็บเกี่ยวผลผลิตจริง <strong>${parseFloat(latest.area_harvest).toLocaleString()} ไร่</strong>
                </div>
                <div class="insight-paragraph">
                    อัตราผลผลิตเฉลี่ยต่อไร่เก็บเกี่ยวอยู่ที่ <strong>${parseFloat(latest.yield_harvest).toLocaleString()} กิโลกรัมต่อไร่</strong> บ่งชี้ถึงประสิทธิภาพการเพาะปลูกรวมเฉลี่ยระดับประเทศ
                </div>
            `;
        }
    }

    // 6. Daily Lime Price Chart
    function renderLimeChart() {
        const ctx = document.getElementById('limeChart').getContext('2d');
        const rawData = [...(dashboardData.daily_lime || [])].reverse();
        
        // Take last 30 entries
        const data = rawData.slice(-30);
        
        if (data.length === 0) {
            if (charts.lime) charts.lime.destroy();
            return;
        }

        const labels = data.map(item => {
            const parts = item.data_date.split('-');
            return `${parts[2]}/${parts[1]}`; // DD/MM format
        });
        const prices = data.map(item => parseFloat(item.day_price));

        if (charts.lime) charts.lime.destroy();

        charts.lime = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'ราคามะนาว (บาท/ร้อยผล)',
                        data: prices,
                        borderColor: COLORS.red,
                        backgroundColor: 'rgba(195, 59, 50, 0.05)',
                        fill: true,
                        borderWidth: 3,
                        pointRadius: 4,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        }
                    },
                    tooltip: {
                        titleFont: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.tickSize },
                        bodyFont: { family: CHART_FONTS.family, size: CHART_FONTS.valueSize }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize },
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: 'ราคาขายส่ง (บาท/100 ผล)',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    }
                }
            }
        });

        // Update Side KPI
        const latest = data[data.length - 1];
        const sum = prices.reduce((a, b) => a + b, 0);
        const avg = sum / prices.length;
        
        document.getElementById('lime-latest-val').textContent = `${parseFloat(latest.day_price).toFixed(2)} บาท`;
        document.getElementById('lime-avg-val').textContent = `${avg.toFixed(2)} บาท/100 ผล`;
        document.getElementById('lime-market-val').textContent = latest.market_name;

        // Daily table update
        const tableBody = document.querySelector('#lime-table tbody');
        tableBody.innerHTML = '';
        
        // Show in descending order (latest first) for table
        [...data].reverse().forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.data_date}</td>
                <td>${item.product_name}</td>
                <td>${item.market_name}</td>
                <td>${item.province}</td>
                <td class="text-right font-weight-bold" style="font-family: var(--font-header); font-weight:600; font-size:14px;">${parseFloat(item.day_price).toFixed(2)}</td>
                <td style="color: var(--text-muted); font-size:12px;">${item.unit}</td>
            `;
            tableBody.appendChild(row);
        });

        // Insights Box
        const insightsBox = document.getElementById('lime-insights');
        insightsBox.innerHTML = `
            <div class="insight-paragraph">
                ราคาขายส่งมะนาว (ขนาดใหญ่พิเศษ) ณ <strong>${latest.market_name} จ.${latest.province}</strong> ล่าสุด ณ วันที่ <strong>${latest.data_date}</strong> อยู่ที่ <strong>${parseFloat(latest.day_price).toFixed(2)} บาทต่อ 100 ผล</strong>
            </div>
            <div class="insight-paragraph">
                ราคาเฉลี่ยในช่วง 30 วันที่ผ่านมาอยู่ที่ <strong>${avg.toFixed(2)} บาท</strong> โดยทิศทางราคาเริ่มมีการผันผวนตามปริมาณผลผลิตมะนาวที่เข้าสู่ตลาดในแต่ละวัน
            </div>
        `;
    }

    // Dynamic insights updates based on data
    function updateInsights() {
        if (!dashboardData) return;

        // Overview insights
        const incomeList = dashboardData.farm_income_index || [];
        const overviewBox = document.getElementById('overview-insights');

        if (incomeList.length > 0) {
            const latest = incomeList[0];
            const prev = incomeList[1] || latest;
            const latestIncome = latest.farm_income_index;
            const momChange = ((latestIncome - prev.farm_income_index) / prev.farm_income_index * 100);

            const isUp = momChange >= 0;
            const trendText = isUp ? 'ปรับตัวเพิ่มขึ้น' : 'ปรับตัวลดลง';
            const colorClass = isUp ? 'text-green' : 'text-red';
            
            overviewBox.innerHTML = `
                <div class="insight-paragraph">
                    ในเดือน <strong>${formatThaiMonthYear(latest.year_th, latest.month)}</strong> ดัชนีรายได้เกษตรกร 
                    <strong class="${colorClass}">${trendText} ${Math.abs(momChange).toFixed(2)}%</strong> เมื่อเทียบกับเดือนก่อนหน้า 
                    โดยมีค่าดัชนีอยู่ที่ <strong>${latestIncome.toFixed(2)}</strong> (ปีฐาน 2563 = 100)
                </div>
                <div class="insight-paragraph">
                    การเปลี่ยนแปลงของดัชนีรายได้เป็นผลร่วมจาก:
                    <ul>
                        <li><strong>ดัชนีผลผลิตสินค้าเกษตร:</strong> อยู่ที่ <strong>${latest.production_index.toFixed(2)}</strong> (เทียบกับเดือนก่อนหน้า ${prev.production_index.toFixed(2)})</li>
                        <li><strong>ดัชนีราคาสินค้าเกษตร:</strong> อยู่ที่ <strong>${latest.price_index.toFixed(2)}</strong> (เทียบกับเดือนก่อนหน้า ${prev.price_index.toFixed(2)})</li>
                    </ul>
                </div>
                <div class="insight-paragraph" style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                    *สูตรคำนวณดัชนีรายได้เกษตรกร = (ดัชนีผลผลิต x ดัชนีราคา) / 100 เป็นค่าประมาณการเบื้องต้นเพื่อประเมินกำลังซื้อในภาคเกษตรกรรม
                </div>
            `;
        }

        // Pork insights
        const porkBox = document.getElementById('pork-insights');
        const porkWeekly = dashboardData.weekly_pork || [];
        if (porkWeekly.length > 0) {
            const latest = porkWeekly[0];
            const prev = porkWeekly[1] || latest;
            const price = parseFloat(latest.value);
            const wowPercent = ((price - parseFloat(prev.value)) / parseFloat(prev.value) * 100);
            
            const isUp = wowPercent >= 0;
            const trendText = isUp ? 'เพิ่มขึ้น' : 'ลดลง';
            const alertText = Math.abs(wowPercent) > 3 ? 'มีความเคลื่อนไหวอย่างมีนัยสำคัญ' : 'ค่อนข้างทรงตัว';

            porkBox.innerHTML = `
                <div class="insight-paragraph">
                    สถานการณ์ราคาสุกรมีชีวิต หน้าฟาร์ม (สัปดาห์ที่ ${latest.week} ของเดือน ${formatThaiMonthYear(latest.year_th, latest.month)}) 
                    พบว่าราคาเฉลี่ยระดับประเทศอยู่ที่ <strong>${price.toFixed(2)} บาท/กิโลกรัม</strong> 
                    ซึ่ง <strong>${trendText} ${Math.abs(wowPercent).toFixed(2)}%</strong> จากสัปดาห์ที่ผ่านมา
                </div>
                <div class="insight-paragraph">
                    แนวโน้มราคาสุกรในช่วงนี้มีสถานะ <strong>${alertText}</strong> โดยราคาหน้าฟาร์มเป็นตัวชี้วัดสำคัญของรายได้เกษตรกรผู้เลี้ยงสัตว์ (ปศุสัตว์) และจะสะท้อนไปยังราคาเนื้อหมูชำแหละในตลาดขายปลีกต่อไป
                </div>
            `;
        }
    }

    function updateCropInsights(cropType, data) {
        const insightsBox = document.getElementById('crop-insights');
        if (data.length === 0) return;

        const latest = data[data.length - 1];
        const prev = data[data.length - 2] || latest;
        const latestVal = parseFloat(latest.value);
        const prevVal = parseFloat(prev.value);
        const pctChange = ((latestVal - prevVal) / prevVal * 100).toFixed(2);
        const isUp = pctChange >= 0;

        insightsBox.innerHTML = `
            <div class="insight-paragraph">
                ราคาล่าสุดของ <strong>${latest.product_name}</strong> สัปดาห์ที่ ${latest.week} เดือน ${formatThaiMonthYear(latest.year_th, latest.month)} 
                อยู่ที่ <strong>${latestVal.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> ${latest.unit} 
                (เปลี่ยนแปลง <strong>${isUp ? '+' : ''}${pctChange}%</strong> จากสัปดาห์ก่อนหน้า)
            </div>
            <div class="insight-paragraph">
                ข้อมูลราคาสินค้าพืชผลที่เพิ่มขึ้นหรือลดลงสะท้อนปริมาณผลผลิตฤดูกาลและสภาวะตลาดโลก โดยเฉพาะ ยางพารา และ มันสำปะหลัง ที่เป็นสินค้าส่งออกสำคัญของไทย
            </div>
        `;
    }

    function setupOverviewToggle() {
        const chartModeInput = document.getElementById('overview-mode-chart');
        const tableModeInput = document.getElementById('overview-mode-table');
        const chartView = document.getElementById('overview-chart-view');
        const tableView = document.getElementById('overview-table-view');

        if (!chartModeInput || !tableModeInput || !chartView || !tableView) return;

        const toggleView = () => {
            if (chartModeInput.checked) {
                chartView.classList.remove('hidden');
                tableView.classList.add('hidden');
                if (charts.overviewChanges) {
                    setTimeout(() => charts.overviewChanges.resize(), 10);
                }
            } else {
                chartView.classList.add('hidden');
                tableView.classList.remove('hidden');
            }
        };

        chartModeInput.addEventListener('change', toggleView);
        tableModeInput.addEventListener('change', toggleView);
    }

    function renderOverviewChangesChart() {
        const ctx = document.getElementById('overviewChangesChart');
        const tableBody = document.querySelector('#overview-changes-table tbody');

        if (!ctx || !tableBody || !dashboardData) return;
        
        // Reverse array to show chronological order (left to right)
        const rawData = [...(dashboardData.farm_income_index || [])].reverse();
        
        // Calculate Year-on-Year (YoY) percentage changes (12-month lookback)
        for (let i = 0; i < rawData.length; i++) {
            if (i < 12) {
                rawData[i].production_yoy = 0;
                rawData[i].price_yoy = 0;
                rawData[i].income_yoy = 0;
            } else {
                const prevYear = rawData[i-12];
                const curr = rawData[i];
                curr.production_yoy = prevYear.production_index ? ((curr.production_index - prevYear.production_index) / prevYear.production_index * 100) : 0;
                curr.price_yoy = prevYear.price_index ? ((curr.price_index - prevYear.price_index) / prevYear.price_index * 100) : 0;
                curr.income_yoy = prevYear.farm_income_index ? ((curr.farm_income_index - prevYear.farm_income_index) / prevYear.farm_income_index * 100) : 0;
            }
        }
        
        // Slice last 24 months to show neatly in chart (all will have valid YoY values)
        const data = rawData.slice(-24);
        
        const labels = data.map(item => formatThaiMonthYear(item.year_th, item.month));
        const prodChanges = data.map(item => item.production_yoy);
        const priceChanges = data.map(item => item.price_yoy);
        const incomeChanges = data.map(item => item.income_yoy);
        
        if (charts.overviewChanges) charts.overviewChanges.destroy();
        
        charts.overviewChanges = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'เปลี่ยนแปลงดัชนีผลผลิต (YoY %)',
                        data: prodChanges,
                        backgroundColor: 'rgba(63, 76, 84, 0.7)',
                        borderColor: COLORS.darkGrey,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'เปลี่ยนแปลงดัชนีราคา (YoY %)',
                        data: priceChanges,
                        backgroundColor: 'rgba(195, 59, 50, 0.7)',
                        borderColor: COLORS.red,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'เปลี่ยนแปลงรายได้เกษตรกร (YoY %)',
                        data: incomeChanges,
                        type: 'line',
                        borderColor: COLORS.vino,
                        backgroundColor: 'transparent',
                        borderWidth: 4,
                        pointRadius: 4,
                        pointBackgroundColor: COLORS.vino,
                        tension: 0.2,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        }
                    },
                    tooltip: {
                        titleFont: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.tickSize },
                        bodyFont: { family: CHART_FONTS.family, size: CHART_FONTS.valueSize }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize },
                            maxTicksLimit: 12
                        },
                        title: {
                            display: true,
                            text: 'เดือน/ปี พ.ศ.',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: {
                            font: { family: CHART_FONTS.family, size: CHART_FONTS.tickSize }
                        },
                        title: {
                            display: true,
                            text: 'อัตราการเปลี่ยนแปลง YoY (%)',
                            font: { family: CHART_FONTS.titleFamily, size: CHART_FONTS.axisSize, weight: 'bold' }
                        }
                    }
                }
            }
        });
        
        // Populate Table (show latest first, only showing rows that have valid YoY data)
        tableBody.innerHTML = '';
        const tableData = [...rawData].reverse().filter(item => item.production_yoy !== 0 || item.price_yoy !== 0); // latest first
        
        tableData.forEach(item => {
            const row = document.createElement('tr');
            
            const prodSign = item.production_yoy >= 0 ? '+' : '';
            const priceSign = item.price_yoy >= 0 ? '+' : '';
            const incomeSign = item.income_yoy >= 0 ? '+' : '';
            
            const prodClass = item.production_yoy >= 0 ? 'text-green' : 'text-red';
            const priceClass = item.price_yoy >= 0 ? 'text-green' : 'text-red';
            const incomeClass = item.income_yoy >= 0 ? 'text-green' : 'text-red';
            
            row.innerHTML = `
                <td><strong>${formatThaiMonthYear(item.year_th, item.month)}</strong></td>
                <td class="text-right">${parseFloat(item.production_index).toFixed(2)}</td>
                <td class="text-right ${prodClass}">${prodSign}${parseFloat(item.production_yoy).toFixed(2)}%</td>
                <td class="text-right">${parseFloat(item.price_index).toFixed(2)}</td>
                <td class="text-right ${priceClass}">${priceSign}${parseFloat(item.price_yoy).toFixed(2)}%</td>
                <td class="text-right font-weight-bold" style="color: var(--color-vino); font-weight:600;">${parseFloat(item.farm_income_index).toFixed(2)}</td>
                <td class="text-right ${incomeClass}">${incomeSign}${parseFloat(item.income_yoy).toFixed(2)}%</td>
            `;
            tableBody.appendChild(row);
        });
    }
});
