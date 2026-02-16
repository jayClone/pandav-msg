export const checkSocketSetup = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('🔐 TOKEN CHECK');
  console.log('   Token exists:', !!token);
  console.log('   Token length:', token?.length || 0);
  console.log('   User exists:', !!user);
  
  if (token) {
    console.log('   Token preview:', token.substring(0, 20) + '...');
  }
  
  if (!token) {
    console.error('❌ NO TOKEN - Socket cannot authenticate!');
    return false;
  }
  
  return true;
}