import axios from './axios.js';

const userAPI = {
  updateAvatar: (avatarData) =>
    axios.put('/users/me/avatar', { avatarData }),

  removeAvatar: () =>
    axios.delete('/users/me/avatar'),
};

export default userAPI;
