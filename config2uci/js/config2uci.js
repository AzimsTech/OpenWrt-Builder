function convertToUci() {
    const input = document.getElementById("configInput").value;
    let output = "";
    let section = "";
    let sectionName = "";
    let sectionCount = {};
    let configTypes = new Set();
    let currentConfigType = "";
    let listKeys = new Map(); // Track list keys and their first occurrence

    input.split("\n").forEach(line => {
        line = line.trim();
        if (line.startsWith("config")) {
            let parts = line.split(" ");
            section = parts[1];
            sectionName = parts[2]?.replace(/'/g, "") || null;

            // Determine config type based on section for each section
            if (section === "wifi-device" || section === "wifi-iface") {
                currentConfigType = "wireless";
            } else if (section === "dhcp" || section === "dnsmasq" || section === "odhcpd") {
                currentConfigType = "dhcp";
            } else if (section === "system" || section === "timeserver" || section === "led") {
                currentConfigType = "system";
            } else if (section === "interface" || section === "device" || section === "bridge-vlan" || section === "route" || section === "rule" || section === "switch" || section === "switch_vlan") {
                currentConfigType = "network";
            } else {
                // Default fallback
                currentConfigType = "network";
            }

            configTypes.add(currentConfigType);

            if (!sectionName) {
                if (!sectionCount[section]) sectionCount[section] = 0;
                sectionName = `@${section}[${sectionCount[section]}]`;
                sectionCount[section]++;
            }
            output += `uci set ${currentConfigType}.${sectionName}=${section}\n`;
        } else if (line.startsWith("option")) {
            let parts = line.split(" ");
            let key = parts[1].replace(/'/g, "");
            let value = parts.slice(2).join(" ").replace(/'/g, "");
            output += `uci set ${currentConfigType}.${sectionName}.${key}='${value}'\n`;
        } else if (line.startsWith("list")) {
            let parts = line.split(" ");
            let key = parts[1].replace(/'/g, "");
            let value = parts.slice(2).join(" ").replace(/'/g, "");
            
            // Track list keys and add del command before first add_list
            let listKey = `${currentConfigType}.${sectionName}.${key}`;
            if (!listKeys.has(listKey)) {
                listKeys.set(listKey, true);
                output += `uci del ${listKey}\n`;
            }
            
            output += `uci add_list ${currentConfigType}.${sectionName}.${key}='${value}'\n`;
        }
    });

    // Add commit commands for all config types used
    configTypes.forEach(configType => {
        output += `uci commit ${configType}\n`;
    });

    document.getElementById("uciOutput").value = output;
}