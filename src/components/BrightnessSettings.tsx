import React from 'react';
import { LocateFixed, SunMoon, Trash2, RotateCcw, Spline } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/store/settings';
import {
  DEFAULT_BRIGHTNESS_POINTS,
  MIN_LEVEL,
  formatMinute,
  getBrightnessSchedule,
  levelAt,
  makePointId,
  minuteOfDay,
  type BrightnessPoint,
} from '@/lib/brightness';
import { prefersReducedMotion } from '@/lib/amoledSaver';
import { useNow } from '@/hooks/useBrightness';
import { BrightnessCurve } from './BrightnessCurve';
import { Button, Range, Section, Segments } from './ui/controls';

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export function BrightnessSettings() {
  const { settings: s, updateSetting: update, updateMultiple } =
    useSettingsStore();
  const now = useNow(true);
  const [locating, setLocating] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const reducedMotion = prefersReducedMotion();
  const twelveHour = s.clockFormat === '12h';
  const time = (m: number) => formatMinute(m, twelveHour);

  const schedule = getBrightnessSchedule(s, now);
  const nowMinute = minuteOfDay(now);
  const nowLevel = schedule
    ? Math.round(levelAt(schedule.points, nowMinute, schedule.transition))
    : 100;
  const selected = s.brightnessPoints.find((p) => p.id === selectedId) ?? null;

  const setPoints = (points: BrightnessPoint[]) =>
    update('brightnessPoints', points);
  const updatePoint = (id: string, patch: Partial<BrightnessPoint>) =>
    setPoints(s.brightnessPoints.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  function locate() {
    if (!('geolocation' in navigator)) {
      toast.error('Location is unavailable in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Two decimals (about a kilometre) is far more than sunrise needs, and
        // keeps a precise position out of storage.
        updateMultiple({
          brightnessLatitude: Math.round(pos.coords.latitude * 100) / 100,
          brightnessLongitude: Math.round(pos.coords.longitude * 100) / 100,
        });
        setLocating(false);
        toast.success('Sunrise and sunset set for your location');
      },
      () => {
        setLocating(false);
        toast.error('Location was not shared. Using 07:00 and 19:00 instead.');
      },
      { maximumAge: 24 * 60 * 60 * 1000, timeout: 15000 }
    );
  }

  const transitionRange = (max: number) => (
    <Range
      label="Transition time"
      value={Math.min(s.brightnessTransition, max)}
      min={5}
      max={max}
      step={5}
      format={formatDuration}
      onChange={(v) => update('brightnessTransition', v)}
    />
  );

  return (
    <>
      <div className="inline-notice">
        <SunMoon size={18} />
        <div>
          <strong>Your phone sets the ceiling</strong>
          <p>
            Browsers can't change system brightness, so Cusemit dims itself.
            Set your phone to the brightest you'll want and leave the rest to
            the clock. On AMOLED screens, dimmer pixels also save power.
          </p>
        </div>
      </div>

      <Segments
        label="Brightness"
        value={s.brightnessMode}
        onChange={(v) => update('brightnessMode', v)}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'fixed', label: 'Fixed' },
          { value: 'sun', label: 'Sun' },
          { value: 'custom', label: 'Custom' },
        ]}
      />

      {s.brightnessMode !== 'off' && (
        <p className="brightness-now">
          <span>Right now</span>
          <strong>{nowLevel}%</strong>
        </p>
      )}

      {s.brightnessMode === 'fixed' && (
        <Range
          label="Clock brightness"
          value={s.brightnessFixedLevel}
          min={MIN_LEVEL}
          max={100}
          unit="%"
          onChange={(v) => update('brightnessFixedLevel', v)}
        />
      )}

      {s.brightnessMode === 'sun' && schedule?.sun && (
        <Section title="Follow the sun">
          <BrightnessCurve
            points={schedule.points}
            transition={schedule.transition}
            nowMinute={nowMinute}
            twelveHour={twelveHour}
            sunrise={schedule.sun.sunrise}
            sunset={schedule.sun.sunset}
            reducedMotion={reducedMotion}
          />
          <p className="setting-note">
            {schedule.sun.polar === 'day'
              ? 'The sun stays up all day here today.'
              : schedule.sun.polar === 'night'
                ? 'The sun stays down all day here today.'
                : `Sunrise ${time(schedule.sun.sunrise!)} · Sunset ${time(schedule.sun.sunset!)}`}
            {schedule.approximate &&
              '. These are placeholder times until you share your location.'}
          </p>
          <Button variant="outline" onClick={locate} disabled={locating}>
            <LocateFixed size={16} />
            {locating
              ? 'Finding you…'
              : schedule.approximate
                ? 'Use my location'
                : 'Update my location'}
          </Button>
          {transitionRange(360)}
          <Range
            label="Day brightness"
            value={s.brightnessDayLevel}
            min={MIN_LEVEL}
            max={100}
            unit="%"
            onChange={(v) => update('brightnessDayLevel', v)}
          />
          <Range
            label="Night brightness"
            value={s.brightnessNightLevel}
            min={MIN_LEVEL}
            max={100}
            unit="%"
            onChange={(v) => update('brightnessNightLevel', v)}
          />
          <p className="setting-note">
            Each change is centred on sunrise or sunset: the screen starts
            brightening before dawn and is fully bright soon after.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              updateMultiple({
                brightnessMode: 'custom',
                brightnessPoints: schedule.points.map((p) => ({
                  ...p,
                  id: makePointId(),
                })),
              });
              setSelectedId(null);
            }}
          >
            <Spline size={16} /> Fine-tune as a custom curve
          </Button>
        </Section>
      )}

      {s.brightnessMode === 'custom' && (
        <Section title="Your curve">
          <BrightnessCurve
            points={s.brightnessPoints}
            transition={s.brightnessTransition}
            onChange={setPoints}
            nowMinute={nowMinute}
            twelveHour={twelveHour}
            reducedMotion={reducedMotion}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
          <p className="setting-note">
            Tap the graph to add a point, drag one to move it. Each point is
            reached at its time, easing in over the transition before it.
          </p>
          {selected && (
            <div className="curve-point-editor">
              <div className="curve-point-editor-head">
                <strong>
                  {time(selected.minute)} · {selected.level}%
                </strong>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={s.brightnessPoints.length <= 1}
                  onClick={() => {
                    setPoints(s.brightnessPoints.filter((p) => p.id !== selected.id));
                    setSelectedId(null);
                  }}
                >
                  <Trash2 size={14} /> Remove point
                </Button>
              </div>
              <Range
                label="Point time"
                value={selected.minute}
                min={0}
                max={1435}
                step={5}
                format={time}
                onChange={(v) => updatePoint(selected.id, { minute: v })}
              />
              <Range
                label="Point brightness"
                value={selected.level}
                min={MIN_LEVEL}
                max={100}
                unit="%"
                onChange={(v) => updatePoint(selected.id, { level: v })}
              />
            </div>
          )}
          {transitionRange(720)}
          <Button
            variant="outline"
            onClick={() => {
              setPoints(DEFAULT_BRIGHTNESS_POINTS);
              setSelectedId(null);
            }}
          >
            <RotateCcw size={15} /> Reset to day and night
          </Button>
        </Section>
      )}
    </>
  );
}
