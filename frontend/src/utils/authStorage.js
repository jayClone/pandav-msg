import { jwtDecode } from "jwt-decode";

const AUTH_EVENT = "auth-changed";

export const emitAuthChange = () => {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
};

export const subscribeToAuthChange = (callback) => {
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

export const getStoredToken = () => {
  return localStorage.getItem("token");
};

export const setStoredToken = (token) => {
  localStorage.setItem("token", token);
  emitAuthChange();
};

export const clearStoredToken = () => {
  localStorage.removeItem("token");
  emitAuthChange();
};

export const getAuthUser = () => {
  const token = getStoredToken();

  if (!token) {
    return null;
  }

  try {
    const decoded = jwtDecode(token);
    const expiresAt = decoded?.exp ? decoded.exp * 1000 : null;

    if (expiresAt && expiresAt <= Date.now()) {
      clearStoredToken();
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      exp: decoded.exp
    };
  } catch {
    clearStoredToken();
    return null;
  }
};
