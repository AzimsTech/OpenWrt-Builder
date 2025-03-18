function convertToUci() {
    const input = document.getElementById("configInput").value;
    let output = "";
    let section = "";
    let sectionName = "";
    let sectionCount = {};
    let configType = "";

    input.split("\n").forEach(line => {
        line = line.trim();
        if (line.startsWith("config")) {
            let parts = line.split(" ");
            section = parts[1];
            sectionName = parts[2]?.replace(/'/g, "") || null;

            if (!configType) {
                if (section === "wifi-device" || section === "wifi-iface") {
                    configType = "wireless";
                } else if (section === "dhcp" || section === "dnsmasq" || section === "odhcpd") {
                    configType = "dhcp";
                } else {
                    configType = "network";
                }
            }

            if (!sectionName) {
                if (!sectionCount[section]) sectionCount[section] = 0;
                sectionName = `@${section}[${sectionCount[section]}]`;
                sectionCount[section]++;
            }
            output += `uci set ${configType}.${sectionName}=${section}\n`;
        } else if (line.startsWith("option")) {
            let parts = line.split(" ");
            let key = parts[1].replace(/'/g, "");
            let value = parts.slice(2).join(" ").replace(/'/g, "");
            output += `uci set ${configType}.${sectionName}.${key}='${value}'\n`;
        } else if (line.startsWith("list")) {
            let parts = line.split(" ");
            let key = parts[1].replace(/'/g, "");
            let value = parts.slice(2).join(" ").replace(/'/g, "");
            output += `uci add_list ${configType}.${sectionName}.${key}='${value}'\n`;
        }
    });

    output += `uci commit ${configType}\n`;
    document.getElementById("uciOutput").value = output;
}
