import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useUploadStore from '../../stores/useUploadStore';
import UploadBg from '../../assets/ourteam.png';

/* ── Viewport observer (same pattern as OurTeam / SchedulePage) ── */

function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

function FadeIn({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

function UploadWastePage() {
  const navigate = useNavigate();
  const {
    uploadWasteImage,
    loading: isSubmitting,
    uploadProgress,
    error: uploadError,
    lastUpload,
    clearError,
    resetUploadState,
  } = useUploadStore();

  const [category, setCategory] = useState('non-recyclable');
  const [level, setLevel] = useState('easy');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  useEffect(() => {
    if (uploadError) clearError();
  }, [uploadError, clearError]);

  const categories = useMemo(() => [
    {
      id: 'recyclable',
      label: 'Recyclable',
      tag: 'RCY',
      description: 'Materials that can be processed and reused.',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      id: 'non-recyclable',
      label: 'Non-recyclable',
      tag: 'NON',
      description: 'Items that cannot be recycled safely.',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    {
      id: 'both',
      label: 'Mixed',
      tag: 'MIX',
      description: 'Contains recyclable and non-recyclable items.',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
    },
  ], []);

  const levels = useMemo(() => [
    {
      id: 'easy',
      label: 'Easy',
      badge: 'L1',
      description: 'Light waste, under 1,000 kg.',
      color: 'emerald',
    },
    {
      id: 'medium',
      label: 'Medium',
      badge: 'L2',
      description: 'Moderate load, 1,000 – 5,000 kg.',
      color: 'amber',
    },
    {
      id: 'hard',
      label: 'Hard',
      badge: 'L3',
      description: 'Heavy load, over 5,000 kg.',
      color: 'red',
    },
  ], []);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === category),
    [categories, category]
  );

  const selectedLevel = useMemo(
    () => levels.find((item) => item.id === level),
    [levels, level]
  );

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const applySelectedFile = (selectedFile) => {
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      alert('Only JPEG, PNG and WebP images are allowed');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      alert('File size should be less than 5MB');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    applySelectedFile(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    applySelectedFile(droppedFile);
  };

  const handleRemoveImage = () => {
    setFile(null);
    setPreview(null);
  };

  const handleSubmit = async () => {
    if (!file) {
      alert('Please upload an image first');
      return;
    }

    const result = await uploadWasteImage(file, category, level);

    if (result.success) {
      setJustSubmitted(true);
      setFile(null);
      setPreview(null);

      const payload = result.data;

      setTimeout(() => {
        resetUploadState();
        setJustSubmitted(false);
        navigate('/searching', {
          state: {
            wasteUploadId: payload?.id || null,
            category: payload?.category || category,
            level: payload?.level || level,
          },
        });
      }, 1500);
    } else {
      alert(result.error || 'Upload failed');
    }
  };

  /* ── Step indicator dots ── */
  const stepComplete = (step) => {
    if (step === 1) return true; // category always selected
    if (step === 2) return true; // level always selected
    if (step === 3) return !!file;
    return false;
  };

  return (
    <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
      {/* ── Dynamic Background ── */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${UploadBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />

      {/* ── Content ── */}
      <div className="relative z-10 pt-24">
        {/* ── Hero header ── */}
        <section className="pb-8 sm:pb-10 px-6 md:px-16 lg:px-24 text-center">
          <FadeIn>
            <span className="inline-block text-white/50 text-xs font-semibold tracking-widest uppercase mb-4">
              Waste Submission
            </span>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="font-bold text-white text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.1] tracking-tight mb-6 drop-shadow-md">
              Upload & Classify Waste
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
              Select category and difficulty, then upload a clear image for faster processing.
            </p>
          </FadeIn>


        </section>

        {/* ── Progress Steps ── */}
        <section className="px-6 md:px-16 lg:px-24 pb-8">
          <FadeIn delay={300}>
            <div className="max-w-3xl mx-auto flex items-center justify-center gap-4">
              {[
                { step: 1, label: 'Category' },
                { step: 2, label: 'Level' },
                { step: 3, label: 'Upload' },
              ].map((s, i) => (
                <div key={s.step} className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-all duration-300 ${stepComplete(s.step)
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-white/5 border-white/15 text-white/40'
                        }`}
                    >
                      {stepComplete(s.step) ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        s.step
                      )}
                    </div>
                    <span className={`text-sm font-medium hidden sm:inline ${stepComplete(s.step) ? 'text-white/70' : 'text-white/35'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div className={`w-12 sm:w-20 h-px ${stepComplete(s.step + 1) ? 'bg-emerald-500/40' : 'bg-white/10'} transition-colors duration-300`} />
                  )}
                </div>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* ── Main content ── */}
        <section className="px-6 md:px-16 lg:px-24 pb-20">
          <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 items-start">
            {/* ── Left column: Steps ── */}
            <div className="xl:col-span-2 space-y-6">
              {/* Step 1: Waste Category */}
              <FadeIn delay={350}>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-white/15 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                      <span className="text-sm font-bold text-emerald-400">1</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-white">
                      Waste Category
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {categories.map((item) => {
                      const selected = category === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCategory(item.id)}
                          className={`group rounded-xl border p-4 text-left transition-all duration-300 ${selected
                            ? 'border-emerald-500/50 bg-emerald-500/15 shadow-lg shadow-emerald-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${selected
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/10 text-white/40 group-hover:text-white/60'
                              }`}>
                              {item.icon}
                            </div>
                            <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-md border ${selected
                              ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                              : 'text-white/35 bg-white/5 border-white/10'
                              }`}>
                              {item.tag}
                            </span>
                          </div>
                          <h3 className={`font-semibold text-base ${selected ? 'text-white' : 'text-white/80'}`}>
                            {item.label}
                          </h3>
                          <p className={`mt-1 text-sm leading-relaxed ${selected ? 'text-white/60' : 'text-white/40'}`}>
                            {item.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </FadeIn>

              {/* Step 2: Difficulty Level */}
              <FadeIn delay={400}>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-white/15 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-400">2</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-white">
                      Difficulty Level
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {levels.map((item) => {
                      const selected = level === item.id;
                      const colorMap = {
                        emerald: {
                          border: 'border-emerald-500/50',
                          bg: 'bg-emerald-500/15',
                          shadow: 'shadow-emerald-500/10',
                          badgeBg: 'bg-emerald-500/15',
                          badgeBorder: 'border-emerald-500/30',
                          badgeText: 'text-emerald-400',
                          dot: 'bg-emerald-500',
                        },
                        amber: {
                          border: 'border-amber-500/50',
                          bg: 'bg-amber-500/15',
                          shadow: 'shadow-amber-500/10',
                          badgeBg: 'bg-amber-500/15',
                          badgeBorder: 'border-amber-500/30',
                          badgeText: 'text-amber-400',
                          dot: 'bg-amber-500',
                        },
                        red: {
                          border: 'border-red-500/50',
                          bg: 'bg-red-500/15',
                          shadow: 'shadow-red-500/10',
                          badgeBg: 'bg-red-500/15',
                          badgeBorder: 'border-red-500/30',
                          badgeText: 'text-red-400',
                          dot: 'bg-red-500',
                        },
                      };
                      const c = colorMap[item.color];

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setLevel(item.id)}
                          className={`group rounded-xl border p-4 text-left transition-all duration-300 ${selected
                            ? `${c.border} ${c.bg} shadow-lg ${c.shadow}`
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${selected ? c.dot : 'bg-white/20'} transition-colors`} />
                              <h3 className={`font-semibold text-base ${selected ? 'text-white' : 'text-white/80'}`}>
                                {item.label}
                              </h3>
                            </div>
                            <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-md border ${selected
                              ? `${c.badgeText} ${c.badgeBg} ${c.badgeBorder}`
                              : 'text-white/35 bg-white/5 border-white/10'
                              }`}>
                              {item.badge}
                            </span>
                          </div>
                          <p className={`text-sm leading-relaxed ${selected ? 'text-white/60' : 'text-white/40'}`}>
                            {item.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </FadeIn>

              {/* Step 3: Upload Image */}
              <FadeIn delay={450}>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-white/15 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                      <span className="text-sm font-bold text-violet-400">3</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-white">
                      Upload Image
                    </h2>
                  </div>

                  <label
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative block w-full min-h-70 sm:min-h-85 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${isDragging
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
                      }`}
                  >
                    {!preview ? (
                      <div className="h-full min-h-70 sm:min-h-85 flex flex-col items-center justify-center text-center px-6">
                        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-5">
                          <svg
                            className="w-8 h-8 text-white/40"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <p className="font-semibold text-white text-lg mb-2">
                          Drop your file here or click to browse
                        </p>
                        <p className="text-sm text-white/40">
                          JPEG, PNG, WebP up to 5 MB
                        </p>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="relative p-3 sm:p-4 h-full min-h-70 sm:min-h-85">
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-full h-full object-contain rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveImage();
                          }}
                          className="absolute top-5 right-5 rounded-full bg-red-500/80 backdrop-blur-sm text-white p-2 shadow-lg hover:bg-red-500 hover:scale-110 active:scale-95 transition-all duration-300"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </label>

                  {uploadError && (
                    <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      <p className="text-sm text-red-400">{uploadError}</p>
                    </div>
                  )}
                </div>
              </FadeIn>

              {/* Tips */}
              <FadeIn delay={500}>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-white">
                      Tips for Better Quality
                    </h3>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {[
                      'Use clear lighting and avoid dark shadows.',
                      'Keep the waste item centered in the frame.',
                      'Avoid blurry or low-resolution images.',
                      'Use files under 5 MB for faster upload.',
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-3 text-white/50">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            </div>

            {/* ── Right column: Summary ── */}
            <FadeIn delay={450} className="xl:sticky xl:top-28">
              <aside className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-white/15 transition-all duration-300">
                <h3 className="text-xl font-semibold text-white mb-5">
                  Submission Summary
                </h3>

                <div className="space-y-4">
                  {/* Category */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-1.5">
                      Category
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                        {selectedCategory?.tag}
                      </span>
                      <p className="font-semibold text-white">{selectedCategory?.label}</p>
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-1.5">
                      Difficulty
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold tracking-wider px-2 py-0.5 rounded-md border ${selectedLevel?.color === 'emerald'
                        ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
                        : selectedLevel?.color === 'amber'
                          ? 'text-amber-400 bg-amber-500/15 border-amber-500/25'
                          : 'text-red-400 bg-red-500/15 border-red-500/25'
                        }`}>
                        {selectedLevel?.badge}
                      </span>
                      <p className="font-semibold text-white">{selectedLevel?.label}</p>
                    </div>
                  </div>

                  {/* Image File */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-1.5">
                      Image File
                    </p>
                    <p className="font-semibold text-white truncate" title={file?.name || 'No file selected'}>
                      {file ? file.name : lastUpload?.url ? 'Uploaded image available' : 'No file selected'}
                    </p>
                    {file && (
                      <p className="mt-1 text-xs text-white/40">{formatFileSize(file.size)}</p>
                    )}
                  </div>

                  {/* Upload Progress */}
                  {isSubmitting && uploadProgress > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-white/50">Uploading {uploadProgress}%</p>
                    </div>
                  )}

                  {/* Success State */}
                  {justSubmitted && lastUpload?.url && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-sm font-semibold text-emerald-400">Upload Successful</p>
                      </div>
                      <img
                        src={lastUpload.url}
                        alt="Uploaded waste"
                        className="w-full h-32 object-contain rounded-lg border border-white/10 bg-black/30"
                      />
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!file || isSubmitting || justSubmitted}
                  className={`mt-6 w-full rounded-xl py-3.5 font-semibold text-base transition-all duration-300 ${!file || isSubmitting || justSubmitted
                    ? 'bg-white/10 text-white/30 cursor-not-allowed border border-white/10'
                    : 'bg-white text-black hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] shadow-lg'
                    }`}
                >
                  {isSubmitting
                    ? uploadProgress > 0
                      ? `Uploading... ${uploadProgress}%`
                      : 'Submitting...'
                    : justSubmitted
                      ? 'Redirecting...'
                      : 'Submit Waste Data'}
                </button>
              </aside>
            </FadeIn>
          </div>
        </section>
      </div>
    </div>
  );
}

export default UploadWastePage;
