// ============================================
// 1. DATA / API LAYER (Fetching & Formatting)
// ============================================

async function fetchRepo() {
    const siteUrl = window.location.href;
    if (siteUrl.includes('127.0.0.1')) return { owner: 'AzimsTech', repo: 'OpenWrt-Builder' };

    const urlParts = siteUrl.split('/');
    const owner = urlParts[2].split('.')[0];
    const repo = urlParts[3] || '';
    return { owner, repo };
}

async function fetchOpenWrtVersions() {
    const response = await fetch('https://downloads.openwrt.org/.versions.json');
    const data = await response.json();

    const filteredVersions = data.versions_list.filter(version => {
        const match = version.match(/^(\d+)\.(\d+)/);
        if (!match) return false;
        return parseInt(match[1], 10) > 23 || (parseInt(match[1], 10) === 23 && parseInt(match[2], 10) >= 5);
    });

    const groups = {};
    filteredVersions.forEach(version => {
        const m = version.match(/^(\d+)\.(\d+)/);
        const groupKey = `${m[1]}.${m[2]}`;
        if (!groups[groupKey]) groups[groupKey] = { finals: [], rcs: [] };
        version.includes('rc') ? groups[groupKey].rcs.push(version) : groups[groupKey].finals.push(version);
    });

    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
        const [aMaj, aMin] = a.split('.').map(Number);
        const [bMaj, bMin] = b.split('.').map(Number);
        return aMaj !== bMaj ? bMaj - aMaj : bMin - aMin;
    });

    let finalList = ["SNAPSHOT"];
    sortedGroupKeys.forEach(groupKey => {
        const group = groups[groupKey];
        group.finals.sort((a, b) => parseInt((b.match(/\.(\d+)$/) || [0,0])[1]) - parseInt((a.match(/\.(\d+)$/) || [0,0])[1]));
        group.rcs.sort((a, b) => parseInt((b.match(/rc(\d+)/) || [0,0])[1]) - parseInt((a.match(/rc(\d+)/) || [0,0])[1]));

        const primary = group.finals[0] || group.rcs[0];
        finalList.push(primary, `${groupKey}-SNAPSHOT`, ...group.finals.slice(1));
        finalList.push(...(group.finals[0] === primary ? group.rcs : group.rcs.slice(1)));
    });

    return finalList;
}

async function fetchModelsForVersion(version) {
    const url = version === "SNAPSHOT" 
        ? "https://downloads.openwrt.org/snapshots/.overview.json" 
        : `https://downloads.openwrt.org/releases/${version}/.overview.json`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.profiles.map(profile => ({
        id: profile.id,
        target: profile.target,
        title: `${profile.titles[0].vendor} ${profile.titles[0].model}${profile.titles[0].variant ? ' ' + profile.titles[0].variant : ''}`
    }));
}

async function fetchAvailableScripts(owner, repo) {
    const token = localStorage.getItem("github_token");
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/files/etc/uci-defaults?ref=main`;
    const response = await fetch(apiUrl, { headers });
    if (!response.ok) return [];
    const data = await response.json();
    return data.filter(item => item.type === 'file').map(item => item.name);
}

async function fetchBuildInfo(target, version, profileId) {
    const baseUrl = version === "SNAPSHOT" 
        ? `https://downloads.openwrt.org/snapshots/targets/${target}/`
        : `https://downloads.openwrt.org/releases/${version}/targets/${target}/`;

    try {
        const buildInfoRes = await fetch(baseUrl + "version.buildinfo?cacheBust=" + Date.now(), { cache: 'no-store' });
        if (!buildInfoRes.ok) throw new Error("Build info not found");
        
        const buildinfo = await buildInfoRes.text();
        
        // Format Date and Time
        const dateObj = new Date(buildInfoRes.headers.get('Last-Modified'));
        const lastModified = dateObj.toLocaleString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric', 
            hour: 'numeric', minute: '2-digit', hour12: true 
        });
        
        const profilesRes = await fetch(baseUrl + "profiles.json");
        const profilesData = await profilesRes.json();
        
        const rawPkgs = profilesData.profiles[profileId]?.device_packages || [];
        const removals = new Set(rawPkgs.filter(p => p.startsWith('-')).map(p => p.slice(1)));
        const devicePkgs = rawPkgs.filter(p => !p.startsWith('-') ? !removals.has(p) : true).join(" ");
        
        window.devicePkgs = devicePkgs; 
        
        // Package styling with uniform vertical padding to center text
        const packagesHtml = devicePkgs 
            ? devicePkgs.split(' ').map(p => `<span class="text-[11px] text-on-surface-variant py-[2px] px-1.5 rounded-sm border border-outline-variant/10 whitespace-nowrap bg-surface-container-highest/20">${p}</span>`).join('') 
            : `<span class="text-[11px] text-on-surface-variant">none</span>`;

        return `
            <div class="flex flex-col gap-3 w-full mt-1">
                <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-on-surface-variant text-[16px]">fingerprint</span>
                        <span class="text-on-surface-variant font-label uppercase text-[10px] font-bold tracking-wider">Ver:</span>
                        <a href="https://git.openwrt.org/openwrt/openwrt/log/?id=${buildinfo.trim().match(/-(.+)/)[1]}" target="_blank" class="text-primary font-mono text-[11px] hover:underline transition-colors">${buildinfo.trim()}</a>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-on-surface-variant text-[16px]">target</span>
                        <span class="text-on-surface-variant font-label uppercase text-[10px] font-bold tracking-wider">Target:</span>
                        <span class="text-on-surface font-mono text-[11px]">${target}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-on-surface-variant text-[16px]">calendar_today</span>
                        <span class="text-on-surface-variant font-label uppercase text-[10px] font-bold tracking-wider">Date:</span>
                        <span class="text-on-surface font-mono text-[11px]">${lastModified}</span>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-outline-variant/10">
                    <div class="flex items-center gap-1 min-w-max">
                        <span class="material-symbols-outlined text-on-surface-variant text-[16px]">package</span>
                        <span class="text-on-surface-variant font-label uppercase text-[10px] font-bold tracking-wider">Pkgs:</span>
                    </div>
                    ${packagesHtml}
                </div>
            </div>
        `;
    } catch (e) {
        window.devicePkgs = "";
        return "<p class='text-sm text-error'>Build info not found!</p>";
    }
}

// ============================================
// 2. VIEW / UI LAYER (DOM Manipulation)
// ============================================

function renderDropdown(elementId, items, selectedValue = null) {
    const select = document.getElementById(elementId);
    select.innerHTML = elementId === "scriptsInput"
        ? '<option value=""></option><option value="99-custom">custom</option>'
        : "";

    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.text = item;
        select.appendChild(option);
    });
    if (selectedValue !== null) select.value = selectedValue;
    if (customSelects[elementId]) rebuildCustomSelect(elementId);
}

function renderModelDatalist(models) {
    const datalist = document.getElementById("modelOptions");
    datalist.innerHTML = "";
    models.forEach(model => {
        const option = document.createElement("option");
        option.value = model.title;
        option.dataset.profile = model.id;
        option.dataset.target = model.target;
        datalist.appendChild(option);
    });
}

// ============================================
// CUSTOM DROPDOWN / COMBOBOX
// ============================================

const customSelects = {};

function initCustomSelect(id) {
    if (customSelects[id]) return;
    const select = document.getElementById(id);
    if (!select) return;

    const wrapper = select.parentElement;
    wrapper.classList.add('relative');
    const existingIcon = wrapper.querySelector(':scope > .material-symbols-outlined');
    if (existingIcon) existingIcon.remove();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'w-full bg-surface-container-highest border border-outline-variant/10 rounded-lg h-11 px-4 text-sm text-on-surface text-left flex items-center justify-between gap-2 cursor-pointer focus-ring transition-shadow';
    trigger.innerHTML = '<span class="truncate flex-1"></span><span class="material-symbols-outlined text-on-surface-variant text-xl pointer-events-none">expand_more</span>';

    const menu = document.createElement('ul');
    menu.className = 'custom-dropdown-menu';
    menu.setAttribute('role', 'listbox');

    customSelects[id] = { select, wrapper, trigger, menu };

    menu.addEventListener('mouseover', e => {
        const li = e.target.closest('li');
        if (!li) return;
        menu.querySelectorAll('.highlighted').forEach(h => h.classList.remove('highlighted'));
        li.classList.add('highlighted');
    });

    menu.addEventListener('mousedown', e => {
        const li = e.target.closest('li');
        if (!li) return;
        e.preventDefault();
        select.selectedIndex = parseInt(li.dataset.index);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeCustomSelect(id);
    });

    trigger.addEventListener('click', () => {
        menu.classList.contains('open') ? closeCustomSelect(id) : openCustomSelect(id);
    });

    trigger.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            menu.classList.contains('open') ? closeCustomSelect(id) : openCustomSelect(id);
        } else if (e.key === 'Escape') {
            closeCustomSelect(id);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            menu.classList.contains('open') ? highlightNext(id, 1) : openCustomSelect(id);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (menu.classList.contains('open')) highlightNext(id, -1);
        }
    });

    select.addEventListener('change', () => {
        const text = trigger.querySelector('span:first-child');
        const opt = select.options[select.selectedIndex];
        if (text && opt) text.textContent = opt.text;
    });

    document.addEventListener('click', e => {
        if (!wrapper.contains(e.target)) closeCustomSelect(id);
    });

    wrapper.appendChild(menu);
    wrapper.insertBefore(trigger, select);
    select.style.display = 'none';

    rebuildCustomSelect(id);
}

function rebuildCustomSelect(id) {
    const s = customSelects[id];
    if (!s) return;
    const { select, menu, trigger } = s;
    const triggerText = trigger.querySelector('span:first-child');
    menu.innerHTML = '';

    Array.from(select.options).forEach((opt, i) => {
        const li = document.createElement('li');
        li.className = 'custom-dropdown-option';
        li.setAttribute('role', 'option');
        li.dataset.index = i;
        li.textContent = opt.text;
        if (opt.selected) li.classList.add('selected');
        menu.appendChild(li);
    });

    const selected = select.options[select.selectedIndex];
    if (triggerText) triggerText.textContent = selected ? selected.text : '';
}

function openCustomSelect(id) {
    const s = customSelects[id];
    if (!s) return;
    rebuildCustomSelect(id);
    s.menu.classList.add('open');
    const first = s.menu.querySelector('.selected') || s.menu.querySelector('li');
    if (first) first.classList.add('highlighted');
}

function closeCustomSelect(id) {
    const s = customSelects[id];
    if (!s) return;
    s.menu.classList.remove('open');
}

function highlightNext(id, dir) {
    const s = customSelects[id];
    if (!s) return;
    const items = s.menu.querySelectorAll('li');
    if (!items.length) return;
    const cur = s.menu.querySelector('.highlighted');
    const idx = cur ? Array.from(items).indexOf(cur) + dir : (dir > 0 ? 0 : items.length - 1);
    if (idx >= 0 && idx < items.length) {
        items.forEach(l => l.classList.remove('highlighted'));
        items[idx].classList.add('highlighted');
        items[idx].scrollIntoView({ block: 'nearest' });
    }
}

const customComboboxes = {};

function initCustomCombobox(inputId) {
    if (customComboboxes[inputId]) return;
    const input = document.getElementById(inputId);
    if (!input) return;

    const listId = input.getAttribute('list');
    input.removeAttribute('list');

    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const menu = document.createElement('ul');
    menu.className = 'custom-dropdown-menu';
    menu.setAttribute('role', 'listbox');
    wrapper.appendChild(menu);

    const datalistEl = listId ? document.getElementById(listId) : null;
    const state = { input, wrapper, menu, datalistEl };
    customComboboxes[inputId] = state;

    function filtered() {
        if (!state.datalistEl) return [];
        const val = input.value.toLowerCase().trim();
        if (!val) return [];
        return Array.from(state.datalistEl.options)
            .filter(o => o.value.toLowerCase().includes(val))
            .slice(0, 30);
    }

    function build() {
        menu.innerHTML = '';
        const items = filtered();
        if (!items.length) { menu.classList.remove('open'); return; }

        items.forEach((opt, i) => {
            const li = document.createElement('li');
            li.className = 'custom-dropdown-option';
            li.setAttribute('role', 'option');
            li.dataset.target = opt.dataset.target || '';
            li.dataset.profile = opt.dataset.profile || '';

            const text = document.createElement('span');
            const val = input.value.toLowerCase();
            const idx = opt.value.toLowerCase().indexOf(val);
            if (idx !== -1) {
                text.innerHTML = opt.value.slice(0, idx)
                    + '<strong class="match">' + opt.value.slice(idx, idx + val.length) + '</strong>'
                    + opt.value.slice(idx + val.length);
            } else {
                text.textContent = opt.value;
            }
            li.appendChild(text);

            li.addEventListener('mousedown', e => {
                e.preventDefault();
                input.value = opt.value;
                setModelHiddenFields(opt.dataset.target || '', opt.dataset.profile || '');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                menu.classList.remove('open');
            });

            menu.appendChild(li);
        });
        menu.classList.add('open');
    }

    function setModelHiddenFields(target, profile) {
        document.getElementById('targetInput').value = target;
        document.getElementById('profileInput').value = profile;
        if (target && profile) {
            updateBuildInfoDisplay();
        } else {
            document.getElementById('buildInfoContainer').style.display = 'none';
        }
    }

    input.addEventListener('input', () => {
        build();
        const exact = state.datalistEl
            ? Array.from(state.datalistEl.options).find(o => o.value === input.value)
            : null;
        if (!exact) {
            document.getElementById('targetInput').value = '';
            document.getElementById('profileInput').value = '';
            document.getElementById('buildInfoContainer').style.display = 'none';
        }
    });

    input.addEventListener('focus', () => { if (input.value.trim()) build(); });
    input.addEventListener('blur', () => setTimeout(() => menu.classList.remove('open'), 200));

    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); build(); const f = menu.querySelector('li'); if (f) f.classList.add('highlighted'); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); const h = menu.querySelector('.highlighted'); if (h) { const p = h.previousElementSibling; h.classList.remove('highlighted'); if (p) p.classList.add('highlighted'); } }
        else if (e.key === 'Enter') { e.preventDefault(); const h = menu.querySelector('.highlighted'); if (h) h.click(); }
        else if (e.key === 'Escape') menu.classList.remove('open');
    });

    menu.addEventListener('mouseover', e => {
        const li = e.target.closest('li');
        if (!li) return;
        menu.querySelectorAll('.highlighted').forEach(h => h.classList.remove('highlighted'));
        li.classList.add('highlighted');
    });

    document.addEventListener('click', e => {
        if (!wrapper.contains(e.target)) menu.classList.remove('open');
    });
}

function updateCustomCombobox(inputId) {
    const state = customComboboxes[inputId];
    if (!state) return;
    state.datalistEl = document.getElementById(state.input.getAttribute('list') || 'modelOptions');
}

async function updateBuildInfoDisplay() {
    const modelInput = document.getElementById("modelInput").value;
    const version = document.getElementById("versionInput").value;
    const target = document.getElementById("targetInput").value;
    const profileId = document.getElementById("profileInput").value;
    const buildInfoContainer = document.getElementById("buildInfoContainer");
    const buildInfoEl = document.getElementById("buildInfo");

    if (modelInput && target && profileId) {
        buildInfoContainer.style.display = "flex";
        buildInfoEl.innerHTML = "<p class='text-[11px] text-on-surface-variant italic'>Fetching build info...</p>";
        buildInfoEl.innerHTML = await fetchBuildInfo(target, version, profileId);
    } else {
        buildInfoContainer.style.display = "none";
        buildInfoEl.innerHTML = "";
    }
}

// ============================================
// 3. STATE / URL SHARING
// ============================================

const formFields = ['modelInput', 'versionInput', 'profileInput', 'targetInput', 'packagesInput', 'disabled_servicesInput', 'scriptsInput', 'customScriptInput'];

async function hashString(str) {
    const data = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function encodeFormState() {
    const token = localStorage.getItem("github_token");
    const state = {};
    for (const field of formFields) {
        const el = document.getElementById(field);
        if (el && el.value) {
            if (field === 'customScriptInput' && token) {
                const key = await hashString(token);
                const data = btoa(unescape(encodeURIComponent(el.value)));
                state[field] = JSON.stringify({ data, signature: await hashString(key + data) });
            } else if (field !== 'customScriptInput') {
                state[field] = el.value;
            }
        }
    }
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

async function loadFromURL() {
    const config = new URLSearchParams(window.location.search).get('config');
    const token = localStorage.getItem("github_token");
    if (!config) return;

    try {
        const state = JSON.parse(decodeURIComponent(escape(atob(config))));
        for (const field of formFields) {
            const el = document.getElementById(field);
            if (el && state[field]) {
                if (field === 'customScriptInput' && token) {
                    const { data, signature } = JSON.parse(state[field]);
                    const expectedSig = await hashString(await hashString(token) + data);
                    if (signature === expectedSig) el.value = decodeURIComponent(escape(atob(data)));
                } else if (field !== 'customScriptInput') {
                    el.value = state[field];
                }
            }
        }
        if (state.scriptsInput === '99-custom') document.getElementById('customScriptInput').style.display = 'block';
    } catch (e) { console.error("Failed to load state", e); }
}

async function generateShareURL() {
    const base64 = await encodeFormState();
    const shareURL = `${window.location.origin}${window.location.pathname}?config=${base64}`;
    const urlContainer = document.getElementById('shareURL');
    urlContainer.textContent = shareURL;
    urlContainer.style.display = 'block';
    document.getElementById('copyBtn').style.display = 'flex';
    window.currentShareURL = shareURL;
}

function copyShareURL() {
    navigator.clipboard.writeText(window.currentShareURL);
    const btn = document.getElementById('copyBtn');
    
    // 1. Show Copied State
    // We intentionally wrap 'Copied!' in a standard span so it stays visible on mobile, 
    // causing the circle to temporarily expand into a pill shape to show success.
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">check</span> <span>Copied!</span>`;
    
    setTimeout(() => {
        // 2. Revert to Default State
        // We put the "hidden sm:inline" classes back on the text! 
        // This makes the text instantly disappear on mobile, allowing the button 
        // to naturally shrink back down into a perfect 48x48 circle.
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">content_copy</span> <span class="hidden sm:inline">Copy URL</span>`;
    }, 2000);
}

function saveToLocalStorage() {
    const state = {};
    for (const field of formFields) {
        const el = document.getElementById(field);
        if (el) state[field] = el.value;
    }
    localStorage.setItem('openwrt_builder_state', JSON.stringify(state));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('openwrt_builder_state');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            for (const field of formFields) {
                const el = document.getElementById(field);
                if (el && state[field]) el.value = state[field];
            }
            if (state.scriptsInput === '99-custom') {
                document.getElementById('customScriptInput').style.display = 'block';
            }
        } catch (e) { console.error("Failed to load local state", e); }
    }
}

// ============================================
// 4. CONTROLLER (Init & Events)
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Setup UI and Github Link
    if (!localStorage.getItem("github_token")) {
        document.getElementById("setupTokenButton").style.display = "flex";
    } else {
        document.getElementById("clearTokenButton").style.display = "flex";
    }

    // Init custom dropdowns and combobox
    initCustomSelect("versionInput");
    initCustomSelect("scriptsInput");
    initCustomCombobox("modelInput");

    const { owner, repo } = await fetchRepo();
    document.getElementById("repoUrl").href = `https://github.com/${owner}/${repo}/tree/main/files/etc/uci-defaults`;

    // 2. Fetch independent dropdown data first (Versions and Scripts)
    const versionsPromise = fetchOpenWrtVersions();
    const scriptsPromise = fetchAvailableScripts(owner, repo);

    const [versions, scripts] = await Promise.all([versionsPromise, scriptsPromise]);

    renderDropdown("versionInput", versions);
    renderDropdown("scriptsInput", scripts); // Render scripts BEFORE restoring state
    
    // 3. CRITICAL FIX: Restore state now that ALL options actually exist in the DOM
    loadFromLocalStorage();
    await loadFromURL();
    rebuildCustomSelect("versionInput");
    rebuildCustomSelect("scriptsInput");

    // 4. Fetch the model list for whichever version is currently selected (restored or default)
    const currentVersion = document.getElementById("versionInput").value || versions[0];
    const models = await fetchModelsForVersion(currentVersion);
    renderModelDatalist(models);

    // 5. If we loaded a model from memory, try mapping its hidden variables and display it
    if (document.getElementById("modelInput").value) {
        const option = Array.from(document.getElementById("modelOptions").options).find(o => o.value === document.getElementById("modelInput").value);
        if (option) {
            document.getElementById("targetInput").value = option.dataset.target;
            document.getElementById("profileInput").value = option.dataset.profile;
        }
        updateBuildInfoDisplay();
    }

    // 6. General Auto-save bindings
    formFields.forEach(field => {
        const el = document.getElementById(field);
        if (el) {
            el.addEventListener('input', saveToLocalStorage);
            el.addEventListener('change', saveToLocalStorage);
        }
    });

    // 7. Specific Input Events
    document.getElementById("versionInput").addEventListener("change", async function() {
        renderModelDatalist(await fetchModelsForVersion(this.value));
        
        // Refresh model data for the new version
        const currentModel = document.getElementById("modelInput").value;
        const option = Array.from(document.getElementById("modelOptions").options).find(o => o.value === currentModel);
        if (option) {
            document.getElementById("targetInput").value = option.dataset.target;
            document.getElementById("profileInput").value = option.dataset.profile;
        } else {
            document.getElementById("modelInput").value = '';
            document.getElementById("targetInput").value = '';
            document.getElementById("profileInput").value = '';
            document.getElementById("buildInfoContainer").style.display = "none";
        }
        
        saveToLocalStorage();
        updateBuildInfoDisplay();
    });

    document.getElementById("modelInput").addEventListener("input", function() {
        const option = Array.from(document.getElementById("modelOptions").options).find(o => o.value === this.value);
        
        if (option) {
            document.getElementById("targetInput").value = option.dataset.target;
            document.getElementById("profileInput").value = option.dataset.profile;
            updateBuildInfoDisplay();
            saveToLocalStorage();
        } else {
            document.getElementById("targetInput").value = '';
            document.getElementById("profileInput").value = '';
            document.getElementById("buildInfoContainer").style.display = "none";
        }
    });

    document.getElementById("scriptsInput").addEventListener("change", function() {
        const customInput = document.getElementById("customScriptInput");
        customInput.style.display = this.value === "99-custom" ? "block" : "none";
        if (this.value === "99-custom" && !customInput.value) {
            customInput.placeholder = '#!/bin/sh\n# root_password=""\nif [ -n "$root_password" ]; then\n  (echo "$root_password"; sleep 1; echo "$root_password") | passwd > /dev/null\nfi\nuci commit';
        }
    });

    ['modelInput', 'packagesInput', 'disabled_servicesInput'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('dblclick', () => { 
            el.value = ''; 
            if (id === 'modelInput') {
                document.getElementById("targetInput").value = '';
                document.getElementById("profileInput").value = '';
                document.getElementById("buildInfoContainer").style.display = "none";
            }
            saveToLocalStorage();
        });
        if (id !== 'modelInput') el?.addEventListener('change', () => el.blur());
    });
});

async function runWorkflow(event) {
    event.preventDefault();
    const token = localStorage.getItem("github_token");
    if (!token) return document.getElementById("setupTokenButton").click();

    const { owner, repo } = await fetchRepo();
    const shareURL = `${window.location.origin}${window.location.pathname}?config=${await encodeFormState()}`;

    const inputs = {
        model: document.getElementById("profileInput").value,
        version: document.getElementById("versionInput").value,
        packages: document.getElementById("packagesInput").value.trim(),
        device_packages: (window.devicePkgs || "").trim(),
        disabled_services: document.getElementById("disabled_servicesInput").value,
        scripts: document.getElementById("scriptsInput").value,
        customScripts: document.getElementById("customScriptInput").value,
        target: document.getElementById("targetInput").value,
        share_url: shareURL
    };

    const triggerRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/build.yml/dispatches`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ ref: "main", inputs })
    });

    if (!triggerRes.ok) return alert("Failed to trigger workflow. Check console.");
    alert("Workflow triggered successfully! Fetching job details...");

    for (let i = 0; i < 5; i++) {
        const runsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs`, { headers: { "Authorization": `Bearer ${token}` } });
        const runsData = await runsRes.json();
        if (runsData.workflow_runs?.length > 0) {
            const runId = runsData.workflow_runs[0].id;
            const jobsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, { headers: { "Authorization": `Bearer ${token}` } });
            const jobsData = await jobsRes.json();
            if (jobsData.jobs[0]?.id) return window.open(`https://github.com/${owner}/${repo}/actions/runs/${runId}/job/${jobsData.jobs[0].id}`, "_blank");
        }
        await new Promise(r => setTimeout(r, (i + 1) * 1000));
    }
}

function saveToken() {
    const token = document.getElementById("tokenInput").value;
    if (!token) return alert("Please enter a valid token!");
    localStorage.setItem("github_token", token);
    alert("Token saved successfully!");
    location.reload();
}

function clearToken() {
    localStorage.removeItem("github_token");
    alert("Token cleared successfully!");
    location.reload();
}

function setupToken() {
    document.getElementById("tokenForm").style.display = "flex";
    document.getElementById("setupTokenButton").style.display = "none";
    document.getElementById("buildForm").style.display = "none";
}

async function testToken() {
    const token = localStorage.getItem("github_token");
    if (!token) return alert("No token found! Please save your token first.");
    const res = await fetch("https://api.github.com/user", { headers: { "Authorization": `Bearer ${token}` } });
    document.getElementById("status").innerText = res.ok ? "✅ Valid!" : "❌ Invalid";
    if (res.ok) setTimeout(() => location.reload(), 2000);
}