// ==UserScript==
// @name         Usagi VK Music Bridge (Taskbar Island)
// @namespace    usagi-taskbar-island
// @version      1.3.0
// @description  Bridges VK Music shuffle, repeat (off/all/one), and library add/remove to Usagi Taskbar Island.
// @author       usagi
// @match        https://vk.com/*
// @match        https://vk.ru/*
// @match        https://*.vk.com/*
// @match        https://*.vk.ru/*
// @match        https://music.vk.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const BRIDGE_URL = 'http://127.0.0.1:49321/';
    const LEADER_KEY = 'usagi_vk_bridge_leader';
    const LEADER_TTL_MS = 1800;
    const POLL_INTERVAL_MS = 350;
    const TAB_ID = `${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

    const win = (typeof unsafeWindow !== 'undefined' && unsafeWindow)
        || window.wrappedJSObject
        || window;

    let inFlight = false;
    let inFlightAt = 0;
    let lastHadAudio = null;
    let lastIdlePingAt = 0;

    // Keyed by trackKey -> { val: boolean, ts: number }
    const optimisticLiked = new Map();

    function safeGet(fn, fallback = null) {
        try {
            return fn();
        } catch {
            return fallback;
        }
    }

    function isElementVisible(el) {
        if (!el || typeof el.getBoundingClientRect !== 'function') return false;
        try {
            const style = window.getComputedStyle(el);
            if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        } catch {
            return false;
        }
    }

    function getButtonLabel(el) {
        if (!el) return '';
        const raw = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.dataset?.testid || ''} ${el.textContent || ''}`;
        return raw.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function getPlayerHandles() {
        const ap = safeGet(() => {
            if (typeof win.getAudioPlayer === 'function') return win.getAudioPlayer();
            return win.ap || win.audioPlayer || null;
        }, null);
        if (!ap) return { ap: null, impl: null, playlist: null, queue: null };

        const impl = safeGet(() => ap._impl || ap.impl || null, null);
        const playlist = safeGet(() => {
            if (typeof ap.getCurrentPlaylist === 'function') return ap.getCurrentPlaylist();
            if (impl && typeof impl.getCurrentPlaylist === 'function') return impl.getCurrentPlaylist();
            return ap._currentPlaylist || impl?._currentPlaylist || ap.currentPlaylist || null;
        }, null);
        const queue = safeGet(() => {
            if (typeof ap.getPlaylistQueue === 'function') return ap.getPlaylistQueue();
            if (impl && typeof impl.getPlaylistQueue === 'function') return impl.getPlaylistQueue();
            return ap._playlistQueue || impl?._playlistQueue || null;
        }, null);

        return { ap, impl, playlist, queue };
    }

    function getCurrentTrackRaw(handles) {
        const { ap, impl } = handles;
        if (!ap) return null;
        return safeGet(() => {
            if (typeof ap.getCurrentAudio === 'function') {
                const a = ap.getCurrentAudio();
                if (a) return a;
            }
            if (impl && typeof impl.getCurrentAudio === 'function') {
                const a = impl.getCurrentAudio();
                if (a) return a;
            }
            if (ap._currentAudio || impl?._currentAudio) {
                return ap._currentAudio || impl?._currentAudio;
            }
            if (typeof ap.getCurrentAudioLs === 'function') {
                const a = ap.getCurrentAudioLs();
                if (a) return a;
            }
            if (impl && typeof impl.getCurrentAudioLs === 'function') {
                const a = impl.getCurrentAudioLs();
                if (a) return a;
            }
            return null;
        }, null);
    }

    function parseTrackInfo(rawAudio) {
        if (!rawAudio) return null;

        let obj = null;
        if (Array.isArray(rawAudio)) {
            obj = safeGet(() => {
                if (win.AudioUtils && typeof win.AudioUtils.asObject === 'function') {
                    return win.AudioUtils.asObject(rawAudio);
                }
                return null;
            }, null);
        } else if (typeof rawAudio === 'object') {
            obj = rawAudio;
        }

        const id = obj?.id ?? (Array.isArray(rawAudio) ? rawAudio[0] : null);
        const ownerId = obj?.ownerId ?? obj?.owner_id ?? (Array.isArray(rawAudio) ? rawAudio[1] : null);
        const fullId = obj?.fullId
            || obj?.full_id
            || ((ownerId != null && id != null) ? `${ownerId}_${id}` : null);

        let addHash = obj?.addHash ?? obj?.add_hash ?? '';
        let deleteHash = obj?.deleteHash ?? obj?.delete_hash ?? '';
        const hashesStr = (typeof obj?.hashes === 'string' && obj.hashes)
            || (Array.isArray(rawAudio) && typeof rawAudio[13] === 'string' ? rawAudio[13] : '');

        if (hashesStr) {
            const parts = hashesStr.split('/');
            if (!addHash && parts[0]) addHash = parts[0];
            if (!deleteHash && parts[3]) deleteHash = parts[3];
        }

        const title = obj?.title ?? (Array.isArray(rawAudio) ? rawAudio[3] : '');
        const artist = obj?.performer ?? obj?.artist ?? (Array.isArray(rawAudio) ? rawAudio[4] : '');
        const key = fullId || `${artist || ''}|${title || ''}`;

        return {
            raw: rawAudio,
            obj,
            id,
            ownerId,
            fullId,
            addHash,
            deleteHash,
            key
        };
    }

    function hasPlayerAnchorControls(el) {
        if (!el) return false;
        try {
            const hasRep = !!el.querySelector('button[data-teststate], [role="button"][data-teststate], svg[class*="vkuiIcon--repeat"]');
            const hasShuf = !!el.querySelector('svg[class*="vkuiIcon--shuffle"]');
            return hasRep || hasShuf;
        } catch {
            return false;
        }
    }

    function findSpaPlayerBar() {
        const anchors = [];
        const seen = new Set();
        const pushAnchor = (el) => {
            if (el && !seen.has(el)) {
                seen.add(el);
                anchors.push(el);
            }
        };

        try {
            for (const el of document.querySelectorAll('button[data-teststate], [role="button"][data-teststate]')) {
                pushAnchor(el);
            }
            for (const svg of document.querySelectorAll('svg[class*="vkuiIcon--shuffle"], svg[class*="vkuiIcon--repeat"]')) {
                pushAnchor(svg.closest('button, [role="button"]'));
            }
        } catch {}

        if (!anchors.length) return null;

        // Prefer visible player bar controls over collapsed/offscreen ones.
        anchors.sort((a, b) => (isElementVisible(b) ? 1 : 0) - (isElementVisible(a) ? 1 : 0));

        for (const anchor of anchors) {
            const sec = anchor.closest('section');
            if (sec && hasPlayerAnchorControls(sec)) {
                return sec;
            }

            let cur = anchor.parentElement;
            let bestBoth = null;
            for (let depth = 0; depth < 8 && cur && cur !== document.body && cur !== document.documentElement; depth++) {
                const hasRep = !!cur.querySelector('button[data-teststate], [role="button"][data-teststate], svg[class*="vkuiIcon--repeat"]');
                const hasShuf = !!cur.querySelector('svg[class*="vkuiIcon--shuffle"]');
                if (hasRep && hasShuf) {
                    bestBoth = cur;
                    if (cur.querySelector('[role="group"]')) {
                        return cur;
                    }
                }
                cur = cur.parentElement;
            }
            if (bestBoth) return bestBoth;
        }

        return null;
    }

    function getPlayerContainers() {
        const found = [];
        const seen = new Set();
        const pushEl = (el) => {
            if (el && !seen.has(el)) {
                seen.add(el);
                found.push(el);
            }
        };

        pushEl(findSpaPlayerBar());

        const selectors = [
            '#top_audio_layer_place',
            '.top_audio_layer',
            '.top_audio_player',
            '.audio_page_player',
            '.audio_page_player2',
            '[role="region"][aria-label*="аудиоплеер" i]',
            '[role="region"][aria-label*="плеер" i]',
            '[role="region"][aria-label*="audio player" i]',
            '[data-testid*="audio_player" i]',
            '[data-testid*="player_controls" i]',
            '[class*="AudioPagePlayer" i]',
            '[class*="AudioPlayer" i]',
            '[class*="PlayerControls" i]'
        ];
        if (location.hostname === 'music.vk.com') {
            selectors.push('[data-testid*="player" i]', '[class*="Player" i]');
        }

        for (const sel of selectors) {
            try {
                for (const el of document.querySelectorAll(sel)) {
                    pushEl(el);
                }
            } catch {}
        }
        return found;
    }

    function findControlButton(opts) {
        const {
            selectors = [],
            svgSubstrings = [],
            labelHints = [],
            excludeLabels = [],
            excludeSvgSubstrings = [],
            preferVisible = true
        } = opts;

        const roots = getPlayerContainers();
        if (!roots.length) return null;

        const candidates = [];
        const seen = new Set();
        const addCandidate = (el) => {
            if (!el || seen.has(el)) return;
            seen.add(el);
            if (excludeLabels.length) {
                const lbl = getButtonLabel(el);
                if (lbl && excludeLabels.some((rx) => rx.test(lbl))) return;
            }
            if (excludeSvgSubstrings.length) {
                for (const sub of excludeSvgSubstrings) {
                    try {
                        if (el.querySelector(`svg[class*="${sub}"]`)) return;
                    } catch {}
                }
            }
            candidates.push(el);
        };

        for (const root of roots) {
            for (const sel of selectors) {
                try {
                    for (const el of root.querySelectorAll(sel)) {
                        addCandidate(el);
                    }
                } catch {}
            }
            for (const sub of svgSubstrings) {
                try {
                    for (const svg of root.querySelectorAll(`svg[class*="${sub}"]`)) {
                        addCandidate(svg.closest('button, [role="button"]'));
                    }
                } catch {}
            }
            if (labelHints.length) {
                try {
                    for (const el of root.querySelectorAll('button, [role="button"]')) {
                        if (seen.has(el)) continue;
                        const label = getButtonLabel(el);
                        if (!label) continue;
                        if (labelHints.some((rx) => rx.test(label))) {
                            addCandidate(el);
                        }
                    }
                } catch {}
            }
        }

        if (!candidates.length) return null;
        if (preferVisible) {
            const vis = candidates.find(isElementVisible);
            if (vis) return vis;
        }
        return candidates[0];
    }

    function isButtonActive(el) {
        if (!el) return null;
        const testActive = el.getAttribute('data-testactive');
        if (testActive === 'true' || testActive === '1') return true;
        if (testActive === 'false' || testActive === '0') return false;

        const pressed = el.getAttribute('aria-pressed');
        if (pressed === 'true') return true;
        if (pressed === 'false') return false;

        const checked = el.getAttribute('aria-checked');
        if (checked === 'true') return true;
        if (checked === 'false') return false;

        const dataActive = el.getAttribute('data-active') || el.getAttribute('data-checked');
        if (dataActive === '1' || dataActive === 'true') return true;
        if (dataActive === '0' || dataActive === 'false') return false;

        const dataState = (el.getAttribute('data-state') || '').toLowerCase();
        if (dataState === 'on' || dataState === 'active' || dataState === 'all' || dataState === 'one') return true;
        if (dataState === 'off' || dataState === 'none') return false;

        const cls = typeof el.className === 'string' ? el.className : '';
        if (/\baudio_page_player_btn_enabled\b|\baudio_page_player_btn_added\b|\baudio_page_player_btn_active\b|\bactive\b|\benabled\b|\badded\b|\bselected\b|[_-](active|enabled|added|checked)\b|(?:Active|Enabled|Added)(?:__|$|\s)/i.test(cls)) {
            return true;
        }
        return false;
    }

    function readFirstBool(targets, methodNames, propNames) {
        for (const t of targets) {
            if (!t) continue;
            for (const m of methodNames) {
                const res = safeGet(() => (typeof t[m] === 'function' ? t[m]() : undefined), undefined);
                if (typeof res === 'boolean') return res;
            }
            for (const p of propNames) {
                const val = safeGet(() => t[p], undefined);
                if (typeof val === 'boolean') return val;
            }
        }
        return null;
    }

    function isPlayingNow(handles) {
        const { ap, impl } = handles;
        const apiPlaying = readFirstBool([ap, impl], ['isPlaying'], ['_isPlaying']);
        if (apiPlaying !== null) return apiPlaying;

        const pauseBtn = findControlButton({
            selectors: [
                '.audio_page_player_play.playing',
                '.audio_page_player_btn_play.playing',
                '.top_audio_player_play.playing',
                '[data-testid*="pause" i]'
            ],
            svgSubstrings: ['vkuiIcon--pause'],
            labelHints: [/(?:^|[^\p{L}])пауза(?:$|[^\p{L}])/iu, /\bpause\b/i],
            preferVisible: false
        });
        return !!pauseBtn;
    }

    function findShuffleButton(preferVisible = true) {
        return findControlButton({
            selectors: [
                '.audio_page_player_btn_shuffle',
                '.audio_page_player_shuffle',
                '._audio_page_player_shuffle',
                '[data-testid*="shuffle" i]',
                'button[class*="shuffle" i]',
                '[role="button"][class*="shuffle" i]'
            ],
            svgSubstrings: ['vkuiIcon--shuffle'],
            labelHints: [/вперемешку|перемеш|случайном порядке|\bshuffle\b/i],
            preferVisible
        });
    }

    function findRepeatButton(preferVisible = true) {
        return findControlButton({
            selectors: [
                'button[data-teststate]',
                '[role="button"][data-teststate]',
                '.audio_page_player_btn_repeat',
                '.audio_page_player_repeat',
                '._audio_page_player_repeat',
                '[data-testid*="repeat" i]',
                'button[class*="repeat" i]',
                '[role="button"][class*="repeat" i]'
            ],
            svgSubstrings: ['vkuiIcon--repeat'],
            labelHints: [/повторять|повтор|зацикл|\brepeat\b/i],
            preferVisible
        });
    }

    function findAddButton(preferVisible = true) {
        return findControlButton({
            selectors: [
                '.audio_page_player_btn_add',
                '.audio_page_player_add',
                '._audio_page_player_add',
                '[data-testid*="add_audio" i]',
                '[data-testid*="audio_add" i]',
                '[data-testid*="library" i]'
            ],
            svgSubstrings: [
                'vkuiIcon--add_24',
                'vkuiIcon--done',
                'vkuiIcon--delete',
                'vkuiIcon--check_24',
                'vkuiIcon--check_circle'
            ],
            labelHints: [
                /мою музыку|моей музыки|мои аудиозаписи|моих аудиозаписей|удалить аудиозапись|моих трек|мои трек|медиатек|\bmy music\b|add to library|remove from library/i
            ],
            excludeLabels: [
                /не нравится|микс|плейлист|очеред|скачать|поделиться|открыть меню|слушать|пауза|следующ|предыдущ|dislike|mix|playlist|queue|download|share|more/i
            ],
            excludeSvgSubstrings: ['thumbs_down', 'music_note', 'more_'],
            preferVisible
        });
    }

    function readShuffleState(handles) {
        const { ap, impl, playlist, queue } = handles;
        const visBtn = findShuffleButton(true);
        if (visBtn && isElementVisible(visBtn)) {
            const active = isButtonActive(visBtn);
            if (active !== null) return active ? 1 : 0;
        }

        const api = readFirstBool(
            [queue, playlist, ap, impl],
            ['isShuffled', 'isShuffle', 'getShuffle', 'isShuffleActive', 'isRandom'],
            ['shuffled', '_shuffled', '_shuffle', 'shuffle', '_isShuffle', 'isRandom']
        );
        if (api !== null) return api ? 1 : 0;

        const anyBtn = findShuffleButton(false);
        if (anyBtn) {
            const active = isButtonActive(anyBtn);
            if (active !== null) return active ? 1 : 0;
        }
        return 0;
    }

    function parseRepeatButtonState(el) {
        if (!el) return null;

        const testState = (el.getAttribute('data-teststate') || '').toLowerCase();
        if (testState === 'audio' || testState === 'one' || testState === 'track' || testState === 'current' || testState === '2') return 2;
        if (testState === 'queue' || testState === 'all' || testState === 'list' || testState === 'playlist' || testState === '1') return 1;
        if (testState === 'none' || testState === 'off' || testState === '0') return 0;

        const dataMode = (el.getAttribute('data-mode') || el.getAttribute('data-state') || el.getAttribute('data-repeat') || '').toLowerCase();
        if (dataMode === 'audio' || dataMode === 'one' || dataMode === 'track' || dataMode === 'current' || dataMode === '2') return 2;
        if (dataMode === 'queue' || dataMode === 'all' || dataMode === 'list' || dataMode === 'playlist' || dataMode === '1') return 1;
        if (dataMode === 'none' || dataMode === 'off' || dataMode === '0') return 0;

        if (safeGet(() => !!el.querySelector('svg[class*="repeat_1"]'), false)) {
            const active = isButtonActive(el);
            return active === false ? 0 : 2;
        }

        const label = getButtonLabel(el);
        const cls = typeof el.className === 'string' ? el.className : '';
        if (/repeat_one|repeat1|one_track|repeatcurrent/i.test(cls) || /repeat_one|repeat1/i.test(label)) {
            const active = isButtonActive(el);
            return active === false ? 0 : 2;
        }

        const active = isButtonActive(el);
        if (!active) return 0;

        if (/одну|один трек|текущ|композиц|current|one\b|track|зациклить композицию|повтор этой|(?:^|\D)1(?:\D|$)/i.test(label)) {
            return 2;
        }
        if (/плейлист|список|очеред|все\b|playlist|queue|all\b/i.test(label)) {
            return 1;
        }
        // Classic VK desktop player's single repeat button repeats the current track.
        if (/\baudio_page_player_btn_repeat\b/.test(cls)) {
            return 2;
        }
        return 1;
    }

    function readRepeatState(handles) {
        const { ap, impl, playlist } = handles;

        const visBtn = findRepeatButton(true);
        if (visBtn && isElementVisible(visBtn)) {
            const parsed = parseRepeatButtonState(visBtn);
            if (parsed !== null) return parsed;
        }

        const repOne = readFirstBool(
            [ap, impl, playlist],
            ['isRepeatCurrentAudio', 'getRepeatCurrentAudio', 'isRepeatOne'],
            ['_repeatCurrent', '_repeatCurrentAudio', 'repeatCurrentAudio', 'repeatCurrent', '_repeatOne']
        );
        if (repOne === true) return 2;

        const repAll = readFirstBool(
            [ap, impl, playlist],
            ['isRepeatAll', 'getRepeatAll', 'isRepeat', 'getRepeat'],
            ['_repeatAll', 'repeatAll', '_repeat', 'repeat']
        );
        if (repAll === true) return 1;

        for (const t of [ap, impl, playlist]) {
            if (!t) continue;
            const mode = safeGet(() => (typeof t.getRepeatMode === 'function' ? t.getRepeatMode() : t.repeatMode), undefined);
            if (typeof mode === 'number' && mode >= 0 && mode <= 2) return mode;
            if (typeof mode === 'string') {
                const m = mode.toLowerCase();
                if (m === 'audio' || m === 'one' || m === 'track' || m === 'current' || m === '2') return 2;
                if (m === 'queue' || m === 'all' || m === 'list' || m === 'playlist' || m === '1') return 1;
                if (m === 'none' || m === 'off' || m === '0') return 0;
            }
        }

        const anyBtn = findRepeatButton(false);
        if (anyBtn) {
            const parsed = parseRepeatButtonState(anyBtn);
            if (parsed !== null) return parsed;
        }

        return 0;
    }

    function parseAddedButtonState(el) {
        if (!el) return null;
        const testActive = el.getAttribute('data-testactive');
        if (testActive === 'true' || testActive === '1') return true;

        const cls = typeof el.className === 'string' ? el.className : '';
        if (/\baudio_page_player_btn_added\b|\baudio_page_player_btn_enabled\b|\badded\b|[_-]added\b/i.test(cls)) {
            return true;
        }

        if (safeGet(() => !!el.querySelector('svg[class*="vkuiIcon--done"], svg[class*="vkuiIcon--check"], svg[class*="vkuiIcon--delete"]'), false)) {
            return true;
        }

        const label = getButtonLabel(el);
        if (/удалить из|удалить аудиозапись|убрать из|добавлено|в моих|в моей музыке|в медиатеке|delete from|remove from|added to/i.test(label)) {
            return true;
        }
        if (/добавить в|сохранить в|add to/i.test(label)) {
            return false;
        }

        if (testActive === 'false' || testActive === '0') return false;

        if (safeGet(() => !!el.querySelector('svg[class*="vkuiIcon--add_"]'), false)) {
            return false;
        }

        const active = isButtonActive(el);
        if (active !== null) return active;
        return null;
    }

    function readLikedState(handles, track) {
        const { ap, impl } = handles;

        const visBtn = findAddButton(true);
        if (visBtn && isElementVisible(visBtn)) {
            const st = parseAddedButtonState(visBtn);
            if (st !== null) {
                if (track?.key) optimisticLiked.set(track.key, { val: st, ts: Date.now() });
                return st ? 1 : 0;
            }
        }

        const apiAdded = readFirstBool(
            [ap, impl],
            ['isCurrentAudioAdded', 'isAddedCurrentAudio', 'isCurrentAdded'],
            ['_currentAudioAdded']
        );
        if (apiAdded !== null) return apiAdded ? 1 : 0;

        if (track?.obj) {
            const flag = track.obj.isAdded ?? track.obj.is_added ?? track.obj.added ?? track.obj.inLibrary ?? track.obj.liked;
            if (typeof flag === 'boolean') return flag ? 1 : 0;
        }

        if (track?.key && optimisticLiked.has(track.key)) {
            const cached = optimisticLiked.get(track.key);
            if ((Date.now() - cached.ts) < 60000) {
                return cached.val ? 1 : 0;
            }
        }

        const anyBtn = findAddButton(false);
        if (anyBtn) {
            const st = parseAddedButtonState(anyBtn);
            if (st !== null) return st ? 1 : 0;
        }

        if (track) {
            if (track.deleteHash && !track.addHash) return 1;
            if (track.addHash && !track.deleteHash) return 0;
        }
        return 0;
    }

    function invokeFirstMethod(targets, names, args = []) {
        for (const t of targets) {
            if (!t) continue;
            for (const n of names) {
                try {
                    const fn = t[n];
                    if (typeof fn === 'function') {
                        fn.apply(t, args);
                        return n;
                    }
                } catch {}
            }
        }
        return null;
    }

    function executeShuffle(handles) {
        const { ap, impl, playlist } = handles;
        const visBtn = findShuffleButton(true);
        if (visBtn && isElementVisible(visBtn)) {
            visBtn.click();
            return 'dom-visible';
        }
        if (invokeFirstMethod([ap, impl, playlist], ['toggleShuffle', 'shuffle'])) {
            return 'api-toggle';
        }
        const anyBtn = findShuffleButton(false);
        if (anyBtn) {
            anyBtn.click();
            return 'dom-any';
        }
        return 'none';
    }

    function stepRepeatOnce(handles) {
        const { ap, impl, playlist } = handles;
        const visBtn = findRepeatButton(true);
        if (visBtn && isElementVisible(visBtn)) {
            visBtn.click();
            return 'dom-visible';
        }
        const cur = readRepeatState(handles);
        const nextMode = cur === 0 ? 'queue' : (cur === 1 ? 'audio' : 'none');
        if (invokeFirstMethod([ap, impl], ['setRepeatState'], [nextMode])) {
            return `api-state:${nextMode}`;
        }
        if (invokeFirstMethod([ap, impl, playlist], ['toggleRepeat', 'toggleRepeatCurrentAudio', 'toggleRepeatAll'])) {
            return 'api-toggle';
        }
        const anyBtn = findRepeatButton(false);
        if (anyBtn) {
            anyBtn.click();
            return 'dom-any';
        }
        return 'none';
    }

    function executeRepeat(cmd, handles) {
        const { ap, impl } = handles;
        if (cmd === 'repeat') {
            return stepRepeatOnce(handles);
        }

        const target = parseInt(cmd.split(':')[1], 10);
        if (Number.isNaN(target) || target < 0 || target > 2) return 'invalid';

        const cur = readRepeatState(handles);
        if (cur === target) return 'already';

        const visBtn = findRepeatButton(true);
        if (visBtn && isElementVisible(visBtn)) {
            visBtn.click();
            // Step once more if a 3-state VK cycle (none -> queue -> audio -> none) needs 2 clicks.
            setTimeout(() => {
                const h2 = getPlayerHandles();
                const after = readRepeatState(h2);
                if (after !== target && after !== cur && !(cur === 0 && after === 2 && target === 1)) {
                    const btn2 = findRepeatButton(true);
                    if (btn2 && isElementVisible(btn2)) btn2.click();
                }
            }, 70);
            return 'dom-step-cycle';
        }

        const vkStateStr = target === 2 ? 'audio' : (target === 1 ? 'queue' : 'none');
        if (invokeFirstMethod([ap, impl], ['setRepeatState'], [vkStateStr])) {
            return `api-set-state:${vkStateStr}`;
        }

        if (typeof ap?.setRepeatMode === 'function' || typeof impl?.setRepeatMode === 'function') {
            const strMode = target === 2 ? 'one' : (target === 1 ? 'all' : 'none');
            if (invokeFirstMethod([ap, impl], ['setRepeatMode'], [strMode])) {
                if (readRepeatState(handles) === target) return 'api-mode-str';
            }
            if (invokeFirstMethod([ap, impl], ['setRepeatMode'], [target])) {
                if (readRepeatState(handles) === target) return 'api-mode-num';
            }
        }

        if (target === 0 &&
            (typeof ap?.setRepeatCurrentAudio === 'function' || typeof impl?.setRepeatCurrentAudio === 'function')) {
            if (invokeFirstMethod([ap, impl], ['setRepeatCurrentAudio'], [false])) {
                return 'api-set-current-off';
            }
        }
        if (target === 1 &&
            (typeof ap?.setRepeatAll === 'function' || typeof impl?.setRepeatAll === 'function')) {
            if (invokeFirstMethod([ap, impl], ['setRepeatAll'], [true])) {
                return 'api-set-all';
            }
        }
        if (target === 2 &&
            (typeof ap?.setRepeatCurrentAudio === 'function' || typeof impl?.setRepeatCurrentAudio === 'function')) {
            if (invokeFirstMethod([ap, impl], ['setRepeatCurrentAudio'], [true])) {
                return 'api-set-current-on';
            }
        }

        stepRepeatOnce(handles);
        return 'fallback-step';
    }

    async function fetchLibraryToggle(track, currentlyAdded) {
        if (!track || !track.id || track.ownerId == null) return false;
        const hash = currentlyAdded ? track.deleteHash : track.addHash;
        if (!hash) return false;

        const body = new URLSearchParams();
        if (currentlyAdded) {
            body.set('act', 'delete_audio');
            body.set('al', '1');
            body.set('aid', String(track.id));
            body.set('oid', String(track.ownerId));
            body.set('hash', String(hash));
            body.set('restore', '1');
        } else {
            body.set('act', 'add');
            body.set('al', '1');
            body.set('audio_id', String(track.id));
            body.set('audio_owner_id', String(track.ownerId));
            body.set('hash', String(hash));
            body.set('from', 'user_list');
        }

        try {
            const resp = await fetch(`${location.origin}/al_audio.php`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: body.toString()
            });
            if (resp.ok) {
                const txt = await resp.text();
                if (!/"error"\s*:/.test(txt)) {
                    optimisticLiked.set(track.key, { val: !currentlyAdded, ts: Date.now() });
                    return true;
                }
            }
        } catch {}
        return false;
    }

    function executeAdd(handles, track) {
        const { ap, impl } = handles;
        const wasAdded = readLikedState(handles, track) === 1;

        const visBtn = findAddButton(true);
        if (visBtn && isElementVisible(visBtn)) {
            visBtn.click();
            if (track?.key) optimisticLiked.set(track.key, { val: !wasAdded, ts: Date.now() });
            return 'dom-visible';
        }

        if (invokeFirstMethod([ap, impl], ['toggleCurrentAudioAdd', 'toggleAddCurrentAudio'])) {
            if (track?.key) optimisticLiked.set(track.key, { val: !wasAdded, ts: Date.now() });
            return 'api-toggle';
        }

        const dirNames = wasAdded
            ? ['deleteCurrentAudio', 'removeCurrentAudio']
            : ['addCurrentAudio', 'saveCurrentAudio'];
        if (invokeFirstMethod([ap, impl], dirNames)) {
            if (track?.key) optimisticLiked.set(track.key, { val: !wasAdded, ts: Date.now() });
            return 'api-direct';
        }

        const requiredHash = wasAdded ? track?.deleteHash : track?.addHash;
        if (track?.id && track?.ownerId != null && requiredHash) {
            fetchLibraryToggle(track, wasAdded);
            return 'fetch-fallback';
        }

        const anyBtn = findAddButton(false);
        if (anyBtn) {
            anyBtn.click();
            if (track?.key) optimisticLiked.set(track.key, { val: !wasAdded, ts: Date.now() });
            return 'dom-any';
        }

        return 'none';
    }

    function handleCommand(cmd, handles, track) {
        if (!cmd || cmd === 'none') return;
        let res = 'unknown';
        if (cmd === 'shuffle') {
            res = executeShuffle(handles);
        } else if (cmd === 'repeat' || cmd.startsWith('repeat:')) {
            res = executeRepeat(cmd, handles);
        } else if (cmd === 'add') {
            res = executeAdd(handles, track);
        }

        try {
            win.__usagiLastCmdResult = `${cmd}:${res}@${Date.now()}`;
        } catch {}

        // Quick resync + post-settle authoritative resync after C++ 550ms settleWindow
        setTimeout(() => pollBridge(true), 220);
        setTimeout(() => pollBridge(true), 620);
    }

    function tryClaimLeadership(prio) {
        const now = Date.now();
        try {
            const raw = localStorage.getItem(LEADER_KEY);
            let cur = null;
            if (raw) {
                try { cur = JSON.parse(raw); } catch { cur = null; }
            }
            const expired = !cur || typeof cur.ts !== 'number' || (now - cur.ts) > LEADER_TTL_MS;
            if (expired || cur.id === TAB_ID || prio > (cur.prio ?? -1)) {
                localStorage.setItem(LEADER_KEY, JSON.stringify({ id: TAB_ID, prio, ts: now }));
                return true;
            }
            return false;
        } catch {
            // If localStorage is restricted, fall back to polling directly.
            return true;
        }
    }

    function releaseLeadership() {
        try {
            const raw = localStorage.getItem(LEADER_KEY);
            if (!raw) return;
            const cur = JSON.parse(raw);
            if (cur && cur.id === TAB_ID) {
                localStorage.removeItem(LEADER_KEY);
            }
        } catch {}
    }

    function pollBridge(forceSync = false) {
        const now = Date.now();
        if (inFlight && (now - inFlightAt) < 1200) {
            return;
        }

        const handles = getPlayerHandles();
        const rawAudio = getCurrentTrackRaw(handles);
        const track = parseTrackInfo(rawAudio);
        const playing = rawAudio ? isPlayingNow(handles) : false;

        let prio = 0;
        if (rawAudio && playing) {
            prio = 3;
        } else if (rawAudio && document.visibilityState === 'visible') {
            prio = 2;
        } else if (rawAudio) {
            prio = 1;
        }

        const isLeader = tryClaimLeadership(prio);
        if (!isLeader && !forceSync) {
            return;
        }

        const hasAudio = rawAudio ? 1 : 0;
        if (!hasAudio && !forceSync) {
            // Avoid spamming idle requests when no VK audio track is loaded anywhere.
            if (lastHadAudio === false && (now - lastIdlePingAt) < 1500) {
                return;
            }
            lastIdlePingAt = now;
        }
        lastHadAudio = !!hasAudio;

        const shuf = hasAudio ? readShuffleState(handles) : 0;
        const rep = hasAudio ? readRepeatState(handles) : 0;
        const liked = hasAudio ? readLikedState(handles, track) : 0;

        try {
            const spaBar = findSpaPlayerBar();
            const shBtn = findShuffleButton(true);
            const repBtn = findRepeatButton(true);
            const addBtn = findAddButton(true);
            win.__usagiVkBridgeState = JSON.stringify({
                v: 2,
                scriptVer: '1.3.0',
                tabId: TAB_ID,
                isLeader,
                prio,
                hasAudio,
                playing,
                s: shuf,
                r: rep,
                l: liked,
                trackKey: track?.key || '',
                hasSpaBar: !!spaBar,
                hasShuffleBtn: !!(shBtn && isElementVisible(shBtn)),
                hasRepeatBtn: !!(repBtn && isElementVisible(repBtn)),
                hasAddBtn: !!(addBtn && isElementVisible(addBtn)),
                queueShuffled: safeGet(() => handles.queue?.shuffled, null),
                apRepeatOne: safeGet(() => handles.ap?.isRepeatCurrentAudio?.(), null),
                apRepeatAll: safeGet(() => handles.ap?.isRepeatAll?.(), null),
                repeatBtnState: repBtn ? repBtn.getAttribute('data-teststate') : null
            });
        } catch {}

        const url = hasAudio
            ? `${BRIDGE_URL}?has=1&v=2&s=${shuf}&r=${rep}&l=${liked}&t=${now}`
            : `${BRIDGE_URL}?has=0&v=2&t=${now}`;

        inFlight = true;
        inFlightAt = now;

        GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 800,
            onload: (resp) => {
                inFlight = false;
                const cmd = (resp?.responseText || '').trim();
                if (cmd && cmd !== 'none') {
                    handleCommand(cmd, getPlayerHandles(), parseTrackInfo(getCurrentTrackRaw(getPlayerHandles())));
                }
            },
            onerror: () => { inFlight = false; },
            ontimeout: () => { inFlight = false; },
            onabort: () => { inFlight = false; }
        });
    }

    window.addEventListener('pagehide', releaseLeadership);
    window.addEventListener('beforeunload', releaseLeadership);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            pollBridge(false);
        }
    });

    setInterval(() => pollBridge(false), POLL_INTERVAL_MS);
    setTimeout(() => pollBridge(false), 300);
})();
