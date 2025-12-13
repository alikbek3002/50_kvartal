import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Reuse existing styles from main site
import '../../src/index.css'
import '../../src/App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
