import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import type { ClimbingState, KinematicOutput } from '../physics/types';

interface SceneProps {
  state: ClimbingState;
  output: KinematicOutput | null;
  animPhase: number; // 0..1
}

// ============================================================
// World-space helpers (wall rotations, positions)
// ============================================================
// Wall rotates around X-axis at its base (y=0).
//   wallAngle > 0 (slab): top tilts +Z (toward climber)
//   wallAngle = 0:       vertical in XY plane at z=0
//   wallAngle < 0 (overhang): top tilts -Z (away from climber, into space)
//
// Belayer and climber are both on the +Z side (climbing face).

function wallPoint(angleRad: number, h: number): [number, number, number] {
  // Point at height h on the wall surface, at lateral center (x=0)
  return [0, h * Math.cos(angleRad), h * Math.sin(angleRad)];
}

function climberOnWall(angleRad: number, h: number): [number, number, number] {
  const [wx, wy, wz] = wallPoint(angleRad, h);
  // Climber stands slightly proud of wall surface (+Z offset) and slightly to the right (+X)
  return [wx + 0.2, wy, wz + 0.35];
}

// ============================================================
// Internal 3D scene
// ============================================================

function FallScene({ state, output, animPhase }: SceneProps) {
  const wallRad = (state.wallAngle * Math.PI) / 180;
  const wallTop = Math.max(state.lastDrawHeight + state.climberPosition + 4, state.lastDrawHeight + 6);

  // ----- world-space anchor points -----
  const belayerPos: [number, number, number] = [0.8, 0, 2.5];          // in front of wall, right side
  const firstDrawPos = wallPoint(wallRad, state.firstDrawHeight);
  const lastDrawPos  = wallPoint(wallRad, state.lastDrawHeight);
  const climberStart = climberOnWall(wallRad, state.lastDrawHeight + state.climberPosition);

  // ----- trajectory (before / during / after fall) -----
  const trajectoryPts = useMemo(() => {
    if (!output) return [climberStart, climberStart, climberStart];

    const hDist = Math.abs(Math.sin(wallRad) * Math.max(Math.abs(state.climberPosition), 0.5)) + 0.5;
    const drop = output.trueVerticalDrop;

    // Start
    const p0 = climberStart;

    // Lowest point: drops vertically BELOW last draw
    const p1: [number, number, number] = [
      lastDrawPos[0] + hDist * (state.wallAngle <= 0 ? 1.2 : 0.2),
      lastDrawPos[1] - drop,
      lastDrawPos[2] + (state.wallAngle <= 0 ? -drop * 0.15 : drop * 0.1),
    ];

    // Resting point: plumb line from last draw (directly below in world Y)
    const p2: [number, number, number] = [
      lastDrawPos[0] + 0.1,
      lastDrawPos[1] - drop,
      lastDrawPos[2] + 0.1,
    ];

    return [p0, p1, p2];
  }, [output, climberStart, wallRad, state, lastDrawPos]);

  // ----- animated climber position (lerp along trajectory) -----
  const climberNow = useMemo(() => {
    if (!output || animPhase <= 0) return climberStart;
    const t = Math.min(1, animPhase);

    // Two-phase: fast drop 0..0.4, slow settle 0.4..1
    let seg: number;
    if (t <= 0.4) {
      seg = (t / 0.4) ** 2; // ease-in (gravity acceleration)
    } else if (t <= 0.75) {
      seg = 1 + ((t - 0.4) / 0.35) * 0.25; // slight overshoot
    } else {
      seg = 1.25 - ((t - 0.75) / 0.25) * 0.25; // settle to resting
    }
    seg = Math.max(0, Math.min(1.25, seg));

    if (seg <= 1) {
      const s = seg;
      return [
        trajectoryPts[0][0] + (trajectoryPts[1][0] - trajectoryPts[0][0]) * s,
        trajectoryPts[0][1] + (trajectoryPts[1][1] - trajectoryPts[0][1]) * s,
        trajectoryPts[0][2] + (trajectoryPts[1][2] - trajectoryPts[0][2]) * s,
      ] as [number, number, number];
    }
    const s = seg - 1;
    return [
      trajectoryPts[1][0] + (trajectoryPts[2][0] - trajectoryPts[1][0]) * s,
      trajectoryPts[1][1] + (trajectoryPts[2][1] - trajectoryPts[1][1]) * s,
      trajectoryPts[1][2] + (trajectoryPts[2][2] - trajectoryPts[1][2]) * s,
    ] as [number, number, number];
  }, [output, animPhase, climberStart, trajectoryPts]);

  // ----- rope path -----
  const ropePts = useMemo(() => {
    const pts: [number, number, number][] = [belayerPos];
    if (state.firstDrawHeight < state.lastDrawHeight - 1) pts.push(firstDrawPos);
    pts.push(lastDrawPos);
    pts.push(climberNow);
    return pts;
  }, [belayerPos, firstDrawPos, lastDrawPos, climberNow, state.firstDrawHeight, state.lastDrawHeight]);

  // ----- pendulum arc preview -----
  const arcPts = useMemo(() => {
    if (!output || output.pendulumSwingArc < 1.5) return null;
    const pts: [number, number, number][] = [];
    const halfRad = (output.pendulumSwingArc / 2) * (Math.PI / 180);
    const r = output.trueVerticalDrop * 0.35;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const a = -halfRad + (2 * halfRad * i) / steps;
      pts.push([lastDrawPos[0] + Math.sin(a) * r, lastDrawPos[1] - Math.cos(a) * r, lastDrawPos[2]]);
    }
    return pts;
  }, [output, lastDrawPos]);

  const climberLabelYOffset = 0.6;

  return (
    <group>
      {/* ============ GROUND ============ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.9} />
      </mesh>
      <gridHelper args={[30, 30, '#444', '#333']} position={[0, 0.01, 0]} />

      {/* ============ AMBIENT LIGHT ============ */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 20, 10]} intensity={0.9} castShadow />
      <directionalLight position={[-5, 10, 5]} intensity={0.3} />

      {/* ============ THE WALL ============ */}
      <group rotation={[wallRad, 0, 0]}>
        {/* Wall body */}
        <mesh position={[0, wallTop / 2, 0]} castShadow>
          <boxGeometry args={[5, wallTop, 0.35]} />
          <meshStandardMaterial color="#5a6a7a" roughness={0.65} metalness={0.15} />
        </mesh>

        {/* Wall texture — climbing surface facing +Z */}
        <mesh position={[0, wallTop / 2, 0.18]}>
          <planeGeometry args={[4.8, wallTop - 0.4]} />
          <meshStandardMaterial color="#6b7b8b" roughness={0.8} side={2} />
        </mesh>

        {/* ---- First draw (QD₁) ---- */}
        <mesh position={[0, state.firstDrawHeight, 0.22]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#3498db" emissive="#1a6daa" emissiveIntensity={0.5} />
        </mesh>

        {/* ---- Last draw (QDₙ) ---- */}
        <mesh position={[0, state.lastDrawHeight, 0.22]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color="#e94560" emissive="#8b1a3a" emissiveIntensity={0.7} />
        </mesh>
      </group>

      {/* ---- QD labels (world space) ---- */}
      <Html position={[0.8, state.firstDrawHeight, wallPoint(wallRad, state.firstDrawHeight)[2] + 0.5]} center style={{ pointerEvents: 'none' }}>
        <span style={{ color: '#3498db', fontSize: '11px', fontWeight: 700, textShadow: '0 0 4px #000' }}>QD1</span>
      </Html>
      <Html position={[0.8, state.lastDrawHeight, wallPoint(wallRad, state.lastDrawHeight)[2] + 0.5]} center style={{ pointerEvents: 'none' }}>
        <span style={{ color: '#e94560', fontSize: '11px', fontWeight: 700, textShadow: '0 0 4px #000' }}>QDn</span>
      </Html>

      {/* ============ BELAYER ============ */}
      <mesh position={belayerPos}>
        <capsuleGeometry args={[0.22, 0.7, 8, 16]} />
        <meshStandardMaterial color="#2ecc71" />
      </mesh>
      <Html position={[belayerPos[0], belayerPos[1] + 0.7, belayerPos[2]]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#2ecc71', fontSize: '13px', fontWeight: 700,
          background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4,
          textShadow: 'none',
        }}>
          保护者 {state.belayerWeight}kg
        </div>
      </Html>

      {/* Belayer lift ghost */}
      {output && output.belayerLiftVector.y > 0.03 && (
        <mesh position={[
          belayerPos[0] + output.belayerLiftVector.x,
          output.belayerLiftVector.y,
          belayerPos[2],
        ]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#f39c12" transparent opacity={0.45} />
        </mesh>
      )}

      {/* ============ ROPE ============ */}
      <Line points={ropePts} color="#e74c3c" lineWidth={2.5} />

      {/* ============ CLIMBER TRAJECTORY ============ */}
      {output && (
        <>
          {/* Fall path: start → lowest */}
          <Line
            points={[trajectoryPts[0], trajectoryPts[1]]}
            color="#ffffff"
            lineWidth={1}
            dashed
          />

          {/* Pendulum arc */}
          {arcPts && <Line points={arcPts} color="#f39c12" lineWidth={1.2} dashed />}

          {/* Marker: Start */}
          <mesh position={trajectoryPts[0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
          </mesh>

          {/* Marker: Lowest point */}
          <mesh position={trajectoryPts[1]}>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshStandardMaterial
              color={output.wallCollisionVelocity > 5 ? '#e74c3c' : '#f39c12'}
              emissive={output.wallCollisionVelocity > 5 ? '#e74c3c' : '#f39c12'}
              emissiveIntensity={0.7}
            />
          </mesh>

          {/* Marker: Resting point */}
          <mesh position={trajectoryPts[2]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#888888" />
          </mesh>
        </>
      )}

      {/* ============ ANIMATED CLIMBER ============ */}
      <mesh position={climberNow}>
        <capsuleGeometry args={[0.24, 0.55, 8, 16]} />
        <meshStandardMaterial color="#e67e22" />
      </mesh>
      <Html position={[climberNow[0], climberNow[1] + climberLabelYOffset, climberNow[2]]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#fff', fontSize: '14px', fontWeight: 700,
          background: 'rgba(230,126,34,0.85)', padding: '3px 10px', borderRadius: 6,
          whiteSpace: 'nowrap',
        }}>
          攀岩者 {state.climberWeight}kg
          {output ? `  ⚡${output.peakImpactForce.toFixed(1)}kN` : ''}
        </div>
      </Html>

      {/* ============ PROMINENT DATA HUD ============ */}
      {output && (
        <Html position={[lastDrawPos[0] - 1.5, lastDrawPos[1] - output.trueVerticalDrop * 0.45, lastDrawPos[2] + 1.5]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10,
            padding: '12px 16px',
            color: '#fff',
            fontSize: '13px',
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.6,
            minWidth: 180,
          }}>
            <div style={{ fontWeight: 700, fontSize: '18px', color: '#e94560', marginBottom: 4 }}>
              {output.peakImpactForce.toFixed(2)} <span style={{ fontSize: 12 }}>kN</span>
            </div>
            <div style={{ color: '#ccc', fontSize: 11 }}>冲击力峰值</div>
            <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>自由落体</span> <span style={{ color: '#f39c12', fontWeight: 600 }}>{output.freeFallDistance.toFixed(2)}m</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>绳索伸长</span> <span style={{ color: '#e74c3c', fontWeight: 600 }}>{output.ropeStretch.toFixed(2)}m</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span>总下坠</span> <span style={{ fontWeight: 700 }}>{output.trueVerticalDrop.toFixed(2)}m</span>
              </div>
            </div>
            <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>摆荡角度</span> <span>{output.pendulumSwingArc.toFixed(1)}°</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>撞墙速度</span>
                <span style={{ color: output.wallCollisionVelocity > 5 ? '#e74c3c' : output.wallCollisionVelocity > 2 ? '#f39c12' : '#2ecc71', fontWeight: 600 }}>
                  {output.wallCollisionVelocity.toFixed(2)} m/s
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>保护者拉起</span> <span>↑{output.belayerLiftVector.y.toFixed(2)}m</span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ============================================================
// Public component
// ============================================================

export default function ClimbingScene(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [10, props.state.lastDrawHeight * 0.55, 12], fov: 50, near: 0.1, far: 100 }}
      shadows
      style={{ background: '#1a1a2e' }}
    >
      <FallScene {...props} />
      <OrbitControls
        target={[0, props.state.lastDrawHeight * 0.5, 0]}
        enableDamping
        dampingFactor={0.1}
        minDistance={4}
        maxDistance={40}
        maxPolarAngle={Math.PI * 0.7}
      />
    </Canvas>
  );
}
