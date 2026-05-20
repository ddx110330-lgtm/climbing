import type { ClimbingState, KinematicOutput, Alert } from '../physics/types';
import { SCENARIO_PRESETS, generateAlerts } from '../physics/types';

interface Props {
  state: ClimbingState;
  output: KinematicOutput | null;
  onChange: (s: ClimbingState) => void;
  onSimulate: () => void;
  isAnimating: boolean;
}

function SliderField(props: {
  label: string; unit: string; value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{props.label}</span>
        <span className="text-slate-200 tabular-nums font-mono">
          {props.value.toFixed(props.step < 1 ? 1 : 0)}{props.unit}
        </span>
      </div>
      <input
        type="range" min={props.min} max={props.max} step={props.step}
        value={props.value}
        onChange={e => props.onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-rose-500 cursor-pointer"
      />
      {props.hint && <div className="text-[10px] text-slate-500 mt-0.5">{props.hint}</div>}
    </div>
  );
}

export default function Dashboard({ state, output, onChange, onSimulate, isAnimating }: Props) {
  const set = (k: keyof ClimbingState, v: number) => onChange({ ...state, [k]: v });
  const alerts: Alert[] = output ? generateAlerts(output, state) : [];

  return (
    <div className="absolute top-3 left-3 z-10 w-72 max-h-[calc(100vh-24px)] overflow-y-auto
                    bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl
                    p-4 text-sm shadow-2xl scrollbar-thin">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-white">⛰️ 冲坠模拟器</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-900/50 text-rose-300 border border-rose-800">
          v3.0
        </span>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 block mb-1.5">📋 预设场景</label>
        <select
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
          onChange={e => {
            const preset = SCENARIO_PRESETS.find(p => p.key === e.target.value);
            if (preset) onChange(preset.state);
          }}
          defaultValue=""
        >
          <option value="" disabled>选择场景...</option>
          {SCENARIO_PRESETS.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Parameters */}
      <div className="space-y-2">
        <fieldset className="border border-slate-700/50 rounded-lg p-3">
          <legend className="text-xs font-semibold text-slate-300 px-1">🧗 攀岩者</legend>
          <SliderField label="体重" unit="kg" value={state.climberWeight} min={40} max={150} step={1} onChange={v => set('climberWeight', v)} />
          <SliderField label="距最后快挂" unit="m" value={state.climberPosition} min={-5} max={10} step={0.1} onChange={v => set('climberPosition', v)}
            hint="正=快挂上方 / 负=快挂下方" />
          <SliderField label="总余绳" unit="m" value={state.totalSlack} min={0} max={5} step={0.1} onChange={v => set('totalSlack', v)} />
        </fieldset>

        <fieldset className="border border-slate-700/50 rounded-lg p-3">
          <legend className="text-xs font-semibold text-slate-300 px-1">🧍 保护者</legend>
          <SliderField label="体重" unit="kg" value={state.belayerWeight} min={40} max={150} step={1} onChange={v => set('belayerWeight', v)} />
          <SliderField label="缓冲技术" unit="" value={state.catchSoftness} min={0} max={1} step={0.05} onChange={v => set('catchSoftness', v)}
            hint="0=硬接 / 0.5=标准 / 1=最软" />
        </fieldset>

        <fieldset className="border border-slate-700/50 rounded-lg p-3">
          <legend className="text-xs font-semibold text-slate-300 px-1">🪢 绳索</legend>
          <SliderField label="动态伸长率" unit="%" value={state.ropeElongationPct} min={20} max={50} step={0.5} onChange={v => set('ropeElongationPct', v)} />
          <SliderField label="首把快挂高度" unit="m" value={state.firstDrawHeight} min={1} max={10} step={0.5} onChange={v => set('firstDrawHeight', v)} />
          <SliderField label="最后快挂高度" unit="m" value={state.lastDrawHeight} min={2} max={40} step={0.5} onChange={v => set('lastDrawHeight', v)} />
        </fieldset>

        <fieldset className="border border-slate-700/50 rounded-lg p-3">
          <legend className="text-xs font-semibold text-slate-300 px-1">🧱 岩壁</legend>
          <SliderField label="岩壁角度" unit="°" value={state.wallAngle} min={-60} max={30} step={1} onChange={v => set('wallAngle', v)}
            hint="正=Slab缓坡 / 0=垂直 / 负=Overhang仰角" />
        </fieldset>
      </div>

      {/* Simulate button */}
      <button
        onClick={onSimulate}
        disabled={isAnimating}
        className="w-full mt-4 py-2.5 rounded-lg font-bold text-sm
                   bg-rose-600 hover:bg-rose-500 disabled:bg-slate-600
                   text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {isAnimating ? '⏳ 模拟中...' : '🏃 开始模拟'}
      </button>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`text-xs p-2.5 rounded-lg border ${
              a.type === 'critical' ? 'bg-red-950/60 border-red-700 text-red-300' :
              a.type === 'warning' ? 'bg-amber-950/60 border-amber-700 text-amber-300' :
              'bg-blue-950/60 border-blue-700 text-blue-300'
            }`}>
              {a.type === 'critical' ? '🔴 ' : a.type === 'warning' ? '🟡 ' : '🔵 '}
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Output summary */}
      {output && (
        <div className="mt-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <h3 className="text-xs font-semibold text-slate-300 mb-2">📊 计算结果</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <span className="text-slate-500">自由落体</span>
            <span className="text-slate-200 text-right tabular-nums">{output.freeFallDistance.toFixed(2)} m</span>

            <span className="text-slate-500">冲击力峰值</span>
            <span className={`text-right tabular-nums font-bold ${output.peakImpactForce > 8 ? 'text-red-400' : output.peakImpactForce > 4 ? 'text-amber-400' : 'text-green-400'}`}>
              {output.peakImpactForce.toFixed(2)} kN
            </span>

            <span className="text-slate-500">摆荡角度</span>
            <span className="text-slate-200 text-right tabular-nums">{output.pendulumSwingArc.toFixed(1)}°</span>

            <span className="text-slate-500">撞墙速度</span>
            <span className={`text-right tabular-nums font-bold ${output.wallCollisionVelocity > 5 ? 'text-red-400' : output.wallCollisionVelocity > 2 ? 'text-amber-400' : 'text-green-400'}`}>
              {output.wallCollisionVelocity.toFixed(2)} m/s
            </span>

            <span className="text-slate-500">有效摩擦系数</span>
            <span className="text-slate-200 text-right tabular-nums">{output.effectiveFrictionCoeff.toFixed(3)}</span>

            <span className="text-slate-500">保护者位移</span>
            <span className="text-slate-200 text-right tabular-nums">
              ↑{output.belayerLiftVector.y.toFixed(2)}m →{Math.abs(output.belayerLiftVector.x).toFixed(2)}m
            </span>

            <span className="text-slate-500">绳索伸长</span>
            <span className="text-slate-200 text-right tabular-nums">{output.ropeStretch.toFixed(2)} m</span>

            <span className="text-slate-500">真实下坠距离</span>
            <span className="text-slate-200 text-right tabular-nums">{output.trueVerticalDrop.toFixed(2)} m</span>
          </div>
        </div>
      )}
    </div>
  );
}
