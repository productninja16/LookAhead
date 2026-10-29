import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './AppContext'
import Shell from './Shell'
import Bills from './pages/Bills'
import Chat from './pages/Chat'
import Decisions from './pages/Decisions'
import Home from './pages/Home'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import You from './pages/You'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<Shell />}>
            <Route path="/home" element={<Home />} />
            <Route path="/ask" element={<Chat />} />
            <Route path="/bills" element={<Bills />} />
            <Route path="/decisions" element={<Decisions />} />
            <Route path="/you" element={<You />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
