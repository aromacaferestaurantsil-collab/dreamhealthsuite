import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/store';
import App from './App';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
      console.error('HealthBuddy offline shell registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <App />
  </Provider>
);
