import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Users,
  Lock,
  Zap,
  Globe,
  Radio,
  CheckCircle,
  ArrowRight,
  X,
} from 'lucide-react';

// Animated Background Orbs
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Animated gradient orbs */}
      <div className="absolute -top-40 -right-40 w-80 h-80  from-blue-400 to-blue-600 rounded-full opacity-20 blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-32 -left-32 w-80 h-80  from-purple-400 to-purple-600 rounded-full opacity-20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 w-96 h-96  from-pink-300 to-pink-500 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
    </div>
  );
}

// Feature Detail Modal
function FeatureModal({ feature, isOpen, onClose }) {
  if (!isOpen || !feature) return null;

  const IconComponent = feature.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl transform transition-all duration-300 scale-100 animate-slideUp">
        <div className="flex justify-between items-start mb-6">
          <div className={`w-16 h-16 rounded-lg  ${feature.color} flex items-center justify-center`}>
            <IconComponent className="w-8 h-8 text-white" />
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-4">{feature.title}</h2>
        <p className="text-gray-600 text-lg mb-6 leading-relaxed">
          {feature.description}
        </p>

        <div className="space-y-3 mb-6">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-500 " />
            <span className="text-gray-700">Lightning fast delivery</span>
          </div>
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-500 " />
            <span className="text-gray-700">Fully encrypted and secure</span>
          </div>
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-500 " />
            <span className="text-gray-700">Works offline and online</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3  from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Scroll animation wrapper
function ScrollReveal({ children, className = '' }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-10'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default function Index() {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const features = [
    {
      icon:  MessageCircle,
      title: 'Private Messaging',
      description: 'Send encrypted real-time messages to any user instantly with delivery confirmation.',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Users,
      title: 'Group Chats',
      description: 'Create groups with multiple members and communicate together seamlessly.',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: Radio,
      title: 'Real-Time Updates',
      description: 'Messages sync instantly using Socket.IO for true real-time communication.',
      color: 'from-pink-500 to-pink-600',
    },
    {
      icon: Globe,
      title: 'Online Status',
      description: 'See who is online and available for chat in real-time.',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: Lock,
      title: 'Secure Authentication',
      description: 'JWT-based authentication keeps your account and messages secure.',
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: Zap,
      title: 'Message History',
      description: 'All messages are saved and you can access your full chat history anytime.',
      color: 'from-indigo-500 to-indigo-600',
    },
  ];

  const benefits = [
    { title: 'Instant Delivery', description: 'Messages delivered in milliseconds' },
    { title: 'Message Persistence', description: 'Never lose important conversations' },
    { title: 'Read Receipts', description: 'Know when your messages are read' },
    { title: 'User Typing', description: 'See when someone is typing' },
    { title: 'Message Deletion', description: 'Delete messages you no longer want' },
    { title: 'Mobile Responsive', description: 'Works perfectly on all devices' },
  ];

return (
    <div className="min-h-screen bg-linear-to-brom-blue-50 via-white to-gray-50 relative">
        <AnimatedBackground />
        <div className="py-2 relative z-20">
            <Navbar />

        {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <ScrollReveal>
                    <div className="space-y-8">
                        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight">
                            Connect Instantly with
                            <span className="block bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent animate-gradient">
                                Pandav MSG
                            </span>
                        </h1>
                        <p className="mt-6 text-xl text-gray-600 leading-relaxed opacity-90 hover:opacity-100 transition-opacity">
                            Experience seamless real-time messaging with secure group chats, instant notifications, and persistent chat history. Stay connected with your team and friends.
                        </p>
                        <div className="mt-8 flex flex-col sm:flex-row gap-4 group">
                            <Link to="/register" className="transform transition-all duration-300 hover:scale-105">
                                <Button className="w-full sm:w-auto px-8 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white text-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                                    Start Messaging
                                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                            <Link to="/login" className="transform transition-all duration-300 hover:scale-105">
                                <Button
                                    variant="outline"
                                    className="w-full sm:w-auto px-8 py-3 border-2 border-blue-600 text-blue-600 text-lg hover:bg-blue-50 transition-all duration-300 transform hover:scale-105"
                                >
                                    Login Here
                                </Button>
                            </Link>
                        </div>
                        <p className="mt-6 text-sm text-gray-500 ">
                            ✓ No credit card required • ✓ Free forever • ✓ Easy setup
                        </p>
                    </div>
                </ScrollReveal>

                {/* Hero Image with Animation */}
                <ScrollReveal className="md:translate-x-0">
                    <div className="relative group">
                        {/* Animated background glow */}
                        <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-20 transition-all duration-500 blur-2xl"></div>
                        <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-10 blur-3xl transition-all duration-500 "></div>

                        <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 transform transition-all duration-500 group-hover:shadow-2xl group-hover:scale-105">
                            <div className="space-y-4">
                                {/* Chat Bubble 1 */}
                                <div className="flex justify-start opacity-0 animate-slideInLeft">
                                    <div className="bg-blue-100 text-blue-900 rounded-lg rounded-tl-none px-4 py-2 max-w-xs transform transition-all duration-300 hover:shadow-lg">
                                        <p className="text-sm font-medium">Hey! How are you?</p>
                                    </div>
                                </div>

                                {/* Chat Bubble 2 */}
                                <div className="flex justify-end opacity-0 animate-slideInRight">
                                    <div className="bg-blue-600 text-white rounded-lg rounded-tr-none px-4 py-2 max-w-xs transform transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/50">
                                        <p className="text-sm font-medium">All good! Chatting with team</p>
                                    </div>
                                </div>

                                {/* Online Status */}
                                <div className="pt-4 border-t opacity-0">
                                    <div className="flex items-center space-x-2 text-sm text-gray-600 group-hover:text-blue-600 transition-colors">
                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                        <span>2 users online</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollReveal>
            </div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
            <ScrollReveal>
                <div className="text-center mb-16">
                    <h2 className="text-4xl sm:text-5xl font-bold mb-4 bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Powerful Features
                    </h2>
                    <p className="text-xl text-gray-600 opacity-80 hover:opacity-100 transition-opacity">
                        Everything you need for seamless communication
                    </p>
                </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => {
                    const IconComponent = feature.icon;
                    return (
                        <ScrollReveal key={index} style={{ transitionDelay: `${index * 100}ms` }}>
                            <Card
                                onClick={() => setSelectedFeature(feature)}
                                className="group relative cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 p-8 border border-gray-150 overflow-hidden"
                            >
                                {/* Background gradient on hover */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none" ></div>

                                {/* Animated border */}
                                <div className="absolute inset-0 border border-transparent group-hover:border-blue-300 rounded-lg transition-colors duration-500 pointer-events-none"></div>

                                <div className="relative z-10">
                                    <div
                                        className={`w-14 h-14 rounded-lg ${feature.color} flex items-center justify-center mb-6 group-hover:scale-125 group-hover:rotate-6 transition-all duration-500 shadow-lg`}
                                    >
                                        <IconComponent className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-transparent group-hover:bg-linear-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors">
                                        {feature.description}
                                    </p>

                                    {/* Hidden details on hover */}
                                    <div className="mt-4 pt-4 border-t border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity duration-500 max-h-0 group-hover:max-h-32 overflow-hidden">
                                        <button className="text-blue-600 font-semibold text-sm hover:text-blue-700 transition-colors">
                                            Learn More →
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        </ScrollReveal>
                    );
                })}
            </div>
        </section>

        {/* Benefits Section */}
        <section className="bg-white py-20 border-y border-gray-200 relative overflow-hidden z-10">
            {/* Animated background lines */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                }}></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <ScrollReveal>
                    <div className="text-center mb-16">
                        <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
                            Why Choose Pandav MSG?
                        </h2>
                        <p className="text-xl text-gray-600">
                            Designed for modern communication needs
                        </p>
                    </div>
                </ScrollReveal>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {benefits.map((benefit, index) => (
                        <ScrollReveal key={index} style={{ transitionDelay: `${index * 100}ms` }}>
                            <div className="group flex items-start space-x-4 p-6 rounded-lg hover:bg-linear-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-500 transform hover:scale-105 cursor-pointer">
                                <CheckCircle className="w-6 h-6 text-green-500 mt-1 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300" />
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                                        {benefit.title}
                                    </h3>
                                    <p className="text-gray-600 mt-1 group-hover:text-gray-700 transition-colors">
                                        {benefit.description}
                                    </p>
                                </div>
                            </div>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>

        {/* Statistics Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { number: '100K+', label: 'Active Users' },
                    { number: '10M+', label: 'Messages Sent' },
                    { number: '99.9%', label: 'Uptime' },
                ].map((stat, index) => (
                    <ScrollReveal key={index} style={{ transitionDelay: `${index * 150}ms` }}>
                        <Card
                            className="text-center p-8 bg-linear-to-br from-blue-50 to-purple-50 border border-gray-200 group cursor-pointer hover:shadow-2xl transition-all duration-500 transform hover:scale-110 hover:-rotate-1">
                            <p className="text-4xl sm:text-5xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent group-hover:drop-shadow-lg transition-all">
                                {stat.number}
                            </p>
                            <p className="text-gray-600 text-lg mt-2 group-hover:text-blue-600 transition-colors">
                                {stat.label}
                            </p>
                        </Card>
                    </ScrollReveal>
                ))}
            </div>
        </section>

        {/* CTA Section */}
        <section
            id="why-us"
            className="bg-linear-to-r from-blue-600 to-purple-600 py-20 relative overflow-hidden z-10"
        >
            {/* Animated background elements */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ top: '-10%', left: '-10%' }}></div>
                <div className="absolute w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ bottom: '-10%', right: '-10%', animationDelay: '1s' }}></div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                <ScrollReveal>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                        Ready to Get Started?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto opacity-90 hover:opacity-100 transition-opacity">
                        Join thousands of users who trust Pandav MSG for their real-time communication needs
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4 group">
                        <Link to="/register" className="transform transition-all duration-300 hover:scale-105">
                            <Button className="px-8 py-3 bg-white text-blue-600 hover:bg-gray-100 text-lg font-bold transition-all duration-300 transform hover:shadow-2xl hover:scale-105">
                                Create Free Account
                            </Button>
                        </Link>
                        <Link to="/login" className="transform transition-all duration-300 hover:scale-105">
                            <Button
                                variant="outline"
                                className=" bg-white text-blue-600 text-lg font-bold transition-all duration-300 transform hover:shadow-2xl hover:scale-105px-8 py-3 border-2 border-white"
                            >
                                Sign In
                            </Button>
                        </Link>
                    </div>
                </ScrollReveal>
            </div>
        </section>

        {/* Footer */}
        <footer id="contact" className="bg-gray-900 text-gray-400 py-16 relative overflow-hidden z-10">
            <div className="absolute inset-0 opacity-5 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                }}></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    {/* Brand */}
                    <ScrollReveal>
                        <div>
                            <div className="flex items-center space-x-2 mb-4 group cursor-pointer hover:scale-110 transition-transform">
                                <div className="w-10 h-10 bg-linear-to-r from-blue-600 to-blue-800 rounded-lg flex items-center justify-center group-hover:shadow-lg group-hover:shadow-blue-500/50 transition-all">
                                    <span className="text-white font-bold">PM</span>
                                </div>
                                <span className="text-white font-bold text-lg group-hover:text-blue-400 transition-colors">Pandav MSG</span>
                            </div>
                            <p className="text-sm text-gray-500 hover:text-gray-400 transition-colors">
                                Modern messaging for everyone
                            </p>
                        </div>
                    </ScrollReveal>

                    {/* Product */}
                    <ScrollReveal style={{ transitionDelay: '100ms' }}>
                        <div>
                            <h4 className="text-white font-bold mb-4">Product</h4>
                            <ul className="space-y-2 text-sm">
                                <li>
                                    <a href="#features" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        Features
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        Pricing
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        Security
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </ScrollReveal>

                    {/* Company */}
                    <ScrollReveal style={{ transitionDelay: '200ms' }}>
                        <div>
                            <h4 className="text-white font-bold mb-4">Company</h4>
                            <ul className="space-y-2 text-sm">
                                <li>
                                    <a href="#" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        About
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        Blog
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        Careers
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </ScrollReveal>

                    {/* Legal */}
                    <ScrollReveal style={{ transitionDelay: '300ms' }}>
                        <div>
                            <h4 className="text-white font-bold mb-4">Legal</h4>
                            <ul className="space-y-2 text-sm">
                                <li>
                                    <a href="#" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        Privacy
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        Terms
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white hover:translate-x-1 transition-all inline-block">
                                        Contact
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </ScrollReveal>
                </div>

                <div className="border-t border-gray-800 pt-8">
                    <p className="text-center text-sm text-gray-500 hover:text-gray-400 transition-colors">
                        © 2026 Pandav MSG. All rights reserved. | Made with ❤️ by Team Pandav
                    </p>
                </div>
            </div>
        </footer>

        {/* Feature Modal */}
        <FeatureModal
            feature={selectedFeature}
            isOpen={!!selectedFeature}
            onClose={() => setSelectedFeature(null)}
        />
        </div>
    </div>
);
}
