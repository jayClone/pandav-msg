import authService from '@services/auth.service.js';

export const { 
  register: registerUser, 
  login, 
  getCurrentUser, 
  logout: logoutUser 
} = authService;

export default authService;