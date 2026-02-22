export const checkSocketSetup = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (token) {
  }

  if (!token) {
    console.error('❌ NO TOKEN - Socket cannot authenticate!');
    return false;
  }

  return true;
}