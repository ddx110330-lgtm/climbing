import { useMemo } from 'react';
import type { ClimbingState, KinematicOutput } from '../physics/types';

const G = 9.81;
const BASE_ROPE_MODULUS = 25000; // N at 35% dynamic elongation
const BODY_OFFSET = 0.5;        // m — minimum horizontal offset of climber from plumb line

function computeFrictionCoeff(wallAngle: number): number {
  if (wallAngle <= -15) return 0.1;
  if (wallAngle < 0) return 0.1 + ((wallAngle + 15) / 15) * 0.4;
  if (wallAngle === 0) return 0.5;
  return 0.5 + Math.min(wallAngle, 30) / 30 * 0.3;
}

export function use3DFallKinematics(state: ClimbingState): KinematicOutput {
  return useMemo(() => {
    const {
      climberWeight, belayerWeight, ropeElongationPct,
      lastDrawHeight, climberPosition, totalSlack, wallAngle, catchSoftness,
    } = state;

    // 1. Friction
    const effectiveFrictionCoeff = computeFrictionCoeff(wallAngle);

    // 2. Active rope length
    const activeRopeLength = lastDrawHeight + Math.max(climberPosition, 0) + totalSlack;

    // 3. Free fall distance
    let freeFallDistance: number;
    if (climberPosition > 0) {
      freeFallDistance = climberPosition * 2 + totalSlack;
    } else {
      freeFallDistance = totalSlack + Math.abs(climberPosition);
    }

    // 4. Rope modulus adjusted by user-specified elongation (softer rope = lower modulus)
    const ropeModulus = BASE_ROPE_MODULUS * (35 / Math.max(ropeElongationPct, 15));
    const ropeStiffness = ropeModulus / Math.max(activeRopeLength, 0.5);
    const mg = climberWeight * G;
    const rawImpactForce = mg + Math.sqrt(
      mg * mg + 2 * mg * ropeStiffness * freeFallDistance
    );
    const softCatchFactor = 1 - catchSoftness * 0.4;
    const peakImpactForceN = rawImpactForce * softCatchFactor;
    const peakImpactForce = peakImpactForceN / 1000; // kN

    // 5. Rope stretch derived from impact force (F = kx → x = F/k)
    const ropeStretch = peakImpactForceN / Math.max(ropeStiffness, 1);

    // 6. True vertical drop
    const trueVerticalDrop = freeFallDistance + ropeStretch;

    // 7. Horizontal pendulum offset
    const wallRad = (wallAngle * Math.PI) / 180;
    const wallOffset = Math.abs(Math.sin(wallRad)) * Math.max(Math.abs(climberPosition), 0.5);
    const horizontalDist = BODY_OFFSET + wallOffset;

    // 8. Pendulum swing arc
    const pendulumLength = Math.max(0.5, freeFallDistance + lastDrawHeight * 0.12);
    const maxSwingAngleRad = Math.atan2(horizontalDist, pendulumLength);
    const pendulumSwingArc = (2 * maxSwingAngleRad * 180) / Math.PI;

    // 9. Wall collision velocity (pendulum energy model)
    let wallCollisionVelocity: number;
    if (wallAngle < -30) {
      wallCollisionVelocity = 0;
    } else {
      const cosWall = Math.cos(wallRad);
      const cosMax = Math.cos(maxSwingAngleRad);
      const hEffective = pendulumLength * Math.max(0, cosWall - cosMax);
      wallCollisionVelocity = Math.sqrt(2 * G * hEffective);
      if (wallAngle > 0) {
        wallCollisionVelocity *= (1 - effectiveFrictionCoeff * 0.5);
      }
    }

    // 10. Belayer lift vector
    const belayerForceEst = peakImpactForceN * (1 - effectiveFrictionCoeff * 0.6);
    const belayerWeightN = belayerWeight * G;
    const netUpwardForce = Math.max(0, belayerForceEst - belayerWeightN);
    const belayerLiftY = (netUpwardForce / Math.max(belayerWeightN, 1)) * 0.5;
    const belayerLiftX = belayerLiftY * Math.sin(wallRad) * 0.35;

    return {
      freeFallDistance,
      peakImpactForce,
      pendulumSwingArc,
      wallCollisionVelocity,
      effectiveFrictionCoeff,
      belayerLiftVector: {
        y: Math.min(belayerLiftY, 3),
        x: Math.min(Math.abs(belayerLiftX), 1.5) * (wallAngle > 0 ? -1 : 1),
      },
      activeRopeLength,
      ropeStretch,
      trueVerticalDrop,
    };
  }, [
    state.climberWeight, state.belayerWeight, state.ropeElongationPct,
    state.lastDrawHeight, state.climberPosition, state.totalSlack,
    state.wallAngle, state.catchSoftness,
  ]);
}
