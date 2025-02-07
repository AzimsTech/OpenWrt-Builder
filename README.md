# OpenWrt-Builder

The OpenWrt-Builder workflow, running on GitHub Actions, first retrieves the `.overview.json` file from the OpenWrt downloads server [https://downloads.openwrt.org](https://downloads.openwrt.org). It then parses this structured data to dynamically determine the target PROFILE, which configures the Image Builder's build process within the GitHub Actions environment.

[✨ Build and Publish OpenWrt Image](https://github.com/AzimsTech/OpenWrt-Builder/actions/workflows/build.yml)

![cover](https://github.com/user-attachments/assets/1549ea31-2e24-4cf6-a63b-67562fa1b91e)
