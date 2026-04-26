// Device key configuration - change this for each device instance
const DEVICE_KEY = '4TAD6N';

// Get API URL - use relative path if served from same origin, otherwise use full URL
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5041/display' 
    : `${window.location.protocol}//${window.location.hostname}:5041/display`;
const REFRESH_INTERVAL = 30000; // Check for updates every 30 seconds
const RETRY_DELAY = 10000; // Retry after 10 seconds if no playlist found

let currentPlaylist = null;
let currentItemIndex = 0;
let items = [];
let imageTimer = null;
let refreshTimer = null;
let retryCountdown = RETRY_DELAY / 1000;

const loadingScreen = document.getElementById('loading-screen');
const errorScreen = document.getElementById('error-screen');
const displayContainer = document.getElementById('display-container');
const currentImage = document.getElementById('current-image');
const currentVideo = document.getElementById('current-video');
const retryCountdownElement = document.getElementById('retry-countdown');

// Enter fullscreen mode
function enterFullscreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}

// Fetch playlist from API
async function fetchPlaylist() {
    try {
        // Append device_key as query parameter
        const url = `${API_URL}?device_key=${encodeURIComponent(DEVICE_KEY)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                showErrorScreen();
                return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.playlist && data.playlist.items && data.playlist.items.length > 0) {
            return data.playlist;
        }
        
        showErrorScreen();
        return null;
    } catch (error) {
        console.error('Error fetching playlist:', error);
        showErrorScreen();
        return null;
    }
}

// Show error screen
function showErrorScreen() {
    loadingScreen.style.display = 'none';
    displayContainer.style.display = 'none';
    errorScreen.style.display = 'flex';
    
    // Start countdown
    retryCountdown = RETRY_DELAY / 1000;
    const countdownInterval = setInterval(() => {
        retryCountdown--;
        retryCountdownElement.textContent = retryCountdown;
        
        if (retryCountdown <= 0) {
            clearInterval(countdownInterval);
            loadPlaylist();
        }
    }, 1000);
}

// Show display container
function showDisplay() {
    loadingScreen.style.display = 'none';
    errorScreen.style.display = 'none';
    displayContainer.style.display = 'flex';
}

// Check if playlist has changed
function hasPlaylistChanged(newPlaylist) {
    if (!currentPlaylist) return true;
    
    // Check if playlist ID changed
    if (currentPlaylist.id !== newPlaylist.id) return true;
    
    // Check if items count changed
    if (currentPlaylist.items.length !== newPlaylist.items.length) return true;
    
    // Check if any item changed (compare by file_id and display_order)
    const currentItems = currentPlaylist.items.map(item => ({
        file_id: item.file_id,
        display_order: item.display_order,
        duration: item.duration
    }));
    
    const newItems = newPlaylist.items.map(item => ({
        file_id: item.file_id,
        display_order: item.display_order,
        duration: item.duration
    }));
    
    return JSON.stringify(currentItems) !== JSON.stringify(newItems);
}

// Load and start playlist
async function loadPlaylist() {
    const playlist = await fetchPlaylist();
    
    if (!playlist) {
        return;
    }
    
    // Check if playlist changed
    const playlistChanged = hasPlaylistChanged(playlist);
    
    if (playlistChanged) {
        console.log('Playlist changed, reloading...');
        currentPlaylist = playlist;
        items = [...playlist.items].sort((a, b) => a.display_order - b.display_order);
        currentItemIndex = 0;
        
        // Clear any existing timers
        if (imageTimer) {
            clearTimeout(imageTimer);
            imageTimer = null;
        }
        
        // Stop current video if playing
        if (currentVideo && !currentVideo.paused) {
            currentVideo.pause();
            currentVideo.src = '';
        }
        
        showDisplay();
        playNextItem();
    }
}

// Play next item in playlist
function playNextItem() {
    if (items.length === 0) {
        showErrorScreen();
        return;
    }
    
    // Get current item
    const item = items[currentItemIndex];
    
    // Hide both image and video
    currentImage.classList.remove('active');
    currentVideo.classList.remove('active');
    currentImage.style.display = 'none';
    currentVideo.style.display = 'none';
    
    if (item.file_type === 'image') {
        // Display image
        currentImage.src = item.file_url;
        currentImage.style.display = 'block';
        currentImage.classList.add('active');
        
        // Set timer for next item based on duration
        const duration = (item.duration || 5) * 1000; // Convert to milliseconds
        
        imageTimer = setTimeout(() => {
            moveToNextItem();
        }, duration);
        
    } else if (item.file_type === 'video') {
        // Display video
        currentVideo.src = item.file_url;
        currentVideo.style.display = 'block';
        currentVideo.classList.add('active');
        
        // Play video
        currentVideo.play().catch(error => {
            console.error('Error playing video:', error);
            moveToNextItem();
        });
        
        // When video ends, move to next item
        currentVideo.onended = () => {
            moveToNextItem();
        };
        
        // If video fails to load, move to next item
        currentVideo.onerror = () => {
            console.error('Error loading video:', item.file_url);
            moveToNextItem();
        };
    }
}

// Move to next item (loop back to start if at end)
function moveToNextItem() {
    currentItemIndex = (currentItemIndex + 1) % items.length;
    playNextItem();
}

// Periodically check for playlist updates
function startRefreshTimer() {
    refreshTimer = setInterval(async () => {
        const playlist = await fetchPlaylist();
        
        if (playlist && hasPlaylistChanged(playlist)) {
            console.log('Playlist updated, reloading...');
            loadPlaylist();
        }
    }, REFRESH_INTERVAL);
}

// Handle image load errors
currentImage.onerror = () => {
    console.error('Error loading image:', currentImage.src);
    moveToNextItem();
};

// Initialize
async function init() {
    // Enter fullscreen
    enterFullscreen();
    
    // Load initial playlist
    await loadPlaylist();
    
    // Start refresh timer
    startRefreshTimer();
    
    // Handle fullscreen changes
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            enterFullscreen();
        }
    });
    
    document.addEventListener('webkitfullscreenchange', () => {
        if (!document.webkitFullscreenElement) {
            enterFullscreen();
        }
    });
    
    document.addEventListener('mozfullscreenchange', () => {
        if (!document.mozFullScreenElement) {
            enterFullscreen();
        }
    });
    
    document.addEventListener('msfullscreenchange', () => {
        if (!document.msFullscreenElement) {
            enterFullscreen();
        }
    });
}

// Start the application
init();

