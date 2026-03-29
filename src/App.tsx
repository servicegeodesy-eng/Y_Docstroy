import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";
import { isGeoMode } from "./lib/geoMode";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import ForcePasswordChangeModal from "./components/ForcePasswordChangeModal";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const WorkspaceLayout = lazy(() => import("./components/layout/WorkspaceLayout"));
const TasksPage = lazy(() => import("./pages/workspace/TasksPage"));
const RegistryPage = lazy(() => import("./pages/workspace/RegistryPage"));
const ChessboardReport = lazy(() => import("./pages/workspace/ChessboardReport"));
const ExplorerPage = lazy(() => import("./pages/workspace/ExplorerPage"));
const PlanPage = lazy(() => import("./pages/workspace/PlanPage"));
const GroPage = lazy(() => import("./pages/workspace/GroPage"));
const AdminPage = lazy(() => import("./pages/workspace/AdminPage"));
const InstructionPage = lazy(() => import("./pages/workspace/InstructionPage"));
const RequestsPage = lazy(() => import("./pages/workspace/RequestsPage"));
const FileSharePage = lazy(() => import("./pages/workspace/FileSharePage"));
const StructurePage = lazy(() => import("./pages/workspace/StructurePage"));
const ConstructionMapPage = lazy(() => import("./pages/workspace/ConstructionMapPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));


function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="ds-spinner mx-auto mb-3" />
        <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Загрузка...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, mustChangePassword, clearMustChangePassword } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (mustChangePassword) {
    return <ForcePasswordChangeModal onPasswordChanged={clearMustChangePassword} />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (user) {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
}

function GeoFallback() {
  const { projectId } = useParams();
  return <Navigate to={`/projects/${projectId}/requests`} replace />;
}

export default function App() {
  const geo = isGeoMode();

  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/auth"
          element={
            <GuestRoute>
              <AuthPage />
            </GuestRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <WorkspaceLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={geo ? "requests" : "registry"} replace />} />
          {!geo && <Route path="tasks" element={<TasksPage />} />}
          {!geo && <Route path="registry" element={<RegistryPage />} />}
          {!geo && <Route path="construction" element={<ConstructionMapPage />} />}
          {!geo && <Route path="plan" element={<PlanPage mode="plan" />} />}
          {!geo && <Route path="chessboard" element={<ChessboardReport />} />}
          {!geo && <Route path="facades" element={<PlanPage mode="facades" />} />}
          {!geo && <Route path="landscaping" element={<PlanPage mode="landscaping" />} />}
          {!geo && <Route path="roof" element={<PlanPage mode="roof" />} />}
          {!geo && <Route path="floors" element={<PlanPage mode="floors" />} />}
          {!geo && <Route path="walls" element={<PlanPage mode="walls" />} />}
          {!geo && <Route path="frame" element={<PlanPage mode="frame" />} />}
          {!geo && <Route path="territory" element={<PlanPage mode="territory" />} />}
          {!geo && <Route path="earthwork" element={<PlanPage mode="earthwork" />} />}
          {!geo && <Route path="foundation" element={<PlanPage mode="foundation" />} />}
          {!geo && <Route path="shoring" element={<PlanPage mode="shoring" />} />}
          {!geo && <Route path="piles" element={<PlanPage mode="piles" />} />}
          <Route path="requests" element={<RequestsPage />} />
          {!geo && <Route path="fileshare" element={<FileSharePage />} />}
          {!geo && <Route path="gro" element={<GroPage />} />}
          {!geo && <Route path="explorer" element={<ExplorerPage />} />}
          {!geo && <Route path="admin" element={<AdminPage />} />}
          {!geo && <Route path="instruction" element={<InstructionPage />} />}
          {!geo && <Route path="structure" element={<StructurePage />} />}
          {geo && <Route path="*" element={<GeoFallback />} />}
        </Route>
        <Route path="/install" element={<InstallPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
