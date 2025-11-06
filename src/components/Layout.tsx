import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TbMessageCircle, TbBox, TbLayout, TbChevronLeft, TbChevronRight } from 'react-icons/tb';
import Logo from './Logo';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen">
      <aside className={`bg-gray-900 text-white transition-all duration-300 flex flex-col relative group ${isCollapsed ? 'w-16' : 'w-64'}`}>
        <div className={`p-6 ${isCollapsed ? 'px-3 flex justify-center' : 'flex items-center gap-3'}`}>
          <Logo size={isCollapsed ? 32 : 36} className="flex-shrink-0" />
          {!isCollapsed && <h1 className="text-2xl font-bold">ConvoIQ</h1>}
        </div>
        <nav className="space-y-1 px-3 flex-1">
          <Link
            to="/"
            title={isCollapsed ? 'Convos' : ''}
            className={`flex items-center gap-3 rounded-lg px-4 py-2 transition ${
              isActive('/') ? 'bg-gray-800' : 'hover:bg-gray-800'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <TbMessageCircle size={20} className="flex-shrink-0" />
            {!isCollapsed && <span>Convos</span>}
          </Link>
          <Link
            to="/components"
            title={isCollapsed ? 'Components' : ''}
            className={`flex items-center gap-3 rounded-lg px-4 py-2 transition ${
              isActive('/components') ? 'bg-gray-800' : 'hover:bg-gray-800'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <TbBox size={20} className="flex-shrink-0" />
            {!isCollapsed && <span>Components</span>}
          </Link>
          <Link
            to="/dashboards"
            title={isCollapsed ? 'Dashboards' : ''}
            className={`flex items-center gap-3 rounded-lg px-4 py-2 transition ${
              isActive('/dashboards') ? 'bg-gray-800' : 'hover:bg-gray-800'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <TbLayout size={20} className="flex-shrink-0" />
            {!isCollapsed && <span>Dashboards</span>}
          </Link>
        </nav>
        
        {/* Clickable edge strip */}
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-0 right-0 w-1 h-full cursor-pointer hover:w-2 transition-all"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        />
        
        {/* Edge toggle button - visual indicator */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-1/2 -right-3 transform -translate-y-1/2 bg-gray-800 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-gray-700 pointer-events-none"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <TbChevronRight size={16} /> : <TbChevronLeft size={16} />}
        </button>
      </aside>
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  );
}

