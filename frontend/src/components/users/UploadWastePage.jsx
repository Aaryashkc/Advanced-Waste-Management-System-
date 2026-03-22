import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useUploadStore from '../../stores/useUploadStore';

const PROVINCES = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"];

const PROVINCE_DISTRICTS = {
  Koshi: ["Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga", "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung", "Terhathum", "Udayapur"],
  Madhesh: ["Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi", "Siraha"],
  Bagmati: ["Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok", "Lalitpur", "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok"],
  Gandaki: ["Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi", "Nawalparasi East", "Parbat", "Syangja", "Tanahun"],
  Lumbini: ["Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", "Kapilvastu", "Nawalparasi West", "Palpa", "Pyuthan", "Rolpa", "Rupandehi", "Rukum East"],
  Karnali: ["Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu", "Rukum West", "Salyan", "Surkhet", "Western Rukum"],
  Sudurpashchim: ["Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti", "Kailali", "Kanchanpur"],
};

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
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  useEffect(() => {
    if (uploadError) clearError();
  }, [uploadError, clearError]);

  const categories = [
    {
      id: 'recyclable',
      label: 'Recyclable',
      tag: 'RCY',
      description: 'Materials that can be processed and reused.',
    },
    {
      id: 'non-recyclable',
      label: 'Non-recyclable',
      tag: 'NON',
      description: 'Items that cannot be recycled safely.',
    },
    {
      id: 'both',
      label: 'Mixed',
      tag: 'MIX',
      description: 'Contains recyclable and non-recyclable items.',
    },
  ];

  const levels = [
    {
      id: 'easy',
      label: 'Easy',
      badge: 'L1',
      description: 'Light waste, under 1,000 kg.',
    },
    {
      id: 'medium',
      label: 'Medium',
      badge: 'L2',
      description: 'Moderate load, 1,000 – 5,000 kg.',
    },
    {
      id: 'hard',
      label: 'Hard',
      badge: 'L3',
      description: 'Heavy load, over 5,000 kg.',
    },
  ];

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === category),
    [category]
  );

  const selectedLevel = useMemo(
    () => levels.find((item) => item.id === level),
    [level]
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
    if (!province || !district) {
      alert('Please select your province and district');
      return;
    }
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
        // Pass upload metadata to Searching so it can attach to the pickup request
        navigate('/searching', {
          state: {
            wasteUploadId: payload?.id || null,
            category: payload?.category || category,
            level: payload?.level || level,
            province,
            district,
          },
        });
      }, 1500);
    } else {
      alert(result.error || 'Upload failed');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fcf8f1_0%,_#f3ebdf_45%,_#ecdfcb_100%)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <section className="bg-white/70 backdrop-blur-sm border border-[#354f52]/15 rounded-3xl p-6 sm:p-8 shadow-[0_18px_50px_rgba(53,79,82,0.12)] mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="inline-flex items-center rounded-full bg-[#296200]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#296200] uppercase">
                Waste Submission
              </p>
              <h1 className="mt-3 font-['Outfit',sans-serif] text-3xl sm:text-4xl font-semibold text-[#354f52] leading-tight">
                Upload and classify waste images
              </h1>
              <p className="mt-2 font-['Poppins',sans-serif] text-sm sm:text-base text-[#5d6c6e] max-w-2xl">
                Select category and difficulty, then upload a clear image for faster processing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/customer-dashboard')}
              className="self-start md:self-auto rounded-xl border border-[#354f52]/30 px-4 py-2 text-sm font-medium text-[#354f52] hover:bg-white transition"
            >
              Back to Dashboard
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 items-start">
          <div className="xl:col-span-2 space-y-6">
            <section className="rounded-2xl border border-[#354f52]/15 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="font-['Outfit',sans-serif] text-xl sm:text-2xl font-semibold text-[#354f52] mb-4">
                1. Waste category
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {categories.map((item) => {
                  const selected = category === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCategory(item.id)}
                      className={`rounded-xl border p-4 text-left transition-all ${selected
                          ? 'border-[#296200] bg-[#296200] text-white shadow-md'
                          : 'border-[#354f52]/20 bg-[#fdfcf9] text-[#354f52] hover:border-[#296200]/60 hover:bg-[#f6fbf2]'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold tracking-wider ${selected ? 'text-white/80' : 'text-[#296200]'}`}>
                          {item.tag}
                        </span>
                      </div>
                      <h3 className="font-semibold text-base">{item.label}</h3>
                      <p className={`mt-1 text-sm ${selected ? 'text-white/80' : 'text-[#5d6c6e]'}`}>
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[#354f52]/15 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="font-['Outfit',sans-serif] text-xl sm:text-2xl font-semibold text-[#354f52] mb-4">
                2. Difficulty level
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {levels.map((item) => {
                  const selected = level === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLevel(item.id)}
                      className={`rounded-xl border p-4 text-left transition-all ${selected
                          ? 'border-[#354f52] bg-[#354f52] text-white shadow-md'
                          : 'border-[#354f52]/20 bg-[#fdfcf9] text-[#354f52] hover:border-[#354f52]/60 hover:bg-[#f8f8f7]'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-base">{item.label}</h3>
                        <span className={`text-xs font-bold tracking-wider ${selected ? 'text-white/80' : 'text-[#296200]'}`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className={`text-sm ${selected ? 'text-white/80' : 'text-[#5d6c6e]'}`}>
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[#354f52]/15 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="font-['Outfit',sans-serif] text-xl sm:text-2xl font-semibold text-[#354f52] mb-4">
                3. Your location
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#354f52]/80 mb-1.5">Province *</label>
                  <select
                    value={province}
                    onChange={(e) => { setProvince(e.target.value); setDistrict(''); }}
                    className="w-full px-4 py-3 rounded-xl border border-[#354f52]/20 bg-white text-[#354f52] font-medium focus:outline-none focus:ring-2 focus:ring-[#296200] transition"
                  >
                    <option value="">Select Province...</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#354f52]/80 mb-1.5">District *</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    disabled={!province}
                    className="w-full px-4 py-3 rounded-xl border border-[#354f52]/20 bg-white text-[#354f52] font-medium focus:outline-none focus:ring-2 focus:ring-[#296200] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select District...</option>
                    {province && PROVINCE_DISTRICTS[province]?.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#354f52]/15 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="font-['Outfit',sans-serif] text-xl sm:text-2xl font-semibold text-[#354f52] mb-4">
                4. Upload image
              </h2>

              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative block w-full min-h-[280px] sm:min-h-[340px] rounded-2xl border-2 border-dashed cursor-pointer transition-all ${isDragging
                    ? 'border-[#296200] bg-[#f1f9e8]'
                    : 'border-[#354f52]/35 bg-[#fcfbf8] hover:border-[#296200]/70 hover:bg-[#f7fbf1]'
                  }`}
              >
                {!preview ? (
                  <div className="h-full min-h-[280px] sm:min-h-[340px] flex flex-col items-center justify-center text-center px-6">
                    <svg
                      className="w-14 h-14 text-[#296200] mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="font-semibold text-[#354f52] text-lg">Drop your file here or click to browse</p>
                    <p className="mt-2 text-sm text-[#5d6c6e]">JPEG, PNG, WebP up to 5MB</p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="relative p-3 sm:p-4 h-full min-h-[280px] sm:min-h-[340px]">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-contain rounded-xl bg-white"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveImage();
                      }}
                      className="absolute top-5 right-5 rounded-full bg-[#c23b3b] text-white p-2 shadow hover:bg-[#ab2f2f] transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </label>

              {uploadError && <p className="mt-4 text-sm text-red-600">{uploadError}</p>}
            </section>

            <section className="rounded-2xl border border-[#354f52]/15 bg-[linear-gradient(120deg,#f3f9ed,#f9f5ec)] p-5 sm:p-6 shadow-sm">
              <h3 className="font-['Outfit',sans-serif] text-lg sm:text-xl font-semibold text-[#354f52] mb-4">
                Tips for better image quality
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[#4f5f62]">
                <li className="flex items-start gap-2"><span className="text-[#296200]">+</span><span>Use clear lighting and avoid dark shadows.</span></li>
                <li className="flex items-start gap-2"><span className="text-[#296200]">+</span><span>Keep the waste item centered in the frame.</span></li>
                <li className="flex items-start gap-2"><span className="text-[#296200]">+</span><span>Avoid blurry or low-resolution images.</span></li>
                <li className="flex items-start gap-2"><span className="text-[#296200]">+</span><span>Use files under 5MB for faster upload.</span></li>
              </ul>
            </section>
          </div>

          <aside className="xl:sticky xl:top-6 rounded-2xl border border-[#354f52]/15 bg-white p-5 sm:p-6 shadow-sm">
            <h3 className="font-['Outfit',sans-serif] text-xl font-semibold text-[#354f52] mb-4">
              Submission summary
            </h3>

            <div className="space-y-4">
              <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#354f52]/10">
                <p className="text-xs uppercase tracking-wide text-[#5d6c6e] mb-1">Category</p>
                <p className="font-semibold text-[#354f52]">{selectedCategory?.label}</p>
              </div>

              <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#354f52]/10">
                <p className="text-xs uppercase tracking-wide text-[#5d6c6e] mb-1">Difficulty</p>
                <p className="font-semibold text-[#354f52]">{selectedLevel?.label}</p>
              </div>

              <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#354f52]/10">
                <p className="text-xs uppercase tracking-wide text-[#5d6c6e] mb-1">Location</p>
                <p className="font-semibold text-[#354f52]">{district || 'Not selected'}{province ? `, ${province}` : ''}</p>
              </div>

              <div className="rounded-xl bg-[#f7f5ef] p-4 border border-[#354f52]/10">
                <p className="text-xs uppercase tracking-wide text-[#5d6c6e] mb-1">Image file</p>
                <p className="font-semibold text-[#354f52] truncate" title={file?.name || 'No file selected'}>
                  {file ? file.name : lastUpload?.url ? 'Uploaded image available' : 'No file selected'}
                </p>
                {file && <p className="mt-1 text-xs text-[#5d6c6e]">{formatFileSize(file.size)}</p>}
              </div>

              {isSubmitting && uploadProgress > 0 && (
                <div className="rounded-xl border border-[#354f52]/10 p-4">
                  <div className="h-2 rounded-full bg-[#354f52]/15 overflow-hidden">
                    <div
                      className="h-full bg-[#296200] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-[#5d6c6e]">Uploading {uploadProgress}%</p>
                </div>
              )}

              {justSubmitted && lastUpload?.url && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">Upload successful</p>
                  <img
                    src={lastUpload.url}
                    alt="Uploaded waste"
                    className="w-full h-32 object-contain rounded-lg border border-green-200 bg-white"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || !province || !district || isSubmitting || justSubmitted}
              className={`mt-6 w-full rounded-xl py-3.5 font-semibold text-base transition-all ${!file || !province || !district || isSubmitting || justSubmitted
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#296200] text-white hover:bg-[#245400] shadow-md'
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
        </div>
      </div>
    </div>
  );
}

export default UploadWastePage;
