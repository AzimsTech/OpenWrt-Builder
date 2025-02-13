document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("github_token");
    if (token) {
        document.getElementById("tokenForm").style.display = "none";
        document.getElementById("clearTokenButton").style.display = "block";
    }else {
      document.getElementById("buildForm").style.display = "none";
    }

    await fetchVersions();
    await fetchModelOptions();
    await fetchScripts();

    
    document.getElementById("modelInput").addEventListener("input", function() {
        const selectedOption = Array.from(modelOptions.options).find(option => option.value === this.value);
        if (selectedOption) {
            document.getElementById("targetInput").value = selectedOption.dataset.target;
            document.getElementById("profileInput").value = selectedOption.text;
        }
        getBuildInfo(targetInput.value,versionInput.value);
    });
    
});

function fetchRepo() {
  // Get the current path from the GitHub Pages URL (e.g., /repository-name/)
  const path = window.location.pathname;
  // console.log(path); // Commented out for production

  // Extract the repository name from the path (e.g., "repository-name" from "/repository-name/")
  let repo = path.split('/')[1];

  // If repoName is empty, fallback to the default repository for a username-based GitHub Pages URL
  let owner = window.location.hostname.split('.')[0];
  if (owner === '127') {
    owner = "AzimsTech";
    repo = "OpenWrt-Builder";
  }
  const repoUrl = document.getElementById("repoUrl");
  repoUrl.href = `https://github.com/${owner}/${repo}/tree/main/files/etc/uci-defaults`;
  return { owner, repo };
}

async function fetchScripts() {
  const { owner, repo } = fetchRepo();
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/files/etc/uci-defaults?ref=main`;
  const scriptsOptions = document.getElementById("scriptsInput");

  fetch(apiUrl)
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
          if (group.finals.length > 0) {
            const primaryFinal = group.finals.shift(); // highest final version
            finalList.push(primaryFinal);
    
            // For the stable version group (data.stable_version, e.g. "24.10.0"),
            // insert first a generic "SNAPSHOT" (at index 1) and then a version-specific snapshot.
            if (primaryFinal === data.stable_version) {
              finalList.push("SNAPSHOT");             // Insert a plain "SNAPSHOT"
              finalList.push(`${groupKey}-SNAPSHOT`);   // e.g. "24.10-SNAPSHOT"
            } else {
              // For other groups, insert only the version-specific snapshot
              finalList.push(`${groupKey}-SNAPSHOT`);
            }
            // Append any remaining final versions from this group (if any)
            finalList.push(...group.finals);
          } else {
            // If there are no finals, add the snapshot for the group
            finalList.push(`${groupKey}-SNAPSHOT`);
          }
          // Append all RC versions for this group
          finalList.push(...group.rcs);
        });
    
        // At this point, finalList should be (for example):
        // [
        //   "24.10.0", "SNAPSHOT", "24.10-SNAPSHOT",
        //   "24.10.0-rc7", "24.10.0-rc6", "24.10.0-rc5",
        //   "24.10.0-rc4", "24.10.0-rc3", "24.10.0-rc2", "24.10.0-rc1",
        //   "23.05.5", "23.05-SNAPSHOT", "23.05.4", "23.05.3", "23.05.2",
        //   "23.05.1", "23.05.0", "23.05.0-rc4", "23.05.0-rc3", "23.05.0-rc2", "23.05.0-rc1"
        // ]
    
        // Step 4. Append each version in the final list as an <option> in the <select> element.
        const verOptions = document.getElementById('versionInput');
        if (!verOptions) {
          throw new Error('No element with id "versionInput" found');
        }
    
        finalList.forEach(item => {
          const option = document.createElement("option");
          option.value = item;
          option.text = item;
          verOptions.appendChild(option);
        });
      } catch (error) {
        console.error('Error fetching or processing versions.json:', error);
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
      }
  });

  // Clear modelInput if its value isn't found
  if (!modelFound) {
      modelInput.value = '';
  }
  const target = document.getElementById("targetInput").value;
  getBuildInfo(target,version);
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
    let buildinfo = url + "version.buildinfo";
    const response = await fetch(buildinfo);
    if (!response.ok) {
      buildinfo = "Build info not found!";
    } else {
      buildinfo = await response.text();
      const lastModified = response.headers.get('Last-Modified');
      const date = new Date(lastModified);
      document.getElementById("buildInfo").innerHTML = `<b>Version Code:</b> ${buildinfo.trim()} <br><b>Last modified:</b> ${date} <br><b>Target:</b> ${target}<br>`;
    }
  }



}

async function runWorkflow(event) {
    event.preventDefault();
    const token = localStorage.getItem("github_token");
    if (!token) {
        alert("No token found! Please save your token first.");
        return;
    }

    const workflowFile = "build.yml";
    const { owner, repo } = fetchRepo();

    // Step 1: Trigger the workflow
    const triggerResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ref: "main",
            inputs: {
                model: document.getElementById("profileInput").value,
                version: document.getElementById("versionInput").value,
                packages: document.getElementById("packagesInput").value,
                disabled_services: document.getElementById("disabled_servicesInput").value,
                scripts: document.getElementById("scriptsInput").value,
                target: document.getElementById("targetInput").value // Include target in the workflow inputs
            }
        })
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