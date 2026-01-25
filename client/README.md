# Digital Signage Display Client

A fullscreen slideshow client that displays images and videos from the digital signage API.

## Features

- **Fullscreen Display**: Automatically enters fullscreen mode
- **Auto-refresh**: Checks for playlist updates every 30 seconds
- **Image Slideshow**: Displays images for their configured duration
- **Video Playback**: Automatically plays videos
- **Smooth Transitions**: Fade transitions between items
- **Error Handling**: Shows error screen when no playlist is available
- **Auto-retry**: Automatically retries if no playlist is found

## Setup

1. **Configure Device Key**: Before deploying, edit `app.js` and set the `DEVICE_KEY` constant to match the device key stored in the database for this device instance.

2. Open `index.html` in a web browser

3. The client will automatically:
   - Enter fullscreen mode
   - Fetch the active playlist from `http://localhost:5041/display?device_key=YOUR_DEVICE_KEY`
   - Display images and videos in sequence
   - Check for updates every 30 seconds

## Configuration

Edit `app.js` to change:

- `DEVICE_KEY`: The device key for this client instance (default: `TQCX9M`)
  - **Important**: Each device instance must have a unique device key that matches the `device_key` stored in the database
  - The device key is used to identify which device group this client belongs to
  - When deploying to a new device, update this value to match the device key in the database
- `API_URL`: The API endpoint URL (default: `http://localhost:5041/display`)
- `REFRESH_INTERVAL`: How often to check for updates in milliseconds (default: 30000 = 30 seconds)
- `RETRY_DELAY`: How long to wait before retrying if no playlist found (default: 10000 = 10 seconds)

## Usage

Simply open `index.html` in a web browser. The application will:
1. Enter fullscreen automatically
2. Load the active playlist
3. Display items in order
4. Loop continuously
5. Auto-refresh when playlist changes

## Browser Compatibility

Works in all modern browsers that support:
- Fullscreen API
- Fetch API
- ES6 JavaScript

## Troubleshooting

- If the playlist doesn't load, check that the backend server is running
- Ensure CORS is enabled on the backend for the client's origin
- **Device Key Issues**: 
  - Verify that the `DEVICE_KEY` in `app.js` matches the device key in the database
  - If no playlist is assigned to your device's group, a placeholder image will be displayed
  - Check the browser console for any error messages related to device key validation
- Check browser console for any error messages

