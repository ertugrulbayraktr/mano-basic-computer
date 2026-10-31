import { useEffect } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BaseSwitch, LangSwitch } from './common/controls';
import { useLang } from './settings';
import { BuildingBlocksRoom } from './rooms/blocks/BuildingBlocksRoom';
import { AluCircuitPage } from './rooms/alu/AluCircuitPage';
import { AluLabRoom } from './rooms/alu/AluLabRoom';
import { BasicComputerRoom } from './rooms/computer/BasicComputerRoom';
import './app.css';


/** Opens each section at its top instead of keeping the previous scroll position. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const { lang, L } = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = 'Mano Basic Computer';
  }, [lang, L]);
  const MAIN = [
    { to: '/computer', name: L('Basic Computer', 'Temel Bilgisayar'), chapters: L('Ch. 5-6: the whole computer as a circuit', 'Bölüm 5-6: bilgisayarın tamamı, devre olarak') },
    { to: '/alu', name: 'ALU', chapters: L('Fig. 4-13: the arithmetic logic shift unit as a circuit', 'Şekil 4-13: aritmetik mantık kaydırma birimi, devre olarak') },
  ];
  const MORE = [
    { to: '/blocks', name: L('Building blocks', 'Yapı taşları'), chapters: L('Ch. 1-2, Sec. 4-1 to 4-3', 'Bölüm 1-2, Kısım 4-1 – 4-3') },
    { to: '/lab', name: L('ALU lab', 'ALU laboratuvarı'), chapters: L('Sec. 4-4 to 4-7, 8-7', 'Kısım 4-4 – 4-7, 8-7') },
  ];
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="shell">
        <header className="topbar">
          <a href="#/computer" className="brand">
            <span className="brand-name">Mano Basic Computer</span>
            <span className="brand-sub">
              {L('Interactive simulator for Computer System Architecture by M. Morris Mano', 'M. Morris Mano, Bilgisayar Sistem Mimarisi için etkileşimli simülatör')}
            </span>
          </a>
          <nav aria-label={L('Sections', 'Bölümler')} className="rooms">
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
          <div className="topbar-switches">
            <BaseSwitch allowSigned />
            <LangSwitch />
          </div>
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
          {lang === 'tr' ? (
            <>
              M. Morris Mano, <i>Computer System Architecture</i> (Bilgisayar Sistem Mimarisi), 3. baskıyı izler. MIT lisansıyla açık kaynak.
            </>
          ) : (
            <>
              Follows M. Morris Mano, <i>Computer System Architecture</i>, 3rd edition. Open source under the MIT license.
            </>
          )}
        </footer>
      </div>
    </HashRouter>
  );
}
