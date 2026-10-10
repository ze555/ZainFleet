import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { DeviceList } from './components/DeviceList.tsx';
import { DeviceDetail } from './components/DeviceDetail.tsx';
import { CanBusDashboard } from './components/CanBusDashboard.tsx';
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
          // Prioritize authentic hardware tracker over demo fixtures
          const realDevice = data.find(
            (d) => d.imei !== '123456789012345' && d.imei !== '860293048172941'
          );
          setSelectedImei(realDevice ? realDevice.imei : data[0].imei);
        }
      }
    } catch {
      // Quietly ignore transient network/reboot interruptions
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
    } catch {
      // Quietly ignore transient network/reboot interruptions
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

  const handleOpenCanBus = () => {
    setCurrentTab('canbus');
  };

  const selectedDevice = devices.find((d) => d.imei === selectedImei) || (devices.length > 0 ? devices[0] : null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        serverHealthy={serverHealthy}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentTab === 'fleet' && (
          devices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs max-w-2xl mx-auto my-8 space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Waiting for Teltonika FMB140 Tracker
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                The TCP ingestion server is active and listening for live vehicle data from your hardware device.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left space-y-2.5 font-mono">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-sans">Server Status:</span>
                  <span className="text-emerald-600 font-bold">● TCP Listening on Port 5000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Railway TCP Proxy:</span>
                  <span className="text-slate-800 font-bold">hayabusa.proxy.rlwy.net:39512</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Protocol:</span>
                  <span className="text-blue-600 font-bold">Teltonika Codec 8 / 8 Extended</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
              {/* Left Column: Device List */}
              <div className="lg:col-span-5 xl:col-span-4 h-full">
                <DeviceList
                  devices={devices}
                  selectedImei={selectedImei}
                  onSelectImei={(imei) => setSelectedImei(imei)}
                  onRefresh={fetchDevices}
                  isLoading={isLoadingDevices}
                  onOpenSimulatorForImei={handleOpenCanBus}
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
                    onSimulateForDevice={handleOpenCanBus}
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
          )
        )}

        {currentTab === 'canbus' && (
          <CanBusDashboard
            device={selectedDevice}
            telemetry={telemetry}
            isLoading={isLoadingTelemetry}
            onRefresh={() => selectedImei && fetchTelemetry(selectedImei)}
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
