// Initialize theme on page load with preventDefault for default behavior
export const initializeTheme = () => {
  // Prevent default browser behavior for theme
  const event = new Event('theme-init', { cancelable: true });
  event.preventDefault();

  const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
  applyTheme(savedTheme);
  console.log(`✅ Theme initialized at load: ${savedTheme}`);
};

// Theme configuration with CSS variables - Dark and Light only
export const themeConfig = {
  dark: {
    name: 'Dark',
    bg: 'linear-gradient(135deg, rgba(0,20,40,0.95) 0%, rgba(15,35,60,0.95) 100%)',
    '--bg-primary': '17, 24, 39',
    '--bg-secondary': '31, 41, 55',
    '--bg-tertiary': '55, 65, 81',
    '--bg-hover': '75, 85, 99',
    '--border-secondary': '75, 85, 99',
    '--text-primary': '243, 244, 246',
    '--text-secondary': '209, 213, 219',
    '--text-muted': '156, 163, 175',
    '--text-lighter': '229, 231, 235',
    '--text-darker-muted': '107, 114, 128',
  },
  light: {
    name: 'Light',
    bg: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
    '--bg-primary': '255, 255, 255',
    '--bg-secondary': '248, 250, 252',
    '--bg-tertiary': '241, 245, 249',
    '--bg-hover': '226, 232, 240',
    '--border-secondary': '203, 213, 225',
    '--text-primary': '15, 23, 42',
    '--text-secondary': '51, 65, 85',
    '--text-muted': '100, 116, 139',
    '--text-lighter': '71, 85, 99',
    '--text-darker-muted': '71, 85, 99',
  },
};

// Apply theme to document root
export const applyTheme = (themeName, e) => {
  if (e && e.preventDefault) {
    e.preventDefault();
    e.stopPropagation();
  }

  const theme = themeConfig[themeName];
  if (!theme) return;

  const root = document.documentElement;
  
  root.style.setProperty('--bg-primary', theme['--bg-primary'], 'important');
  root.style.setProperty('--bg-secondary', theme['--bg-secondary'], 'important');
  root.style.setProperty('--bg-tertiary', theme['--bg-tertiary'], 'important');
  root.style.setProperty('--bg-hover', theme['--bg-hover'], 'important');
  root.style.setProperty('--border-secondary', theme['--border-secondary'], 'important');
  
  root.style.setProperty('--text-primary', theme['--text-primary'], 'important');
  root.style.setProperty('--text-secondary', theme['--text-secondary'], 'important');
  root.style.setProperty('--text-muted', theme['--text-muted'], 'important');
  root.style.setProperty('--text-lighter', theme['--text-lighter'], 'important');
  root.style.setProperty('--text-darker-muted', theme['--text-darker-muted'], 'important');

  console.log(`✅ Theme applied: ${themeName}`);
};

// Get theme name from localStorage
export const getSavedTheme = () => {
  return localStorage.getItem('selectedTheme') || 'dark';
};

// Save theme to localStorage
export const saveTheme = (themeName) => {
  localStorage.setItem('selectedTheme', themeName);
};

