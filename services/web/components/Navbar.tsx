import React from 'react';
import { Search, PlusCircle, User as UserIcon, LogIn, Menu, MessageCircle } from 'lucide-react';
import { User, ViewState } from '../types';

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenPost: () => void;
  isLoggedIn: boolean;
  onSearch: (query: string) => void;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  unreadCount: number;
  currentUser: User | null;
}

const Navbar: React.FC<NavbarProps> = ({ 
  onOpenAuth, 
  onOpenPost, 
  isLoggedIn, 
  onSearch,
  onNavigate,
  unreadCount,
  currentUser
}) => {
  return (
    <nav className="bg-[#57068c] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="bg-white p-1 rounded-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#57068c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
            </div>
            <span className="font-bold text-xl tracking-tight">NYU Swap Hub</span>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full text-gray-600">
              <input
                type="text"
                className="w-full bg-white h-10 px-5 pr-10 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 transition-shadow"
                placeholder="Search textbooks, furniture, etc..."
                onChange={(e) => onSearch(e.target.value)}
              />
              <button type="submit" className="absolute right-0 top-0 mt-2 mr-3">
                <Search size={20} className="text-[#57068c]" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <button
                  onClick={onOpenPost}
                  className="hidden md:flex items-center gap-2 bg-white text-[#57068c] px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition-colors"
                >
                  <PlusCircle size={18} />
                  <span>Sell Item</span>
                </button>
                
                <button 
                  onClick={() => onNavigate('messages')}
                  className="relative text-white hover:bg-white/10 p-2 rounded-full transition-colors"
                >
                    <MessageCircle size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[#57068c] flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                </button>

                <div 
                  onClick={() => onNavigate('profile')}
                  className="h-8 w-8 rounded-full bg-purple-400 border-2 border-white flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                >
                  {currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={18} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onOpenAuth('login')}
                  className="text-white hover:text-gray-200 font-medium px-3 py-2 rounded-md transition-colors"
                >
                  Log In
                </button>
                <button
                  onClick={() => onOpenAuth('register')}
                  className="bg-white text-[#57068c] px-4 py-2 rounded-md font-semibold hover:bg-gray-100 transition-all shadow-sm"
                >
                  Sign Up
                </button>
              </div>
            )}
            
            {/* Mobile Menu Button - simplified */}
            <button className="md:hidden text-white p-2">
                <Menu size={24} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
