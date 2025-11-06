import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Convos from './pages/Convos';
import Components from './pages/Components';
import ComponentId from './pages/ComponentId';
import Dashboards from './pages/Dashboards';
import DashboardId from './pages/DashboardId';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Convos />} />
          <Route path="/components" element={<Components />} />
          <Route path="/components/:id" element={<ComponentId />} />
          <Route path="/dashboards" element={<Dashboards />} />
          <Route path="/dashboards/:id" element={<DashboardId />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
