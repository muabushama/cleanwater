const getUploadsOrigin = () => {
  if (typeof window === 'undefined') return '';
  const cfg = (window as Window & { __APP_CONFIG__?: { apiBaseUrl?: string } }).__APP_CONFIG__;
  const api = String(cfg?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
  if (api.startsWith('http://') || api.startsWith('https://')) {
    return api.replace(/\/api$/i, '');
  }
  return window.location.origin;
};

export const canonicalPurchaseFileUrl = (uploadData?: { path?: string; fullPath?: string } | null) => {
  if (!uploadData) return null;
  if (uploadData.path) return `/uploads/documents/${uploadData.path}`;
  if (uploadData.fullPath) return `/uploads/${String(uploadData.fullPath).replace(/^\/+/, '')}`;
  return null;
};

export const resolvePurchaseFileUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  const origin = getUploadsOrigin();
  const uploadsMatch = String(url).match(/\/uploads\/(.+)$/i);
  if (uploadsMatch) {
    return `${origin}/uploads/${uploadsMatch[1]}`;
  }
  if (url.startsWith('/uploads/')) {
    return `${origin}${url}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      const pathMatch = parsed.pathname.match(/\/uploads\/(.+)$/i);
      if (pathMatch) return `${origin}/uploads/${pathMatch[1]}`;
      return url;
    } catch {
      return url;
    }
  }
  return `${origin}/uploads/documents/${url.replace(/^\/+/, '')}`;
};

export const isPurchaseImageUrl = (url: string | null | undefined) => {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)(\?.*)?$/i.test(url)
    || url.startsWith('blob:')
    || url.startsWith('data:image/');
};

export const isPurchaseImageFile = (file: File | null | undefined) =>
  Boolean(file && String(file.type || '').startsWith('image/'));
