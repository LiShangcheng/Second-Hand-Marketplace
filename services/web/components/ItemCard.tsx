import React from 'react';
import { Item } from '../types';
import { MapPin, Clock } from 'lucide-react';

interface ItemCardProps {
  item: Item;
  onClick: (item: Item) => void;
  /** Optional status to override the item's default status display */
  status?: 'active' | 'sold';
  /** Optional footer content (e.g., buttons) to render at the bottom of the card */
  footer?: React.ReactNode;
  /** Disable click interactions (e.g., sold preview on home feed). */
  isClickable?: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onClick,
  status = item.status || 'active',
  footer,
  isClickable = true,
}) => {
  const isSold = status === 'sold';

  return (
    <div 
      onClick={() => {
        if (!isClickable) return;
        onClick(item);
      }}
      className={`${isSold ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'} rounded-xl shadow-sm transition-all duration-300 border overflow-hidden group flex flex-col h-full relative ${
        isClickable ? 'cursor-pointer hover:shadow-xl' : 'cursor-default'
      } ${isSold ? 'opacity-90' : ''}`}
    >
      {/* Image Container */}
      <div className="relative h-52 overflow-hidden bg-gray-200">
        <img
          src={item.imageUrl}
          alt={item.title}
          loading="lazy"
          className={`w-full h-full object-cover transform transition-transform duration-500 ${isSold ? 'grayscale' : 'group-hover:scale-110'}`}
        />
        
        {/* Status Badge (Top Left) */}
        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold shadow-sm uppercase tracking-wider backdrop-blur-md ${
            isSold 
            ? 'bg-gray-800/90 text-white' 
            : 'bg-green-500/90 text-white'
        }`}>
            {isSold ? 'Sold Out' : 'Active'}
        </div>

        {/* Category Badge (Bottom Left of Image) */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
            <span className="text-white text-xs font-medium px-2 py-1 bg-[#57068c]/80 rounded-md backdrop-blur-sm">
                {item.category}
            </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col min-h-[170px]">
        <h3 className={`font-semibold text-lg mb-1 line-clamp-1 transition-colors ${isSold ? 'text-gray-500 line-through' : 'text-gray-900 group-hover:text-[#57068c]'}`}>
          {item.title}
        </h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-1">
          {item.description}
        </p>

        {/* Meta Info */}
        <div className="space-y-2 text-xs text-gray-500 mb-4 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1">
            <MapPin size={14} className="text-gray-400" />
            <span>{item.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={14} className="text-gray-400" />
            <span>{item.postedAt}</span>
          </div>
        </div>

        {/* Seller Info (Only show if no footer is present, otherwise space might get tight) */}
        {!footer && (
            <div className="flex items-center gap-3">
            <img
                src={item.seller.avatar}
                alt={item.seller.name}
                className="w-8 h-8 rounded-full border border-gray-200"
            />
            <span className="text-sm font-medium text-gray-700 hover:underline">
                {item.seller.name}
            </span>
            <span className="ml-auto bg-purple-50 text-[#57068c] px-2.5 py-1 rounded-full text-sm font-bold">
                ${item.price}
            </span>
            </div>
        )}
      </div>

      {/* Footer / Actions Area */}
      {footer && (
          <div 
            className="p-3 border-t border-gray-100 bg-gray-50"
            onClick={(e) => e.stopPropagation()} // Prevent card click when clicking footer buttons
          >
              {footer}
          </div>
      )}
    </div>
  );
};

export default ItemCard;
