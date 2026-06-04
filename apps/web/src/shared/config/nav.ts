import {
  LayoutDashboard,
  PackageSearch,
  Boxes,
  Wallet,
  Repeat,
  AlertTriangle,
  FileBarChart,
  Megaphone,
  Network,
  Search,
  Receipt,
  MessageSquare,
  Percent,
  Target,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  group: 'analytics' | 'management' | 'operations' | 'external' | 'data';
  badge?: string;
};

export const navGroups: { id: NavItem['group']; title: string }[] = [
  { id: 'analytics', title: 'Аналитика' },
  { id: 'management', title: 'Управление' },
  { id: 'operations', title: 'Операции' },
  { id: 'external', title: 'Рынок' },
  { id: 'data', title: 'Данные' },
];

export const navItems: NavItem[] = [
  { title: 'Сводка', href: '/dashboard', icon: LayoutDashboard, group: 'analytics' },
  { title: 'Мои товары', href: '/products', icon: Boxes, group: 'analytics' },
  { title: 'Товарная аналитика', href: '/analytics', icon: PackageSearch, group: 'analytics' },
  { title: 'Прибыль и убытки', href: '/pnl', icon: Wallet, group: 'analytics' },
  { title: 'Оборачиваемость', href: '/turnover', icon: Repeat, group: 'analytics' },
  { title: 'Отчёт по продажам', href: '/sales-report', icon: FileBarChart, group: 'analytics' },
  { title: 'Цели', href: '/goals', icon: Target, group: 'management' },
  { title: 'Дефицит товаров', href: '/deficit', icon: AlertTriangle, group: 'operations' },
  { title: 'Отзывы и оценки', href: '/reviews', icon: MessageSquare, group: 'operations' },
  { title: 'Реклама товаров', href: '/ads', icon: Megaphone, group: 'operations', badge: 'позже' },
  { title: 'Источники заказов', href: '/sources', icon: Network, group: 'operations', badge: 'скоро' },
  { title: 'Поиск ниши WB', href: '/niche', icon: Search, group: 'external', badge: 'позже' },
  { title: 'Тарифы и коэффициенты', href: '/tariffs', icon: Percent, group: 'data' },
  { title: 'Мои расходы', href: '/expenses', icon: Receipt, group: 'data' },
];
