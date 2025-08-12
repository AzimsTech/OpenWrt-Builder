# OpenWrt Builder 🚀

Build custom OpenWrt firmware images with a web interface and automated GitHub Actions.

## Features

- 🌐 **Web Interface** - Build images through GitHub Pages
- ⚡ **GitHub Actions Build** - Generates and uploads firmware to releases
- 🔧 **Config2UCI** - Convert config files to UCI commands

## Quick Start

1. **[Fork this repository](.,/fork)**
2. **Enable GitHub Pages** in repository settings
3. **Visit `<username>.github.io/<repo-name>`** to access the builder

## Build Process

1. Web interface triggers GitHub Actions workflow
2. Select from scripts in `/files/etc/uci-defaults/` or input custom ones
3. OpenWrt ImageBuilder downloads and configures
4. Firmware image is compiled and uploaded to GitHub Releases

## License

GPL-2.0 - See [COPYING](COPYING) and [LICENSE](LICENSE) files.

---

**Live Demo:** [azimstech.github.io/openwrt-builder](https://azimstech.github.io/openwrt-builder)  
**Issues:** [Report bugs and requests](../../issues)
