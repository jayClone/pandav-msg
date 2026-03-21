import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import authService from "@/services/auth.service";
import { subscribeToAuthChange } from "@/utils/authStorage";

const getInitials = (name = "") => {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
};

export default function Navbar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [authUser, setAuthUser] = useState(() => authService.getAuthUser());

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        if (!authService.getAuthUser()) {
          await authService.refreshSession();
        }
      } catch {
        // Guest state is fine here.
      } finally {
        if (isMounted) {
          setAuthUser(authService.getAuthUser());
        }
      }
    };

    syncSession();

    const unsubscribe = subscribeToAuthChange(() => {
      if (isMounted) {
        setAuthUser(authService.getAuthUser());
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsOpen(false);
    navigate("/login");
  };

  const renderAuthenticatedActions = (mobile = false) => (
    <div className={mobile ? "flex flex-col space-y-2" : "flex items-center space-x-3"}>
      <Link to="/chat" onClick={() => setIsOpen(false)}>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
      </Link>

      <div className={mobile ? "flex items-center justify-between rounded-xl border px-3 py-2" : "flex items-center gap-3 rounded-full border border-blue-100 bg-white/80 px-3 py-2 shadow-sm"}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-bold text-white">
            {getInitials(authUser?.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {authUser?.name || "Your account"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {authUser?.email || "Signed in"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 transition"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          {!mobile && "Logout"}
        </button>
      </div>
    </div>
  );

  return (
    <nav className="sticky top-0 z-9999 mx-auto max-w-7xl px-2 py-1 rounded-b-lg rounded-tr-lg rounded-tl-lg shadow-lg mask-b-to-gray-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">PM</span>
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:inline">
              Pandav MSG
            </span>
          </Link>

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

          <div className="hidden md:flex items-center space-x-4">
            {authUser ? (
              renderAuthenticatedActions()
            ) : (
              <>
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
              </>
            )}
          </div>

          <button
            onClick={toggleMenu}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 focus:outline-none"
          >
            <svg
              className={`h-6 w-6 transition-transform ${isOpen ? "rotate-90" : ""}`}
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
              {authUser ? (
                renderAuthenticatedActions(true)
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
