import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { BaseSwitch } from './common/controls';
import { BuildingBlocksRoom } from './rooms/blocks/BuildingBlocksRoom';
import { AluLabRoom } from './rooms/alu/AluLabRoom';
import { BasicComputerRoom } from './rooms/computer/BasicComputerRoom';
import './app.css';

const ROOMS = [
  { to: '/blocks', no: '01', name: 'Building Blocks', chapters: 'Ch. 1-2, Sec. 4-1 to 4-3' },
  { to: '/alu', no: '02', name: 'ALU Lab', chapters: 'Sec. 4-4 to 4-7, 8-7' },
  { to: '/computer', no: '03', name: 'Basic Computer', chapters: 'Ch. 5, Ch. 6' },
];

export function App() {
  return (
    <HashRouter>
      <div className="shell">
        <header className="topbar">
          <a href="#/computer" className="brand">
            <span className="brand-name">MANO</span>
            <span className="cap">Basic Computer Simulator</span>
          </a>
          <nav aria-label="Rooms" className="rooms">
            {ROOMS.map((r) => (
              <NavLink key={r.to} to={r.to} className="room-link" title={r.chapters}>
                <span className="mono room-no">{r.no}</span> {r.name}
              </NavLink>
            ))}
          </nav>
          <BaseSwitch allowSigned />
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/computer" replace />} />
            <Route path="/blocks/*" element={<BuildingBlocksRoom />} />
            <Route path="/alu/*" element={<AluLabRoom />} />
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
