import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, CheckCircle, Clock, Tag, Calendar, X, Search, Edit2, ChevronRight, Info, ArrowRight, Scissors, LogOut, ChevronDown } from 'lucide-react';
import { format, isBefore, addDays, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';
import Login from './components/Login';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Coupon {
  id: string;
  title: string;
  code: string;
  source: string;
  description: string;
  expiry_date: string;
  is_used: boolean;
  coupon_type?: 'discount' | 'voucher' | 'gift_card';
  initial_value?: number | null;
  current_value?: number | null;
  currency?: 'ILS' | 'USD' | 'EUR' | null;
  brand?: {
    id: string;
    name: string;
    logo_url?: string | null;
    website?: string | null;
    color?: string | null;
  };
}

interface Brand {
  id: string;
  name: string;
  logo_url?: string | null;
  website?: string | null;
  color?: string | null;
}

const CATEGORIES = ['All', 'Clothes', 'Food', 'Tech', 'Other'];
const COUPON_TYPES = [
  { label: 'Discount', value: 'discount' },
  { label: 'Voucher', value: 'voucher' },
  { label: 'Gift Card', value: 'gift_card' },
];
const CURRENCIES = [
  { label: 'ILS (₪)', value: 'ILS' },
  { label: 'USD ($)', value: 'USD' },
  { label: 'EUR (€)', value: 'EUR' },
];
const BRAND_SWATCHES = [
  '#111827',
  '#111111',
  '#1D4ED8',
  '#0EA5E9',
  '#14B8A6',
  '#22C55E',
  '#84CC16',
  '#EAB308',
  '#F97316',
  '#EF4444',
  '#E11D48',
  '#8B5CF6',
];

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isBrandOptionsOpen, setIsBrandOptionsOpen] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const brandSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    code: '',
    source: 'Other',
    description: '',
    expiry_date: format(new Date(), 'yyyy-MM-dd'),
    brand_logo_url: '',
    brand_color: '',
    brand_website: '',
    coupon_type: 'discount',
    initial_value: '',
    current_value: '',
    currency: 'ILS',
  });

  useEffect(() => {
    if (token) {
      fetchCoupons();
      fetchBrands();
    }
  }, [token]);

  useEffect(() => {
    if (isRedeemOpen) {
      setRedeemAmount('');
      setRedeemError('');
    }
  }, [isRedeemOpen, selectedCoupon]);

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/v1/brands/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        setToken(null);
        localStorage.removeItem('access_token');
        return;
      }
      const payload = await response.json();
      setBrands(payload.data ?? []);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    }
  };

  const fetchCoupons = async () => {
    try {
      const response = await fetch('/api/v1/coupons/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        setToken(null);
        localStorage.removeItem('access_token');
        return;
      }
      const payload = await response.json();
      setCoupons(payload.data ?? []);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCoupons = useMemo(() => {
    let result = coupons;

    if (activeCategory !== 'All') {
      result = result.filter(c => c.source === activeCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(coupon =>
        coupon.title.toLowerCase().includes(query) ||
        coupon.code.toLowerCase().includes(query) ||
        coupon.description.toLowerCase().includes(query)
      );
    }

    return result;
  }, [coupons, searchQuery, activeCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCoupon
        ? `/api/v1/coupons/${editingCoupon.id}`
        : '/api/v1/coupons/';
      const method = editingCoupon ? 'PUT' : 'POST';
      const initialValue = formData.initial_value !== '' ? Number(formData.initial_value) : null;
      const currentValue = formData.current_value !== '' ? Number(formData.current_value) : null;
      const isStoredValue = formData.coupon_type === 'voucher' || formData.coupon_type === 'gift_card';
      const payload = {
        ...formData,
        expiry_date: new Date(formData.expiry_date).toISOString(),
        brand_name: formData.title,
        brand_color: formData.brand_color || null,
        brand_website: formData.brand_website || null,
        coupon_type: formData.coupon_type,
        initial_value: isStoredValue ? initialValue : null,
        current_value: isStoredValue ? (currentValue ?? initialValue) : null,
        currency: isStoredValue ? formData.currency : null,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        setToken(null);
        localStorage.removeItem('access_token');
        return;
      }

      if (response.ok) {
        fetchCoupons();
        closeModal();
      }
    } catch (error) {
      console.error('Failed to save coupon:', error);
    }
  };

  const openAddModal = () => {
    setEditingCoupon(null);
    setIsBrandOptionsOpen(false);
    setIsBrandDropdownOpen(false);
    setFormData({
      title: '',
      code: '',
      source: 'Other',
      description: '',
      expiry_date: format(new Date(), 'yyyy-MM-dd'),
      brand_logo_url: '',
      brand_color: '',
      brand_website: '',
      coupon_type: 'discount',
      initial_value: '',
      current_value: '',
      currency: 'ILS',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, coupon: Coupon) => {
    e.stopPropagation();
    setEditingCoupon(coupon);
    setIsBrandOptionsOpen(false);
    setIsBrandDropdownOpen(false);
    setFormData({
      title: coupon.title,
      code: coupon.code,
      source: coupon.source,
      description: coupon.description || '',
      expiry_date: format(parseISO(coupon.expiry_date), 'yyyy-MM-dd'),
      brand_logo_url: coupon.brand?.logo_url || '',
      brand_color: coupon.brand?.color || '',
      brand_website: coupon.brand?.website || '',
      coupon_type: coupon.coupon_type || 'discount',
      initial_value: coupon.initial_value != null ? String(coupon.initial_value) : '',
      current_value: coupon.current_value != null ? String(coupon.current_value) : '',
      currency: coupon.currency || 'ILS',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    setIsBrandOptionsOpen(false);
    setIsBrandDropdownOpen(false);
  };

  const toggleUsed = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/v1/coupons/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_used: !currentStatus }),
      });
      if (response.status === 401) {
        setToken(null);
        localStorage.removeItem('access_token');
        return;
      }
      fetchCoupons();
      setIsRedeemOpen(false);
    } catch (error) {
      console.error('Failed to update coupon:', error);
    }
  };

  const redeemVoucherAmount = async (coupon: Coupon) => {
    const currentValue = coupon.current_value ?? coupon.initial_value ?? 0;
    const amount = coupon.coupon_type === 'gift_card' ? currentValue : Number(redeemAmount);
    if (!amount || amount <= 0) {
      setRedeemError('Enter a valid amount to redeem.');
      return;
    }
    if (amount > currentValue) {
      setRedeemError('Amount exceeds remaining balance.');
      return;
    }
    try {
      const newBalance = Number((currentValue - amount).toFixed(2));
      const response = await fetch(`/api/v1/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_value: newBalance,
          is_used: newBalance <= 0,
        }),
      });
      if (response.status === 401) {
        setToken(null);
        localStorage.removeItem('access_token');
        return;
      }
      if (response.ok) {
        setRedeemAmount('');
        setRedeemError('');
        fetchCoupons();
        setIsRedeemOpen(false);
      }
    } catch (error) {
      console.error('Failed to redeem voucher amount:', error);
    }
  };

  const redeemGiftCardFull = async (coupon: Coupon) => {
    const currentValue = coupon.current_value ?? coupon.initial_value ?? 0;
    if (currentValue <= 0) {
      setRedeemError('Gift card has no remaining balance.');
      return;
    }
    try {
      const response = await fetch(`/api/v1/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_value: 0,
          is_used: true,
        }),
      });
      if (response.status === 401) {
        setToken(null);
        localStorage.removeItem('access_token');
        return;
      }
      if (response.ok) {
        setRedeemAmount('');
        setRedeemError('');
        fetchCoupons();
        setIsRedeemOpen(false);
      }
    } catch (error) {
      console.error('Failed to redeem gift card:', error);
    }
  };

  const deleteCoupon = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/v1/coupons/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401) {
        setToken(null);
        localStorage.removeItem('access_token');
        return;
      }
      fetchCoupons();
    } catch (error) {
      console.error('Failed to delete coupon:', error);
    }
  };

  const isExpiringSoon = (dateStr: string) => {
    const expiryDate = parseISO(dateStr);
    const threeDaysFromNow = addDays(new Date(), 3);
    return isBefore(expiryDate, threeDaysFromNow) && !isBefore(expiryDate, new Date());
  };

  const getDaysLeftInfo = (dateStr: string) => {
    const expiryDate = parseISO(dateStr);
    const days = differenceInDays(startOfDay(expiryDate), startOfDay(new Date()));

    let text = '';
    let status = 'valid';

    if (days < 0) {
      text = `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
      status = 'expired';
    } else if (days === 0) {
      text = 'Expires today';
      status = 'expiring';
    } else if (days === 1) {
      text = 'Expires tomorrow';
      status = 'expiring';
    } else {
      text = `${days} days left`;
      if (days <= 3) status = 'expiring';
    }

    return { text, status };
  };

  const resolveBrandColor = (color?: string | null) => {
    if (!color) return null;
    const trimmed = color.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return trimmed;
    return null;
  };


  const getBrandIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('adidas')) return <Scissors size={24} />;
    if (t.includes('iherb')) return <Tag size={24} />;
    if (t.includes('puma')) return <Tag size={24} />;
    if (t.includes('mcdonald')) return <Tag size={24} />;
    return <Tag size={24} />;
  };

  const resolveCurrencySymbol = (currency?: Coupon['currency']) => {
    if (currency === 'USD') return '$';
    if (currency === 'EUR') return '€';
    return '₪';
  };

  const formatBalance = (coupon: Coupon) => {
    const symbol = resolveCurrencySymbol(coupon.currency);
    const current = coupon.current_value ?? coupon.initial_value ?? 0;
    const initial = coupon.initial_value ?? current;
    return `${symbol} ${current.toFixed(2)} / ${symbol} ${initial.toFixed(2)} left`;
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1A1A1A] font-sans selection:bg-indigo-100">
      {/* Mobile-style Header */}
      <header className="px-6 pt-12 pb-6 sticky top-0 bg-[#FDFDFD]/80 backdrop-blur-md z-20">
        <div className="max-w-md mx-auto flex items-center justify-between mb-8">
          <AnimatePresence mode="wait">
            {isSearchVisible ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex items-center gap-2"
              >
                <input
                  autoFocus
                  type="text"
                  placeholder="Search coupons..."
                  className="flex-1 bg-gray-100 px-4 py-2 rounded-2xl outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button onClick={() => setIsSearchVisible(false)} className="p-2">
                  <X size={20} className="text-gray-400" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between w-full"
              >
                <h1 className="text-3xl font-black tracking-tight">Coupons</h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSearchVisible(true)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Search size={22} />
                  </button>
                  <button
                    onClick={() => { setToken(null); localStorage.removeItem('access_token'); }}
                    className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500 ml-2"
                    title="Sign Out"
                  >
                    <LogOut size={22} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Categories Tabs */}
        <div className="max-w-md mx-auto overflow-x-auto no-scrollbar flex items-center gap-3 pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                activeCategory === cat
                  ? "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] text-indigo-600 border border-black/5"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 font-medium">No coupons found</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredCoupons.map((coupon) => {
                const expiringSoon = isExpiringSoon(coupon.expiry_date);
                const brandAccent = resolveBrandColor(coupon.brand?.color);
                const isStoredValue = coupon.coupon_type === 'voucher' || coupon.coupon_type === 'gift_card';
                const typeLabel = coupon.coupon_type === 'gift_card'
                  ? 'Gift Card'
                  : coupon.coupon_type === 'voucher'
                    ? 'Voucher'
                    : 'Discount';
                const typeClass = coupon.coupon_type === 'gift_card'
                  ? 'bg-amber-50 text-amber-600'
                  : coupon.coupon_type === 'voucher'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-indigo-50 text-indigo-600';

                return (
                  <motion.div
                    key={coupon.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => {
                      setSelectedCoupon(coupon);
                      setIsRedeemOpen(true);
                    }}
                    className={cn(
                      "bg-white rounded-[24px] p-5 flex items-center gap-5 cursor-pointer transition-all active:scale-[0.98] border border-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden",
                      coupon.is_used && "opacity-50 grayscale"
                    )}
                  >
                    {/* Selection Indicator (Red bar from image) */}
                    {expiringSoon && !coupon.is_used && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-red-500 rounded-l-full" />
                    )}
                    {brandAccent && (
                      <div
                        className="absolute left-0 top-0 h-full w-1"
                        style={{ backgroundColor: brandAccent }}
                      />
                    )}

                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                      {coupon.brand?.logo_url ? (
                        <img
                          src={coupon.brand.logo_url}
                          alt={`${coupon.title} logo`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getBrandIcon(coupon.title)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{coupon.title}</span>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                          typeClass
                        )}>
                          {typeLabel}
                        </span>
                      </div>
                      <h3 className="text-lg font-black leading-tight mb-0.5">
                        {isStoredValue ? formatBalance(coupon) : (coupon.description || 'Discount')}
                      </h3>
                      <div className="flex items-center flex-wrap gap-1.5 text-[13px] font-medium mt-1">
                        <span className="text-gray-500">Valid until {format(parseISO(coupon.expiry_date), 'MMM d, yyyy')}</span>
                        <span className="text-gray-300">•</span>
                        {(() => {
                          const { text, status } = getDaysLeftInfo(coupon.expiry_date);
                          return (
                            <span className={cn(
                              status === 'expired' ? "text-red-400" :
                                status === 'expiring' ? "text-red-500 font-bold" :
                                  "text-gray-400"
                            )}>
                              {text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={(e) => openEditModal(e, coupon)}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-300 hover:text-indigo-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => deleteCoupon(e, coupon.id)}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Floating Action Button for Adding Coupons */}
      <button
        onClick={openAddModal}
        className="fixed bottom-8 right-8 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:bg-indigo-700 transition-all active:scale-95 hover:scale-105"
        aria-label="Add new coupon"
      >
        <Plus size={28} />
      </button>

      {/* Redeem Screen (Full Screen Overlay) */}
      <AnimatePresence>
        {isRedeemOpen && selectedCoupon && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-white flex flex-col"
          >
            {(() => {
              const brandAccent = resolveBrandColor(selectedCoupon.brand?.color);
              if (!brandAccent) return null;
              return (
                <div
                  className="absolute left-0 top-0 h-1 w-full"
                  style={{ backgroundColor: brandAccent }}
                />
              );
            })()}
            <div className="px-6 pt-6 pb-2 flex items-center justify-between shrink-0">
              <button onClick={() => setIsRedeemOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Info size={24} className="text-gray-300" />
              </button>
            </div>

            <div className="flex-1 px-6 flex flex-col items-center justify-center text-center overflow-y-auto min-h-0 no-scrollbar pb-4 pt-2">
              <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center rounded-3xl overflow-hidden bg-gray-50 shrink-0 mb-4 sm:mb-6 shadow-sm border border-black/5">
                {selectedCoupon.brand?.logo_url ? (
                  <img
                    src={selectedCoupon.brand.logo_url}
                    alt={`${selectedCoupon.title} logo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  React.cloneElement(getBrandIcon(selectedCoupon.title) as React.ReactElement, { size: 60 })
                )}
              </div>

              <div className="shrink-0 mb-4 sm:mb-6">
                <h2 className="text-3xl sm:text-4xl font-black mb-1 sm:mb-2 leading-tight px-4">
                  {selectedCoupon.coupon_type === 'voucher' || selectedCoupon.coupon_type === 'gift_card'
                    ? formatBalance(selectedCoupon)
                    : (selectedCoupon.description || 'Discount')}
                </h2>
                <p className="text-gray-400 font-medium text-sm sm:text-base">on purchase of {selectedCoupon.title}</p>
              </div>

              <div className="flex flex-col items-center gap-1.5 shrink-0 mb-6 sm:mb-8">
                <p className="text-gray-500 font-medium text-sm sm:text-base">Valid until {format(parseISO(selectedCoupon.expiry_date), 'MMM d, yyyy')}</p>
                {(() => {
                  const { text, status } = getDaysLeftInfo(selectedCoupon.expiry_date);
                  return (
                    <div className={cn(
                      "px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wide",
                      status === 'expired' ? "bg-red-50 text-red-500" :
                        status === 'expiring' ? "bg-red-500 text-white shadow-md shadow-red-500/20" :
                          "bg-indigo-50 text-indigo-600"
                    )}>
                      {text}
                    </div>
                  );
                })()}
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.05)] border border-black/5 shrink-0 mb-4 sm:mb-6">
                <QRCodeSVG value={selectedCoupon.code} size={140} />
              </div>

              <div className="flex flex-col items-center gap-1 shrink-0">
                <span className="text-[10px] sm:text-xs font-bold text-gray-300 uppercase tracking-[0.2em]">Coupon Code</span>
                <code className="text-xl sm:text-2xl font-black tracking-widest font-mono">{selectedCoupon.code}</code>
              </div>
            </div>

            <div className="p-4 pb-8 sm:p-6 sm:pb-8 shrink-0">
              {selectedCoupon.coupon_type === 'voucher' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount to redeem"
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                      value={redeemAmount}
                      onChange={(e) => {
                        setRedeemAmount(e.target.value);
                        setRedeemError('');
                      }}
                      disabled={!!selectedCoupon.is_used}
                    />
                  </div>
                  {redeemError && (
                    <p className="text-sm font-bold text-red-500">{redeemError}</p>
                  )}
                  <button
                    onClick={() => redeemVoucherAmount(selectedCoupon)}
                    className={cn(
                      "w-full h-16 rounded-[24px] flex items-center justify-between px-8 transition-all active:scale-[0.98] shadow-lg",
                      selectedCoupon.is_used ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-emerald-600 text-white"
                    )}
                    disabled={!!selectedCoupon.is_used}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight size={20} />
                      <ChevronRight size={20} className="-ml-3 opacity-50" />
                    </div>
                    <span className="text-lg font-black uppercase tracking-widest">
                      {selectedCoupon.is_used ? 'REDEEMED' : 'REDEEM AMOUNT'}
                    </span>
                    <div className="w-5" />
                  </button>
                </div>
              ) : selectedCoupon.coupon_type === 'gift_card' ? (
                <div className="space-y-3">
                  {redeemError && (
                    <p className="text-sm font-bold text-red-500">{redeemError}</p>
                  )}
                  <button
                    onClick={() => redeemGiftCardFull(selectedCoupon)}
                    className={cn(
                      "w-full h-16 rounded-[24px] flex items-center justify-between px-8 transition-all active:scale-[0.98] shadow-lg",
                      selectedCoupon.is_used ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-amber-500 text-white"
                    )}
                    disabled={!!selectedCoupon.is_used}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight size={20} />
                      <ChevronRight size={20} className="-ml-3 opacity-50" />
                    </div>
                    <span className="text-lg font-black uppercase tracking-widest">
                      {selectedCoupon.is_used ? 'REDEEMED' : 'REDEEM FULL AMOUNT'}
                    </span>
                    <div className="w-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => toggleUsed(selectedCoupon.id, selectedCoupon.is_used)}
                  className={cn(
                    "w-full h-16 rounded-[24px] flex items-center justify-between px-8 transition-all active:scale-[0.98] shadow-lg",
                    selectedCoupon.is_used ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-indigo-600 text-white"
                  )}
                  disabled={!!selectedCoupon.is_used}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight size={20} />
                    <ChevronRight size={20} className="-ml-3 opacity-50" />
                  </div>
                  <span className="text-lg font-black uppercase tracking-widest">
                    {selectedCoupon.is_used ? 'REDEEMED' : 'REDEEM'}
                  </span>
                  <div className="w-5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal (Standard style but matching aesthetic) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h2 className="text-xl font-black">{editingCoupon ? 'Edit Coupon' : 'New Coupon'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div
                  className="relative z-40"
                  ref={brandSectionRef}
                  onBlur={(event) => {
                    const nextTarget = event.relatedTarget as HTMLElement | null;
                    if (nextTarget && brandSectionRef.current?.contains(nextTarget)) {
                      return;
                    }
                    setIsBrandDropdownOpen(false);
                    setIsBrandOptionsOpen(false);
                  }}
                >
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Brand Name</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      placeholder="Search or add brand..."
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold pr-10"
                      value={formData.title}
                      onFocus={() => setIsBrandDropdownOpen(true)}
                      onChange={(e) => {
                        const val = e.target.value;
                        const existingBrand = brands.find(b => b.name.toLowerCase() === val.toLowerCase());
                        setFormData({
                          ...formData,
                          title: val,
                          brand_logo_url: existingBrand?.logo_url || formData.brand_logo_url,
                          brand_color: existingBrand?.color || formData.brand_color,
                          brand_website: existingBrand?.website || formData.brand_website,
                        });
                        setIsBrandDropdownOpen(true);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setIsBrandDropdownOpen(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <ChevronDown size={18} className={cn("transition-transform", isBrandDropdownOpen && "rotate-180")} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {isBrandDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden max-h-60 overflow-y-auto no-scrollbar"
                      >
                        {(() => {
                          const query = formData.title.trim().toLowerCase();
                          const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(query));
                          const exactMatch = brands.find(b => b.name.toLowerCase() === query);
                          const showAddOption = query && !exactMatch;

                          return (
                            <div className="p-2 space-y-1 text-sm">
                              {filteredBrands.map(brand => (
                                <button
                                  key={brand.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      title: brand.name,
                                      brand_logo_url: brand.logo_url || formData.brand_logo_url,
                                      brand_color: brand.color || formData.brand_color,
                                      brand_website: brand.website || formData.brand_website,
                                    });
                                    setIsBrandDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-between group"
                                >
                                  <span className="font-bold text-gray-700">{brand.name}</span>
                                  {brand.color && (
                                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: brand.color }} />
                                  )}
                                </button>
                              ))}
                              {showAddOption && (
                                <button
                                  type="button"
                                  onClick={() => setIsBrandDropdownOpen(false)}
                                  className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-indigo-50 text-indigo-600 transition-colors flex items-center gap-2"
                                >
                                  <Plus size={16} />
                                  <span className="font-bold">Add "{formData.title}"</span>
                                </button>
                              )}
                              {!showAddOption && filteredBrands.length === 0 && (
                                <div className="px-4 py-3 text-center text-gray-400 font-medium">
                                  No matching brands
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="mt-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsBrandOptionsOpen((prev) => !prev)}
                        className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-sm font-bold text-gray-500 flex items-center justify-between"
                      >
                        Brand options
                        <ChevronDown size={18} className={cn("transition-transform", isBrandOptionsOpen && "rotate-180")} />
                      </button>
                      {isBrandOptionsOpen && (
                        <div className="absolute z-30 mt-2 w-full max-w-md p-4 rounded-2xl bg-white border border-black/5 shadow-2xl">
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brand Color</span>
                                {formData.brand_color ? (
                                  <button
                                    type="button"
                                    className="text-xs font-bold text-gray-400 hover:text-gray-600"
                                    onClick={() => setFormData({ ...formData, brand_color: '' })}
                                  >
                                    Clear
                                  </button>
                                ) : null}
                              </div>
                              <div className="grid grid-cols-6 gap-2">
                                {BRAND_SWATCHES.map((color) => {
                                  const isActive = formData.brand_color === color;
                                  return (
                                    <button
                                      key={color}
                                      type="button"
                                      aria-label={`Select ${color}`}
                                      onClick={() => setFormData({ ...formData, brand_color: color })}
                                      className={cn(
                                        "h-8 w-8 rounded-full border border-black/10 transition-all",
                                        isActive ? "ring-2 ring-offset-2 ring-black/40" : "hover:scale-105"
                                      )}
                                      style={{ backgroundColor: color }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Brand Logo URL (Optional)</label>
                              <input
                                type="url"
                                placeholder="e.g. https://example.com/logo.png"
                                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm"
                                value={formData.brand_logo_url}
                                onChange={(e) => setFormData({ ...formData, brand_logo_url: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Brand Website (Optional)</label>
                              <input
                                type="url"
                                placeholder="e.g. https://brand.example"
                                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm"
                                value={formData.brand_website}
                                onChange={(e) => setFormData({ ...formData, brand_website: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Offer Description</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 15% off"
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Coupon Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {COUPON_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          if (type.value === 'discount') {
                            setFormData({
                              ...formData,
                              coupon_type: type.value,
                              initial_value: '',
                              current_value: '',
                              currency: 'ILS',
                            });
                            return;
                          }
                          setFormData({ ...formData, coupon_type: type.value });
                        }}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-wider transition-all",
                          formData.coupon_type === type.value
                            ? "bg-indigo-600 text-white shadow-lg"
                            : "bg-gray-50 text-gray-400 hover:text-gray-600"
                        )}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                {(formData.coupon_type === 'voucher' || formData.coupon_type === 'gift_card') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Initial Value</label>
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 100"
                        className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                        value={formData.initial_value}
                        onChange={(e) => setFormData({ ...formData, initial_value: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Currency</label>
                      <select
                        className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold appearance-none"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      >
                        {CURRENCIES.map((currency) => (
                          <option key={currency.value} value={currency.value}>{currency.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Coupon Code</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. SAVE20"
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono font-bold"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold appearance-none"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    >
                      {CATEGORIES.filter(c => c !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Expiry Date</label>
                    <input
                      required
                      type="date"
                      className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-widest"
                  >
                    {editingCoupon ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
