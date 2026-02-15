export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
  joinDate?: string;
}

export interface Item {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  imageUrl: string;
  images?: string[];
  seller: User;
  location: string;
  postedAt: string;
  createdAt?: string;
  soldAt?: string | null;
  status?: 'active' | 'sold';
}

export type Category = 'All' | 'Textbooks' | 'Furniture' | 'Electronics' | 'Dorm Essentials' | 'Clothing' | 'Housing' | 'Other';

export interface AuthState {
  isOpen: boolean;
  mode: 'login' | 'register';
}

export type ViewState = 'home' | 'item-detail' | 'profile' | 'messages';
