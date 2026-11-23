# Usagi Taskbar Island

![Usagi Taskbar Island Preview](screenshots/preview.png)

A modular Fluent Design island for the **Windows 11 taskbar**, combining a customizable **Media Bar + Mini-Player Popup** and a **WireGuard VPN toggle**.

> 🌐 [Русская документация](#русская-документация) · 📦 Built for [Windhawk](https://windhawk.net/)

---

## Repository Contents

- [`vk-music-bridge.user.js`](./vk-music-bridge.user.js) — Browser userscript (Violentmonkey / Tampermonkey) that bridges Shuffle, Repeat, and Add/Remove from Library with VK Music (`vk.com`, `vk.ru`, `music.vk.com`) using a shared secret token.
- `usagi-taskbar-island.wh.cpp` — Source code of the taskbar island mod (`@include explorer.exe` only).
- `wireguard-split-tunneling.wh.cpp` — Standalone companion Windhawk mod for per-app **Split Tunneling** (supports both 32-bit and 64-bit apps).

---

## Key Features

- **Taskbar Island (`Island`):**
  - Unified pill or separate capsules (Media Bar & VPN apart) on any taskbar edge (`Left edge`, `Center`, `Right edge`, `System Tray Left/Right`).
  - Full multi-monitor support: target a specific monitor (`Island → Monitor number`, `1` = Primary) or show on **All monitors**.
  - Surface customization: `Transparent`, `Solid color`, or Windows 11 `Acrylic glass`, corner radius, paddings, border, and `ThemeShadow`.
- **Media Bar & Mini-Player (`MediaBar`, `MiniPlayer`):**
  - Album cover art (square or adaptive aspect ratio), track title & artist (with optional smooth marquee scrolling), Prev / Play-Pause / Next, plus optional Shuffle, Repeat, and Library buttons.
  - Native Windows 11 tile hover highlight, mouse wheel shortcuts (next/prev track or switch media source), and right-click context menu.
  - Left-clicking track info or cover opens a borderless **Translucent** / **Fluent Acrylic** / **Solid** Mini-Player popup with adaptive art proportions, interactive seek bar, and multi-session switcher (cleanly mapping browser AUMIDs like Firefox, Chrome, Edge, Opera, Yandex).
- **WireGuard VPN Toggle (`VpnConnection`, `VpnAppearance`):**
  - Connect/disconnect WireGuard and AmneziaWG tunnels via standard UAC prompt, or optional one-click **passwordless** toggle via Windows Task Scheduler (`WindhawkVPN_Start` / `WindhawkVPN_Stop`).
  - 11 built-in SVG icons, per-state HEX/RGB/`auto` icon colors, customizable label text, status dot, and optional tray notifications.
- **VK Music Bridge (`vk-music-bridge.user.js`):**
  - **Optional (disabled by default):** Standard Windows media controls (SMTC) do not expose VK's Shuffle, Repeat, or Add-to-Library state. The companion userscript syncs them over localhost (`127.0.0.1:49321`) with multi-tab leader election when both `enableVkBridge` and a non-empty **VK Bridge Secret Token** are configured.

---

## Installation

### 1. Install the Windhawk Mod
1. Install [Windhawk](https://windhawk.net/).
2. Open **Explore**, search for **Usagi Taskbar Island**, and click **Install**. *(Or paste `usagi-taskbar-island.wh.cpp` when creating a local mod).*

### 2. Install VK Music Bridge *(Optional — Off by Default)*
1. Open **Mod Settings → MediaBar → Style, controls & VK Bridge**:
   - Turn on **Enable VK Music HTTP Bridge**.
   - Enter a random secret phrase in **VK Bridge Secret Token** (the local HTTP listener stays inactive until a non-empty token is configured, sends no wildcard CORS headers, and returns `403 Forbidden` on missing/mismatched `token`).
   - Click **Save settings**.
2. Install **Violentmonkey** or **Tampermonkey** in your browser (Firefox, Chrome, Edge, Opera, Yandex, etc.).
3. Click the direct raw install link below:

   👉 **[Install `vk-music-bridge.user.js`](https://raw.githubusercontent.com/usagi-dead/usagi-taskbar-island/main/vk-music-bridge.user.js)**

4. On any VK tab, open your userscript extension menu → click **`Set VK Bridge token`** → paste the exact same secret token → refresh open VK tabs (`F5`). Only the actively playing tab polls the bridge (`localStorage` leader election).

### 3. Configure WireGuard VPN *(Optional)*
> If you only need the Media Player, disable `Island → Enable VPN button module` in mod settings.

1. Install [WireGuard for Windows](https://www.wireguard.com/install/) (or AmneziaWG) and keep your `.conf` file in an administrator-protected folder (e.g. `C:\Program Files\WireGuard\Data\Configurations\my-vpn.conf`).
2. Open **Mod Settings → VPN — Connection & Behavior**:
   - Check **Path to `wireguard.exe`** (default: `C:\Program Files\WireGuard\wireguard.exe`).
   - Enter the full path in **Path to `.conf` file**.
   - Save settings.
3. By default, clicking the VPN button runs WireGuard through a standard UAC elevation prompt without creating persistent system tasks.
4. *(Optional — Passwordless Toggle)* **Right-click** the VPN button on the taskbar → select **"Setup / update passwordless toggle (1 time)"** and approve the single UAC prompt. This registers two Windows Task Scheduler tasks (`WindhawkVPN_Start` and `WindhawkVPN_Stop`, `/sc ONCE /rl HIGHEST`).
   - **Important persistence & security note:** These tasks remain in Windows Task Scheduler even after the mod is disabled or uninstalled, and any process in your user session can run them to launch WireGuard elevated with that `.conf` path — always store the `.conf` file where non-admin apps cannot edit it.
   - **How to remove the tasks:** Right-click the VPN button → **"Remove passwordless tasks (cleanup)"**, or run elevated:
     - `schtasks /delete /tn WindhawkVPN_Start /f`
     - `schtasks /delete /tn WindhawkVPN_Stop /f`

### 4. Per-App Split Tunneling *(Separate Mod)*
Split Tunneling has been separated into its own standalone Windhawk mod (**WireGuard Split Tunneling**, `wireguard-split-tunneling.wh.cpp`) so **Usagi Taskbar Island** loads solely inside `explorer.exe` and Split Tunneling can target both **32-bit** and **64-bit** applications.

---

## Controls & Multi-Monitor Tips
- **Left-click album art / track title:** Toggle Mini-Player popup.
- **Right-click Media Bar:** Full playback context menu (Play/Pause, Next/Prev, Stop, -/+5s, Shuffle, Repeat `Off / Playlist / One track`, Add/Remove VK Library, active session switcher).
- **Left-click VPN button:** Connect / Disconnect VPN.
- **Right-click VPN button:** Connect/Disconnect, Setup/update passwordless tasks, Remove passwordless tasks (cleanup), Open WireGuard, Open `.conf`.
- **Multi-monitor:** Default is **Monitor `1` (Primary)**. Set `Island → Monitor number` to `2` (etc.) or set `Monitor display mode` to `All monitors`.

---

## Русская документация

Модульный островок в стиле **Fluent Design** для **панели задач Windows 11** (`explorer.exe`). Объединяет настраиваемый **Медиаплеер** со всплывающим окном полного просмотра и кнопку **WireGuard VPN**.

### Содержимое репозитория
- [`vk-music-bridge.user.js`](./vk-music-bridge.user.js) — юзерскрипт для **Violentmonkey / Tampermonkey**, который синхронизирует кнопки `Перемешать`, `Повтор` и `Добавить/убрать из библиотеки` на `vk.com`, `vk.ru` и `music.vk.com` по секретному токену.
- `usagi-taskbar-island.wh.cpp` — исходный код мода островка (работает только внутри `explorer.exe`).
- `wireguard-split-tunneling.wh.cpp` — отдельный мод Windhawk для **раздельного туннелирования (Split Tunneling)** с поддержкой 32- и 64-битных программ.

### Основные возможности
- **Островок (`Island`):** единая капсула или раздельные модули, выбор монитора (`1` — основной, `2`, или все мониторы), любая позиция на панели (`Левый край`, `Центр`, `Правый край`, `Трей`), стили фона (`Прозрачный`, `Сплошной`, `Acrylic`), скругление, рамки и тень `ThemeShadow`.
- **Медиаплеер и мини-плеер (`MediaBar`, `MiniPlayer`):** обложка (квадратная или адаптивная `1:1`/`16:9`), название и автор (опционально бегущая строка), управление воспроизведением, нативный hover Win11, действия колеса мыши, контекстное меню ПКМ и безрамочное окно полного просмотра (`Translucent` / `Acrylic` / `Сплошной`) с перемоткой и выбором источника медиа.
- **Кнопка WireGuard VPN (`VpnConnection`, `VpnAppearance`):** включение/выключение через UAC или опционально без запроса UAC через Планировщик заданий (`WindhawkVPN_Start` / `WindhawkVPN_Stop`), совместимость с WireGuard и AmneziaWG, 11 SVG-иконок с отдельным выбором цвета для каждого статуса, текст, точка-индикатор и уведомления.
- **Раздельное туннелирование:** вынесено в отдельный мод `WireGuard Split Tunneling`, чтобы не инжектить основной мод в сторонние программы и покрывать как 64-битные, так и 32-битные приложения.

### Установка и настройка

#### 1. Установка мода Windhawk
1. Установите [Windhawk](https://windhawk.net/).
2. Откройте вкладку **Explore**, найдите **Usagi Taskbar Island** и нажмите **Install**.

#### 2. Подключение моста ВК Музыки *(опционально, выключено по умолчанию)*
1. В настройках мода **MediaBar → Стиль, кнопки и мост ВК Музыки** включите **Включить мост ВК Музыки** и задайте произвольный **Секретный токен моста ВК** (сервер на `127.0.0.1:49321` не запускается без токена и не отдаёт открытые CORS-заголовки).
2. Установите **Violentmonkey** или **Tampermonkey** и кликните по ссылке:

   👉 **[Установить `vk-music-bridge.user.js`](https://raw.githubusercontent.com/usagi-dead/usagi-taskbar-island/main/vk-music-bridge.user.js)**

3. На вкладке ВК откройте меню расширения → нажмите **`Set VK Bridge token`** → вставьте тот же самый токен → обновите вкладки (`F5`).

#### 3. Настройка WireGuard VPN *(если нужен VPN-модуль)*
> Если вам нужен только медиаплеер — отключите `Island → Включить модуль кнопки VPN` в настройках мода.

1. Установите [WireGuard для Windows](https://www.wireguard.com/install/) (или AmneziaWG) и сохраните `.conf` файл в папке с правами администратора.
2. В настройках мода проверьте **Путь к `wireguard.exe`** и укажите **Путь к файлу `.conf`**.
3. По умолчанию переключение идёт через обычный запрос UAC.
4. *(По желанию — без UAC)* Нажмите **ПКМ** по кнопке VPN → **«Настроить / обновить запуск без UAC (1 раз)»**. Создаются задачи `WindhawkVPN_Start` и `WindhawkVPN_Stop`. Они **остаются в Планировщике заданий после удаления мода**, поэтому удалить их можно через **ПКМ → «Удалить задачи без UAC (очистка)»** или от имени администратора:
   - `schtasks /delete /tn WindhawkVPN_Start /f`
   - `schtasks /delete /tn WindhawkVPN_Stop /f`

### Управление и мультимониторность
- **ЛКМ по обложке / названию:** открыть/закрыть окно полного просмотра.
- **ПКМ по плееру:** полное меню управления, выбор режима повтора (`Выкл` / `Плейлист` / `Один трек`), библиотека ВК и переключение источника медиа.
- **ЛКМ по VPN:** включить/выключить туннель. **ПКМ по VPN:** меню с настройкой/удалением задач без UAC и быстрым открытием WireGuard / `.conf`.
- **Второй монитор:** по умолчанию выбран **монитор `1`**. Чтобы перенести островок, измените `Island → Номер монитора` на `2` или выберите `Все мониторы`.

---

## License

[MIT License](https://opensource.org/licenses/MIT)
