import { useState, useCallback } from 'react';
import type { ClimbingState } from './physics/types';
import { use3DFallKinematics } from './hooks/use3DFallKinematics';
import ClimbingScene from './components/ClimbingScene';
import Dashboard from './components/Dashboard';

const DEFAULT_STATE: ClimbingState = {
  climberWeight: 70,
  belayerWeight: 70,
  ropeElongationPct: 35,
  firstDrawHeight: 3,
  lastDrawHeight: 12,
  climberPosition: 2,
  totalSlack: 0.5,
  wallAngle: 0,
  catchSoftness: 0.5,
};

export default function App() {
  const [state, setState] = useState<ClimbingState>(DEFAULT_STATE);
  const [simState, setSimState] = useState<ClimbingState>(DEFAULT_STATE);
  const [animPhase, setAnimPhase] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const output = use3DFallKinematics(simState);

  const runSimulation = useCallback(() => {
    setSimState({ ...state });
    setAnimPhase(0);
    setIsAnimating(true);

    const start = performance.now();
    const duration = 2000; // ms

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      setAnimPhase(t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setIsAnimating(false);
      }
    };
    requestAnimationFrame(tick);
  }, [state]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#1a1a2e] relative">
      <ClimbingScene state={simState} output={output} animPhase={animPhase} />
      <Dashboard
        state={state}
        output={output}
        onChange={setState}
        onSimulate={runSimulation}
        isAnimating={isAnimating}
      />
    </div>
  );
}
