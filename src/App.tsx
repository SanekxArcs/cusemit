import React from 'react';
import { toast, Toaster } from 'sonner';
import { Clock } from '@/components/Clock';

import {
  SettingsSheet,
  SettingsRail,
  type SettingsSection,
} from '@/components/SettingsSheet';
import { TimerSheet } from '@/components/TimerSheet';
import { VoiceTimerButton } from '@/components/VoiceTimerPanel';

import { AmoledMesh } from '@/components/AmoledMesh';
import { useSettingsStore } from '@/store/settings';
import {
  DriftOffset,
  generateRandomDrift,
  prefersReducedMotion,
} from '@/lib/amoledSaver';
import { loadGoogleFont, CURATED_FONTS } from '@/lib/fonts';
import { usePWA } from '@/hooks/usePWA';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useDailyReload } from '@/hooks/useDailyReload';
import { useClockTime } from '@/hooks/useClockTime';
import { useBrightness } from '@/hooks/useBrightness';

import { InfoDialog } from '@/components/InfoDialog';
import { useTimerArray, formatMs } from '@/hooks/useTimerArray';
import { FloatingTimerWidget } from '@/components/TimerWidget';
import { FloatingClock } from '@/components/FloatingClock';
import { TimerAlarm, type TimerAlert } from '@/components/TimerAlarm';
import { loadCustomSound, primeAlarmAudio } from '@/lib/alarm';

// Background tabs tick about once a minute; leave room for that.
const ALARM_RECENT_MS = 2 * 60 * 1000;

export function App() {
  const { settings, loadSettings, flushPersist, updateMultiple, updateTimer, removeTimer } =
    useSettingsStore();
  const [settingsSection, setSettingsSection] =
    React.useState<SettingsSection | null>(null);
  const isSettingsOpen = settingsSection !== null;
  const [isTimerOpen, setIsTimerOpen] = React.useState(false);
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const [voiceTimerToStart, setVoiceTimerToStart] =
    React.useState<string | null>(null);

  const time = useClockTime(settings.clockFormat, settings.showSeconds);
  const [showControls, setShowControls] = React.useState(true);
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [driftOffset, setDriftOffset] = React.useState<DriftOffset>({
    x: 0,
    y: 0,
  });
  const reducedMotion = prefersReducedMotion();
  const brightness = useBrightness(settings);
  usePWA();
  useWakeLock();

  // ── Timers ───────────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = React.useState<TimerAlert[]>([]);
  const dismissAlerts = React.useCallback(() => setAlerts([]), []);
  const timerControls = useTimerArray(settings.timers, async (id) => {
    const cfg = settings.timers.find((t) => t.id === id);
    if (!cfg) return;
    // A date target reports as expired again on every load (including the 4am
    // reload), so only ring for one that passed just now, not hours ago.
    const justFinished =
      cfg.inputMode !== 'datetime' ||
      Date.now() - new Date(cfg.targetDatetime).getTime() < ALARM_RECENT_MS;
    if (justFinished && (cfg.alarmSound !== 'none' || cfg.flashOnExpire)) {
      // Snapshot everything the alarm needs (including the custom sound, which
      // removeTimer deletes) so it keeps going after an auto-delete.
      const customBlob =
        cfg.alarmSound === 'custom' ? await loadCustomSound(id) : null;
      setAlerts((prev) => [
        ...prev.filter((a) => a.id !== id),
        {
          id,
          label: cfg.label,
          sound: cfg.alarmSound,
          customBlob,
          flash: cfg.flashOnExpire,
        },
      ]);
    }
    if (cfg.autoDelete) {
      // Small delay so the "expired" state is visible for a moment before deletion
      setTimeout(() => removeTimer(id), 800);
    }
  });

  React.useEffect(() => {
    if (!voiceTimerToStart) return;
    const control = timerControls[voiceTimerToStart];
    if (!control || control.remainingMs <= 0) return;
    control.play();
    setVoiceTimerToStart(null);
  }, [voiceTimerToStart, timerControls]);

  // Audio may only start after a user gesture; unlock it on the first one so
  // a timer that ends while nobody is touching the screen can still ring.
  React.useEffect(() => {
    const prime = () => primeAlarmAudio();
    window.addEventListener('pointerdown', prime);
    window.addEventListener('keydown', prime);
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────────

  const timerControlsRef = React.useRef(timerControls);
  timerControlsRef.current = timerControls;
  useDailyReload(4, () =>
    settings.timers.some((t) => timerControlsRef.current[t.id]?.isRunning)
  );

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  React.useEffect(() => {
    window.addEventListener('beforeunload', flushPersist);
    window.addEventListener('pagehide', flushPersist);
    const flushWhenHidden = () => {
      if (document.hidden) flushPersist();
    };
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      window.removeEventListener('beforeunload', flushPersist);
      window.removeEventListener('pagehide', flushPersist);
      document.removeEventListener('visibilitychange', flushWhenHidden);
    };
  }, [flushPersist]);

  React.useEffect(() => {
    const fontFamily = settings.customFontFamily || settings.fontFamily;
    const curated = CURATED_FONTS.find((f) => f.value === fontFamily);
    if (curated) {
      loadGoogleFont(fontFamily, curated.weights).catch(() => {});
    } else if (fontFamily) {
      loadGoogleFont(fontFamily, [400, 700, settings.fontWeight]).catch(
        () => {}
      );
    }
  }, [settings.fontFamily, settings.customFontFamily, settings.fontWeight]);

  const getRotationStyle = (): React.CSSProperties => {
    const rotationMap: Record<string, number> = {
      default: 0,
      rotate90: 90,
      rotate180: 180,
      rotate270: 270,
    };
    const angle = rotationMap[settings.orientation] || 0;
    const sideways = angle === 90 || angle === 270;
    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: sideways ? 'var(--stage-height)' : '100%',
      height: sideways ? 'var(--stage-width)' : '100%',
      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
    };
  };

  React.useEffect(() => {
    if (!settings.enableAMOLEDSaver || reducedMotion || isSettingsOpen) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (interval !== null) clearInterval(interval);
      interval = null;
    };
    const start = () => {
      stop();
      if (!document.hidden) {
        interval = setInterval(
          () => setDriftOffset(generateRandomDrift()),
          60000
        );
      }
    };
    start();
    document.addEventListener('visibilitychange', start);
    document.addEventListener('freeze', stop);
    document.addEventListener('resume', start);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', start);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', start);
      document.removeEventListener('freeze', stop);
      document.removeEventListener('resume', start);
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('pageshow', start);
    };
  }, [settings.enableAMOLEDSaver, reducedMotion, isSettingsOpen]);

  // Auto-hide controls
  React.useEffect(() => {
    if (!settings.autoHideControls) {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return;
    }
    const resetTimer = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!isSettingsOpen && !isInfoOpen && !isTimerOpen && !voiceBusy)
          setShowControls(false);
      }, 10000);
    };
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('mousedown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [
    settings.autoHideControls,
    isSettingsOpen,
    isInfoOpen,
    isTimerOpen,
    voiceBusy,
  ]);

  const bgStyle: React.CSSProperties = React.useMemo(() => {
    if (settings.enableAMOLEDSaver) return { backgroundColor: '#000000' };
    if (settings.backgroundMode === 'gradient') {
      return {
        background: `linear-gradient(${settings.bgGradientAngle}deg, ${settings.gradientStart}, ${settings.gradientEnd})`,
        backgroundSize:
          settings.animatedGradient && !reducedMotion ? '200% 200%' : undefined,
        animation:
          settings.animatedGradient && !reducedMotion
            ? 'background-flow 18s ease infinite'
            : undefined,
        transition: reducedMotion ? 'none' : 'background 0.3s ease-in-out',
      };
    }
    if (settings.backgroundMode === 'image') {
      return {
        backgroundImage: `url(${settings.backgroundImage})`,
        backgroundSize: `${settings.bgScale * 100}%`,
        backgroundPosition: `${settings.bgOffsetX}% ${settings.bgOffsetY}%`,
        backgroundRepeat: 'no-repeat',
        transition: reducedMotion ? 'none' : 'opacity 0.3s ease-in-out',
      };
    }
    return {
      backgroundColor: settings.solidColor,
      transition: reducedMotion ? 'none' : 'background-color 0.3s ease-in-out',
    };
  }, [
    settings.enableAMOLEDSaver,
    settings.backgroundMode,
    settings.gradientStart,
    settings.gradientEnd,
    settings.bgGradientAngle,
    settings.animatedGradient,
    settings.solidColor,
    settings.backgroundImage,
    settings.bgScale,
    settings.bgOffsetX,
    settings.bgOffsetY,
    reducedMotion,
  ]);

  const stageRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const stage = stageRef.current!;
    const resize = () => {
      stage.style.setProperty('--stage-width', stage.clientWidth + 'px');
      stage.style.setProperty('--stage-height', stage.clientHeight + 'px');
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const textureStyle: React.CSSProperties = {
    opacity: settings.patternOpacity,
    backgroundPosition:
      settings.backgroundPattern === 'image'
        ? `${settings.bgOffsetX}% ${settings.bgOffsetY}%`
        : undefined,
    backgroundRepeat:
      settings.backgroundPattern === 'image' ? 'no-repeat' : 'repeat',
    backgroundSize:
      settings.backgroundPattern === 'image'
        ? `${settings.bgScale * 100}%`
        : `${settings.patternSize}px ${settings.patternSize}px`,
    backgroundImage:
      settings.backgroundPattern === 'dots'
        ? 'radial-gradient(circle, #ffffff 1px, transparent 1.5px)'
        : settings.backgroundPattern === 'grid'
          ? 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)'
          : settings.backgroundPattern === 'diagonal'
            ? 'repeating-linear-gradient(135deg, #ffffff 0 1px, transparent 1px 50%)'
            : settings.backgroundPattern === 'image' && settings.backgroundImage
              ? `url("${settings.backgroundImage}")`
              : 'none',
  };
  // Resolve top/bottom label text for the clock
  // Timer labels take priority over custom text; multiple timers at the same position are joined
  const TIMER_LABEL_SEPARATOR = '  ';

  const topLabelTimers = settings.timers.filter(
    (t) => t.displayPosition === 'top'
  );
  const bottomLabelTimers = settings.timers.filter(
    (t) => t.displayPosition === 'bottom'
  );

  const topTimerText =
    topLabelTimers.length > 0
      ? topLabelTimers
          .map((t) => formatMs(timerControls[t.id]?.remainingMs ?? 0, t.showSeconds))
          .join(TIMER_LABEL_SEPARATOR)
      : undefined;

  const bottomTimerText =
    bottomLabelTimers.length > 0
      ? bottomLabelTimers
          .map((t) => formatMs(timerControls[t.id]?.remainingMs ?? 0, t.showSeconds))
          .join(TIMER_LABEL_SEPARATOR)
      : undefined;

  const effectiveTopText = topTimerText ?? settings.topText;
  const effectiveBottomText = bottomTimerText ?? settings.bottomText;
  const effectiveShowTopText =
    topTimerText != null ? true : settings.showTopText;
  const effectiveShowBottomText =
    bottomTimerText != null ? true : settings.showBottomText;

  const driftApplied =
    settings.enableAMOLEDSaver && settings.amoledSaverMode === 'drift'
      ? driftOffset
      : { x: 0, y: 0 };

  return (
    <div className="app-viewport" style={bgStyle}>
      <div className="background-texture" style={textureStyle} />
      <div className="clock-stage" ref={stageRef}>
        {/* Main (non-floating) clock */}
        {!settings.clockFloating && (
          <div
            className="w-full h-full select-none pointer-events-none"
            style={{
              ...getRotationStyle(),
              transformOrigin: 'center center',
              transition: 'transform 0.3s ease-in-out',
            }}
          >
            {time.main && (
              <Clock
                time={time.main}
                ampm={time.ampm}
                ampmPosition={settings.ampmPosition}
                clockMode={settings.clockMode}
                color={settings.clockColor}
                gradientStart={settings.clockGradientStart}
                gradientEnd={settings.clockGradientEnd}
                gradientAngle={settings.clockGradientAngle}
                showStroke={settings.showStroke}
                strokeWidth={settings.strokeWidth}
                strokeColor={settings.strokeColor}
                fontFamily={settings.customFontFamily || settings.fontFamily}
                scale={settings.scale}
                autoFit={settings.autoFit}
                edgePadding={settings.edgePadding}
                driftMargin={
                  settings.enableAMOLEDSaver &&
                  settings.amoledSaverMode === 'drift'
                    ? 3
                    : 0
                }
                offsetX={settings.offsetX}
                offsetY={settings.offsetY}
                driftOffset={driftApplied}
                prefersReducedMotion={reducedMotion}
                fontWeight={settings.fontWeight}
                refreshKey={time.revision}
                animationMode={settings.animationMode}
                topText={effectiveTopText}
                bottomText={effectiveBottomText}
                topTextSize={settings.topTextSize}
                bottomTextSize={settings.bottomTextSize}
                topTextColor={settings.topTextColor}
                bottomTextColor={settings.bottomTextColor}
                showTopText={effectiveShowTopText}
                showBottomText={effectiveShowBottomText}
                showSeconds={settings.showSeconds}
                pulseColon={settings.pulseColon}
                tabularNums={settings.tabularNums}
                tabularNumsFallback={settings.tabularNumsFallback}
              />
            )}
          </div>
        )}

        {/* Floating clock */}
        {settings.clockFloating && time.main && (
          <FloatingClock
            settings={settings}
            time={time.main}
            ampm={time.ampm}
            topText={effectiveTopText}
            bottomText={effectiveBottomText}
            showTopText={effectiveShowTopText}
            showBottomText={effectiveShowBottomText}
            driftOffset={driftApplied}
            prefersReducedMotion={reducedMotion}
            refreshKey={time.revision}
            onTransformChange={(x, y, s, r) =>
              updateMultiple({
                clockFloatX: x,
                clockFloatY: y,
                clockFloatScale: s,
                clockFloatRotation: r,
              })
            }
          />
        )}

        {/* Floating timer widgets */}
        {settings.timers
          .filter((t) => t.displayPosition === 'floating')
          .map((t) => {
            const ctrl = timerControls[t.id];
            if (!ctrl) return null;
            return (
              <FloatingTimerWidget
                key={t.id}
                config={t}
                remainingMs={ctrl.remainingMs}
                isRunning={ctrl.isRunning}
                isExpired={ctrl.isExpired}
                onPlay={ctrl.play}
                onPause={ctrl.pause}
                onReset={ctrl.reset}
                onTransformChange={(x, y, scale, rotation) =>
                  updateTimer(t.id, {
                    floatX: x,
                    floatY: y,
                    floatScale: scale,
                    floatRotation: rotation,
                  })
                }
                onFontToggle={(useClockFont) =>
                  updateTimer(t.id, { useClockFont })
                }
                clockColor={settings.clockColor}
                clockFontFamily={
                  settings.customFontFamily || settings.fontFamily
                }
                clockFontWeight={settings.fontWeight}
              />
            );
          })}
      </div>
      <SettingsRail
        section={settingsSection}
        onChange={(section) => {

          setIsTimerOpen(false);
          setIsInfoOpen(false);
          setSettingsSection(section);
        }}
        visible={showControls}
        onTimer={() => {

          setSettingsSection(null);
          setIsTimerOpen(true);
        }}
        onInfo={() => {

          setSettingsSection(null);
          setIsInfoOpen(true);
        }}
      />
      {settings.enableAMOLEDSaver && settings.amoledSaverMode === 'mesh' && (
        <AmoledMesh
          type={settings.amoledMeshType}
          driftOffset={driftOffset}
          prefersReducedMotion={reducedMotion}
        />
      )}

      {/* Above the clock, below the controls, so settings stay readable. */}
      <div
        className="brightness-dimmer"
        aria-hidden="true"
        style={{ opacity: 1 - brightness / 100 }}
      />

      <SettingsSheet
        section={settingsSection}
        onClose={() => setSettingsSection(null)}
      />

      <TimerSheet
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        timerControls={timerControls}
      />

      <VoiceTimerButton
        visible={showControls}
        enabled={!isSettingsOpen && !isTimerOpen && !isInfoOpen}
        reducedMotion={reducedMotion}
        onBusyChange={setVoiceBusy}
        onCreate={(config) => {
          primeAlarmAudio();
          const id = useSettingsStore.getState().addTimer(config);
          if (config.inputMode === 'duration') setVoiceTimerToStart(id);
          toast.success('Timer started: ' + (config.label || 'Voice timer'), {
            description:
              config.inputMode === 'duration'
                ? formatMs(
                    ((config.hours || 0) * 3600 +
                      (config.minutes || 0) * 60 +
                      (config.seconds || 0)) * 1000
                  )
                : new Date(config.targetDatetime!).toLocaleString(),
            duration: 10000,
            action: {
              label: 'Undo',
              onClick: () => {
                setVoiceTimerToStart((pending) => pending === id ? null : pending);
                useSettingsStore.getState().removeTimer(id);
                setAlerts((current) => current.filter((alert) => alert.id !== id));
              },
            },
          });
        }}
      />

      <InfoDialog isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />

      <TimerAlarm alerts={alerts} onDismiss={dismissAlerts} />

      <Toaster theme="dark" position="bottom-center" />
    </div>
  );
}
