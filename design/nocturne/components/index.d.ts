import type * as React from 'react';

/** Names in the Nocturne icon set. */
export type IconName =
  | 'heart-pulse' | 'activity' | 'droplet' | 'thermometer' | 'calendar' | 'clock' | 'video' | 'message'
  | 'phone' | 'stethoscope' | 'pill' | 'dna' | 'shield-check' | 'user' | 'bell' | 'search' | 'globe'
  | 'map-pin' | 'arrow-right' | 'plus';

/** Status words the system knows. Each has its own glyph and fill weight. */
export type Status = 'stable' | 'live' | 'watch' | 'critical' | 'offline' | 'info';

export interface IconProps {
  name: IconName;
  /** Rendered size in px. Default 20. */
  size?: number;
  /** Default 1.6. Keep it; the set is drawn for 1.6. */
  strokeWidth?: number;
  /** Gives the icon an accessible name. Without it the icon is decorative (aria-hidden). */
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = cyan fill (one per view) · vital = emerald fill (health actions) · glass = secondary · ghost = tertiary. Default primary. */
  variant?: 'primary' | 'vital' | 'glass' | 'ghost';
  /** 36 / 46 / 56 px tall. Default md. */
  size?: 'sm' | 'md' | 'lg';
  /** Leading icon: an IconName or any node. */
  icon?: IconName | React.ReactNode;
  /** Trailing icon, for direction (arrow-right). It mirrors under dir="rtl". */
  iconEnd?: IconName | React.ReactNode;
  /** Renders an <a> when set. */
  href?: string;
  /** Element to render instead of <button> or <a>. */
  as?: React.ElementType;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface FloatButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName | React.ReactNode;
  /** Required. Becomes the aria-label and the tooltip text. */
  label: string;
  /** cyan = actions · emerald = live health actions · alert = emergency only. Default cyan. */
  tone?: 'cyan' | 'emerald' | 'alert';
  /** Adds a breathing ring. Use on one button at most. */
  pulse?: boolean;
  /** Tooltip side: start (default) or end; false hides it. */
  tip?: 'start' | 'end' | false;
  /** A small count in the corner (unread messages). */
  badge?: number | string;
}
export declare function FloatButton(props: FloatButtonProps): React.ReactElement;

export interface GlassPanelProps extends React.HTMLAttributes<HTMLElement> {
  /** default = rgba .07 fill · strong = .12 fill for small or nested panels. */
  strength?: 'default' | 'strong';
  /** A halo for the one panel that matters most on screen. Default none. */
  glow?: 'none' | 'cyan' | 'emerald';
  /** Padding: 0 / 16 / 24 / 32 px. Default md. */
  pad?: 'none' | 'sm' | 'md' | 'lg';
  /** Element to render. Default div. */
  as?: React.ElementType;
}
export declare function GlassPanel(props: GlassPanelProps): React.ReactElement;

export interface StatusPillProps {
  status?: Status;
  /** The word shown. Defaults to the status name (Stable, Live, Watch, Critical, Offline, Info). */
  children?: React.ReactNode;
  size?: 'md' | 'sm';
  /** Pass "status" when the pill changes live, so screen readers announce it. */
  role?: string;
  title?: string;
  className?: string;
}
export declare function StatusPill(props: StatusPillProps): React.ReactElement;

export interface VitalTileProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** What is measured, e.g. "Heart rate". Set in the uppercase mono eyebrow. */
  label: React.ReactNode;
  /** The reading. Strings keep their formatting ("118/76", "37.9"). */
  value: React.ReactNode;
  /** Unit after the value ("bpm", "mmHg", "°C"). */
  unit?: React.ReactNode;
  icon?: IconName | React.ReactNode;
  /** Adds a small StatusPill to the header. */
  status?: Status;
  /** The pill's word; defaults to the status name. */
  statusLabel?: React.ReactNode;
  /** Recent readings, oldest first; drawn as a sparkline in the accent colour. */
  trend?: number[];
  /** Colour of the icon well, sparkline and footnote emphasis. Default cyan. */
  accent?: 'cyan' | 'emerald' | 'amber';
  /** One line under the reading; <b> inside picks up the accent. */
  footnote?: React.ReactNode;
  /** Anything else under the reading, usually a Waveform. */
  children?: React.ReactNode;
  pad?: 'none' | 'sm' | 'md' | 'lg';
  /** sm sets the value at 38px instead of 52px, for long readings ("118/76") in narrow tiles. */
  size?: 'md' | 'sm';
}
export declare function VitalTile(props: VitalTileProps): React.ReactElement;

export interface WaveformProps {
  /** Beats per minute; sets the scroll speed. Default 72. */
  bpm?: number;
  tone?: 'emerald' | 'cyan' | 'amber' | 'alert';
  /** Height in px. Width fills the container. Default 56. */
  height?: number;
  /** false pauses the trace. Default true. */
  live?: boolean;
  /** false hides the monitor grid. */
  grid?: boolean;
  /** Accessible name. Default "ECG trace, <bpm> beats per minute". */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Waveform(props: WaveformProps): React.ReactElement;

export interface RingGaugeProps {
  value: number;
  min?: number;
  /** Default 100. */
  max?: number;
  /** Shown instead of value, when the displayed text should differ (e.g. "7h 24m"). */
  display?: React.ReactNode;
  unit?: React.ReactNode;
  /** Short uppercase caption inside the ring; also the meter's accessible name. */
  label?: string;
  tone?: 'cyan' | 'emerald' | 'amber' | 'alert';
  /** Diameter in px. Default 148. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}
export declare function RingGauge(props: RingGaugeProps): React.ReactElement;

export interface HoloPortraitProps {
  /** A transparent-background portrait (PNG or WebP cut-out). Without it the built-in light-form is drawn. */
  src?: string;
  /** Accessible description. Default "<name>, shown as a hologram". */
  alt?: string;
  name?: string;
  role?: string;
  status?: Status;
  statusLabel?: React.ReactNode;
  /** Stage width in px; height is 1.37 times this plus the caption. Default 360. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}
export declare function HoloPortrait(props: HoloPortraitProps): React.ReactElement;

export interface NavBarItem {
  label: React.ReactNode;
  href?: string;
  active?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}
export interface NavBarProps {
  /** The brand slot: the RxDx mark and name. */
  brand?: React.ReactNode;
  items?: NavBarItem[];
  /** Right-hand slot (left under RTL): language switch, one primary Button. */
  actions?: React.ReactNode;
  /** aria-label of the <nav>. Default "Main". */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function NavBar(props: NavBarProps): React.ReactElement;

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  /** Help under the field; becomes the error message when invalid. */
  hint?: React.ReactNode;
  icon?: IconName | React.ReactNode;
  /** A node at the end of the box: a Button or a keyboard hint. */
  trailing?: React.ReactNode;
  /** pill = the search field. Default rounded. */
  shape?: 'rounded' | 'pill';
  invalid?: boolean;
}
export declare function Field(props: FieldProps): React.ReactElement;

declare global {
  interface Window {
    Nocturne: {
      Button: typeof Button; FloatButton: typeof FloatButton; GlassPanel: typeof GlassPanel;
      StatusPill: typeof StatusPill; VitalTile: typeof VitalTile; Waveform: typeof Waveform;
      RingGauge: typeof RingGauge; HoloPortrait: typeof HoloPortrait; NavBar: typeof NavBar;
      Field: typeof Field; Icon: typeof Icon & { names: IconName[] };
    };
  }
}
