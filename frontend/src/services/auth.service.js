import API from "@api/axios.js";
import {
  clearStoredToken,
  getAuthUser,
  getStoredToken,
  setStoredToken
} from "@/utils/authStorage.js";

const authService = {
  register: async (userData) => {
    if (!userData.otp) {
      throw new Error("OTP is missing. Please verify your email first.");
    }

    const payload = {
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      password: userData.password,
      otp: userData.otp.toString().trim()
    };

    const response = await API.post("/auth/register", payload);

    if (response.data.token) {
      setStoredToken(response.data.token);
    }

    return response.data;
  },

  login: async (credentials) => {
    try {
      const payload = {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
        ...(credentials.otp && { otp: credentials.otp.toString() })
      };

      const response = await API.post("/auth/login", payload);

      if (response.data.token) {
        setStoredToken(response.data.token);
      }

      return response.data;
    } catch (error) {
      clearStoredToken();
      throw error;
    }
  },

  refreshSession: async () => {
    const response = await API.post("/auth/refresh");

    if (response.data.token) {
      setStoredToken(response.data.token);
    }

    return response.data;
  },

  getCurrentUser: async () => {
    const response = await API.get("/auth/current");
    return response.data;
  },

  logout: () => {
    return API.post("/auth/logout")
      .catch(() => Promise.resolve())
      .finally(() => {
        clearStoredToken();
      });
  },

  isAuthenticated: () => {
    return !!getAuthUser();
  },

  getToken: () => {
    return getStoredToken();
  },

  getAuthUser
};

export default authService;
