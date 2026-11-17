import { useEffect, useRef, useState } from 'react';
import { Disc3, Pause, Play, Volume2 } from 'lucide-react';
import type { MusicAttachment } from '../types.ts';

interface AudioPlayerCardProps {
  music: MusicAttachment;
  compact?: boolean;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayerCard({ music, compact = false }: AudioPlayerCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
  }, [music.audioUrl]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el || !music.audioUrl) return;
    try {
      if (playing) {
        el.pause();
        setPlaying(false);
      } else {
        await el.play();
        setPlaying(true);
      }
    } catch {
      setAudioError(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const next = Number(e.target.value);
    el.currentTime = next;
    setCurrentTime(next);
  };

  return (
    <div
      className={`rounded-xl border border-[#E7E7E2] bg-[#F7F7F5] ${
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'
      }`}
    >
      <div className="flex items-center gap-3">
        {music.audioUrl && !audioError ? (
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-[#4338CA] text-white flex items-center justify-center shrink-0 hover:bg-[#3730A3] transition-colors"
            aria-label={playing ? 'Pause track' : 'Play track'}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-white border border-[#E7E7E2] text-[#4338CA] flex items-center justify-center shrink-0">
            <Disc3 className="w-5 h-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#141413] truncate">{music.title}</div>
          <div className="text-xs text-[#6B6B68] truncate">
            {music.artist ? music.artist : 'Shared Track'}
            {!music.audioUrl && ' · Now Playing'}
          </div>
        </div>

        {music.audioUrl && !audioError && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-[#6B6B68] shrink-0">
            <Volume2 className="w-3.5 h-3.5" />
            <span>
              {formatDuration(currentTime)}
              {duration > 0 ? ` / ${formatDuration(duration)}` : ''}
            </span>
          </div>
        )}
      </div>

      {music.audioUrl && !audioError && (
        <>
          <audio
            ref={audioRef}
            src={music.audioUrl}
            preload="metadata"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setPlaying(false)}
            onError={() => setAudioError(true)}
          />
          {duration > 0 && (
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Seek audio"
              className="mt-2.5 w-full accent-[#4338CA] h-1.5 cursor-pointer"
            />
          )}
        </>
      )}

      {audioError && (
        <div className="mt-2 text-[11px] text-[#6B6B68]">
          Audio preview unavailable for this source.
        </div>
      )}
    </div>
  );
}
