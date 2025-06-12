import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css'; 
import App from './App';
import { GameProvider } from './context/Game';
// import { AuthProvider } from './context/Auth';

const root = ReactDOM.createRoot(document.getElementById('root'));
// TODO: Actually make Auth
//<AuthProvider> wraps GameProvider
    

root.render(
  <React.StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </React.StrictMode>
);