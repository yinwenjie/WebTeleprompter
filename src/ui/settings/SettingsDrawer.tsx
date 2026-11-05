import { useRef, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  COLOR_PRESETS,
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  contrastRatio,
  type ColorPreset,
  type FontFamilyKey,
  type GuideStyle,
} from '@/core/models/settings';
import { SPEED_LEVEL_MAX, SPEED_LEVEL_MIN, SPEED_LEVEL_STEP } from '@/core/speed-model';
import { t, type MessageKey } from '@/i18n';
import { useDispatch, useDisplay, usePlayback, useSettings } from '@/state/hooks';
import styles from '@/ui/shared/Panel.module.css';
import { useDialog } from '@/ui/shared/useDialog';

const MIN_CONTRAST = 4.5;
const FONTS: FontFamilyKey[] = ['sans', 'serif', 'mono'];
const GUIDES: GuideStyle[] = ['line', 'band', 'mask'];
const PRESETS = Object.keys(COLOR_PRESETS) as Array<Exclude<ColorPreset, 'custom'>>;
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent' });

interface SliderProps {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}

function Slider({ label, value, display, min, max, step, onChange }: SliderProps) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.value}>{display}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Choice<T extends string>(props: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  label(option: T): string;
  onChange(value: T): void;
}) {
  return (
    <fieldset className={styles.section}>
      <legend>{props.legend}</legend>
      <div className={styles.row}>
        {props.options.map((option) => (
          <label
            key={option}
            className={styles.button}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <input
              type="radio"
              name={props.name}
              checked={props.value === option}
              onChange={() => props.onChange(option)}
            />
            {props.label(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <label className={styles.field} style={{ gridTemplateColumns: '1fr auto' }}>
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** 设置抽屉。动态加载，提词时打开也不暂停播放。规格见 docs/dev/modules/ui-settings.md */
export default function SettingsDrawer() {
  const settings = useSettings((s) => s.settings);
  const actions = useSettings(
    useShallow((s) => ({
      setAppearance: s.setAppearance,
      applyColorPreset: s.applyColorPreset,
      setDisplay: s.setDisplay,
      setGuide: s.setGuide,
      setPlayback: s.setPlayback,
      resetToDefaults: s.resetToDefaults,
    })),
  );
  const speedLevel = usePlayback((s) => s.speedLevel);
  const dispatch = useDispatch();
  const setActivePanel = useDisplay((s) => s.setActivePanel);
  const wakeLock = useDisplay((s) => s.wakeLock);
  const close = () => setActivePanel('none');
  const ref = useRef<HTMLElement>(null);
  const onKeyDown = useDialog(ref, close);

  const { appearance, display, playback } = settings;
  const L = SETTINGS_LIMITS;
  const ratio = contrastRatio(appearance.fgColor, appearance.bgColor);

  return (
    <>
      <div className={styles.backdrop} onClick={close} />
      <aside
        ref={ref}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <h2>{t('settings.title')}</h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('settings.close')}
            onClick={close}
          >
            ×
          </button>
        </div>
        <div className={styles.body}>
          {wakeLock === 'unsupported' || wakeLock === 'denied' ? (
            <p className={styles.warning} role="note">
              {t('settings.wakeLock')}
            </p>
          ) : null}

          <Section title={t('settings.playback')}>
            {/* D-08：语速的运行时真值在控制器，滑杆发命令而不是写 store。 */}
            <Slider
              label={t('settings.speed')}
              value={speedLevel}
              display={String(speedLevel)}
              min={SPEED_LEVEL_MIN}
              max={SPEED_LEVEL_MAX}
              step={SPEED_LEVEL_STEP}
              onChange={(level) => dispatch({ type: 'speed.set', level })}
            />
            <Slider
              label={t('settings.countdown')}
              value={playback.countdownSec}
              display={t('settings.seconds', { value: playback.countdownSec })}
              min={L.countdownSec.min}
              max={L.countdownSec.max}
              step={1}
              onChange={(countdownSec) => actions.setPlayback({ countdownSec })}
            />
          </Section>

          <Section title={t('settings.appearance')}>
            <Slider
              label={t('settings.fontSize')}
              value={appearance.fontSizePx}
              display={`${appearance.fontSizePx}px`}
              min={L.fontSizePx.min}
              max={L.fontSizePx.max}
              step={1}
              onChange={(fontSizePx) => actions.setAppearance({ fontSizePx })}
            />
            <Slider
              label={t('settings.lineHeight')}
              value={appearance.lineHeight}
              display={appearance.lineHeight.toFixed(1)}
              min={L.lineHeight.min}
              max={L.lineHeight.max}
              step={0.1}
              onChange={(lineHeight) => actions.setAppearance({ lineHeight })}
            />
            <Slider
              label={t('settings.padding')}
              value={appearance.paddingXPercent}
              display={`${appearance.paddingXPercent}%`}
              min={L.paddingXPercent.min}
              max={L.paddingXPercent.max}
              step={1}
              onChange={(paddingXPercent) => actions.setAppearance({ paddingXPercent })}
            />
            <Choice
              legend={t('settings.fontFamily')}
              name="wtp-font"
              options={FONTS}
              value={appearance.fontFamily}
              label={(f) => t(`settings.font.${f}` as MessageKey)}
              onChange={(fontFamily) => actions.setAppearance({ fontFamily })}
            />
            <fieldset className={styles.section}>
              <legend>{t('settings.preset')}</legend>
              <div className={styles.row}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={styles.button}
                    aria-pressed={appearance.preset === preset}
                    style={{
                      background: COLOR_PRESETS[preset].bgColor,
                      color: COLOR_PRESETS[preset].fgColor,
                      outline:
                        appearance.preset === preset ? '2px solid var(--chrome-accent)' : undefined,
                    }}
                    onClick={() => actions.applyColorPreset(preset)}
                  >
                    {t(`settings.preset.${preset}` as MessageKey)}
                  </button>
                ))}
              </div>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span>{t('settings.fg')}</span>
                  <input
                    type="color"
                    value={appearance.fgColor}
                    onChange={(e) => actions.setAppearance({ fgColor: e.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span>{t('settings.bg')}</span>
                  <input
                    type="color"
                    value={appearance.bgColor}
                    onChange={(e) => actions.setAppearance({ bgColor: e.target.value })}
                  />
                </label>
              </div>
              {ratio < MIN_CONTRAST ? (
                <p className={styles.warning} role="status">
                  {t('settings.lowContrast', { ratio: ratio.toFixed(1) })}
                </p>
              ) : null}
            </fieldset>
          </Section>

          <Section title={t('settings.display')}>
            <Toggle
              label={t('settings.mirrorX')}
              checked={display.mirrorX}
              onChange={(mirrorX) => actions.setDisplay({ mirrorX })}
            />
            <Toggle
              label={t('settings.mirrorY')}
              checked={display.mirrorY}
              onChange={(mirrorY) => actions.setDisplay({ mirrorY })}
            />
            <Choice
              legend={t('settings.guideStyle')}
              name="wtp-guide"
              options={GUIDES}
              value={display.guide.style}
              label={(g) => t(`settings.guide.${g}` as MessageKey)}
              onChange={(style) => actions.setGuide({ style })}
            />
            <Slider
              label={t('settings.guidePosition')}
              value={display.guide.positionPercent}
              display={`${display.guide.positionPercent}%`}
              min={L.guidePositionPercent.min}
              max={L.guidePositionPercent.max}
              step={1}
              onChange={(positionPercent) => actions.setGuide({ positionPercent })}
            />
            <Slider
              label={t('settings.guideOpacity')}
              value={display.guide.opacity}
              display={percent.format(display.guide.opacity)}
              min={L.guideOpacity.min}
              max={L.guideOpacity.max}
              step={0.05}
              onChange={(opacity) => actions.setGuide({ opacity })}
            />
            <Toggle
              label={t('settings.progressInClean')}
              checked={display.showProgressInClean}
              onChange={(showProgressInClean) => actions.setDisplay({ showProgressInClean })}
            />
          </Section>

          <button
            type="button"
            className={styles.button}
            onClick={() => {
              actions.resetToDefaults();
              dispatch({ type: 'speed.set', level: DEFAULT_SETTINGS.playback.speedLevel });
            }}
          >
            {t('settings.reset')}
          </button>
        </div>
      </aside>
    </>
  );
}
