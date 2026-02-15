import React, { useState, useEffect, useRef } from 'react';
import { User, Item, ViewState } from '../types';
import ItemCard from './ItemCard';
import { Settings, LogOut, Package, Heart, MessageCircle, Edit3, CheckCircle, RotateCcw, Pencil } from 'lucide-react';

interface ProfileProps {
  user?: User; // Optional while user session is loading
  myListings: Item[];
  savedItems: Item[];
  onItemClick: (item: Item) => void;
  onNavigate: (view: ViewState) => void;
  onOpenPost: () => void;
  onToggleStatus: (itemId: string, status: 'active' | 'sold') => Promise<void>;
  onEditItem: (item: Item) => void;
  onSignOut: () => Promise<void>;
  onUpdateProfile: (payload: { nickname: string; email: string; password?: string }) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
}

const Profile: React.FC<ProfileProps> = ({
  user,
  myListings,
  savedItems,
  onItemClick,
  onNavigate,
  onOpenPost,
  onToggleStatus,
  onEditItem,
  onSignOut,
  onUpdateProfile,
  onUploadAvatar,
}) => {
  const currentUser = user ?? {
    name: "Alex Kim",
    email: "alex.kim@nyu.edu",
    avatar: "https://picsum.photos/id/75/150/150",
    joinDate: "September 2023"
  };

  const [activeTab, setActiveTab] = useState<'listings' | 'saved'>('listings');
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const joinDateLabel = currentUser.joinDate ?? 'Recently';

  const [myItems, setMyItems] = useState<Item[]>(myListings);

  useEffect(() => {
    setMyItems(myListings);
  }, [myListings]);

  useEffect(() => {
    setNickname(currentUser.name);
    setEmail(currentUser.email);
  }, [currentUser.name, currentUser.email]);

  const toggleItemStatus = async (itemId: string) => {
    const target = myItems.find(item => item.id === itemId);
    if (!target) return;
    const newStatus = target.status === 'active' ? 'sold' : 'active';
    setMyItems(prev => prev.map(item => (item.id === itemId ? { ...item, status: newStatus } : item)));
    await onToggleStatus(itemId, newStatus);
  };

  const handleAvatarPick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError(null);
    try {
      await onUploadAvatar(file);
    } catch (err: any) {
      setProfileError(err?.message || 'Avatar upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const handleProfileSave = async () => {
    if (!nickname.trim() || !email.trim()) {
      setProfileError('Name and email are required.');
      return;
    }
    if (password || confirmPassword) {
      if (!password.trim() || !confirmPassword.trim()) {
        setProfileError('Please confirm your new password.');
        return;
      }
      if (password !== confirmPassword) {
        setProfileError('Passwords do not match.');
        return;
      }
    }
    setProfileError(null);
    setProfileSaving(true);
    try {
      await onUpdateProfile({
        nickname: nickname.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
      });
      setIsEditing(false);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setProfileError(err?.message || 'Profile update failed.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="bg-gray-50">
      {/* Header Container */}
      <div className="relative bg-white shadow-sm pb-8 z-20">
        {/* Background Banner */}
        <div className="h-40 w-full bg-[#57068c] overflow-hidden relative">
             <div className="absolute inset-0 opacity-20">
                <svg width="100%" height="100%">
                    <pattern id="p-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#p-grid)" />
                </svg>
             </div>
             {/* Gradient overlay */}
             <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
        </div>

        {/* Profile Info Content - Overlapping the banner */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 -mt-16">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
                
                {/* Avatar with Ring */}
                <div className="relative shrink-0 group">
                    <div className="w-36 h-36 rounded-full border-[6px] border-white bg-white shadow-lg overflow-hidden">
                        <img 
                            src={currentUser.avatar} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <button
                        onClick={handleAvatarPick}
                        className="absolute bottom-2 right-2 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border border-white shadow-sm transition-colors cursor-pointer z-20"
                    >
                        <Settings size={18} />
                    </button>
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                    />
                </div>

                {/* User Details */}
                <div className="flex-1 md:mb-4 pt-2 md:pt-0">
                    <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">{currentUser.name}</h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-gray-600 mt-1 text-sm font-medium">
                        <span className="bg-purple-100 text-[#57068c] px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">Student</span>
                        <span>{currentUser.email}</span>
                        <span className="hidden sm:inline text-gray-300">•</span>
                        <span className="text-gray-500">Joined {joinDateLabel}</span>
                    </div>
                    {profileError && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3 max-w-md">
                            {profileError}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 md:mb-4 w-full md:w-auto mt-4 md:mt-0">
                     <button
                        onClick={() => setIsEditing(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm active:scale-95 cursor-pointer"
                     >
                        <Edit3 size={18} />
                        <span>Edit Profile</span>
                     </button>
                     <button
                        onClick={() => void onSignOut()}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-semibold hover:bg-red-100 hover:border-red-200 transition-all shadow-sm active:scale-95 cursor-pointer"
                     >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                     </button>
                </div>
            </div>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setProfileError(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Name</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#57068c] focus:border-transparent outline-none"
                />
              </div>
              {profileError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {profileError}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setProfileError(null);
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleProfileSave}
                disabled={profileSaving}
                className={`px-5 py-2 rounded-lg font-semibold ${
                  profileSaving ? 'bg-gray-200 text-gray-500' : 'bg-[#57068c] text-white hover:bg-[#450470]'
                }`}
              >
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Left Sidebar Menu */}
            <div className="md:col-span-3 lg:col-span-3 space-y-1 md:mt-0">
                <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 relative z-20">
                    <button 
                        onClick={() => setActiveTab('listings')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                            activeTab === 'listings' 
                            ? 'bg-purple-50 text-[#57068c]' 
                            : 'bg-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <Package size={20} />
                        My Listings
                    </button>
                    <button 
                        onClick={() => setActiveTab('saved')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                            activeTab === 'saved' 
                            ? 'bg-purple-50 text-[#57068c]' 
                            : 'bg-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <Heart size={20} />
                        Saved Items
                    </button>
                    <button 
                        onClick={() => onNavigate('messages')}
                        className="w-full text-left px-4 py-3 bg-transparent rounded-xl font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all flex items-center gap-3 cursor-pointer active:scale-[0.98]"
                    >
                        <MessageCircle size={20} />
                        Messages
                    </button>
                </div>
            </div>

            {/* Right Content */}
            <div className="md:col-span-9 lg:col-span-9">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                        {activeTab === 'listings' ? 'Active Listings' : 'Saved Items'}
                    </h2>
                    {activeTab === 'listings' && (
                        <button 
                            onClick={onOpenPost}
                            className="text-sm bg-[#57068c] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#450470] transition-colors shadow-sm"
                        >
                            + Post New Item
                        </button>
                    )}
                </div>

                {activeTab === 'listings' ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myItems.map((item) => (
                            <ItemCard 
                                key={item.id} 
                                item={item} 
                                onClick={onItemClick}
                                status={item.status} // Pass the dynamic status
                                footer={
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onEditItem(item)}
                                            className="flex-1 py-2 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all bg-purple-50 text-[#57068c] hover:bg-purple-100 border border-purple-100"
                                        >
                                            <Pencil size={16} />
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => toggleItemStatus(item.id)}
                                            className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                                item.status === 'sold'
                                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                            }`}
                                        >
                                            {item.status === 'sold' ? (
                                                <>
                                                    <RotateCcw size={16} />
                                                    Relist
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle size={16} />
                                                    Sold
                                                </>
                                            )}
                                        </button>
                                    </div>
                                }
                            />
                        ))}
                     </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {savedItems.map((item) => (
                            <ItemCard 
                                key={item.id} 
                                item={item} 
                                onClick={onItemClick}
                            />
                        ))}
                    </div>
                )}

                {/* Empty States */}
                {activeTab === 'listings' && myItems.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                        <Package size={48} className="mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No listings yet</h3>
                        <p className="text-gray-500 mb-4">You haven't posted any items for sale.</p>
                        <button onClick={onOpenPost} className="text-[#57068c] font-bold hover:underline">Start Selling</button>
                    </div>
                )}
                
                {activeTab === 'saved' && savedItems.length === 0 && (
                     <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                        <Heart size={48} className="mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No saved items</h3>
                        <p className="text-gray-500">Items you heart will appear here.</p>
                    </div>
                )}

            </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
