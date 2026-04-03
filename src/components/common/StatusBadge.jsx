import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function StatusBadge({ isOnline }) {
  return isOnline
    ? <span className="cloud-badge ok"><Wifi size={12} /> Online</span>
    : <span className="cloud-badge error"><WifiOff size={12} /> Offline</span>;
}
