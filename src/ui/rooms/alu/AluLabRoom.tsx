import { Navigate, Route, Routes } from 'react-router-dom';
import { RoomMenu } from '../../common/blocks';
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
  { id: 'adder-subtractor', name: 'Adder-subtractor', ref: 'Fig. 4-7', el: <AdderSubtractorBlock /> },
  { id: 'incrementer', name: 'Incrementer', ref: 'Fig. 4-8', el: <IncrementerBlock /> },
  { id: 'arithmetic', name: 'Arithmetic circuit', ref: 'Fig. 4-9', el: <ArithmeticBlock /> },
  { id: 'logic', name: 'Logic circuit', ref: 'Fig. 4-10', el: <LogicBlock /> },
  { id: 'functions', name: '16 logic functions', ref: 'Tab. 4-5', el: <LogicFunctionsBlock /> },
  { id: 'shifts', name: 'Shift microoperations', ref: 'Tab. 4-7', el: <ShiftsBlock /> },
  { id: 'shifter', name: 'Combinational shifter', ref: 'Fig. 4-12', el: <ShifterBlock /> },
  { id: 'alu', name: 'ALU', ref: 'Fig. 4-13', el: <AluBlock /> },
  { id: 'status', name: 'Status bits', ref: 'Fig. 8-8', el: <StatusBlock /> },
];

export function AluLabRoom() {
  return (
    <div className="room">
      <RoomMenu base="/lab" items={SECTIONS} label="ALU Lab sections" />
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
