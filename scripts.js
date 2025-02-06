function saveToken() {
    const token = document.getElementById("tokenInput").value;
    if (!token) {
        alert("Please enter a valid token!");
        return;
    }
    localStorage.setItem("github_token", token);
    alert("Token saved successfully!");
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
    } else {
        document.getElementById("status").innerText = "❌ Invalid token or missing required permissions. Make sure the token has 'repo', 'workflow', and 'admin:repo_hook' permissions.";
    }
}

async function runWorkflow(event) {
    event.preventDefault();
    const token = localStorage.getItem("github_token");
    if (!token) {
        alert("No token found! Please save your token first.");
        return;
    }

    // Get the current path from the GitHub Pages URL (e.g., /repository-name/)
    const path = window.location.pathname;

    // Extract the repository name from the path (e.g., "repository-name" from "/repository-name/")
    const repoName = path.split('/')[1];

    // If repoName is empty, fallback to the default repository for a username-based GitHub Pages URL
    const username = window.location.hostname.split('.')[0];
    const githubRepoUrl = repoName ? `https://github.com/${username}/${repoName}` : `https://github.com/${username}`;
    const workflowFile = "build.yml";

    // Step 1: Trigger the workflow
    const triggerResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}/actions/workflows/${workflowFile}/dispatches`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ref: "main",
            inputs: {
                model: document.getElementById("modelInput").value,
                version: document.getElementById("versionInput").value,
                packages: document.getElementById("packagesInput").value,
                disabled_services: document.getElementById("disabled_servicesInput").value,
                scripts: document.getElementById("scriptsInput").value
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
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Get the latest workflow run ID
    const runsResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}/actions/runs`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    const runsData = await runsResponse.json();
    const runId = runsData.workflow_runs[0]?.id;
    if (!runId) {
        alert("No workflow run found.");
        newTab.close();
        return;
    }

    // Step 4: Get the job ID from the run
    const jobsResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}/actions/runs/${runId}/jobs`, {
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
    const jobUrl = `https://github.com/${username}/${repoName}/actions/runs/${runId}/job/${jobId}`;
    window.open(jobUrl, "_blank");
    console.log("Job URL:", jobUrl);
}