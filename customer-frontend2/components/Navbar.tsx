'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { smoothScrollTo } from '@/lib/animations';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { customer, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/services', label: 'Services' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#reviews', label: 'Reviews' },
    { href: '/#faq', label: 'FAQ' },
    { href: '/support', label: 'Support' },
  ];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname !== '/') return;
    const hash = window.location.hash;
    if (hash) {
      smoothScrollTo(hash.substring(1));
    }
  }, [pathname]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md' : 'bg-white/95 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
              AirServe
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => {
              const isHashLink = link.href.includes('#');
              if (isHashLink) {
                const hash = link.href.split('#')[1];
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      if (pathname === '/') {
                        e.preventDefault();
                        smoothScrollTo(hash);
                      } else {
                        e.preventDefault();
                        router.push(link.href);
                      }
                    }}
                    className={`text-sm font-medium transition-colors ${
                      pathname === link.href
                        ? 'text-primary-600'
                        : 'text-gray-700 hover:text-primary-600'
                    }`}
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'text-primary-600'
                      : 'text-gray-700 hover:text-primary-600'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {isAuthenticated && (
              <Link
                href="/profile"
                className={`text-sm font-medium transition-colors ${
                  pathname === '/profile'
                    ? 'text-primary-600'
                    : 'text-gray-700 hover:text-primary-600'
                }`}
              >
                Profile
              </Link>
            )}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-primary-600"
                >
                  <User className="w-4 h-4" />
                  <span>{customer?.customerName || 'Dashboard'}</span>
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-700 hover:text-primary-600"
                >
                  Login
                </Link>
                <Link
                  href="/book"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Book Now
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-700"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              {navLinks.map((link) => {
                const isHashLink = link.href.includes('#');
                if (isHashLink) {
                  const hash = link.href.split('#')[1];
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => {
                        if (pathname === '/') {
                          e.preventDefault();
                          smoothScrollTo(hash);
                        } else {
                          e.preventDefault();
                          router.push(link.href);
                        }
                        setIsOpen(false);
                      }}
                      className={`text-base font-medium ${
                        pathname === link.href
                          ? 'text-primary-600'
                          : 'text-gray-700'
                      }`}
                    >
                      {link.label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`text-base font-medium ${
                      pathname === link.href
                        ? 'text-primary-600'
                        : 'text-gray-700'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {isAuthenticated && (
                <Link
                  href="/profile"
                  onClick={() => setIsOpen(false)}
                  className={`text-base font-medium ${
                    pathname === '/profile'
                      ? 'text-primary-600'
                      : 'text-gray-700'
                  }`}
                >
                  Profile
                </Link>
              )}
              <div className="pt-4 border-t border-gray-200 space-y-4">
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 text-base font-medium text-gray-700"
                    >
                      <User className="w-4 h-4" />
                      <span>Dashboard</span>
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      className="flex items-center space-x-2 text-base font-medium text-gray-700"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsOpen(false)}
                      className="block text-base font-medium text-gray-700"
                    >
                      Login
                    </Link>
                    <Link
                      href="/book"
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-2 bg-primary-600 text-white rounded-lg font-medium text-center"
                    >
                      Book Now
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
