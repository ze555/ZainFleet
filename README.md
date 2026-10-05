# ZainFleet Teltonika TCP Server

خادم .NET 8 يستقبل أجهزة Teltonika عبر اتصال TCP خام، ويفصل قناة الأجهزة عن HTTP. يدعم مصافحة IMEI وحزم AVL من Codec 8 (`0x08`) وCodec 8 Extended (`0x8E`) مع CRC-16/IBM وإقرار عدد السجلات. واجهات HTTP مخصصة للصحة والإدارة فقط.

> قيم المحاكي في `Teltonika.TestClient` والاختبارات هي TEST FIXTURE مولّدة وليست تسجيلًا من جهاز أو بيانات تتبع حقيقية. لا ترسلها إلى أجهزة/أنظمة إنتاجية.

## المنافذ والواجهات

| الخدمة | الربط الافتراضي | الاستخدام |
|---|---|---|
| TCP | `0.0.0.0:5000` | IMEI وحزم Teltonika الثنائية؛ غيّره عبر `TCP_PORT` |
| HTTP | `0.0.0.0:$PORT`، والافتراضي `8080` | health وواجهات الإدارة فقط |

- `GET /health` يرجع HTTP 200 عند عمل التطبيق.
- `GET /api/devices` يعرض الأجهزة التي اتصلت منذ تشغيل العملية.
- `GET /api/devices/{imei}` يعرض حالة الجهاز.
- `GET /api/devices/{imei}/latest` يعرض آخر سجل AVL محفوظ في الذاكرة.

## التشغيل محليًا

المتطلبات: .NET 8 SDK (أو Visual Studio يدعم Target Framework `net8.0`). من مجلد المستودع:

```powershell
dotnet run --project ZainFleet/ZainFleet.csproj
```

الافتراضي هو TCP `5000` وHTTP `8080`. تحقق عبر `http://localhost:8080/health`؛ عنوان الاستماع الفعلي للخادم هو `0.0.0.0` وليس loopback.

تغيير المنافذ في PowerShell:

```powershell
$env:TCP_PORT = "5100"
$env:PORT = "8081"
dotnet run --project ZainFleet/ZainFleet.csproj
```

استخدم نافذة PowerShell أخرى لاختبار health على `http://localhost:8081/health`، واستخدم TCP port `5100` للمحاكي. متغير `TCP_PORT` هو منفذ الجهاز الداخلي؛ لا تخلطه مع منفذ HTTP أو المنفذ الخارجي الذي تخصصه Railway.

## تشغيل الاختبارات وعميل المحاكاة

```powershell
dotnet test ZainFleet.Tests/ZainFleet.Tests.csproj
dotnet run --project Teltonika.TestClient/Teltonika.TestClient.csproj -- localhost 5000 123456789012345
```

العميل يرسل IMEI من 15 رقمًا ثم TEST FIXTURE Codec 8 مولّدة بإحداثيات صفرية، وينتظر ACK. استخدم IMEI اختبارًا فقط، ولا تعتبر السجل التجريبي موقعًا حقيقيًا. العميل مستقل عن إعدادات بروتوكول أجهزة الإنتاج.

## Docker محليًا

نفّذ من جذر المستودع:

```powershell
docker build -t zainfleet-teltonika .
docker run --rm -p 8080:8080 -p 5000:5000 -e PORT=8080 -e TCP_PORT=5000 zainfleet-teltonika
```

اختبر `http://localhost:8080/health`، ثم وجّه عميل الاختبار إلى `localhost 5000`. ينشر Dockerfile التطبيق في Linux باستخدام صور .NET 8، ويشغّله بمستخدم غير root. `EXPOSE` توثيق للمنافذ؛ يلزم نشرها أو إعداد TCP proxy في منصة الاستضافة.

## النشر على Railway من GitHub

1. ادفع المستودع إلى GitHub.
2. في Railway اختر **New Project → Deploy from GitHub Repo** ثم اختر المستودع.
3. Railway يكتشف `railway.json` ويستخدم Dockerfile الموجود في جذر المستودع. انتظر نجاح البناء.
4. في إعدادات الخدمة أضف المتغيرات أدناه. اترك `PORT` الذي تخصصه Railway كما هو؛ التطبيق يربط HTTP عليه تلقائيًا.
5. اجعل Health Check Path هو `/health`. يستخدم Railway منفذ HTTP الداخلي للخدمة؛ إذا طلبت الواجهة تحديد المنفذ، استخدم قيمة `PORT` للخدمة، وليس `TCP_PORT`.
6. افتح إعدادات **Networking / TCP Proxy**، وأنشئ proxy للمنفذ الداخلي المطابق لقيمة `TCP_PORT` (افتراضيًا `5000`). لا تنشئ HTTP domain بدل TCP proxy لقناة الأجهزة.
7. بعد تفعيل TCP Proxy تعرض Railway اسم/عنوان الاتصال الخارجي (**TCP Domain**) والمنفذ (**TCP Port**). انسخ كليهما من لوحة الخدمة. قد يكون المنفذ الخارجي المخصص مختلفًا عن `TCP_PORT` الداخلي. لا تفترض اسمًا أو رقمًا ثابتًا.
8. اختبر `/health` على عنوان HTTP الذي تعرضه Railway، واختبر TCP من عميل خارجي باستخدام TCP Domain وTCP Port المعروضين.

### Environment Variables

| المتغير | الافتراضي | المعنى |
|---|---:|---|
| `TCP_PORT` | `5000` | منفذ TCP الداخلي؛ اضبط TCP Proxy ليوجه إليه |
| `PORT` | `8080` محليًا | منفذ HTTP؛ Railway يحقنه عادةً |
| `TCP_IDLE_TIMEOUT_SECONDS` | `300` | مهلة الخمول لقراءات الاتصال |
| `TCP_MAX_PACKET_BYTES` | `1048576` | الحد الأقصى لطول data field للحزمة |
| `TCP_MAX_SESSIONS` | `1000` | أقصى عدد اتصالات متزامنة؛ الاتصالات الزائدة تنتظر في backlog |
| `ASPNETCORE_URLS` | غير مضبوط | اختياري لتجاوز ربط HTTP؛ الافتراضي `http://0.0.0.0:$PORT` |

غيّر `TCP_PORT` في Railway فقط إذا غيّرت معه منفذ الهدف داخل TCP Proxy. لا تضع أسرارًا أو كلمات مرور في سجلات التطبيق أو متغيرات غير لازمة؛ المصافحة لا تسجل محتوى AVL الخام.

## إعداد جهاز Teltonika

في إعدادات الاتصال بالخادم (قد تختلف أسماء الحقول حسب الطراز والبرنامج الثابت):

- **Server Domain/IP:** قيمة TCP Domain التي تعرضها Railway، دون `https://`.
- **Server Port:** قيمة TCP Port الخارجية التي تعرضها Railway، وليس المنفذ الداخلي إلا إذا تطابقا.
- **Protocol / Transport:** `TCP`.
- تأكد أن الجهاز يستخدم صيغة/Codec مدعومة (Codec 8 أو Codec 8 Extended) وأن إعداد APN والشبكة يسمحان بالاتصال.

مسار البيانات هو: الجهاز → Railway TCP Proxy → منفذ `TCP_PORT` داخل الحاوية → محلل Teltonika. HTTP لا يستقبل بيانات التتبع.

## اختبار اتصال TCP

- محليًا استخدم TestClient أعلاه، أو عميل TCP يرسل: طول IMEI من بايتين big-endian، ثم 15 رقم IMEI ASCII؛ يجب أن يرد الخادم ببايت `0x01` للقبول. بعدها أرسل AVL packet وتحقق من ACK رباعي البايتات big-endian لعدد السجلات.
- على Railway شغّل TestClient من جهازك مع TCP Domain وTCP Port الظاهرين في Networking.
- راقب سجلات Railway: `DEVICE CONNECTED`, `DEVICE IMEI`, `PACKET RECEIVED`, `AVL RECORDS`, `PACKET ACK`, `DEVICE DISCONNECTED` أو `PARSE ERROR`.
- لا يمكن اختبار TCP Proxy من داخل رابط HTTP health؛ القناتان منفصلتان.

## التصميم والقيود الحالية

المكونات الأساسية منفصلة إلى `TcpServer`, `TcpClientSession`, `Protocol` decoders, `DeviceManager`, نماذج ومستودعات `IDeviceRepository` و`ITelemetryRepository`. كل جلسة تعمل async، وتُعزل أخطاء الجهاز عن listener، وتُغلق عند الإلغاء أو timeout. الحزم تُقرأ بطولها المحدد لا بافتراض أن `ReadAsync` يعيد packet كاملة.

حاليًا التخزين في الذاكرة فقط: تعرض الواجهات حالة/آخر AVL لكل IMEI، وتُفقد البيانات عند إعادة تشغيل العملية، ولا تتشارك بين نسخ الخدمة. أضف تنفيذًا دائمًا للمستودعات قبل التوسع متعدد النسخ. يدعم decoder Codec 8 و8 Extended فقط؛ Codec 16 غير منفذ. IO الثابتة تعرض قيمة رقمية غير موقعة، وIO ذات الطول المتغير تعرض hex؛ لا يوجد قاموس لتحويل أرقام IO إلى أسماء موحدة لأن المعاني تختلف حسب الجهاز والـfirmware. IMEI يُقبل إذا كان 15 رقم ASCII؛ لا يوجد تحقق ملكية أو قائمة سماح.
