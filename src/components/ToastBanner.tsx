import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastNotification } from '../types/budget';

interface ToastBannerProps {
  toast: ToastNotification | null;
  onClose: () => void;
}

export function ToastBanner({ toast, onClose }: ToastBannerProps) {
  if (!toast) return null;

  const toneStyles = {
    success: {
      container: 'border-emerald-200 bg-white text-slate-900 shadow-lg shadow-slate-900/5',
      iconWrap: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: CheckCircle2,
    },
    warning: {
      container: 'border-amber-200 bg-white text-slate-900 shadow-lg shadow-slate-900/5',
      iconWrap: 'bg-amber-50 text-amber-700 border-amber-200',
      Icon: AlertTriangle,
    },
    danger: {
      container: 'border-red-200 bg-white text-slate-900 shadow-lg shadow-slate-900/5',
      iconWrap: 'bg-red-50 text-red-700 border-red-200',
      Icon: XCircle,
    },
    info: {
      container: 'border-blue-200 bg-white text-slate-900 shadow-lg shadow-slate-900/5',
      iconWrap: 'bg-blue-50 text-blue-700 border-blue-200',
      Icon: Info,
    },
  }[toast.tone];

  const { Icon } = toneStyles;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 w-full max-w-md px-4 sm:px-0"
    >
      <div
        className={`flex items-start gap-3 rounded-xl border p-4 transition-all duration-200 ${toneStyles.container}`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneStyles.iconWrap}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
