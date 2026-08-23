// Shared avatar rendering: an uploaded picture if there is one, otherwise
// the existing initial-letter gradient circle look, unchanged — so this
// is a drop-in replacement everywhere that circle already appears.
export default function Avatar({ src, name, online, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 sm:w-12 sm:h-12 text-sm sm:text-base',
    lg: 'w-16 h-16 text-2xl'
  };

  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div className={`relative shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name ? `${name}'s avatar` : 'Avatar'}
          className={`${sizeClasses[size]} rounded-full object-cover shadow-lg`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold shadow-lg ${
            online
              ? 'bg-linear-to-br from-green-500 to-teal-600 glow-green'
              : 'bg-linear-to-br from-gray-500 to-gray-600'
          }`}
        >
          {initial}
        </div>
      )}
      {online !== undefined && (
        <div
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-[rgb(var(--bg-secondary))] rounded-full ${
            online ? 'bg-green-400 pulse-glow' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
}
