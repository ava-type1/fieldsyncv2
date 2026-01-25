import { Link } from 'react-router-dom';
import {
  WifiOff,
  Camera,
  FileSignature,
  ClipboardList,
  Users,
  RefreshCw,
  Clock,
  FileText,
  Check,
  ArrowRight,
  Menu,
  X,
  MapPin,
  Shield,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

// Navigation
function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">FieldSync</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </a>
            <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors">
              Testimonials
            </a>
            <Link to="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
              Log In
            </Link>
            <Link
              to="/signup"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-gray-600 hover:text-gray-900">
                Features
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">
                Pricing
              </a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900">
                Testimonials
              </a>
              <Link to="/login" className="text-gray-600 hover:text-gray-900">
                Log In
              </Link>
              <Link
                to="/signup"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium text-center"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// Hero Section
function HeroSection() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-br from-primary-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
              <WifiOff className="w-4 h-4" />
              Works offline
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Field Service Management Built for{' '}
              <span className="text-primary-600">Manufactured Housing</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Track walkthroughs, manage phases, capture signatures — even with no cell service.
              Purpose-built for installers, setup crews, and service contractors.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/signup"
                className="bg-primary-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg font-semibold text-lg hover:border-gray-400 hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Demo
              </button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                14-day free trial
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 transform rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="bg-gradient-to-br from-primary-100 to-blue-100 rounded-xl aspect-[4/3] flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-primary-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <ClipboardList className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-primary-700 font-medium">FieldSync Dashboard</p>
                  <p className="text-primary-600/70 text-sm mt-1">
                    Photo documentation, signatures & more
                  </p>
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div className="absolute -top-4 -right-4 bg-green-500 text-white px-4 py-2 rounded-full font-medium text-sm shadow-lg animate-bounce">
              Offline Ready
            </div>
            <div className="absolute -bottom-4 -left-4 bg-white px-4 py-3 rounded-xl shadow-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Camera className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">247 Photos</p>
                  <p className="text-xs text-gray-500">Synced today</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Problem/Solution Section
function ProblemSolutionSection() {
  const problems = [
    {
      problem: 'Paper forms get lost or damaged',
      solution: 'Digital forms that sync automatically',
      icon: FileText,
    },
    {
      problem: 'Photos disappear from camera rolls',
      solution: 'GPS-tagged photos organized by job',
      icon: Camera,
    },
    {
      problem: 'No proof of completed work',
      solution: 'Digital signatures with timestamps',
      icon: FileSignature,
    },
    {
      problem: 'Payment delays from missing paperwork',
      solution: 'Instant PDF reports to dealerships',
      icon: Clock,
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Stop Losing Money to Paperwork Problems
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Every contractor knows the frustration. FieldSync eliminates the chaos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {problems.map((item, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-2xl p-6 md:p-8 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-500 line-through mb-2">
                    {item.problem}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 mt-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">{item.solution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Features Grid
function FeaturesSection() {
  const features = [
    {
      icon: WifiOff,
      title: 'Offline-First',
      description: 'Works with no cell signal. Data syncs automatically when you get connection.',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: Camera,
      title: 'Photo Documentation',
      description: 'GPS-tagged photos automatically organized by property and phase.',
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: FileSignature,
      title: 'Digital Signatures',
      description: 'Capture customer signatures on-site with timestamps and GPS verification.',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: ClipboardList,
      title: 'Phase Tracking',
      description: 'Track setup, trim, service, and punch phases with customizable checklists.',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      icon: Users,
      title: 'Customer Portal',
      description: 'Give customers real-time visibility into their project status.',
      color: 'bg-pink-100 text-pink-600',
    },
    {
      icon: RefreshCw,
      title: 'QuickBooks Sync',
      description: 'Automatically sync invoices and payments with QuickBooks Online.',
      color: 'bg-teal-100 text-teal-600',
    },
    {
      icon: Clock,
      title: 'Time & Mileage',
      description: 'Track work hours and travel automatically for accurate billing.',
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      icon: FileText,
      title: 'PDF Reports',
      description: 'Generate professional reports with photos, signatures, and notes.',
      color: 'bg-indigo-100 text-indigo-600',
    },
  ];

  return (
    <section id="features" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need in the Field
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Purpose-built tools for manufactured housing professionals
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div
                className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection() {
  const tiers = [
    {
      name: 'Solo',
      price: '$29',
      period: '/mo',
      description: 'Perfect for independent contractors',
      users: '1 user',
      features: [
        'Unlimited properties',
        'Photo documentation',
        'Digital signatures',
        'Offline mode',
        'PDF reports',
        'Email support',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Team',
      price: '$79',
      period: '/mo',
      description: 'For small crews and teams',
      users: 'Up to 5 users',
      features: [
        'Everything in Solo',
        'Team management',
        'Manager dashboard',
        'Work assignment',
        'Customer portal',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Dealership',
      price: '$199',
      period: '/mo',
      description: 'For dealerships and large operations',
      users: 'Unlimited users',
      features: [
        'Everything in Team',
        'QuickBooks sync',
        'Custom branding',
        'Advanced reporting',
        'API access',
        'Phone support',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For multi-location businesses',
      users: 'Unlimited everything',
      features: [
        'Everything in Dealership',
        'Dedicated account manager',
        'Custom integrations',
        'SLA guarantee',
        'On-site training',
        'Custom development',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Start free for 14 days. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`rounded-2xl p-6 ${
                tier.popular
                  ? 'bg-primary-600 text-white ring-4 ring-primary-600 ring-offset-2'
                  : 'bg-white border-2 border-gray-200'
              }`}
            >
              {tier.popular && (
                <div className="text-xs font-bold uppercase tracking-wide text-primary-200 mb-2">
                  Most Popular
                </div>
              )}
              <h3
                className={`text-xl font-bold ${tier.popular ? 'text-white' : 'text-gray-900'} mb-1`}
              >
                {tier.name}
              </h3>
              <p className={`text-sm ${tier.popular ? 'text-primary-200' : 'text-gray-500'} mb-4`}>
                {tier.description}
              </p>
              <div className="mb-4">
                <span
                  className={`text-4xl font-bold ${tier.popular ? 'text-white' : 'text-gray-900'}`}
                >
                  {tier.price}
                </span>
                <span className={tier.popular ? 'text-primary-200' : 'text-gray-500'}>
                  {tier.period}
                </span>
              </div>
              <p
                className={`text-sm font-medium ${tier.popular ? 'text-primary-200' : 'text-gray-600'} mb-6`}
              >
                {tier.users}
              </p>
              <ul className="space-y-3 mb-6">
                {tier.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start gap-2 text-sm">
                    <Check
                      className={`w-5 h-5 flex-shrink-0 ${tier.popular ? 'text-primary-200' : 'text-green-500'}`}
                    />
                    <span className={tier.popular ? 'text-white' : 'text-gray-600'}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={tier.name === 'Enterprise' ? '/contact' : '/signup'}
                className={`block w-full py-3 px-4 rounded-lg font-semibold text-center transition-colors ${
                  tier.popular
                    ? 'bg-white text-primary-600 hover:bg-gray-100'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Testimonials Section
function TestimonialsSection() {
  const testimonials = [
    {
      quote:
        "FieldSync has completely transformed how we handle our manufactured housing installs. No more lost paperwork or missing photos.",
      author: 'Mike Johnson',
      role: 'Owner, Johnson Mobile Home Services',
      avatar: 'MJ',
    },
    {
      quote:
        "The offline mode is a game-changer. We work in rural areas with no cell service, and FieldSync just works.",
      author: 'Sarah Williams',
      role: 'Operations Manager, Williams Setup Crew',
      avatar: 'SW',
    },
    {
      quote:
        "Our payment turnaround improved by 40% since using FieldSync. Dealerships love getting professional reports instantly.",
      author: 'Robert Chen',
      role: 'Service Manager, Premier Housing Solutions',
      avatar: 'RC',
    },
  ];

  return (
    <section id="testimonials" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Contractors Nationwide
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See what manufactured housing professionals are saying about FieldSync
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed">"{testimonial.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  return (
    <section className="py-16 md:py-24 bg-primary-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Transform Your Field Operations?
        </h2>
        <p className="text-xl text-primary-100 mb-8">
          Join hundreds of manufactured housing contractors who've ditched the paperwork.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/signup"
            className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors inline-flex items-center justify-center gap-2"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
          <button className="border-2 border-white/30 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors">
            Schedule Demo
          </button>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-primary-200">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Enterprise-grade security
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Setup in 5 minutes
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Works anywhere
          </div>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">FieldSync</span>
            </div>
            <p className="text-sm leading-relaxed">
              Field service management built specifically for manufactured housing contractors.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Integrations
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Changelog
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">&copy; {new Date().getFullYear()} FieldSync. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
              </svg>
            </a>
            <a href="#" className="hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a href="#" className="hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page
export function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <ProblemSolutionSection />
      <FeaturesSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
