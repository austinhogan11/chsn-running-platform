import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, LazyMotion, domAnimation, motion } from 'framer-motion'
import PaceCalculatorPage from './pages/PaceCalculatorPage'
import TrainingLogPage from './pages/training-log/TrainingLogPage'

export function App() {
  const location = useLocation()

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
