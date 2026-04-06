export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
  emailVerified?: boolean;
  emailVerificationStatus?: 'verified' | 'pending';
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

export interface AuthFlowResult {
  completed: boolean;
  message?: string;
  pendingEmail?: string;
  delivery?: 'sent' | 'preview';
  verificationPreviewUrl?: string;
}

export interface VerificationResendResult {
  message: string;
  delivery?: 'sent' | 'preview';
  verificationPreviewUrl?: string;
}

export type ViewState = 'home' | 'item-detail' | 'profile' | 'messages';
