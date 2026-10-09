import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { DeviceList } from './components/DeviceList.tsx';
import { DeviceDetail } from './components/DeviceDetail.tsx';
import { PacketInspector } from './components/PacketInspector.tsx';
import { TestClientSimulator } from './components/TestClientSimulator.tsx';
import { PrivacyPolicy } from './components/PrivacyPolicy.tsx';
import { DeviceInfo, TelemetrySnapshot } from './types/fleet.ts';
import { Smartphone, Radio } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('fleet');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [serverHealthy, setServerHealthy] = useState<boolean>(true);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [simTargetImei, setSimTargetImei] = useState<string>('123456789012345');

  // Check health
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setServerHealthy(true);
      } else {
        setServerHealthy(false);
      }
    } catch {
      setServerHealthy(false);
    }
  }, []);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data: DeviceInfo[] = await res.json();
        setDevices(data);
        if (!selectedImei && data.length > 0) {
          setSelectedImei(data[0].imei);
        }
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [selectedImei]);

  // Fetch telemetry for selected device
  const fetchTelemetry = useCallback(async (imei: string) => {
    setIsLoadingTelemetry(true);
    try {
      const res = await fetch(`/api/devices/${imei}/latest`);
      if (res.ok) {
        const data: TelemetrySnapshot = await res.json();
        setTelemetry(data);
      } else {
        setTelemetry(null);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
      setTelemetry(null);
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    checkHealth();
    fetchDevices();
  }, [checkHealth, fetchDevices]);

  // Load telemetry when selected IMEI changes
  useEffect(() => {
    if (selectedImei) {
      fetchTelemetry(selectedImei);
    } else {
      setTelemetry(null);
    }
  }, [selectedImei, fetchTelemetry]);

  // Periodic polling for devices & telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDevices();
      if (selectedImei) {
        fetchTelemetry(selectedImei);
      }
      checkHealth();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchTelemetry, selectedImei, checkHealth]);

  const handleToggleConnection = async (imei: string) => {
    try {
      const res = await fetch(`/api/devices/${imei}/toggle-connection`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchDevices();
      }
    } catch (err) {
      console.error('Failed to toggle connection:', err);
    }
  };

  const handleOpenSimulatorForImei = (imei: string) => {
    setSimTargetImei(imei);
    setCurrentTab('simulator');
  };

  const handlePacketSent = (imei: string) => {
    setSelectedImei(imei);
    fetchDevices();
    fetchTelemetry(imei);
  };

  const selectedDevice = devices.find((d) => d.imei === selectedImei) || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        serverHealthy={serverHealthy}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentTab === 'fleet' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
            {/* Left Column: Device List */}
            <div className="lg:col-span-5 xl:col-span-4 h-full">
              <DeviceList
                devices={devices}
                selectedImei={selectedImei}
                onSelectImei={(imei) => setSelectedImei(imei)}
                onRefresh={fetchDevices}
                isLoading={isLoadingDevices}
                onOpenSimulatorForImei={handleOpenSimulatorForImei}
              />
            </div>

            {/* Right Column: Device Details */}
            <div className="lg:col-span-7 xl:col-span-8 h-full">
              {selectedDevice ? (
                <DeviceDetail
                  device={selectedDevice}
                  telemetry={telemetry}
                  isLoadingTelemetry={isLoadingTelemetry}
                  onRefreshTelemetry={() => selectedImei && fetchTelemetry(selectedImei)}
                  onToggleConnection={handleToggleConnection}
                  onSimulateForDevice={handleOpenSimulatorForImei}
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center h-full flex flex-col items-center justify-center text-slate-400">
                  <Smartphone className="w-12 h-12 mb-3 opacity-40 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-700">No Device Selected</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Select a tracker device from the list on the left to inspect its live AVL
                    telemetry, coordinates, and IO sensors.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentTab === 'inspector' && <PacketInspector />}

        {currentTab === 'simulator' && (
          <TestClientSimulator
            initialImei={simTargetImei}
            onPacketSent={handlePacketSent}
          />
        )}

        {currentTab === 'privacy' && <PrivacyPolicy />}
      </main>

      {/* Footer matching Razor layout */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            &copy; 2026 <span className="font-semibold text-slate-700">ZainFleet</span> &bull; Teltonika GPS Tracking TCP Server
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              <span>TCP: 0.0.0.0:5000</span>
            </span>
            <span>&bull;</span>
            <button
              onClick={() => setCurrentTab('privacy')}
              className="text-blue-600 hover:underline"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
