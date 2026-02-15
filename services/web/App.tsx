import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FilterBar from './components/FilterBar';
import ItemCard from './components/ItemCard';
import PostItemModal from './components/PostItemModal';
import AuthModal from './components/AuthModal';
import ItemDetail from './components/ItemDetail';
import Profile from './components/Profile';
import Messages from './components/Messages';
import { Category, Item, AuthState, ViewState, User } from './types';
import { CAMPUS_LOCATIONS } from './constants';
import {
  fetchListings,
  toItem,
  registerUser,
  loginUser,
  createListing,
  createListingWithImages,
  fetchUserListings,
  fetchFavorites,
  updateListingStatus,
  updateListingDetails,
  updateListingWithImages,
  addFavorite,
  removeFavorite,
  fetchThreads,
  createThread,
  fetchMessages,
  sendMessage,
  fetchUnreadCount,
  updateUser,
  uploadAvatar,
  fetchUser,
  toUser,
  ApiThread,
  clearPresence,
} from './api';

const USER_STORAGE_KEY = 'nyu_swap_user';
const TOKEN_STORAGE_KEY = 'nyu_swap_token';
const SOLD_GRACE_DAYS = 3;

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [previousView, setPreviousView] = useState<ViewState>('home'); // Track history
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All Locations');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [auth, setAuth] = useState<AuthState>({ isOpen: false, mode: 'login' });
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [myListings, setMyListings] = useState<Item[]>([]);
  const [savedItems, setSavedItems] = useState<Item[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [pendingThread, setPendingThread] = useState<ApiThread | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const isLoggedIn = Boolean(currentUser);

  // Extract unique locations for the filter dropdown
  const locations = useMemo(() => {
    return [...CAMPUS_LOCATIONS];
  }, []);

  // Filter Logic
  const filteredItems = useMemo(() => {
    const brooklynHits = ['tandon', 'metrotech', 'dibner', 'rogers', 'brooklyn', 'othmer', 'jersey'];
    const campusForLocation = (value: string) => {
      const lower = value.toLowerCase();
      if (brooklynHits.some((hit) => lower.includes(hit))) return 'Brooklyn Campus';
      return 'Washington Square Campus';
    };
    const isRecentSold = (item: Item) => {
      if (item.status !== 'sold') return false;
      const source = item.soldAt || item.createdAt;
      if (!source) return false;
      const timestamp = new Date(source).getTime();
      if (Number.isNaN(timestamp)) return false;
      const diffMs = Date.now() - timestamp;
      return diffMs <= SOLD_GRACE_DAYS * 24 * 60 * 60 * 1000;
    };
    return items.filter((item) => {
      if (item.status === 'sold' && !isRecentSold(item)) return false;
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation =
        selectedLocation === 'All Locations' ||
        campusForLocation(item.location) === selectedLocation;
      return matchesCategory && matchesSearch && matchesLocation;
    });
  }, [items, selectedCategory, searchQuery, selectedLocation]);

  const loadListings = useCallback(async () => {
    setLoadingItems(true);
    setItemError(null);
    try {
      const apiListings = await fetchListings({
        status: 'all',
      });
      setItems(apiListings.map(toItem));
    } catch (err: any) {
      setItemError(err?.message || 'Failed to load listings.');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const refreshUserData = useCallback(async (user: User | null) => {
    if (!user) {
      setFavoriteIds([]);
      setMyListings([]);
      setSavedItems([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [userListings, favorites, unread] = await Promise.all([
        fetchUserListings(user.id, 'all'),
        fetchFavorites(user.id),
        fetchUnreadCount(user.id),
      ]);
      setMyListings(userListings.map(toItem));
      setSavedItems(favorites.favorites.map(toItem));
      setFavoriteIds(favorites.favorite_ids || []);
      setUnreadCount(unread);
    } catch {
      // ignore user refresh errors
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    refreshUserData(currentUser);
  }, [currentUser, refreshUserData]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const raw = localStorage.getItem(USER_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as User;
        if (!parsed?.id) return;
        const fresh = await fetchUser(parsed.id);
        setCurrentUser(toUser(fresh));
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const syncUser = (list: Item[]) =>
      list.map((item) =>
        item.seller.id === currentUser.id
          ? { ...item, seller: { ...item.seller, name: currentUser.name, avatar: currentUser.avatar } }
          : item
      );
    setItems((prev) => syncUser(prev));
    setMyListings((prev) => syncUser(prev));
    setSavedItems((prev) => syncUser(prev));
  }, [currentUser]);

  // Handlers
  const handleAuthOpen = (mode: 'login' | 'register') => {
    setAuth({ isOpen: true, mode });
  };

  const handlePostOpen = () => {
    if (!currentUser) {
      handleAuthOpen('login');
    } else {
      setIsPostModalOpen(true);
    }
  };

  const handleEditOpen = (item: Item) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
    setPreviousView(currentView);
    setCurrentView('item-detail');
    window.scrollTo(0, 0);
  };

  const handleNavigate = (view: ViewState) => {
    if ((view === 'profile' || view === 'messages') && !currentUser) {
        handleAuthOpen('login');
        return;
    }
    // Only update previous view if we are actually changing views
    if (view !== currentView) {
        setPreviousView(currentView);
        setCurrentView(view);
    }
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
      setCurrentView(previousView);
      window.scrollTo(0, 0);
  }

  // Render content based on current view
  const renderContent = () => {
    switch (currentView) {
        case 'messages':
            return (
                <Messages
                    onBack={handleBack}
                    currentUser={currentUser}
                    activeThreadId={activeThreadId}
                    onThreadOpen={(threadId) => setActiveThreadId(threadId)}
                    pendingThread={pendingThread}
                    onFetchThreads={async () => {
                        if (!currentUser) return [];
                        return fetchThreads(currentUser.id);
                    }}
                    onFetchMessages={async (threadId) => {
                        if (!currentUser) return [];
                        return fetchMessages(threadId, currentUser.id);
                    }}
                    onSendMessage={async (threadId, content) => {
                        if (!currentUser) return;
                        await sendMessage({ thread_id: threadId, sender_id: currentUser.id, content });
                    }}
                    onUnreadUpdate={async () => {
                        if (!currentUser) return;
                        const count = await fetchUnreadCount(currentUser.id);
                        setUnreadCount(count);
                    }}
                />
            );

        case 'item-detail':
            if (!selectedItem) return null;
            return (
                <ItemDetail 
                    item={selectedItem} 
                    onBack={() => {
                        setPreviousView('home');
                        setCurrentView('home');
                    }} 
                    isFavorite={favoriteIds.includes(selectedItem.id)}
                    onToggleFavorite={async () => {
                        if (!currentUser) {
                            handleAuthOpen('login');
                            return;
                        }
                        const isFav = favoriteIds.includes(selectedItem.id);
                        if (isFav) {
                            await removeFavorite({ user_id: currentUser.id, listing_id: selectedItem.id });
                        } else {
                            await addFavorite({ user_id: currentUser.id, listing_id: selectedItem.id });
                        }
                        await refreshUserData(currentUser);
                    }}
                    onContactSeller={async () => {
                        if (!currentUser) {
                            handleAuthOpen('login');
                            return;
                        }
                        const sellerId = selectedItem.seller.id || '';
                        if (!sellerId || sellerId === currentUser.id) {
                            setCurrentView('messages');
                            return;
                        }
                        const thread = await createThread({
                            buyer_id: currentUser.id,
                            seller_id: sellerId,
                            listing_id: selectedItem.id,
                            buyer_name: currentUser.name,
                            seller_name: selectedItem.seller.name,
                        });
                        setPendingThread(thread);
                        setActiveThreadId(thread.id);
                        setCurrentView('messages');
                    }}
                />
            );
        
        case 'profile':
            return (
                <Profile 
                    user={currentUser ?? undefined}
                    myListings={myListings}
                    savedItems={savedItems}
                    onItemClick={handleItemClick}
                    onNavigate={handleNavigate}
                    onOpenPost={handlePostOpen}
                    onSignOut={async () => {
                        if (currentUser) {
                            await clearPresence(currentUser.id);
                        }
                        setCurrentUser(null);
                        setActiveThreadId(null);
                        setCurrentView('home');
                    }}
                    onEditItem={handleEditOpen}
                    onUpdateProfile={async ({ nickname, email, password }) => {
                        if (!currentUser) return;
                        const updated = await updateUser({
                            userId: currentUser.id,
                            nickname,
                            email,
                            password,
                        });
                        setCurrentUser((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      name: updated.nickname || prev.name,
                                      email: updated.email || prev.email,
                                  }
                                : prev
                        );
                    }}
                    onUploadAvatar={async (file) => {
                        if (!currentUser) return;
                        const updated = await uploadAvatar({ userId: currentUser.id, file });
                        setCurrentUser((prev) => (prev ? { ...prev, avatar: updated.avatar || prev.avatar } : prev));
                    }}
                    onToggleStatus={async (itemId, status) => {
                        if (!currentUser) return;
                        await updateListingStatus({
                            listingId: itemId,
                            userId: currentUser.id,
                            status,
                        });
                        await refreshUserData(currentUser);
                        await loadListings();
                    }}
                />
            );

        case 'home':
        default:
            return (
                <>
                    <Hero />
                    <FilterBar 
                        selectedCategory={selectedCategory} 
                        onSelectCategory={setSelectedCategory} 
                        selectedLocation={selectedLocation}
                        onSelectLocation={setSelectedLocation}
                        availableLocations={locations}
                    />
                    <main className={`max-w-7xl mx-auto px-8 sm:px-10 lg:px-12 py-8 ${isLoggedIn ? 'pb-20' : ''}`}>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {selectedCategory === 'All' ? 'Latest Listings' : `${selectedCategory}`}
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found {selectedLocation !== 'All Locations' && `in ${selectedLocation}`}
                            </p>
                        </div>

                        {itemError ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
                                {itemError}
                            </div>
                        ) : loadingItems ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <div key={`skeleton-${idx}`} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                                        <div className="h-52 bg-gray-200"></div>
                                        <div className="p-4 space-y-3">
                                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                            <div className="h-3 bg-gray-100 rounded w-full"></div>
                                            <div className="h-3 bg-gray-100 rounded w-5/6"></div>
                                            <div className="h-3 bg-gray-100 rounded w-1/2 mt-4"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredItems.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {filteredItems.map((item) => {
                                    const isSoldPreview = item.status === 'sold';
                                    return (
                                    <ItemCard 
                                        key={item.id} 
                                        item={item} 
                                        onClick={handleItemClick}
                                        status={item.status}
                                        isClickable={!isSoldPreview}
                                    />
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mx-auto w-full max-w-2xl aspect-[3/2] p-8 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-dashed border-gray-300">
                                <div className="inline-block p-4 rounded-full bg-gray-50 mb-4">
                                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">No results found</h3>
                                <p className="text-gray-500 max-w-sm mx-auto mt-2">We couldn't find any items matching your filters. Try clearing the location or searching for something else.</p>
                                <button 
                                    onClick={() => { setSelectedCategory('All'); setSelectedLocation('All Locations'); setSearchQuery(''); }}
                                    className="mt-4 text-[#57068c] font-medium hover:underline"
                                >
                                    Clear all filters
                                </button>
                            </div>
                        )}
                    </main>
                </>
            );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
      <Navbar 
        onOpenAuth={handleAuthOpen} 
        onOpenPost={handlePostOpen} 
        isLoggedIn={isLoggedIn}
        onSearch={setSearchQuery}
        currentView={currentView}
        onNavigate={handleNavigate}
        unreadCount={unreadCount}
        currentUser={currentUser}
      />
      
      {renderContent()}

      {/* Floating Action Button for Mobile */}
      {isLoggedIn && currentView === 'home' && (
        <button 
          onClick={handlePostOpen}
          className="md:hidden fixed bottom-6 right-6 bg-[#57068c] text-white p-4 rounded-full shadow-lg hover:bg-[#450470] transition-colors z-40"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      )}

      {/* Footer - only show on home or profile */}
      <footer className="mt-auto">
        <div className="w-full px-6 py-2 text-center text-gray-500 text-sm bg-white border-t border-gray-200">
            <p>&copy; {new Date().getFullYear()} NYU Swap Hub. Student-run project. Not officially affiliated with NYU.</p>
        </div>
      </footer>

      {/* Modals */}
      <PostItemModal 
        isOpen={isPostModalOpen} 
        onClose={() => setIsPostModalOpen(false)}
        currentUser={currentUser}
        onSubmit={async (payload) => {
          if (!currentUser) return;
          if (payload.images.length > 0) {
            await createListingWithImages({
              title: payload.title,
              price: payload.price,
              category: payload.category,
              description: payload.description,
              meetup_point: payload.location,
              user_id: currentUser.id,
              images: payload.images,
            });
          } else {
            await createListing({
              title: payload.title,
              price: payload.price,
              category: payload.category,
              description: payload.description,
              meetup_point: payload.location,
              user_id: currentUser.id,
            });
          }
          await loadListings();
          await refreshUserData(currentUser);
        }}
      />

      <PostItemModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        currentUser={currentUser}
        mode="edit"
        initialValues={
          editingItem
            ? {
                title: editingItem.title,
                price: editingItem.price,
                category: editingItem.category,
                location: editingItem.location,
                description: editingItem.description,
              }
            : undefined
        }
        initialImageUrls={editingItem?.images?.length ? editingItem.images : editingItem ? [editingItem.imageUrl] : []}
        onSubmit={async (payload) => {
          if (!currentUser || !editingItem) return;
          if (payload.images.length > 0) {
            await updateListingWithImages({
              listingId: editingItem.id,
              userId: currentUser.id,
              title: payload.title,
              price: payload.price,
              category: payload.category,
              location: payload.location,
              description: payload.description,
              images: payload.images,
            });
          } else {
            await updateListingDetails({
              listingId: editingItem.id,
              userId: currentUser.id,
              title: payload.title,
              price: payload.price,
              category: payload.category,
              location: payload.location,
              description: payload.description,
            });
          }
          setIsEditModalOpen(false);
          setEditingItem(null);
          await refreshUserData(currentUser);
          await loadListings();
        }}
      />
      
      <AuthModal 
        auth={auth} 
        onClose={() => setAuth(prev => ({ ...prev, isOpen: false }))}
        onLogin={async ({ email, password, name }) => {
            const isRegister = auth.mode === 'register';
            const response = isRegister
              ? await registerUser({ email, password, nickname: name })
              : await loginUser({ email, password });
            localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
            setCurrentUser(toUser(response.user));
            setAuth(prev => ({ ...prev, isOpen: false }));
        }}
        onChangeMode={(mode) => setAuth(prev => ({ ...prev, mode }))}
      />
    </div>
  );
};

export default App;
