import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, CheckCircle, Clock, Tag, Calendar, X, Search, Edit2, ChevronRight, Info, ArrowRight, Scissors, LogOut, ChevronDown } from 'lucide-react';
import { format, isBefore, addDays, parseISO } from 'date-fns';
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
  brand?: {
    id: string;
    name: string;
    logo_url?: string | null;
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

  const [formData, setFormData] = useState({
    title: '',
    code: '',
    source: 'Other',
    description: '',
    expiry_date: format(new Date(), 'yyyy-MM-dd'),
    brand_logo_url: '',
    brand_color: '',
  });

  useEffect(() => {
    if (token) {
      fetchCoupons();
      fetchBrands();
    }
  }, [token]);

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
      const payload = {
        ...formData,
        expiry_date: new Date(formData.expiry_date).toISOString(),
        brand_name: formData.title,
        brand_color: formData.brand_color || null,
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
    setFormData({
      title: '',
      code: '',
      source: 'Other',
      description: '',
      expiry_date: format(new Date(), 'yyyy-MM-dd'),
      brand_logo_url: '',
      brand_color: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, coupon: Coupon) => {
    e.stopPropagation();
    setEditingCoupon(coupon);
    setIsBrandOptionsOpen(false);
    setFormData({
      title: coupon.title,
      code: coupon.code,
      source: coupon.source,
      description: coupon.description || '',
      expiry_date: format(parseISO(coupon.expiry_date), 'yyyy-MM-dd'),
      brand_logo_url: coupon.brand?.logo_url || '',
      brand_color: coupon.brand?.color || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    setIsBrandOptionsOpen(false);
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
                    onClick={openAddModal}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Plus size={22} />
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
                      </div>
                      <h3 className="text-lg font-black leading-tight mb-0.5">{coupon.description || 'Discount'}</h3>
                      <div className="flex items-center gap-2 text-[13px] text-gray-400 font-medium">
                        <span>till {format(parseISO(coupon.expiry_date), 'MMM d')}</span>
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
            <div className="px-6 pt-12 flex items-center justify-between mb-12">
              <button onClick={() => setIsRedeemOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Info size={24} className="text-gray-300" />
              </button>
            </div>

            <div className="flex-1 px-10 flex flex-col items-center text-center">
              <div className="w-32 h-32 mb-8 flex items-center justify-center rounded-3xl overflow-hidden bg-gray-50">
                {selectedCoupon.brand?.logo_url ? (
                  <img
                    src={selectedCoupon.brand.logo_url}
                    alt={`${selectedCoupon.title} logo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  React.cloneElement(getBrandIcon(selectedCoupon.title) as React.ReactElement, { size: 80 })
                )}
              </div>

              <h2 className="text-4xl font-black mb-4">{selectedCoupon.description || 'Discount'}</h2>
              <p className="text-gray-400 font-medium mb-1">on purchase of {selectedCoupon.title}</p>
              <p className="text-red-500 font-bold mb-12">till {format(parseISO(selectedCoupon.expiry_date), 'MMM d')}</p>

              <div className="bg-white p-6 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.05)] border border-black/5 mb-8">
                <QRCodeSVG value={selectedCoupon.code} size={160} />
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-[0.2em]">Coupon Code</span>
                <code className="text-2xl font-black tracking-widest font-mono">{selectedCoupon.code}</code>
              </div>
            </div>

            <div className="p-6">
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
                <datalist id="brands-list">
                  {brands.map(iss => (
                    <option key={iss.id} value={iss.name} />
                  ))}
                </datalist>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Brand Name</label>
                  <input
                    required
                    type="text"
                    list="brands-list"
                    placeholder="e.g. Adidas, iHerb"
                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
                    value={formData.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      const existingIssuer = brands.find(iss => iss.name === val);
                      setFormData({
                        ...formData,
                        title: val,
                        brand_logo_url: existingIssuer?.logo_url || formData.brand_logo_url,
                        brand_color: existingIssuer?.color || formData.brand_color
                      });
                    }}
                  />
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
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Discount Description</label>
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
