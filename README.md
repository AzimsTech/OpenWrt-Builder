# OpenWrt-Builder
✨ Build and Publish OpenWrt Image

The OpenWrt-Builder workflow, running on GitHub Actions, first retrieves the `.overview.json` file from the OpenWrt downloads server [https://downloads.openwrt.org](https://downloads.openwrt.org). It then parses this structured data to dynamically determine the target PROFILE, which configures the Image Builder's build process within the GitHub Actions environment.

## 🚀 Getting Started Guide

### Prerequisites
- A GitHub account
- Basic understanding of GitHub workflows

### 📖 Step-by-Step Usage

#### 1. Fork the Repository
[![Fork Button](https://img.shields.io/badge/-Fork%20Repository-%232161FF?style=for-the-badge&logo=github)](https://github.com/AzimsTech/OpenWrt-Builder/fork)
- Click the fork button above or manually:
  1. Visit [OpenWrt-Builder repository](https://github.com/AzimsTech/OpenWrt-Builder)
  2. Click "Fork" in the top-right corner
  3. Keep default settings and create fork

#### 2. Enable GitHub Actions
🔧 Required for build automation
1. In your new fork, go to **Actions** tab
2. Click **"I understand my workflows, go ahead and enable them"**
3. Verify workflows are enabled:
   - Look for **"Build and Publish OpenWrt Image"** workflow in the Actions list
   - Should appear immediately after enabling

#### 3. Configure GitHub Pages
🌐 Host your built OpenWrt-Builder frontends.
1. Go to **Settings** → **Pages**
2. Configure:
   - **Branch**: `main`
   - **Folder**: `/ (root)`
3. Click "Save"
   
#### 4. Access Your Builder
🔗 After configuration (may take 2-3 minutes):
- Visit `https://<YOUR-GITHUB-USERNAME>.github.io/OpenWrt-Builder`
- Replace `<YOUR-GITHUB-USERNAME>` with your actual GitHub username

---

### 🕒 First-Time Setup Notes
- Initial build may take 10-15 minutes
- Pages site becomes available after first successful workflow run
- Check Actions tab for build progress

### 🛠️ Customization Options
After setup:
- Edit `.config` files in your fork
- Modify workflow files in `.github/workflows/`
- Adjust build parameters in `config.yml`

### 🔍 Troubleshooting
If site isn't available:
1. Check Actions tab for failed workflows
2. Verify Pages are enabled in Settings
3. Ensure `gh-pages` branch exists (auto-created by workflow)

---

**✨ Pro Tip:** Bookmark your GitHub Pages URL once it's live for easy access to your OpenWrt builds!


![cover](https://github.com/user-attachments/assets/1549ea31-2e24-4cf6-a63b-67562fa1b91e)
