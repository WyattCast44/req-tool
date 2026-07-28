import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useProjectStore } from './store/projectStore'
import { WelcomePage } from './pages/WelcomePage'
import { DashboardPage } from './pages/DashboardPage'
import { RequirementsPage } from './pages/RequirementsPage'
import { RequirementDetailPage } from './pages/RequirementDetailPage'
import { MatrixPage } from './pages/MatrixPage'
import { GraphPage } from './pages/GraphPage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { SavedViewsPage } from './pages/SavedViewsPage'
import { ReportsPage } from './pages/ReportsPage'
import { PrintReportPage } from './pages/PrintReportPage'
import { LookupsPage } from './pages/LookupsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SourcesPage } from './pages/SourcesPage'
import { SourceDetailPage } from './pages/SourceDetailPage'
import { WatchItemsPage } from './pages/WatchItemsPage'
import { WatchItemDetailPage } from './pages/WatchItemDetailPage'

function RequireProject({ children }: { children: ReactNode }) {
  const project = useProjectStore((s) => s.project)
  const hydrated = useProjectStore((s) => s.hydrated)
  if (!hydrated) {
    return (
      <div className="muted-copy flex min-h-full items-center justify-center p-8">
        Loading local workspace…
      </div>
    )
  }
  if (!project) return <Navigate to="/welcome" replace />
  return children
}

export default function App() {
  const hydrate = useProjectStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    // URL parameters directly control inputs, so location updates must render synchronously.
    <HashRouter unstable_useTransitions={false}>
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route
          element={
            <RequireProject>
              <AppShell />
            </RequireProject>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/requirements" element={<RequirementsPage />} />
          <Route path="/requirements/:id" element={<RequirementDetailPage />} />
          <Route path="/watch-items" element={<WatchItemsPage />} />
          <Route path="/watch-items/:id" element={<WatchItemDetailPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/sources/:id" element={<SourceDetailPage />} />
          <Route path="/matrix" element={<MatrixPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/views" element={<SavedViewsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/lookups" element={<LookupsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route
          path="/print"
          element={
            <RequireProject>
              <PrintReportPage />
            </RequireProject>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
