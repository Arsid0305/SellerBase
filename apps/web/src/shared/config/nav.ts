import {
  LayoutDashboard,
  PackageSearch,
  Boxes,
  Wallet,
  Repeat,
  FileBarChart,
  Receipt,
  MessageSquare,
  Percent,
  Coins,
  Sigma,
  Truck,
  Warehouse,
  CalendarRange,
  Bell,
  TrendingDown,
  ShieldCheck,
  Calculator,
  Package,
  ScanSearch,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  group: 'analytics' | 'operations' | 'management' | 'external' | 'data';
  /**
   * Метка площадки. Решение владелицы 17.09.2026: если раздел живёт только
   * на одной площадке - это должно быть видно в меню, а не выясняться на
   * пустом экране после переключателя каналов.
   *
   * WB стоит там, где данных Ozon не будет в принципе: отзывы, SEO и тарифы
   * у площадок свои, симулятор считает по отчёту реализации ВБ. Разделы без
   * метки работают или будут работать по обеим площадкам.
   */
  badge?: string;
};

export const navGroups: { id: NavItem['group']; title: string }[] = [
  { id: 'analytics', title: 'Аналитика' },
  { id: 'operations', title: 'Операции' },
  { id: 'data', title: 'Данные' },
];

export const navItems: NavItem[] = [
  { title: 'Сводка', href: '/dashboard', icon: LayoutDashboard, group: 'analytics' },
  { title: 'Мои товары', href: '/products', icon: Boxes, group: 'analytics' },
  { title: 'Себестоимость', href: '/products/costs', icon: Coins, group: 'analytics' },
  { title: 'SEO карточек', href: '/seo', icon: ScanSearch, group: 'analytics', badge: 'WB' },
  { title: 'Товарная аналитика', href: '/analytics', icon: PackageSearch, group: 'analytics' },
  { title: 'Прибыль и убытки', href: '/pnl', icon: Wallet, group: 'analytics' },
  { title: 'Остатки и оборачиваемость', href: '/turnover', icon: Repeat, group: 'analytics' },
  { title: 'Отчёт по продажам', href: '/sales-report', icon: FileBarChart, group: 'analytics' },
  { title: 'Pareto 80/20', href: '/analytics/pareto', icon: Sigma, group: 'analytics' },
  {
    title: 'Аналитика по неделям',
    href: '/analytics/weekly',
    icon: CalendarRange,
    group: 'analytics',
  },
  { title: 'Анализатор маржи', href: '/analytics/margin', icon: TrendingDown, group: 'analytics' },
  { title: 'Промо-акции', href: '/promo', icon: Percent, group: 'operations' },
  { title: 'Остаток на фулфилменте', href: '/products/stock', icon: Warehouse, group: 'operations' },
  { title: 'Поставки', href: '/supplies', icon: Truck, group: 'operations' },
  { title: 'Заказы Китая', href: '/supplies/china-order', icon: Package, group: 'operations' },
  { title: 'Отзывы и оценки', href: '/reviews', icon: MessageSquare, group: 'operations', badge: 'WB' },
  { title: 'Тарифы и коэффициенты', href: '/tariffs', icon: Percent, group: 'data', badge: 'WB' },
  { title: 'Мои расходы', href: '/expenses', icon: Receipt, group: 'data' },
  { title: 'Уведомления', href: '/settings/notifications', icon: Bell, group: 'data' },
  { title: 'Качество данных', href: '/data-quality', icon: ShieldCheck, group: 'data' },
  { title: 'Цены', href: '/price-simulator', icon: Calculator, group: 'data' },
];
