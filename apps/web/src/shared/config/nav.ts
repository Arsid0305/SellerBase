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
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  group: 'analytics' | 'operations' | 'external' | 'data';
  badge?: string;
};

export const navGroups: { id: NavItem['group']; title: string }[] = [
  { id: 'analytics', title: 'Аналитика' },
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
  { title: 'Дефицит товаров', href: '/deficit', icon: AlertTriangle, group: 'operations' },
  { title: 'Реклама товаров', href: '/ads', icon: Megaphone, group: 'operations', badge: 'позже' },
  { title: 'Источники заказов', href: '/sources', icon: Network, group: 'operations', badge: 'скоро' },
  { title: 'Поиск ниши Ozon', href: '/niche', icon: Search, group: 'external', badge: 'позже' },
  { title: 'Мои расходы', href: '/expenses', icon: Receipt, group: 'data' },
  { title: 'Клиенты', href: '/customers', icon: Users, group: 'data', badge: 'скоро' },
];
