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
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/files/etc/uci-defaults?ref=main`;
    const response = await fetch(apiUrl);
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
        const lastModified = new Date(buildInfoRes.headers.get('Last-Modified'));
        
        const profilesRes = await fetch(baseUrl + "profiles.json");
        const profilesData = await profilesRes.json();
        
        const rawPkgs = profilesData.profiles[profileId]?.device_packages || [];
        const removals = new Set(rawPkgs.filter(p => p.startsWith('-')).map(p => p.slice(1)));
        const devicePkgs = rawPkgs.filter(p => !p.startsWith('-') ? !removals.has(p) : true).join(" ");
        
        window.devicePkgs = devicePkgs; // Store for build submission
        
        return `<b>Version Code:</b> <a href="https://git.openwrt.org/openwrt/openwrt/log/?id=${buildinfo.trim().match(/-(.+)/)[1]}" target="_blank">${buildinfo.trim()}</a> <br><b>Last modified:</b> ${lastModified} <br><b>Target:</b> ${target}<br><b>Device Packages:</b> ${devicePkgs || "none"}<br>`;
    } catch (e) {
        window.devicePkgs = "";
        return "Build info not found!";
    }
}

// ============================================
// 2. VIEW / UI LAYER (DOM Manipulation)
// ============================================

function renderDropdown(elementId, items, selectedValue = null) {
    const select = document.getElementById(elementId);
    select.innerHTML = "";
    if (elementId === "scriptsInput") select.innerHTML = '<option value=""></option><option value="99-custom">custom</option>';
    
    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.text = item;
        select.appendChild(option);
    });
    if (selectedValue) select.value = selectedValue;
}

function renderModelDatalist(models) {
    const datalist = document.getElementById("modelOptions");
    datalist.innerHTML = "";
    models.forEach(model => {
        const option = document.createElement("option");
        option.value = model.title;
        option.text = model.id;
        option.dataset.target = model.target;
        datalist.appendChild(option);
    });
}

async function updateBuildInfoDisplay() {
    const modelInput = document.getElementById("modelInput").value;
    const version = document.getElementById("versionInput").value;
    const target = document.getElementById("targetInput").value;
    const profileId = document.getElementById("profileInput").value;
    const buildInfoEl = document.getElementById("buildInfo");

    if (modelInput && target && profileId) {
        buildInfoEl.style.display = "block";
        buildInfoEl.innerHTML = "Fetching build info...";
        buildInfoEl.innerHTML = await fetchBuildInfo(target, version, profileId);
    } else {
        buildInfoEl.style.display = "none";
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
    document.getElementById('shareURL').textContent = shareURL;
    document.getElementById('shareURL').style.display = 'block';
    document.getElementById('copyBtn').style.display = 'block';
    window.currentShareURL = shareURL;
}

function copyShareURL() {
    navigator.clipboard.writeText(window.currentShareURL);
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📄 Copy URL', 2000);
}

// ============================================
// 4. CONTROLLER (Init & Events)
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
    // Check Token UI
    if (!localStorage.getItem("github_token")) {
        document.getElementById("setupTokenButton").style.display = "block";
    } else {
        document.getElementById("clearTokenButton").style.display = "block";
    }

    // Initialize Data
    const versions = await fetchOpenWrtVersions();
    renderDropdown("versionInput", versions);
    
    const initialVersion = document.getElementById("versionInput").value;
    const models = await fetchModelsForVersion(initialVersion);
    renderModelDatalist(models);

    const { owner, repo } = await fetchRepo();
    document.getElementById("repoUrl").href = `https://github.com/${owner}/${repo}/tree/main/files/etc/uci-defaults`;
    const scripts = await fetchAvailableScripts(owner, repo);
    renderDropdown("scriptsInput", scripts);

    await loadFromURL();
    if (document.getElementById("modelInput").value) updateBuildInfoDisplay();

    // Events
    document.getElementById("versionInput").addEventListener("change", async function() {
        renderModelDatalist(await fetchModelsForVersion(this.value));
        updateBuildInfoDisplay();
    });

    document.getElementById("modelInput").addEventListener("change", function() {
        const option = Array.from(document.getElementById("modelOptions").options).find(o => o.value === this.value);
        if (option) {
            document.getElementById("targetInput").value = option.dataset.target;
            document.getElementById("profileInput").value = option.text;
            updateBuildInfoDisplay();
        } else {
            this.value = '';
            document.getElementById("buildInfo").style.display = "none";
        }
        this.blur();
    });

    document.getElementById("scriptsInput").addEventListener("change", function() {
        const customInput = document.getElementById("customScriptInput");
        customInput.style.display = this.value === "99-custom" ? "block" : "none";
        if (this.value === "99-custom") customInput.placeholder = '#!/bin/sh\n# root_password=""\nif [ -n "$root_password" ]; then\n  (echo "$root_password"; sleep 1; echo "$root_password") | passwd > /dev/null\nfi\nuci commit';
    });

    ['modelInput', 'packagesInput', 'disabled_servicesInput'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('dblclick', () => { 
            el.value = ''; 
            if (id === 'modelInput') document.getElementById("buildInfo").style.display = "none"; 
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

// Token management functions (kept unchanged)
function saveToken() {
    const token = document.getElementById("tokenInput").value;
    if (!token) return alert("Please enter a valid token!");
    localStorage.setItem("github_token", token);
    alert("Token saved successfully!");
}

function clearToken() {
    localStorage.removeItem("github_token");
    alert("Token cleared successfully!");
    location.reload();
}

function setupToken() {
    document.getElementById("tokenForm").style.display = "block";
    document.getElementById("setupTokenButton").style.display = "none";
    document.getElementById("buildForm").style.display = "none";
}

async function testToken() {
    const token = localStorage.getItem("github_token");
    if (!token) return alert("No token found! Please save your token first.");
    const res = await fetch("https://api.github.com/user", { headers: { "Authorization": `Bearer ${token}` } });
    document.getElementById("status").innerText = res.ok ? "✅ Token is valid!" : "❌ Invalid token or permissions.";
    if (res.ok) setTimeout(() => location.reload(), 2000);
}