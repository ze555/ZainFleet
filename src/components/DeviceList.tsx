import React from 'react';
import { DeviceInfo } from '../types/fleet.js';
import { Smartphone, RefreshCw, Signal, Clock, Search, Gauge } from 'lucide-react';

interface DeviceListProps {
  devices: DeviceInfo[];
  selectedImei: string | null;
  onSelectImei: (imei: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenSimulatorForImei: (imei: string) => void;
}

export const DeviceList: React.FC<DeviceListProps> = ({
  devices,
  selectedImei,
  onSelectImei,
  onRefresh,
  isLoading,
  onOpenSimulatorForImei,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'connected' | 'disconnected'>('all');

  const filteredDevices = devices.filter((d) => {
    const matchesSearch = d.imei.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'connected') return d.connected;
    if (filter === 'disconnected') return !d.connected;
    return true;
  });

  const connectedCount = devices.filter((d) => d.connected).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tracked Devices</h2>
            <p className="text-xs text-slate-500">
              {devices.length} registered • {connectedCount} active TCP sessions
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh devices"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by IMEI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({devices.length})
          </button>
          <button
            onClick={() => setFilter('connected')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === 'connected'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Online ({connectedCount})
          </button>
          <button
            onClick={() => setFilter('disconnected')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              filter === 'disconnected'
                ? 'bg-slate-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Offline ({devices.length - connectedCount})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredDevices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No devices matching filter</p>
          </div>
        ) : (
          filteredDevices.map((device) => {
            const isSelected = device.imei === selectedImei;
            return (
              <div
                key={device.imei}
                onClick={() => onSelectImei(device.imei)}
                className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between group ${
                  isSelected
                    ? 'bg-blue-50/70 border-l-4 border-blue-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      device.connected
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900 truncate">
                        {device.imei}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          device.connected
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Signal className="w-2.5 h-2.5" />
                        {device.connected ? 'Online' : 'Offline'}
                      </span>
                      {device.imei !== '123456789012345' && device.imei !== '860293048172941' ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-100 text-blue-800 font-bold uppercase tracking-wider">
                          Live Hardware
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500 font-medium">
                          Demo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1" title="Last seen">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(device.lastSeen).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSimulatorForImei(device.imei);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition-all"
                  title="Open CAN Bus Live Dashboard"
                >
                  <Gauge className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
