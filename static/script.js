// static/js/script.js

// ===== GLOBAL VARIABLES =====
let map;
let markers = [];
let routeLayer = null;
let notificationTimeout = null;
let updateInterval = null;
let lastUpdateTime = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    startAutoRefresh();
    loadInitialData();
});

// ===== MAP FUNCTIONS =====
function initializeMap() {
    // Default center (โรงยิม 1)
    const defaultCenter = [16.199183, 103.273303];
    
    map = L.map('map').setView(defaultCenter, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function addMarkers(bins) {
    clearMarkers();
    
    bins.forEach((bin, index) => {
        const color = getColorByPercent(bin.percent);
        
        // Create custom marker
        const marker = L.marker([bin.lat, bin.lng], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background: ${color};
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    border: 3px solid white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    font-size: 14px;
                ">${bin.id}</div>`,
                iconSize: [36, 36]
            })
        }).addTo(map);
        
        // Create popup content
        const popupContent = `
            <div style="padding: 5px;">
                <strong style="font-size: 16px; color: #2c3e50;">🚮 ถังขยะ ${bin.id}</strong><br>
                <span style="color: #7f8c8d;">📍 ${bin.name}</span><br>
                <hr style="margin: 8px 0;">
                <div style="display: flex; align-items: center; gap: 10px; margin: 5px 0;">
                    <span style="font-size: 14px;">ระดับขยะ:</span>
                    <span style="
                        background: ${color};
                        color: white;
                        padding: 3px 10px;
                        border-radius: 15px;
                        font-weight: bold;
                    ">${bin.percent}%</span>
                </div>
                <span style="color: #95a5a6; font-size: 11px; display: block; margin-top: 5px;">
                    🗺️ ${bin.lat.toFixed(6)}, ${bin.lng.toFixed(6)}
                </span>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Add click event
        marker.on('click', function() {
            showNotification('📌 ถังขยะ ' + bin.id, 
                `${bin.name} - ระดับขยะ ${bin.percent}%`, 'info');
        });
        
        markers.push(marker);
    });
}

function drawRoute(waypoints) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    if (!waypoints || waypoints.length < 2) return;
    
    const latlngs = waypoints.map(w => [w.lat, w.lng]);
    
    routeLayer = L.polyline(latlngs, {
        color: '#3498db',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10',
        lineJoin: 'round'
    }).addTo(map);
    
    // Add arrow markers for direction
    for (let i = 0; i < latlngs.length - 1; i++) {
        const from = latlngs[i];
        const to = latlngs[i + 1];
        const midPoint = [
            (from[0] + to[0]) / 2,
            (from[1] + to[1]) / 2
        ];
        
        const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
        
        L.marker(midPoint, {
            icon: L.divIcon({
                className: 'direction-arrow',
                html: `<div style="
                    transform: rotate(${angle}deg);
                    font-size: 24px;
                    color: #3498db;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                ">➤</div>`,
                iconSize: [24, 24]
            })
        }).addTo(map);
    }
    
    // Fit map to route
    map.fitBounds(latlngs, { padding: [50, 50] });
}

// ===== COLOR HELPER =====
function getColorByPercent(percent) {
    if (percent >= 80) return '#ff3838';
    if (percent >= 50) return '#f39c12';
    return '#27ae60';
}

function getStatusText(percent) {
    if (percent >= 80) return 'เต็มแล้ว';
    if (percent >= 50) return 'เกือบเต็ม';
    return 'ว่าง';
}

// ===== API FUNCTIONS =====
async function fetchBins() {
    try {
        const response = await fetch('/api/bins');
        const data = await response.json();
        
        if (data.status === 'success') {
            updateStats(data.bins);
            addMarkers(data.bins);
            renderBinsGrid(data.bins);
            
            const lastUpdate = data.last_update ? 
                new Date(data.last_update).toLocaleString('th-TH') : 'ไม่มีข้อมูล';
            document.getElementById('lastUpdate').innerHTML = 
                `<i class="far fa-clock"></i> อัพเดทล่าสุด: ${lastUpdate}`;
            
            lastUpdateTime = new Date();
            
            return data.bins;
        }
    } catch (error) {
        console.error('Error fetching bins:', error);
        showNotification('❌ ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', 'error');
    }
}

async function calculateRoute() {
    showLoading();
    try {
        const response = await fetch('/api/route');
        const data = await response.json();
        
        if (data.status === 'success') {
            if (data.full_bins_count === 0) {
                showNotification('ℹ️ ข้อมูล', 'ยังไม่มีถังขยะที่เต็ม (≥80%)', 'info');
                document.getElementById('routeInfo').style.display = 'none';
            } else {
                displayRouteInfo(data);
                drawRoute(data.waypoints);
                showNotification('✅ สำเร็จ', 
                    `พบเส้นทางที่เหมาะสมที่สุด ระยะทาง ${data.total_distance} กม.`, 'success');
            }
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        showNotification('❌ ข้อผิดพลาด', 'ไม่สามารถคำนวณเส้นทางได้', 'error');
    }
    hideLoading();
}

async function sendESP32Data(id, percent, lat, lng, location) {
    const url = `/api/esp32/update?id=${id}&percent=${percent}&lat=${lat}&lng=${lng}&location=${encodeURIComponent(location)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'success') {
            console.log('✅ ESP32 data sent:', data);
            await fetchBins();
            return true;
        }
    } catch (error) {
        console.error('Error sending ESP32 data:', error);
        showNotification('❌ ข้อผิดพลาด', 'ไม่สามารถส่งข้อมูล ESP32', 'error');
    }
    return false;
}

async function clearAllData() {
    if (!confirm('⚠️ คุณต้องการล้างข้อมูลทั้งหมดใช่หรือไม่?')) {
        return;
    }
    
    showLoading();
    try {
        const response = await fetch('/api/clear', { method: 'POST' });
        const data = await response.json();
        
        if (data.status === 'success') {
            clearMarkers();
            document.getElementById('binsGrid').innerHTML = '';
            document.getElementById('routeInfo').style.display = 'none';
            updateStats([]);
            document.getElementById('lastUpdate').innerHTML = 'ล้างข้อมูลแล้ว';
            showNotification('✅ สำเร็จ', 'ล้างข้อมูลทั้งหมดเรียบร้อย', 'success');
        }
    } catch (error) {
        console.error('Error clearing data:', error);
        showNotification('❌ ข้อผิดพลาด', 'ไม่สามารถล้างข้อมูลได้', 'error');
    }
    hideLoading();
}

// ===== UI UPDATE FUNCTIONS =====
function updateStats(bins) {
    const totalBins = bins.length;
    const fullBins = bins.filter(b => b.percent >= 80).length;
    const warningBins = bins.filter(b => b.percent >= 50 && b.percent < 80).length;
    
    animateNumber('totalBins', totalBins);
    animateNumber('fullBins', fullBins);
    animateNumber('warningBins', warningBins);
}

function animateNumber(elementId, newValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue === newValue) return;
    
    let start = currentValue;
    const increment = newValue > start ? 1 : -1;
    const duration = 500; // ms
    const steps = Math.abs(newValue - start);
    const stepTime = duration / steps;
    
    const timer = setInterval(() => {
        start += increment;
        element.textContent = start;
        
        if (start === newValue) {
            clearInterval(timer);
        }
    }, stepTime);
}

function renderBinsGrid(bins) {
    const grid = document.getElementById('binsGrid');
    grid.innerHTML = '';
    
    // Sort by percent (highest first)
    const sortedBins = [...bins].sort((a, b) => b.percent - a.percent);
    
    sortedBins.forEach(bin => {
        const statusClass = bin.percent >= 80 ? 'full' : 
                           bin.percent >= 50 ? 'warning' : 'good';
        const percentClass = bin.percent >= 80 ? 'full' : 
                            bin.percent >= 50 ? 'warning' : 'good';
        const statusText = getStatusText(bin.percent);
        const color = getColorByPercent(bin.percent);
        
        const card = document.createElement('div');
        card.className = `bin-card ${statusClass}`;
        card.innerHTML = `
            <div class="bin-header">
                <span class="bin-title">
                    <i class="fas fa-trash-alt"></i>
                    ${bin.name}
                </span>
                <span class="bin-percent ${percentClass}">${bin.percent}%</span>
            </div>
            
            <div class="bin-location">
                <i class="fas fa-map-marker-alt"></i>
                <span>${bin.location || 'ไม่ระบุสถานที่'}</span>
            </div>
            
            <div class="bin-coords">
                <i class="fas fa-globe-asia"></i>
                ${bin.lat.toFixed(6)}, ${bin.lng.toFixed(6)}
            </div>
            
            <div class="bin-progress-container">
                <div class="bin-progress-labels">
                    <span>${statusText}</span>
                    <span>${bin.percent}%</span>
                </div>
                <div class="bin-progress">
                    <div class="bin-progress-bar ${percentClass}" style="width: ${bin.percent}%"></div>
                </div>
                <div class="bin-progress-markers">
                    <span>0%</span>
                    <span>50%</span>
                    <span>80%</span>
                    <span>100%</span>
                </div>
            </div>
            
            <div class="bin-footer">
                <div class="bin-time">
                    <i class="far fa-clock"></i>
                    <span>${formatTimestamp(bin.timestamp)}</span>
                </div>
                <div class="bin-actions">
                    <button class="bin-btn bin-btn-info" onclick="showBinDetails(${bin.id})">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="bin-btn bin-btn-route" onclick="focusOnBin(${bin.id})">
                        <i class="fas fa-crosshairs"></i>
                    </button>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function displayRouteInfo(routeData) {
    document.getElementById('routeInfo').style.display = 'block';
    document.getElementById('totalDistance').textContent = routeData.total_distance;
    document.getElementById('estimatedTime').textContent = routeData.estimated_time;
    
    const routeList = document.getElementById('routeList');
    routeList.innerHTML = '';
    
    routeData.waypoints.forEach((waypoint, index) => {
        if (index < routeData.waypoints.length - 1) {
            const percentClass = waypoint.percent >= 80 ? 'percent-high' :
                                waypoint.percent >= 50 ? 'percent-medium' : 'percent-low';
            
            const distance = index > 0 ? 
                calculateDistance(routeData.waypoints[index-1], waypoint) : 0;
            
            const item = document.createElement('div');
            item.className = 'route-item';
            item.innerHTML = `
                <div class="route-number">${index + 1}</div>
                <div class="route-details">
                    <div class="route-name">
                        <i class="fas fa-map-pin" style="color: ${getColorByPercent(waypoint.percent)}"></i>
                        ${waypoint.name}
                    </div>
                    <div class="route-coords">
                        ${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}
                        ${distance > 0 ? ` • ระยะทาง ${distance.toFixed(1)} กม.` : ''}
                    </div>
                </div>
                <div class="route-percent ${percentClass}">${waypoint.percent}%</div>
            `;
            
            routeList.appendChild(item);
        }
    });
}

// ===== HELPER FUNCTIONS =====
function calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'ไม่มีข้อมูล';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'เมื่อสักครู่';
    if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} ชั่วโมงที่แล้ว`;
    
    return date.toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showBinDetails(binId) {
    const bin = markers.find(m => {
        const popup = m.getPopup();
        return popup && popup.getContent().includes(`ถังขยะ ${binId}`);
    });
    
    if (bin) {
        bin.openPopup();
        map.panTo(bin.getLatLng());
    }
}

function focusOnBin(binId) {
    const bin = markers.find(m => {
        const popup = m.getPopup();
        return popup && popup.getContent().includes(`ถังขยะ ${binId}`);
    });
    
    if (bin) {
        map.setView(bin.getLatLng(), 18);
        bin.openPopup();
    }
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(title, message, type = 'info') {
    let notification = document.getElementById('notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon"></div>
                <div class="notification-text">
                    <h4></h4>
                    <p></p>
                </div>
            </div>
            <button class="close-notification" onclick="closeNotification()">&times;</button>
        `;
        document.body.appendChild(notification);
    }
    
    notification.className = `notification ${type}`;
    notification.querySelector('.notification-icon').innerHTML = getNotificationIcon(type);
    notification.querySelector('h4').textContent = title;
    notification.querySelector('p').textContent = message;
    notification.style.display = 'block';
    
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    notificationTimeout = setTimeout(() => {
        closeNotification();
    }, 5000);
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        default: return 'ℹ️';
    }
}

function closeNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.style.display = 'none';
    }
}

// ===== LOADING INDICATOR =====
function showLoading() {
    let loading = document.getElementById('loading');
    
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading';
        loading.className = 'loading';
        loading.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(loading);
    }
    
    loading.classList.add('active');
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.remove('active');
    }
}

// ===== SIMULATION FUNCTIONS =====
async function simulateData() {
    showLoading();
    
    const testBins = [
        { id: 1, percent: 85, lat: 16.199183, lng: 103.273303, name: 'โรงยิม 1', location: 'โรงยิม 1' },
        { id: 2, percent: 92, lat: 16.198365, lng: 103.273233, name: 'สนาม 3', location: 'สนาม 3' },
        { id: 3, percent: 45, lat: 16.199800, lng: 103.274200, name: 'โรงอาหาร', location: 'โรงอาหาร' },
        { id: 4, percent: 78, lat: 16.200100, lng: 103.274600, name: 'สนามกีฬา', location: 'สนามกีฬา' }
    ];
    
    for (const bin of testBins) {
        await sendESP32Data(bin.id, bin.percent, bin.lat, bin.lng, bin.location);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    showNotification('🧪 โหมดทดสอบ', 'เปิดใช้งานข้อมูลจำลองเรียบร้อย', 'success');
    hideLoading();
}

// ===== EVENT LISTENERS =====
function initializeEventListeners() {
    // Refresh button
    const refreshBtn = document.querySelector('button[onclick="refreshData()"]');
    if (refreshBtn) {
        refreshBtn.onclick = refreshData;
    }
    
    // Auto-refresh toggle
    const autoRefreshCheckbox = document.getElementById('autoRefresh');
    if (autoRefreshCheckbox) {
        autoRefreshCheckbox.addEventListener('change', function(e) {
            if (e.target.checked) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });
    }
    
    // Window resize
    window.addEventListener('resize', debounce(function() {
        if (map) {
            map.invalidateSize();
        }
    }, 250));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== AUTO REFRESH =====
function startAutoRefresh() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    updateInterval = setInterval(refreshData, 10000);
}

function stopAutoRefresh() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// ===== DATA LOADING =====
async function loadInitialData() {
    showLoading();
    await fetchBins();
    
    // Auto-calculate route after initial load
    setTimeout(async () => {
        await calculateRoute();
    }, 2000);
    
    hideLoading();
}

async function refreshData() {
    showLoading();
    await fetchBins();
    hideLoading();
}

// ===== EXPORT FUNCTIONS TO GLOBAL SCOPE =====
window.calculateRoute = calculateRoute;
window.refreshData = refreshData;
window.simulateData = simulateData;
window.clearAllData = clearAllData;
window.showBinDetails = showBinDetails;
window.focusOnBin = focusOnBin;
window.closeNotification = closeNotification;
window.sendESP32Data = sendESP32Data;
    
    

function initializeEventListeners() {
    // Refresh button
    const refreshBtn = document.querySelector('button[onclick="refreshData()"]');
    if (refreshBtn) {
        refreshBtn.onclick = refreshData;
    }
    
    // Auto-refresh toggle
    const autoRefreshCheckbox = document.getElementById('autoRefresh');
    if (autoRefreshCheckbox) {
        autoRefreshCheckbox.addEventListener('change', function(e) {
            if (e.target.checked) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });
    }
    
    // Window resize
    window.addEventListener('resize', debounce(function() {
        if (map) {
            map.invalidateSize();
        }
    }, 250));
    
    // Add smooth scroll to top
    const footer = document.querySelector('.footer');
    if (footer) {
        footer.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl + R to refresh
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshData();
        }
        
        // Ctrl + C to calculate route
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            calculateRoute();
        }
        
        // Escape to close notification
        if (e.key === 'Escape') {
            closeNotification();
        }
    });
}