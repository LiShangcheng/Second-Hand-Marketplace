import { Category, Item, User } from './types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5002';

export interface ApiUser {
  id: string;
  email: string;
  nickname?: string;
  avatar?: string;
  community_id?: string;
}

export interface ApiListing {
  id: string;
  title?: string;
  name?: string;
  price: number;
  description?: string;
  category?: string;
  meetup_point?: string;
  created_at?: string;
  sold_at?: string | null;
  status?: 'active' | 'sold';
  user_id?: string;
  user?: {
    id?: string;
    nickname?: string;
    avatar?: string;
  };
  images?: string[];
}

export interface ApiThread {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  buyer_name?: string;
  seller_name?: string;
  created_at?: string;
}

export interface ApiMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at?: string;
  is_read?: boolean;
}

export interface ApiPresence {
  user_id: string;
  online: boolean;
  last_seen?: string | null;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || 'Request failed';
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
};

const normalizeCategory = (raw?: string): Category => {
  const value = (raw || '').toLowerCase();
  if (value.includes('textbook')) return 'Textbooks';
  if (value.includes('furniture')) return 'Furniture';
  if (value.includes('electronic')) return 'Electronics';
  if (value.includes('dorm')) return 'Dorm Essentials';
  if (value.includes('cloth')) return 'Clothing';
  if (value.includes('housing')) return 'Housing';
  if (value.includes('other')) return 'Other';
  return raw ? (raw as Category) : 'Other';
};

const DEFAULT_AVATAR = 'https://placehold.co/120x120?text=User';

export const resolveAssetUrl = (path?: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return path;
};

const normalizeCampus = (raw?: string): 'Washington Square Campus' | 'Brooklyn Campus' => {
  const value = (raw || '').toLowerCase();
  const brooklynHits = ['tandon', 'metrotech', 'dibner', 'rogers', 'brooklyn', 'othmer', 'jersey'];
  if (brooklynHits.some((hit) => value.includes(hit))) {
    return 'Brooklyn Campus';
  }
  return 'Washington Square Campus';
};

const ensureUtc = (iso?: string) => {
  if (!iso) return '';
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) return iso;
  return `${iso}Z`;
};

const formatTimeAgo = (iso?: string): string => {
  if (!iso) return 'Just now';
  const date = new Date(ensureUtc(iso));
  if (Number.isNaN(date.getTime())) return 'Just now';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
};

export const toItem = (listing: ApiListing): Item => {
  const sellerId = listing.user?.id || listing.user_id || 'unknown';
  const sellerName = listing.user?.nickname || `User ${sellerId}`;
  const sellerAvatar = resolveAssetUrl(listing.user?.avatar) || DEFAULT_AVATAR;
  const title = listing.title || listing.name || 'Untitled';
  const resolvedImages = (listing.images || [])
    .map((img) => resolveAssetUrl(img))
    .filter((img): img is string => Boolean(img));

  return {
    id: listing.id,
    title,
    price: Number(listing.price) || 0,
    category: normalizeCategory(listing.category),
    description: listing.description || '',
    imageUrl: resolvedImages[0] || 'https://picsum.photos/id/24/400/300',
    images: resolvedImages,
    location: listing.meetup_point || normalizeCampus(listing.meetup_point),
    postedAt: formatTimeAgo(listing.created_at),
    createdAt: listing.created_at ? ensureUtc(listing.created_at) : undefined,
    soldAt: listing.sold_at ? ensureUtc(listing.sold_at) : null,
    status: listing.status || 'active',
    seller: {
      id: sellerId,
      name: sellerName,
      avatar: sellerAvatar,
      email: listing.user?.nickname ? `${listing.user?.nickname}@nyu.edu` : 'student@nyu.edu',
    },
  };
};

export const fetchListings = async (params: {
  q?: string;
  category?: Category;
  status?: 'active' | 'sold' | 'all';
}): Promise<ApiListing[]> => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category && params.category !== 'All') {
    query.set('category', params.category);
  }
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return request<ApiListing[]>(`/api/listings${qs ? `?${qs}` : ''}`);
};

export const fetchPresence = async (userId: string): Promise<ApiPresence> => {
  return request<ApiPresence>(`/api/users/${userId}/presence`);
};

export const pingPresence = async (userId: string): Promise<ApiPresence> => {
  return request<ApiPresence>(`/api/users/${userId}/presence`, {
    method: 'POST',
  });
};

export const clearPresence = async (userId: string): Promise<ApiPresence> => {
  return request<ApiPresence>(`/api/users/${userId}/presence`, {
    method: 'DELETE',
  });
};

export const createListing = async (payload: {
  title: string;
  price: number;
  category?: string;
  description?: string;
  meetup_point?: string;
  user_id: string;
}): Promise<ApiListing> => {
  return request<ApiListing>('/api/listings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const createListingWithImages = async (payload: {
  title: string;
  price: number;
  category?: string;
  description?: string;
  meetup_point?: string;
  user_id: string;
  images: File[];
}): Promise<ApiListing> => {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('price', String(payload.price));
  if (payload.category) formData.append('category', payload.category);
  if (payload.description) formData.append('description', payload.description);
  if (payload.meetup_point) formData.append('meetup_point', payload.meetup_point);
  formData.append('user_id', payload.user_id);
  payload.images.forEach((file) => {
    formData.append('images', file);
  });

  const response = await fetch(`${API_BASE_URL}/api/listings`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || 'Request failed';
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<ApiListing>;
};

export const updateListingStatus = async (payload: {
  listingId: string;
  userId: string;
  status: 'active' | 'sold';
}): Promise<ApiListing> => {
  return request<ApiListing>(`/api/listings/${payload.listingId}`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: payload.userId, status: payload.status }),
  });
};

export const updateListingDetails = async (payload: {
  listingId: string;
  userId: string;
  title: string;
  price: number;
  category: string;
  description: string;
  location: string;
}): Promise<ApiListing> => {
  return request<ApiListing>(`/api/listings/${payload.listingId}`, {
    method: 'PUT',
    body: JSON.stringify({
      user_id: payload.userId,
      title: payload.title,
      price: payload.price,
      category: payload.category,
      description: payload.description,
      meetup_point: payload.location,
    }),
  });
};

export const updateListingWithImages = async (payload: {
  listingId: string;
  userId: string;
  title: string;
  price: number;
  category: string;
  description: string;
  location: string;
  images: File[];
}): Promise<ApiListing> => {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('price', String(payload.price));
  formData.append('category', payload.category);
  formData.append('description', payload.description);
  formData.append('meetup_point', payload.location);
  formData.append('user_id', payload.userId);
  payload.images.forEach((file) => {
    formData.append('images', file);
  });

  const response = await fetch(`${API_BASE_URL}/api/listings/${payload.listingId}`, {
    method: 'PUT',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || 'Request failed';
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<ApiListing>;
};

export const registerUser = async (payload: {
  email: string;
  password: string;
  nickname: string;
  community_id?: string;
}): Promise<{ token: string; user: ApiUser }> => {
  return request<{ token: string; user: ApiUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const loginUser = async (payload: {
  email: string;
  password: string;
}): Promise<{ token: string; user: ApiUser }> => {
  return request<{ token: string; user: ApiUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const fetchUser = async (userId: string): Promise<ApiUser> => {
  const user = await request<ApiUser>(`/api/users/${userId}`);
  return { ...user, avatar: resolveAssetUrl(user.avatar) || DEFAULT_AVATAR };
};

export const updateUser = async (payload: {
  userId: string;
  nickname?: string;
  email?: string;
  password?: string;
  community_id?: string;
}): Promise<ApiUser> => {
  const body: Record<string, string | undefined> = {
    nickname: payload.nickname,
    email: payload.email,
    community_id: payload.community_id,
  };
  if (payload.password) {
    body.password = payload.password;
  }
  return request<ApiUser>(`/api/users/${payload.userId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
};

export const uploadAvatar = async (payload: { userId: string; file: File }): Promise<ApiUser> => {
  const formData = new FormData();
  formData.append('avatar', payload.file);
  const response = await fetch(`${API_BASE_URL}/api/users/${payload.userId}/avatar`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || 'Request failed';
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, response.status);
  }

  const data = await response.json();
  const user = data.user as ApiUser;
  return { ...user, avatar: resolveAssetUrl(user.avatar) };
};

export const fetchUserListings = async (
  userId: string,
  status: 'active' | 'sold' | 'all' = 'all'
): Promise<ApiListing[]> => {
  return request<ApiListing[]>(`/api/users/${userId}/listings?status=${status}`);
};

export const fetchFavorites = async (
  userId: string
): Promise<{ favorites: ApiListing[]; favorite_ids: string[] }> => {
  return request<{ favorites: ApiListing[]; favorite_ids: string[] }>(`/api/users/${userId}/favorites`);
};

export const addFavorite = async (payload: { user_id: string; listing_id: string }) => {
  return request<{ ok: boolean }>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const removeFavorite = async (payload: { user_id: string; listing_id: string }) => {
  return request<{ ok: boolean }>(`/api/favorites/${payload.listing_id}?user_id=${payload.user_id}`, {
    method: 'DELETE',
  });
};

export const fetchThreads = async (userId: string): Promise<ApiThread[]> => {
  return request<ApiThread[]>(`/api/threads/${userId}`);
};

export const createThread = async (payload: {
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  buyer_name?: string;
  seller_name?: string;
}): Promise<ApiThread> => {
  return request<ApiThread>('/api/threads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const fetchMessages = async (threadId: string, userId?: string): Promise<ApiMessage[]> => {
  const qs = userId ? `?user_id=${userId}` : '';
  return request<ApiMessage[]>(`/api/threads/${threadId}/messages${qs}`);
};

export const fetchMessagesRaw = async (threadId: string): Promise<ApiMessage[]> => {
  return request<ApiMessage[]>(`/api/threads/${threadId}/messages`);
};

export const sendMessage = async (payload: {
  thread_id: string;
  sender_id: string;
  content: string;
}): Promise<ApiMessage> => {
  return request<ApiMessage>('/api/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const uploadMessageImage = async (file: File): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/api/messages/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || 'Image upload failed';
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(message, response.status);
  }

  return response.json();
};

export const fetchUnreadCount = async (userId: string): Promise<number> => {
  const data = await request<{ unread: number }>(`/api/messages/${userId}/unread-count`);
  return data.unread;
};

export const toUser = (apiUser: ApiUser): User => ({
  id: apiUser.id,
  name: apiUser.nickname || apiUser.email?.split('@')[0] || 'NYU Student',
  avatar: resolveAssetUrl(apiUser.avatar) || DEFAULT_AVATAR,
  email: apiUser.email,
  joinDate: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
});
