"use client";

import { useState } from "react";
import { Search, Bell, ChevronDown, ClipboardList, User, Settings, LogOut } from "lucide-react";

export function TopNav() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 h-16 bg-white border-b border-zinc-200 flex items-center px-6 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-6">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-zinc-900">Fusion</span>
        <span className="text-zinc-300 mx-1">/</span>
        <span className="text-sm font-medium text-zinc-500">Tests</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search tests, roles, disciplines..."
          className="w-full pl-9 pr-4 h-9 text-sm bg-zinc-50 border border-zinc-200 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white
            placeholder:text-zinc-400 transition-all duration-200"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center
              hover:bg-zinc-100 transition-colors duration-200"
          >
            <Bell className="w-4 h-4 text-zinc-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-black rounded-full" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-11 w-72 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <p className="text-sm font-semibold text-zinc-900">Notifications</p>
              </div>
              {[
                { text: "Senior FE Assessment published", time: "2m ago" },
                { text: "Data Analyst test reached 60 candidates", time: "1h ago" },
                { text: "New question library update available", time: "3h ago" },
              ].map((n, i) => (
                <div key={i} className="px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer border-b border-zinc-50">
                  <p className="text-sm text-zinc-800">{n.text}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{n.time}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2 h-9 px-3 rounded-lg
              hover:bg-zinc-100 transition-colors duration-200"
          >
            <div className="w-7 h-7 bg-zinc-900 rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-white">RN</span>
            </div>
            <span className="text-sm font-medium text-zinc-700 hidden sm:block">Raed Nas</span>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-11 w-52 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <p className="text-sm font-semibold text-zinc-900">Raed Nas</p>
                <p className="text-xs text-zinc-400">raed@fusion.hr</p>
              </div>
              {[
                { icon: User, label: "Profile" },
                { icon: Settings, label: "Settings" },
                { icon: LogOut, label: "Sign out" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700
                    hover:bg-zinc-50 transition-colors duration-150 text-left"
                >
                  <Icon className="w-4 h-4 text-zinc-400" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Click-away overlay */}
      {(profileOpen || notifOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setProfileOpen(false); setNotifOpen(false); }}
        />
      )}
    </header>
  );
}