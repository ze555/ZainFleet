import React from 'react';
import { ShieldCheck, Lock, Database, Radio } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 p-8 shadow-xs space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          ZainFleet Teltonika TCP Server & Fleet Ingestion Service
        </p>
      </div>

      <div className="prose prose-slate max-w-none text-sm space-y-4 text-slate-700 leading-relaxed">
        <p>
          This privacy policy describes how the ZainFleet Teltonika server handles telemetry, device
          identifiers (IMEI), and GPS coordinates transmitted by fleet hardware trackers.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6 not-prose">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Radio className="w-5 h-5 text-blue-600 mb-2" />
            <h3 className="font-bold text-xs text-slate-900 mb-1">Raw TCP Handshake</h3>
            <p className="text-xs text-slate-500">
              Only authentic 15-digit ASCII IMEIs are accepted. Invalid packets are rejected immediately.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Database className="w-5 h-5 text-indigo-600 mb-2" />
            <h3 className="font-bold text-xs text-slate-900 mb-1">In-Memory Telemetry</h3>
            <p className="text-xs text-slate-500">
              Telemetry snapshots and AVL coordinates are kept in memory for real-time monitoring and fleet visibility.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <Lock className="w-5 h-5 text-emerald-600 mb-2" />
            <h3 className="font-bold text-xs text-slate-900 mb-1">Encrypted Transit</h3>
            <p className="text-xs text-slate-500">
              Web management and API endpoints operate over encrypted HTTPS protocols with health verification.
            </p>
          </div>
        </div>

        <h2 className="text-base font-bold text-slate-900 pt-2">Data Processing Notice</h2>
        <p>
          Values generated in simulation tools or test suites are test fixtures and not live real-world tracking.
          Production deployments should configure secure TCP proxy tunnels and dedicated database persistence
          prior to connecting commercial Teltonika devices.
        </p>
      </div>
    </div>
  );
};
