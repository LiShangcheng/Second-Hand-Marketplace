import React, { useMemo, useState, useEffect } from 'react';
import { Item } from '../types';
import { ArrowLeft, MapPin, Clock, ShieldCheck, MessageCircle, Heart } from 'lucide-react';

interface ItemDetailProps {
  item: Item;
  onBack: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onContactSeller: () => void;
}

const ItemDetail: React.FC<ItemDetailProps> = ({ item, onBack, isFavorite, onToggleFavorite, onContactSeller }) => {
  const images = useMemo(() => {
    if (item.images && item.images.length > 0) return item.images;
    return [item.imageUrl];
  }, [item.images, item.imageUrl]);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = images.length > 1;

  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in relative z-10">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-[#57068c] transition-colors mb-6 font-medium"
      >
        <ArrowLeft size={20} />
        Back to listings
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Images */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm aspect-[4/3] group relative p-4">
            <img 
              src={images[activeIndex]} 
              alt={`${item.title} image ${activeIndex + 1}`} 
              className="w-full h-full object-contain"
            />
            {hasMultiple && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 w-10 h-10 rounded-full shadow-md flex items-center justify-center"
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 w-10 h-10 rounded-full shadow-md flex items-center justify-center"
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            )}
          </div>
          {hasMultiple && (
            <div className="flex gap-2 pt-3 overflow-x-auto">
              {images.map((src, idx) => (
                <button
                  key={src}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-16 w-20 rounded-lg overflow-hidden border ${idx === activeIndex ? 'border-[#57068c]' : 'border-gray-200'}`}
                >
                  <img src={src} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <div>
                     <span className="inline-block px-3 py-1 rounded-full bg-purple-100 text-[#57068c] text-xs font-bold uppercase tracking-wide mb-2">
                        {item.category}
                    </span>
                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">{item.title}</h1>
                </div>
                <div className="flex gap-2">
                     <button
                        onClick={onToggleFavorite}
                        className={`p-2 rounded-full transition-colors cursor-pointer ${isFavorite ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                     >
                        <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} />
                     </button>
                </div>
            </div>

            <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-[#57068c]">${item.price}</span>
            </div>

            <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 text-gray-600">
                    <MapPin className="text-[#57068c]" size={20} />
                    <span className="font-medium">{item.location}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                    <Clock className="text-[#57068c]" size={20} />
                    <span>Posted {item.postedAt}</span>
                </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Description</h3>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {item.description}
                </p>
            </div>
          </div>

          {/* Seller Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Seller Information</h3>
            <div className="flex items-center gap-4 mb-6">
                <img src={item.seller.avatar} alt={item.seller.name} className="w-16 h-16 rounded-full border-2 border-purple-100" />
                <div>
                    <div className="font-bold text-lg text-gray-900">{item.seller.name}</div>
                    <div className="text-sm text-gray-500">Verified Student</div>
                </div>
            </div>
            <button 
                onClick={onContactSeller}
                className="w-full bg-[#57068c] text-white font-bold py-3 rounded-xl hover:bg-[#450470] transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
                <MessageCircle size={20} />
                Contact Seller
            </button>
          </div>

          {/* Safety Tips */}
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
            <div className="flex items-center gap-2 mb-3 text-blue-800 font-bold">
                <ShieldCheck size={20} />
                <span>Safety Tips</span>
            </div>
            <ul className="text-sm text-blue-700 space-y-2 list-disc list-inside">
                <li>Meet in public places like Bobst or Kimmel.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetail;
