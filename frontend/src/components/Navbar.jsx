import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
<nav className="sticky top-0 z-9999 mx-auto max-w-7xl px-2 py-1 rounded-b-lg rounded-tr-lg rounded-tl-lg shadow-lg  mask-b-to-gray-600 ">      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10  from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">PM</span>
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:inline">
              Pandav MSG
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-700 hover:text-blue-600 font-medium transition">
              Features
            </a>
            <a href="#why-us" className="text-gray-700 hover:text-blue-600 font-medium transition">
              Why Us
            </a>
            <a href="#contact" className="text-gray-700 hover:text-blue-600 font-medium transition">
              Contact
            </a>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login">
              <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                Login
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 focus:outline-none"
          >
            <svg
              className={`h-6 w-6 transition-transform ${isOpen ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-3">
            <a
              href="#features"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              onClick={() => setIsOpen(false)}
            >
              Features
            </a>
            <a
              href="#why-us"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              onClick={() => setIsOpen(false)}
            >
              Why Us
            </a>
            <a
              href="#contact"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              onClick={() => setIsOpen(false)}
            >
              Contact
            </a>
            <div className="flex flex-col space-y-2 px-4 pt-2 border-t">
              <Link to="/login" onClick={() => setIsOpen(false)}>
                <Button variant="outline" className="w-full border-blue-600 text-blue-600">
                  Login
                </Button>
              </Link>
              <Link to="/register" onClick={() => setIsOpen(false)}>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
