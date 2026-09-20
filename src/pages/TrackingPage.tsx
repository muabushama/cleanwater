import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Navigation, Package, Phone, Truck, User, ChevronDown, ChevronUp, RefreshCw, Crosshair, StopCircle } from 'lucide-react';

const formatDateDisplay = (v?: string | null) => { const s = String(v || ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };

interface RepLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  recorded_at: string;
  profile?: { full_name: string };
}

interface ActiveOrder {
  id: string;
  order_code: string;
  customer_name: string;
  address: string;
  phone: string;
  product_name: string;
  total: number;
  delivery_status: string;
  location_url?: string;
  region?: string;
  visit_date: string;
}

const deliveryStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'في انتظار القبول', color: 'bg-yellow-500/15 text-yellow-700 border-yellow-300' },
  accepted: { label: 'تم القبول', color: 'bg-blue-500/15 text-blue-700 border-blue-300' },
  in_transit: { label: 'جاري التوصيل', color: 'bg-primary/15 text-primary border-primary/30' },
  delivered: { label: 'تم التسليم', color: 'bg-green-500/15 text-green-700 border-green-300' },
  rejected: { label: 'مرفوض', color: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export default function TrackingPage() {
  const [locations, setLocations] = useState<RepLocation[]>([]);
  const [ordersByRep, setOrdersByRep] = useState<Record<string, ActiveOrder[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [trackingRepId, setTrackingRepId] = useState<string | null>(null);
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [rolesRes, locResult] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('role', ['sales_rep', 'staff']),
        supabase
          .from('rep_locations')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(400),
      ]);

      const locRows = Array.isArray(locResult.data) ? locResult.data : [];
      const roleRows = Array.isArray(rolesRes.data) ? rolesRes.data : [];

      const latestByUser = new Map<string, any>();
      locRows.forEach((loc: any) => {
        const uid = String(loc.user_id || '');
        if (uid && !latestByUser.has(uid)) latestByUser.set(uid, loc);
      });

      const allIds = [...new Set([
        ...roleRows.map((r: any) => String(r.user_id || '')),
        ...latestByUser.keys(),
      ].filter(Boolean))];

      const profilesRes = allIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', allIds)
        : { data: [] as { id: string; full_name: string }[] };

      const profileMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p: any) => {
        if (p?.id) profileMap.set(String(p.id), String(p.full_name || 'مندوب'));
      });

      const ordersRes = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400);

      const grouped: Record<string, ActiveOrder[]> = {};
      const nameToId = new Map<string, string>();
      profileMap.forEach((name, id) => {
        if (name) nameToId.set(name.trim(), id);
      });

      (ordersRes.data || []).forEach((o: any) => {
        const delivery = String(o.delivery_status || '');
        const status = String(o.status || '');
        const active = ['pending', 'accepted', 'in_transit'].includes(delivery)
          || ['pending', 'in_progress'].includes(status);
        if (!active) return;
        const ids = new Set<string>();
        if (o.assigned_rep) ids.add(String(o.assigned_rep));
        const techId = nameToId.get(String(o.technician || '').trim());
        if (techId) ids.add(techId);
        ids.forEach((id) => {
          if (!grouped[id]) grouped[id] = [];
          grouped[id].push(o as ActiveOrder);
        });
      });
      setOrdersByRep(grouped);

      const locations: RepLocation[] = allIds.map((id) => {
        const loc = latestByUser.get(id);
        return {
          id: loc?.id || `no-loc-${id}`,
          user_id: id,
          latitude: Number(loc?.latitude) || 0,
          longitude: Number(loc?.longitude) || 0,
          accuracy: Number(loc?.accuracy) || 0,
          recorded_at: loc?.recorded_at || '',
          profile: { full_name: profileMap.get(id) || 'مندوب' },
        };
      });

      setLocations(locations);
    } catch (err) {
      console.error('tracking fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const poll = setInterval(() => fetchData({ silent: true }), 20000);
    return () => clearInterval(poll);
  }, []);

  const timeSince = (dateStr: string) => {
    if (!dateStr) return 'لا يوجد موقع';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${Math.floor(hours / 24)} يوم`;
  };

  const openInMaps = (lat: number, lng: number) => {
    const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const newWindow = window.open(mapUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed) {
      try {
        if (window.self !== window.top && window.top) {
          window.top.location.href = mapUrl;
          return;
        }
      } catch { /* cross-origin */ }
      window.location.href = mapUrl;
    }
  };

  const getRepStatus = (repId: string) => {
    const repOrders = ordersByRep[repId] || [];
    if (repOrders.some(o => o.delivery_status === 'in_transit')) return { label: 'في طريقه للتوصيل', color: 'bg-primary text-primary-foreground' };
    if (repOrders.some(o => o.delivery_status === 'accepted')) return { label: 'لديه أوردرات مقبولة', color: 'bg-blue-500 text-white' };
    if (repOrders.some(o => o.delivery_status === 'pending')) return { label: 'أوردرات معلقة', color: 'bg-yellow-500 text-white' };
    return { label: 'متاح', color: 'bg-muted text-muted-foreground' };
  };

  const hasLocation = (loc: RepLocation) => loc.latitude !== 0 || loc.longitude !== 0;

  const fetchRepLiveLocation = async (repId: string) => {
    const { data } = await supabase
      .from('rep_locations')
      .select('latitude, longitude, recorded_at')
      .eq('user_id', repId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setLiveLocation({ lat: data.latitude, lng: data.longitude, time: data.recorded_at });
      // Also update the location in the main list
      setLocations(prev => prev.map(l => l.user_id === repId ? { ...l, latitude: data.latitude, longitude: data.longitude, recorded_at: data.recorded_at } : l));
    }
  };

  const startTracking = (repId: string) => {
    stopTracking();
    setTrackingRepId(repId);
    fetchRepLiveLocation(repId);
    trackingIntervalRef.current = setInterval(() => fetchRepLiveLocation(repId), 30000);
  };

  const stopTracking = () => {
    if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    trackingIntervalRef.current = null;
    setTrackingRepId(null);
    setLiveLocation(null);
  };

  useEffect(() => {
    return () => { if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current); };
  }, []);

  // Sort: reps with active orders first
  const sortedLocations = [...locations].sort((a, b) => {
    const aOrders = (ordersByRep[a.user_id] || []).length;
    const bOrders = (ordersByRep[b.user_id] || []).length;
    if (aOrders !== bOrders) return bOrders - aOrders;
    return 0;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تتبع الفنيين</h1>
          <p className="text-muted-foreground text-sm">مواقع الفنيين والأوردرات الجارية — يتحدث تلقائياً كل 20 ثانية</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" /> تحديث
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sortedLocations.length === 0 && Object.keys(ordersByRep).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا يوجد فنيون مسجلون حالياً. أنشئ حساب فني/مندوب من صفحة الموظفين ثم افتح التطبيق من جهازه لتفعيل الموقع.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedLocations.map((loc) => {
            const repOrders = ordersByRep[loc.user_id] || [];
            const repStatus = getRepStatus(loc.user_id);
            const isExpanded = expandedRep === loc.user_id;

            return (
              <motion.div key={loc.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="card-shadow overflow-hidden">
                  {/* Rep header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedRep(isExpanded ? null : loc.user_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {(loc.profile?.full_name || 'م').charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold">{loc.profile?.full_name || 'مندوب'}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{timeSince(loc.recorded_at)}</span>
                            {repOrders.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {repOrders.length} أوردر
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={`${repStatus.color} text-[10px] border-0`}>
                          {repStatus.label}
                        </Badge>
                        {trackingRepId === loc.user_id ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); stopTracking(); }}
                          >
                            <StopCircle className="h-3 w-3" /> إيقاف
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); startTracking(loc.user_id); }}
                          >
                            <Crosshair className="h-3 w-3" /> تتبع
                          </Button>
                        )}
                        {hasLocation(loc) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); openInMaps(loc.latitude, loc.longitude); }}
                          >
                            <Navigation className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {repOrders.length > 0 && (
                          isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Live tracking indicator */}
                    {trackingRepId === loc.user_id && liveLocation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                          </span>
                          <span className="text-xs font-semibold text-primary">تتبع مباشر • يتحدث كل 30 ثانية</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>📍 {liveLocation.lat.toFixed(6)}, {liveLocation.lng.toFixed(6)}</span>
                          <span>{timeSince(liveLocation.time)}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 gap-1 text-xs w-full"
                          onClick={(e) => { e.stopPropagation(); openInMaps(liveLocation.lat, liveLocation.lng); }}
                        >
                          <Navigation className="h-3 w-3" /> فتح الموقع في الخريطة
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  {/* Orders list */}
                  <AnimatePresence>
                    {isExpanded && repOrders.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t px-4 pb-4 pt-3 space-y-3">
                          {repOrders.map((order) => {
                            const statusInfo = deliveryStatusMap[order.delivery_status] || deliveryStatusMap.pending;
                            return (
                              <div key={order.id} className="bg-muted/40 rounded-lg p-3 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-bold text-sm">{order.customer_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      #{order.order_code} • {order.product_name}
                                    </p>
                                  </div>
                                  <Badge className={`${statusInfo.color} border text-[10px]`}>
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span>{order.address}</span>
                                    {order.region && <Badge variant="outline" className="text-[9px] px-1">{order.region}</Badge>}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 flex-shrink-0" />
                                    <a href={`tel:${order.phone}`} className="text-primary underline">{order.phone}</a>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{formatDateDisplay(order.visit_date)}</span>
                                  <span className="font-bold">{order.total.toLocaleString()} ج.م</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
