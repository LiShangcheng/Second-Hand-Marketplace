import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, DollarSign, MapPin, Tag, Image as ImageIcon } from 'lucide-react';
import { CATEGORIES, MEETUP_LOCATIONS } from '../constants';

interface PostItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { id: string } | null;
  mode?: 'create' | 'edit';
  initialValues?: {
    title: string;
    price: number;
    category: string;
    location: string;
    description: string;
  };
  initialImageUrls?: string[];
  onSubmit: (payload: {
    title: string;
    price: number;
    category: string;
    location: string;
    description: string;
    images: File[];
  }) => Promise<void>;
}

const PostItemModal: React.FC<PostItemModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubmit,
  mode = 'create',
  initialValues,
  initialImageUrls,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState(MEETUP_LOCATIONS[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (mode === 'edit' && initialValues) {
        setTitle(initialValues.title);
        setPrice(String(initialValues.price));
        setCategory(initialValues.category);
        setLocation(initialValues.location);
        setDescription(initialValues.description);
        setFiles([]);
        setExistingImages(initialImageUrls || []);
      }
    }
  }, [isOpen, mode, initialValues, initialImageUrls]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) {
      setFiles((prev) => [...prev, ...dropped]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);
    setSubmitting(true);
    try {
      const numericPrice = Number(price);
      if (!title.trim() || !category || Number.isNaN(numericPrice) || numericPrice <= 0) {
        setError('Please provide a title, category, and valid price.');
        setSubmitting(false);
        return;
      }
      await onSubmit({
        title: title.trim(),
        price: numericPrice,
        category,
        location,
        description: description.trim(),
        images: files,
      });
      if (mode === 'create') {
        setTitle('');
        setPrice('');
        setCategory('');
        setLocation(MEETUP_LOCATIONS[0]);
        setDescription('');
        setFiles([]);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to post item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col no-scrollbar">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-8 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{mode === 'edit' ? 'Edit Item' : 'List an Item'}</h2>
            <p className="text-sm text-gray-500">
              {mode === 'edit' ? 'Update the details for your listing' : 'Fill in the details to sell your item'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* Section: Photos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-gray-900">Photos</label>
              {mode === 'edit' && (
                <span className="text-xs text-gray-500">Uploading new images will replace existing photos.</span>
              )}
            </div>
            <div 
                className={`group relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                    dragActive 
                    ? 'border-[#57068c] bg-purple-50 scale-[0.99]' 
                    : 'border-gray-300 hover:border-[#57068c] hover:bg-gray-50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="flex flex-col items-center gap-4 transition-transform group-hover:translate-y-[-2px]">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-[#57068c] group-hover:scale-110 transition-transform">
                        <Upload size={28} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 text-lg">{mode === 'edit' ? 'Replace photos' : 'Drag & drop photos here'}</p>
                        <p className="text-sm text-gray-500 mt-1">or click to browse from your device</p>
                    </div>
                    <p className="text-xs text-gray-400">Supports JPG, PNG, WEBP (Max 5MB)</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const selected = Array.from(e.target.files || []);
                          if (selected.length > 0) {
                            setFiles((prev) => [...prev, ...selected]);
                          }
                          e.target.value = '';
                        }}
                    />
                </div>
            </div>
            {/* Preview Thumbnails */}
            {previews.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {previews.map((src, idx) => (
                  <div key={src} className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200 relative">
                    <img src={src} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : existingImages.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {existingImages.map((src, idx) => (
                  <div key={src} className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200 relative">
                    <img src={src} alt={`Current ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 shrink-0 border border-gray-200">
                  <ImageIcon size={20} />
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100"></div>

          {/* Section: Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-2">
                <label className="block text-sm font-bold text-gray-900">Title</label>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="What are you selling? (e.g. Calculus Textbook)"
                        className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all font-medium"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">Price</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <DollarSign size={18} className="text-gray-500" />
                    </div>
                    <input
                        type="number"
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all font-medium"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">Category</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Tag size={18} className="text-gray-500" />
                    </div>
                    <select
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all font-medium appearance-none cursor-pointer"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        required
                    >
                        <option value="" disabled>Select Category</option>
                        {CATEGORIES.filter(c => c !== 'All').map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

             <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="block text-sm font-bold text-gray-900">Location</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin size={18} className="text-gray-500" />
                    </div>
                    <select
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all font-medium appearance-none cursor-pointer"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    >
                        {MEETUP_LOCATIONS.map((spot) => (
                          <option key={spot} value={spot}>
                            {spot}
                          </option>
                        ))}
                    </select>
                </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">Description</label>
            <div className="relative">
                <textarea 
                    rows={5} 
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none transition-all resize-none font-medium" 
                    placeholder="Describe the condition, features, and reason for selling..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                ></textarea>
                <div className="absolute bottom-3 right-3 text-xs text-gray-400">{description.length}/500</div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 flex gap-3 justify-end rounded-b-3xl">
            <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !currentUser}
              className={`px-8 py-3 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-95 ${
                submitting || !currentUser ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#57068c] text-white hover:bg-[#450470]'
              }`}
            >
                {mode === 'edit' ? 'Save Changes' : 'Post Item'}
            </button>
        </div>
        </form>

      </div>
    </div>
  );
};

export default PostItemModal;
