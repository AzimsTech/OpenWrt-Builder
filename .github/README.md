# OpenWrt Builder 🚀

![Visitors](https://api.visitorbadge.io/api/visitors?path=https%3A%2F%2Fgithub.com%2FAzimsTech%2FOpenWrt-Builder%2F&label=repository%20visits&countColor=%23263759&style=flat&labelStyle=none)
[![GitHub License](https://img.shields.io/github/license/henriquesebastiao/badges?color=blue)](https://github.com/AzimsTech/OpenWrt-Builder/blob/main/LICENSE)
![OpenWrt](https://img.shields.io/badge/OpenWrt-00B5E2?style=flat&logo=OpenWrt&logoColor=white)
![GitHub Repo stars](https://img.shields.io/github/stars/AzimsTech/OpenWrt-Builder)

Build custom OpenWrt firmware images with a web interface and automated GitHub Actions.

## Features

- 🌐 **Web Interface** - OpenWrt Image Builder frontends via GitHub Pages
- ⚡ **GitHub Actions Build** - Builds and uploads firmware to releases
- 🔧 **Config2UCI** - Convert config files to UCI commands

## Quick Start

1. **Fork this repository** [![GitHub forks][fork-shield]][fork-url]
2. **Enable GitHub Pages** in repository settings
3. **Visit `<username>.github.io/<repo-name>`** to access the builder

## Build Process

1. Web interface triggers GitHub Actions workflow
2. Select from scripts in `/files/etc/uci-defaults/` or input custom ones
3. OpenWrt ImageBuilder downloads and configures
4. Firmware image is compiled and uploaded to GitHub Releases

## Repository Secrets 

This repo can use the following secrets, which may be set in the repository (**Settings** → **Secrets and variables** → **Actions**) to automatically populate variables in configuration files located in `files/etc/uci-defaults` directory:

```shell
.
├── files
│   └── etc
│       └── uci-defaults
│           ├── script1
│           ├── script2
│           └── script3
├── ... 
```

### Secret Variables Mapping

| **Secret Name** | **Variable Name** | **Description**                              | **Example** |
| --------------- | ----------------- | -------------------------------------------- | ----------- |
| `ROOT_PASS`     | `root_password`   | Administrator (root) password for the router | root        |
| `WLAN_NAME`     | `ssid`            | Wireless network SSID                        | OpenWrt     |
| `WLAN_PASS`     | `ssid_key`        | Wireless network password                    | 12345678    |
| `PPPOE_NAME`    | `pppoe_name`      | PPPoE username                               | username    |
| `PPPOE_PASS`    | `pppoe_key`       | PPPoE password                               | password    |

### Example

**Before:**


```sh
# files/etc/uci-defaults/99-custom
# root_password=""
# ssid=""
# ssid_key=""
# pppoe_name=""
# pppoe_key=""
```

**After:**

```sh
# files/etc/uci-defaults/99-custom
root_password="root"
ssid="OpenWrt"
ssid_key="12345678"
pppoe_name="username"
pppoe_key="password"
```

## License

GPL-2.0 - See [COPYING](../COPYING) and [LICENSE](../LICENSE) files.

---

**Live Demo:** [azimstech.github.io/openwrt-builder][demo-url]  
**Issues:** [Report bugs and requests][issues-url]

[fork-shield]:https://img.shields.io/github/forks/AzimsTech/OpenWrt-Builder
[fork-url]:https://github.com/AzimsTech/OpenWrt-Builder/fork
[issues-url]:https://github.com/AzimsTech/OpenWrt-Builder/issues
[repo-url]:https://github.com/AzimsTech/OpenWrt-Builder
[demo-url]:https://azimstech.github.io/openwrt-builder
