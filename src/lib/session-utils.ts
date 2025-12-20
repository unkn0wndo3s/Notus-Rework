// Utilities for managing user session in sessionStorage

// Types for session data
interface UserSessionData {
  id: string | number;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  username: string;
  profileImage?: string;
  bannerImage?: string;
  isAdmin?: boolean;
  isVerified?: boolean;
  timestamp: number;
}

const SESSION_KEY = "notus_user_session";

export function saveUserSession(userData: UserSessionData): boolean {
  try {
    const sessionData: UserSessionData = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      firstName: userData.firstName,
      lastName: userData.lastName,
      username: userData.username,
      profileImage: userData.profileImage,
      bannerImage: userData.bannerImage,
      isAdmin: userData.isAdmin,
      isVerified: userData.isVerified,
      timestamp: Date.now(),
    };
    if (globalThis.window !== undefined) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    }
    return true;
  } catch (error) {
    console.error("❌ Error while saving session:", error);
    return false;
  }
}

export function getUserSession(): UserSessionData | null {
  try {
    if (globalThis.window === undefined) return null;
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    if (!sessionData) {
      return null;
    }
    const parsed = JSON.parse(sessionData) as UserSessionData;
    // Patch: fallback to email in localStorage if missing
    if (!parsed.email) {
      const local = localStorage.getItem('userSession');
      if (local) {
        const localParsed = JSON.parse(local);
        if (localParsed.email) parsed.email = localParsed.email;
      }
    }
    return parsed;
  } catch (error) {
    console.error("❌ Error while retrieving session:", error);
    clearUserSession();
    return null;
  }
}

export function clearUserSession(): boolean {
  try {
    if (globalThis.window !== undefined) {
      // Completely clear sessionStorage
      sessionStorage.clear();

      // Also clear localStorage for user session
      localStorage.removeItem("userSession");
      localStorage.removeItem("currentUserId");
      // Also clean document keys related to the user
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("notus:doc:") || key.startsWith("notus.tags"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    return true;
  } catch (error) {
    console.error("❌ Error while clearing session:", error);
    return false;
  }
}

export function isUserLoggedIn(): boolean {
  const session = getUserSession();
  return session !== null && !!session.id;
}

export function getUserId(): string | number | null {
  const session = getUserSession();
  return session ? session.id : null;
}

export function getUserName(): string | null {
  const session = getUserSession();
  return session ? session.name : null;
}

export function getUserEmail(): string | null {
  const session = getUserSession();
  return session ? session.email : null;
}

export function getUserFirstName(): string | null {
  const session = getUserSession();
  return session ? session.firstName : null;
}

export function getUserLastName(): string | null {
  const session = getUserSession();
  return session ? session.lastName : null;
}

export function getUsername(): string | null {
  const session = getUserSession();
  return session ? session.username : null;
}

