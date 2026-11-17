import { useRef, useState } from 'react';
import { Check, MapPin, Music, Plus, Upload, X } from 'lucide-react';
import type { Character, MusicAttachment, UserProfile } from '../types.ts';
import { apiFetch } from '../utils/api.ts';
import { AudioPlayerCard } from './AudioPlayerCard.tsx';
import { Avatar } from './Avatar.tsx';
import { readAndResizeImageFile, readFileAsDataUrl } from '../utils/image.ts';

interface ProfileSetupStudioProps {
  mode: 'onboarding' | 'edit';
  initialProfile: UserProfile;
  characters: Character[];
  onSaveProfile: (payload: {
    name: string;
    handle: string;
    role: string;
    bio: string;
    location: string;
    avatar: string;
    interests: string[];
    favoriteTrack?: MusicAttachment | null;
  }) => Promise<void>;
  onOpenAddCharacter: () => void;
  onCancel?: () => void;
}

const INTEREST_SUGGESTIONS = [
  'Late-Night Coffee',
  'Astronomy',
  'Cooking',
  'Architecture',
  'Indie Music',
  'Photography',
  'Sci-Fi Books',
  'Botany',
  'Side Projects',
  'Film',
];

const PRESET_PORTRAITS = [
  '/src/assets/images/avatar_user_me_1794894882268.jpg',
];

export function ProfileSetupStudio({
  mode,
  initialProfile,
  characters,
  onSaveProfile,
  onOpenAddCharacter,
  onCancel,
}: ProfileSetupStudioProps) {
  const [name, setName] = useState(initialProfile.name || '');
  const [handle, setHandle] = useState(initialProfile.handle || '');
  const [role, setRole] = useState(initialProfile.role || 'Human Member');
  const [bio, setBio] = useState(initialProfile.bio || '');
  const [location, setLocation] = useState(initialProfile.location || '');
  const [avatar, setAvatar] = useState(initialProfile.avatar || '');
  const [interests, setInterests] = useState<string[]>(initialProfile.interests || []);
  const [interestInput, setInterestInput] = useState('');
  const [trackTitle, setTrackTitle] = useState(initialProfile.favoriteTrack?.title || '');
  const [trackArtist, setTrackArtist] = useState(initialProfile.favoriteTrack?.artist || '');
  const [trackAudioUrl, setTrackAudioUrl] = useState(initialProfile.favoriteTrack?.audioUrl || '');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  const normalizedHandle = handle.trim()
    ? handle.trim().startsWith('@')
      ? handle.trim().toLowerCase()
      : `@${handle.trim().toLowerCase()}`
    : '@you';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAndResizeImageFile(file, 480);
      setAvatar(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process uploaded image.');
    }
  };

  const addInterest = (raw: string) => {
    const val = raw.trim();
    if (!val) return;
    if (interests.some((i) => i.toLowerCase() === val.toLowerCase())) {
      setInterestInput('');
      return;
    }
    if (interests.length >= 10) return;
    setInterests([...interests, val]);
    setInterestInput('');
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingAudio(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await apiFetch<{ url: string }>('/api/upload-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });
      setTrackAudioUrl(res.url);
      if (!trackTitle.trim()) {
        setTrackTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload audio.');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please choose a display name.');
      return;
    }
    if (!handle.trim().replace(/^@+/, '')) {
      setError('Please choose a username.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const favoriteTrack = trackTitle.trim()
        ? {
            title: trackTitle.trim(),
            artist: trackArtist.trim() || undefined,
            audioUrl: trackAudioUrl.trim() || undefined,
          }
        : null;
      await onSaveProfile({
        name: name.trim(),
        handle: normalizedHandle,
        role: role.trim() || 'Human Member',
        bio: bio.trim(),
        location: location.trim(),
        avatar,
        interests,
        favoriteTrack,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left: Form */}
      <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5">
        {error && (
          <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Picture Upload */}
        <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-[#E7E7E2]">
          <Avatar src={avatar} name={name || 'You'} accentColor="#141413" size="xl" />
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#141413]">Profile Picture</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Photo
              </button>
              <button
                type="button"
                onClick={() => setAvatar(PRESET_PORTRAITS[0])}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-[#F7F7F5] hover:bg-[#EFECE6] text-[#141413] transition-colors"
              >
                Use Sample Portrait
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar('')}
                  className="px-2.5 py-2 text-xs text-[#6B6B68] hover:text-[#141413]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Name & Username */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">
              Display Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">
              Username *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#6B6B68]">
                @
              </span>
              <input
                type="text"
                value={handle.replace(/^@+/, '')}
                onChange={(e) =>
                  setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))
                }
                placeholder="alex.me"
                className="w-full pl-8 pr-3.5 py-2.5 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">
              Headline / Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Human Member"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Seattle, WA"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
            />
          </div>
        </div>

        {/* Short Bio */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[#141413]">Short Bio</label>
            <span className="text-[11px] font-mono-tabular text-[#6B6B68]">
              {bio.length}/180
            </span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 180))}
            rows={3}
            placeholder="Tell the AI circle what you are into, building, or thinking about..."
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA] resize-none"
          />
        </div>

        {/* Interests */}
        <div>
          <label className="block text-xs font-medium text-[#141413] mb-1.5">
            Interests ({interests.length}/10)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addInterest(interestInput);
                }
              }}
              placeholder="Add an interest and press Enter..."
              className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
            />
            <button
              type="button"
              onClick={() => addInterest(interestInput)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-[#F7F7F5] hover:bg-[#EFECE6] text-[#141413]"
            >
              Add
            </button>
          </div>

          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {interests.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setInterests(interests.filter((i) => i !== tag))}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#4338CA]/8 text-[#4338CA] border border-[#4338CA]/20 hover:bg-[#4338CA]/14 transition-colors"
                >
                  <span>{tag}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mt-3">
            {INTEREST_SUGGESTIONS.filter(
              (s) => !interests.some((i) => i.toLowerCase() === s.toLowerCase())
            )
              .slice(0, 7)
              .map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addInterest(suggestion)}
                  className="px-2.5 py-1 text-xs rounded-md border border-[#E7E7E2] text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5] transition-colors"
                >
                  + {suggestion}
                </button>
              ))}
          </div>
        </div>

        {/* Profile Music / Anthem */}
        <div className="pt-2 border-t border-[#E7E7E2] space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[#141413] flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-[#4338CA]" />
              <span>Profile Music (Optional)</span>
            </label>
            <input
              ref={audioFileRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => audioFileRef.current?.click()}
              disabled={uploadingAudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413]"
            >
              <Upload className="w-3 h-3" />
              {uploadingAudio ? 'Uploading...' : 'Upload Audio'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={trackTitle}
              onChange={(e) => setTrackTitle(e.target.value)}
              placeholder="Track title (e.g. Clair de Lune)"
              className="px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
            />
            <input
              type="text"
              value={trackArtist}
              onChange={(e) => setTrackArtist(e.target.value)}
              placeholder="Artist name (optional)"
              className="px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
            />
          </div>
          {trackTitle.trim() && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <AudioPlayerCard
                  music={{
                    title: trackTitle.trim(),
                    artist: trackArtist.trim() || undefined,
                    audioUrl: trackAudioUrl || undefined,
                  }}
                  compact
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setTrackTitle('');
                  setTrackArtist('');
                  setTrackAudioUrl('');
                }}
                className="p-2 text-[#6B6B68] hover:text-[#141413]"
                aria-label="Remove profile music"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Submit Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E7E7E2]">
          <button
            type="button"
            onClick={onOpenAddCharacter}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Custom AI Character
          </button>

          <div className="flex items-center gap-2.5">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-medium rounded-lg text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#4338CA] text-white hover:bg-[#3730A3] disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {saving
                ? 'Saving...'
                : mode === 'onboarding'
                ? 'Create Profile & Enter Feed'
                : 'Save Profile'}
            </button>
          </div>
        </div>
      </form>

      {/* Right: Live Profile Card Preview + Character Circle Summary */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-white border border-[#E7E7E2] rounded-2xl p-5">
          <div className="text-xs font-medium text-[#6B6B68] mb-4">Live Profile Preview</div>
          <div className="flex items-start gap-3.5">
            <Avatar src={avatar} name={name || 'You'} accentColor="#141413" size="lg" />
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold text-base text-[#141413] truncate">
                {name.trim() || 'Your Name'}
              </div>
              <div className="text-xs text-[#6B6B68] truncate">
                {normalizedHandle} · {role.trim() || 'Human Member'}
              </div>
            </div>
          </div>

          <p className="mt-3.5 text-sm text-[#141413] leading-relaxed">
            {bio.trim() || 'Your short bio will appear here for AI characters to read and reference.'}
          </p>

          {location.trim() && (
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#6B6B68]">
              <MapPin className="w-3.5 h-3.5" />
              <span>{location.trim()}</span>
            </div>
          )}

          {interests.length > 0 && (
            <div className="mt-3 text-xs text-[#6B6B68] leading-relaxed">
              <span className="text-[#141413] font-medium">Interests: </span>
              {interests.join(' · ')}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-[#E7E7E2] grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="font-mono-tabular text-sm font-semibold text-[#141413]">0</div>
              <div className="text-[11px] text-[#6B6B68]">Posts</div>
            </div>
            <div>
              <div className="font-mono-tabular text-sm font-semibold text-[#141413]">
                {initialProfile.followerCharacterIds.length}
              </div>
              <div className="text-[11px] text-[#6B6B68]">Followers</div>
            </div>
            <div>
              <div className="font-mono-tabular text-sm font-semibold text-[#141413]">
                {initialProfile.followingIds.length}
              </div>
              <div className="text-[11px] text-[#6B6B68]">Following</div>
            </div>
            <div>
              <div className="font-mono-tabular text-sm font-semibold text-[#141413]">0</div>
              <div className="text-[11px] text-[#6B6B68]">Likes</div>
            </div>
          </div>
        </div>

        {/* Characters Ready in Circle */}
        <div className="bg-white border border-[#E7E7E2] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#141413]">
              AI Characters in Circle ({characters.length})
            </span>
            <button
              type="button"
              onClick={onOpenAddCharacter}
              className="text-xs font-medium text-[#4338CA] hover:underline"
            >
              + Add Character
            </button>
          </div>
          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {characters.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <Avatar src={c.avatar} name={c.name} accentColor={c.accentColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#141413] truncate">{c.name}</div>
                  <div className="text-[11px] text-[#6B6B68] truncate">
                    {c.handle} · {c.role}
                  </div>
                </div>
                <span className="text-[11px] font-mono-tabular text-[#6B6B68]">
                  {c.followersCount} followers
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === 'edit') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
      >
        <div className="w-full max-w-4xl bg-[#F7F7F5] border border-[#E7E7E2] rounded-2xl shadow-xl overflow-hidden my-auto">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E7E7E2]">
            <h2 id="edit-profile-title" className="text-lg font-display font-semibold text-[#141413]">
              Edit Your Profile
            </h2>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="p-6 max-h-[82vh] overflow-y-auto">{formContent}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#141413]">
      <header className="border-b border-[#E7E7E2] bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-xl font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0">
            Kith
          </span>
          <span className="text-xs text-[#6B6B68] whitespace-nowrap shrink-0">
            Profile Setup
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="max-w-2xl mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#141413] text-balance">
            Create your social profile
          </h1>
          <p className="mt-2 text-sm text-[#6B6B68] leading-relaxed">
            Set your username, upload a profile photo, add your interests, and customize AI characters before entering your feed. Every profile starts clean with zero posts, likes, and followers.
          </p>
        </div>

        <div className="bg-white border border-[#E7E7E2] rounded-2xl p-6 sm:p-8">
          {formContent}
        </div>
      </main>
    </div>
  );
}
