import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
