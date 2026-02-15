import React from 'react';
import { CATEGORIES } from '../constants';
import { Category } from '../types';
import { MapPin, ChevronDown } from 'lucide-react';

interface FilterBarProps {
  selectedCategory: Category;
  onSelectCategory: (category: Category) => void;
  selectedLocation: string;
  onSelectLocation: (location: string) => void;
  availableLocations: string[];
}

const FilterBar: React.FC<FilterBarProps> = ({ 
  selectedCategory, 
  onSelectCategory,
  selectedLocation,
  onSelectLocation,
  availableLocations
}) => {
  return (
    <div className="sticky top-16 bg-white/90 backdrop-blur-md z-40 border-b border-gray-200 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between h-16 gap-4">
            
          {/* Categories - Horizontal Scroll */}
          <div className="flex-1 overflow-x-auto no-scrollbar mask-linear-fade">
            <div className="flex items-center space-x-2 pr-4">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => onSelectCategory(category)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                    selectedCategory === category
                      ? 'bg-[#57068c] text-white border-[#57068c] shadow-md'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Location Filter - Fixed on Right */}
          <div className="shrink-0 relative border-l border-gray-200 pl-4 ml-2">
             <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <MapPin size={16} />
                </div>
                <select 
                    value={selectedLocation}
                    onChange={(e) => onSelectLocation(e.target.value)}
                    className="appearance-none bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium py-2 pl-9 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#57068c] focus:border-transparent transition-all w-40 md:w-48 truncate"
                >
                    {availableLocations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown size={14} />
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FilterBar;
