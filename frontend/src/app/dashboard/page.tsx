'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { orgApi, workbookApi } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const { accessToken, user, logout } = useAuthStore();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [workbooks, setWorkbooks] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }
    loadOrgs();
  }, [accessToken]);

  async function loadOrgs() {
    try {
      setLoading(true);
      const data = await orgApi.list(accessToken!);
      setOrgs(Array.isArray(data) ? data : []);
      if (data?.length > 0) {
        setSelectedOrg(data[0].id);
        loadWorkbooks(data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkbooks(orgId: string) {
    try {
      const data = await workbookApi.list(accessToken!, orgId);
      setWorkbooks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createWorkbook() {
    if (!selectedOrg) return;
    const name = prompt('Workbook name?');
    if (!name) return;
    try {
      await workbookApi.create(accessToken!, selectedOrg, { name });
      loadWorkbooks(selectedOrg);
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleLogout() {
    logout();
    router.push('/');
  }

  if (!accessToken) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              SS
            </div>
            <span className="font-semibold text-slate-900">Secure Sheets</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar - Orgs */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-800 mb-3">Organizations</h2>
              {orgs.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No organizations yet. Create one via API as platform admin.
                </p>
              ) : (
                <ul className="space-y-1">
                  {orgs.map((org) => (
                    <li key={org.id}>
                      <button
                        onClick={() => {
                          setSelectedOrg(org.id);
                          loadWorkbooks(org.id);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                          selectedOrg === org.id
                            ? 'bg-sky-50 text-sky-700 font-medium'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {org.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Main - Workbooks */}
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Workbooks</h2>
                <button
                  onClick={createWorkbook}
                  disabled={!selectedOrg}
                  className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50"
                >
                  + New Workbook
                </button>
              </div>

              {workbooks.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                  <p className="text-slate-400">No workbooks yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Create one to get started
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {workbooks.map((wb) => (
                    <div
                      key={wb.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-sky-300 transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-slate-900">{wb.name}</h3>
                          {wb.description && (
                            <p className="text-sm text-slate-500 mt-0.5">
                              {wb.description}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-2">
                            {wb.sheets?.length || 0} sheet(s)
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(wb.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {wb.sheets?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {wb.sheets.map((s: any) => (
                            <button
                              key={s.id}
                              onClick={() => router.push(`/sheet/${s.id}`)}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-sky-50 text-xs text-sky-700 hover:bg-sky-100 transition font-medium"
                            >
                              {s.name} →
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
