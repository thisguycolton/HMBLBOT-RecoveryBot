import { 
  Heart, 
  Users, 
  Lock, 
  Smile, 
  Sprout, 
  Sun, 
  Sparkles, 
  Zap, 
  Waves, 
  MessageCircle, 
  HandHeart, 
  Footprints,
  HelpCircle,
  Calendar,
  Wallet,
  Home,
  Mountain,
  ShieldCheck,
  Sunrise,
  HandHelping,
  Flame,
  ShieldAlert,
  ClipboardList
} from "lucide-react";

// Mapping from icon_name (stored in database) to Lucide React components
export const TAG_ICONS = {
  // Emotional/Recovery themes
  heart: Heart,
  "hand-heart": HandHeart,
  sparkles: Sparkles,
  sprout: Sprout,
  sun: Sun,
  
  // Social/Community
  users: Users,
  "message-circle": MessageCircle,
  
  // Steps/Work
  footprints: Footprints,
  "clipboard-list": ClipboardList,
  
  // Challenges
  lock: Lock,
  zap: Zap,
  waves: Waves,
  flame: Flame,
  "shield-alert": ShieldAlert,
  
  // Positive themes
  smile: Smile,
  "shield-check": ShieldCheck,
  sunrise: Sunrise,
  
  // Life areas
  wallet: Wallet,
  home: Home,
  calendar: Calendar,
  mountain: Mountain,
};

// Mapping from tag slug to accent color scheme
export const TAG_SLUG_COLORS = {
  // Emotional/Spiritual themes - rose/pink tones
  "emotional-sobriety": "rose",
  
  // Gratitude - amber/gold
  gratitude: "amber",
  
  // Fellowship/Community - blue tones
  fellowship: "blue",
  
  // Family - violet/purple
  family: "violet",
  
  // Finances/Money - emerald/green
  "finances-money": "emerald",
  
  // Fun - yellow/gold
  "fun-in-sobriety": "yellow",
  
  // Health - cyan/teal
  health: "cyan",
  
  // Holidays - orange/warm
  holidays: "orange",
};

// Accent color definitions with Tailwind-compatible classes
export const ACCENT_THEMES = {
  rose: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-400",
    iconBg: "bg-rose-500/20",
    gradient: "from-rose-500/5",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    iconBg: "bg-amber-500/20",
    gradient: "from-amber-500/5",
  },
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    iconBg: "bg-blue-500/20",
    gradient: "from-blue-500/5",
  },
  violet: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    text: "text-violet-400",
    iconBg: "bg-violet-500/20",
    gradient: "from-violet-500/5",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    iconBg: "bg-emerald-500/20",
    gradient: "from-emerald-500/5",
  },
  yellow: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    iconBg: "bg-yellow-500/20",
    gradient: "from-yellow-500/5",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    iconBg: "bg-cyan-500/20",
    gradient: "from-cyan-500/5",
  },
  orange: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-400",
    iconBg: "bg-orange-500/20",
    gradient: "from-orange-500/5",
  },
  // Fallback neutral
  neutral: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
    iconBg: "bg-slate-500/20",
    gradient: "from-slate-500/5",
  },
};

// Get the Lucide component for an icon_name
export const getTagIcon = (iconName) => {
  if (!iconName) return HelpCircle;
  
  // Try direct match first
  let icon = TAG_ICONS[iconName];
  
  // Try converting from slug format (e.g., "emotional-sobriety" -> try to map)
  if (!icon) {
    // Map some common slug patterns to icon names
    const slugToIcon = {
      "emotional-sobriety": "heart",
      "acceptance": "hand-heart",
      "step-work": "footprints",
      "spirituality": "sun",
      "recovery": "sprout",
      "service": "hand-heart",
      "fellowship": "users",
      "gratitude": "sparkles",
      "humor": "smile",
      "corrections": "lock",
      "fear": "waves",
      "resentment": "zap",
      "meetings": "message-circle",
      "relationships": "users",
      "inventory": "clipboard-list",
    };
    icon = TAG_ICONS[slugToIcon[iconName]];
  }
  
  return icon || HelpCircle;
};

// Get the accent color name for a tag slug
export const getTagAccent = (slug) => {
  return TAG_SLUG_COLORS[slug] || "neutral";
};

// Get accent theme object for a slug
export const getAccentTheme = (slug) => {
  const accentName = getTagAccent(slug);
  return ACCENT_THEMES[accentName] || ACCENT_THEMES.neutral;
};

// Get accent theme based on icon_name (fallback when slug not available)
export const getAccentThemeFromIcon = (iconName) => {
  if (!iconName) return ACCENT_THEMES.neutral;
  
  // Map icon names to accent themes
  const iconToAccent = {
    heart: "rose",
    "hand-heart": "rose",
    sparkles: "amber",
    sprout: "emerald",
    sun: "amber",
    users: "blue",
    "message-circle": "blue",
    footprints: "amber",
    "clipboard-list": "indigo",
    lock: "slate",
    zap: "red",
    waves: "sky",
    flame: "orange",
    "shield-alert": "yellow",
    smile: "yellow",
    "shield-check": "emerald",
    sunrise: "amber",
    wallet: "emerald",
    home: "violet",
    calendar: "purple",
    mountain: "stone",
  };
  
  const accentName = iconToAccent[iconName];
  if (accentName && ACCENT_THEMES[accentName]) {
    return ACCENT_THEMES[accentName];
  }
  
  // Fallback based on icon category
  if (["heart", "hand-heart"].includes(iconName)) return ACCENT_THEMES.rose;
  if (["sparkles", "sun"].includes(iconName)) return ACCENT_THEMES.amber;
  if (["users", "message-circle"].includes(iconName)) return ACCENT_THEMES.blue;
  if (["sprout", "shield-check"].includes(iconName)) return ACCENT_THEMES.emerald;
  
  return ACCENT_THEMES.neutral;
};
