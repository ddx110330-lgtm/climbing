// ============================================================
// Biomechanical & Input State (3D Spatial Geometry)
// ============================================================

export interface ClimbingState {
  /** Climber body weight in kg */
  climberWeight: number;
  /** Belayer body weight in kg */
  belayerWeight: number;
  /** Dynamic rope elongation percentage (e.g. 35 = 35%) */
  ropeElongationPct: number;
  /** Height of the first quickdraw from ground (m) */
  firstDrawHeight: number;
  /** Height of the last clipped quickdraw from ground (m) */
  lastDrawHeight: number;
  /**
   * Climber position relative to the last draw (m).
   * Positive = above the draw (exposed lead).
   * Negative = below the draw (down-climbed or clipping stance).
   */
  climberPosition: number;
  /** Total slack in system: visible slack + geometric slack from zigzag (m) */
  totalSlack: number;
  /**
   * Wall inclination in degrees from vertical.
   * Positive  = slab 缓坡 (leans toward climber)
   * Zero      = vertical
   * Negative  = overhang 仰角 (leans away from climber)
   */
  wallAngle: number;
  /**
   * Belayer catch technique: 0 = hard/static catch, 1 = maximum soft/dynamic catch.
   * Soft catches reduce peak force by up to ~40% (per Hard is Easy testing).
   */
  catchSoftness: number;
}

// ============================================================
// Kinematic Output State (Derived / Computed)
// ============================================================

export interface KinematicOutput {
  /** Total free-fall distance before rope begins to catch (m) */
  freeFallDistance: number;
  /** Estimated maximum impact force on climber's harness (kN) */
  peakImpactForce: number;
  /**
   * Angle of the pendulum swing away from the wall (degrees).
   * Larger values indicate a wider swing into space.
   */
  pendulumSwingArc: number;
  /**
   * Speed at which the climber collides with the wall after
   * the pendulum swing returns (m/s).
   * 0 = climber hangs in space (steep overhang airfall).
   */
  wallCollisionVelocity: number;
  /** Effective rope-on-rock friction coefficient (0.0 – 1.0) */
  effectiveFrictionCoeff: number;
  /** Spatial displacement vector of the belayer during catch (m) */
  belayerLiftVector: { y: number; x: number };
  /** Total length of active rope in the system (m) */
  activeRopeLength: number;
  /** Rope stretch under peak load (m) */
  ropeStretch: number;
  /** True vertical drop distance including rope stretch (m) */
  trueVerticalDrop: number;
}

// ============================================================
// IFSC / Scenario Presets
// ============================================================

export interface ScenarioPreset {
  key: string;
  label: string;
  description: string;
  state: ClimbingState;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    key: 'ifsc_overhang',
    label: 'IFSC World Cup Overhang',
    description: 'Steep overhang lead final — massive but safe airfall',
    state: {
      climberWeight: 70, belayerWeight: 70,
      ropeElongationPct: 35, firstDrawHeight: 3,
      lastDrawHeight: 15, climberPosition: 2,
      totalSlack: 1, wallAngle: -45, catchSoftness: 0.8,
    },
  },
  {
    key: 'slab_danger',
    label: 'Dangerous Slab',
    description: 'Low-angle slab — high friction cheese-grater risk',
    state: {
      climberWeight: 70, belayerWeight: 70,
      ropeElongationPct: 32, firstDrawHeight: 2,
      lastDrawHeight: 5, climberPosition: 1,
      totalSlack: 0.3, wallAngle: 10, catchSoftness: 0.2,
    },
  },
  {
    key: 'vertical_sport',
    label: 'Vertical Sport Route',
    description: 'Classic vertical wall sport climbing scenario',
    state: {
      climberWeight: 70, belayerWeight: 70,
      ropeElongationPct: 35, firstDrawHeight: 3,
      lastDrawHeight: 12, climberPosition: 2.5,
      totalSlack: 0.6, wallAngle: 0, catchSoftness: 0.5,
    },
  },
  {
    key: 'gym_lead',
    label: 'Indoor Gym Lead',
    description: 'Typical indoor lead wall with moderate angle',
    state: {
      climberWeight: 65, belayerWeight: 75,
      ropeElongationPct: 38, firstDrawHeight: 2.5,
      lastDrawHeight: 10, climberPosition: 1.5,
      totalSlack: 0.2, wallAngle: -5, catchSoftness: 0.6,
    },
  },
  {
    key: 'trad_marginal',
    label: 'Trad: Marginal Gear',
    description: 'Trad climb with questionable protection placement',
    state: {
      climberWeight: 75, belayerWeight: 65,
      ropeElongationPct: 30, firstDrawHeight: 4,
      lastDrawHeight: 8, climberPosition: 3,
      totalSlack: 0.8, wallAngle: 5, catchSoftness: 0.9,
    },
  },
];

// ============================================================
// Alert thresholds
// ============================================================

export interface Alert {
  type: 'critical' | 'warning' | 'info';
  message: string;
}

export function generateAlerts(output: KinematicOutput, state: ClimbingState): Alert[] {
  const alerts: Alert[] = [];

  if (output.wallCollisionVelocity > 5) {
    alerts.push({
      type: 'critical',
      message: `CRITICAL: Hard Pendulum Wall Smash (猛烈撞墙) — ${output.wallCollisionVelocity.toFixed(1)} m/s`,
    });
  }

  if (state.wallAngle > 0 && output.freeFallDistance > 2) {
    alerts.push({
      type: 'warning',
      message: `WARNING: Cheese Grater Effect (严重擦伤风险) — ${output.freeFallDistance.toFixed(1)}m slide on slab`,
    });
  }

  if (output.effectiveFrictionCoeff < 0.2) {
    alerts.push({
      type: 'info',
      message: 'INFO: Low Friction Airfall — Expect Max Belayer Lift (空气冲坠，保护员将被猛烈拉起)',
    });
  }

  if (output.peakImpactForce > 8) {
    alerts.push({
      type: 'warning',
      message: `WARNING: Peak force ${output.peakImpactForce.toFixed(1)} kN — risk of gear failure or injury`,
    });
  }

  if (output.peakImpactForce > 12) {
    alerts.push({
      type: 'critical',
      message: `CRITICAL: Extreme impact ${output.peakImpactForce.toFixed(1)} kN — gear likely to fail!`,
    });
  }

  return alerts;
}
