import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ReviewPage from './components/ReviewPage.jsx'

// /?review opens the Review page (testers' saved recordings) instead of the app
const isReview = new URLSearchParams(window.location.search).has('review')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isReview ? <ReviewPage /> : <App />}
  </StrictMode>,
)
