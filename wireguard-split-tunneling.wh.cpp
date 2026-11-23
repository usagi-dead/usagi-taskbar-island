// ==WindhawkMod==
// @id              wireguard-split-tunneling
// @name            WireGuard Split Tunneling
// @name:ru-RU      WireGuard — Раздельное туннелирование
// @description     Route selected applications or folders directly through your physical network adapter, bypassing WireGuard / AmneziaWG VPN tunnels (supports both 32-bit and 64-bit apps)
// @description:ru-RU Направляет выбранные программы или папки напрямую через физический сетевой адаптер в обход туннелей WireGuard / AmneziaWG (поддерживает 32- и 64-битные приложения)
// @version         1.0.0
// @author          usagi
// @github          https://github.com/usagi-dead
// @license         MIT
// @include         *
// @exclude         explorer.exe
// @exclude         audiodg.exe
// @exclude         windhawk.exe
// @exclude         wireguard.exe
// @exclude         amneziawg.exe
// @exclude         csrss.exe
// @exclude         smss.exe
// @exclude         wininit.exe
// @exclude         winlogon.exe
// @exclude         lsass.exe
// @exclude         services.exe
// @exclude         svchost.exe
// @exclude         dwm.exe
// @exclude         fontdrvhost.exe
// @exclude         SearchHost.exe
// @exclude         StartMenuExperienceHost.exe
// @exclude         ShellExperienceHost.exe
// @exclude         RuntimeBroker.exe
// @exclude         backgroundTaskHost.exe
// @exclude         conhost.exe
// @exclude         sihost.exe
// @exclude         taskhostw.exe
// @exclude         ctfmon.exe
// @exclude         spoolsv.exe
// @exclude         Taskmgr.exe
// @exclude         WerFault.exe
// @exclude         wermgr.exe
// @exclude         msiexec.exe
// @exclude         TiWorker.exe
// @exclude         TrustedInstaller.exe
// @exclude         MsMpEng.exe
// @exclude         NisSrv.exe
// @exclude         SecurityHealthService.exe
// @exclude         *\Windows\System32\DriverStore\*
// @exclude         *\Windows\SystemApps\*
// @compilerOptions -DWIN32_LEAN_AND_MEAN -lws2_32 -liphlpapi
// ==/WindhawkMod==

// ==WindhawkModReadme==
/*
# WireGuard Split Tunneling

Routes outbound network connections from selected applications or folders directly through your physical network adapter, bypassing **WireGuard** or **AmneziaWG** VPN tunnels.

Designed as the companion split-tunneling module to **Usagi Taskbar Island** (so the taskbar island stays strictly in `explorer.exe`, while this mod covers both **32-bit** and **64-bit** apps).

[Русская документация ниже](#русская-документация)

---

## How It Works

When a newly started process matches a rule in your exclusion list, this mod attaches Winsock hooks (`connect`, `WSAConnect`, `sendto`, `WSASendTo`) inside that process:
- Outbound **public IPv4** traffic binds to your active physical Ethernet/Wi-Fi adapter (`IP_UNICAST_IF` + source IP `bind` when unbound).
- Local loopback (`127.0.0.0/8`), private LAN (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), CGNAT (`100.64.0.0/10`), link-local, and multicast addresses are left untouched.
- Optionally blocks outbound public **IPv6** traffic (`blockIpv6`) for excluded apps so dual-stack apps cannot leak IPv6 outside or hang on unreachable IPv6 routes; when `blockIpv6` is off, public IPv6 routes via `IPV6_UNICAST_IF` if a physical IPv6 address exists.

Processes that do **not** match any rule return `FALSE` from `Wh_ModInit` and unload immediately.

---

## Setup

1. Open **Mod Settings** and ensure **Enable Split Tunneling** is turned on.
2. *(Optional)* Enter your VPN **Tunnel interface name** (for example, `wg0`) so it is always excluded when auto-detecting your physical network adapter (WireGuard/AmneziaWG/Wintun/VPN adapters are already skipped automatically).
3. Add rules under **Excluded applications** and check **Enabled** on each entry:
   - Exact executable name: `firefox.exe`
   - Process stem (without extension): `steam`
   - Folder prefix (matches all executables inside): `C:\Games\`
   - Full executable path: `C:\Apps\MyApp\app.exe`
4. Click **Save settings** and **restart** any newly added applications so the hooks activate when they start.

> **Security / Anti-Cheat Note:** Because this mod uses `@include *` to catch newly launched excluded apps, you may also open Windhawk's **Advanced** tab and set **Custom process inclusion list** strictly to the exact `.exe` names you want bypassed (for example, `firefox.exe`, `steam.exe`). Never inject unsigned Windhawk mods into games protected by kernel anti-cheat systems.

---

## Русская документация

Направляет сетевые подключения выбранных программ или целых папок напрямую через физический сетевой адаптер, в обход **WireGuard** / **AmneziaWG**. Поддерживаются как **64-битные**, так и **32-битные** приложения.

### Настройка

1. Убедитесь, что опция **Включить раздельное туннелирование** активна.
2. *(Необязательно)* Укажите **Имя VPN-туннеля** (например, `wg0`), чтобы мод гарантированно игнорировал интерфейс вашего туннеля (адаптеры WireGuard/AmneziaWG/Wintun/VPN пропускаются и автоматически).
3. В списке **Исключённые приложения** добавьте нужные правила и включите галочку **Включено**:
   - Точное имя файла: `firefox.exe`
   - Имя без расширения: `steam`
   - Папка (действует на все программы внутри): `C:\Games\`
   - Полный путь к файлу: `C:\Apps\MyApp\app.exe`
4. Нажмите **Сохранить настройки** и **перезапустите** добавленные программы.

> **Совет:** Для процессов, не входящих в список, мод сразу выгружается на этапе инициализации. При желании во вкладке **Дополнительно** (Advanced) в Windhawk можно дополнительно ограничить **Свой список включения процессов** конкретными именами ваших программ, чтобы мод даже не проверял посторонние приложения и игры с античитом.
*/
// ==/WindhawkModReadme==

// ==WindhawkModSettings==
/*
- enabled: true
  $name: Enable Split Tunneling
  $name:ru-RU: Включить раздельное туннелирование
  $description: Route matched applications directly through your physical Ethernet/Wi-Fi adapter outside the VPN tunnel.
  $description:ru-RU: Пропускать выбранные приложения напрямую через физический сетевой адаптер мимо VPN-туннеля.
- tunnelName: ""
  $name: VPN tunnel name (optional)
  $name:ru-RU: Имя VPN-туннеля (необязательно)
  $description: Optional tunnel name (derived from .conf filename, e.g. my-vpn) to explicitly exclude from physical adapter detection.
  $description:ru-RU: Имя туннеля (как имя .conf файла) для явного исключения при поиске физического адаптера.
- blockIpv6: true
  $name: Block IPv6 in bypassed apps
  $name:ru-RU: Блокировать IPv6 в исключённых программах
  $description: Recommended to prevent IPv6 leaks when bypassing VPN. Turn off to bypass native public IPv6 over the physical adapter instead.
  $description:ru-RU: Рекомендуется для предотвращения утечек IPv6. Если выключить, публичный IPv6 также пойдёт через физический адаптер.
- excludedApps:
  - - app: ""
      $name: Application name, folder path, or full exe path
      $name:ru-RU: Имя .exe, папка или полный путь
      $description: "Examples: firefox.exe, steam, C:\\Games\\, C:\\Apps\\tool.exe"
      $description:ru-RU: "Примеры: firefox.exe, steam, C:\\Games\\, C:\\Apps\\tool.exe"
    - enabled: true
      $name: Enabled
      $name:ru-RU: Включено
  $name: Excluded applications
  $name:ru-RU: Исключённые приложения
  $description: Applications routed directly outside the VPN. Restart an app after adding it here.
  $description:ru-RU: Программы, работающие в обход VPN. После добавления программу нужно перезапустить.
*/
// ==/WindhawkModSettings==

#include <winsock2.h>
#include <ws2tcpip.h>
#include <iphlpapi.h>
#include <windows.h>
#include <windhawk_utils.h>

#include <algorithm>
#include <atomic>
#include <cstring>
#include <cwctype>
#include <string>
#include <vector>

#ifndef IP_UNICAST_IF
#define IP_UNICAST_IF 31
#endif

#ifndef IPV6_UNICAST_IF
#define IPV6_UNICAST_IF 31
#endif

namespace {

std::wstring ToLower(std::wstring s) {
    for (wchar_t& ch : s) {
        ch = static_cast<wchar_t>(towlower(ch));
    }
    return s;
}

std::wstring NormalizePathSlashes(std::wstring s) {
    for (wchar_t& ch : s) {
        if (ch == L'/') ch = L'\\';
    }
    return s;
}

std::wstring TrimWhitespace(std::wstring s) {
    const auto isWs = [](wchar_t ch) { return ch == L' ' || ch == L'\t' || ch == L'\r' || ch == L'\n'; };
    while (!s.empty() && isWs(s.front())) s.erase(s.begin());
    while (!s.empty() && isWs(s.back())) s.pop_back();
    return s;
}

struct ExcludedAppRule {
    std::wstring ruleLower;
    bool enabled = true;
};

struct PhysicalAdapterInfo {
    DWORD ifIndexV4 = 0;
    DWORD ifIndexV6 = 0;
    IN_ADDR srcV4{};
    IN6_ADDR srcV6{};
    bool hasSrcV4 = false;
    bool hasSrcV6 = false;
    ULONGLONG lastRefreshTick = 0;
};

[[clang::no_destroy]] std::wstring g_procFullPathLower;
[[clang::no_destroy]] std::wstring g_procFileNameLower;
[[clang::no_destroy]] std::wstring g_procStemLower;
[[clang::no_destroy]] std::wstring g_tunnelNameLower;
[[clang::no_destroy]] PhysicalAdapterInfo g_adapterCache{};
SRWLOCK g_adapterLock = SRWLOCK_INIT;

std::atomic<bool> g_unloading{false};
std::atomic<bool> g_active{false};
std::atomic<bool> g_blockIpv6{true};

void InitCurrentProcessInfo() {
    wchar_t path[MAX_PATH * 4]{};
    const DWORD len = GetModuleFileNameW(nullptr, path, ARRAYSIZE(path));
    if (len == 0 || len >= ARRAYSIZE(path)) {
        g_procFullPathLower.clear();
        g_procFileNameLower.clear();
        g_procStemLower.clear();
        return;
    }

    g_procFullPathLower = ToLower(NormalizePathSlashes(std::wstring(path, len)));
    const size_t slash = g_procFullPathLower.find_last_of(L'\\');
    g_procFileNameLower = (slash != std::wstring::npos)
        ? g_procFullPathLower.substr(slash + 1)
        : g_procFullPathLower;

    g_procStemLower = g_procFileNameLower;
    if (g_procStemLower.size() > 4 && g_procStemLower.ends_with(L".exe")) {
        g_procStemLower.resize(g_procStemLower.size() - 4);
    }
}

bool MatchesProcessRule(const std::wstring& rawRuleLower) {
    if (rawRuleLower.empty() || g_procFileNameLower.empty()) return false;
    const std::wstring rule = NormalizePathSlashes(rawRuleLower);

    if (rule == g_procFileNameLower || rule == g_procStemLower || rule == g_procFullPathLower) {
        return true;
    }

    // Folder prefix rule (trailing backslash added automatically if omitted)
    if (rule.find(L'\\') != std::wstring::npos || rule.find(L':') != std::wstring::npos) {
        std::wstring prefix = rule;
        if (!prefix.empty() && prefix.back() != L'\\') {
            prefix.push_back(L'\\');
        }
        if (g_procFullPathLower.size() > prefix.size() &&
            g_procFullPathLower.compare(0, prefix.size(), prefix) == 0) {
            return true;
        }
    }

    return false;
}

bool LoadSettingsForCurrentProcess() {
    const bool enabled = (Wh_GetIntSetting(L"enabled") != 0);
    g_blockIpv6.store(Wh_GetIntSetting(L"blockIpv6") != 0);

    PCWSTR rawTunnel = Wh_GetStringSetting(L"tunnelName");
    g_tunnelNameLower = rawTunnel ? ToLower(TrimWhitespace(rawTunnel)) : std::wstring{};
    if (rawTunnel) Wh_FreeStringSetting(rawTunnel);

    std::vector<ExcludedAppRule> rules;
    for (int i = 0; i < 128; ++i) {
        PCWSTR rawApp = Wh_GetStringSetting(L"excludedApps[%d].app", i);
        if (!rawApp) break;
        const std::wstring trimmed = ToLower(TrimWhitespace(rawApp));
        Wh_FreeStringSetting(rawApp);

        const int ruleEnabled = Wh_GetIntSetting(L"excludedApps[%d].enabled", i);
        if (!trimmed.empty()) {
            rules.push_back(ExcludedAppRule{trimmed, ruleEnabled != 0});
        }
    }

    if (!enabled) return false;

    for (const auto& rule : rules) {
        if (rule.enabled && MatchesProcessRule(rule.ruleLower)) {
            return true;
        }
    }
    return false;
}

bool IsTunnelAdapter(const IP_ADAPTER_ADDRESSES* aa, const std::wstring& tunnelNameLower) {
    if (!aa) return true;
    if (aa->IfType == IF_TYPE_TUNNEL || aa->IfType == IF_TYPE_PROP_VIRTUAL) {
        return true;
    }

    std::wstring friendly = aa->FriendlyName ? ToLower(aa->FriendlyName) : L"";
    std::wstring desc = aa->Description ? ToLower(aa->Description) : L"";

    if (!tunnelNameLower.empty() &&
        (friendly == tunnelNameLower || friendly.find(tunnelNameLower) != std::wstring::npos ||
         desc.find(tunnelNameLower) != std::wstring::npos)) {
        return true;
    }

    static constexpr const wchar_t* kTunnelKeywords[] = {
        L"wireguard", L"amnezia", L"wintun", L"tunnel", L"vpn",
        L"tap-", L"tun", L"openvpn", L"nekoray", L"sing-box", L"clash"
    };
    for (const wchar_t* kw : kTunnelKeywords) {
        if (friendly.find(kw) != std::wstring::npos || desc.find(kw) != std::wstring::npos) {
            return true;
        }
    }
    return false;
}

PhysicalAdapterInfo FindPhysicalAdapter(const std::wstring& tunnelNameLower) {
    PhysicalAdapterInfo result{};

    ULONG bufSize = 16384;
    std::vector<BYTE> buf(bufSize);
    ULONG ret = ERROR_BUFFER_OVERFLOW;
    const ULONG flags = GAA_FLAG_INCLUDE_GATEWAYS | GAA_FLAG_SKIP_ANYCAST |
                        GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER;

    for (int attempt = 0; attempt < 3; ++attempt) {
        ret = GetAdaptersAddresses(AF_UNSPEC, flags, nullptr,
                                   reinterpret_cast<PIP_ADAPTER_ADDRESSES>(buf.data()), &bufSize);
        if (ret != ERROR_BUFFER_OVERFLOW) break;
        buf.resize(bufSize);
    }
    if (ret != ERROR_SUCCESS) {
        return result;
    }

    int bestV4Score = -1;
    int bestV6Score = -1;

    for (const IP_ADAPTER_ADDRESSES* aa = reinterpret_cast<const IP_ADAPTER_ADDRESSES*>(buf.data());
         aa != nullptr;
         aa = aa->Next) {
        if (aa->OperStatus != IfOperStatusUp) continue;
        if (aa->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
        if (IsTunnelAdapter(aa, tunnelNameLower)) continue;

        bool hasV4Gw = false;
        bool hasV6Gw = false;
        for (const IP_ADAPTER_GATEWAY_ADDRESS_LH* gw = aa->FirstGatewayAddress; gw != nullptr; gw = gw->Next) {
            if (!gw->Address.lpSockaddr) continue;
            if (gw->Address.lpSockaddr->sa_family == AF_INET) hasV4Gw = true;
            if (gw->Address.lpSockaddr->sa_family == AF_INET6) hasV6Gw = true;
        }

        const int ifTypeBonus = (aa->IfType == IF_TYPE_ETHERNET_CSMACD) ? 20
                              : (aa->IfType == IF_TYPE_IEEE80211)       ? 15
                                                                        : 5;

        for (const IP_ADAPTER_UNICAST_ADDRESS* ua = aa->FirstUnicastAddress; ua != nullptr; ua = ua->Next) {
            if (!ua->Address.lpSockaddr) continue;
            if (ua->DadState == IpDadStateDuplicate || ua->DadState == IpDadStateInvalid) continue;

            if (ua->Address.lpSockaddr->sa_family == AF_INET && aa->IfIndex != 0) {
                const auto* sin = reinterpret_cast<const sockaddr_in*>(ua->Address.lpSockaddr);
                const uint32_t addrHost = ntohl(sin->sin_addr.s_addr);
                const bool isLinkLocal = ((addrHost & 0xFFFF0000U) == 0xA9FE0000U);
                const int score = ifTypeBonus + (hasV4Gw ? 100 : 0) + (isLinkLocal ? 0 : 10);
                if (score > bestV4Score) {
                    bestV4Score = score;
                    result.ifIndexV4 = aa->IfIndex;
                    result.srcV4 = sin->sin_addr;
                    result.hasSrcV4 = !isLinkLocal;
                }
            } else if (ua->Address.lpSockaddr->sa_family == AF_INET6 && aa->Ipv6IfIndex != 0) {
                const auto* sin6 = reinterpret_cast<const sockaddr_in6*>(ua->Address.lpSockaddr);
                if (IN6_IS_ADDR_LINKLOCAL(&sin6->sin6_addr) ||
                    IN6_IS_ADDR_LOOPBACK(&sin6->sin6_addr) ||
                    IN6_IS_ADDR_MULTICAST(&sin6->sin6_addr) ||
                    IN6_IS_ADDR_UNSPECIFIED(&sin6->sin6_addr)) {
                    continue;
                }
                const int score = ifTypeBonus + (hasV6Gw ? 100 : 0) + 10;
                if (score > bestV6Score) {
                    bestV6Score = score;
                    result.ifIndexV6 = aa->Ipv6IfIndex;
                    result.srcV6 = sin6->sin6_addr;
                    result.hasSrcV6 = true;
                }
            }
        }
    }

    return result;
}

PhysicalAdapterInfo GetCachedPhysicalAdapter() {
    const ULONGLONG now = GetTickCount64();

    AcquireSRWLockShared(&g_adapterLock);
    PhysicalAdapterInfo cached = g_adapterCache;
    ReleaseSRWLockShared(&g_adapterLock);

    if (cached.lastRefreshTick != 0 && (now - cached.lastRefreshTick) < 5000) {
        return cached;
    }

    PhysicalAdapterInfo refreshed = FindPhysicalAdapter(g_tunnelNameLower);
    refreshed.lastRefreshTick = now;

    AcquireSRWLockExclusive(&g_adapterLock);
    g_adapterCache = refreshed;
    ReleaseSRWLockExclusive(&g_adapterLock);

    return refreshed;
}

bool IsNonPublicV4(IN_ADDR addr) {
    const uint32_t ip = ntohl(addr.s_addr);
    if (ip == 0) return true;                               // 0.0.0.0/8 unspecified
    if ((ip & 0xFF000000U) == 0x7F000000U) return true;     // 127.0.0.0/8 loopback
    if ((ip & 0xFF000000U) == 0x0A000000U) return true;     // 10.0.0.0/8 RFC1918
    if ((ip & 0xFFF00000U) == 0xAC100000U) return true;     // 172.16.0.0/12 RFC1918
    if ((ip & 0xFFFF0000U) == 0xC0A80000U) return true;     // 192.168.0.0/16 RFC1918
    if ((ip & 0xFFFF0000U) == 0xA9FE0000U) return true;     // 169.254.0.0/16 link-local
    if ((ip & 0xFFC00000U) == 0x64400000U) return true;     // 100.64.0.0/10 CGNAT
    if ((ip & 0xF0000000U) >= 0xE0000000U) return true;     // multicast + reserved + broadcast
    return false;
}

bool IsNonPublicV6(const IN6_ADDR& addr) {
    if (IN6_IS_ADDR_UNSPECIFIED(&addr) ||
        IN6_IS_ADDR_LOOPBACK(&addr) ||
        IN6_IS_ADDR_LINKLOCAL(&addr) ||
        IN6_IS_ADDR_SITELOCAL(&addr) ||
        IN6_IS_ADDR_MULTICAST(&addr)) {
        return true;
    }
    // RFC 4193 Unique Local Addresses fc00::/7
    if ((addr.s6_addr[0] & 0xFE) == 0xFC) {
        return true;
    }
    return false;
}

using ConnectFn = int(WSAAPI*)(SOCKET s, const sockaddr* name, int namelen);
using WSAConnectFn = int(WSAAPI*)(SOCKET s, const sockaddr* name, int namelen,
                                  LPWSABUF lpCallerData, LPWSABUF lpCalleeData,
                                  LPQOS lpSQOS, LPQOS lpGQOS);
using SendToFn = int(WSAAPI*)(SOCKET s, const char* buf, int len, int flags,
                              const sockaddr* to, int tolen);
using WSASendToFn = int(WSAAPI*)(SOCKET s, LPWSABUF lpBuffers, DWORD dwBufferCount,
                                 LPDWORD lpNumberOfBytesSent, DWORD dwFlags,
                                 const sockaddr* lpTo, int iTolen,
                                 LPWSAOVERLAPPED lpOverlapped,
                                 LPWSAOVERLAPPED_COMPLETION_ROUTINE lpCompletionRoutine);
using BindFn = int(WSAAPI*)(SOCKET s, const sockaddr* name, int namelen);

ConnectFn Connect_Original = nullptr;
WSAConnectFn WSAConnect_Original = nullptr;
SendToFn SendTo_Original = nullptr;
WSASendToFn WSASendTo_Original = nullptr;
BindFn Bind_Original = nullptr;

int CallRealBind(SOCKET s, const sockaddr* name, int namelen) {
    return Bind_Original ? Bind_Original(s, name, namelen) : bind(s, name, namelen);
}

void ApplyBypassV4(SOCKET s, const PhysicalAdapterInfo& adapter) {
    if (adapter.ifIndexV4 == 0) return;

    const DWORD ifIdxNbo = htonl(adapter.ifIndexV4);
    setsockopt(s, IPPROTO_IP, IP_UNICAST_IF,
               reinterpret_cast<const char*>(&ifIdxNbo), sizeof(ifIdxNbo));

    if (!adapter.hasSrcV4) return;

    sockaddr_in bound{};
    int boundLen = sizeof(bound);
    const int gsn = getsockname(s, reinterpret_cast<sockaddr*>(&bound), &boundLen);
    if (gsn == SOCKET_ERROR && WSAGetLastError() == WSAEINVAL) {
        sockaddr_in local{};
        local.sin_family = AF_INET;
        local.sin_addr = adapter.srcV4;
        local.sin_port = 0;
        CallRealBind(s, reinterpret_cast<const sockaddr*>(&local), sizeof(local));
    } else if (gsn == 0 && bound.sin_family == AF_INET && bound.sin_addr.s_addr == 0) {
        sockaddr_in local{};
        local.sin_family = AF_INET;
        local.sin_addr = adapter.srcV4;
        local.sin_port = bound.sin_port;
        CallRealBind(s, reinterpret_cast<const sockaddr*>(&local), sizeof(local));
    }
}

void ApplyBypassV6(SOCKET s, const PhysicalAdapterInfo& adapter) {
    if (adapter.ifIndexV6 == 0) return;

    const DWORD ifIdx = adapter.ifIndexV6;
    setsockopt(s, IPPROTO_IPV6, IPV6_UNICAST_IF,
               reinterpret_cast<const char*>(&ifIdx), sizeof(ifIdx));

    if (!adapter.hasSrcV6) return;

    sockaddr_in6 bound{};
    int boundLen = sizeof(bound);
    const int gsn = getsockname(s, reinterpret_cast<sockaddr*>(&bound), &boundLen);
    if (gsn == SOCKET_ERROR && WSAGetLastError() == WSAEINVAL) {
        sockaddr_in6 local{};
        local.sin6_family = AF_INET6;
        local.sin6_addr = adapter.srcV6;
        CallRealBind(s, reinterpret_cast<const sockaddr*>(&local), sizeof(local));
    } else if (gsn == 0 && bound.sin6_family == AF_INET6 &&
               IN6_IS_ADDR_UNSPECIFIED(&bound.sin6_addr)) {
        sockaddr_in6 local{};
        local.sin6_family = AF_INET6;
        local.sin6_addr = adapter.srcV6;
        local.sin6_port = bound.sin6_port;
        CallRealBind(s, reinterpret_cast<const sockaddr*>(&local), sizeof(local));
    }
}

// Returns false if connection should be blocked (IPv6 leak prevention).
bool HandleOutboundTarget(SOCKET s, const sockaddr* target, int targetLen) {
    if (g_unloading.load() || !g_active.load() || !target) return true;

    if (target->sa_family == AF_INET && targetLen >= static_cast<int>(sizeof(sockaddr_in))) {
        const auto* sin = reinterpret_cast<const sockaddr_in*>(target);
        if (IsNonPublicV4(sin->sin_addr)) return true;

        const PhysicalAdapterInfo adapter = GetCachedPhysicalAdapter();
        ApplyBypassV4(s, adapter);
        return true;
    }

    if (target->sa_family == AF_INET6 && targetLen >= static_cast<int>(sizeof(sockaddr_in6))) {
        const auto* sin6 = reinterpret_cast<const sockaddr_in6*>(target);
        if (IN6_IS_ADDR_V4MAPPED(&sin6->sin6_addr)) {
            IN_ADDR v4{};
            std::memcpy(&v4, &sin6->sin6_addr.s6_addr[12], sizeof(v4));
            if (IsNonPublicV4(v4)) return true;

            const PhysicalAdapterInfo adapter = GetCachedPhysicalAdapter();
            if (adapter.ifIndexV4 != 0) {
                const DWORD ifIdxNbo = htonl(adapter.ifIndexV4);
                setsockopt(s, IPPROTO_IP, IP_UNICAST_IF,
                           reinterpret_cast<const char*>(&ifIdxNbo), sizeof(ifIdxNbo));
            }
            return true;
        }

        if (IsNonPublicV6(sin6->sin6_addr)) return true;

        if (g_blockIpv6.load()) {
            return false;
        }

        const PhysicalAdapterInfo adapter = GetCachedPhysicalAdapter();
        if (!adapter.hasSrcV6) {
            return false;
        }
        ApplyBypassV6(s, adapter);
        return true;
    }

    return true;
}

int WSAAPI Connect_Hook(SOCKET s, const sockaddr* name, int namelen) {
    if (!HandleOutboundTarget(s, name, namelen)) {
        WSASetLastError(WSAEHOSTUNREACH);
        return SOCKET_ERROR;
    }
    return Connect_Original(s, name, namelen);
}

int WSAAPI WSAConnect_Hook(SOCKET s, const sockaddr* name, int namelen,
                           LPWSABUF lpCallerData, LPWSABUF lpCalleeData,
                           LPQOS lpSQOS, LPQOS lpGQOS) {
    if (!HandleOutboundTarget(s, name, namelen)) {
        WSASetLastError(WSAEHOSTUNREACH);
        return SOCKET_ERROR;
    }
    return WSAConnect_Original(s, name, namelen, lpCallerData, lpCalleeData, lpSQOS, lpGQOS);
}

int WSAAPI SendTo_Hook(SOCKET s, const char* buf, int len, int flags,
                       const sockaddr* to, int tolen) {
    if (to && !HandleOutboundTarget(s, to, tolen)) {
        WSASetLastError(WSAEHOSTUNREACH);
        return SOCKET_ERROR;
    }
    return SendTo_Original(s, buf, len, flags, to, tolen);
}

int WSAAPI WSASendTo_Hook(SOCKET s, LPWSABUF lpBuffers, DWORD dwBufferCount,
                          LPDWORD lpNumberOfBytesSent, DWORD dwFlags,
                          const sockaddr* lpTo, int iTolen,
                          LPWSAOVERLAPPED lpOverlapped,
                          LPWSAOVERLAPPED_COMPLETION_ROUTINE lpCompletionRoutine) {
    if (lpTo && !HandleOutboundTarget(s, lpTo, iTolen)) {
        WSASetLastError(WSAEHOSTUNREACH);
        return SOCKET_ERROR;
    }
    return WSASendTo_Original(s, lpBuffers, dwBufferCount, lpNumberOfBytesSent,
                              dwFlags, lpTo, iTolen, lpOverlapped, lpCompletionRoutine);
}

int WSAAPI Bind_Hook(SOCKET s, const sockaddr* name, int namelen) {
    if (!g_unloading.load() && g_active.load() && name) {
        if (name->sa_family == AF_INET && namelen >= static_cast<int>(sizeof(sockaddr_in))) {
            const auto* sin = reinterpret_cast<const sockaddr_in*>(name);
            if (sin->sin_addr.s_addr == 0) {
                const PhysicalAdapterInfo adapter = GetCachedPhysicalAdapter();
                if (adapter.ifIndexV4 != 0) {
                    const DWORD ifIdxNbo = htonl(adapter.ifIndexV4);
                    setsockopt(s, IPPROTO_IP, IP_UNICAST_IF,
                               reinterpret_cast<const char*>(&ifIdxNbo), sizeof(ifIdxNbo));
                }
            }
        }
    }
    return Bind_Original(s, name, namelen);
}

bool HookWinsockSymbols() {
    HMODULE hWs2 = GetModuleHandleW(L"ws2_32.dll");
    if (!hWs2) {
        hWs2 = LoadLibraryExW(L"ws2_32.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
    }
    if (!hWs2) {
        return false;
    }

    auto hookExport = [&](const char* name, void* hookFn, void** origFn) {
        void* target = reinterpret_cast<void*>(GetProcAddress(hWs2, name));
        return target && Wh_SetFunctionHook(target, hookFn, origFn);
    };

    bool ok = true;
    ok = ok && hookExport("connect", reinterpret_cast<void*>(Connect_Hook), reinterpret_cast<void**>(&Connect_Original));
    ok = ok && hookExport("WSAConnect", reinterpret_cast<void*>(WSAConnect_Hook), reinterpret_cast<void**>(&WSAConnect_Original));
    ok = ok && hookExport("sendto", reinterpret_cast<void*>(SendTo_Hook), reinterpret_cast<void**>(&SendTo_Original));
    ok = ok && hookExport("WSASendTo", reinterpret_cast<void*>(WSASendTo_Hook), reinterpret_cast<void**>(&WSASendTo_Original));
    ok = ok && hookExport("bind", reinterpret_cast<void*>(Bind_Hook), reinterpret_cast<void**>(&Bind_Original));
    return ok;
}

}  // namespace

BOOL Wh_ModInit() {
    g_unloading.store(false);
    InitCurrentProcessInfo();

    if (!LoadSettingsForCurrentProcess()) {
        g_active.store(false);
        return FALSE;
    }

    if (!HookWinsockSymbols()) {
        Wh_Log(L"Failed to hook ws2_32.dll exports");
        return FALSE;
    }

    g_active.store(true);
    Wh_Log(L"Split tunneling active for %s", g_procFileNameLower.c_str());
    return TRUE;
}

BOOL Wh_ModSettingsChanged(BOOL* bReload) {
    const bool shouldBeActive = LoadSettingsForCurrentProcess();
    if (shouldBeActive && !g_active.load()) {
        *bReload = TRUE;
        return TRUE;
    }

    g_active.store(shouldBeActive);

    AcquireSRWLockExclusive(&g_adapterLock);
    g_adapterCache = {};
    ReleaseSRWLockExclusive(&g_adapterLock);

    return TRUE;
}

void Wh_ModUninit() {
    g_unloading.store(true);
    g_active.store(false);
}
