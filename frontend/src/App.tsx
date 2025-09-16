import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, LazyMotion, domAnimation, motion } from 'framer-motion'
import PaceCalculatorPage from './pages/PaceCalculatorPage'
import TrainingLogPage from './pages/training-log/TrainingLogPage'

export function App() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const view = (params.get('view') || '').toLowerCase()

    if (view === 'training-log' && location.pathname !== '/training-log') {
      navigate({ pathname: '/training-log', search: location.search }, { replace: true })
    } else if (view === 'pace-calculator' && location.pathname !== '/pace-calculator') {
      navigate({ pathname: '/pace-calculator', search: location.search }, { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Navigate to="/training-log" replace />} />
          <Route
            path="/training-log"
            element={
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                transition={{ duration: 0.45, ease: 'easeInOut' }}
              >
                <TrainingLogPage />
              </motion.div>
            }
          />
          <Route
            path="/pace-calculator"
            element={
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                transition={{ duration: 0.45, ease: 'easeInOut' }}
              >
                <PaceCalculatorPage />
              </motion.div>
            }
          />
          <Route path="*" element={<Navigate to="/training-log" replace />} />
        </Routes>
      </AnimatePresence>
    </LazyMotion>
  )
}

export default App
