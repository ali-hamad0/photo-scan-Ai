import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import "./styles/global.css";
import "./styles/variables.css";
const root = ReactDOM.createRoot(document.getElementById('root'));
// Apply saved theme on load
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);