import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { DeliveryProvider } from './context/DeliveryContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <DeliveryProvider>
        <App />
      </DeliveryProvider>
    </AuthProvider>
  </StrictMode>,
)
