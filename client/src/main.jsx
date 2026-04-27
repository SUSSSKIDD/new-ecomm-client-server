import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

// Initialize Capacitor features
if (Capacitor.isNativePlatform()) {
  // Item 12: Status Bar Config
  StatusBar.setOverlaysWebView({ overlay: false });
  
  if (import.meta.env.VITE_APP_TYPE === 'DELIVERY') {
    StatusBar.setStyle({ style: Style.Light }); // Dark content
    StatusBar.setBackgroundColor({ color: '#ffffff' });
  } else {
    StatusBar.setStyle({ style: Style.Dark }); // Light content
    StatusBar.setBackgroundColor({ color: '#10b981' }); // Brand emerald
  }
  
  // Item 8: Keyboard Config
  Keyboard.setAccessoryBarVisible({ isVisible: false });
  Keyboard.setResizeMode({ mode: KeyboardResize.Body });

  // Item 7: Hide Splash Screen after app loads
  window.addEventListener('load', () => {
    SplashScreen.hide();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
