import fs from 'node:fs';
import path from 'node:path';
import { AvlRecord } from '../types/fleet.js';
import { CAN_PARAMETER_CATALOG, decodeCanMetrics } from './canBusDecoder.js';

export interface PacketDiagnosticEntry {
  // A. Connection Information
  connection: {
    imei: string;
    receivedAtUtc: string; // ISO 8601 UTC
    clientIp: string;
    clientPort: number;
    packetSizeBytes: number;
    connectionStatus: 'connected' | 'disconnected' | 'error';
    connectionNote?: string;
  };

  // B. Raw Packet Information
  rawPacket: {
    fullHex: string; // Full hex string of the entire packet (not truncated)
    packetLengthBytes: number;
    codecId: string; // e.g. "0x08 (Codec 8)" or "0x8E (Codec 8 Extended)"
    recordCount: number;
    bytesConsumed: number;
    preambleValid: boolean;
    crc16: {
      transmitted: string;
      calculated: string;
      valid: boolean;
    };
    structureValidation: {
      status: 'OK' | 'CRC_MISMATCH' | 'CORRUPTED' | 'TRUNCATED';
      details: string;
    };
  };

  // C. AVL Records Data
  avlRecords: Array<{
    recordIndex: number;
    deviceTimestampUtc: string;
    deviceTimestampMs: number;
    priority: number;
    priorityLabel: 'Low' | 'High' | 'Panic' | 'Unknown';
    eventIoId: number;
    gps: {
      latitude: number;
      longitude: number;
      altitudeMeters: number;
      angleDegrees: number;
      satellites: number;
      speedKmh: number;
      validFix: boolean;
    };
    allIoElementsReceived: Array<{
      id: number;
      rawHexOrValue: string;
      byteLength?: number;
      catalogNameEn?: string;
      catalogNameAr?: string;
      unit?: string;
      decodedValue?: string | number | boolean | null;
      isCatalogKnown: boolean;
    }>;
  }>;

  // D. CAN / OBD & Battery Voltage Deep Audit
  canObdAudit: {
    // ID 66: External / Vehicle Battery Voltage Audit
    vehicleBatteryVoltageId66: {
      isSentByDevice: boolean;
      rawMillivolts: string | null;
      scaledVolts: number | null;
      status: 'PRESENT_NORMAL' | 'PRESENT_LOW' | 'MISSING_NOT_CONFIGURED';
      diagnosisAr: string;
      diagnosisEn: string;
    };

    // ID 67: Internal Tracker Backup Battery
    trackerBackupBatteryId67: {
      isSentByDevice: boolean;
      rawMillivolts: string | null;
      scaledVolts: number | null;
      noteAr: string;
      noteEn: string;
    };

    // CAN Bus & OBD Parameters Audit
    canBusStatus: {
      totalCanParametersDetected: number;
      detectedCanIoIds: number[];
      isVehicleCanCommunicating: boolean;
      diagnosisAr: string;
      diagnosisEn: string;
    };

    // Diagnostic Trouble Codes (DTC) & MIL Check Engine Lamp
    diagnosticTroubleCodes: {
      milLampActive: boolean;
      dtcCountReported: number;
      rawDtcData: string | null;
      activeTroubleCodes: Array<{
        code: string;
        standard: string;
        subsystemEn: string;
        subsystemAr: string;
        descriptionEn: string;
        descriptionAr: string;
        severity: 'low' | 'medium' | 'high';
      }>;
      statusAr: string;
      statusEn: string;
    };

    // Detailed parameters table comparing Raw vs Scaled Engineering values
    decodedParametersTable: Array<{
      avlId: number;
      nameEn: string;
      nameAr: string;
      rawBeforeMultiplier: string;
      multiplierApplied: string;
      scaledEngineeringValue: string | number;
      unit: string;
      source: string;
    }>;
  };
}

export class DiagnosticFileManager {
  private readonly dirPath: string;
  private readonly jsonFilePath: string;
  private readonly logFilePath: string;
  private entries: PacketDiagnosticEntry[] = [];
  private readonly MAX_ENTRIES = 200;

  constructor() {
    this.dirPath = path.resolve(process.cwd(), 'diagnostics');
    this.jsonFilePath = path.join(this.dirPath, 'fmb140_packet_diagnostic.json');
    this.logFilePath = path.join(this.dirPath, 'fmb140_packet_diagnostic.log');
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
      }

      if (fs.existsSync(this.jsonFilePath)) {
        const raw = fs.readFileSync(this.jsonFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed.slice(-this.MAX_ENTRIES);
        }
      } else {
        // Initialize with empty array
        this.saveJson();
      }

      if (!fs.existsSync(this.logFilePath)) {
        this.initLogFileHeader();
      }
    } catch (e) {
      console.warn('[DiagnosticLogger] Notice initializing diagnostic storage:', e);
    }
  }

  private initLogFileHeader() {
    const header = [
      '================================================================================',
      '         ZAINFLEET TELTONIKA FMB140 PACKET & CAN/OBD DIAGNOSTIC LOG             ',
      '================================================================================',
      `Created: ${new Date().toISOString()}`,
      'Target Device: Teltonika FMB140 GPS & CAN/OBD Tracker',
      'Protocol: Teltonika AVL Codec 8 / Codec 8 Extended over TCP (Port 5000)',
      'Primary Focus: Vehicle Battery Voltage (AVL ID 66), CAN Bus telemetry, and DTCs',
      '================================================================================\n\n',
    ].join('\n');

    try {
      fs.writeFileSync(this.logFilePath, header, 'utf-8');
    } catch {}
  }

  public recordPacket(
    imei: string,
    clientIp: string,
    clientPort: number,
    packetBytes: Uint8Array,
    decoded: {
      validPreamble: boolean;
      dataLength: number;
      expectedCrc: number;
      actualCrc: number;
      crcValid: boolean;
      codecId: number;
      records: AvlRecord[];
    }
  ): PacketDiagnosticEntry {
    const receivedAtUtc = new Date().toISOString();
    let fullHex = '';
    for (let i = 0; i < packetBytes.length; i++) {
      fullHex += packetBytes[i].toString(16).padStart(2, '0').toUpperCase();
    }

    const codecStr =
      decoded.codecId === 0x8e
        ? '0x8E (Codec 8 Extended)'
        : decoded.codecId === 0x08
        ? '0x08 (Codec 8)'
        : `0x${decoded.codecId.toString(16).toUpperCase()}`;

    // Examine records and assemble deep audit
    const avlRecordsMapped = decoded.records.map((rec, idx) => {
      const priorityLabel: 'Low' | 'High' | 'Panic' | 'Unknown' =
        rec.priority === 0 ? 'Low' : rec.priority === 1 ? 'High' : rec.priority === 2 ? 'Panic' : 'Unknown';

      const allIoElements = (rec.ioElements || []).map((el) => {
        const cat = CAN_PARAMETER_CATALOG[el.id];
        return {
          id: el.id,
          rawHexOrValue: el.value,
          byteLength: el.byteLength,
          catalogNameEn: cat?.nameEn || `Uncataloged IO ID ${el.id}`,
          catalogNameAr: cat?.nameAr || `عنصر غير معرّف ID ${el.id}`,
          unit: cat?.unit || 'raw',
          decodedValue: cat?.multiplier ? Number(el.value) * cat.multiplier : el.value,
          isCatalogKnown: !!cat,
        };
      });

      return {
        recordIndex: idx + 1,
        deviceTimestampUtc: rec.timestamp,
        deviceTimestampMs: rec.timestampMs,
        priority: rec.priority,
        priorityLabel,
        eventIoId: rec.eventIoId,
        gps: {
          latitude: rec.latitude,
          longitude: rec.longitude,
          altitudeMeters: rec.altitude,
          angleDegrees: rec.angle,
          satellites: rec.satellites,
          speedKmh: rec.speed,
          validFix: rec.latitude !== 0 || rec.longitude !== 0,
        },
        allIoElementsReceived: allIoElements,
      };
    });

    // Deep CAN/OBD and Battery Voltage Audit based on latest record
    const latestRecord = decoded.records[decoded.records.length - 1];
    const metrics = latestRecord ? decodeCanMetrics(latestRecord) : null;
    const ioMap = new Map<number, string>();
    if (latestRecord?.ioElements) {
      for (const el of latestRecord.ioElements) {
        ioMap.set(el.id, el.value);
      }
    }

    // Check ID 66: External Battery Voltage
    const id66Raw = ioMap.get(66) || null;
    let id66Volts: number | null = null;
    let id66Status: 'PRESENT_NORMAL' | 'PRESENT_LOW' | 'MISSING_NOT_CONFIGURED' = 'MISSING_NOT_CONFIGURED';
    let id66DiagnosisAr = '';
    let id66DiagnosisEn = '';

    if (id66Raw !== null) {
      const mv = Number(id66Raw);
      id66Volts = Math.round((mv / 1000) * 10) / 10;
      if (id66Volts < 11.5) {
        id66Status = 'PRESENT_LOW';
        id66DiagnosisAr = `العنصر ID 66 موجود ولكن الجهد منخفض (${id66Volts}V). تحقق من شحن بطارية السيارة.`;
        id66DiagnosisEn = `ID 66 is present but voltage is low (${id66Volts}V). Check vehicle battery charge.`;
      } else {
        id66Status = 'PRESENT_NORMAL';
        id66DiagnosisAr = `العنصر ID 66 موجود والجهد طبيعي (${id66Volts}V).`;
        id66DiagnosisEn = `ID 66 is present and voltage is normal (${id66Volts}V).`;
      }
    } else {
      id66Status = 'MISSING_NOT_CONFIGURED';
      id66DiagnosisAr =
        'تحذير: العنصر AVL ID 66 (External Voltage) غائب تماماً من حزمة البيانات! السبب الأكيد: لم يتم تفعيل ID 66 في قائمة I/O في برنامج Teltonika Configurator، أو أن سلك التغذية الخارجي (Red wire +12V) غير متصل وموصول فقط عبر USB.';
      id66DiagnosisEn =
        'CRITICAL WARNING: AVL ID 66 (External Voltage) is missing from this packet! Root cause: ID 66 is disabled or not set to Low/High priority in Teltonika Configurator I/O settings, or device is powered exclusively via USB without 12V vehicle battery power connected.';
    }

    // Check ID 67: Internal Li-Ion Battery
    const id67Raw = ioMap.get(67) || null;
    const id67Volts = id67Raw !== null ? Math.round((Number(id67Raw) / 1000) * 100) / 100 : null;

    // Verify provenance: tracker odometer ID 16 is NOT vehicle CAN data.
    // Only cataloged CAN/OBD sources count as CAN telemetry.
    const detectedCanIds = Array.from(ioMap.keys()).filter((id) => {
      const source = CAN_PARAMETER_CATALOG[id]?.source;
      return source === 'can_powertrain' || source === 'can_comfort' || source === 'obd';
    });
    const isVehicleCanCommunicating = detectedCanIds.length > 0;
    const canDiagnosisAr = isVehicleCanCommunicating
      ? `وصلت عناصر CAN/OBD المعرّفة: [${detectedCanIds.join(', ')}].`
      : 'حزمة AVL/GPS وصلت، لكن لم تظهر قراءات CAN/OBD مؤكدة. تحقق من توافق السيارة وإعداد CAN لدى FMB140 والتوصيلات وتفعيل عناصر CAN I/O. لا يمكن الجزم بسبب واحد من هذه الحزمة.';
    const canDiagnosisEn = isVehicleCanCommunicating
      ? `Cataloged CAN/OBD values received: [${detectedCanIds.join(', ')}].`
      : 'AVL/GPS data arrived but no verified CAN/OBD values were reported. Check vehicle CAN profile, wiring, ignition and enabled I/O; the packet alone cannot prove the cause.';

    // DTC codes
    const dtcInfo = metrics?.diagnostic || {
      milActive: false,
      dtcCount: 0,
      rawDtcString: null,
      dtcCodes: [],
      statusAr: 'لا توجد أعطال مسجلة',
      statusEn: 'No trouble codes reported',
    };

    // Decoded parameters comparison table
    const decodedParametersTable = Array.from(ioMap.entries()).map(([id, val]) => {
      const cat = CAN_PARAMETER_CATALOG[id];
      const scaledVal = cat?.multiplier ? Number(val) * cat.multiplier : val;
      return {
        avlId: id,
        nameEn: cat?.nameEn || `Custom / Unknown ID ${id}`,
        nameAr: cat?.nameAr || `عنصر غير معرّف ID ${id}`,
        rawBeforeMultiplier: val,
        multiplierApplied: cat?.multiplier ? `${cat.multiplier}` : '1 (None)',
        scaledEngineeringValue: scaledVal,
        unit: cat?.unit || 'raw',
        source: cat?.sourceBusLabelEn || cat?.source || 'Standard AVL',
      };
    });

    const entry: PacketDiagnosticEntry = {
      connection: {
        imei,
        receivedAtUtc,
        clientIp,
        clientPort,
        packetSizeBytes: packetBytes.length,
        connectionStatus: 'connected',
      },
      rawPacket: {
        fullHex,
        packetLengthBytes: packetBytes.length,
        codecId: codecStr,
        recordCount: decoded.records.length,
        bytesConsumed: packetBytes.length,
        preambleValid: decoded.validPreamble,
        crc16: {
          transmitted: `0x${decoded.expectedCrc.toString(16).toUpperCase()}`,
          calculated: `0x${decoded.actualCrc.toString(16).toUpperCase()}`,
          valid: decoded.crcValid,
        },
        structureValidation: {
          status: decoded.crcValid ? 'OK' : 'CRC_MISMATCH',
          details: decoded.crcValid
            ? 'Packet preamble (0x00000000) and CRC-16 polynomial 0xA001 matched successfully.'
            : 'CRC-16 checksum mismatch detected!',
        },
      },
      avlRecords: avlRecordsMapped,
      canObdAudit: {
        vehicleBatteryVoltageId66: {
          isSentByDevice: id66Raw !== null,
          rawMillivolts: id66Raw,
          scaledVolts: id66Volts,
          status: id66Status,
          diagnosisAr: id66DiagnosisAr,
          diagnosisEn: id66DiagnosisEn,
        },
        trackerBackupBatteryId67: {
          isSentByDevice: id67Raw !== null,
          rawMillivolts: id67Raw,
          scaledVolts: id67Volts,
          noteAr: 'جهد بطارية جهاز التتبع الاحتياطية الداخلية (Li-Ion 3.7V - 4.2V) — ليست بطارية السيارة!',
          noteEn: 'Internal tracker Li-Ion backup battery voltage (3.7V - 4.2V) — NOT the car battery!',
        },
        canBusStatus: {
          totalCanParametersDetected: detectedCanIds.length,
          detectedCanIoIds: detectedCanIds,
          isVehicleCanCommunicating,
          diagnosisAr: canDiagnosisAr,
          diagnosisEn: canDiagnosisEn,
        },
        diagnosticTroubleCodes: {
          milLampActive: dtcInfo.milActive,
          dtcCountReported: dtcInfo.dtcCount,
          rawDtcData: dtcInfo.rawDtcString,
          activeTroubleCodes: dtcInfo.dtcCodes,
          statusAr: dtcInfo.statusAr,
          statusEn: dtcInfo.statusEn,
        },
        decodedParametersTable,
      },
    };

    this.entries.push(entry);
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries.shift();
    }

    this.saveJson();
    this.appendHumanLog(entry);

    return entry;
  }

  private saveJson() {
    try {
      fs.writeFileSync(this.jsonFilePath, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[DiagnosticLogger] Notice writing JSON diagnostic log:', e);
    }
  }

  private appendHumanLog(e: PacketDiagnosticEntry) {
    const lines = [
      '--------------------------------------------------------------------------------',
      `[PACKET RECEIVED] ${e.connection.receivedAtUtc} | IMEI: ${e.connection.imei} | Socket: ${e.connection.clientIp}:${e.connection.clientPort}`,
      `Size: ${e.rawPacket.packetLengthBytes} bytes | Codec: ${e.rawPacket.codecId} | Records: ${e.rawPacket.recordCount} | CRC: ${e.rawPacket.crc16.calculated} (${e.rawPacket.crc16.valid ? 'VALID' : 'INVALID'})`,
      '--------------------------------------------------------------------------------',
      `FULL RAW HEX:\n${e.rawPacket.fullHex}`,
      '',
      '=== 1. VEHICLE BATTERY VOLTAGE AUDIT (AVL ID 66) ===',
      `Status: ${e.canObdAudit.vehicleBatteryVoltageId66.status}`,
      `ID 66 Sent By Device: ${e.canObdAudit.vehicleBatteryVoltageId66.isSentByDevice ? 'YES' : 'NO (MISSING!)'}`,
      `Raw Value (mV): ${e.canObdAudit.vehicleBatteryVoltageId66.rawMillivolts || 'N/A'}`,
      `Calculated Voltage: ${e.canObdAudit.vehicleBatteryVoltageId66.scaledVolts !== null ? `${e.canObdAudit.vehicleBatteryVoltageId66.scaledVolts} V` : 'N/A'}`,
      `Diagnosis (AR): ${e.canObdAudit.vehicleBatteryVoltageId66.diagnosisAr}`,
      `Diagnosis (EN): ${e.canObdAudit.vehicleBatteryVoltageId66.diagnosisEn}`,
      '',
      '=== 2. TRACKER INTERNAL BACKUP BATTERY (AVL ID 67) ===',
      `ID 67 Sent By Device: ${e.canObdAudit.trackerBackupBatteryId67.isSentByDevice ? 'YES' : 'NO'}`,
      `Calculated Voltage: ${e.canObdAudit.trackerBackupBatteryId67.scaledVolts !== null ? `${e.canObdAudit.trackerBackupBatteryId67.scaledVolts} V` : 'N/A'}`,
      `Note: ${e.canObdAudit.trackerBackupBatteryId67.noteEn}`,
      '',
      '=== 3. CAN BUS & OBD-II TELEMETRY AUDIT ===',
      `CAN Active: ${e.canObdAudit.canBusStatus.isVehicleCanCommunicating ? 'YES' : 'NO'}`,
      `Detected CAN IDs: [${e.canObdAudit.canBusStatus.detectedCanIoIds.join(', ')}]`,
      `Diagnosis (AR): ${e.canObdAudit.canBusStatus.diagnosisAr}`,
      `Diagnosis (EN): ${e.canObdAudit.canBusStatus.diagnosisEn}`,
      '',
      '=== 4. DIAGNOSTIC TROUBLE CODES (DTC) & MIL LAMP ===',
      `Check Engine Light (MIL): ${e.canObdAudit.diagnosticTroubleCodes.milLampActive ? 'ACTIVE (ON)' : 'OFF (NORMAL)'}`,
      `DTC Fault Count: ${e.canObdAudit.diagnosticTroubleCodes.dtcCountReported}`,
      `Raw DTC (AVL ID 282): ${e.canObdAudit.diagnosticTroubleCodes.rawDtcData || 'None'}`,
      `Status: ${e.canObdAudit.diagnosticTroubleCodes.statusEn} (${e.canObdAudit.diagnosticTroubleCodes.statusAr})`,
      ...(e.canObdAudit.diagnosticTroubleCodes.activeTroubleCodes.map(
        (c) => `  * ${c.code} [${c.subsystemEn} / ${c.subsystemAr}] - ${c.descriptionEn} (${c.descriptionAr}) - Severity: ${c.severity}`
      )),
      '',
      '=== 5. ALL IO ELEMENTS IN THIS PACKET (RAW vs SCALED) ===',
      ...e.canObdAudit.decodedParametersTable.map(
        (p) => `  ID ${p.avlId.toString().padStart(4, ' ')}: ${p.nameEn} | Raw: ${p.rawBeforeMultiplier} | Scaled: ${p.scaledEngineeringValue} ${p.unit}`
      ),
      '\n',
    ].join('\n');

    try {
      fs.appendFileSync(this.logFilePath, lines, 'utf-8');
    } catch (err) {
      console.warn('[DiagnosticLogger] Notice appending to log file:', err);
    }
  }

  public getSummary() {
    const totalPackets = this.entries.length;
    const latest = this.entries[this.entries.length - 1] || null;

    // Check if ID 66 was ever seen across all entries
    const id66EverSeen = this.entries.some((e) => e.canObdAudit.vehicleBatteryVoltageId66.isSentByDevice);
    const canEverSeen = this.entries.some((e) => e.canObdAudit.canBusStatus.isVehicleCanCommunicating);

    // Collect all unique IO IDs ever received
    const allSeenIoIds = new Set<number>();
    for (const e of this.entries) {
      for (const rec of e.avlRecords) {
        for (const io of rec.allIoElementsReceived) {
          allSeenIoIds.add(io.id);
        }
      }
    }

    return {
      totalPacketsRecorded: totalPackets,
      latestPacketAt: latest?.connection.receivedAtUtc || null,
      latestImei: latest?.connection.imei || null,
      id66VehicleVoltageAudit: {
        currentlyPresent: latest ? latest.canObdAudit.vehicleBatteryVoltageId66.isSentByDevice : false,
        everSeenInSession: id66EverSeen,
        latestVoltageV: latest ? latest.canObdAudit.vehicleBatteryVoltageId66.scaledVolts : null,
        status: latest ? latest.canObdAudit.vehicleBatteryVoltageId66.status : 'NO_PACKETS_YET',
        diagnosisAr: latest
          ? latest.canObdAudit.vehicleBatteryVoltageId66.diagnosisAr
          : 'في انتظار وصول أول باكت TCP لتشخيص جهد البطارية.',
        diagnosisEn: latest
          ? latest.canObdAudit.vehicleBatteryVoltageId66.diagnosisEn
          : 'Waiting for initial TCP packet to audit battery voltage.',
      },
      canBusAudit: {
        currentlyCommunicating: latest ? latest.canObdAudit.canBusStatus.isVehicleCanCommunicating : false,
        everSeenInSession: canEverSeen,
        detectedCanIdsCount: latest ? latest.canObdAudit.canBusStatus.detectedCanIoIds.length : 0,
        detectedCanIds: latest ? latest.canObdAudit.canBusStatus.detectedCanIoIds : [],
        diagnosisAr: latest ? latest.canObdAudit.canBusStatus.diagnosisAr : 'في انتظار اتصال الكان.',
        diagnosisEn: latest ? latest.canObdAudit.canBusStatus.diagnosisEn : 'Waiting for CAN data.',
      },
      dtcAudit: {
        milActive: latest ? latest.canObdAudit.diagnosticTroubleCodes.milLampActive : false,
        dtcCount: latest ? latest.canObdAudit.diagnosticTroubleCodes.dtcCountReported : 0,
        codes: latest ? latest.canObdAudit.diagnosticTroubleCodes.activeTroubleCodes : [],
      },
      allReceivedIoIdsEver: Array.from(allSeenIoIds).sort((a, b) => a - b),
      latestEntry: latest,
      logFilePaths: {
        json: '/api/diagnostics/download',
        text: '/api/diagnostics/download-log',
      },
    };
  }

  public getJsonPath(): string {
    return this.jsonFilePath;
  }

  public getLogPath(): string {
    return this.logFilePath;
  }

  public clear() {
    this.entries = [];
    this.saveJson();
    this.initLogFileHeader();
  }
}

export const diagnosticLogger = new DiagnosticFileManager();
