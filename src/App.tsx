import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Convos from './pages/Convos';
import Components from './pages/Components';
import Dashboards from './pages/Dashboards';

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">ConvoIQ</h1>
        </div>
        <nav className="space-y-1 px-3">
          <Link
            to="/"
            className={`block rounded-lg px-4 py-2 transition ${
              isActive('/') ? 'bg-gray-800' : 'hover:bg-gray-800'
            }`}
          >
            Conversations
          </Link>
          <Link
            to="/components"
            className={`block rounded-lg px-4 py-2 transition ${
              isActive('/components') ? 'bg-gray-800' : 'hover:bg-gray-800'
            }`}
          >
            Components
          </Link>
          <Link
            to="/dashboards"
            className={`block rounded-lg px-4 py-2 transition ${
              isActive('/dashboards') ? 'bg-gray-800' : 'hover:bg-gray-800'
            }`}
          >
            Dashboards
          </Link>
        </nav>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Convos />} />
          <Route path="/components" element={<Components />} />
          <Route path="/dashboards" element={<Dashboards />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
