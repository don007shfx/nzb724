import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { hashHue, monogram } from '../core/format';
import { Icon, type IconName } from './icons';

type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger';

export function Button({
  children,
  variant = 'ghost',
  icon,
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: IconName;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${className}`.trim()}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`.trim()}
      title={label}
      aria-label={label}
      {...rest}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

export function StatusDot({ ok, pulse = false }: { ok: boolean; pulse?: boolean }) {
  return (
    <span
      className={`dot ${ok ? 'dot-ok' : 'dot-bad'} ${pulse && ok ? 'dot-pulse' : ''}`.trim()}
      role="img"
      aria-label={ok ? 'Online' : 'Offline'}
    />
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'accent';
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function ServiceBadge({
  name,
  accent,
}: {
  name: string;
  accent: string;
}) {
  return (
    <span className="svc-badge" style={{ '--svc': accent } as CSSProperties}>
      <i aria-hidden="true" />
      {name}
    </span>
  );
}

export function Progress({
  value,
  tone = 'accent',
  indeterminate = false,
}: {
  value: number;
  tone?: 'accent' | 'sky' | 'warn' | 'bad';
  indeterminate?: boolean;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      className={`progress ${indeterminate ? 'progress-indeterminate' : ''}`.trim()}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className={`progress-fill progress-${tone}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

export function Poster({
  title,
  url,
  ratio = '2 / 3',
  className = '',
}: {
  title: string;
  url?: string;
  ratio?: string;
  className?: string;
}) {
  const hue = hashHue(title);
  return (
    <div
      className={`poster ${className}`.trim()}
      style={
        {
          aspectRatio: ratio,
          '--poster-a': `hsl(${hue} 38% 20%)`,
          '--poster-b': `hsl(${(hue + 46) % 360} 42% 11%)`,
        } as CSSProperties
      }
    >
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="poster-mono">{monogram(title)}</span>
      )}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  flush = false,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`panel ${flush ? 'panel-flush' : ''} ${className}`.trim()}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {subtitle ? <p className="panel-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon = 'bolt',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={22} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="toggle-row">
      <div>
        <span className="toggle-label">{label}</span>
        {description ? <span className="toggle-desc">{description}</span> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? 'toggle-on' : ''}`.trim()}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
