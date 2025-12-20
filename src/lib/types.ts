// Centralized types for the application

export interface User {
  id: number;
  email: string;
  username?: string | null;
  password_hash?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email_verified: boolean;
  email_verification_token?: string | null;
  provider?: string | null;
  provider_id?: string | null;
  created_at: Date;
  updated_at: Date;
  reset_token?: string | null;
  reset_token_expiry?: Date | null;
  is_admin: boolean;
  is_banned: boolean;
  terms_accepted_at?: Date | null;
  profile_image?: string | null;
  banner_image?: string | null;
}

export interface Document {
  id: number;
  user_id: number;
  title: string;
  content: string;
  tags: string[];
  is_favorite?: boolean | null;
  created_at: Date;
  updated_at: Date;
  username?: string;
  first_name?: string;
  last_name?: string;
  sharedWith?: {
    email: string;
    permission: boolean;
  }[];
  is_favorite_share?: boolean | null;
  folderIds?: number[];
  shared?: boolean;
}

export interface UserSession {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number | null;
}

// Types for action responses
export interface ActionResult {
  success?: boolean;
  message?: string;
  documentId?: number;
  error?: string;
  documents?: Document[];
  document?: Document;
  user?: User;
  users?: User[];
  userId?: string;
  ok?: boolean;
  id?: number;
  dbResult?: { success: boolean; error?: string; document?: Document };
}

// Types for services
export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  verificationToken: string;
}

export interface UpdateUserProfileData {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  bannerImage?: string;
}

export interface CreateDocumentData {
  userId: number;
  title: string;
  content: string;
  tags: string[];
}

export interface UpdateDocumentData {
  documentId: number;
  userId: number;
  title: string;
  content: string;
  tags: string[];
}

// Types for validation
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Types for emails
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Types for database responses
export interface DatabaseResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface UserRepositoryResult<T = unknown> extends DatabaseResult<T> {
  user?: User;
  users?: User[];
}

export interface DocumentRepositoryResult<T = unknown>
  extends DatabaseResult<T> {
  document?: Document;
  documents?: Document[];
}

export interface DocumentHistoryEntry {
  id: number;
  document_id: number;
  user_id?: number | null;
  user_email?: string | null;
  snapshot_before?: string | null;
  snapshot_after: string;
  diff_added?: string | null;
  diff_removed?: string | null;
  created_at: Date;
  // Joined user information (optional)
  user?: {
    id: number;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    profile_image?: string | null;
  } | null;
}

export interface TrashDocument {
  id: number;
  original_id?: number | null;
  user_id: number;
  title: string;
  content: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date;
}

// Interface for local documents (localStorage) which have different types
export interface LocalDocument {
  id: string;
  title?: string;
  content?: string;
  user_id?: string;
  created_at: string;
  updated_at?: string;
  tags?: string[];
  [key: string]: any;
}

// Union type to handle both document types
export type AnyDocument = Document | LocalDocument;

export interface MenuItemProps {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export interface Notification {
  id: number;
  id_sender: number | null;
  id_receiver: number;
  message: string;
  send_date: Date;
  read_date: Date | null;
  parsed: any;
  sender_username?: string;
  sender_first_name?: string;
  sender_last_name?: string;
  avatar?: string;
}

export interface NotificationContextValue {
  unreadCount: number;
  setUnreadCountSync: (n: number) => void;
  adjustUnreadCount: (delta: number) => void;
  refresh: () => Promise<void>;
}
