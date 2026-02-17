document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("github_token");
    if (!token) {
      document.getElementById("setupTokenButton").style.display = "block";
    } else {
      document.getElementById("setupTokenButton").style.display = "none";
      document.getElementById("clearTokenButton").style.display = "block";
    }
    
    await fetchVersions();
    await fetchModelOptions();
    await fetchScripts();

    // Load form state from URL if present - AFTER scripts are loaded
    await loadFromURL();
    
    document.getElementById("modelInput").addEventListener("change", function() {
        fetchModelOptions();
        const selectedOption = Array.from(modelOptions.options).find(option => option.value === this.value);
        if (selectedOption) {
            document.getElementById("targetInput").value = selectedOption.dataset.target;
            document.getElementById("profileInput").value = selectedOption.text;
        }
    });

    document.getElementById("scriptsInput").addEventListener("change", function() {
        const selectedOption = document.getElementById("scriptsInput").value;
        const customScriptInput = document.getElementById("customScriptInput");
        if (selectedOption === "99-custom") {
            customScriptInput.style.display = "block";
            document.getElementById('customScriptInput').placeholder = '#!/bin/sh\n# root_password=""\nif [ -n "$root_password" ]; then\n  (echo "$root_password"; sleep 1; echo "$root_password") | passwd > /dev/null\nfi\nuci commit';
            
        }else {
            customScriptInput.style.display = "none";
        }
    });

    // Handle modelInput with buildInfo logic
    const modelInput = document.getElementById('modelInput');
    const buildInfo = document.getElementById('buildInfo');

    if (modelInput && buildInfo) {
      modelInput.addEventListener('dblclick', () => {
        // Clear input value
        modelInput.value = '';
        // Immediately hide buildInfo
        buildInfo.style.display = "none";
      });
      modelInput.addEventListener('change', () => modelInput.blur());
    }

    // Handle packagesInput and disabled_servicesInput
    ['packagesInput', 'disabled_servicesInput'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      
      // Clear the input value only on a double-click
      input.addEventListener('dblclick', () => {
        input.value = '';
      });
      
      // When the input changes, remove focus as before
      input.addEventListener('change', () => input.blur());
    });    
    
});

// ============================================
// URL PREFILLING FUNCTIONS
// ============================================

// Simple encryption using token as key
async function encryptWithToken(text, token) {
    if (!text || !token) return null;
    
    // Create a simple hash of token + text for verification
    const key = await hashString(token);
    const data = btoa(unescape(encodeURIComponent(text)));
    const signature = await hashString(key + data);
    
    return JSON.stringify({ data, signature });
}

async function decryptWithToken(encrypted, token) {
    if (!encrypted || !token) return null;
    
    try {
        const { data, signature } = JSON.parse(encrypted);
        const key = await hashString(token);
        const expectedSignature = await hashString(key + data);
        
        // Verify signature matches (token is correct)
        if (signature !== expectedSignature) {
            console.log('Token mismatch - cannot decrypt customScriptInput');
            return null;
        }
        
        // Decrypt
        return decodeURIComponent(escape(atob(data)));
    } catch (e) {
        console.error('Failed to decrypt:', e);
        return null;
    }
}

async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================
// URL PREFILLING FUNCTIONS
// ============================================

// List of all form fields to save/restore
const formFields = [
    'modelInput',
    'versionInput', 
    'profileInput',
    'targetInput',
    'packagesInput',
    'disabled_servicesInput',
    'scriptsInput',
    'customScriptInput'
];

// Encode form state to base64 URL param
async function encodeFormState() {
    const token = localStorage.getItem("github_token");
    const state = {};
    
    for (const fieldId of formFields) {
        const el = document.getElementById(fieldId);
        if (el && el.value) {
            // Encrypt customScriptInput with user's token
            if (fieldId === 'customScriptInput' && token) {
                state[fieldId] = await encryptWithToken(el.value, token);
            } else if (fieldId !== 'customScriptInput') {
                state[fieldId] = el.value;
            }
            // If no token, skip customScriptInput entirely
        }
    }
    
    const json = JSON.stringify(state);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    return base64;
}

// Decode base64 URL param to form state
function decodeFormState(base64) {
    try {
        const json = decodeURIComponent(escape(atob(base64)));
        return JSON.parse(json);
    } catch (e) {
        console.error('Failed to decode form state:', e);
        return null;
    }
}

// Load form state from URL on page load
async function loadFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const config = urlParams.get('config');
    const token = localStorage.getItem("github_token");
    
    console.log('loadFromURL: config param =', config);
    
    if (config) {
        const state = decodeFormState(config);
        console.log('loadFromURL: decoded state =', state);
        
        if (state) {
            for (const fieldId of formFields) {
                const el = document.getElementById(fieldId);
                if (el && state[fieldId]) {
                    // Decrypt customScriptInput if encrypted
                    if (fieldId === 'customScriptInput' && token) {
                        const decrypted = await decryptWithToken(state[fieldId], token);
                        if (decrypted) {
                            console.log('Successfully decrypted customScriptInput');
                            el.value = decrypted;
                        } else {
                            console.log('Failed to decrypt customScriptInput - wrong token or not encrypted');
                            el.value = '';
                        }
                    } else if (fieldId !== 'customScriptInput') {
                        console.log(`Setting ${fieldId} to:`, state[fieldId]);
                        el.value = state[fieldId];
                    }
                    
                    // Trigger change event for scriptsInput to show/hide customScriptInput
                    if (fieldId === 'scriptsInput') {
                        const customScriptInput = document.getElementById('customScriptInput');
                        console.log('scriptsInput set to:', state[fieldId]);
                        if (state[fieldId] === '99-custom') {
                            customScriptInput.style.display = 'block';
                        } else {
                            customScriptInput.style.display = 'none';
                        }
                    }
                }
            }
            
            // Trigger model options fetch if model is set
            if (state.modelInput) {
                fetchModelOptions();
            }
        }
    }
}

// Generate shareable URL
async function generateShareURL() {
    const base64 = await encodeFormState();
    const baseURL = window.location.origin + window.location.pathname;
    const shareURL = `${baseURL}?config=${base64}`;
    
    const displayEl = document.getElementById('shareURL');
    displayEl.textContent = shareURL;
    displayEl.style.display = 'block';
    document.getElementById('copyBtn').style.display = 'block';
    
    // Store for copy function
    window.currentShareURL = shareURL;
}

// Copy URL to clipboard
function copyShareURL() {
    if (window.currentShareURL) {
        navigator.clipboard.writeText(window.currentShareURL).then(() => {
            const btn = document.getElementById('copyBtn');
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        }).catch(err => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = window.currentShareURL;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const btn = document.getElementById('copyBtn');
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        });
    }
}

// ============================================
// ORIGINAL FUNCTIONS
// ============================================

async function fetchRepo() {
  // Step 1: Get the current site URL
  const siteUrl = window.location.href;

  // Step 2: Check if the URL is localhost (127.0.0.1)
  if (siteUrl.includes('127.0.0.1')) {
      // Return hardcoded values immediately without any further processing
      return { owner: 'AzimsTech', repo: 'OpenWrt-Builder' };
  }

  // Step 3: Parse owner and repo from the URL if it matches the format
  let owner, repo;
  if (siteUrl.includes('github.io')) {
      // Extract the owner and repo from the URL
      const urlParts = siteUrl.split('/');
      owner = urlParts[2].split('.')[0]; // Extract owner from "owner.github.io"
      repo = urlParts[3] || ''; // Extract repo if present, otherwise empty string
  } else {
      throw new Error('Invalid URL format. Expected "owner.github.io/repo" or "127.0.0.1".');
  }

  // Step 4: Fetch the actual owner and repo using the GitHub API
  try {
      // Validate the owner using the GitHub Users API
      const userResponse = await fetch(`https://api.github.com/users/${owner}`);
      if (!userResponse.ok) {
          throw new Error(`GitHub user "${owner}" not found.`);
      }
      const userData = await userResponse.json();
      owner = userData.login; // Use the official GitHub username

      // Validate the repository using the GitHub Repositories API
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!repoResponse.ok) {
          throw new Error(`GitHub repository "${owner}/${repo}" not found.`);
      }
      const repoData = await repoResponse.json();
      repo = repoData.name; // Use the official repository name
  } catch (error) {
      console.error('Error fetching GitHub data:', error.message);
      throw error;
  }

  // Step 5: Return the validated owner and repo
  return { owner, repo };
}

async function fetchScripts() {
  const { owner, repo } = await fetchRepo();
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/files/etc/uci-defaults?ref=main`;
  const scriptsOptions = document.getElementById("scriptsInput");
  const repoUrl = document.getElementById("repoUrl");
  repoUrl.href = `https://github.com/${owner}/${repo}/tree/main/files/etc/uci-defaults`;

  return fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      data.forEach(item => {
        if (item.type === 'file') {
          const option = document.createElement("option");
          option.value = item.name;
          option.text = item.name;
          scriptsOptions.appendChild(option);
        }
      });
    })
    .catch(error => {
      console.error('Error:', error);
      alert("Failed to load customization scripts. Please refresh the page to try again.");
    });
}

async function fetchVersions() {
    try {
        const response = await fetch('https://downloads.openwrt.org/.versions.json');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
    
        // Step 1. Filter: Only include versions with major > 23 or (major === 23 and minor >= 5)
        const filteredVersions = data.versions_list.filter(version => {
          const match = version.match(/^(\d+)\.(\d+)/);
          if (!match) return false;
          const major = parseInt(match[1], 10);
          const minor = parseInt(match[2], 10);
          return major > 23 || (major === 23 && minor >= 5);
        });
    
        // Step 2. Group versions by major.minor (e.g. "24.10", "23.05")
        const groups = {};
        filteredVersions.forEach(version => {
          const m = version.match(/^(\d+)\.(\d+)/);
          if (!m) return;
          const groupKey = `${m[1]}.${m[2]}`;
          if (!groups[groupKey]) {
            groups[groupKey] = { finals: [], rcs: [] };
          }
          // Separate final versions from RCs
          if (version.includes('rc')) {
            groups[groupKey].rcs.push(version);
          } else {
            groups[groupKey].finals.push(version);
          }
        });
    
        // Sort the group keys in descending order so that higher versions come first.
        const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
          const [aMajor, aMinor] = a.split('.').map(Number);
          const [bMajor, bMinor] = b.split('.').map(Number);
          if (aMajor !== bMajor) return bMajor - aMajor;
          return bMinor - aMinor;
        });
    
        // Helpers to sort within a group:
        // For final versions, sort descending by the patch number (e.g. "23.05.5" > "23.05.0")
        const sortFinals = (a, b) => {
          const aPatch = (a.match(/^\d+\.\d+\.(\d+)/) || [0, 0])[1];
          const bPatch = (b.match(/^\d+\.\d+\.(\d+)/) || [0, 0])[1];
          return parseInt(bPatch, 10) - parseInt(aPatch, 10);
        };
        // For RC versions, sort descending by the rc number (e.g. "rc7" > "rc1")
        const sortRCs = (a, b) => {
          const aRc = (a.match(/rc(\d+)/) || [0, 0])[1];
          const bRc = (b.match(/rc(\d+)/) || [0, 0])[1];
          return parseInt(bRc, 10) - parseInt(aRc, 10);
        };
    
        // Step 3. Build the final ordered list
        let finalList = [];
        sortedGroupKeys.forEach(groupKey => {
          const group = groups[groupKey];
          // Sort each subgroup
          group.finals.sort(sortFinals);
          group.rcs.sort(sortRCs);
    
          // If there are any final (non‑rc) versions, take the highest as the primary final.
          // Otherwise fall back to the highest RC as the primary.
          const primaryVersion = group.finals[0] || group.rcs[0];
    
          // Always place the primary version first, followed by a SNAPSHOT for that major.minor.
          finalList.push(primaryVersion);
          finalList.push(`${groupKey}-SNAPSHOT`);
    
          // Then list remaining final versions (skipping the first one, which is already listed).
          finalList.push(...group.finals.slice(1));
    
          // Then list remaining RCs (again skipping the first if it was chosen as primary).
          const rcsToAdd = (group.finals[0] === primaryVersion) ? group.rcs : group.rcs.slice(1);
          finalList.push(...rcsToAdd);
        });
    
        // Step 4. Add the global SNAPSHOT at the very beginning.
        finalList.unshift("SNAPSHOT");
    
        // Step 5. Populate the dropdown and set the first item (SNAPSHOT) as selected.
        const versionInput = document.getElementById("versionInput");
        versionInput.innerHTML = "";
        finalList.forEach(version => {
          const option = document.createElement("option");
          option.value = version;
          option.text = version;
          versionInput.appendChild(option);
        });
        versionInput.selectedIndex = 0;
        versionInput.value = "SNAPSHOT";
      } catch (error) {
        console.error('Error fetching versions:', error);
        alert("Failed to load versions. Please refresh the page to try again.");
      }
}


async function fetchModelOptions() {
  const version = document.getElementById("versionInput").value;
  
  // Define url outside of any conditional blocks
  let url;
  if (version === "SNAPSHOT") {
      url = "https://downloads.openwrt.org/snapshots/.overview.json";
  } else {
      url = `https://downloads.openwrt.org/releases/${version}/.overview.json`;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  const modelOptions = document.getElementById("modelOptions");
  modelOptions.innerHTML = ""; // Clear existing options

  const modelInput = document.getElementById("modelInput");
  let modelFound = false;

  data.profiles.forEach(profile => {
      const option = document.createElement("option");
      const modelText = `${profile.titles[0].vendor} ${profile.titles[0].model}${profile.titles[0].variant ? ' ' + profile.titles[0].variant : ''}`;
      option.value = modelText;
      option.text = profile.id;
      option.dataset.target = profile.target; // Store target in data attribute
      modelOptions.appendChild(option);
      
      // Check if the modelInput value is in the options
      if (modelInput.value === modelText) {
          modelFound = true;
          const target = profile.target;
          const version = document.getElementById("versionInput").value;
          getBuildInfo(target,version);
      }
  });

  // Clear modelInput if its value isn't found
  if (!modelFound) {
      modelInput.value = '';
      document.getElementById("buildInfo").style.display = "none";
  }else {
    document.getElementById("buildInfo").style.display = "block";
  }
}


function saveToken() {
    const token = document.getElementById("tokenInput").value;
    if (!token) {
        alert("Please enter a valid token!");
        return;
    }
    localStorage.setItem("github_token", token);
    alert("Token saved successfully!");
}

function clearToken() {
    localStorage.removeItem("github_token");
    alert("Token cleared successfully!");
    document.getElementById("tokenForm").style.display = "block";
    document.getElementById("clearTokenButton").style.display = "none";
    document.getElementById("buildForm").style.display = "none";
}

function setupToken() {
    document.getElementById("tokenForm").style.display = "block";
    document.getElementById("setupTokenButton").style.display = "none";
    document.getElementById("clearTokenButton").style.display = "none";
    document.getElementById("buildForm").style.display = "none";
}

async function testToken() {
    const token = localStorage.getItem("github_token");
    if (!token) {
        alert("No token found! Please save your token first.");
        return;
    }

    const response = await fetch("https://api.github.com/user", {
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      document.getElementById("status").innerText = "✅ Token is valid and has the correct permissions!";
      setTimeout(() => {
        location.reload();
      }, 3000);
    } else {
      document.getElementById("status").innerText = "❌ Invalid token or missing required permissions. Make sure the token has 'repo', 'workflow', and 'admin:repo_hook' permissions.";
    }
}

async function getBuildInfo(target,version) {
  let url;
  if (version === "SNAPSHOT") {
      url = `https://downloads.openwrt.org/snapshots/targets/${target}/`;
  } else {
      url = `https://downloads.openwrt.org/releases/${version}/targets/${target}/`;
  }

  if (target) {
      let buildinfo = url + "version.buildinfo?cacheBust=" + Date.now(); // Cache-busting
      const response = await fetch(buildinfo, { cache: 'no-store' });
      if (!response.ok) {
          buildinfo = "Build info not found!";
      } else {
          buildinfo = await response.text();
          const lastModified = response.headers.get('Last-Modified');
          const date = new Date(lastModified);

          const profileId = document.getElementById("profileInput").value;
          const profilesRes = await fetch(url + "profiles.json");
          const profilesData = await profilesRes.json();
          const rawPkgs = profilesData.profiles[profileId]?.device_packages || [];
          const removals = new Set(rawPkgs.filter(p => p.startsWith('-')).map(p => p.slice(1)));
          const devicePkgs = rawPkgs.filter(p => !p.startsWith('-') ? !removals.has(p) : true).join(" ");
          window.devicePkgs = devicePkgs;

          document.getElementById("buildInfo").innerHTML = `<b>Version Code:</b> ${buildinfo.trim()} <br><b>Last modified:</b> ${date} <br><b>Target:</b> ${target}<br><b>Device Packages:</b> ${devicePkgs || "none"}<br>`;
      }
  }
}

async function runWorkflow(event) {
    event.preventDefault();
    const token = localStorage.getItem("github_token");
    if (!token) {

      alert("No token found! Please save your token first.");
      setupToken();  
      return;
    }else {
      document.getElementById("buildForm").style.display = "block";
      document.getElementById("tokenForm").style.display = "none";
      document.getElementById("clearTokenButton").style.display = "block";    
    }
    
    // Generate shareable URL to include in release notes
    const shareConfig = await encodeFormState();
    const shareURL = `${window.location.origin}${window.location.pathname}?config=${shareConfig}`;
    
    const workflowFile = "build.yml";
    const { owner, repo } = await fetchRepo();

    // Step 1: Trigger the workflow
    const inputs = {
        model: document.getElementById("profileInput").value,
        version: document.getElementById("versionInput").value,
        packages: (document.getElementById("packagesInput").value + " " + (window.devicePkgs || "")).trim(),
        disabled_services: document.getElementById("disabled_servicesInput").value,
        scripts: document.getElementById("scriptsInput").value,
        customScripts: document.getElementById("customScriptInput").value,
        target: document.getElementById("targetInput").value,
        share_url: shareURL
    };
    console.log("Workflow inputs:", inputs);

    const triggerResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ ref: "main", inputs })
    });

    if (!triggerResponse.ok) {
        alert("Failed to trigger workflow. Check console.");
        console.error("Trigger failed:", await triggerResponse.text());
        newTab.close(); // Close the tab if request fails
        return;
    }
    alert("Workflow triggered successfully! Fetching job details...");

    // Step 2: Wait for GitHub to register the run
    async function waitForWorkflowRun(owner, repo, token) {
      const MAX_RETRIES = 5;
      for (let i = 0; i < MAX_RETRIES; i++) {
        const runsResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/runs`,
          { headers: { "Authorization": `Bearer ${token}` } }
        );
        const runsData = await runsResponse.json();
        if (runsData.workflow_runs?.length > 0) {
          return runsData.workflow_runs[0].id;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
      throw new Error('Workflow run not found after multiple attempts');
    }
    
    // Step 3: Get the latest workflow run ID
    const runId = await waitForWorkflowRun(owner, repo, token);

    // Step 4: Get the job ID from the run
    const jobsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    const jobsData = await jobsResponse.json();
    const jobId = jobsData.jobs[0]?.id;
    if (!jobId) {
        alert("No job found.");
        newTab.close();
        return;
    }

    // Step 5: Update the new tab with the job URL
    const jobUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}/job/${jobId}`;
    window.open(jobUrl, "_blank");
    console.log("Job URL:", jobUrl);
}
