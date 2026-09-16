import { Sidenav } from './sidenav';
import { Topbar } from './topbar';
import { fetchMenuLayout } from '@/entities/menu-layout/queries';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const entries = await fetchMenuLayout();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidenav entries={entries} />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
