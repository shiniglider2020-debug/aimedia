import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Avatar } from './Avatar.tsx';
import { readAndResizeImageFile } from '../utils/image.ts';

interface CharacterModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    handle: string;
    role: string;
    bio: string;
    personality: string;
    interests: string[];
    accentColor: string;
    avatar: string;
    autoIntro: boolean;
    followImmediately: boolean;
  }) => Promise<void>;
}

const ACCENT_OPTIONS = ['#4338CA', '#1E3A8A', '#9A3412', '#166534', '#3F3F46', '#7C2D12'];

const PERSONA_TEMPLATES = [
  {
    label: 'Bookshop Archivist',
    role: 'Rare Book Restorer',
    bio: 'Tracking marginalia in century-old paperbacks and brewing roasted barley tea.',
    personality:
      'Observant, gentle humor, fascinated by forgotten notes inside used books. Speaks thoughtfully with vivid tactile details.',
    interests: ['Books', 'History', 'Paper Craft', 'Tea'],
  },
  {
    label: 'Late-Night DJ',
    role: 'Ambient Radio Host',
    bio: 'Spinning ambient vinyl between midnight and 3 AM for insomniacs and night-shift workers.',
    personality:
      'Calm, welcoming, nocturnal, deeply attentive to mood and sound textures. Writes with warmth and easy rhythm.',
    interests: ['Music', 'Vinyl', 'Night Shifts', 'Sound Design'],
  },
  {
    label: 'Marine Biologist',
    role: 'Tidepool Researcher',
    bio: 'Documenting bioluminescent plankton and coastal fog patterns along the Pacific.',
    personality:
      'Curious, energetic, scientifically grounded, loves sharing surprising facts about ocean creatures.',
    interests: ['Ocean', 'Ecology', 'Photography', 'Field Notes'],
  },
];

export function CharacterModal({ open, onClose, onCreate }: CharacterModalProps) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [personality, setPersonality] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [avatar, setAvatar] = useState('');
  const [accentColor, setAccentColor] = useState(ACCENT_OPTIONS[0]);
  const [autoIntro, setAutoIntro] = useState(true);
  const [followImmediately, setFollowImmediately] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAndResizeImageFile(file, 400);
      setAvatar(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image.');
    }
  };

  const addInterest = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned || interests.includes(cleaned) || interests.length >= 8) return;
    setInterests([...interests, cleaned]);
    setInterestInput('');
  };

  const applyTemplate = (tpl: (typeof PERSONA_TEMPLATES)[number]) => {
    if (!role) setRole(tpl.role);
    if (!bio) setBio(tpl.bio);
    setPersonality(tpl.personality);
    setInterests(tpl.interests);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !personality.trim()) {
      setError('Please enter a name, role, and personality description.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        handle: handle.trim(),
        role: role.trim(),
        bio: bio.trim(),
        personality: personality.trim(),
        interests,
        accentColor,
        avatar,
        autoIntro,
        followImmediately,
      });
      setName('');
      setHandle('');
      setRole('');
      setBio('');
      setPersonality('');
      setInterests([]);
      setAvatar('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create character.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-character-title"
    >
      <div className="w-full max-w-xl bg-white border border-[#E7E7E2] rounded-2xl shadow-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E7E2]">
          <div>
            <h2 id="create-character-title" className="text-lg font-display font-semibold text-[#141413]">
              Add AI Character
            </h2>
            <p className="text-xs text-[#6B6B68] mt-0.5">
              Design a character who can post, comment, and chat with you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Avatar + Color Picker */}
          <div className="flex items-center gap-4">
            <Avatar src={avatar} name={name || 'New Character'} accentColor={accentColor} size="xl" />
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadAvatar}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Portrait
                </button>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="px-2.5 py-2 text-xs text-[#6B6B68] hover:text-[#141413]"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B6B68]">Monogram tone:</span>
                {ACCENT_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      accentColor === color ? 'ring-2 ring-offset-2 ring-[#4338CA] scale-110' : ''
                    }`}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Starter Templates */}
          <div>
            <div className="text-xs font-medium text-[#6B6B68] mb-2">Quick inspiration</div>
            <div className="flex flex-wrap gap-2">
              {PERSONA_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-[#F7F7F5] hover:bg-[#EFECE6] text-[#141413] transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#141413] mb-1.5">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Clara Lin"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#141413] mb-1.5">Username</label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@clara.books"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">Role / Title *</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Rare Book Restorer"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">Profile Bio</label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="One-line public bio shown on their profile..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">
              Personality & Speaking Style *
            </label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={3}
              placeholder="How do they talk, what do they care about, and how do they react to others?"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA] resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#141413] mb-1.5">Interests</label>
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
                placeholder="Type an interest and press Enter"
                className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
              />
              <button
                type="button"
                onClick={() => addInterest(interestInput)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-[#F7F7F5] hover:bg-[#EFECE6] text-[#141413]"
              >
                Add
              </button>
            </div>
            {interests.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5 text-xs text-[#141413]">
                {interests.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setInterests(interests.filter((i) => i !== tag))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F7F7F5] border border-[#E7E7E2] hover:border-[#141413]/30"
                  >
                    <span>{tag}</span>
                    <X className="w-3 h-3 text-[#6B6B68]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2.5 text-xs text-[#141413] cursor-pointer">
              <input
                type="checkbox"
                checked={followImmediately}
                onChange={(e) => setFollowImmediately(e.target.checked)}
                className="rounded border-[#E7E7E2] text-[#4338CA] focus:ring-[#4338CA]"
              />
              <span>Follow this character immediately</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-[#141413] cursor-pointer">
              <input
                type="checkbox"
                checked={autoIntro}
                onChange={(e) => setAutoIntro(e.target.checked)}
                className="rounded border-[#E7E7E2] text-[#4338CA] focus:ring-[#4338CA]"
              />
              <span>Have them write a first post on the feed</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E7E7E2]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-medium rounded-lg bg-[#4338CA] text-white hover:bg-[#3730A3] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating Character...' : 'Add Character'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
