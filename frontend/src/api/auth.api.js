import authService from '@services/auth.service.js';

// ✅ Export service methods
export const { 
  register: registerUser, 
  login, 
  getCurrentUser, 
  logout: logoutUser 
} = authService;

// Or export the whole service
export default authService;