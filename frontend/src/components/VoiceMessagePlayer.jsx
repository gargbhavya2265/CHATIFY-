
import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

const WAVEFORM = [
  12, 19, 27, 16, 32, 22, 38, 18, 29, 14,
  24, 35, 20, 30, 15, 26, 37, 19, 28, 13,
  23, 34, 17, 29, 12, 25, 36, 18, 27, 15,
  32, 20, 28, 13, 22, 35, 17, 26, 14, 30,
];

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
};

function VoiceMessagePlayer({ src, isOwnMessage = false }) {
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const durationProbeRef = useRef(false);
  const hasProbedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasError, setHasError] = useState(false);

  const playedColor = isOwnMessage ? "bg-white" : "bg-cyan-400";
  const unplayedColor = isOwnMessage
    ? "bg-white/35"
    : "bg-slate-500/60";

  const mutedColor = isOwnMessage
    ? "text-white/65"
    : "text-slate-400";

  // Read the actual duration whenever the browser makes it available.
  const updateDuration = (audio) => {
    if (
      audio &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0
    ) {
      setDuration(audio.duration);

      // Restore playback position after the duration recovery seek.
      if (durationProbeRef.current) {
        durationProbeRef.current = false;

        try {
          audio.currentTime = 0;
          setCurrentTime(0);
        } catch (error) {
          console.error("Voice duration restore failed:", error);
        }
      }

      return true;
    }

    return false;
  };

  // Some WebM files report Infinity instead of their actual duration.
  // Seeking to the end makes the browser calculate the duration.
  const recoverDuration = (audio) => {
    if (
      !audio ||
      hasProbedRef.current ||
      Number.isFinite(audio.duration) ||
      audio.duration !== Infinity
    ) {
      return;
    }

    hasProbedRef.current = true;
    durationProbeRef.current = true;

    try {
      audio.currentTime = 1e101;
    } catch (error) {
      durationProbeRef.current = false;
      console.error("Voice duration recovery failed:", error);
    }
  };

  const handleMetadata = (audio) => {
    const durationFound = updateDuration(audio);

    if (!durationFound) {
      recoverDuration(audio);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1);
    setHasError(false);

    durationProbeRef.current = false;
    hasProbedRef.current = false;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = 1;
    }

    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [src]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.error("Voice playback failed:", error);
      setIsPlaying(false);
    }
  };

  const seekTo = (clientX) => {
    const audio = audioRef.current;
    const waveform = waveformRef.current;

    if (!audio || !waveform || !duration) return;

    const rect = waveform.getBoundingClientRect();
    if (!rect.width) return;

    const position = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width)
    );

    const targetTime = position * duration;

    try {
      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
    } catch (error) {
      console.error("Voice seeking failed:", error);
    }
  };

  const handleWaveformClick = (event) => {
    seekTo(event.clientX);
  };

  const handleWaveformKeyDown = (event) => {
    if (!duration) return;

    const audio = audioRef.current;
    if (!audio) return;

    let nextTime = audio.currentTime;

    if (event.key === "ArrowRight") {
      nextTime = Math.min(audio.currentTime + 5, duration);
    } else if (event.key === "ArrowLeft") {
      nextTime = Math.max(audio.currentTime - 5, 0);
    } else if (event.key === "Home") {
      nextTime = 0;
    } else if (event.key === "End") {
      nextTime = duration;
    } else {
      return;
    }

    event.preventDefault();
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const cyclePlaybackSpeed = () => {
    setPlaybackSpeed((current) =>
      current === 1 ? 1.5 : current === 1.5 ? 2 : 1
    );
  };

  const progress =
    duration > 0
      ? Math.min((currentTime / duration) * 100, 100)
      : 0;

  return (
    <div className="w-full min-w-0 max-w-[280px] py-1">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) =>
          handleMetadata(event.currentTarget)
        }
        onDurationChange={(event) =>
          handleMetadata(event.currentTarget)
        }
        onLoadedData={(event) =>
          handleMetadata(event.currentTarget)
        }
        onSeeked={(event) =>
          updateDuration(event.currentTarget)
        }
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;

          updateDuration(audio);

          // Do not show the temporary recovery-seek position.
          if (!durationProbeRef.current) {
            setCurrentTime(audio.currentTime);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setHasError(true);
          setIsPlaying(false);
          durationProbeRef.current = false;
        }}
        className="hidden"
      />

      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={hasError}
          aria-label={
            isPlaying ? "Pause voice message" : "Play voice message"
          }
          className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 disabled:opacity-40 ${
            isOwnMessage
              ? "bg-white text-cyan-700 hover:bg-white/90"
              : "bg-cyan-500 text-white hover:bg-cyan-400"
          }`}
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play
              size={18}
              fill="currentColor"
              className="ml-0.5"
            />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div
            ref={waveformRef}
            onClick={handleWaveformClick}
            onKeyDown={handleWaveformKeyDown}
            role="slider"
            aria-label="Voice message playback position"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={currentTime}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            tabIndex={duration > 0 ? 0 : -1}
            className="relative flex items-center h-10 w-full cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded"
            title="Click to seek. Use arrow keys to move 5 seconds."
          >
            <div className="flex items-center justify-between gap-[3px] w-full h-full overflow-hidden pointer-events-none">
              {WAVEFORM.map((height, index) => {
                const played =
                  (index / WAVEFORM.length) * 100 <= progress;

                return (
                  <div
                    key={index}
                    className={`flex-1 min-w-[2px] max-w-[4px] rounded-full transition-colors duration-100 ${
                      played ? playedColor : unplayedColor
                    }`}
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>

            <div
              className={`absolute top-1 bottom-1 z-10 w-[2px] rounded-full pointer-events-none ${
                isOwnMessage ? "bg-white" : "bg-cyan-300"
              }`}
              style={{ left: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-1">
            <span
              className={`text-[11px] font-medium tabular-nums ${mutedColor}`}
            >
              {hasError
                ? "Audio unavailable"
                : `${formatTime(currentTime)} / ${formatTime(duration)}`}
            </span>

            {!hasError && (
              <button
                type="button"
                onClick={cyclePlaybackSpeed}
                className={`text-[11px] font-semibold rounded-full px-2 py-0.5 hover:bg-white/15 transition-colors ${mutedColor}`}
                title="Change playback speed"
                aria-label={`Playback speed ${playbackSpeed} times`}
              >
                {playbackSpeed}×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VoiceMessagePlayer;
