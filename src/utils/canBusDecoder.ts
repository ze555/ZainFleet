import {
  AvlRecord,
  CanMetrics,
  CanParameterDefinition,
  DecodedCanParameter,
  VehicleAlert,
  VehicleTrip,
  TripPoint,
} from '../types/fleet.js';

/**
 * Official Teltonika FMB140 Parameter Catalog
 * Sourced directly from official Teltonika wiki documentation:
 * https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID
 */
export const CAN_PARAMETER_CATALOG: Record<number, CanParameterDefinition> = {
  1: {
    id: 1,
    officialName: 'Digital Input 1 (DIN1)',
    nameAr: 'المدخل الرقمي 1 (سلك السويتش/Ignition)',
    nameEn: 'Digital Input 1 (DIN1 / Ignition wire)',
    source: 'device_io',
    sourceBusLabelAr: 'حساس سلكي بالجهاز',
    sourceBusLabelEn: 'Device Hardware IO',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'State',
    valueRange: '0 - 1',
    descriptionAr: 'حالة السلك الكهربائي الموصول بكهرباء السويتش (0 = مفصول، 1 = متصل)',
    descriptionEn: 'Hardware wire input state (0 = Off, 1 = On)',
    configDependency: 'DIN1 input active',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  2: {
    id: 2,
    officialName: 'Digital Input 2 (DIN2)',
    nameAr: 'المدخل الرقمي 2 (DIN2)',
    nameEn: 'Digital Input 2 (DIN2)',
    source: 'device_io',
    sourceBusLabelAr: 'حساس سلكي بالجهاز',
    sourceBusLabelEn: 'Device Hardware IO',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'State',
    valueRange: '0 - 1',
    descriptionAr: 'مدخل رقمي إضافي لمراقبة حساس باب أو زر استغاثة',
    descriptionEn: 'Auxiliary digital input for sensors or panic button',
    configDependency: 'DIN2 enabled in Configurator',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID',
  },
  9: {
    id: 9,
    officialName: 'Analog Input 1 (AIN1)',
    nameAr: 'المدخل التماثلي 1 (AIN1)',
    nameEn: 'Analog Input 1 (AIN1)',
    source: 'device_io',
    sourceBusLabelAr: 'حساس تماثلي بالجهاز',
    sourceBusLabelEn: 'Device Hardware ADC',
    byteLength: 2,
    signed: false,
    multiplier: 0.001,
    unit: 'V',
    valueRange: '0 - 30000 mV',
    descriptionAr: 'قراءة الجهد التماثلي لحساس وقود أو حساس ضغط خارجي',
    descriptionEn: 'Analog voltage measurement for external sensors',
    configDependency: 'AIN1 enabled in Configurator',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID',
  },
  16: {
    id: 16,
    officialName: 'Total Odometer',
    nameAr: 'عداد المسافات الكلي المتراكم بالجهاز',
    nameEn: 'Total Odometer (Tracker Calculated)',
    source: 'device_io',
    sourceBusLabelAr: 'محسوب بجهاز التتبع',
    sourceBusLabelEn: 'Device Calculated',
    byteLength: 4,
    signed: false,
    multiplier: 0.001,
    unit: 'km',
    valueRange: '0 - 2,147,483,647 m',
    descriptionAr: 'المسافة الكلية المقطوعة بالمتر محسوبة عبر نظام GNSS داخل الجهاز',
    descriptionEn: 'Total accumulated distance calculated in meters by GPS',
    configDependency: 'Permanent IO (Default enabled)',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  21: {
    id: 21,
    officialName: 'GSM Signal Level',
    nameAr: 'قوة إشارة شبكة الجوال GSM',
    nameEn: 'GSM Signal Level',
    source: 'device_io',
    sourceBusLabelAr: 'مودم الاتصال بالجهاز',
    sourceBusLabelEn: 'Cellular Modem',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'Bars',
    valueRange: '0 - 5',
    descriptionAr: 'مستوى إشارة الشبكة الخلوية من 1 إلى 5 أبراج',
    descriptionEn: 'GSM reception strength (0 to 5 bars)',
    configDependency: 'Permanent IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID',
  },
  24: {
    id: 24,
    officialName: 'Speed (OBD)',
    nameAr: 'سرعة المركبة من منفذ OBD',
    nameEn: 'Vehicle Speed (OBD-II)',
    source: 'obd',
    sourceBusLabelAr: 'ناقل OBD-II القياسي',
    sourceBusLabelEn: 'OBD-II Bus',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'km/h',
    valueRange: '0 - 255 km/h',
    descriptionAr: 'سرعة عجلات المركبة الحقيقية مستخرجة من كمبيوتر السيارة',
    descriptionEn: 'Real vehicle speed from vehicle ECU via standard OBD',
    configDependency: 'OBD feature enabled',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#OBD_elements',
  },
  30: {
    id: 30,
    officialName: 'Vehicle Speed (CAN)',
    nameAr: 'سرعة المركبة من ناقل CAN (M-CAN)',
    nameEn: 'Vehicle Speed (CAN Bus)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'km/h',
    valueRange: '0 - 255 km/h',
    descriptionAr: 'سرعة السيارة من ناقل حركة السيارة عبر معالج الـ CAN المدمج',
    descriptionEn: 'Vehicle speed read from CAN1 lines by internal CAN chip',
    configDependency: 'CAN adapter enabled & vehicle profile set',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  31: {
    id: 31,
    officialName: 'Accelerator Pedal Position (CAN)',
    nameAr: 'موقع دواسة الوقود %',
    nameEn: 'Accelerator Pedal Position (%)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 1,
    signed: false,
    multiplier: 0.1,
    unit: '%',
    valueRange: '0 - 100 %',
    descriptionAr: 'نسبة الضغط على دواسة البنزين من 0% إلى 100%',
    descriptionEn: 'Gas pedal depression percentage from CAN bus',
    configDependency: 'Supported vehicle CAN profile',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  32: {
    id: 32,
    officialName: 'Coolant Temperature (OBD/CAN)',
    nameAr: 'حرارة سائل تبريد المحرك (Coolant)',
    nameEn: 'Engine Coolant Temperature',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 1,
    signed: true,
    multiplier: 1,
    unit: '°C',
    valueRange: '-40 - 215 °C',
    descriptionAr: 'درجة حرارة ماء/سائل تبريد محرك السيارة الفعلي',
    descriptionEn: 'Engine coolant temperature reported by engine ECU',
    configDependency: 'OBD/CAN enabled',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#OBD_elements',
  },
  33: {
    id: 33,
    officialName: 'Engine Speed (RPM) (OBD)',
    nameAr: 'معدل دوران المحرك (RPM)',
    nameEn: 'Engine Speed (RPM)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 2,
    signed: false,
    multiplier: 1,
    unit: 'RPM',
    valueRange: '0 - 16,383 RPM',
    descriptionAr: 'عدد دورات عمود الكرنك في الدقيقة الواحدة (RPM)',
    descriptionEn: 'Engine revolutions per minute from engine ECU',
    configDependency: 'OBD/CAN enabled',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#OBD_elements',
  },
  35: {
    id: 35,
    officialName: 'Engine RPM (CAN)',
    nameAr: 'معدل دوران المحرك من الكان (RPM)',
    nameEn: 'Engine RPM (CAN Bus)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 2,
    signed: false,
    multiplier: 1,
    unit: 'RPM',
    valueRange: '0 - 16,000 RPM',
    descriptionAr: 'سرعة دوران المحرك عبر معالج CAN المدمج',
    descriptionEn: 'Engine revolutions per minute from vehicle CAN',
    configDependency: 'CAN adapter enabled',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  66: {
    id: 66,
    officialName: 'External Voltage',
    nameAr: 'جهد بطارية ونظام كهرباء السيارة الخارجي',
    nameEn: 'Vehicle External Voltage',
    source: 'device_io',
    sourceBusLabelAr: 'حساس الجهد الرئيسي بالجهاز',
    sourceBusLabelEn: 'Device Power Input',
    byteLength: 2,
    signed: false,
    multiplier: 0.001,
    unit: 'V',
    valueRange: '0 - 30,000 mV',
    descriptionAr: 'الجهد الكهربائي لبطارية السيارة ودينامو الشحن بالفولت (12V - 14.5V)',
    descriptionEn: 'Vehicle main electrical power voltage (detects alternator charging)',
    configDependency: 'Permanent IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  67: {
    id: 67,
    officialName: 'Battery Voltage',
    nameAr: 'جهد بطارية جهاز التتبع الداخلية الاحتياطية',
    nameEn: 'Internal Backup Battery Voltage',
    source: 'device_io',
    sourceBusLabelAr: 'بطارية الليثيوم الداخلية للجهاز',
    sourceBusLabelEn: 'Internal Li-Ion Battery',
    byteLength: 2,
    signed: false,
    multiplier: 0.001,
    unit: 'V',
    valueRange: '0 - 4,500 mV',
    descriptionAr: 'جهد بطارية الليثيوم المدمجة داخل جهاز التتبع FMB140 للعمل في حال فصل كهرباء السيارة',
    descriptionEn: 'Internal tracker Li-Ion battery voltage (3.7V - 4.2V nominal)',
    configDependency: 'Permanent IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  68: {
    id: 68,
    officialName: 'Battery Current',
    nameAr: 'تيار بطارية الجهاز الداخلية',
    nameEn: 'Battery Current',
    source: 'device_io',
    sourceBusLabelAr: 'دائرة الشحن بالجهاز',
    sourceBusLabelEn: 'Device Battery Circuit',
    byteLength: 2,
    signed: true,
    multiplier: 1,
    unit: 'mA',
    valueRange: '-2000 - 2000 mA',
    descriptionAr: 'تيار الشحن أو التفريغ لبطارية الجهاز المدمجة',
    descriptionEn: 'Charging/discharging current of the internal battery',
    configDependency: 'Permanent IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID',
  },
  81: {
    id: 81,
    officialName: 'Vehicle Speed (Wheel Speed CAN)',
    nameAr: 'سرعة السيارة من ناقل CAN (M-CAN)',
    nameEn: 'Vehicle Wheel Speed (CAN)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'km/h',
    valueRange: '0 - 255 km/h',
    descriptionAr: 'سرعة العجلات المستلمة مباشرة من كمبيوتر الفرامل ABS/ESP عبر الكان',
    descriptionEn: 'Wheel speed sensor data read from CAN1 lines',
    configDependency: 'Supported vehicle CAN profile',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  82: {
    id: 82,
    officialName: 'Accelerator Pedal Position',
    nameAr: 'موقع دعسة البنزين %',
    nameEn: 'Gas Pedal Position',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 1,
    signed: false,
    multiplier: 0.1,
    unit: '%',
    valueRange: '0 - 100 %',
    descriptionAr: 'نسبة فتح الخانق ودواسة التسارع',
    descriptionEn: 'Throttle / pedal position percentage',
    configDependency: 'CAN adapter enabled',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  83: {
    id: 83,
    officialName: 'Total Fuel Consumed (CAN)',
    nameAr: 'إجمالي استهلاك الوقود التراكمي (Liters)',
    nameEn: 'Total Fuel Consumed (Liters)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 4,
    signed: false,
    multiplier: 0.1,
    unit: 'L',
    valueRange: '0 - 2,147,483,647 (0.1 L)',
    descriptionAr: 'إجمالي كمية البنزين/الديزل المستهلكة طوال عمر السيارة باللترات',
    descriptionEn: 'Total lifetime fuel volume burned by engine in liters',
    configDependency: 'Supported vehicle CAN profile',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  84: {
    id: 84,
    officialName: 'Fuel Level (Liters CAN)',
    nameAr: 'كمية الوقود المتبقية باللترات',
    nameEn: 'Fuel Level (Liters)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 2,
    signed: false,
    multiplier: 0.1,
    unit: 'L',
    valueRange: '0 - 65,535 (0.1 L)',
    descriptionAr: 'كمية الوقود الحالية داخل خزان الوقود مقاسة باللتر',
    descriptionEn: 'Current fuel tank contents in liters',
    configDependency: 'Supported vehicle CAN profile',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  87: {
    id: 87,
    officialName: 'Total Mileage (CAN Odometer)',
    nameAr: 'عداد المسافات الفعلي من طبلون السيارة (CAN Odometer)',
    nameEn: 'Vehicle Dashboard Odometer (CAN)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 4,
    signed: false,
    multiplier: 1,
    unit: 'km',
    valueRange: '0 - 4,294,967,295',
    descriptionAr: 'رقم عداد الكيلومترات الأصلي الظاهر على شاشة طبلون السيارة المستخرج من الـ CAN',
    descriptionEn: 'Actual odometer reading matching vehicle dashboard',
    configDependency: 'CAN adapter enabled & vehicle profile set',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  89: {
    id: 89,
    officialName: 'Fuel Level (%) (CAN/OBD)',
    nameAr: 'مستوى خزان الوقود بالنسبة المئوية (%)',
    nameEn: 'Fuel Level Percentage (%)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: '%',
    valueRange: '0 - 100 %',
    descriptionAr: 'نسبة الوقود المتبقية في الخزان من 0% إلى 100%',
    descriptionEn: 'Current fuel level as percentage of tank capacity',
    configDependency: 'CAN adapter or OBD enabled',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#OBD_elements',
  },
  90: {
    id: 90,
    officialName: 'Fuel Level (Liters)',
    nameAr: 'مستوى خزان الوقود باللترات الكاملة',
    nameEn: 'Fuel Level Liters',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 2,
    signed: false,
    multiplier: 1,
    unit: 'L',
    valueRange: '0 - 1000 L',
    descriptionAr: 'حجم الوقود المتبقي في الخزان باللترات الصحيحة',
    descriptionEn: 'Fuel volume in tank in whole liters',
    configDependency: 'Supported vehicle CAN profile',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID',
  },
  100: {
    id: 100,
    officialName: 'Door / Trunk / Hood Status (CAN)',
    nameAr: 'حالة أبواب السيارة والكبوت والشنطة (C-CAN)',
    nameEn: 'Door / Trunk / Hood Status',
    source: 'can_comfort',
    sourceBusLabelAr: 'C-CAN (ناقل الراحة والمقصورة CAN2)',
    sourceBusLabelEn: 'C-CAN (Comfort/Body CAN2)',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'Bitmask',
    valueRange: 'Bitmask (0x01: Driver, 0x02: Passenger, 0x04: RearL, 0x08: RearR, 0x10: Hood, 0x20: Trunk)',
    descriptionAr: 'قراءة أقفال ومستشعرات الأبواب الستة من كمبيوتر راحة المقصورة (BCM)',
    descriptionEn: 'Bitmask of vehicle door latches read from body control module',
    configDependency: 'CAN2 connected to Comfort CAN & vehicle profile active',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  102: {
    id: 102,
    officialName: 'Engine Worktime',
    nameAr: 'ساعات تشغيل المحرك الكلية',
    nameEn: 'Total Engine Worktime',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 4,
    signed: false,
    multiplier: 1,
    unit: 'Hours',
    valueRange: '0 - 4,294,967,295 s',
    descriptionAr: 'الوقت الإجمالي لعمل المحرك بالثواني (يتم تحويله تلقائياً للساعات)',
    descriptionEn: 'Total engine operating time in seconds, converted to hours',
    configDependency: 'Supported vehicle CAN profile',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  105: {
    id: 105,
    officialName: 'Total Mileage (Counted)',
    nameAr: 'المسافة الكلية المقطوعة (عداد محسوب)',
    nameEn: 'Total Mileage (Counted)',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 4,
    signed: false,
    multiplier: 0.001,
    unit: 'km',
    valueRange: '0 - 4,294,967,295 m',
    descriptionAr: 'عداد المسافات المقطوعة بالمتر مسجل عبر الكان',
    descriptionEn: 'CAN-derived total driven distance in meters',
    configDependency: 'CAN adapter enabled',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  115: {
    id: 115,
    officialName: 'PCB Temperature',
    nameAr: 'حرارة اللوحة الإلكترونية لجهاز التتبع (PCB)',
    nameEn: 'Tracker PCB Temperature',
    source: 'device_io',
    sourceBusLabelAr: 'حساس حرارة بوردة الجهاز',
    sourceBusLabelEn: 'Internal Tracker Hardware',
    byteLength: 1,
    signed: true,
    multiplier: 1,
    unit: '°C',
    valueRange: '-40 - 125 °C',
    descriptionAr: 'درجة حرارة الدائرة الإلكترونية الداخلية لجهاز التتبع (وليس سائل تبريد المحرك)',
    descriptionEn: 'Internal tracker motherboard temperature sensor (NOT engine coolant)',
    configDependency: 'Permanent IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  132: {
    id: 132,
    officialName: 'Security State Flags (CAN Safety)',
    nameAr: 'مؤشرات الأمان (الجلنط، حزام الأمان، لمبة المحرك)',
    nameEn: 'Vehicle Safety & Warning Flags',
    source: 'can_comfort',
    sourceBusLabelAr: 'C-CAN (ناقل الراحة والأمان CAN2)',
    sourceBusLabelEn: 'C-CAN (Safety/Comfort CAN2)',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'Flags',
    valueRange: 'Bitmask (0x01: Handbrake, 0x02: Seatbelt, 0x08: Check Engine MIL)',
    descriptionAr: 'مؤشرات إشارات التحذير والأمان المقروءة من كمبيوتر السيارة',
    descriptionEn: 'Safety and warning indicator status flags from vehicle instrument cluster',
    configDependency: 'Supported vehicle CAN profile',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  162: {
    id: 162,
    officialName: 'Engine Oil Temperature',
    nameAr: 'حرارة زيت المحرك (°C)',
    nameEn: 'Engine Oil Temperature',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 1,
    signed: true,
    multiplier: 1,
    unit: '°C',
    valueRange: '-40 - 215 °C',
    descriptionAr: 'درجة حرارة زيت المحرك المقروءة من حساس زيت السيارة عبر الـ CAN',
    descriptionEn: 'Engine oil temperature sensor reading from engine ECU',
    configDependency: 'Supported vehicle CAN profile with oil temp sensor',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  179: {
    id: 179,
    officialName: 'Instant Fuel Rate',
    nameAr: 'معدل استهلاك الوقود اللحظي (L/h)',
    nameEn: 'Instantaneous Fuel Rate',
    source: 'can_powertrain',
    sourceBusLabelAr: 'M-CAN (ناقل المحرك CAN1)',
    sourceBusLabelEn: 'M-CAN (Powertrain CAN1)',
    byteLength: 2,
    signed: false,
    multiplier: 0.1,
    unit: 'L/h',
    valueRange: '0 - 1000 (0.1 L/h)',
    descriptionAr: 'كمية الوقود التي يحرقها المحرك في الساعة في هذه اللحظة',
    descriptionEn: 'Instantaneous fuel flow rate in liters per hour',
    configDependency: 'Supported vehicle CAN profile',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#CAN_adapters_elements',
  },
  199: {
    id: 199,
    officialName: 'Trip Odometer',
    nameAr: 'عداد مسافة الرحلة بالجهاز',
    nameEn: 'Trip Distance (Meters)',
    source: 'device_io',
    sourceBusLabelAr: 'محسوب بجهاز التتبع',
    sourceBusLabelEn: 'Device Calculated',
    byteLength: 4,
    signed: false,
    multiplier: 0.001,
    unit: 'km',
    valueRange: '0 - 4,294,967,295 m',
    descriptionAr: 'المسافة المقطوعة منذ آخر تصفير لعداد الرحلة بالمتر',
    descriptionEn: 'Trip odometer value in meters',
    configDependency: 'Permanent IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  239: {
    id: 239,
    officialName: 'Ignition',
    nameAr: 'حالة مفتاح السويتش / تشغيل المحرك',
    nameEn: 'Ignition State',
    source: 'device_io',
    sourceBusLabelAr: 'منطق تشغيل الجهاز',
    sourceBusLabelEn: 'Tracker Ignition Logic',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'State',
    valueRange: '0 – Ignition Off, 1 – Ignition On',
    descriptionAr: 'الحالة المؤكدة لتشغيل سويتش السيارة محسوبة بالاعتماد على الفولت والـ DIN1 أو الـ CAN',
    descriptionEn: 'Primary ignition detection status (0 = Off, 1 = On)',
    configDependency: 'Permanent IO (Default configured)',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  240: {
    id: 240,
    officialName: 'Movement',
    nameAr: 'مستشعر حركة المركبة',
    nameEn: 'Movement Status',
    source: 'device_io',
    sourceBusLabelAr: 'مستشعر التسارع الداخلي (Accelerometer)',
    sourceBusLabelEn: 'Internal Accelerometer',
    byteLength: 1,
    signed: false,
    multiplier: 1,
    unit: 'State',
    valueRange: '0 – Stopped, 1 – Moving',
    descriptionAr: 'كشف حركة المركبة بالاعتماد على حساس الجاذبية والتسارع المدمج',
    descriptionEn: 'Vehicle movement status detected by internal accelerometer',
    configDependency: 'Permanent IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  241: {
    id: 241,
    officialName: 'Active GSM Operator',
    nameAr: 'رمز شبكة الجوال النشطة (MCC/MNC)',
    nameEn: 'Active GSM Operator Code',
    source: 'device_io',
    sourceBusLabelAr: 'مودم الاتصال بالجهاز',
    sourceBusLabelEn: 'Cellular Modem',
    byteLength: 4,
    signed: false,
    multiplier: 1,
    unit: 'Code',
    valueRange: 'Variable string (e.g. 42001 for Zain KSA)',
    descriptionAr: 'معرف شركة الاتصالات المتصل بها جهاز التتبع حالياً',
    descriptionEn: 'Mobile Country Code and Mobile Network Code of active cellular provider',
    configDependency: 'Permanent IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID#Permanent_I.2FO_elements',
  },
  250: {
    id: 250,
    officialName: 'Trip Odometer (Eventual)',
    nameAr: 'مسافة الرحلة الحالية (Eventual)',
    nameEn: 'Trip Distance (Meters)',
    source: 'device_io',
    sourceBusLabelAr: 'محسوب بجهاز التتبع',
    sourceBusLabelEn: 'Device Calculated',
    byteLength: 4,
    signed: false,
    multiplier: 0.001,
    unit: 'km',
    valueRange: '0 - 4,294,967,295 m',
    descriptionAr: 'مسافة الرحلة بالمتر محسوبة عند الأحداث',
    descriptionEn: 'Trip distance in meters',
    configDependency: 'Eventual IO',
    verified: true,
    documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140_Teltonika_Data_Sending_Parameters_ID',
  },
};

/**
 * Parses raw string from AVL packet into properly signed/scaled number
 */
export function parseParameterValue(
  def: CanParameterDefinition,
  rawStr: string | undefined
): { numeric: number | null; formatted: string } {
  if (rawStr === undefined || rawStr === null || rawStr === '') {
    return { numeric: null, formatted: '---' };
  }

  let num = Number(rawStr);
  if (Number.isNaN(num)) {
    const hex = parseInt(rawStr, 16);
    if (!Number.isNaN(hex)) {
      num = hex;
    } else {
      return { numeric: null, formatted: rawStr };
    }
  }

  // Handle signed numbers according to byte length
  if (def.signed) {
    if (def.byteLength === 1 && num > 127) {
      num = num - 256;
    } else if (def.byteLength === 2 && num > 32767) {
      num = num - 65536;
    } else if (def.byteLength === 4 && num > 2147483647) {
      num = num - 4294967296;
    }
  }

  // Apply scaling multiplier
  const scaled = def.multiplier !== 1 ? num * def.multiplier : num;

  let formatted = '';
  if (def.unit === '°C') {
    formatted = `${Math.round(scaled)} °C`;
  } else if (def.unit === 'V') {
    formatted = `${scaled.toFixed(1)} V`;
  } else if (def.unit === 'km') {
    formatted = `${Math.round(scaled).toLocaleString()} km`;
  } else if (def.unit === 'km/h') {
    formatted = `${Math.round(scaled)} km/h`;
  } else if (def.unit === '%') {
    formatted = `${Math.round(scaled)} %`;
  } else if (def.unit === 'RPM') {
    formatted = `${Math.round(scaled)} RPM`;
  } else if (def.unit === 'L') {
    formatted = `${scaled.toFixed(1)} L`;
  } else if (def.unit === 'State') {
    formatted = scaled === 1 ? 'تشغيل / نشط (1)' : 'إطفاء / ساكن (0)';
  } else {
    formatted = `${scaled}`;
  }

  return { numeric: scaled, formatted };
}

/**
 * Decodes all active and catalogued CAN bus and device parameters from an AvlRecord
 */
export function decodeCanMetrics(record: AvlRecord): CanMetrics {
  const ioMap = new Map<number, string>();
  for (const el of record.ioElements || []) {
    ioMap.set(el.id, el.value);
  }

  const getRaw = (id: number): string | undefined => ioMap.get(id);

  // Helper to extract parsed numeric value for an ID
  const getParsed = (id: number): number | null => {
    const raw = getRaw(id);
    if (raw === undefined) return null;
    const def = CAN_PARAMETER_CATALOG[id];
    if (def) {
      return parseParameterValue(def, raw).numeric;
    }
    const num = Number(raw);
    return Number.isNaN(num) ? parseInt(raw, 16) || null : num;
  };

  // --- 1. Ignition Determination (Prioritized Source of Truth) ---
  const io239Raw = getRaw(239);
  const io1Raw = getRaw(1);
  let ignitionOn = false;
  let ignitionSource: CanMetrics['ignition']['source'] = 'NONE';
  let ignitionVerified = false;

  if (io239Raw !== undefined) {
    ignitionOn = io239Raw === '1';
    ignitionSource = 'IO239';
    ignitionVerified = true;
  } else if (io1Raw !== undefined) {
    ignitionOn = io1Raw === '1';
    ignitionSource = 'DIN1';
    ignitionVerified = true;
  } else if (record.speed > 3) {
    ignitionOn = true;
    ignitionSource = 'SPEED';
    ignitionVerified = false;
  }

  // --- 2. Movement Status ---
  const io240Raw = getRaw(240);
  const isMovingState = io240Raw !== undefined ? io240Raw === '1' : record.speed > 2;

  // --- 3. Speed: Distinguish GPS Speed vs CAN Speed ---
  const gpsSpeed = record.speed;
  const canSpeedRaw = getParsed(30) ?? getParsed(81) ?? getParsed(24);
  const displaySpeed = canSpeedRaw !== null && canSpeedRaw > 0 ? canSpeedRaw : gpsSpeed;

  // --- 4. Engine Dynamics ---
  // OBD RPM (ID 33) or CAN RPM (ID 35). NOT ID 85 which is LTE Band on FMB140!
  let engineRpm = getParsed(33) ?? getParsed(35);
  if (engineRpm !== null && (engineRpm < 0 || engineRpm > 12000)) {
    engineRpm = null;
  }

  // Coolant Temperature: OBD/CAN ID 32. NOT ID 115 which is internal PCB temperature!
  let coolantTempC = getParsed(32);
  if (coolantTempC !== null && (coolantTempC < -40 || coolantTempC > 180)) {
    coolantTempC = null;
  }

  // Oil Temperature: ID 162
  const oilTempC = getParsed(162);

  // Engine Work Hours: ID 102 (seconds -> hours)
  const workSeconds = getParsed(102);
  const workHours = workSeconds !== null ? Math.round(workSeconds / 3600) : null;

  // Accelerator Pedal: ID 31 or ID 82
  const pedalPercent = getParsed(31) ?? getParsed(82);

  // --- 5. Fuel & Consumption ---
  // Fuel Level %: ID 89 (OBD/CAN)
  let fuelPercent = getParsed(89);
  if (fuelPercent !== null) {
    fuelPercent = Math.min(100, Math.max(0, Math.round(fuelPercent)));
  }

  // Fuel Level Liters: ID 84 or ID 90
  const fuelLiters = getParsed(84) ?? getParsed(90);

  // Total Fuel Consumed: ID 83
  const totalFuelConsumed = getParsed(83);

  // Instant Fuel Flow: ID 179
  const instantFuelRate = getParsed(179);

  // --- 6. Odometer & Mileage ---
  // CAN Odometer ID 87 or ID 105 or Tracker Odometer ID 16
  let odometerKm: number | null = null;
  let odoSource: CanMetrics['odometer']['source'] = 'NONE';
  const canOdo87 = getParsed(87);
  const canOdo105 = getParsed(105);
  const trackerOdo16 = getParsed(16);

  if (canOdo87 !== null && canOdo87 > 0) {
    // If sent in meters (> 1,000,000), convert to km
    odometerKm = canOdo87 > 1000000 ? Math.round(canOdo87 / 1000) : Math.round(canOdo87);
    odoSource = 'CAN_ODOMETER';
  } else if (canOdo105 !== null && canOdo105 > 0) {
    odometerKm = Math.round(canOdo105 / 1000);
    odoSource = 'CAN_ODOMETER';
  } else if (trackerOdo16 !== null && trackerOdo16 > 0) {
    odometerKm = Math.round(trackerOdo16 / 1000);
    odoSource = 'GPS_ACCUMULATED';
  }

  // Trip Odometer: ID 199 or ID 250 (meters -> km)
  const rawTripOdo = getParsed(199) ?? getParsed(250);
  const tripKm = rawTripOdo !== null ? Math.round((rawTripOdo / 1000) * 10) / 10 : null;

  // --- 7. Electrical System: External vs Internal Battery ---
  const extVoltageMv = getParsed(66);
  const externalVoltageV = extVoltageMv !== null ? Math.round((extVoltageMv / 1000) * 10) / 10 : null;

  const intBatteryMv = getParsed(67);
  const trackerBatteryV = intBatteryMv !== null ? Math.round((intBatteryMv / 1000) * 100) / 100 : null;

  let alternatorStatus: CanMetrics['electrical']['alternatorStatus'] = 'unknown';
  let alternatorStatusAr = 'غير محدد';
  let alternatorStatusEn = 'Unknown';

  if (externalVoltageV !== null) {
    if (externalVoltageV >= 13.2) {
      alternatorStatus = 'charging';
      alternatorStatusAr = 'دينامو الشحن يعمل (يشحن البطارية)';
      alternatorStatusEn = 'Alternator Charging Active';
    } else if (externalVoltageV >= 11.9) {
      alternatorStatus = 'battery_only';
      alternatorStatusAr = 'يعمل على جهد البطارية (الدينامو متوقف)';
      alternatorStatusEn = 'Engine Off (Battery Only)';
    } else {
      alternatorStatus = 'low_voltage';
      alternatorStatusAr = 'جهد البطارية ضعيف (< 11.9V)';
      alternatorStatusEn = 'Low Battery Voltage Warning';
    }
  }

  // --- 8. Comfort & Safety (C-CAN / CAN2) ---
  const doorsRaw = getParsed(100);
  let hasDoorData = false;
  let doors: CanMetrics['comfort']['doors'] = {
    driverOpen: false,
    passengerOpen: false,
    rearLeftOpen: false,
    rearRightOpen: false,
    hoodOpen: false,
    trunkOpen: false,
    anyOpen: false,
  };

  if (doorsRaw !== null) {
    hasDoorData = true;
    const rawMask = Math.round(doorsRaw);
    const driver = (rawMask & 0x01) !== 0;
    const passenger = (rawMask & 0x02) !== 0;
    const rearL = (rawMask & 0x04) !== 0;
    const rearR = (rawMask & 0x08) !== 0;
    const hood = (rawMask & 0x10) !== 0;
    const trunk = (rawMask & 0x20) !== 0;
    doors = {
      driverOpen: driver,
      passengerOpen: passenger,
      rearLeftOpen: rearL,
      rearRightOpen: rearR,
      hoodOpen: hood,
      trunkOpen: trunk,
      anyOpen: driver || passenger || rearL || rearR || hood || trunk,
    };
  }

  const secRaw = getParsed(132);
  let handbrakeEngaged: boolean | null = null;
  let seatbeltFastened: boolean | null = null;
  let checkEngineLight: boolean | null = null;

  if (secRaw !== null) {
    const rawMask = Math.round(secRaw);
    handbrakeEngaged = (rawMask & 0x01) !== 0;
    seatbeltFastened = (rawMask & 0x02) !== 0;
    checkEngineLight = (rawMask & 0x08) !== 0;
  }

  // --- 9. Cellular & GNSS ---
  const gsmBars = getParsed(21);
  const operatorCode = getRaw(241) || null;

  const activeCanIds = Array.from(ioMap.keys());

  return {
    ignition: {
      isOn: ignitionOn,
      source: ignitionSource,
      labelAr: ignitionOn ? 'شغال (ON)' : 'متوقف (OFF)',
      labelEn: ignitionOn ? 'Ignition ON' : 'Ignition OFF',
      verified: ignitionVerified,
    },
    isMoving: {
      state: isMovingState,
      source: io240Raw !== undefined ? 'IO240' : 'SPEED',
      labelAr: isMovingState ? 'تسير (In Motion)' : 'متوقفة (Stationary)',
      labelEn: isMovingState ? 'Moving' : 'Parked',
    },
    speed: {
      gpsKmH: gpsSpeed,
      canKmH: canSpeedRaw,
      displaySpeedKmH: displaySpeed,
      source: canSpeedRaw !== null && canSpeedRaw > 0 ? 'CAN' : 'GPS',
    },
    engine: {
      rpm: engineRpm,
      coolantTempC,
      oilTempC,
      workHours,
      loadPercent: pedalPercent,
    },
    fuel: {
      levelPercent: fuelPercent,
      levelLiters: fuelLiters,
      totalConsumedLiters: totalFuelConsumed,
      instantRateLitersPerHour: instantFuelRate,
    },
    odometer: {
      totalKm: odometerKm,
      tripKm,
      source: odoSource,
    },
    electrical: {
      vehicleVoltageV: externalVoltageV,
      trackerBatteryV: trackerBatteryV,
      alternatorStatus,
      alternatorStatusAr,
      alternatorStatusEn,
    },
    comfort: {
      hasDoorData,
      doors,
      seatbeltFastened,
      handbrakeEngaged,
      checkEngineLight,
    },
    gnss: {
      satellites: record.satellites,
      altitudeMeters: record.altitude,
      headingDegrees: record.angle,
      isFixValid: record.satellites >= 3 && (record.latitude !== 0 || record.longitude !== 0),
    },
    cellular: {
      signalBars: gsmBars,
      operatorCode,
    },
    rawIoCount: record.ioElements?.length || 0,
    activeCanIds,
  };
}

/**
 * Returns a complete audited catalog list with current active status for an AvlRecord
 */
export function getAuditedParametersList(record: AvlRecord | null): DecodedCanParameter[] {
  const ioMap = new Map<number, string>();
  if (record) {
    for (const el of record.ioElements || []) {
      ioMap.set(el.id, el.value);
    }
  }

  const results: DecodedCanParameter[] = [];

  for (const [idStr, def] of Object.entries(CAN_PARAMETER_CATALOG)) {
    const id = Number(idStr);
    const rawVal = ioMap.get(id);

    if (rawVal !== undefined) {
      const parsed = parseParameterValue(def, rawVal);
      results.push({
        id,
        raw: rawVal,
        rawNumber: parsed.numeric,
        formatted: parsed.formatted,
        numericValue: parsed.numeric,
        unit: def.unit,
        definition: def,
        status: 'active',
      });
    } else {
      results.push({
        id,
        raw: '---',
        rawNumber: null,
        formatted: 'غير مرسل من المركبة',
        numericValue: null,
        unit: def.unit,
        definition: def,
        status: 'not_reported',
      });
    }
  }

  // Also include any unexpected raw parameters received in packet that are not yet in our catalog
  if (record) {
    for (const el of record.ioElements || []) {
      if (!CAN_PARAMETER_CATALOG[el.id]) {
        results.push({
          id: el.id,
          raw: el.value,
          rawNumber: Number(el.value) || null,
          formatted: el.value,
          numericValue: Number(el.value) || null,
          unit: `${el.byteLength}B`,
          definition: {
            id: el.id,
            officialName: `Custom / Uncatalogued Parameter #${el.id}`,
            nameAr: `بارامتر غير مفهرس #${el.id}`,
            nameEn: `Custom AVL Parameter #${el.id}`,
            source: 'diagnostic',
            sourceBusLabelAr: 'حساس مخصص / تشخيص',
            sourceBusLabelEn: 'Custom / Diagnostic',
            byteLength: el.byteLength,
            signed: false,
            multiplier: 1,
            unit: 'raw',
            valueRange: 'N/A',
            descriptionAr: 'قيمة خام واردة في حزمة AVL من الجهاز تتطلب التحقق من ملف تهيئة المركبة',
            descriptionEn: 'Raw value received in packet, requires vehicle profile verification',
            configDependency: 'Custom configuration',
            verified: false,
            documentationUrl: 'https://wiki.teltonika-gps.com/view/FMB140',
          },
          status: 'active',
        });
      }
    }
  }

  return results.sort((a, b) => a.id - b.id);
}

/**
 * Evaluates active vehicle alerts based strictly on verified parameters
 */
export function generateVehicleAlerts(metrics: CanMetrics): VehicleAlert[] {
  const alerts: VehicleAlert[] = [];
  const now = new Date().toISOString();

  // 1. Coolant Overheating Alert (> 104°C)
  if (metrics.engine.coolantTempC !== null && metrics.engine.coolantTempC >= 105) {
    alerts.push({
      id: 'alert-overheat',
      type: 'danger',
      titleAr: 'تحذير عاجل: حرارة المحرك مرتفعة جداً!',
      titleEn: 'Critical: Engine Coolant Overheating!',
      messageAr: `وصلت حرارة سائل التبريد إلى ${metrics.engine.coolantTempC}°C (المعدل الطبيعي: 82-95°C). أوقف المركبة وافحص نظام التبريد.`,
      messageEn: `Coolant temperature is ${metrics.engine.coolantTempC}°C (Normal: 82-95°C). Safely stop the vehicle.`,
      timestamp: now,
      parameterId: 32,
    });
  }

  // 2. Low Fuel Warning (<= 15%)
  if (metrics.fuel.levelPercent !== null && metrics.fuel.levelPercent <= 15) {
    alerts.push({
      id: 'alert-low-fuel',
      type: 'warning',
      titleAr: 'تنبيه: مستوى الوقود منخفض',
      titleEn: 'Low Fuel Alert',
      messageAr: `المستوى المتبقي في خزان الوقود ${metrics.fuel.levelPercent}%. يرجى التزود بالوقود قريباً.`,
      messageEn: `Fuel level has dropped to ${metrics.fuel.levelPercent}%. Refuel soon.`,
      timestamp: now,
      parameterId: 89,
    });
  }

  // 3. Low Battery Voltage while parked (< 11.9V)
  if (!metrics.ignition.isOn && metrics.electrical.vehicleVoltageV !== null && metrics.electrical.vehicleVoltageV < 11.9) {
    alerts.push({
      id: 'alert-low-batt',
      type: 'warning',
      titleAr: 'تنبيه: ضعف جهد بطارية السيارة',
      titleEn: 'Vehicle Battery Low Voltage',
      messageAr: `جهد البطارية ${metrics.electrical.vehicleVoltageV}V أثناء توقف المحرك (المعدل السليم: 12.2V - 12.8V). افحص البطارية لتجنب صعوبة التشغيل.`,
      messageEn: `Battery resting voltage is ${metrics.electrical.vehicleVoltageV}V (Healthy: 12.2V - 12.8V). Inspect battery health.`,
      timestamp: now,
      parameterId: 66,
    });
  }

  // 4. Alternator Fault (Ignition ON but voltage < 12.8V)
  if (metrics.ignition.isOn && metrics.electrical.vehicleVoltageV !== null && metrics.electrical.vehicleVoltageV < 12.8) {
    alerts.push({
      id: 'alert-alternator',
      type: 'danger',
      titleAr: 'عطل في نظام الشحن: دينامو السيارة لا يشحن!',
      titleEn: 'Charging System Fault: Alternator Not Charging',
      messageAr: `المحرك يعمل ولكن جهد المنظومة ${metrics.electrical.vehicleVoltageV}V فقط (معدل شحن الدينامو الطبيعي: 13.5V - 14.5V). افحص دينامو الشحن وسير المحرك فوراً.`,
      messageEn: `Engine is running but system voltage is only ${metrics.electrical.vehicleVoltageV}V. Alternator may have failed.`,
      timestamp: now,
      parameterId: 66,
    });
  }

  // 5. Door Open while vehicle moving
  if (metrics.isMoving.state && metrics.comfort.hasDoorData && metrics.comfort.doors.anyOpen) {
    alerts.push({
      id: 'alert-door-open',
      type: 'danger',
      titleAr: 'خطر: أحد أبواب السيارة مفتوح أثناء السير!',
      titleEn: 'Danger: Door Open While Vehicle in Motion!',
      messageAr: 'تم رصد باب أو شنطة مفتوحة أثناء تحرك المركبة.',
      messageEn: 'Door, hood, or trunk is unlatched while vehicle is moving.',
      timestamp: now,
      parameterId: 100,
    });
  }

  // 6. Check Engine MIL Indicator Active
  if (metrics.comfort.checkEngineLight) {
    alerts.push({
      id: 'alert-mil',
      type: 'warning',
      titleAr: 'لمبة فحص المحرك مضاءة (Check Engine MIL)',
      titleEn: 'Check Engine Warning Light Active',
      messageAr: 'يسجل كمبيوتر السيارة وجود كود عطل في منظومة المحرك (DTC).',
      messageEn: 'Vehicle ECU is signaling active diagnostic trouble codes.',
      timestamp: now,
      parameterId: 132,
    });
  }

  return alerts;
}

/**
 * Calculates geographical distance between two GPS coordinates using Haversine formula (km)
 * Rejects invalid (0,0) coordinates and jumps > 200 km/h
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    lat1 === 0 ||
    lon1 === 0 ||
    lat2 === 0 ||
    lon2 === 0 ||
    Math.abs(lat1) > 90 ||
    Math.abs(lat2) > 90 ||
    Math.abs(lon1) > 180 ||
    Math.abs(lon2) > 180
  ) {
    return 0;
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  // Reject unrealistic coordinate jumps (> 50 km between single telemetry records)
  return dist < 50 ? dist : 0;
}

/**
 * Sensibly segments an array of AvlRecords into discrete trips.
 * A trip starts when ignition/movement begins and ends after 5+ minutes of continuous stop.
 */
export function segmentRecordsIntoTrips(records: AvlRecord[]): VehicleTrip[] {
  if (!records || records.length === 0) return [];

  // Deduplicate records with exact same timestampMs and sort chronologically
  const mapByTime = new Map<number, AvlRecord>();
  for (const r of records) {
    if (r.timestampMs > 0) {
      mapByTime.set(r.timestampMs, r);
    }
  }

  const sorted = Array.from(mapByTime.values()).sort((a, b) => a.timestampMs - b.timestampMs);
  if (sorted.length === 0) return [];

  const trips: VehicleTrip[] = [];
  let currentPoints: TripPoint[] = [];

  const flushTrip = () => {
    // Only accept trips with at least 2 points and minimum 100 meters distance
    if (currentPoints.length < 2) {
      currentPoints = [];
      return;
    }

    const first = currentPoints[0];
    const last = currentPoints[currentPoints.length - 1];
    const durationMs = last.timestampMs - first.timestampMs;
    const durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)));

    let totalDistKm = 0;
    let maxSpeed = 0;
    let speedSum = 0;

    for (let i = 0; i < currentPoints.length; i++) {
      const p = currentPoints[i];
      if (p.speed > maxSpeed) maxSpeed = p.speed;
      speedSum += p.speed;

      if (i > 0) {
        const prev = currentPoints[i - 1];
        totalDistKm += calculateHaversineDistanceKm(prev.lat, prev.lng, p.lat, p.lng);
      }
    }

    // Require either minimum 150 meters moved or 3 minutes duration
    if (totalDistKm < 0.15 && durationMinutes < 3) {
      currentPoints = [];
      return;
    }

    const avgSpeed = Math.round(speedSum / currentPoints.length);

    const startFuel = first.fuelPercent ?? null;
    const endFuel = last.fuelPercent ?? null;
    let fuelConsumedPercent: number | null = null;
    if (startFuel !== null && endFuel !== null && startFuel >= endFuel) {
      fuelConsumedPercent = Math.round((startFuel - endFuel) * 10) / 10;
    }

    trips.push({
      id: `trip-${first.timestampMs}`,
      startTime: first.timestamp,
      endTime: last.timestamp,
      durationMinutes,
      distanceKm: Math.round(totalDistKm * 10) / 10,
      maxSpeedKmH: Math.round(maxSpeed),
      avgSpeedKmH: avgSpeed,
      startFuelPercent: startFuel,
      endFuelPercent: endFuel,
      fuelConsumedPercent,
      startCoords: [first.lat, first.lng],
      endCoords: [last.lat, last.lng],
      points: currentPoints,
    });

    currentPoints = [];
  };

  const TRIP_GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes inactivity separates trips

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i];

    // Filter out completely invalid GPS fixes (0,0)
    if (rec.latitude === 0 && rec.longitude === 0) continue;

    const metrics = decodeCanMetrics(rec);
    const point: TripPoint = {
      lat: rec.latitude,
      lng: rec.longitude,
      speed: rec.speed,
      timestamp: rec.timestamp,
      timestampMs: rec.timestampMs,
      rpm: metrics.engine.rpm,
      fuelPercent: metrics.fuel.levelPercent,
    };

    if (currentPoints.length === 0) {
      currentPoints.push(point);
      continue;
    }

    const lastPoint = currentPoints[currentPoints.length - 1];
    const gap = point.timestampMs - lastPoint.timestampMs;

    if (gap > TRIP_GAP_THRESHOLD_MS) {
      flushTrip();
      currentPoints.push(point);
    } else {
      currentPoints.push(point);
    }
  }

  flushTrip();

  // Return trips with newest first
  return trips.reverse();
}
