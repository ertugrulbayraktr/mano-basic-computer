import { Navigate, Route, Routes } from 'react-router-dom';
import { RoomMenu } from '../../common/blocks';
import { BusBlock, MemoryBlock, TransferBlock } from './bus';
import { DecoderBlock, EncoderBlock, MuxBlock } from './combinational';
import { FullAdderBlock, GatesBlock, HalfAdderBlock, RippleAdderBlock } from './gates';
import { CounterBlock, RegisterBlock, ShiftRegisterBlock } from './sequential';

const SECTIONS = [
  { id: 'gates', name: 'Logic gates', ref: 'Fig. 1-2', el: <GatesBlock /> },
  { id: 'half-adder', name: 'Half adder', ref: 'Sec. 1-7', el: <HalfAdderBlock /> },
  { id: 'full-adder', name: 'Full adder', ref: 'Sec. 1-7', el: <FullAdderBlock /> },
  { id: 'ripple-adder', name: 'Ripple-carry adder', ref: 'Fig. 2-6', el: <RippleAdderBlock /> },
  { id: 'decoder', name: 'Decoder', ref: 'Fig. 2-1', el: <DecoderBlock /> },
  { id: 'encoder', name: 'Encoder', ref: 'Sec. 2-2', el: <EncoderBlock /> },
  { id: 'mux', name: 'Multiplexer', ref: 'Fig. 2-2', el: <MuxBlock /> },
  { id: 'register', name: 'Register', ref: 'Fig. 2-7', el: <RegisterBlock /> },
  { id: 'shift-register', name: 'Shift register', ref: 'Fig. 2-8', el: <ShiftRegisterBlock /> },
  { id: 'counter', name: 'Binary counter', ref: 'Fig. 2-10', el: <CounterBlock /> },
  { id: 'memory', name: 'Memory unit', ref: 'Fig. 2-12', el: <MemoryBlock /> },
  { id: 'bus', name: 'Common bus', ref: 'Fig. 4-3', el: <BusBlock /> },
  { id: 'transfer', name: 'Register transfer', ref: 'Fig. 4-2', el: <TransferBlock /> },
];

export function BuildingBlocksRoom() {
  return (
    <div className="room">
      <RoomMenu base="/blocks" items={SECTIONS} label="Building block sections" />
      <div className="room-content">
        <Routes>
          <Route index element={<Navigate to="gates" replace />} />
          {SECTIONS.map((s) => (
            <Route key={s.id} path={s.id} element={s.el} />
          ))}
          <Route path="*" element={<Navigate to="gates" replace />} />
        </Routes>
      </div>
    </div>
  );
}
