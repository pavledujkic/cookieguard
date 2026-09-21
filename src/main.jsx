import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
// wallet adapter modal styling
import '@solana/wallet-adapter-react-ui/styles.css';

// Node polyfills some wallet adapters expect
import { Buffer } from 'buffer';
if (!window.Buffer) window.Buffer = Buffer;
if (!window.global) window.global = window;
if (!window.process) window.process = { env: {} };

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
