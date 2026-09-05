import React from 'react';
import { Toaster } from 'sonner';
import { Clock } from '@/components/Clock';

import {
  SettingsSheet,
  SettingsRail,
  type SettingsSection,
} from '@/components/SettingsSheet';
import { TimerSheet } from '@/components/TimerSheet';

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

import { InfoDialog } from '@/components/InfoDialog';
import { useTimerArray, formatMs } from '@/hooks/useTimerArray';
import { FloatingTimerWidget } from '@/components/TimerWidget';
import { FloatingClock } from '@/components/FloatingClock';

export function App() {
  const { settings, loadSettings, flushPersist, updateMultiple, updateTimer } =
    useSettingsStore();
  const [settingsSection, setSettingsSection] =
    React.useState<SettingsSection | null>(null);
  const isSettingsOpen = settingsSection !== null;
  const [isTimerOpen, setIsTimerOpen] = React.useState(false);
  const [time, setTime] = React.useState({ main: '', ampm: '' });
  const [showControls, setShowControls] = React.useState(true);
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [driftOffset, setDriftOffset] = React.useState<DriftOffset>({
    x: 0,
    y: 0,
  });
  const driftIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const timeIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const reducedMotion = prefersReducedMotion();
  usePWA();
  useWakeLock();

  // ── Timers ───────────────────────────────────────────────────────────────────
  const timerControls = useTimerArray(settings.timers);
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

  const formatTime = React.useCallback(() => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    if (settings.clockFormat === '12h') {
      const isPM = hours >= 12;
      hours = hours % 12 || 12;
      const hoursStr = hours.toString().padStart(2, '0');
      const base = `${hoursStr}:${minutes}`;
      const main = settings.showSeconds ? `${base}:${seconds}` : base;
      return { main, ampm: isPM ? 'PM' : 'AM' };
    } else {
      const hoursStr = hours.toString().padStart(2, '0');
      const base = `${hoursStr}:${minutes}`;
      const main = settings.showSeconds ? `${base}:${seconds}` : base;
      return { main, ampm: '' };
    }
  }, [settings.clockFormat, settings.showSeconds]);

  React.useEffect(() => {
    setTime(formatTime());
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 500);
    timeIntervalRef.current = interval;
    return () => {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    };
  }, [formatTime]);

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
    if (!settings.enableAMOLEDSaver || reducedMotion || isSettingsOpen) {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
      return;
    }
    const driftInterval = setInterval(() => {
      setDriftOffset(generateRandomDrift());
    }, 60000);
    driftIntervalRef.current = driftInterval;
    return () => {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
    };
  }, [settings.enableAMOLEDSaver, reducedMotion, isSettingsOpen]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (driftIntervalRef.current) {
          clearInterval(driftIntervalRef.current);
          driftIntervalRef.current = null;
        }
        if (timeIntervalRef.current) {
          clearInterval(timeIntervalRef.current);
          timeIntervalRef.current = null;
        }
      } else {
        setTime(formatTime());
        if (!timeIntervalRef.current) {
          timeIntervalRef.current = setInterval(() => {
            setTime(formatTime());
          }, 500);
        }
        if (
          settings.enableAMOLEDSaver &&
          !reducedMotion &&
          !driftIntervalRef.current &&
          !isSettingsOpen
        ) {
          driftIntervalRef.current = setInterval(() => {
            setDriftOffset(generateRandomDrift());
          }, 60000);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [
    settings.enableAMOLEDSaver,
    reducedMotion,
    isSettingsOpen,
    isInfoOpen,
    formatTime,
  ]);

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
        if (!isSettingsOpen && !isInfoOpen && !isTimerOpen)
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
  }, [settings.autoHideControls, isSettingsOpen, isInfoOpen, isTimerOpen]);

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
          .map((t) => formatMs(timerControls[t.id]?.remainingMs ?? 0))
          .join(TIMER_LABEL_SEPARATOR)
      : undefined;

  const bottomTimerText =
    bottomLabelTimers.length > 0
      ? bottomLabelTimers
          .map((t) => formatMs(timerControls[t.id]?.remainingMs ?? 0))
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
                refreshKey={0}
                animationMode={settings.animationMode}
                topText={effectiveTopText}
                bottomText={effectiveBottomText}
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
            refreshKey={0}
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

      <SettingsSheet
        section={settingsSection}
        onClose={() => setSettingsSection(null)}
      />

      <TimerSheet
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        timerControls={timerControls}
      />

      <InfoDialog isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />

      <Toaster position="bottom-center" />
    </div>
  );
}
