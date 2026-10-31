import { useEffect } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BaseSwitch } from './common/controls';
import { BuildingBlocksRoom } from './rooms/blocks/BuildingBlocksRoom';
import { AluCircuitPage } from './rooms/alu/AluCircuitPage';
import { AluLabRoom } from './rooms/alu/AluLabRoom';
import { BasicComputerRoom } from './rooms/computer/BasicComputerRoom';
import './app.css';

const MAIN = [
  { to: '/computer', name: 'Basic Computer', chapters: 'Ch. 5-6: the whole computer as a circuit' },
  { to: '/alu', name: 'ALU', chapters: 'Fig. 4-13: the arithmetic logic shift unit as a circuit' },
];
const MORE = [
  { to: '/blocks', name: 'Building blocks', chapters: 'Ch. 1-2, Sec. 4-1 to 4-3' },
  { to: '/lab', name: 'ALU lab', chapters: 'Sec. 4-4 to 4-7, 8-7' },
];

/** Opens each section at its top instead of keeping the previous scroll position. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="shell">
        <header className="topbar">
          <a href="#/computer" className="brand">
            <span className="brand-name">Mano</span>
            <span className="brand-sub">the Basic Computer, clock by clock</span>
          </a>
          <nav aria-label="Sections" className="rooms">
            {MAIN.map((r) => (
              <NavLink key={r.to} to={r.to} className="room-link" title={r.chapters}>
                {r.name}
              </NavLink>
            ))}
            <span className="nav-sep" aria-hidden="true" />
            {MORE.map((r) => (
              <NavLink key={r.to} to={r.to} className="room-link secondary" title={r.chapters}>
                {r.name}
              </NavLink>
            ))}
          </nav>
          <BaseSwitch allowSigned />
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/computer" replace />} />
            <Route path="/blocks/*" element={<BuildingBlocksRoom />} />
            <Route path="/alu" element={<AluCircuitPage />} />
            <Route path="/lab/*" element={<AluLabRoom />} />
            <Route path="/computer" element={<BasicComputerRoom />} />
            <Route path="*" element={<Navigate to="/computer" replace />} />
          </Routes>
        </main>
        <footer className="footer">
          Follows M. Morris Mano, <i>Computer System Architecture</i>, 3rd edition. Open source under the MIT license.
        </footer>
      </div>
    </HashRouter>
  );
}
