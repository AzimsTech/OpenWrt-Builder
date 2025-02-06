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

async function runWorkflow() {
    const token = localStorage.getItem("github_token");
    if (!token) {
        alert("No token found! Please save your token first.");
        return;
    }
    fetch("https://api.github.com/repos/AzimsTech/OpenWrt-Builder/actions/workflows/build.yml/dispatches", {
        method: "POST",
        headers: {
            "Authorization": "token " + localStorage.getItem("github_token"),
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
    })
    .then(response => {
        if (response.ok) {
            alert("Workflow triggered successfully!");
            console.log(response.workflow_runs[0]);
        } else {
            alert("Failed to trigger workflow. Check console.");
        }
        return response.json();
    })
    .then(data => console.log(data))
    .catch(error => console.error("Error:", error));
}