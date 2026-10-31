import { Navigate, Route, Routes } from 'react-router-dom';
import { RoomMenu } from '../../common/blocks';
import { useLang } from '../../settings';
import {
  AdderSubtractorBlock,
  AluBlock,
  ArithmeticBlock,
  IncrementerBlock,
  LogicBlock,
  LogicFunctionsBlock,
  ShifterBlock,
  ShiftsBlock,
  StatusBlock,
} from './sections';

const SECTIONS = [
  { id: 'adder-subtractor', name: 'Adder-subtractor', nameTr: 'Toplayıcı-çıkarıcı', ref: 'Fig. 4-7', el: <AdderSubtractorBlock /> },
  { id: 'incrementer', name: 'Incrementer', nameTr: 'Arttırıcı', ref: 'Fig. 4-8', el: <IncrementerBlock /> },
  { id: 'arithmetic', name: 'Arithmetic circuit', nameTr: 'Aritmetik devre', ref: 'Fig. 4-9', el: <ArithmeticBlock /> },
  { id: 'logic', name: 'Logic circuit', nameTr: 'Mantık devresi', ref: 'Fig. 4-10', el: <LogicBlock /> },
  { id: 'functions', name: '16 logic functions', nameTr: '16 mantık fonksiyonu', ref: 'Tab. 4-5', el: <LogicFunctionsBlock /> },
  { id: 'shifts', name: 'Shift microoperations', nameTr: 'Kaydırma mikroişlemleri', ref: 'Tab. 4-7', el: <ShiftsBlock /> },
  { id: 'shifter', name: 'Combinational shifter', nameTr: 'Kombinasyonel kaydırıcı', ref: 'Fig. 4-12', el: <ShifterBlock /> },
  { id: 'alu', name: 'ALU', nameTr: 'ALU', ref: 'Fig. 4-13', el: <AluBlock /> },
  { id: 'status', name: 'Status bits', nameTr: 'Durum bitleri', ref: 'Fig. 8-8', el: <StatusBlock /> },
];

export function AluLabRoom() {
  const { L } = useLang();
  return (
    <div className="room">
      <RoomMenu base="/lab" items={SECTIONS} label={L('ALU Lab sections', 'ALU laboratuvarı bölümleri')} />
      <div className="room-content">
        <Routes>
          <Route index element={<Navigate to="alu" replace />} />
          {SECTIONS.map((s) => (
            <Route key={s.id} path={s.id} element={s.el} />
          ))}
          <Route path="*" element={<Navigate to="alu" replace />} />
        </Routes>
      </div>
    </div>
  );
}
