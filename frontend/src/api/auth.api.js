import authService from '../services/auth.service.js';

// Export service methods
export const { register: registerUser, login, getCurrentUser, logoutUser } = authService;

// Or export the whole service
export default authService;