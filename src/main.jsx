import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/store';
import App from './App';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(error => {
      console.error('HealthBuddy offline shell registration failed:', error);
    });
  });
}

if (typeof window !== 'undefined') {\n  try {\n    const redirect = sessionStorage.getItem('healthbuddy-redirect');\n    if (redirect) { sessionStorage.removeItem('healthbuddy-redirect'); window.history.replaceState(null, '', import.meta.env.BASE_URL + redirect); }\n  } catch { /* private browsing may disable session storage */ }\n}\n\ncreateRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <App />
  </Provider>
);
