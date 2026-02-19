"use client";

import { Smartphone, Monitor, Cpu, Phone } from "lucide-react";
import type { DeviceStatus } from "@/lib/sync";

const deviceIcons: Record<string, React.ReactNode> = {
  "raspberry-pi": <Cpu className="w-5 h-5" />,
  phone: <Phone className="w-5 h-5" />,
  whatsapp: <Smartphone className="w-5 h-5" />,
  dashboard: <Monitor className="w-5 h-5" />,
};

const statusColors: Record<string, string> = {
  idle: "bg-gray-500",
  listening: "bg-yellow-400",
  active: "bg-green-400",
  offline: "bg-red-500",
};

interface DevicePanelProps {
  devices: DeviceStatus[];
}

export default function DevicePanel({ devices }: DevicePanelProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Devices
      </h2>
      {devices.length === 0 && (
        <p className="text-sm text-gray-500">No devices connected</p>
      )}
      {devices.map((d) => (
        <div
          key={d.device}
          className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
        >
          <div className="text-gray-400">
            {deviceIcons[d.device] || <Monitor className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{d.device}</div>
            <div className="text-xs text-gray-500">
              {d.last_seen
                ? new Date(d.last_seen).toLocaleTimeString()
                : "never"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${statusColors[d.status] || statusColors.offline}`}
            />
            <span className="text-xs text-gray-400">{d.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
